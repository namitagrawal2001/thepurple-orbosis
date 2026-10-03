import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '@/lib/api/url';

const STORAGE_KEY = 'thepurple_interested_products';
const GUEST_ID_KEY = 'thepurple_guest_id';

// Helper: Get or initialize a stable guest ID
export const getOrInitGuestId = () => {
  if (typeof window === 'undefined') return 'guest_default';
  try {
    let gid = localStorage.getItem(GUEST_ID_KEY);
    if (!gid) {
      gid = 'guest_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem(GUEST_ID_KEY, gid);
    }
    return gid;
  } catch {
    return 'guest_fallback';
  }
};

// Helper: Get authorization headers and guest ID
export const getWishlistHeaders = () => {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('thepurple_customer_token') ||
        sessionStorage.getItem('thepurple_customer_token')
      : null;
  const guestId = getOrInitGuestId();

  const headers = {
    'Content-Type': 'application/json',
    'x-guest-id': guestId,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return { headers, token, guestId };
};

// Helper: Read cached items from localStorage
const getLocalCachedItems = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Helper: Build fast lookup map from items
const buildLikedMap = (items = []) => {
  const map = {};
  items.forEach((item) => {
    const pId = String(item.productId || item.product?.id || item.id);
    map[pId] = true;
    if (item.productId) map[String(item.productId)] = true;
    if (item.product?.id) map[String(item.product.id)] = true;
    if (item.id) map[String(item.id)] = true;
  });
  return map;
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

/**
 * Fetch all interested/wishlisted items from backend and sync with storage
 */
export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (_, { rejectWithValue }) => {
    const { headers, guestId } = getWishlistHeaders();
    const apiUrl = API_BASE_URL;

    try {
      const res = await fetch(`${apiUrl}/interests/my?guestId=${encodeURIComponent(guestId)}`, {
        headers,
      });
      const json = await res.json();

      if (json.success && Array.isArray(json.data?.interests)) {
        const transformed = json.data.interests.map((item) => {
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
            productId: String(prod.id || item.productId),
            createdAt: item.createdAt,
            product: {
              id: String(prod.id || item.productId),
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

        // Save fresh backend data to localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(transformed));
          } catch {}
        }

        return transformed;
      }
      return getLocalCachedItems();
    } catch {
      return getLocalCachedItems();
    }
  }
);

/**
 * Toggle product like/unlike state across all pages instantaneously with optimistic update
 */
export const toggleWishlistProduct = createAsyncThunk(
  'wishlist/toggleProduct',
  async (product, { getState, rejectWithValue }) => {
    if (!product) return rejectWithValue('Product is missing');
    const prodId = String(product.id || product.productId);

    const { headers, guestId } = getWishlistHeaders();
    const apiUrl = API_BASE_URL;

    try {
      const res = await fetch(`${apiUrl}/interests/toggle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: prodId,
          guestId,
        }),
      });
      const json = await res.json();
      return {
        productId: prodId,
        isInterested: json.data?.isInterested,
        product,
      };
    } catch {
      // Offline / network fallback
      return {
        productId: prodId,
        isInterested: null,
        product,
      };
    }
  }
);

/**
 * Delete a saved item by record ID
 */
export const removeWishlistProduct = createAsyncThunk(
  'wishlist/removeProduct',
  async ({ id, productId }, { rejectWithValue }) => {
    const { headers, guestId } = getWishlistHeaders();
    const apiUrl = API_BASE_URL;

    try {
      if (id && !String(id).startsWith('local-')) {
        await fetch(`${apiUrl}/interests/${id}?guestId=${encodeURIComponent(guestId)}`, {
          method: 'DELETE',
          headers,
        });
      }
    } catch (err) {
      console.warn('Backend delete interest warning:', err.message);
    }
    return { id, productId: String(productId || id) };
  }
);

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState = {
  items: [],
  likedMap: {},
  totalCount: 0,
  loading: false,
  error: null,
};

// ─── Slice ───────────────────────────────────────────────────────────────────

export const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    // Synchronous direct toggle for instant 0ms UI reactivity
    optimisticToggle(state, action) {
      const prod = action.payload;
      if (!prod) return;
      const prodId = String(prod.id || prod.productId);
      const isCurrentlyLiked = Boolean(state.likedMap[prodId]);

      if (isCurrentlyLiked) {
        // Unlike
        delete state.likedMap[prodId];
        delete state.likedMap[String(prod.productId)];
        delete state.likedMap[String(prod.id)];
        state.items = state.items.filter(
          (item) =>
            String(item.productId) !== prodId &&
            String(item.id) !== prodId &&
            String(item.product?.id) !== prodId
        );
        state.totalCount = Math.max(0, state.items.length);
      } else {
        // Like
        state.likedMap[prodId] = true;
        const numPrice = Number(prod.price) || 0;
        const numSale = prod.salePrice !== undefined && prod.salePrice !== null ? Number(prod.salePrice) : numPrice;
        const hasDiscount = numSale < numPrice && numPrice > 0;
        const sellingPrice = hasDiscount ? numSale : numPrice;
        const originalPrice = hasDiscount ? numPrice : null;
        const discount = hasDiscount ? Math.round(((numPrice - numSale) / numPrice) * 100) : 0;

        const newItem = {
          id: `local-${prodId}`,
          productId: prodId,
          createdAt: new Date().toISOString(),
          product: {
            id: prodId,
            name: prod.name,
            slug: prod.slug || prodId,
            price: sellingPrice,
            originalPrice: originalPrice,
            discount: discount,
            badge: prod.badge || '',
            badgeColor: prod.badgeColor || '#7E22CE',
            image:
              prod.image ||
              prod.imageUrl ||
              prod.images?.[0]?.imageUrl ||
              prod.images?.[0]?.url ||
              '/images/storefront/prod-gold-rope.jpg',
            category: prod.category || prod.subcategory?.category?.name || 'Fine Jewellery',
            sku: prod.sku || 'TP-JW-001',
          },
        };
        state.items.unshift(newItem);
        state.totalCount = state.items.length;
      }

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
        } catch {}
      }
    },
    // Hydrate from localStorage on client render
    hydrateWishlist(state) {
      const cached = getLocalCachedItems();
      state.items = cached;
      state.likedMap = buildLikedMap(cached);
      state.totalCount = cached.length;
    },
  },
  extraReducers: (builder) => {
    // ── fetchWishlist ───────────────────────────────────────────────
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.loading = false;
        const list = Array.isArray(action.payload) ? action.payload : [];
        state.items = list;
        state.likedMap = buildLikedMap(list);
        state.totalCount = list.length;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch wishlist';
      });

    // ── toggleWishlistProduct ─────────────────────────────────────────
    builder.addCase(toggleWishlistProduct.fulfilled, (state, action) => {
      const { productId, isInterested } = action.payload;
      if (isInterested !== null && isInterested !== undefined) {
        if (isInterested) {
          state.likedMap[productId] = true;
        } else {
          delete state.likedMap[productId];
          state.items = state.items.filter(
            (item) =>
              String(item.productId) !== productId &&
              String(item.id) !== productId &&
              String(item.product?.id) !== productId
          );
          state.totalCount = Math.max(0, state.items.length);
        }
      }
    });

    // ── removeWishlistProduct ─────────────────────────────────────────
    builder.addCase(removeWishlistProduct.fulfilled, (state, action) => {
      const { id, productId } = action.payload;
      delete state.likedMap[String(productId)];
      delete state.likedMap[String(id)];
      state.items = state.items.filter(
        (item) =>
          String(item.id) !== String(id) &&
          String(item.productId) !== String(productId) &&
          String(item.product?.id) !== String(productId)
      );
      state.totalCount = Math.max(0, state.items.length);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
        } catch {}
      }
    });
  },
});

export const { optimisticToggle, hydrateWishlist } = wishlistSlice.actions;

export default wishlistSlice.reducer;
