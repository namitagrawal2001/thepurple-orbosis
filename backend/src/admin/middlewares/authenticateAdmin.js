import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Admin, AdminSession } from '../../models/index.js';
import env from '../../config/env.js';
import AppError from '../../utils/customError.js';
import asyncHandler from '../../utils/asyncHandler.js';

const passwordChangeAllowedRoutes = new Set([
  'GET /auth/me',
  'POST /auth/change-password',
  'POST /auth/logout',
]);

export const authenticateAdmin = asyncHandler(async (req, res, next) => {
  let token = null;

  // Extract from Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return next(AppError.unauthorized('Authentication required. Please log in as administrator.'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (!decoded.id || decoded.type !== 'admin') {
      return next(AppError.unauthorized('Invalid administrator token'));
    }

    // Verify admin exists and is active
    const admin = await Admin.findByPk(decoded.id);
    if (!admin) {
      return next(AppError.unauthorized('Administrator account not found'));
    }

    if (!admin.isActive) {
      return next(AppError.forbidden('Administrator account has been disabled. Please contact Super Admin.'));
    }

    if (
      admin.mustChangePassword &&
      !passwordChangeAllowedRoutes.has(`${req.method} ${req.path}`)
    ) {
      return next(AppError.forbidden('You must change your password before using the admin API.'));
    }

    // Verify session has not been revoked
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await AdminSession.findOne({
      where: {
        adminId: admin.id,
        tokenHash,
      },
    });

    if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
      return next(AppError.unauthorized('Session has been invalidated. Please log in again.'));
    }

    // Attach admin and current token info to request
    req.admin = admin;
    req.adminSession = session;
    req.adminToken = token;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('Your admin session has expired. Please log in again.'));
    }
    return next(AppError.unauthorized('Invalid or corrupted authentication token'));
  }
});

export default authenticateAdmin;
