'use client';

import { API_BASE_URL } from '@/lib/api/url';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Star, Heart, ShoppingBag, Check } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { optimisticToggle, toggleWishlistProduct } from '@/store/slices/wishlistSlice';
import { addToCart, removeFromCart, syncAddToCart, syncRemoveFromCart } from '@/store/slices/cartSlice';

const ALL_PRODUCTS = [
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
    name: 'Luxury Velvet Teddy Bear & Pendant Hamper',
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
    name: 'Classic Solitaire Diamond Stud Earrings',
    category: 'Earrings',
    price: 1099,
    originalPrice: null,
    rating: 5,
    reviews: 89,
    badge: 'Must Have',
    badgeColor: '#4F46E5',
    image: '/images/storefront/prod-gold-studs.jpg',
    slug: 'solitaire-diamond-studs',
  },
  {
    id: 'prod-10',
    name: 'Multi-Layered Elegant 18K Gold Chain',
    category: 'Chains',
    price: 1199,
    originalPrice: null,
    rating: 5,
    reviews: 71,
    badge: 'Trending',
    badgeColor: '#7C3AED',
    image: '/images/storefront/prod-layered-chain.jpg',
    slug: 'multi-layered-gold-chain',
  },
];

const CATEGORY_TABS = ['All', 'Chains', 'Necklaces', 'Rings', 'Earrings', 'Gifts & Hampers', 'Bangles'];

