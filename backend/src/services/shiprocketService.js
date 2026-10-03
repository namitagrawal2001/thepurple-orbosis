/**
 * Shiprocket API Integration Service
 * Manages Authentication, Dynamic Rates, Adhoc Order creation, AWB generation, and Tracking.
 */

class ShiprocketService {
  constructor() {
    this.baseUrl = 'https://apiv2.shiprocket.in/v1/external';
    this.email = process.env.SHIPROCKET_EMAIL;
    this.password = process.env.SHIPROCKET_PASSWORD;
    this.token = null;
    this.tokenExpiry = null;
    this.primaryPickupPincode = '140301';
    this.primaryPickupLocation = 'warehouse-1';
  }

  /**
   * Authenticate and get Shiprocket JWT token (caches for 9 days)
   */
  async getAuthToken() {
    try {
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.token;
      }

      if (!this.email || !this.password) {
        console.warn('Shiprocket credentials are not configured.');
        return null;
      }

      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password }),
      });

      const data = await response.json();

      if (!response.ok || !data.token) {
        console.warn('Shiprocket Auth Warning:', data.message || 'Could not authenticate');
        return null;
      }

      this.token = data.token;
      this.tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000;

      // Also refresh Primary Pickup Location from Shiprocket
      await this.fetchPrimaryPickupLocation();

      return this.token;
    } catch (error) {
      console.error('Shiprocket Auth Error:', error.message);
      return null;
    }
  }

  /**
   * Fetch configured warehouse pickup location from Shiprocket
   */
  async fetchPrimaryPickupLocation() {
    try {
      if (!this.token) return;
      const res = await fetch(`${this.baseUrl}/settings/company/pickup`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });
      const data = await res.json();
      const addresses = data?.data?.shipping_address || [];
      if (addresses.length > 0) {
        const primary = addresses.find((a) => a.is_primary_location == 1) || addresses[0];
        if (primary) {
          this.primaryPickupPincode = String(primary.pin_code || '140301');
          this.primaryPickupLocation = String(primary.pickup_location || 'warehouse-1');
        }
      }
    } catch (err) {
      console.warn('Could not load Shiprocket pickup locations:', err.message);
    }
  }

  /**
   * Helper for authenticated Shiprocket requests
   */
  async request(endpoint, options = {}) {
    const token = await this.getAuthToken();
    if (!token) {
      return { success: false, error: 'Shiprocket authentication failed' };
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const json = await res.json();
      return { success: res.ok, data: json, status: res.status };
    } catch (err) {
      console.error(`Shiprocket Request Error [${endpoint}]:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check Pincode Serviceability and calculate real-time cheapest courier rate from Shiprocket
   * @param {Object} params
   * @param {string} params.deliveryPincode
   * @param {number} [params.weight=0.35] - in KG
   * @param {number} [params.cod=0] - 0 for prepaid, 1 for COD
   */
  async checkServiceability({ deliveryPincode, weight = 0.35, cod = 0 }) {
    try {
      const cleanDeliveryPin = String(deliveryPincode || '').trim();
      if (!cleanDeliveryPin || cleanDeliveryPin.length !== 6) {
        return { serviceable: false, message: 'Invalid 6-digit Pincode' };
      }

      // Ensure we have active token and pickup location
      await this.getAuthToken();
      const pickupPin = this.primaryPickupPincode || '140301';

      const res = await this.request(
        `/courier/serviceability?pickup_postcode=${pickupPin}&delivery_postcode=${cleanDeliveryPin}&weight=${weight}&cod=${cod}`,
        { method: 'GET' }
      );

      if (res.success && res.data?.data?.available_courier_companies?.length > 0) {
        const couriers = res.data.data.available_courier_companies;

        // Sort by cheapest courier rate
        couriers.sort((a, b) => parseFloat(a.rate || 999) - parseFloat(b.rate || 999));
        const cheapest = couriers[0];

        const rateInRupees = Math.ceil(parseFloat(cheapest.rate || 89));
        const estimatedDeliveryDays = cheapest.estimated_delivery_days
          ? `${cheapest.estimated_delivery_days} Days`
          : cheapest.etd || '3 - 5 Days';

        return {
          serviceable: true,
          courierName: cheapest.courier_name || 'Shiprocket Express',
          courierCompanyId: cheapest.courier_company_id,
          estimatedDays: estimatedDeliveryDays,
          rate: rateInRupees,
          availableCouriersCount: couriers.length,
          allCouriers: couriers.slice(0, 3).map((c) => ({
            name: c.courier_name,
            rate: Math.ceil(parseFloat(c.rate || 89)),
            etd: c.estimated_delivery_days ? `${c.estimated_delivery_days} Days` : c.etd,
          })),
        };
      }

      // If specific pincode has no courier or returned error
      if (res.data?.message) {
        console.warn(`Shiprocket Serviceability check for ${cleanDeliveryPin}:`, res.data.message);
      }

      return {
        serviceable: true,
        courierName: 'Standard Express',
        estimatedDays: '3 - 5 Days',
        rate: 89,
      };
    } catch (err) {
      console.error('Shiprocket Serviceability exception:', err);
      return {
        serviceable: true,
        courierName: 'Standard Express',
        estimatedDays: '3 - 5 Days',
        rate: 89,
      };
    }
  }

  /**
   * Create an adhoc order in Shiprocket
   * @param {Object} order - Local Order model instance
   * @param {Array} orderItems - Array of OrderItem instances
   */
  async createOrder(order, orderItems = []) {
    try {
      await this.getAuthToken();
      const pickupLocation = this.primaryPickupLocation || 'warehouse-1';

      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Format order items for Shiprocket
      const items = orderItems.map((item, idx) => ({
        name: (item.productName || 'Jewellery Item').substring(0, 100),
        sku: (item.sku || `TP-SKU-${idx + 1}`).substring(0, 50),
        units: item.quantity || 1,
        selling_price: parseFloat(item.price || 0),
        discount: 0,
        tax: 0,
        hsn: 7113, // Fashion/Imitation Jewellery HSN
      }));

      // Split name into first and last
      const nameParts = (order.customerName || 'Customer').trim().split(' ');
      const firstName = nameParts[0] || 'Customer';
      const lastName = nameParts.slice(1).join(' ') || 'Customer';

      const payload = {
        order_id: order.orderNumber,
        order_date: formattedDate,
        pickup_location: pickupLocation,
        channel_id: '',
        comment: `ThePurple Online Order #${order.orderNumber}`,
        billing_customer_name: firstName,
        billing_last_name: lastName,
        billing_address: (order.shippingAddress || '').substring(0, 190),
        billing_address_2: '',
        billing_city: order.city || 'City',
        billing_pincode: String(order.pincode || '110001'),
        billing_state: order.state || 'State',
        billing_country: 'India',
        billing_email: order.customerEmail || 'customer@thepurple.online',
        billing_phone: order.customerMobile || '9999999999',
        shipping_is_billing: true,
        order_items: items,
        payment_method: 'Prepaid',
        shipping_charges: parseFloat(order.shippingAmount || 0),
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: parseFloat(order.discountAmount || 0),
        sub_total: parseFloat(order.subtotalAmount || 0),
        length: 10,
        breadth: 10,
        height: 8,
        weight: 0.35, // 350g typical packet
      };

      const res = await this.request('/orders/create/adhoc', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data?.order_id) {
        return {
          success: true,
          shiprocketOrderId: String(res.data.order_id),
          shiprocketShipmentId: String(res.data.shipment_id || ''),
          awbCode: res.data.awb_code || null,
          courierName: res.data.courier_name || null,
          status: res.data.status || 'ORDER_CREATED',
        };
      }

      console.warn('Shiprocket Create Order API response:', res.data);
      return {
        success: false,
        message: res.data?.message || 'Shiprocket order creation returned an issue',
        data: res.data,
      };
    } catch (err) {
      console.error('Shiprocket Create Order Exception:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Cancel an order in Shiprocket
   * @param {string|number} shiprocketOrderId
   * @param {string} [awbCode]
   */
  async cancelOrder(shiprocketOrderId, awbCode = null) {
    try {
      if (!shiprocketOrderId && !awbCode) {
        return { success: false, message: 'No Shiprocket order ID or AWB code provided for cancellation' };
      }

      const payload = {};
      if (shiprocketOrderId) {
        const parsedId = parseInt(shiprocketOrderId, 10);
        if (!isNaN(parsedId)) {
          payload.ids = [parsedId];
        }
      }
      if (awbCode) {
        payload.awbs = [String(awbCode)];
      }

      if (!payload.ids && !payload.awbs) {
        return { success: false, message: 'Invalid Shiprocket order ID or AWB for cancellation' };
      }

      const res = await this.request('/orders/cancel', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        success: res.success,
        data: res.data,
      };
    } catch (err) {
      console.error('Shiprocket Cancel Order Exception:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Generate AWB & Shipping Label in Shiprocket (assigns courier)
   * @param {string|number} shipmentId
   * @param {number} [courierCompanyId]
   */
  async generateLabel(shipmentId, courierCompanyId = null) {
    try {
      if (!shipmentId) return { success: false, message: 'No Shipment ID' };

      // 1. Assign AWB with optional courier company ID
      const awbPayload = { shipment_id: shipmentId };
      if (courierCompanyId) {
        awbPayload.courier_id = courierCompanyId;
      }

      const awbRes = await this.request('/courier/assign/awb', {
        method: 'POST',
        body: JSON.stringify(awbPayload),
      });

      // 2. Generate Label URL
      const labelRes = await this.request('/courier/generate/label', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      });

      return {
        success: true,
        awbCode: awbRes.data?.response?.data?.awb_code || null,
        courierName: awbRes.data?.response?.data?.courier_name || null,
        labelUrl: labelRes.data?.label_url || null,
      };
    } catch (err) {
      console.error('Shiprocket Generate Label Error:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Track Shipment by AWB code
   * @param {string} awbCode
   */
  async trackShipment(awbCode) {
    try {
      if (!awbCode) return { success: false, message: 'AWB code required' };

      const res = await this.request(`/courier/track/awb/${awbCode}`, {
        method: 'GET',
      });

      if (res.success && res.data?.tracking_data) {
        const track = res.data.tracking_data;
        return {
          success: true,
          currentStatus: track.shipment_status || 'IN_TRANSIT',
          trackUrl: track.track_url || null,
          activities: track.shipment_track_activities || [],
          expectedDate: track.expected_delivery_date || null,
        };
      }

      return {
        success: false,
        message: 'Tracking details not yet updated by courier',
      };
    } catch (err) {
      console.error('Shiprocket Tracking Error:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Map raw Shiprocket status string or status ID to local Order & Shipment statuses
   * @param {string|number} rawStatus
   * @param {number|string} [statusId]
   */
  mapShiprocketStatus(rawStatus, statusId = null) {
    const raw = String(rawStatus || '').toUpperCase().trim();
    const id = Number(statusId);

    let orderStatus = 'IN_TRANSIT';
    let shipmentStatus = 'IN_TRANSIT';

    if (id === 7 || raw.includes('DELIVERED') && !raw.includes('RTO')) {
      orderStatus = 'DELIVERED';
      shipmentStatus = 'DELIVERED';
    } else if (id === 17 || raw.includes('OUT FOR DELIVERY')) {
      orderStatus = 'IN_TRANSIT';
      shipmentStatus = 'OUT_FOR_DELIVERY';
    } else if (id === 18 || id === 19 || raw.includes('IN TRANSIT') || raw.includes('REACHED') || raw.includes('HUB') || raw.includes('DISPATCHED')) {
      orderStatus = 'IN_TRANSIT';
      shipmentStatus = 'IN_TRANSIT';
    } else if (id === 6 || id === 42 || raw.includes('PICKED UP') || raw.includes('HANDED OVER') || raw.includes('SHIPPED')) {
      orderStatus = 'SHIPROCKET_PICKUP';
      shipmentStatus = 'PICKED_UP';
    } else if (id === 3 || id === 52 || raw.includes('PICKUP SCHEDULED')) {
      orderStatus = 'SHIPROCKET_PICKUP';
      shipmentStatus = 'PICKUP_SCHEDULED';
    } else if (id === 1 || id === 2 || raw.includes('AWB ASSIGNED') || raw.includes('LABEL GENERATED')) {
      orderStatus = 'SHIPROCKET_PICKUP';
      shipmentStatus = 'AWB_ASSIGNED';
    } else if (id === 8 || raw.includes('CANCEL')) {
      orderStatus = 'CANCELLED';
      shipmentStatus = 'CANCELLED';
    } else if (id === 9 || id === 10 || id === 13 || raw.includes('RTO') || raw.includes('RETURN') || raw.includes('UNDELIVERED')) {
      orderStatus = 'RETURNED';
      shipmentStatus = id === 10 || raw.includes('RTO DELIVERED') ? 'RTO_DELIVERED' : 'RTO_INITIATED';
    }

    return { orderStatus, shipmentStatus, rawStatus: raw };
  }

  /**
   * Process incoming Shiprocket Webhook payload
   * Supports standard tracking update, scans timeline, status updates, and RTO events.
   * @param {Object} payload
   */
  async processTrackingWebhook(payload = {}) {
    try {
      if (!payload || typeof payload !== 'object') {
        return { success: false, message: 'Invalid payload received' };
      }

      // 1. Extract possible identifiers from various Shiprocket webhook schemas
      const awb = payload.awb || payload.awb_code || payload.tracking_data?.awb || payload.data?.awb;
      const orderNumber = payload.order_id || payload.channel_order_id || payload.order_no || payload.data?.order_id;
      const srOrderId = payload.sr_order_id || payload.shiprocket_order_id || payload.data?.sr_order_id;
      const srShipmentId = payload.shipment_id || payload.shiprocket_shipment_id || payload.data?.shipment_id;
      const courierName = payload.courier_name || payload.courier || payload.data?.courier_name;
      const etd = payload.etd || payload.expected_delivery_date || payload.data?.etd;
      const trackingUrl = payload.sr_tracking_url || payload.courier_tracking_url || (awb ? `https://shiprocket.co/tracking/${awb}` : null);

      // Extract raw status / activities
      const rawStatus = payload.current_status || payload.shipment_status || payload.status || payload.tracking_data?.shipment_status || payload.data?.current_status || 'IN_TRANSIT';
      const statusId = payload.current_status_id || payload.shipment_status_id || payload.status_id || payload.data?.current_status_id;
      const scans = payload.scans || payload.tracking_data?.shipment_track_activities || payload.activities || [];

      // Lazy import models to avoid circular reference
      const { Order, Shipment } = await import('../models/index.js');
      const { Op } = await import('sequelize');

      // 2. Locate order in DB
      const whereConditions = [];
      if (orderNumber) whereConditions.push({ orderNumber: String(orderNumber).trim() });
      if (awb) whereConditions.push({ awbCode: String(awb).trim() });
      if (srOrderId) whereConditions.push({ shiprocketOrderId: String(srOrderId).trim() });
      if (srShipmentId) whereConditions.push({ shiprocketShipmentId: String(srShipmentId).trim() });

      if (whereConditions.length === 0) {
        return { success: false, message: 'No identifying orderNumber, awb, or shiprocketOrderId found in webhook payload' };
      }

      const order = await Order.findOne({
        where: { [Op.or]: whereConditions },
        include: [{ model: Shipment, as: 'shipment' }],
      });

      if (!order) {
        return {
          success: false,
          message: `Order matching criteria not found in database (awb=${awb}, order=${orderNumber})`,
        };
      }

      // 3. Map status
      const { orderStatus, shipmentStatus } = this.mapShiprocketStatus(rawStatus, statusId);

      // 4. Update Order
      const updateData = {
        status: orderStatus,
      };
      if (awb && !order.awbCode) updateData.awbCode = String(awb);
      if (courierName && (!order.courierName || order.courierName === 'Shiprocket Express')) {
        updateData.courierName = courierName;
      }
      if (trackingUrl) updateData.trackingUrl = trackingUrl;
      if (srOrderId && !order.shiprocketOrderId) updateData.shiprocketOrderId = String(srOrderId);
      if (srShipmentId && !order.shiprocketShipmentId) updateData.shiprocketShipmentId = String(srShipmentId);

      await order.update(updateData);

      // 5. Update or Create Shipment record
      const trackingUpdateData = {
        currentStatus: rawStatus,
        statusId: statusId,
        courierName: courierName || order.courierName,
        awb: awb || order.awbCode,
        trackUrl: trackingUrl || order.trackingUrl,
        expectedDate: etd,
        activities: scans,
        receivedAt: new Date().toISOString(),
      };

      if (order.shipment) {
        await order.shipment.update({
          status: shipmentStatus,
          awbCode: awb || order.shipment.awbCode,
          courierName: courierName || order.shipment.courierName,
          trackingUrl: trackingUrl || order.shipment.trackingUrl,
          estimatedDeliveryDate: etd ? new Date(etd) : order.shipment.estimatedDeliveryDate,
          lastTrackingUpdate: trackingUpdateData,
        });
      } else {
        await Shipment.create({
          orderId: order.id,
          courierName: courierName || 'Shiprocket',
          shiprocketShipmentId: srShipmentId ? String(srShipmentId) : order.shiprocketShipmentId,
          shiprocketOrderId: srOrderId ? String(srOrderId) : order.shiprocketOrderId,
          awbCode: awb || order.awbCode,
          status: shipmentStatus,
          trackingUrl: trackingUrl,
          estimatedDeliveryDate: etd ? new Date(etd) : null,
          lastTrackingUpdate: trackingUpdateData,
        });
      }

      return {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        newStatus: orderStatus,
        shipmentStatus: shipmentStatus,
        rawStatus: rawStatus,
      };
    } catch (error) {
      console.error('Shiprocket Webhook Processing Exception:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Sync tracking status for a single order by querying Shiprocket live API
   * @param {Object|string} orderOrId
   */
  async syncOrderTracking(orderOrId) {
    try {
      const { Order, Shipment } = await import('../models/index.js');
      const { Op } = await import('sequelize');

      let order = typeof orderOrId === 'object' && orderOrId?.id ? orderOrId : null;
      if (!order) {
        order = await Order.findOne({
          where: {
            [Op.or]: [
              { id: String(orderOrId) },
              { orderNumber: String(orderOrId) },
            ],
          },
          include: [{ model: Shipment, as: 'shipment' }],
        });
      } else if (!order.shipment) {
        order = await Order.findByPk(order.id, {
          include: [{ model: Shipment, as: 'shipment' }],
        });
      }

      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      if (!order.awbCode) {
        return { success: false, message: 'Order has no AWB assigned yet. Please generate label first.' };
      }

      const trackInfo = await this.trackShipment(order.awbCode);
      if (!trackInfo.success || !trackInfo.currentStatus) {
        return {
          success: false,
          message: trackInfo.message || 'Tracking details not yet updated by courier',
          liveTracking: null,
        };
      }

      const { orderStatus, shipmentStatus } = this.mapShiprocketStatus(trackInfo.currentStatus);

      await order.update({
        status: orderStatus,
        trackingUrl: trackInfo.trackUrl || order.trackingUrl,
      });

      const trackingPayload = {
        currentStatus: trackInfo.currentStatus,
        trackUrl: trackInfo.trackUrl || order.trackingUrl,
        expectedDate: trackInfo.expectedDate,
        activities: trackInfo.activities || [],
        syncedAt: new Date().toISOString(),
      };

      if (order.shipment) {
        await order.shipment.update({
          status: shipmentStatus,
          trackingUrl: trackInfo.trackUrl || order.shipment.trackingUrl,
          estimatedDeliveryDate: trackInfo.expectedDate ? new Date(trackInfo.expectedDate) : order.shipment.estimatedDeliveryDate,
          lastTrackingUpdate: trackingPayload,
        });
      } else {
        await Shipment.create({
          orderId: order.id,
          courierName: order.courierName || 'Shiprocket',
          shiprocketShipmentId: order.shiprocketShipmentId,
          shiprocketOrderId: order.shiprocketOrderId,
          awbCode: order.awbCode,
          status: shipmentStatus,
          trackingUrl: trackInfo.trackUrl || order.trackingUrl,
          estimatedDeliveryDate: trackInfo.expectedDate ? new Date(trackInfo.expectedDate) : null,
          lastTrackingUpdate: trackingPayload,
        });
      }

      return {
        success: true,
        order,
        liveTracking: trackInfo,
        mappedStatus: orderStatus,
        shipmentStatus: shipmentStatus,
      };
    } catch (err) {
      console.error('Shiprocket Single Order Sync Error:', err);
      return { success: false, message: err.message };
    }
  }
}

export const shiprocketService = new ShiprocketService();
export default shiprocketService;
