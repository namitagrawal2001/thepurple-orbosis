import nodemailer from 'nodemailer';
import env from '../config/env.js';
import logger from '../config/logger.js';

let transporter = null;

function getMailTransporter() {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT !== 465,
      auth: {
        user: env.SMTP_USER.trim(),
        pass: env.SMTP_PASSWORD.replace(/\s+/g, ''),
      },
    });
    logger.info(`Configured SMTP transporter with host: ${env.SMTP_HOST}`);
  } else {
    if (env.isProduction) {
      throw new Error('SMTP credentials are required in production.');
    }
    logger.info('SMTP credentials are not configured; outgoing mail is disabled.');
  }

  return transporter;
}

export const mailService = {
  /**
   * Send Password Reset Link to Admin
   */
  async sendPasswordResetEmail({ toEmail, resetUrl, adminName }) {
    const subject = 'Reset Your Password — ThePurple Admin Panel';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E9D5FF; border-radius: 12px; background-color: #FAF5FF;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6B21A8; margin: 0; font-size: 24px; letter-spacing: -0.5px;">ThePurple</h1>
          <p style="color: #581C87; margin: 4px 0 0; font-size: 13px; font-weight: bold; text-transform: uppercase;">Admin Portal</p>
        </div>
        <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #E9D5FF;">
          <h2 style="color: #2E1065; font-size: 18px; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #374151; line-height: 1.5;">Hello ${adminName || 'Admin'},</p>
          <p style="color: #374151; line-height: 1.5;">We received a request to reset your password for your ThePurple Admin account. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #7E22CE; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #6B7280; font-size: 13px; line-height: 1.4;">This link will expire in <strong>1 hour</strong>. If you did not request this, please ignore this email.</p>
          <p style="color: #9CA3AF; font-size: 12px; word-break: break-all; margin-top: 20px;">Or copy and paste this link in your browser: <br/>${resetUrl}</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #9CA3AF; font-size: 12px;">
          &copy; ${new Date().getFullYear()} ThePurple. All rights reserved.
        </div>
      </div>
    `;

    const transport = getMailTransporter();
    if (transport) {
      try {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: toEmail,
          subject,
          html,
        });
        logger.info(`Password reset email sent to ${toEmail}`);
      } catch (err) {
        logger.error(`Failed to send password reset email via SMTP (${err.code || 'unknown error'}).`);
        if (env.isProduction) throw new Error('Password reset email could not be sent.');
      }
    } else {
      logger.info(`[MAIL DISABLED] Password reset email not sent to ${toEmail}.`);
    }

    return { sent: Boolean(transport) };
  },

  /**
   * Send Welcome Email with Temporary Password
   */
  async sendWelcomeAdminEmail({ toEmail, adminName, role, temporaryPassword, loginUrl }) {
    const subject = 'Welcome to ThePurple Admin Panel — Account Credentials';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E9D5FF; border-radius: 12px; background-color: #FAF5FF;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6B21A8; margin: 0; font-size: 24px; letter-spacing: -0.5px;">ThePurple</h1>
          <p style="color: #581C87; margin: 4px 0 0; font-size: 13px; font-weight: bold; text-transform: uppercase;">Admin Portal</p>
        </div>
        <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #E9D5FF;">
          <h2 style="color: #2E1065; font-size: 18px; margin-top: 0;">Welcome, ${adminName}!</h2>
          <p style="color: #374151; line-height: 1.5;">An administrative account has been created for you on <strong>ThePurple Admin Panel</strong> with the role of <strong>${role}</strong>.</p>
          
          <div style="background-color: #FAF5FF; border-left: 4px solid #7E22CE; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; color: #2E1065;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin: 0; color: #2E1065;"><strong>Temporary Password:</strong> <code style="background-color: #E9D5FF; padding: 2px 6px; border-radius: 4px; font-size: 15px; font-weight: bold;">${temporaryPassword}</code></p>
          </div>

          <p style="color: #DC2626; font-size: 14px; font-weight: bold;">Important: You will be required to change your temporary password upon your first login.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #7E22CE; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Log in to Admin Panel</a>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #9CA3AF; font-size: 12px;">
          &copy; ${new Date().getFullYear()} ThePurple. All rights reserved.
        </div>
      </div>
    `;

    const transport = getMailTransporter();
    if (transport) {
      try {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: toEmail,
          subject,
          html,
        });
        logger.info(`Welcome email sent to ${toEmail}`);
      } catch (err) {
        logger.error(`Failed to send welcome email via SMTP (${err.code || 'unknown error'}).`);
        if (env.isProduction) throw new Error('Admin welcome email could not be sent.');
      }
    } else {
      logger.info(`[MAIL DISABLED] Admin welcome email not sent to ${toEmail} (${role}).`);
    }

    return { sent: true };
  },

  /**
   * Send Reply Email to User for Contact Query
   */
  async sendContactQueryReplyEmail({
    toEmail,
    recipientName,
    subject: originalSubject,
    originalMessage,
    replyMessage,
    adminName = 'ThePurple Concierge Team',
    queryId,
  }) {
    const emailSubject = `Response to your inquiry: ${originalSubject || 'ThePurple Support'}`;
    const formattedReply = (replyMessage || '')
      .replace(/\n/g, '<br/>');
    const formattedOriginal = (originalMessage || '')
      .replace(/\n/g, '<br/>');

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px 20px; background-color: #FAF5FF; border: 1px solid #E9D5FF; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #6B21A8 0%, #9333EA 100%); color: #ffffff; font-weight: 800; font-size: 20px; border-radius: 12px; margin-bottom: 8px;">
            TP
          </div>
          <h1 style="color: #4C1D95; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">ThePurple</h1>
          <p style="color: #7E22CE; margin: 2px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Customer Concierge Support</p>
        </div>

        <div style="background-color: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #E9D5FF; box-shadow: 0 4px 12px rgba(109, 40, 217, 0.04);">
          <h2 style="color: #1E1B4B; font-size: 19px; margin-top: 0; font-weight: 700;">Hello ${recipientName || 'Valued Customer'},</h2>
          
          <p style="color: #374151; font-size: 14.5px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for reaching out to us. Our concierge team has reviewed your query regarding <strong>"${originalSubject || 'General Inquiry'}"</strong>.
          </p>

          <div style="background: linear-gradient(180deg, #FAF5FF 0%, #F3E8FF 100%); border-left: 4px solid #7E22CE; padding: 18px 20px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #6B21A8;">
              Official Response from ${adminName}
            </p>
            <div style="color: #1F2937; font-size: 14.5px; line-height: 1.7; font-weight: 500;">
              ${formattedReply}
            </div>
          </div>

          <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 8px; margin-top: 24px;">
            <p style="margin: 0 0 6px 0; font-size: 11.5px; font-weight: 700; color: #64748B; text-transform: uppercase;">
              Your Original Message:
            </p>
            <p style="margin: 0; font-size: 13.5px; color: #475569; font-style: italic; line-height: 1.5;">
              "${formattedOriginal}"
            </p>
          </div>

          <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #F3E8FF; font-size: 13.5px; color: #6B7280; line-height: 1.5;">
            <p style="margin: 0 0 6px 0;">If you have any further questions or need additional assistance, please feel free to reply to this email or visit our website.</p>
            <p style="margin: 0; color: #4C1D95; font-weight: 700;">Warm regards,<br/>ThePurple Team</p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px; color: #9CA3AF; font-size: 12px; line-height: 1.4;">
          ${queryId ? `<p style="margin: 0 0 4px;">Ticket Ref: <code>${queryId}</code></p>` : ''}
          &copy; ${new Date().getFullYear()} ThePurple Luxury Jewellery &amp; Gifts. All rights reserved.
        </div>
      </div>
    `;

    const transport = getMailTransporter();
    if (transport) {
      try {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: toEmail,
          subject: emailSubject,
          html,
        });
        logger.info(`Contact query reply email sent successfully to ${toEmail}`);
      } catch (err) {
        logger.error(`Failed to send contact query reply email via SMTP (${err.code || 'unknown error'}).`);
        if (env.isProduction) throw new Error('Contact reply email could not be sent.');
      }
    } else {
      logger.info(`[MAIL DISABLED] Contact reply email not sent to ${toEmail}.`);
    }

    return { sent: true };
  },

  /**
   * Send Confirmation Email to User when they submit a Contact Query
   */
  async sendContactQueryReceivedEmail({ toEmail, recipientName, subject: querySubject, queryId }) {
    const emailSubject = `We've received your query: ${querySubject || 'ThePurple Support'}`;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #FAF5FF; border: 1px solid #E9D5FF; border-radius: 14px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #6B21A8; margin: 0; font-size: 24px; font-weight: 800;">ThePurple</h1>
          <p style="color: #7E22CE; margin: 2px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase;">Inquiry Confirmation</p>
        </div>
        <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #E9D5FF;">
          <h2 style="color: #1E1B4B; font-size: 18px; margin-top: 0;">Thank You, ${recipientName || 'Valued Customer'}!</h2>
          <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            We have received your message regarding <strong>"${querySubject || 'General Inquiry'}"</strong>.
          </p>
          <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            Our support concierge usually responds within <strong>24 hours</strong>. We will get back to you directly at this email address.
          </p>
          ${queryId ? `<div style="background-color: #FAF5FF; padding: 12px; border-radius: 6px; font-size: 13px; color: #6B21A8; font-weight: 600; text-align: center; margin: 20px 0;">Reference ID: ${queryId}</div>` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px; color: #9CA3AF; font-size: 12px;">
          &copy; ${new Date().getFullYear()} ThePurple. All rights reserved.
        </div>
      </div>
    `;

    const transport = getMailTransporter();
    if (transport) {
      try {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: toEmail,
          subject: emailSubject,
          html,
        });
        logger.info(`Contact received confirmation sent to ${toEmail}`);
      } catch (err) {
        logger.error(`Failed to send contact confirmation email via SMTP (${err.code || 'unknown error'}).`);
        if (env.isProduction) throw new Error('Contact confirmation email could not be sent.');
      }
    } else {
      logger.info(`[MAIL DISABLED] Contact confirmation email not sent to ${toEmail}.`);
    }

    return { sent: true };
  },
};

export default mailService;
