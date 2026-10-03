'use client';

import { API_BASE_URL } from '@/lib/api/url';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star, Heart, ShoppingBag, Check, Eye } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { optimisticToggle, toggleWishlistProduct } from '@/store/slices/wishlistSlice';
import { addToCart, removeFromCart, syncAddToCart, syncRemoveFromCart } from '@/store/slices/cartSlice';
import HorizontalCarousel from './HorizontalCarousel';

const CATALOGUE_PRODUCTS = [
  {
    id: 'prod-1',
    name: '22K Handcrafted Golden Rope Chain',
    category: 'Chains',
    price: 899,
    originalPrice: null,
    rating: 5,
    reviews: 148,
    badge: 'Bestseller',
    badgeColor: '#6D28D9',
    image: '/images/storefront/prod-gold-rope.jpg',
    slug: 'golden-rope-chain',
  },
  {
    id: 'prod-2',
    name: 'Sparkling Solitaire Diamond Ring',
    category: 'Rings',
    price: 2499,
    originalPrice: null,
    rating: 5,
    reviews: 94,
    badge: 'Exclusive',
    badgeColor: '#059669',
    image: '/images/storefront/prod-diamond-ring.jpg',
    slug: 'solitaire-diamond-ring',
  },
  {
    id: 'prod-3',
    name: 'Lustrous Freshwater Pearl Drop Necklace',
    category: 'Necklaces',
    price: 1899,
    originalPrice: null,
    rating: 5,
    reviews: 82,
    badge: 'Trending',
    badgeColor: '#DB2777',
    image: '/images/storefront/prod-pearl-necklace.jpg',
    slug: 'pearl-drop-necklace',
  },
  {
    id: 'prod-4',
    name: 'Emerald & Gold Chandelier Drop Earrings',
    category: 'Earrings',
    price: 1299,
    originalPrice: null,
    rating: 5,
    reviews: 67,
    badge: 'New Arrival',
    badgeColor: '#D97706',
    image: '/images/storefront/prod-emerald-earrings.jpg',
    slug: 'emerald-gold-chandelier-earrings',
  },
  {
    id: 'prod-5',
    name: 'Solid Italian Cuban Link Gold Chain',
    category: 'Chains',
    price: 1499,
    originalPrice: null,
    rating: 5,
    reviews: 112,
    badge: 'Popular',
    badgeColor: '#7C3AED',
    image: '/images/storefront/prod-cuban-chain.jpg',
    slug: 'italian-cuban-link-chain',
  },
  {
    id: 'prod-6',
    name: 'Luxury Velvet Teddy Bear & Hamper',
    category: 'Gifts & Hampers',
    price: 1799,
    originalPrice: null,
    rating: 5,
    reviews: 135,
    badge: 'Gift Choice',
    badgeColor: '#E11D48',
    image: '/images/storefront/prod-teddy-gift.jpg',
    slug: 'teddy-bear-heart-pendant-hamper',
  },
  {
    id: 'prod-7',
    name: 'Diamond Studded 18K Rose Gold Bangle',
    category: 'Bangles',
    price: 2199,
    originalPrice: null,
    rating: 5,
    reviews: 58,
    badge: '18K Gold',
    badgeColor: '#9D174D',
    image: '/images/storefront/prod-rose-bangle.jpg',
    slug: 'rose-gold-diamond-bangle',
  },
  {
    id: 'prod-8',
    name: 'Crystal Heart Solitaire Gold Pendant',
    category: 'Necklaces',
    price: 999,
    originalPrice: null,
    rating: 5,
    reviews: 93,
    badge: 'Hot Deal',
    badgeColor: '#DC2626',
    image: '/images/storefront/prod-heart-pendant.jpg',
    slug: 'crystal-heart-solitaire-pendant',
  },
  {
    id: 'prod-9',
    name: 'Royal Heritage Polki Bridal Choker Set',
    category: 'Necklaces',
    price: 4999,
    originalPrice: null,
    rating: 5,
    reviews: 41,
    badge: 'Luxury',
    badgeColor: '#4338CA',
    image: '/images/storefront/cat-necklaces.jpg',
    slug: 'royal-heritage-polki-choker',
  },
  {
    id: 'prod-10',
    name: 'Lavender Blossom Luxury Perfume & Teddy Gift',
    category: 'Gifts & Hampers',
    price: 2299,
    originalPrice: null,
    rating: 5,
    reviews: 76,
    badge: 'Special',
    badgeColor: '#9333EA',
    image: '/images/storefront/hero-gifts.jpg',
    slug: 'lavender-blossom-luxury-gift',
  },
];

