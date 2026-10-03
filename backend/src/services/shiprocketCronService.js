import logger from '../config/logger.js';
import { shiprocketService } from './shiprocketService.js';
import { Order, Shipment } from '../models/index.js';
import { Op } from 'sequelize';

class ShiprocketCronService {
  constructor() {
    this.intervalHandle = null;
    this.initialRunTimeout = null;
    this.isRunning = false;
    this.lastRunStats = null;
  }

  /**
   * Sync all active (in-transit/unshipped/undelivered) shipments from Shiprocket live API
   */
  async syncAllActiveShipments() {
    if (this.isRunning) {
      logger.info('Shiprocket Cron Sync is already in progress, skipping overlapping run.');
      return { skipped: true, reason: 'Already in progress' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    logger.info('🔄 [Shiprocket Cron] Starting periodic sync of active orders...');

    const stats = {
      totalFound: 0,
      synced: 0,
      statusChanged: 0,
      errors: 0,
      startedAt: new Date().toISOString(),
      durationMs: 0,
    };

    try {
      // Find orders that have an AWB code and are not yet in terminal state (DELIVERED, CANCELLED, RETURNED)
      const activeOrders = await Order.findAll({
        where: {
          awbCode: {
            [Op.ne]: null,
            [Op.not]: '',
          },
          status: {
            [Op.notIn]: ['DELIVERED', 'CANCELLED', 'RETURNED'],
          },
        },
        include: [{ model: Shipment, as: 'shipment' }],
        order: [['updatedAt', 'ASC']], // Oldest updated first
        limit: 100, // Safe batch limit per cycle
      });

      stats.totalFound = activeOrders.length;

      if (activeOrders.length === 0) {
        logger.info('✅ [Shiprocket Cron] No active pending shipments found to sync.');
        this.isRunning = false;
        stats.durationMs = Date.now() - startTime;
        this.lastRunStats = stats;
        return stats;
      }

      logger.info(`📦 [Shiprocket Cron] Found ${activeOrders.length} active shipment(s) to sync.`);

      for (const order of activeOrders) {
        try {
          const oldStatus = order.status;
          const syncResult = await shiprocketService.syncOrderTracking(order);

          if (syncResult.success) {
            stats.synced += 1;
            if (syncResult.mappedStatus && syncResult.mappedStatus !== oldStatus) {
              stats.statusChanged += 1;
              logger.info(
                `🚚 [Shiprocket Cron] Order #${order.orderNumber} status changed: ${oldStatus} ➔ ${syncResult.mappedStatus}`
              );
            }
          } else {
            stats.errors += 1;
            logger.warn(`⚠️ [Shiprocket Cron] Order #${order.orderNumber} sync note: ${syncResult.message}`);
          }

          // Gentle rate-limit pause between queries (300ms)
          await new Promise((r) => setTimeout(r, 300));
        } catch (itemErr) {
          stats.errors += 1;
          logger.error(`❌ [Shiprocket Cron] Failed to sync order #${order?.orderNumber}: ${itemErr.message}`);
        }
      }

      stats.durationMs = Date.now() - startTime;
      stats.finishedAt = new Date().toISOString();
      this.lastRunStats = stats;

      logger.info(
        `✅ [Shiprocket Cron] Completed batch sync: ${stats.synced}/${stats.totalFound} synced, ${stats.statusChanged} updated, ${stats.errors} errors in ${stats.durationMs}ms`
      );

      return stats;
    } catch (err) {
      logger.error(`💥 [Shiprocket Cron] Critical error during sync: ${err.message}`, { stack: err.stack });
      stats.error = err.message;
      return stats;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start periodic timer / cron schedule
   * @param {number} [intervalMinutes] - Interval in minutes (defaults to env or 15 mins)
   */
  startCronJob(intervalMinutes) {
    if (this.intervalHandle) {
      logger.info('[Shiprocket Cron] Cron runner is already active.');
      return;
    }

    const minutes =
      intervalMinutes ||
      parseInt(process.env.SHIPROCKET_SYNC_CRON_MINUTES || '15', 10) ||
      15;
    const intervalMs = Math.max(minutes, 1) * 60 * 1000;

    logger.info(`⏰ [Shiprocket Cron] Starting periodic tracking sync scheduler (Every ${minutes} minute(s))`);

    // Initial background run 30 seconds after server starts
    this.initialRunTimeout = setTimeout(() => {
      this.initialRunTimeout = null;
      this.syncAllActiveShipments().catch((e) => {
        logger.warn(`[Shiprocket Cron] Initial run notice: ${e.message}`);
      });
    }, 30000);

    this.intervalHandle = setInterval(() => {
      this.syncAllActiveShipments().catch((e) => {
        logger.warn(`[Shiprocket Cron] Periodic run notice: ${e.message}`);
      });
    }, intervalMs);
  }

  /**
   * Stop background scheduler
   */
  stopCronJob() {
    if (this.initialRunTimeout) {
      clearTimeout(this.initialRunTimeout);
      this.initialRunTimeout = null;
    }
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('[Shiprocket Cron] Background sync scheduler stopped.');
    }
  }

  /**
   * Get status of the cron scheduler
   */
  getStatus() {
    return {
      active: Boolean(this.intervalHandle),
      isRunning: this.isRunning,
      intervalMinutes: parseInt(process.env.SHIPROCKET_SYNC_CRON_MINUTES || '15', 10) || 15,
      lastRunStats: this.lastRunStats,
    };
  }
}

export const shiprocketCronService = new ShiprocketCronService();
export default shiprocketCronService;