export default function SearchWhatYouLove() {
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
  const [productsList, setProductsList] = useState(ALL_PRODUCTS);
  const [searchIntent, setSearchIntent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [addedToCart, setAddedToCart] = useState({});

  useEffect(() => {
    let isMounted = true;
    async function loadBackendProducts() {
      try {
        const apiUrl = API_BASE_URL;
        const res = await fetch(`${apiUrl}/products?limit=50`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.products) && json.data.products.length > 0 && isMounted) {
          const transformed = json.data.products.map((p) => {
            const primaryImg =
              p.images?.find((img) => img.isPrimary)?.imageUrl ||
              p.images?.find((img) => img.isPrimary)?.url ||
              p.images?.[0]?.imageUrl ||
              p.images?.[0]?.url ||
              '/images/storefront/prod-gold-rope.jpg';
            const catName = p.subcategory?.category?.name || 'Jewellery';
            const numPrice = Number(p.price) || 0;
            const numSale = p.salePrice !== undefined && p.salePrice !== null ? Number(p.salePrice) : numPrice;
            const hasDiscount = numSale < numPrice && numPrice > 0;
            const sellingPrice = hasDiscount ? numSale : numPrice;
            const originalPrice = hasDiscount ? numPrice : null;
            const discount = hasDiscount ? Math.round(((numPrice - numSale) / numPrice) * 100) : 0;

            return {
              id: p.id,
              name: p.name,
              category: catName,
              price: sellingPrice,
              originalPrice: originalPrice,
              discount,
              rating: Number(p.rating || 5),
              reviews: p.reviewCount || 42,
              badge: p.badge || (p.isBestSeller ? 'Bestseller' : p.isFeatured ? 'Featured' : hasDiscount && discount > 0 ? `${discount}% OFF` : ''),
              badgeColor: '#6D28D9',
              image: primaryImg,
              slug: p.slug || p.id,
            };
          });
          setProductsList(transformed);
        }
      } catch {
        // Handled
      }
    }
    loadBackendProducts();
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
        : productsList?.find((p) => p.id === prodOrId);

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

  const filteredProducts = useMemo(() => {
    return productsList.filter((prod) => {
      const matchesCategory = selectedCategory === 'All' || prod.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !searchIntent.trim() ||
        prod.name.toLowerCase().includes(searchIntent.toLowerCase()) ||
        prod.category.toLowerCase().includes(searchIntent.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchIntent, selectedCategory]);

  return (
    <section
      style={{
        maxWidth: '1420px',
        margin: '40px auto 48px auto',
        padding: '0 16px',
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.16em',
              color: '#7C3AED',
              textTransform: 'uppercase',
              marginBottom: '4px',
              fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
            }}
          >
            DISCOVER THEPURPLE COLLECTION
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
            Search & Explore What You Love
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: '#6B7280',
              margin: 0,
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            }}
          >
            Find your favorite sparkling jewellery, royal chains, rings and gift hampers
          </p>
        </div>

        {/* Search Input Bar */}
        <div
          style={{
            flex: '1',
            maxWidth: '420px',
            minWidth: '280px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #E8E1F5',
            borderRadius: '10px',
            padding: '0 14px',
            height: '44px',
            boxShadow: '0 2px 6px rgba(109, 40, 217, 0.04)',
          }}
        >
          <Search size={17} style={{ color: '#8B8795', marginRight: '10px', flexShrink: 0 }} />
          <input
            type="text"
            value={searchIntent}
            onChange={(e) => setSearchIntent(e.target.value)}
            placeholder="Search chains, diamond rings, teddy..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '13.5px',
              color: '#18181B',
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              backgroundColor: 'transparent',
            }}
          />
          {searchIntent && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchIntent('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#8B8795',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div
        className="category-tabs-scroll"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '6px',
          marginBottom: '24px',
          scrollbarWidth: 'none',
        }}
      >
        {CATEGORY_TABS.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 600,
                backgroundColor: isActive ? '#6D28D9' : '#F5F3FF',
                color: isActive ? '#FFFFFF' : '#4C1D95',
                border: isActive ? '1px solid #6D28D9' : '1px solid #E9DBFF',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.18s ease',
                fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#EDE8F7';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#F5F3FF';
                }
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Product Suggestion Cards Grid (up to 5 in row on desktop) */}
      {filteredProducts.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#FAF7FF',
            borderRadius: '16px',
            border: '1px dashed #D8B4FE',
          }}
        >
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#4C1D95', margin: '0 0 8px 0' }}>
            No products found matching &ldquo;{searchIntent}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchIntent('');
              setSelectedCategory('All');
            }}
            style={{
              backgroundColor: '#6D28D9',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div
          className="product-suggestion-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '18px',
          }}
        >
          {filteredProducts.map((prod) => {
            const isLiked = Boolean(likedMap[String(prod.id)] || likedMap[String(prod.productId)]);
            const isAdded = Boolean(cartMap[prod.id] || (prod.slug && cartMap[prod.slug]) || addedToCart[prod.id]);
            const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;
            const discountPct = hasDiscount ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100) : 0;

            return (
              <div
                key={prod.id}
                className="prod-card"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #ECE6F6',
                  borderRadius: '14px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(109, 40, 217, 0.04)',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = '#C4B5FD';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(109, 40, 217, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#ECE6F6';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(109, 40, 217, 0.04)';
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '14px',
                    left: '14px',
                    right: '14px',
                    display: 'flex',
                    alignItems: 'center',
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
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }}
                    >
                      {prod.badge}
                    </span>
                  ) : <span />}

                  <button
                    type="button"
                    aria-label="Add to Wishlist & Interests"
                    title={isLiked ? 'Remove from Wishlist' : 'Save to Wishlist'}
                    onClick={(e) => toggleWishlist(e, prod)}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: isLiked ? '#FEF2F2' : 'rgba(255, 255, 255, 0.9)',
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
                      boxShadow: isLiked ? '0 2px 8px rgba(220, 38, 38, 0.2)' : '0 2px 6px rgba(0,0,0,0.08)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.18)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = isLiked ? 'scale(1.08)' : 'scale(1)')}
                  >
                    <Heart size={14} fill={isLiked ? '#DC2626' : 'none'} stroke={isLiked ? '#DC2626' : 'currentColor'} />
                  </button>
                </div>

                {/* Product Image Container — larger visual */}
                <Link
                  href={`/products/${prod.slug}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    aspectRatio: '1 / 1.12',
                    backgroundColor: '#FAF7F5',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    position: 'relative',
                    marginBottom: '8px',
                  }}
                >
                  <img
                    src={prod.image}
                    alt={prod.name}
                    className="product-img-hover"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.4s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                </Link>

                {/* Category & Title — compact text */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 2px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#7C3AED',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '2px',
                      fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
                    }}
                  >
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
                    title={prod.name}
                  >
                    {prod.name}
                  </Link>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10.5px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', color: '#F59E0B' }}>
                      {[...Array(Math.min(5, Math.max(1, Math.round(Number(prod.rating) || 5))))].map((_, i) => (
                        <Star key={i} size={11} fill="#F59E0B" stroke="#F59E0B" />
                      ))}
                    </div>
                    <span style={{ color: '#8B8795', fontWeight: 600 }}>({prod.reviews})</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '6px',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 800,
                        color: '#18181B',
                        fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
                      }}
                    >
                      {money(prod.price)}
                    </span>
                    {hasDiscount && (
                      <>
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#9CA3AF',
                            textDecoration: 'line-through',
                          }}
                        >
                          {money(prod.originalPrice)}
                        </span>
                        {discountPct > 0 && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#059669',
                            }}
                          >
                            {discountPct}% OFF
                          </span>
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
                    onMouseEnter={(e) => {
                      if (!isAdded) {
                        e.currentTarget.style.backgroundColor = '#6D28D9';
                        e.currentTarget.style.color = '#FFFFFF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isAdded) {
                        e.currentTarget.style.backgroundColor = '#F5F3FF';
                        e.currentTarget.style.color = '#6D28D9';
                      }
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
              </div>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .category-tabs-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <style jsx>{`
        @media (max-width: 1280px) {
          .product-suggestion-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
        @media (max-width: 960px) {
          .product-suggestion-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .product-suggestion-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
        }
        @media (max-width: 380px) {
          .product-suggestion-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </section>
  );
}
