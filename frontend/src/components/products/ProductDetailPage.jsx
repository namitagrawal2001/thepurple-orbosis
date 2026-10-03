"use client";

import { API_BASE_URL } from '@/lib/api/url';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  Lock,
  Gift,
  Share2,
  Copy,
  Check,
  Plus,
  Minus,
  ShoppingCart,
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Award,
  CheckCircle2,
  Tag,
  Clock,
  ThumbsUp,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { optimisticToggle, toggleWishlistProduct } from '@/store/slices/wishlistSlice';
import { addToCart, removeFromCart, syncAddToCart, syncRemoveFromCart } from '@/store/slices/cartSlice';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import MainHeader from '@/components/layout/MainHeader';
import Footer from '@/components/layout/Footer';
import ProductReviewsSection from './ProductReviewsSection';

export default function ProductDetailPage({ slug }) {
  const router = useRouter();
  const dispatch = useDispatch();

  // Redux Auth, Wishlist & Cart
  const customerUser = useSelector((state) => state.auth?.customer?.user);
  const cartItems = useSelector((state) => state.cart?.items || []);
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const isWishlistedGlobal = useSelector((state) =>
    state.wishlist?.items?.some((i) => i.id === slug || i.slug === slug)
  );

  // Product Data
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dynamicRating, setDynamicRating] = useState(null);
  const [dynamicReviewCount, setDynamicReviewCount] = useState(null);

  // Gallery & Zoom State
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isHoverZooming, setIsHoverZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoomLevel, setLightboxZoomLevel] = useState(1);
  const imageContainerRef = useRef(null);

  // Variant & Buy Box State
  const [selectedColorId, setSelectedColorId] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('inch'); // 'inch' | 'cm' | 'm'
  const [quantity, setQuantity] = useState(1);
  const [couponCopied, setCouponCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccessNotice, setCartSuccessNotice] = useState(null);

  const isInCart = useMemo(() => {
    return cartItems.some(
      (item) =>
        (product?.id && item.productId === product.id) ||
        (product?.slug && item.slug === product.slug) ||
        (slug && item.slug === slug)
    );
  }, [cartItems, product, slug]);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Tabs State: 'details' | 'specifications' | 'shipping' | 'reviews' | 'care'
  const [activeTab, setActiveTab] = useState('details');

  // Monitor scroll for mobile sticky buy bar
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        setShowStickyBar(window.scrollY > 420);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smart Formatter for Size Labels with Dynamic Unit Conversion
  const formatSizeLabel = (rawName, unit = 'inch') => {
    if (!rawName) return '';
    const str = String(rawName).trim();

    // Check for 2D Dimension: e.g. 12" × 18" (30.5 × 45.7 cm) or 12 x 18 inch
    const dim2dMatch = str.match(/(\d+(?:\.\d+)?)\s*["']?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*["']?/i);
    const cm2dMatch = str.match(/\(?(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*cm\)?/i);

    if (unit === 'cm') {
      if (cm2dMatch) {
        return `${cm2dMatch[1]} × ${cm2dMatch[2]} cm`;
      }
      const cmMatch = str.match(/(\d+(?:\.\d+)?)\s*cm/i);
      if (cmMatch) return `${cmMatch[1]} cm`;
      const inchMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:"|inch|in)/i);
      if (inchMatch) {
        const cmVal = (parseFloat(inchMatch[1]) * 2.54).toFixed(1).replace(/\.0$/, '');
        return `${cmVal} cm`;
      }
      if (dim2dMatch) {
        const wCm = (parseFloat(dim2dMatch[1]) * 2.54).toFixed(1).replace(/\.0$/, '');
        const hCm = (parseFloat(dim2dMatch[2]) * 2.54).toFixed(1).replace(/\.0$/, '');
        return `${wCm} × ${hCm} cm`;
      }
    } else if (unit === 'm') {
      const meterMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:metre|meter|m\b)/i);
      if (meterMatch) return `${meterMatch[1]} Metre`;
      const cmMatch = str.match(/(\d+(?:\.\d+)?)\s*cm/i);
      if (cmMatch) {
        const mVal = (parseFloat(cmMatch[1]) / 100).toFixed(2).replace(/\.?0+$/, '');
        return `${mVal} m`;
      }
      const inchMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:"|inch|in)/i);
      if (inchMatch) {
        const mVal = ((parseFloat(inchMatch[1]) * 2.54) / 100).toFixed(2).replace(/\.?0+$/, '');
        return `${mVal} m`;
      }
    } else {
      // Default 'inch'
      if (dim2dMatch && !str.toLowerCase().startsWith('(')) {
        return `${dim2dMatch[1]} × ${dim2dMatch[2]} inch`;
      }
      const inchMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:"|inch|in\b)/i);
      if (inchMatch) return `${inchMatch[1]} inch`;
      const cmMatch = str.match(/(\d+(?:\.\d+)?)\s*cm/i);
      if (cmMatch) {
        const inchVal = (parseFloat(cmMatch[1]) / 2.54).toFixed(1).replace(/\.0$/, '');
        return `${inchVal} inch`;
      }
    }

    // Fallback: strip ugly bracketed conversions for clean standard labels
    return str.split('/')[0].split('(')[0].trim() || str;
  };

  // Fetch Product by Slug or ID
  useEffect(() => {
    let isMounted = true;
    const fetchProductDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = API_BASE_URL;
        const res = await fetch(`${apiUrl}/products/${slug}`);
        if (!res.ok) throw new Error('Product not found');
        const data = await res.json();
        const prod = data?.data?.product || data?.product;
        if (!prod) throw new Error('Product details missing');

        if (isMounted) {
          setProduct(prod);

          // Default variant setup
          if (prod.variants && prod.variants.length > 0) {
            const firstWithColor = prod.variants.find((v) => v.colorId);
            const firstWithSize = prod.variants.find((v) => v.sizeId);
            if (firstWithColor) setSelectedColorId(firstWithColor.colorId);
            if (firstWithSize) setSelectedSizeId(firstWithSize.sizeId);
          }

          // Fetch Related Products from same subcategory/category
          const categorySlug = prod.subcategory?.category?.slug || prod.subcategory?.categoryId;
          if (categorySlug) {
            fetch(`${apiUrl}/products?limit=6`)
              .then((r) => r.json())
              .then((relData) => {
                const prods = relData?.data?.products || relData?.products || [];
                if (isMounted) {
                  setRelatedProducts(prods.filter((p) => p.id !== prod.id).slice(0, 6));
                }
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load product');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (slug) fetchProductDetails();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Available unique colors and sizes from variants
  const availableColors = useMemo(() => {
    if (!product?.variants) return [];
    const map = new Map();
    product.variants.forEach((v) => {
      if (v.color && !map.has(v.color.id)) {
        map.set(v.color.id, {
          ...v.color,
          variantImg: v.imageUrl,
        });
      }
    });
    return Array.from(map.values());
  }, [product]);

  const availableSizes = useMemo(() => {
    if (!product?.variants) return [];
    const map = new Map();
    product.variants.forEach((v) => {
      if (v.size && !map.has(v.size.id)) {
        map.set(v.size.id, v.size);
      }
    });
    return Array.from(map.values());
  }, [product]);

  // Current active matching variant
  const activeVariant = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return null;
    return (
      product.variants.find((v) => {
        const matchesColor = selectedColorId ? v.colorId === selectedColorId : true;
        const matchesSize = selectedSizeId ? v.sizeId === selectedSizeId : true;
        return matchesColor && matchesSize;
      }) || product.variants[0]
    );
  }, [product, selectedColorId, selectedSizeId]);

  // Gallery Images Array (Clean fallback list)
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const imgs = product.images?.map((img) => img.imageUrl) || [];
    if (imgs.length === 0) {
      imgs.push('/images/storefront/cat-chains.jpg');
    }
    return imgs;
  }, [product]);

  // Active Main Image (Directly driven by user thumbnail selection)
  const currentMainImage = useMemo(() => {
    return galleryImages[selectedImageIdx] || galleryImages[0] || '/images/storefront/cat-chains.jpg';
  }, [galleryImages, selectedImageIdx]);

  // Price & Offer Calculations
  const currentSalePrice = parseFloat(activeVariant?.salePrice || product?.salePrice || product?.price || 0);
  const currentMrp = parseFloat(activeVariant?.mrp || product?.mrp || (currentSalePrice * 1.5) || 0);
  const discountPercent = currentMrp > currentSalePrice ? Math.round(((currentMrp - currentSalePrice) / currentMrp) * 100) : product?.discountPercent || 0;
  const currentStock = activeVariant?.stock !== undefined ? activeVariant.stock : (product?.stock || 50);

  // Gallery Navigation (Next / Prev)
  const handlePrevImage = (e) => {
    e.stopPropagation();
    setSelectedImageIdx((idx) => (idx - 1 + galleryImages.length) % galleryImages.length);
  };
  const handleNextImage = (e) => {
    e.stopPropagation();
    setSelectedImageIdx((idx) => (idx + 1) % galleryImages.length);
  };

  // Mouse Move Magnifier Handler
  const handleMouseMove = (e) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  // Copy Coupon Code Handler
  const handleCopyCoupon = (code = 'WELCOME10') => {
    navigator.clipboard?.writeText(code);
    setCouponCopied(true);
    setTimeout(() => setCouponCopied(false), 2500);
  };

  // Copy Share Link Handler
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
  };

  // Wishlist Toggle (Requires Login)
  const isWishlisted = isWishlistedGlobal || wishlistItems.some((i) => i.id === product?.id);
  const handleWishlistClick = (e) => {
    e.preventDefault();
    if (!customerUser) {
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname : `/products/${slug}`;
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (!product) return;
    dispatch(optimisticToggle(product));
    dispatch(toggleWishlistProduct(product));
  };

  // Add to Cart (Available for Guests & Logged-in Users)
  const handleAddToCart = () => {
    if (!product) return;

    if (isInCart) {
      dispatch(removeFromCart(product.id));
      dispatch(syncRemoveFromCart(product.id));
      setCartSuccessNotice('Removed item from Cart');
      setTimeout(() => setCartSuccessNotice(null), 3000);
      return;
    }

    setAddingToCart(true);

    const selectedColorObj = availableColors.find((c) => c.id === selectedColorId);
    const selectedSizeObj = availableSizes.find((s) => s.id === selectedSizeId);

    const colorName = selectedColorObj?.name || 'Gold';
    const sizeName = selectedSizeObj?.name ? formatSizeLabel(selectedSizeObj.name, selectedUnit) : '16 inch';

    dispatch(
      addToCart({
        productId: product.id,
        variantId: activeVariant?.id || null,
        productName: product.name,
        slug: product.slug,
        categoryName: product.subcategory?.name || 'Jewellery',
        selectedColor: colorName,
        selectedSize: sizeName,
        metaSubtitle: `${product.subcategory?.name || 'Jewellery'} | ${sizeName} | ${colorName}`,
        imageUrl: currentMainImage,
        badge: badgeText,
        price: currentSalePrice,
        mrp: currentMrp,
        discountPercent: discountPercent,
        quantity: quantity,
        stock: currentStock,
        inStock: currentStock > 0,
      })
    );
    dispatch(syncAddToCart({ productId: product.id, quantity, priceSnapshot: currentSalePrice }));

    setTimeout(() => {
      setAddingToCart(false);
      setCartSuccessNotice('Item added to Cart! 🎉');
      setTimeout(() => setCartSuccessNotice(null), 3500);
    }, 200);
  };

  // Buy Now (Requires Login)
  const handleBuyNow = () => {
    if (!customerUser) {
      router.push(`/login?redirect=/checkout`);
      return;
    }
    handleAddToCart();
    router.push('/checkout');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FCFBFE' }}>
        <AnnouncementBar />
        <MainHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', border: '4px solid #E9D5FF', borderTopColor: '#7E22CE', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#6B7280', fontSize: '15px', fontWeight: 600 }}>Loading luxurious product details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FCFBFE' }}>
        <AnnouncementBar />
        <MainHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
            <AlertCircle size={48} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E1B4B', marginBottom: '8px' }}>Product Not Found</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '20px' }}>The product you are looking for does not exist or has been moved.</p>
            <Link href="/products" style={{ display: 'inline-block', padding: '10px 24px', backgroundColor: '#7E22CE', color: '#fff', borderRadius: '8px', fontWeight: 700, textDecoration: 'none' }}>
              Explore All Products
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const badgeText = product.badge || (product.isBestSeller ? 'BESTSELLER' : product.isFeatured ? 'TRENDING' : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#FCFBFE', color: '#1E1B4B', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Embedded Responsive Stylesheet */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Product Main 3-Column Layout */
        .pdp-layout-grid {
          display: grid;
          grid-template-columns: minmax(360px, 480px) minmax(320px, 1fr) 280px;
          gap: 28px;
          align-items: start;
        }

        /* Gallery Layout */
        .pdp-gallery-container {
          display: flex;
          gap: 14px;
          position: sticky;
          top: 90px;
        }
        .pdp-thumbnails-rail {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 520px;
          overflow-y: auto;
        }
        .pdp-main-image-viewport {
          flex: 1;
          height: 520px;
          border-radius: 16px;
          background-color: #FFFFFF;
          border: 1px solid #E5E7EB;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 30px rgba(0,0,0,0.04);
          cursor: crosshair;
        }

        /* 4 Assurance Badges */
        .pdp-assurance-grid {
          margin: 40px 0;
          padding: 20px 24px;
          background-color: #FAF5FF;
          border-radius: 16px;
          border: 1px solid #E9D5FF;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        /* Tab Details Grid */
        .pdp-tab-details-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 28px;
          align-items: start;
        }
        .pdp-specs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          max-width: 750px;
        }

        /* CTA Buttons Grid */
        .pdp-cta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 6px;
        }

        /* Tablet Breakpoint (max-width: 1120px) */
        @media (max-width: 1120px) {
          .pdp-layout-grid {
            grid-template-columns: minmax(320px, 440px) 1fr;
            gap: 24px;
          }
          .pdp-sidebar-column {
            grid-column: 1 / -1;
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          .pdp-tab-details-grid {
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .pdp-story-card {
            grid-column: 1 / -1;
          }
        }

        /* Mobile Breakpoint (max-width: 768px) */
        @media (max-width: 768px) {
          .pdp-layout-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .pdp-gallery-container {
            flex-direction: column-reverse;
            position: static;
            gap: 12px;
            width: 100%;
          }
          .pdp-thumbnails-rail {
            flex-direction: row;
            max-height: none;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 6px;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            width: 100%;
          }
          .pdp-thumbnails-rail::-webkit-scrollbar {
            display: none;
          }
          .pdp-thumbnail-btn {
            width: 60px !important;
            height: 60px !important;
            flex-shrink: 0;
          }
          .pdp-main-image-viewport {
            height: clamp(300px, 85vw, 440px);
            width: 100%;
            cursor: pointer;
          }
          .pdp-sidebar-column {
            grid-template-columns: 1fr !important;
            gap: 12px;
          }
          .pdp-assurance-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            padding: 16px 14px;
            margin: 28px 0;
          }
          .pdp-tab-details-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .pdp-specs-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .pdp-tabs-header {
            padding: 0 14px !important;
            gap: 12px !important;
          }
          .pdp-tab-btn {
            padding: 14px 2px !important;
            font-size: 12.5px !important;
          }
          .pdp-tab-body {
            padding: 18px 14px !important;
          }
        }

        /* Small Mobile (max-width: 480px) */
        @media (max-width: 480px) {
          .pdp-page-container {
            padding: 10px 14px 30px !important;
          }
          .pdp-assurance-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 12px 10px;
          }
          .pdp-assurance-card {
            gap: 8px !important;
          }
          .pdp-assurance-icon {
            width: 32px !important;
            height: 32px !important;
          }
          .pdp-assurance-title {
            font-size: 11.5px !important;
          }
          .pdp-assurance-sub {
            font-size: 10px !important;
          }
          .pdp-cta-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>

      {/* 1. Header & Top Bars */}
      <AnnouncementBar />
      <MainHeader />

      {/* 2. Breadcrumb Navigation */}
      <div style={{ maxWidth: '1380px', margin: '0 auto', width: '100%', padding: '12px 16px 6px' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: '#6B7280', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href="/products" style={{ color: '#6B7280', textDecoration: 'none' }}>
            {product.subcategory?.category?.name || 'Jewellery'}
          </Link>
          <span>›</span>
          <Link href={`/products?subcategory=${product.subcategory?.name || ''}`} style={{ color: '#6B7280', textDecoration: 'none' }}>
            {product.subcategory?.name || 'Chains'}
          </Link>
          <span>›</span>
          <span style={{ color: '#7E22CE', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
            {product.name}
          </span>
        </nav>
      </div>

      {/* Cart Success Floating Notice */}
      {cartSuccessNotice && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '20px',
            left: '20px',
            maxWidth: '380px',
            margin: '0 auto',
            backgroundColor: '#16A34A',
            color: '#fff',
            padding: '14px 18px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'slideUp 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={22} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '13.5px' }}>{typeof cartSuccessNotice === 'string' ? cartSuccessNotice : 'Added to Cart!'}</div>
              <div style={{ fontSize: '11.5px', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                {product.name}
              </div>
            </div>
          </div>
          <Link href="/checkout" style={{ padding: '6px 14px', backgroundColor: '#fff', color: '#16A34A', borderRadius: '6px', fontWeight: 800, fontSize: '12px', textDecoration: 'none', flexShrink: 0 }}>
            Checkout →
          </Link>
        </div>
      )}

      {/* 3. Main Product Section */}
      <main className="pdp-page-container" style={{ maxWidth: '1380px', margin: '0 auto', width: '100%', padding: '12px 20px 40px', flex: 1 }}>
        <div className="pdp-layout-grid">
          
          {/* ========================================================================= */}
          {/* COLUMN 1: INTERACTIVE IMAGE GALLERY & HOVER ZOOM */}
          {/* ========================================================================= */}
          <div className="pdp-gallery-container">
            {/* Gallery Thumbnails (Vertical on desktop, horizontal on mobile) */}
            <div className="pdp-thumbnails-rail">
              {galleryImages.map((imgUrl, idx) => {
                const isActive = idx === selectedImageIdx;
                return (
                  <button
                    key={idx}
                    type="button"
                    className="pdp-thumbnail-btn"
                    onClick={() => setSelectedImageIdx(idx)}
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: isActive ? '2px solid #7E22CE' : '1px solid #E5E7EB',
                      padding: 0,
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      position: 'relative',
                      boxShadow: isActive ? '0 2px 8px rgba(126, 34, 206, 0.25)' : 'none',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                );
              })}
            </div>

            {/* Main Showcase Image with Hover Magnifier */}
            <div
              ref={imageContainerRef}
              className="pdp-main-image-viewport"
              onMouseEnter={() => setIsHoverZooming(true)}
              onMouseLeave={() => setIsHoverZooming(false)}
              onMouseMove={handleMouseMove}
              onClick={() => setIsLightboxOpen(true)}
            >
              {/* Badge Top Left */}
              {badgeText && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    backgroundColor: '#7E22CE',
                    color: '#FFFFFF',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    zIndex: 10,
                    boxShadow: '0 2px 8px rgba(126, 34, 206, 0.35)',
                  }}
                >
                  {badgeText}
                </div>
              )}

              {/* Wishlist Heart Top Right */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWishlistClick(e);
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                  transition: 'transform 0.15s ease',
                }}
                title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
              >
                <Heart size={17} fill={isWishlisted ? '#DC2626' : 'none'} color={isWishlisted ? '#DC2626' : '#4B5563'} />
              </button>

              {/* Overlaid Prev / Next Navigation Arrows for Fast Mobile Navigation */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '8px',
                      transform: 'translateY(-50%)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      border: '1px solid #E5E7EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 8,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    }}
                    title="Previous Image"
                  >
                    <ChevronLeft size={18} color="#1E1B4B" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: '8px',
                      transform: 'translateY(-50%)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      border: '1px solid #E5E7EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 8,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    }}
                    title="Next Image"
                  >
                    <ChevronRight size={18} color="#1E1B4B" />
                  </button>
                </>
              )}

              {/* Base Normal Image */}
              <img
                src={currentMainImage}
                alt={product.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isHoverZooming ? 'none' : 'block',
                  transition: 'opacity 0.2s ease',
                }}
              />

              {/* High-Resolution Hover Magnifier Background */}
              {isHoverZooming && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${currentMainImage})`,
                    backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                    backgroundSize: '240%',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              )}

              {/* Click to Zoom Pill Indicator */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid #E5E7EB',
                  padding: '5px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#4B5563',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <Maximize2 size={12} />
                <span>Click to zoom</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 2: PRODUCT BUY BOX & DYNAMIC VARIANT SELECTOR */}
          {/* ========================================================================= */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Category Tag */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E22CE' }}>
                {product.subcategory?.name || 'FINE JEWELLERY'}
              </span>
              <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.75rem)', fontWeight: 800, color: '#1E1B4B', margin: '4px 0 6px', lineHeight: '1.25' }}>
                {product.name}
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: '1.5' }}>
                {product.shortDescription || 'A timeless classic, crafted with precision for everyday elegance.'}
              </p>
            </div>

            {/* Rating Stars & Sales Metric */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => {
                setActiveTab('reviews');
                const el = document.getElementById('pdp-tabs-container');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              title="Click to view all verified reviews"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#F59E0B' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={15}
                    fill={s <= Math.round(parseFloat(dynamicRating || product.rating || 4.8)) ? '#F59E0B' : '#E5E7EB'}
                    stroke={s <= Math.round(parseFloat(dynamicRating || product.rating || 4.8)) ? '#F59E0B' : '#D1D5DB'}
                  />
                ))}
              </div>
              <span style={{ fontWeight: 800, color: '#1E1B4B' }}>{dynamicRating || product.rating || 4.8} ★</span>
              <span style={{ color: '#7E22CE', fontWeight: 700, textDecoration: 'underline' }}>
                ({dynamicReviewCount !== null ? dynamicReviewCount : (product.reviewCount || 0)} customer reviews)
              </span>
              <span style={{ color: '#D1D5DB' }}>|</span>
              <span style={{ color: '#047857', fontWeight: 700 }}>1.2K+ sold</span>
            </div>

            {/* Price Row */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'clamp(1.6rem, 5vw, 1.9rem)', fontWeight: 900, color: '#1E1B4B' }}>
                ₹{currentSalePrice.toLocaleString('en-IN')}
              </span>
              {currentMrp > currentSalePrice && (
                <span style={{ fontSize: '1.15rem', color: '#9CA3AF', textDecoration: 'line-through' }}>
                  ₹{currentMrp.toLocaleString('en-IN')}
                </span>
              )}
              {discountPercent > 0 && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    backgroundColor: '#DCFCE7',
                    color: '#16A34A',
                    padding: '3px 10px',
                    borderRadius: '12px',
                  }}
                >
                  {discountPercent}% OFF
                </span>
              )}
              <div style={{ width: '100%', fontSize: '11.5px', color: '#6B7280', marginTop: '-4px' }}>
                Inclusive of all taxes
              </div>
            </div>

            {/* Special Offer Box (WELCOME10 Coupon) */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#FAF5FF',
                border: '1px solid #E9D5FF',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#7E22CE', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={15} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#581C87' }}>Special Offer</div>
                  <div style={{ fontSize: '12px', color: '#4B5563' }}>
                    Get 10% off on your first order. Use code <strong>WELCOME10</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCoupon('WELCOME10')}
                style={{
                  border: '1px solid #D8B4FE',
                  backgroundColor: couponCopied ? '#16A34A' : '#ffffff',
                  color: couponCopied ? '#ffffff' : '#7E22CE',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {couponCopied ? <Check size={13} /> : <Copy size={13} />}
                <span>{couponCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Variant Option 1: Colors (If Available) */}
            {availableColors.length > 0 && (
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Color:</span>
                  <span style={{ fontWeight: 800, color: '#7E22CE' }}>
                    {availableColors.find((c) => c.id === selectedColorId)?.name || 'Select Color'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {availableColors.map((c) => {
                    const isSelected = c.id === selectedColorId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedColorId(c.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: isSelected ? '2px solid #7E22CE' : '1px solid #E5E7EB',
                          backgroundColor: isSelected ? '#FAF5FF' : '#ffffff',
                          color: isSelected ? '#7E22CE' : '#374151',
                          fontSize: '12px',
                          fontWeight: isSelected ? 800 : 600,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 2px 6px rgba(126, 34, 206, 0.15)' : 'none',
                        }}
                      >
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.hexCode, border: '1px solid #ccc', flexShrink: 0 }} />
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Variant Option 2: Length / Sizes (If Available) */}
            {availableSizes.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#374151' }}>
                    Select Size / Dimension:
                  </div>

                  {/* Clean Unit Switcher (Inch | CM | Meter) */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#F3E8FF', padding: '3px', borderRadius: '8px' }}>
                    {[
                      { id: 'inch', label: 'INCH' },
                      { id: 'cm', label: 'CM' },
                      { id: 'm', label: 'METER' },
                    ].map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUnit(u.id)}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: selectedUnit === u.id ? 800 : 600,
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: selectedUnit === u.id ? '#7E22CE' : 'transparent',
                          color: selectedUnit === u.id ? '#FFFFFF' : '#6B21A8',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {availableSizes.map((s) => {
                    const isSelected = s.id === selectedSizeId;
                    const cleanLabel = formatSizeLabel(s.name, selectedUnit);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSizeId(s.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #7E22CE' : '1px solid #E5E7EB',
                          backgroundColor: isSelected ? '#7E22CE' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#374151',
                          fontSize: '13px',
                          fontWeight: isSelected ? 800 : 600,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 4px 10px rgba(126, 34, 206, 0.25)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {cleanLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Selector & Stock Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '4px' }}>Quantity</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={{ border: 'none', background: 'none', padding: '8px 12px', cursor: 'pointer', color: '#4B5563' }}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ padding: '0 12px', fontSize: '13.5px', fontWeight: 800, color: '#1E1B4B' }}>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    style={{ border: 'none', background: 'none', padding: '8px 12px', cursor: 'pointer', color: '#4B5563' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Stock Status */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800, color: currentStock > 0 ? '#16A34A' : '#DC2626' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentStock > 0 ? '#16A34A' : '#DC2626' }} />
                  <span>{currentStock > 0 ? 'In Stock' : 'Out of Stock'}</span>
                </div>
                {currentStock > 0 && currentStock <= 5 && (
                  <div style={{ fontSize: '11.5px', color: '#D97706', fontWeight: 700, marginTop: '2px' }}>
                    Only {currentStock} left in stock!
                  </div>
                )}
              </div>
            </div>

            {/* Action CTA Buttons (Add to Cart & Buy Now) */}
            <div className="pdp-cta-grid">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={addingToCart || currentStock <= 0}
                title={isInCart ? 'In Cart - Click to remove' : 'Add to Cart'}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: isInCart ? '#059669' : '#7E22CE',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: currentStock <= 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isInCart
                    ? '0 4px 14px rgba(5, 150, 105, 0.3)'
                    : '0 4px 14px rgba(126, 34, 206, 0.3)',
                  transition: 'all 0.15s ease',
                  opacity: currentStock <= 0 ? 0.5 : 1,
                }}
              >
                {isInCart ? (
                  <>
                    <Check size={18} />
                    <span>Added in Cart</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    <span>{addingToCart ? 'Adding...' : 'Add to Cart'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={currentStock <= 0}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFFFF',
                  color: '#7E22CE',
                  fontSize: '14px',
                  fontWeight: 800,
                  border: '2px solid #7E22CE',
                  cursor: currentStock <= 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                  opacity: currentStock <= 0 ? 0.5 : 1,
                }}
              >
                <Zap size={18} />
                <span>Buy Now</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 3: TRUST & ASSURANCE SIDEBAR CARDS */}
          {/* ========================================================================= */}
          <div className="pdp-sidebar-column" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E5E7EB',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              }}
            >
              {[
                { icon: Truck, title: 'Express Delivery', sub: 'Fast & insured transit', color: '#7E22CE' },
                { icon: ShieldCheck, title: '100% Certified', sub: 'BIS hallmarked purity', color: '#7E22CE' },
                { icon: Sparkles, title: 'Gift Ready', sub: 'Premium signature box', color: '#7E22CE' },
                { icon: Lock, title: 'Secure Payment', sub: '100% safe & secure', color: '#7E22CE' },
                { icon: Headphones, title: '24/7 Support', sub: 'We are here to help', color: '#7E22CE' },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                    <item.icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1E1B4B' }}>{item.title}</div>
                    <div style={{ fontSize: '11.5px', color: '#6B7280' }}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Share this product */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E5E7EB',
                padding: '16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#4B5563', display: 'block', marginBottom: '10px' }}>
                Share this product
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Check out ${product.name} on ThePurple: ` + (typeof window !== 'undefined' ? window.location.href : ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A', fontSize: '11.5px', fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}
                >
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF', color: '#7E22CE', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {linkCopied ? '✓ Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. FOUR TRUST BADGES HORIZONTAL BANNER */}
        {/* ========================================================================= */}
        <div className="pdp-assurance-grid">
          {[
            { icon: ShieldCheck, title: 'Premium Quality', sub: 'Finest materials' },
            { icon: Award, title: 'Certified Jewellery', sub: '22K Gold / 925 Certified' },
            { icon: Heart, title: 'Safe for Everyday Wear', sub: 'Skin friendly & durable' },
            { icon: Gift, title: 'Elegant Packaging', sub: 'Comes in a luxury box' },
          ].map((item, idx) => (
            <div key={idx} className="pdp-assurance-card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="pdp-assurance-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE', flexShrink: 0 }}>
                <item.icon size={19} />
              </div>
              <div>
                <div className="pdp-assurance-title" style={{ fontSize: '13px', fontWeight: 800, color: '#2E1065' }}>{item.title}</div>
                <div className="pdp-assurance-sub" style={{ fontSize: '11.5px', color: '#6B7280' }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* 5. INTERACTIVE TABBED INFORMATION SECTION */}
        {/* ========================================================================= */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '40px' }}>
          {/* Tabs Navigation Header */}
          <div
            id="pdp-tabs-container"
            className="pdp-tabs-header"
            style={{
              display: 'flex',
              gap: '24px',
              borderBottom: '1px solid #E5E7EB',
              padding: '0 24px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              backgroundColor: '#FAF8FC',
            }}
          >
            {[
              { id: 'details', label: 'Product Details' },
              { id: 'specifications', label: 'Specifications' },
              { id: 'shipping', label: 'Shipping & Returns' },
              { id: 'reviews', label: `Customer Reviews (${dynamicReviewCount !== null ? dynamicReviewCount : (product.reviewCount || 0)})` },
              { id: 'care', label: 'Care Guide' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="pdp-tab-btn"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '16px 4px',
                  border: 'none',
                  background: 'none',
                  fontSize: '13.5px',
                  fontWeight: activeTab === tab.id ? 800 : 600,
                  color: activeTab === tab.id ? '#7E22CE' : '#6B7280',
                  borderBottom: activeTab === tab.id ? '2.5px solid #7E22CE' : '2.5px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Body */}
          <div className="pdp-tab-body" style={{ padding: '28px 24px' }}>
            {activeTab === 'details' && (
              <div className="pdp-tab-details-grid">
                {/* Left: Product Description */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E1B4B', marginBottom: '12px' }}>
                    Product Description
                  </h3>
                  <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.6', marginBottom: '16px' }}>
                    {product.description ||
                      'The 22K Handcrafted Golden Rope Chain is a perfect blend of tradition and modern elegance. Expertly crafted by skilled artisans, this chain features a classic rope design that adds a touch of sophistication to any outfit. Whether for daily wear or special occasions, it’s a timeless piece that never goes out of style.'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      'Made from certified premium materials',
                      'Handcrafted by master artisans',
                      'Durable and long-lasting shine',
                      'Perfect for daily wear or special occasions',
                      'Comes in a premium jewellery box',
                    ].map((bullet, bIdx) => (
                      <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#374151' }}>
                        <CheckCircle2 size={16} color="#7E22CE" style={{ flexShrink: 0 }} />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Middle: Why You'll Love It */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E1B4B', marginBottom: '16px' }}>
                    Why You'll Love It
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { icon: Heart, title: 'Timeless Design', sub: 'A classic that never goes out of style' },
                      { icon: Gift, title: 'Perfect Gift', sub: 'Ideal for your loved ones' },
                      { icon: Sparkles, title: 'Versatile', sub: 'Pairs beautifully with any outfit' },
                      { icon: ThumbsUp, title: 'Trusted by Thousands', sub: 'Loved by 50K+ happy customers' },
                    ].map((feature, fIdx) => (
                      <div key={fIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FAF5FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <feature.icon size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1E1B4B' }}>{feature.title}</div>
                          <div style={{ fontSize: '11.5px', color: '#6B7280' }}>{feature.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Story Banner Card */}
                <div
                  className="pdp-story-card"
                  style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    position: 'relative',
                    minHeight: '230px',
                    backgroundImage: `url('/images/storefront/elegance-banner.jpg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                    border: '1px solid #F3E8FF',
                  }}
                >
                  {/* Frosted Glass Floating Badge */}
                  <div
                    style={{
                      background: 'rgba(23, 15, 38, 0.78)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#FDE047', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                      <Sparkles size={12} />
                      <span>Handcrafted Perfection</span>
                    </div>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 3px', color: '#FFFFFF', lineHeight: '1.2' }}>
                      Elegance in Every Detail
                    </h4>
                    <p style={{ fontSize: '11.5px', color: '#E2E8F0', margin: 0, fontWeight: 500 }}>
                      Crafted for your most precious moments
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'specifications' && (
              <div className="pdp-specs-grid">
                {[
                  { label: 'SKU / Model', value: activeVariant?.sku || product.sku },
                  { label: 'Subcategory', value: product.subcategory?.name || 'Chains' },
                  { label: 'Category', value: product.subcategory?.category?.name || 'Jewellery' },
                  { label: 'Material Notes', value: product.specifications || '22K Gold Plated / Solid 925 Sterling Silver' },
                  { label: 'Weight', value: product.weightGrams ? `${product.weightGrams} grams` : '15 - 25 grams' },
                  { label: 'Package Dimensions', value: `${product.lengthCm || 10} × ${product.widthCm || 8} × ${product.heightCm || 4} cm` },
                  { label: 'HSN Code', value: product.hsnCode || '71131930' },
                  { label: 'Tax Rate', value: `${product.taxRate || 3}% GST` },
                ].map((spec, sIdx) => (
                  <div key={sIdx} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                    <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>{spec.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1E1B4B' }}>{spec.value}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'shipping' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '700px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <Truck size={20} style={{ color: '#7E22CE', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#1E1B4B' }}>Express Doorstep Delivery</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#6B7280', lineHeight: '1.5' }}>
                      Orders are processed and dispatched within 24-48 hours. Typical transit time is 3 to 5 business days across all Indian pin codes.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <ShieldCheck size={20} style={{ color: '#7E22CE', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#1E1B4B' }}>100% Quality &amp; Safe Transit Guarantee</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#6B7280', lineHeight: '1.5' }}>
                      Every order is carefully inspected, packed in tamper-proof luxury packaging, and fully insured until safely delivered to your doorstep.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <ProductReviewsSection
                productId={product.id}
                slug={product.slug}
                productName={product.name}
                customerUser={customerUser}
                onRatingUpdated={(avg, cnt) => {
                  setDynamicRating(avg);
                  setDynamicReviewCount(cnt);
                }}
              />
            )}

            {activeTab === 'care' && (
              <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.6', margin: 0 }}>
                  {product.careInstructions || 'To ensure long-lasting lustre and beauty: avoid direct contact with perfumes, hairsprays, and harsh detergents. Store in the complimentary air-tight velvet pouch when not in use.'}
                </p>
                <div style={{ padding: '12px', backgroundColor: '#FAF5FF', borderRadius: '10px', border: '1px solid #E9D5FF', fontSize: '12px', color: '#581C87' }}>
                  💡 <strong>Pro Tip:</strong> Clean gently using a dry microfiber polishing cloth after every wear to maintain optimum mirror shine.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. "YOU MAY ALSO LIKE" RELATED PRODUCTS GRID */}
        {/* ========================================================================= */}
        {relatedProducts.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1E1B4B', margin: 0 }}>
                You May Also Like
              </h2>
              <Link href="/products" style={{ fontSize: '13px', fontWeight: 700, color: '#7E22CE', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                View All →
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
              {relatedProducts.map((rel) => {
                const relImg = rel.images?.[0]?.imageUrl || '/images/storefront/cat-chains.jpg';
                const relPrice = parseFloat(rel.salePrice || rel.price || 0);
                const relMrp = parseFloat(rel.mrp || relPrice * 1.5);
                const relDiscount = relMrp > relPrice ? Math.round(((relMrp - relPrice) / relMrp) * 100) : 0;
                const relBadge = rel.badge || (rel.isBestSeller ? 'BESTSELLER' : null);

                return (
                  <Link
                    key={rel.id}
                    href={`/products/${rel.slug || rel.id}`}
                    style={{
                      textDecoration: 'none',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E5E7EB',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <div style={{ position: 'relative', height: '180px', backgroundColor: '#FAF5FF' }}>
                      {relBadge && (
                        <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: '#7E22CE', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', zIndex: 2 }}>
                          {relBadge}
                        </div>
                      )}
                      <img src={relImg} alt={rel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E1B4B', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rel.name}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#1E1B4B' }}>₹{relPrice.toLocaleString('en-IN')}</span>
                        {relMrp > relPrice && (
                          <span style={{ fontSize: '11px', color: '#9CA3AF', textDecoration: 'line-through' }}>₹{relMrp.toLocaleString('en-IN')}</span>
                        )}
                        {relDiscount > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#16A34A' }}>{relDiscount}% OFF</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#F59E0B' }}>
                        <Star size={12} fill="#F59E0B" stroke="#F59E0B" />
                        <span style={{ fontWeight: 700, color: '#4B5563' }}>{rel.rating || 4.8}</span>
                        <span style={{ color: '#9CA3AF' }}>({rel.reviewCount || 42})</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 7. MOBILE FLOATING STICKY ACTION BAR */}
      {/* ========================================================================= */}
      {showStickyBar && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid #E5E7EB',
            padding: '10px 16px',
            zIndex: 998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
            animation: 'slideUp 0.25s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <img
              src={currentMainImage}
              alt={product.name}
              style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #E5E7EB', flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E1B4B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {product.name}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#7E22CE' }}>
                ₹{currentSalePrice.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={addingToCart || currentStock <= 0}
              title={isInCart ? 'In Cart - Click to remove' : 'Add to Cart'}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: isInCart ? '#059669' : '#7E22CE',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isInCart
                  ? '0 2px 10px rgba(5, 150, 105, 0.3)'
                  : '0 2px 10px rgba(126, 34, 206, 0.25)',
              }}
            >
              {isInCart ? <Check size={15} /> : <ShoppingCart size={15} />}
              <span>{isInCart ? 'Added' : (addingToCart ? '...' : 'Add to Cart')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. FULLSCREEN LIGHTBOX CLICK-TO-ZOOM MODAL */}
      {/* ========================================================================= */}
      {isLightboxOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Lightbox Toolbar */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxZoomLevel((z) => Math.min(3, z + 0.3))}
              style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={() => setLightboxZoomLevel((z) => Math.max(1, z - 0.3))}
              style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#DC2626', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Lightbox Image Viewport */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '82vh',
              overflow: 'auto',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={currentMainImage}
              alt={product.name}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                transform: `scale(${lightboxZoomLevel})`,
                transition: 'transform 0.2s ease',
                cursor: lightboxZoomLevel > 1 ? 'grab' : 'default',
              }}
            />
          </div>
        </div>
      )}

      {/* 9. Footer */}
      <Footer />
    </div>
  );
}
