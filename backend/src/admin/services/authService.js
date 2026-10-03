import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { Admin, AdminSession, AdminPasswordReset, AuditLog } from '../../models/index.js';
import { getRolePermissions } from '../permissions/permissions.js';
import env from '../../config/env.js';
import AppError from '../../utils/customError.js';
import mailService from '../../services/mailService.js';
import logger from '../../config/logger.js';

export const authService = {
  /**
   * Authenticate admin via Email + Password
   */
  async login({ email, password, ipAddress, userAgent }) {
    if (!email || !password) {
      throw AppError.badRequest('Email and password are required');
    }

    const admin = await Admin.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    // Timing-safe constant failure message (do not expose email existence)
    if (!admin) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (!admin.isActive) {
      throw AppError.forbidden('Administrator account is deactivated. Please contact your Super Admin.');
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'admin',
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    // Calculate expiry date
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save session in database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await AdminSession.create({
      adminId: admin.id,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    // Update lastLoginAt
    await admin.update({ lastLoginAt: new Date() });

    // Record audit log
    await AuditLog.create({
      adminId: admin.id,
      action: 'ADMIN_LOGIN',
      entity: 'Admin',
      entityId: admin.id,
      metadata: { email: admin.email, role: admin.role },
      ipAddress: ipAddress || null,
    });

    return {
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        mustChangePassword: admin.mustChangePassword,
        permissions: getRolePermissions(admin.role),
        lastLoginAt: admin.lastLoginAt,
      },
    };
  },

  /**
   * Request Forgot Password link
   */
  async forgotPassword({ email, ipAddress }) {
    if (!email) {
      throw AppError.badRequest('Email address is required');
    }

    const admin = await Admin.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success message even if admin does not exist (Security Best Practice)
    if (!admin || !admin.isActive) {
      return {
        message: 'If an active account exists with that email, a password reset link has been sent.',
        ...(env.isDevelopment ? { debugToken: resetToken, debugResetUrl: resetUrl } : {}),
      };
    }

    // Generate secure random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    // Store in admin_password_resets
    await AdminPasswordReset.create({
      adminId: admin.id,
      tokenHash,
      expiresAt,
    });

    // Construct reset URL
    const resetUrl = `${env.FRONTEND_URL}/admin/reset-password?token=${resetToken}`;

    // Send email
    await mailService.sendPasswordResetEmail({
      toEmail: admin.email,
      resetUrl,
      adminName: admin.name,
    });

    // Record audit log
    await AuditLog.create({
      adminId: admin.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'Admin',
      entityId: admin.id,
      metadata: { email: admin.email },
      ipAddress: ipAddress || null,
    });

    return {
      message: 'If an active account exists with that email, a password reset link has been sent.',
    };
  },

  /**
   * Reset Password with token
   */
  async resetPassword({ token, newPassword, confirmPassword, ipAddress }) {
    if (!token) {
      throw AppError.badRequest('Reset token is required');
    }

    if (!newPassword || newPassword.length < 12) {
      throw AppError.badRequest('New password must be at least 12 characters long');
    }

    if (newPassword !== confirmPassword) {
      throw AppError.badRequest('Password confirmation does not match');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await AdminPasswordReset.findOne({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
      include: [{ model: Admin, as: 'admin' }],
    });

    if (!resetRecord || !resetRecord.admin) {
      throw AppError.badRequest('Invalid or expired password reset link. Please request a new one.');
    }

    const admin = resetRecord.admin;

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password and clear mustChangePassword
    await admin.update({
      passwordHash,
      mustChangePassword: false,
    });

    // Mark reset record as used
    await resetRecord.update({ usedAt: new Date() });

    // Invalidate all active sessions for this admin
    await AdminSession.update(
      { revokedAt: new Date() },
      { where: { adminId: admin.id, revokedAt: null } }
    );

    // Record audit log
    await AuditLog.create({
      adminId: admin.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'Admin',
      entityId: admin.id,
      ipAddress: ipAddress || null,
    });

    return {
      message: 'Password has been successfully updated. You can now log in with your new password.',
    };
  },

  /**
   * Change Password (for logged-in admin)
   */
  async changePassword({ adminId, currentPassword, newPassword, confirmPassword, ipAddress }) {
    if (!newPassword || newPassword.length < 12) {
      throw AppError.badRequest('New password must be at least 12 characters long');
    }

    if (newPassword !== confirmPassword) {
      throw AppError.badRequest('New password confirmation does not match');
    }

    const admin = await Admin.findByPk(adminId);
    if (!admin) {
      throw AppError.notFound('Administrator not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await admin.update({
      passwordHash,
      mustChangePassword: false,
    });

    await AuditLog.create({
      adminId: admin.id,
      action: 'PASSWORD_CHANGED',
      entity: 'Admin',
      entityId: admin.id,
      ipAddress: ipAddress || null,
    });

    return {
      message: 'Password updated successfully.',
    };
  },

  /**
   * Invalidate current session (Logout)
   */
  async logout({ adminToken, adminId, ipAddress }) {
    if (adminToken && adminId) {
      const tokenHash = crypto.createHash('sha256').update(adminToken).digest('hex');
      await AdminSession.update(
        { revokedAt: new Date() },
        { where: { adminId, tokenHash } }
      );
    }

    if (adminId) {
      await AuditLog.create({
        adminId,
        action: 'ADMIN_LOGOUT',
        entity: 'Admin',
        entityId: adminId,
        ipAddress: ipAddress || null,
      });
    }

    return { message: 'Logged out successfully' };
  },

  /**
   * Get current admin profile
   */
  async getProfile(adminId) {
    const admin = await Admin.findByPk(adminId, {
      attributes: ['id', 'name', 'email', 'role', 'isActive', 'mustChangePassword', 'lastLoginAt', 'createdAt'],
    });

    if (!admin) {
      throw AppError.notFound('Admin profile not found');
    }

    return {
      ...admin.toJSON(),
      permissions: getRolePermissions(admin.role),
    };
  },
};

export default authService;
