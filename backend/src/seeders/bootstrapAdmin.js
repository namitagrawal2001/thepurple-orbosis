import bcrypt from 'bcryptjs';
import { Admin } from '../models/index.js';
import { ADMIN_ROLES } from '../models/Admin.js';
import env from '../config/env.js';
import logger from '../config/logger.js';

/**
 * Bootstraps the initial Super Admin account.
 * Creates or updates the super admin with configured email & password.
 */
export async function bootstrapSuperAdmin() {
  try {
    const email = env.ADMIN_INITIAL_EMAIL.toLowerCase().trim();

    let superAdmin = await Admin.findOne({
      where: { email },
    });

    if (superAdmin) {
      if (
        !superAdmin.mustChangePassword &&
        (await bcrypt.compare('123456', superAdmin.passwordHash))
      ) {
        await superAdmin.update({ mustChangePassword: true });
        logger.warn(`Super Admin account (${superAdmin.email}) must change its legacy default password.`);
      } else {
        logger.info(`Existing Super Admin account preserved (${superAdmin.email}).`);
      }
      return superAdmin;
    }

    if (!env.ADMIN_INITIAL_PASSWORD) {
      const error = new Error(
        'ADMIN_INITIAL_PASSWORD is required to create the initial Super Admin account.'
      );
      error.code = 'ADMIN_INITIAL_PASSWORD_REQUIRED';
      throw error;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(env.ADMIN_INITIAL_PASSWORD, salt);

    superAdmin = await Admin.create({
      name: 'Super Admin',
      email,
      passwordHash,
      role: ADMIN_ROLES.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
      mustChangePassword: true,
    });

    logger.info(`Super Admin account successfully bootstrapped (${superAdmin.email}) with role [${ADMIN_ROLES.SUPER_ADMIN}]`);
    return superAdmin;
  } catch (error) {
    logger.error(`Error during Super Admin bootstrap: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

export default bootstrapSuperAdmin;
