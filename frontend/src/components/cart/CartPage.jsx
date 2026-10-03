'use client';

import { API_BASE_URL } from '@/lib/api/url';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import {
  Heart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Gift,
  Truck,
  RotateCcw,
  Headphones,
  Lock,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Tag,
  Star,
  ShoppingCart,
  Check,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import {
  updateQuantity,
  removeFromCart,
  toggleSelectItem,
  selectAllItems,
  removeSelectedItems,
  applyCouponCode,
  removeCouponCode,
  addToCart,
  syncAddToCart,
  syncUpdateQuantity,
  syncRemoveFromCart,
  syncClearCart,
  syncApplyCoupon,
  fetchCart,
} from '@/store/slices/cartSlice';
import { optimisticToggle, toggleWishlistProduct } from '@/store/slices/wishlistSlice';
import { cartApi } from '@/lib/api/cart';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import MainHeader from '@/components/layout/MainHeader';
import Footer from '@/components/layout/Footer';

// Seeded "You May Also Like" Fallback Products
const YOU_MAY_ALSO_LIKE_PRODUCTS = [
  {
    id: 'rec-1',
    productId: '58d26272-5e80-499d-bd1e-ff1262b1d99c',
    name: 'Elegant Gold Bangle',
    slug: 'handcrafted-22k-peacock-gold-bangles-set',
    categoryName: 'Bangles',
    imageUrl: '/images/storefront/prod-rose-bangle.jpg',
    price: 2299,
    mrp: 3499,
    discountPercent: 34,
    badge: 'TRENDING',
    rating: 4.8,
    reviewCount: 86,
  },
  {
    id: 'rec-2',
    productId: '5f8ff8c3-14fd-4f86-a2c2-9ee26aa8fcd8',
    name: 'Minimal Butterfly Necklace',
    slug: 'royal-solitaire-heart-pendant-necklace',
    categoryName: 'Necklaces',
    imageUrl: '/images/storefront/prod-heart-pendant.jpg',
    price: 749,
    mrp: 1199,
    discountPercent: 38,
    badge: 'BESTSELLER',
    rating: 4.9,
    reviewCount: 53,
  },
  {
    id: 'rec-3',
    productId: '40a9187d-4b7a-4a6f-b252-9657c957f4ca',
    name: 'Sparkling Solitaire Ring',
    slug: 'royal-solitaire-diamond-ring-18k-white-gold',
    categoryName: 'Rings',
    imageUrl: '/images/storefront/prod-diamond-ring.jpg',
    price: 2499,
    mrp: 3999,
    discountPercent: 38,
    badge: 'NEW',
    rating: 4.9,
    reviewCount: 124,
  },
  {
    id: 'rec-4',
    productId: '4326407d-bdf9-4b08-9ff3-d69fd00f9df4',
    name: 'Crystal Drop Earrings',
    slug: 'pure-diamond-cluster-gold-stud-earrings',
    categoryName: 'Earrings',
    imageUrl: '/images/storefront/prod-emerald-earrings.jpg',
    price: 699,
    mrp: 1199,
    discountPercent: 42,
    badge: 'EXCLUSIVE',
    rating: 4.7,
    reviewCount: 96,
  },
  {
    id: 'rec-5',
    productId: '50e26372-5e80-499d-bd1e-ff1262b1d99e',
    name: 'Handcrafted Bridal Set',
    slug: 'handcrafted-gold-plated-bridal-necklace-set',
    categoryName: 'Sets',
    imageUrl: '/images/storefront/cat-hampers-luxury.jpg',
    price: 1799,
    mrp: 2999,
    discountPercent: 40,
    badge: 'HOT DEAL',
    rating: 4.9,
    reviewCount: 91,
  },
  {
    id: 'rec-6',
    productId: '60e26372-5e80-499d-bd1e-ff1262b1d99f',
    name: '22K Handcrafted Golden Rope Chain',
    slug: 'golden-rope-chain',
    categoryName: 'Chains',
    imageUrl: '/images/storefront/prod-gold-rope.jpg',
    price: 899,
    mrp: 1499,
    discountPercent: 40,
    badge: 'POPULAR',
    rating: 4.8,
    reviewCount: 112,
  },
];

export default function CartPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const recSliderRef = useRef(null);

  // Redux Auth & Customer Session
  const customerUser = useSelector((state) => state.auth?.customer?.user);

  // Redux Cart State
  const cartItems = useSelector((state) => state.cart?.items || []);
  const appliedCoupon = useSelector((state) => state.cart?.appliedCoupon);
  const couponError = useSelector((state) => state.cart?.couponError);

  // Redux Wishlist State
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);

  // Dynamic Recommendations State
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);

  // Available Coupons State
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [showAllOffers, setShowAllOffers] = useState(false);

  // Local Component State
  const [mounted, setMounted] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [noticeMessage, setNoticeMessage] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Available Coupons from Backend
  useEffect(() => {
    let isMounted = true;
    async function loadCoupons() {
      try {
        setLoadingCoupons(true);
        const list = await cartApi.getAvailableCoupons();
        if (Array.isArray(list) && isMounted) {
          setAvailableCoupons(list);
        }
      } catch (err) {
        console.warn('Could not load available coupons:', err);
      } finally {
        if (isMounted) setLoadingCoupons(false);
      }
    }
    loadCoupons();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Dynamic Products for Recommendations
  useEffect(() => {
    let isMounted = true;
    async function fetchDynamicRecommendations() {
      try {
        setLoadingRecommendations(true);
        const apiUrl = API_BASE_URL;
        const res = await fetch(`${apiUrl}/products?limit=12&isFeatured=true`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.products) && isMounted) {
          const transformed = json.data.products.map((p) => {
            const primaryImg =
              (Array.isArray(p.images) && p.images[0]?.imageUrl) ||
              (Array.isArray(p.images) && p.images[0]) ||
              p.image ||
              '/images/storefront/prod-gold-rope.jpg';
            const price = parseFloat(p.price || p.salePrice || 999);
            const mrp = parseFloat(p.originalPrice || p.mrp || price * 1.4);
            const discount =
              p.discountPercent || (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

            return {
              id: p.id,
              productId: p.id,
              name: p.name,
              slug: p.slug,
              categoryName: p.categoryName || p.category?.name || p.subcategory?.name || 'Jewellery',
              imageUrl: primaryImg,
              price: price,
              mrp: mrp,
              discountPercent: discount,
              badge: p.badge || (p.isFeatured ? 'POPULAR' : null),
              rating: p.rating || 4.9,
              reviewCount: p.reviewCount || p.reviewsCount || 54,
            };
          });
          setRecommendedProducts(transformed);
        }
      } catch {
        // Fallback to initial
      } finally {
        if (isMounted) setLoadingRecommendations(false);
      }
    }
    fetchDynamicRecommendations();
    return () => {
      isMounted = false;
    };
  }, []);

  const showNotice = (msg) => {
    setNoticeMessage(msg);
    setTimeout(() => {
      setNoticeMessage(null);
    }, 3200);
  };

  const scrollRecSlider = (direction) => {
    if (recSliderRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      recSliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Selection Calculations
  const selectedItems = useMemo(() => cartItems.filter((i) => i.selected), [cartItems]);
  const isAllSelected = cartItems.length > 0 && selectedItems.length === cartItems.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < cartItems.length;

  const selectedItemCount = useMemo(
    () => selectedItems.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 1), 0),
    [selectedItems]
  );

  const subtotal = useMemo(
    () =>
      selectedItems.reduce((acc, item) => {
        const itemPrice = parseFloat(item.price || 0);
        const itemQty = parseInt(item.quantity, 10) || 1;
        return acc + itemPrice * itemQty;
      }, 0),
    [selectedItems]
  );

  const discountAmount = useMemo(() => {
    if (!appliedCoupon || subtotal === 0) return 0;
    if (appliedCoupon.discountType === 'PERCENTAGE' || (appliedCoupon.discountPercent > 0 && !appliedCoupon.discountType)) {
      const pct = appliedCoupon.discountPercent || appliedCoupon.discountValue || 10;
      let calculated = Math.round((subtotal * pct) / 100);
      if (appliedCoupon.maxDiscountAmount && calculated > appliedCoupon.maxDiscountAmount) {
        calculated = appliedCoupon.maxDiscountAmount;
      }
      return calculated;
    }
    // Flat Rupee Discount
    const flatVal = appliedCoupon.discountAmount || appliedCoupon.discountValue || 0;
    return Math.min(subtotal, flatVal);
  }, [appliedCoupon, subtotal]);

  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Handlers
  const handleQuantityChange = (id, newQty) => {
    if (newQty < 1) return;
    dispatch(updateQuantity({ id, quantity: newQty }));
    dispatch(syncUpdateQuantity({ id, quantity: newQty }));
  };

  const handleRemoveItem = (id, name) => {
    dispatch(removeFromCart(id));
    dispatch(syncRemoveFromCart(id));
    showNotice(`Removed "${name}" from cart`);
  };

  const handleMoveToWishlist = (item) => {
    if (!customerUser) {
      router.push('/login?redirect=/cart');
      return;
    }
    dispatch(
      optimisticToggle({
        id: item.productId,
        name: item.productName,
        slug: item.slug,
        price: item.price,
        mrp: item.mrp,
        imageUrl: item.imageUrl,
        badge: item.badge,
      })
    );
    dispatch(
      toggleWishlistProduct({
        id: item.productId,
        name: item.productName,
        slug: item.slug,
        price: item.price,
        mrp: item.mrp,
        imageUrl: item.imageUrl,
        badge: item.badge,
      })
    );
    dispatch(removeFromCart(item.id));
    dispatch(syncRemoveFromCart(item.id));
    showNotice(`Moved "${item.productName}" to wishlist ❤️`);
  };

  const handleToggleSelect = (id) => {
    dispatch(toggleSelectItem(id));
  };

  const handleSelectAll = () => {
    dispatch(selectAllItems(!isAllSelected));
  };

  const handleRemoveSelected = () => {
    const count = selectedItems.length;
    if (count === 0) return;
    const selectedIds = selectedItems.map((item) => item.id);
    dispatch(removeSelectedItems());
    dispatch(syncClearCart(selectedIds));
    showNotice(`Removed ${count} selected items from cart`);
  };

  const handleApplyCoupon = (e) => {
    if (e) e.preventDefault();
    if (!couponInput.trim()) return;
    dispatch(applyCouponCode(couponInput));
    dispatch(syncApplyCoupon({ code: couponInput, subtotal }));
  };

  const handleApplyQuickCoupon = (code = 'WELCOME10') => {
    setCouponInput(code);
    dispatch(applyCouponCode(code));
    dispatch(syncApplyCoupon({ code, subtotal }));
    showNotice(`Coupon ${code} applied! 10% Discount active 🎉`);
  };

  const handleAddRecToCart = (rec) => {
    const isAlreadyInCart = cartItems.some(
      (item) => item.productId === rec.productId || item.id === rec.productId || (rec.slug && item.slug === rec.slug)
    );

    if (isAlreadyInCart) {
      dispatch(removeFromCart(rec.productId));
      dispatch(syncRemoveFromCart(rec.productId));
      showNotice(`Removed "${rec.name}" from cart`);
    } else {
      dispatch(
        addToCart({
          productId: rec.productId,
          productName: rec.name,
          slug: rec.slug,
          categoryName: rec.categoryName,
          selectedSize: 'Standard',
          selectedColor: 'Gold',
          metaSubtitle: `${rec.categoryName} | Standard`,
          imageUrl: rec.imageUrl,
          badge: rec.badge,
          price: rec.price,
          mrp: rec.mrp,
          discountPercent: rec.discountPercent,
          quantity: 1,
          stock: 20,
          inStock: true,
        })
      );
      dispatch(syncAddToCart({ productId: rec.productId, quantity: 1, priceSnapshot: rec.price }));
      showNotice(`Added "${rec.name}" to cart! 🎉`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', backgroundColor: '#FCFBFE', color: '#1E1B4B', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box' }}>
      
      {/* Embedded Responsive Stylesheet */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* General Container Constraints */
        .cart-wrapper-main {
          width: 100%;
          max-width: 1380px;
          margin: 0 auto;
          box-sizing: border-box;
          padding: 12px 20px 48px;
          flex: 1;
        }

        /* Cart Main Card Containers */
        .cart-card {
          background-color: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #E5E7EB;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
          box-sizing: border-box;
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        /* Cart Main Grid */
        .cart-layout-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 28px;
          align-items: start;
          width: 100%;
          box-sizing: border-box;
        }

        /* Desktop Table Header */
        .cart-table-header {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) 110px 120px 100px;
          gap: 16px;
          padding-bottom: 12px;
          border-bottom: 1.5px solid #E5E7EB;
          font-size: 12px;
          font-weight: 700;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Cart Item Row */
        .cart-item-row {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) 110px 120px 100px;
          gap: 16px;
          align-items: center;
          padding: 20px 0;
          border-bottom: 1px solid #F3F4F6;
          box-sizing: border-box;
          width: 100%;
        }
        .cart-item-row:last-child {
          border-bottom: none;
        }

        /* Desktop columns */
        .cart-item-col-desktop {
          display: block;
        }
        .cart-item-col-desktop-flex {
          display: flex;
          justify-content: center;
        }

        /* Mobile Item Container and Actions (Hidden on Desktop) */
        .cart-item-mobile-actions {
          display: none;
        }

        /* Recommendations Section Wrapper */
        .rec-section-container {
          margin-top: 44px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overflow: hidden;
        }

        /* Horizontal Recommendations Slider Track */
        .rec-horizontal-slider {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding: 8px 4px 16px 4px;
          margin: 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: #D8B4FE #FAF5FF;
          -webkit-overflow-scrolling: touch;
        }
        .rec-horizontal-slider::-webkit-scrollbar {
          height: 6px;
        }
        .rec-horizontal-slider::-webkit-scrollbar-track {
          background: #FAF5FF;
          border-radius: 8px;
        }
        .rec-horizontal-slider::-webkit-scrollbar-thumb {
          background: #C084FC;
          border-radius: 8px;
        }
        .rec-horizontal-slider::-webkit-scrollbar-thumb:hover {
          background: #A855F7;
        }

        .rec-card-slide {
          flex: 0 0 210px;
          width: 210px;
          scroll-snap-align: start;
          background-color: #FFFFFF;
          border-radius: 14px;
          border: 1px solid #E5E7EB;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02);
          box-sizing: border-box;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .rec-card-slide:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(126, 34, 206, 0.08);
          border-color: #D8B4FE;
        }

        /* Assurance Strip */
        .cart-assurance-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
          padding: 20px 24px;
          background-color: #FAF5FF;
          border-radius: 16px;
          border: 1px solid #E9D5FF;
          margin-top: 40px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .assurance-badge-item {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          box-sizing: border-box;
        }

        /* ================= Responsive Breakpoints ================= */
        @media (max-width: 1040px) {
          .cart-layout-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 24px;
          }
          .cart-assurance-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
            padding: 18px 20px;
          }
        }

        @media (max-width: 780px) {
          .cart-wrapper-main {
            padding: 10px 14px 40px;
          }
          .cart-card {
            padding: 16px 14px;
            border-radius: 14px;
          }
          .cart-table-header {
            display: none !important;
          }
          .cart-item-col-desktop,
          .cart-item-col-desktop-flex {
            display: none !important;
          }
          .cart-item-row {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 16px 0;
            position: relative;
          }
          .cart-item-mobile-header {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            width: 100%;
            box-sizing: border-box;
          }
          .cart-item-mobile-actions {
            display: flex !important;
            align-items: center;
            justifyContent: space-between;
            background-color: #FAF5FF;
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid #F3E8FF;
            margin-top: 2px;
            width: 100%;
            box-sizing: border-box;
            gap: 8px;
          }
          .cart-assurance-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            padding: 16px 14px;
          }
          .rec-card-slide {
            flex: 0 0 175px;
            width: 175px;
          }
        }

        @media (max-width: 520px) {
          .cart-wrapper-main {
            padding: 8px 10px 32px;
          }
          .cart-card {
            padding: 14px 10px;
          }
          .cart-item-mobile-header {
            gap: 10px;
          }
          .cart-item-mobile-actions {
            flex-wrap: wrap;
            gap: 8px;
            padding: 8px 10px;
          }
          .rec-card-slide {
            flex: 0 0 155px;
            width: 155px;
          }
          .cart-assurance-grid {
            grid-template-columns: 1fr;
            gap: 10px;
            padding: 14px 12px;
          }
        }

        @media (max-width: 380px) {
          .cart-card {
            padding: 12px 8px;
          }
          .rec-card-slide {
            flex: 0 0 140px;
            width: 140px;
          }
        }
      `}</style>

      {/* 1. Header & Navigation Bars */}
      <AnnouncementBar />
      <MainHeader />

      {/* Toast Notification Banner */}
      {noticeMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#1E1B4B',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 700,
            animation: 'slideUp 0.25s ease',
          }}
        >
          <CheckCircle2 size={18} color="#A855F7" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* 2. Breadcrumb Navigation */}
      <div style={{ maxWidth: '1380px', margin: '0 auto', width: '100%', padding: '14px 20px 6px', boxSizing: 'border-box' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280' }}>
          <Link href="/" style={{ color: '#6B7280', textDecoration: 'none' }}>Home</Link>
          <span>/</span>
          <span style={{ color: '#7E22CE', fontWeight: 700 }}>Cart</span>
        </nav>
      </div>

      {/* 3. Main Cart Container */}
      <main className="cart-wrapper-main">
        
        {/* Page Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.95rem)', fontWeight: 800, color: '#1E1B4B', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Your Cart ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              Review your items and proceed to checkout.
            </p>
          </div>

          <Link
            href="/products"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '8px',
              backgroundColor: '#FAF5FF',
              border: '1px solid #E9D5FF',
              color: '#7E22CE',
              fontSize: '12.5px',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowLeft size={14} />
            <span>Continue Shopping</span>
          </Link>
        </div>

        {/* Empty Cart View */}
        {cartItems.length === 0 ? (
          <div
            className="cart-card"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE', margin: '0 auto 16px' }}>
              <ShoppingBag size={32} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E1B4B', marginBottom: '8px' }}>
              Your cart is currently empty
            </h2>
            <p style={{ fontSize: '13.5px', color: '#6B7280', maxWidth: '420px', margin: '0 auto 24px' }}>
              Looks like you haven't added anything to your cart yet. Explore our handcrafted jewellery collections and special gifts!
            </p>
            <Link
              href="/products"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                backgroundColor: '#7E22CE',
                color: '#FFFFFF',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '13.5px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(126, 34, 206, 0.3)',
              }}
            >
              <ShoppingCart size={16} />
              <span>Explore Products</span>
            </Link>
          </div>
        ) : (
          /* Active Cart 2-Column Grid */
          <div className="cart-layout-grid">
            
            {/* ========================================================================= */}
            {/* COLUMN 1: CART ITEMS TABLE CARD */}
            {/* ========================================================================= */}
            <div className="cart-card">
              {/* Desktop Table Header */}
              <div className="cart-table-header">
                <div style={{ color: '#6B7280' }}>Product</div>
                <div style={{ color: '#6B7280', textAlign: 'left' }}>Price</div>
                <div style={{ color: '#6B7280', textAlign: 'center' }}>Quantity</div>
                <div style={{ color: '#6B7280', textAlign: 'right' }}>Total</div>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {cartItems.map((item) => {
                  const lineTotal = parseFloat(item.price || 0) * (item.quantity || 1);

                  return (
                    <div key={item.id} className="cart-item-row">
                      {/* Product Column (Checkbox + Thumbnail + Details) */}
                      <div className="cart-item-main-col" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, width: '100%' }}>
                        {/* Checkbox */}
                        <div style={{ display: 'flex', alignItems: 'center', paddingTop: '4px', flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={!!item.selected}
                            onChange={() => handleToggleSelect(item.id)}
                            aria-label={`Select ${item.productName}`}
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: '#7E22CE',
                              cursor: 'pointer',
                              borderRadius: '4px',
                            }}
                          />
                        </div>

                        {/* Product Thumbnail */}
                        <div
                          style={{
                            width: '74px',
                            height: '74px',
                            borderRadius: '12px',
                            backgroundColor: '#FAF5FF',
                            border: '1px solid #E5E7EB',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        {/* Title, Badge Pill, Subtitle, & Action Buttons */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <Link
                              href={`/products/${item.slug || item.productId}`}
                              style={{
                                color: '#1E1B4B',
                                fontSize: '13.5px',
                                fontWeight: 700,
                                textDecoration: 'none',
                                lineHeight: 1.35,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {item.productName}
                            </Link>

                            {item.badge && (
                              <span
                                style={{
                                  backgroundColor: '#FAF5FF',
                                  color: '#7E22CE',
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  border: '1px solid #E9D5FF',
                                  letterSpacing: '0.03em',
                                  flexShrink: 0,
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
                            {item.metaSubtitle || `${item.categoryName || 'Jewellery'} | Standard`}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveToWishlist(item)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: 'none',
                                background: 'none',
                                color: '#7E22CE',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <Heart size={13} />
                              <span>Move to Wishlist</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id, item.productName)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: 'none',
                                background: 'none',
                                color: '#DC2626',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <Trash2 size={13} />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop Price */}
                      <div className="cart-item-col-desktop" style={{ fontSize: '14px', fontWeight: 800, color: '#1E1B4B' }}>
                        ₹{parseFloat(item.price || 0).toLocaleString('en-IN')}
                        {item.mrp && item.mrp > item.price && (
                          <div style={{ fontSize: '11px', color: '#9CA3AF', textDecoration: 'line-through', fontWeight: 500 }}>
                            ₹{parseFloat(item.mrp).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>

                      {/* Desktop Quantity Stepper */}
                      <div className="cart-item-col-desktop-flex">
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            backgroundColor: '#FAF5FF',
                            padding: '2px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            style={{
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: 'none',
                              backgroundColor: item.quantity <= 1 ? 'transparent' : '#FFFFFF',
                              borderRadius: '6px',
                              cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                              color: item.quantity <= 1 ? '#D1D5DB' : '#7E22CE',
                              boxShadow: item.quantity <= 1 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                          >
                            <Minus size={13} />
                          </button>
                          <span style={{ width: '32px', textAlign: 'center', fontSize: '13px', fontWeight: 800, color: '#1E1B4B' }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            style={{
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: 'none',
                              backgroundColor: '#FFFFFF',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: '#7E22CE',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Desktop Line Total */}
                      <div className="cart-item-col-desktop" style={{ textAlign: 'right', fontSize: '14.5px', fontWeight: 800, color: '#7E22CE' }}>
                        ₹{lineTotal.toLocaleString('en-IN')}
                      </div>

                      {/* Mobile Row Actions: Price, Quantity & Total in single compact bar */}
                      <div className="cart-item-mobile-actions">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>Price:</span>
                          <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1E1B4B' }}>
                            ₹{parseFloat(item.price || 0).toLocaleString('en-IN')}
                          </span>
                          {item.mrp && item.mrp > item.price && (
                            <span style={{ fontSize: '10.5px', color: '#9CA3AF', textDecoration: 'line-through' }}>
                              ₹{parseFloat(item.mrp).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              backgroundColor: '#FFFFFF',
                              padding: '2px',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              style={{
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: 'none',
                                backgroundColor: item.quantity <= 1 ? 'transparent' : '#FAF5FF',
                                borderRadius: '6px',
                                cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                                color: item.quantity <= 1 ? '#D1D5DB' : '#7E22CE',
                              }}
                            >
                              <Minus size={13} />
                            </button>
                            <span style={{ width: '28px', textAlign: 'center', fontSize: '13px', fontWeight: 800, color: '#1E1B4B' }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: 'none',
                                backgroundColor: '#FAF5FF',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#7E22CE',
                              }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10.5px', color: '#6B7280', fontWeight: 600 }}>Total:</div>
                            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#7E22CE' }}>
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Bulk Select Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '18px',
                  borderTop: '1px solid #F3F4F6',
                  marginTop: '16px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAll}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#7E22CE',
                      cursor: 'pointer',
                    }}
                  />
                  <span>Select All ({selectedItems.length}/{cartItems.length})</span>
                </label>

                {selectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveSelected}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: 'none',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Remove Selected ({selectedItems.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* COLUMN 2: ORDER SUMMARY CARD & PROMO BOX */}
            {/* ========================================================================= */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
              
              {/* Order Summary Main Card */}
              <div className="cart-card">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E1B4B', margin: '0 0 16px' }}>
                  Order Summary
                </h2>

                {/* Subtotal, Discount, Shipping Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563' }}>
                    <span>Subtotal ({selectedItemCount} items)</span>
                    <span style={{ fontWeight: 700, color: '#1E1B4B' }}>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontWeight: 700 }}>
                      <span>Discount</span>
                      <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563', alignItems: 'center' }}>
                    <span>Shipping</span>
                    <span style={{ fontWeight: 600, color: '#6B7280', fontSize: '12.5px' }}>
                      Calculated at checkout
                    </span>
                  </div>

                  {/* Total Line Divider */}
                  <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }} />

                  {/* Total Amount Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#1E1B4B' }}>Estimated Total</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>Excl. shipping (added at checkout)</div>
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#1E1B4B' }}>
                      ₹{finalTotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Proceed to Checkout CTA */}
                <button
                  type="button"
                  onClick={() => {
                    if (!customerUser) {
                      router.push('/login?redirect=/checkout');
                    } else {
                      router.push('/checkout');
                    }
                  }}
                  style={{
                    marginTop: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: '#7E22CE',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(126, 34, 206, 0.3)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Have a Coupon Code Box */}
              <div className="cart-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag size={16} color="#7E22CE" />
                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1E1B4B' }}>
                      Coupons & Offers
                    </span>
                  </div>

                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={() => {
                        dispatch(removeCouponCode());
                        showNotice('Coupon removed');
                      }}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#DC2626',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Applied Coupon Status Banner */}
                {appliedCoupon && (
                  <div
                    style={{
                      marginBottom: '14px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: '#FAF5FF',
                      border: '1.5px dashed #C084FC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="#7E22CE" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#581C87' }}>
                          {appliedCoupon.code}
                        </div>
                        <div style={{ fontSize: '11px', color: '#15803D', fontWeight: 700 }}>
                          Coupon applied! You save ₹{discountAmount.toLocaleString('en-IN')} 🎉
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Code Input Form */}
                <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter coupon code"
                    style={{
                      flex: 1,
                      minWidth: '130px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      fontSize: '13px',
                      color: '#1E1B4B',
                      outline: 'none',
                      textTransform: 'uppercase',
                      backgroundColor: '#FAF5FF',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      backgroundColor: '#7E22CE',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(126, 34, 206, 0.25)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Apply
                  </button>
                </form>

                {couponError && (
                  <div style={{ fontSize: '11.5px', color: '#DC2626', marginBottom: '12px', fontWeight: 600 }}>
                    {couponError}
                  </div>
                )}

                {/* Available Offers List */}
                {availableCoupons.length > 0 && (
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                      Available Coupons for You:
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {availableCoupons
                        .slice(0, showAllOffers ? availableCoupons.length : 3)
                        .map((c) => {
                          const isCurrentApplied = appliedCoupon?.code === c.code;
                          const isPercentage = c.discountType === 'PERCENTAGE';
                          const minReq = parseFloat(c.minOrderAmount || 0);

                          return (
                            <div
                              key={c.id || c.code}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '10px',
                                backgroundColor: isCurrentApplied ? '#FAF5FF' : '#F9FAFB',
                                border: isCurrentApplied ? '1.5px solid #C084FC' : '1px solid #E5E7EB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                  <span
                                    style={{
                                      fontSize: '12px',
                                      fontWeight: 900,
                                      color: '#7E22CE',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    {c.code}
                                  </span>
                                  <span
                                    style={{
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: isPercentage ? '#ECFDF5' : '#EEF2FF',
                                      color: isPercentage ? '#047857' : '#4338CA',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                    }}
                                  >
                                    {isPercentage ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`}
                                  </span>
                                </div>

                                <div style={{ fontSize: '11px', color: '#6B7280' }}>
                                  {minReq > 0 ? `Min cart value: ₹${minReq.toLocaleString('en-IN')}` : 'No minimum order required'}
                                  {isPercentage && c.maxDiscountAmount ? ` (Max ₹${c.maxDiscountAmount})` : ''}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleApplyQuickCoupon(c.code)}
                                disabled={isCurrentApplied}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  border: isCurrentApplied ? '1px solid #10B981' : '1px solid #E9D5FF',
                                  backgroundColor: isCurrentApplied ? '#ECFDF5' : '#FAF5FF',
                                  color: isCurrentApplied ? '#047857' : '#7E22CE',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  cursor: isCurrentApplied ? 'default' : 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                {isCurrentApplied ? 'Applied ✓' : 'Apply'}
                              </button>
                            </div>
                          );
                        })}

                      {availableCoupons.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setShowAllOffers(!showAllOffers)}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#7E22CE',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            padding: '4px 0 0',
                            textAlign: 'center',
                          }}
                        >
                          {showAllOffers ? 'Show Less Offers ↑' : `View All ${availableCoupons.length} Offers ↓`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. "YOU MAY ALSO LIKE" HORIZONTAL CAROUSEL / SLIDER (OVERFLOW-X) */}
        {/* ========================================================================= */}
        <div className="rec-section-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: 'clamp(1.15rem, 3vw, 1.35rem)', fontWeight: 800, color: '#1E1B4B', margin: '0 0 2px' }}>
                You May Also Like
              </h2>
              <p style={{ fontSize: '12.5px', color: '#6B7280', margin: 0 }}>
                Complete your look with these handcrafted pieces.
              </p>
            </div>

            {/* Slider Navigation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => scrollRecSlider('left')}
                aria-label="Previous recommendations"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: '1.5px solid #E9D5FF',
                  backgroundColor: '#FFFFFF',
                  color: '#7E22CE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(126, 34, 206, 0.08)',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => scrollRecSlider('right')}
                aria-label="Next recommendations"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: '1.5px solid #E9D5FF',
                  backgroundColor: '#FFFFFF',
                  color: '#7E22CE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(126, 34, 206, 0.08)',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronRight size={18} />
              </button>
              <Link href="/products" style={{ fontSize: '13px', fontWeight: 700, color: '#7E22CE', textDecoration: 'none', marginLeft: '6px' }}>
                View All →
              </Link>
            </div>
          </div>

          {/* Horizontal Scroll Track */}
          <div ref={recSliderRef} className="rec-horizontal-slider">
            {(recommendedProducts.length > 0 ? recommendedProducts : YOU_MAY_ALSO_LIKE_PRODUCTS).map((rec) => {
              const isRecInCart = cartItems.some(
                (item) => item.productId === rec.productId || item.id === rec.productId || (rec.slug && item.slug === rec.slug)
              );

              return (
                <div
                  key={rec.id || rec.productId}
                  className="rec-card-slide"
                >
                  {/* Image & Badges */}
                  <Link
                    href={`/products/${rec.slug || rec.productId}`}
                    style={{
                      display: 'block',
                      position: 'relative',
                      height: '160px',
                      backgroundColor: '#FAF5FF',
                      overflow: 'hidden',
                    }}
                  >
                    {rec.badge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          backgroundColor: '#7E22CE',
                          color: '#FFFFFF',
                          fontSize: '9px',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          zIndex: 2,
                          textTransform: 'uppercase',
                        }}
                      >
                        {rec.badge}
                      </span>
                    )}
                    <img
                      src={rec.imageUrl}
                      alt={rec.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Link>

                  {/* Product Details */}
                  <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <Link
                        href={`/products/${rec.slug || rec.productId}`}
                        style={{
                          textDecoration: 'none',
                          display: 'block',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: '#1E1B4B',
                          margin: '0 0 4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rec.name}
                      </Link>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1E1B4B' }}>₹{rec.price.toLocaleString('en-IN')}</span>
                        {rec.mrp && rec.mrp > rec.price && (
                          <span style={{ fontSize: '10.5px', color: '#9CA3AF', textDecoration: 'line-through' }}>₹{rec.mrp.toLocaleString('en-IN')}</span>
                        )}
                        {rec.discountPercent > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#16A34A' }}>{rec.discountPercent}% OFF</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#F59E0B', marginBottom: '10px' }}>
                        <Star size={11} fill="#F59E0B" stroke="#F59E0B" />
                        <span style={{ fontWeight: 700, color: '#4B5563' }}>{rec.rating}</span>
                        <span style={{ color: '#9CA3AF' }}>({rec.reviewCount})</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddRecToCart(rec)}
                      title={isRecInCart ? 'In Cart - Click to remove' : 'Add to Cart'}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        backgroundColor: isRecInCart ? '#059669' : '#FAF5FF',
                        border: isRecInCart ? '1px solid #059669' : '1px solid #E9D5FF',
                        color: isRecInCart ? '#FFFFFF' : '#7E22CE',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isRecInCart ? (
                        <>
                          <Check size={12} />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={12} />
                          <span>Add to Cart</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. FIVE TRUST & ASSURANCE BADGES STRIP */}
        {/* ========================================================================= */}
        <div className="cart-assurance-grid">
          {[
            { icon: Truck, title: 'Express Delivery', sub: 'Fast & insured transit' },
            { icon: ShieldCheck, title: '100% Certified', sub: 'BIS hallmarked purity' },
            { icon: Sparkles, title: 'Gift Packaging', sub: 'Luxury signature box' },
            { icon: Lock, title: 'Secure Payment', sub: '100% safe & secure' },
            { icon: Headphones, title: '24/7 Support', sub: 'We are here to help' },
          ].map((item, idx) => (
            <div key={idx} className="assurance-badge-item">
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE', flexShrink: 0 }}>
                <item.icon size={19} />
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#2E1065', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.title}</div>
                <div style={{ fontSize: '11.5px', color: '#6B7280', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 6. Storefront Footer */}
      <Footer />
    </div>
  );
}
