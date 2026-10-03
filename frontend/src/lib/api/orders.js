/**
 * Orders & Checkout API Client
 */

import { API_BASE_URL } from '@/lib/api/url';

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token =
      localStorage.getItem('thepurple_customer_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('customerToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let sessionId = localStorage.getItem('thepurple_guest_session_id');
    if (sessionId) {
      headers['x-session-id'] = sessionId;
      headers['x-guest-id'] = sessionId;
    }
  }
  return headers;
}

function getAdminAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token =
      localStorage.getItem('thepurple_admin_token') ||
      localStorage.getItem('adminToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const orderApi = {
  /**
   * 1. Calculate Shipping Rate via Shiprocket
   */
  async calculateShipping({ pincode, subtotal }) {
    const res = await fetch(`${API_BASE_URL}/orders/calculate-shipping`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pincode, subtotal }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to calculate shipping');
    return json.data;
  },

  /**
   * 2. Create Payment Intent (Razorpay Order)
   */
  async createPaymentIntent({ items, customerDetails, couponCode }) {
    const res = await fetch(`${API_BASE_URL}/orders/create-payment-intent`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ items, customerDetails, couponCode }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to initialize payment');
    return json.data;
  },

  /**
   * 3. Verify Payment & Create Order
   */
  async verifyPayment(paymentPayload) {
    const res = await fetch(`${API_BASE_URL}/orders/verify-payment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(paymentPayload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Payment verification failed');
    return json.data;
  },

  /**
   * 4. Get Customer My Orders
   */
  async getMyOrders(params = {}) {
    const searchParams = new URLSearchParams();
    if (typeof window !== 'undefined') {
      const email = localStorage.getItem('thepurple_customer_email');
      const mobile = localStorage.getItem('thepurple_customer_mobile');
      const recentOrders = localStorage.getItem('thepurple_recent_orders');
      if (email && !params.email) searchParams.append('email', email);
      if (mobile && !params.mobile) searchParams.append('mobile', mobile);
      if (recentOrders && !params.orderIds) searchParams.append('orderIds', recentOrders);
    }
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') searchParams.append(k, v);
    });
    const qs = searchParams.toString();
    const url = `${API_BASE_URL}/orders/my-orders${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to fetch orders');
    return json.data || [];
  },

  /**
   * 5. Get Order Details
   */
  async getOrderDetails(id) {
    const res = await fetch(`${API_BASE_URL}/orders/${id}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Order not found');
    return json.data;
  },

  /**
   * 6. Cancel Order
   */
  async cancelOrder(id, reason) {
    const res = await fetch(`${API_BASE_URL}/orders/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to cancel order');
    return json.data;
  },

  /**
   * 7. Request Refund
   */
  async requestRefund(id, reason) {
    const res = await fetch(`${API_BASE_URL}/orders/${id}/request-refund`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to request refund');
    return json.data;
  },

  /**
   * 8. Public Track Order
   */
  async trackOrder({ orderNumber, phone }) {
    const params = new URLSearchParams({ orderNumber });
    if (phone) params.append('phone', phone);

    const res = await fetch(`${API_BASE_URL}/orders/track?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to track order');
    return json.data;
  },

  /**
   * 9. Sync Shiprocket Status for Single Order (Customer)
   */
  async syncShiprocketStatus(id) {
    const res = await fetch(`${API_BASE_URL}/orders/${id}/sync-shiprocket`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to sync Shiprocket status');
    return json.data;
  },

  // ─── ADMIN ENDPOINTS ────────────────────────────────────────────────

  /**
   * Admin: List Orders
   */
  async adminGetOrders(queryParams = {}) {
    const params = new URLSearchParams(queryParams);
    const res = await fetch(`${API_BASE_URL}/admin/orders?${params.toString()}`, {
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to fetch admin orders');
    return json.data;
  },

  /**
   * Admin: Get Order Details
   */
  async adminGetOrderDetails(id) {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${id}`, {
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Order details not found');
    return json.data;
  },

  /**
   * Admin: Update Order Status
   */
  async adminUpdateStatus(id, { status, notes }) {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${id}/status`, {
      method: 'PATCH',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ status, notes }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to update order status');
    return json.data;
  },

  /**
   * Admin: Generate Shiprocket Label & AWB
   */
  async adminGenerateLabel(id) {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${id}/generate-label`, {
      method: 'POST',
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to generate shipping label');
    return json.data;
  },

  /**
   * Admin: Sync Live Status from Shiprocket API for single order
   */
  async adminSyncShiprocket(id) {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${id}/sync-shiprocket`, {
      method: 'POST',
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to sync with Shiprocket');
    return json.data;
  },

  /**
   * Admin: Batch Sync All Active Shipments with Shiprocket
   */
  async adminSyncAllActiveShiprocket() {
    const res = await fetch(`${API_BASE_URL}/admin/orders/sync-active`, {
      method: 'POST',
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to batch sync with Shiprocket');
    return json;
  },

  /**
   * Admin: Process Refund
   */
  async adminProcessRefund(id, { refundStatus, refundAmount, notes }) {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${id}/process-refund`, {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ refundStatus, refundAmount, notes }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to process refund');
    return json.data;
  },

  /**
   * Admin: Get Order Statistics
   */
  async adminGetStats() {
    const res = await fetch(`${API_BASE_URL}/admin/orders/stats`, {
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to fetch stats');
    return json.data;
  },
};

export default orderApi;
