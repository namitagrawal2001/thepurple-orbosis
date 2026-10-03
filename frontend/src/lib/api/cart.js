import { getStoredCustomerToken } from '@/lib/auth/session';

const CART_SESSION_KEY = 'thepurple_cart_session_id';
import { API_BASE_URL } from '@/lib/api/url';

const API_URL = API_BASE_URL;

export const getCartSessionId = () => {
  if (typeof window === 'undefined') return 'guest_session_init';
  try {
    let sid = localStorage.getItem(CART_SESSION_KEY);
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem(CART_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'session_fallback';
  }
};

export const getCartHeaders = () => {
  const token = getStoredCustomerToken();
  const sessionId = getCartSessionId();

  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return { headers, token, sessionId };
};

export const cartApi = {
  getCart: async () => {
    const { headers, sessionId } = getCartHeaders();
    const res = await fetch(`${API_URL}/cart?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to fetch cart');
    return json.data;
  },

  addItem: async ({ productId, quantity = 1, priceSnapshot }) => {
    const { headers, sessionId } = getCartHeaders();
    const res = await fetch(`${API_URL}/cart/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId,
        quantity,
        priceSnapshot,
        sessionId,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to add item to cart');
    return json.data;
  },

  updateItem: async (id, quantity) => {
    const { headers, sessionId } = getCartHeaders();
    const res = await fetch(`${API_URL}/cart/items/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        quantity,
        sessionId,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to update item quantity');
    return json.data;
  },

  removeItem: async (id) => {
    const { headers, sessionId } = getCartHeaders();
    const res = await fetch(`${API_URL}/cart/items/${id}?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to remove item from cart');
    return json.data;
  },

  clearCart: async (itemIds = []) => {
    const { headers, sessionId } = getCartHeaders();
    const res = await fetch(`${API_URL}/cart/clear`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemIds,
        sessionId,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to clear cart');
    return json.data;
  },

  applyCoupon: async (code, subtotal) => {
    const { headers } = getCartHeaders();
    const res = await fetch(`${API_URL}/cart/apply-coupon`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, subtotal }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to apply coupon');
    return json.data;
  },

  getAvailableCoupons: async () => {
    const { headers } = getCartHeaders();
    const res = await fetch(`${API_URL}/cart/available-coupons`, {
      method: 'GET',
      headers,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to fetch coupons');
    return json.data?.coupons || [];
  },

  mergeCart: async (guestSessionId) => {
    const { headers, sessionId } = getCartHeaders();
    const sidToMerge = guestSessionId || sessionId;
    const res = await fetch(`${API_URL}/cart/merge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        guestSessionId: sidToMerge,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to merge cart');
    return json.data;
  },
};
