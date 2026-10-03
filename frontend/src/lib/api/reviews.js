import { getStoredCustomerToken } from '@/lib/auth/session';

import { API_BASE_URL } from '@/lib/api/url';

function getAuthHeader() {
  if (typeof window === 'undefined') return {};
  const token =
    getStoredCustomerToken() ||
    localStorage.getItem('thepurple_customer_token') ||
    localStorage.getItem('thepurple_auth_token') ||
    localStorage.getItem('thepurple_user_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const reviewApi = {
  /**
   * Get reviews and rating statistics for a product
   */
  async getProductReviews(productIdOrSlug, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/reviews/product/${encodeURIComponent(productIdOrSlug)}${query ? `?${query}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Could not fetch reviews');
    }
    return json.data;
  },

  /**
   * Submit a new review and rating
   */
  async submitReview(data) {
    const res = await fetch(`${API_BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Could not submit review');
    }
    return json.data;
  },

  /**
   * Mark a review as helpful
   */
  async markHelpful(reviewId) {
    const res = await fetch(`${API_BASE_URL}/reviews/${reviewId}/helpful`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Could not vote on review');
    }
    return json.data;
  },
};

export default reviewApi;
