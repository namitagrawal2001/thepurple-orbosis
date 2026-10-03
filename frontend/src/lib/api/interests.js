/**
 * Frontend API client for Product Interests & Wishlist
 * Enforces Login requirement before adding/toggling interests
 */

import { API_BASE_URL } from '@/lib/api/url';

const API_URL = API_BASE_URL;
const STORAGE_KEY = 'thepurple_interested_products';

export const getStoredCustomerToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return (
      localStorage.getItem('thepurple_customer_token') ||
      sessionStorage.getItem('thepurple_customer_token') ||
      null
    );
  } catch {
    return null;
  }
};

export const isCustomerLoggedIn = () => {
  return Boolean(getStoredCustomerToken());
};

export const redirectToLogin = (router, returnUrl) => {
  if (typeof window === 'undefined') return;
  const currentPath = returnUrl || (window.location.pathname + window.location.search);
  const target = `/login?redirect=${encodeURIComponent(currentPath)}`;
  if (router && typeof router.push === 'function') {
    router.push(target);
  } else {
    window.location.href = target;
  }
};

export const getLocalInterests = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalInterest = (product) => {
  if (typeof window === 'undefined' || !product) return;
  try {
    const list = getLocalInterests();
    const prodId = product.id || product.productId;
    const existingIdx = list.findIndex((item) => String(item.productId) === String(prodId) || String(item.id) === String(prodId));

    const interestObj = {
      id: `local-${prodId}`,
      productId: prodId,
      createdAt: new Date().toISOString(),
      product: {
        id: product.id || prodId,
        name: product.name,
        slug: product.slug || product.id || prodId,
        price: product.price,
        originalPrice: product.originalPrice || null,
        discount: product.discount || 0,
        badge: product.badge,
        badgeColor: product.badgeColor || '#7E22CE',
        image:
          product.image ||
          product.imageUrl ||
          product.images?.[0]?.imageUrl ||
          product.images?.[0]?.url ||
          '/images/storefront/prod-gold-rope.jpg',
        category: product.category || product.subcategory?.category?.name || 'Fine Jewellery',
        sku: product.sku || 'TP-JW-001',
      },
    };

    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...interestObj };
    } else {
      list.unshift(interestObj);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('thepurple_interests_updated'));
  } catch (err) {
    console.warn('Could not save interest to local storage:', err);
  }
};

export const removeLocalInterest = (productIdOrId) => {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalInterests();
    const target = String(productIdOrId);
    const updated = list.filter(
      (item) =>
        String(item.id) !== target &&
        String(item.productId) !== target &&
        String(item.id) !== `local-${target}` &&
        String(item.product?.id) !== target
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('thepurple_interests_updated'));
  } catch (err) {
    console.warn('Could not remove interest from local storage:', err);
  }
};

export const isProductLocallyInterested = (productId) => {
  if (typeof window === 'undefined' || !productId) return false;
  try {
    const list = getLocalInterests();
    const target = String(productId);
    return list.some(
      (item) =>
        String(item.productId) === target ||
        String(item.id) === target ||
        String(item.id) === `local-${target}` ||
        String(item.product?.id) === target
    );
  } catch {
    return false;
  }
};

/**
 * 1-Click Toggle: Redirects to /login if user is not authenticated
 */
export const toggleInterest = async (product, router = null) => {
  if (!product) return { isInterested: false };

  // 1. Enforce Authentication Requirement
  if (!isCustomerLoggedIn()) {
    redirectToLogin(router);
    return { requireLogin: true, isInterested: false };
  }

  const prodId = product.id || product.productId;
  if (!prodId) return { isInterested: false };

  const isCurrently = isProductLocallyInterested(prodId);
  if (isCurrently) {
    removeLocalInterest(prodId);
  } else {
    saveLocalInterest(product);
  }

  const token = getStoredCustomerToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    const res = await fetch(`${API_URL}/interests/toggle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: prodId,
      }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.warn('Backend toggle interest notice:', err.message);
  }

  return { isInterested: !isCurrently, productId: prodId };
};

/**
 * Fetch all interested products for the logged-in customer
 */
export const fetchMyInterests = async () => {
  const token = getStoredCustomerToken();
  if (!token) {
    return [];
  }

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  try {
    const res = await fetch(`${API_URL}/interests/my`, { headers });
    const json = await res.json();

    if (json.success && Array.isArray(json.data?.interests)) {
      const backendList = json.data.interests.map((item) => {
        const prod = item.product || {};
        const primaryImg =
          prod.images?.find((img) => img.isPrimary)?.imageUrl ||
          prod.images?.find((img) => img.isPrimary)?.url ||
          prod.images?.[0]?.imageUrl ||
          prod.images?.[0]?.url ||
          '/images/storefront/prod-gold-rope.jpg';

        const numPrice = Number(prod.price) || 0;
        const numSale = prod.salePrice !== undefined && prod.salePrice !== null ? Number(prod.salePrice) : numPrice;
        const hasDiscount = numSale < numPrice && numPrice > 0;
        const sellingPrice = hasDiscount ? numSale : numPrice;
        const originalPrice = hasDiscount ? numPrice : null;
        const discount = hasDiscount ? Math.round(((numPrice - numSale) / numPrice) * 100) : 0;

        return {
          id: item.id,
          productId: prod.id,
          createdAt: item.createdAt,
          product: {
            id: prod.id,
            name: prod.name,
            slug: prod.slug || prod.id,
            price: sellingPrice,
            originalPrice: originalPrice,
            discount: discount,
            badge: prod.badge || '',
            badgeColor: '#7E22CE',
            image: primaryImg,
            category: prod.subcategory?.category?.name || 'Fine Jewellery',
            sku: prod.sku || 'TP-JW-001',
          },
        };
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(backendList));
      return backendList;
    }
  } catch {
    // Return local cache on network error
  }

  return getLocalInterests();
};

/**
 * Remove an interest record
 */
export const deleteInterest = async (id, productId) => {
  removeLocalInterest(productId || id);

  const token = getStoredCustomerToken();
  if (!token) return true;

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  try {
    if (id && !String(id).startsWith('local-')) {
      await fetch(`${API_URL}/interests/${id}`, {
        method: 'DELETE',
        headers,
      });
    }
  } catch (err) {
    console.warn('Backend delete interest notice:', err.message);
  }

  return true;
};

export const interestApi = {
  toggleInterest,
  fetchMyInterests,
  deleteInterest,
  getLocalInterests,
  isProductLocallyInterested,
  isCustomerLoggedIn,
  redirectToLogin,
};

export default interestApi;