export default function RecentlyViewed() {
  const router = useRouter();
  const dispatch = useDispatch();
  const customerUser = useSelector((state) => state.auth?.customer?.user);
  const cartItems = useSelector((state) => state.cart?.items || []);
  const cartMap = useMemo(() => {
    const map = {};
    cartItems.forEach((item) => {
      if (item.productId) map[item.productId] = true;
      if (item.id) map[item.id] = true;
      if (item.slug) map[item.slug] = true;
    });
    return map;
  }, [cartItems]);
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const likedMap = useSelector((state) => state.wishlist?.likedMap || {});
  const [viewedProducts, setViewedProducts] = useState([]);
  const [addedToCart, setAddedToCart] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadRecentlyViewed() {
      try {
        let catalogue = CATALOGUE_PRODUCTS;
        try {
          const apiUrl = API_BASE_URL;
          const res = await fetch(`${apiUrl}/products?limit=20`);
          const json = await res.json();
          if (json.success && Array.isArray(json.data?.products) && json.data.products.length > 0) {
            catalogue = json.data.products.map((p) => {
              const primaryImg =
                p.images?.find((img) => img.isPrimary)?.imageUrl ||
                p.images?.find((img) => img.isPrimary)?.url ||
                p.images?.[0]?.imageUrl ||
                p.images?.[0]?.url ||
                '/images/storefront/prod-gold-rope.jpg';
              const numPrice = Number(p.price) || 0;
              const numSale = p.salePrice !== undefined && p.salePrice !== null ? Number(p.salePrice) : numPrice;
              const hasDiscount = numSale < numPrice && numPrice > 0;
              const sellingPrice = hasDiscount ? numSale : numPrice;
              const originalPrice = hasDiscount ? numPrice : null;
              const discount = hasDiscount ? Math.round(((numPrice - numSale) / numPrice) * 100) : 0;

              return {
                id: p.id,
                name: p.name,
                category: p.subcategory?.category?.name || 'Jewellery',
                price: sellingPrice,
                originalPrice: originalPrice,
                discount,
                rating: Number(p.rating || 5),
                reviews: p.reviewCount || 42,
                badge: p.badge || (p.isBestSeller ? 'Bestseller' : p.isFeatured ? 'Featured' : hasDiscount && discount > 0 ? `${discount}% OFF` : ''),
                badgeColor: '#7C3AED',
                image: primaryImg,
                slug: p.slug || p.id,
              };
            });
          }
        } catch {
          // Fallback
        }

        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('thepurple_recently_viewed');
          if (raw) {
            try {
              const ids = JSON.parse(raw);
              if (Array.isArray(ids) && ids.length > 0) {
                const matched = ids
                  .map((id) => catalogue.find((p) => String(p.id) === String(id) || String(p.slug) === String(id)))
                  .filter(Boolean);
                if (matched.length > 0 && isMounted) {
                  setViewedProducts(matched);
                  setIsLoaded(true);
                  return;
                }
              }
            } catch {}
          }
        }

        if (isMounted) {
          setViewedProducts(catalogue.slice(0, 10));
          setIsLoaded(true);
        }
      } catch {
        if (isMounted) {
          setViewedProducts(CATALOGUE_PRODUCTS.slice(0, 10));
          setIsLoaded(true);
        }
      }
    }
    loadRecentlyViewed();
    return () => {
      isMounted = false;
    };
  }, []);

  const money = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);

  const toggleWishlist = (e, prod) => {
    e.preventDefault();
    e.stopPropagation();
    if (!customerUser) {
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }
    // 1. Instant 0ms synchronous UI toggle across all pages
    dispatch(optimisticToggle(prod));
    // 2. Database & auth sync
    dispatch(toggleWishlistProduct(prod));
  };

  const handleQuickAdd = (e, prodOrId) => {
    e.preventDefault();
    e.stopPropagation();
    const prod =
      typeof prodOrId === 'object' && prodOrId !== null
        ? prodOrId
        : viewedProducts?.find((p) => p.id === prodOrId);

    if (!prod) return;

    const isInCart = Boolean(cartMap[prod.id] || (prod.slug && cartMap[prod.slug]));

    if (isInCart) {
      dispatch(removeFromCart(prod.id));
      dispatch(syncRemoveFromCart(prod.id));
    } else {
      const salePrice = prod.price || 899;
      dispatch(
        addToCart({
          productId: prod.id,
          productName: prod.name,
          slug: prod.slug,
          categoryName: prod.category || 'Jewellery',
          selectedSize: 'Standard',
          selectedColor: 'Gold',
          metaSubtitle: `${prod.category || 'Jewellery'} | Standard`,
          imageUrl: prod.image || '/images/storefront/prod-gold-rope.jpg',
          badge: prod.badge,
          price: salePrice,
          mrp: prod.originalPrice || salePrice * 1.5,
          discountPercent: 0,
          quantity: 1,
          stock: 20,
          inStock: true,
        })
      );
      dispatch(syncAddToCart({ productId: prod.id, quantity: 1, priceSnapshot: salePrice }));
    }
  };

  if (isLoaded && viewedProducts.length === 0) return null;

  return (
    <section
      style={{
        maxWidth: '1420px',
        margin: '36px auto 0 auto',
        padding: '0 16px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="recently-viewed-header"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div className="recently-viewed-title-block">
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.16em',
              color: '#7C3AED',
              textTransform: 'uppercase',
              marginBottom: '4px',
              fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Eye size={14} />
            <span>RECENTLY VIEWED</span>
          </div>
          <h2
            style={{
              fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
              fontSize: 'clamp(1.15rem, 3vw, 1.45rem)',
              fontWeight: 800,
              color: '#18181B',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Continue Exploring Your Favorites
          </h2>
          <p style={{ fontSize: '13px', color: '#5F5A6B', margin: 0 }}>
            Continue exploring products you viewed recently
          </p>
        </div>

        <Link href="/shop" style={{ fontSize: '12.5px', fontWeight: 700, color: '#6D28D9', textDecoration: 'none' }}>
          View All →
        </Link>
      </div>

      <HorizontalCarousel gap={16}>
        {viewedProducts.map((prod) => {
          const isLiked = Boolean(likedMap[String(prod.id)] || likedMap[String(prod.productId)]);
          const isAdded = Boolean(cartMap[prod.id] || (prod.slug && cartMap[prod.slug]) || addedToCart[prod.id]);
          const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;
          const discountPct = hasDiscount ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100) : 0;

          return (
            <div
              key={prod.id}
              className="fav-slide-card"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #ECE6F6',
                borderRadius: '14px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(109, 40, 217, 0.04)',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  right: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  zIndex: 3,
                  pointerEvents: 'none',
                }}
              >
                {prod.badge ? (
                  <span
                    style={{
                      backgroundColor: prod.badgeColor,
                      color: '#FFFFFF',
                      fontSize: '9.5px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {prod.badge}
                  </span>
                ) : <span />}
                <button
                  type="button"
                  aria-label="Wishlist"
                  title={isLiked ? 'Remove from Wishlist' : 'Save to Wishlist'}
                  onClick={(e) => toggleWishlist(e, prod)}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: isLiked ? '#FEF2F2' : 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(4px)',
                    border: isLiked ? '1px solid #FECACA' : '1px solid #E8E1F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: isLiked ? '#DC2626' : '#6B7280',
                    pointerEvents: 'auto',
                    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isLiked ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: isLiked ? '0 2px 8px rgba(220, 38, 38, 0.2)' : '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <Heart size={14} fill={isLiked ? '#DC2626' : 'none'} stroke={isLiked ? '#DC2626' : 'currentColor'} />
                </button>
              </div>

              <Link
                href={`/products/${prod.slug}`}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: '1 / 1.08',
                  backgroundColor: '#FAF7F5',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '8px',
                  position: 'relative',
                }}
              >
                <img
                  src={prod.image}
                  alt={prod.name}
                  className="fav-img-hover"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.35s ease',
                  }}
                />
              </Link>

              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', marginBottom: '2px' }}>
                {prod.category}
              </div>
              <Link
                href={`/products/${prod.slug}`}
                style={{
                  textDecoration: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#18181B',
                  lineHeight: 1.3,
                  marginBottom: '6px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  minHeight: '32px',
                  fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
                }}
              >
                {prod.name}
              </Link>

              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '6px' }}>
                {[...Array(Math.min(5, Math.max(1, Math.round(Number(prod.rating) || 5))))].map((_, i) => (
                  <Star key={i} size={11} fill="#F59E0B" stroke="#F59E0B" />
                ))}
                <span style={{ fontSize: '10.5px', color: '#8B8795', fontWeight: 600 }}>({prod.reviews})</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#18181B' }}>{money(prod.price)}</span>
                {hasDiscount && (
                  <>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', textDecoration: 'line-through' }}>{money(prod.originalPrice)}</span>
                    {discountPct > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669' }}>{discountPct}% OFF</span>
                    )}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => handleQuickAdd(e, prod)}
                title={isAdded ? 'In Cart - Click to remove' : 'Add to Cart'}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  backgroundColor: isAdded ? '#059669' : '#F5F3FF',
                  color: isAdded ? '#FFFFFF' : '#6D28D9',
                  border: isAdded ? '1px solid #059669' : '1px solid #E9DBFF',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.2s ease',
                  marginTop: 'auto',
                }}
              >
                {isAdded ? (
                  <>
                    <Check size={13} />
                    <span>Added</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag size={13} />
                    <span>Add to Cart</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </HorizontalCarousel>

      <style jsx>{`
        :global(.fav-slide-card) {
          flex: 0 0 calc((100% - 4 * 16px) / 5) !important;
          min-width: 220px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        :global(.fav-slide-card:hover) {
          transform: translateY(-4px);
          border-color: #C4B5FD !important;
          box-shadow: 0 12px 28px rgba(109, 40, 217, 0.12) !important;
        }
        :global(.fav-slide-card:hover .fav-img-hover) {
          transform: scale(1.08);
        }
        @media (max-width: 1200px) {
          :global(.fav-slide-card) {
            flex: 0 0 calc((100% - 3 * 14px) / 4) !important;
            min-width: 200px;
          }
        }
        @media (max-width: 992px) {
          :global(.fav-slide-card) {
            flex: 0 0 calc((100% - 2 * 12px) / 3) !important;
            min-width: 180px;
          }
        }
        @media (max-width: 768px) {
          :global(.fav-slide-card) {
            flex: 0 0 calc((100% - 10px) / 2.25) !important;
            min-width: 155px;
          }
        }
        @media (max-width: 640px) {
          .recently-viewed-header {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 10px !important;
          }
          .recently-viewed-title-block {
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
        }
        @media (max-width: 480px) {
          :global(.fav-slide-card) {
            flex: 0 0 calc((100% - 8px) / 2.05) !important;
            min-width: 145px;
            padding: 8px !important;
          }
        }
      `}</style>
    </section>
  );
}
