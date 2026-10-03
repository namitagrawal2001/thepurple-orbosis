'use client';

import { API_BASE_URL } from '@/lib/api/url';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  X,
  Star,
  Heart,
  ShoppingCart,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  RotateCcw,
  Layers,
  FolderTree,
  Tag,
  DollarSign,
  Palette,
  Ruler,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { optimisticToggle, toggleWishlistProduct } from '@/store/slices/wishlistSlice';
import { addToCart, removeFromCart, syncAddToCart, syncRemoveFromCart } from '@/store/slices/cartSlice';
import CategoryGridModal from './CategoryGridModal';

const DEFAULT_DISCOUNT_OPTIONS = [
  { label: '10% and above', min: 10 },
  { label: '20% and above', min: 20 },
  { label: '30% and above', min: 30 },
  { label: '40% and above', min: 40 },
  { label: '50% and above', min: 50 },
];

const ITEMS_PER_PAGE = 30;

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [];
  pages.push(1);

  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) {
    pages.push('...');
  }

  for (let i = left; i <= right; i++) {
    pages.push(i);
  }

  if (right < totalPages - 1) {
    pages.push('...');
  }

  pages.push(totalPages);
  return pages;
}

export default function AllProductsCatalog({
  initialCategory = null,
  initialCollection = null,
  isCategoryModalOpenExternal = false,
  onCategoryModalClose = null,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const customerUser = useSelector((state) => state.auth?.customer?.user);

  // Taxonomy Data from API
  const [dbCategories, setDbCategories] = useState([]);
  const [dbColors, setDbColors] = useState([]);
  const [dbSizes, setDbSizes] = useState([]);
  const [rawDbProducts, setRawDbProducts] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Sentinel ref for bottom IntersectionObserver infinite scroll
  const sentinelRef = useRef(null);

  // Collection State (new-arrivals, best-sellers, offers, gifts)
  const [activeCollection, setActiveCollection] = useState(() => {
    const colParam = searchParams ? searchParams.get('collection') : null;
    return colParam || initialCollection || null;
  });

  // Filters State initialized synchronously from searchParams or props
  const [selectedCategories, setSelectedCategories] = useState(() => {
    const catParam = searchParams ? (searchParams.get('category') || searchParams.get('categories')) : null;
    if (catParam) {
      return catParam.includes('||') ? catParam.split('||').map((c) => c.trim()).filter(Boolean) : [catParam.trim()];
    }
    return initialCategory ? [initialCategory] : [];
  });

  const [selectedSubcategories, setSelectedSubcategories] = useState(() => {
    const subParam = searchParams ? (searchParams.get('subcategory') || searchParams.get('subcategories')) : null;
    if (subParam) {
      return subParam.includes('||') ? subParam.split('||').map((s) => s.trim()).filter(Boolean) : [subParam.trim()];
    }
    return [];
  });

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(5000);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedRating, setSelectedRating] = useState(null);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState(() => {
    return searchParams ? (searchParams.get('search') || '').trim() : '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState(() => {
    return searchParams ? (searchParams.get('search') || '').trim() : '';
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const [sortBy, setSortBy] = useState('recommended');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [currentPage, setCurrentPage] = useState(1);

  // Request Sequence Counter to discard stale async race conditions
  const requestSeqRef = useRef(0);

  // Smooth scroll to catalog products section
  const scrollToCatalog = useCallback(() => {
    setTimeout(() => {
      const catalogEl = document.getElementById('catalog-products-section');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  }, []);

  // Update selected category when initialCategory changes
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategories([initialCategory]);
      setCurrentPage(1);
      scrollToCatalog();
    }
  }, [initialCategory, scrollToCatalog]);

  // Update active collection when initialCollection changes
  useEffect(() => {
    if (initialCollection) {
      setActiveCollection(initialCollection);
      setCurrentPage(1);
      scrollToCatalog();
    }
  }, [initialCollection, scrollToCatalog]);

  // Sync with URL search params (category, subcategory, search, collection) and auto-scroll
  useEffect(() => {
    if (!searchParams) return;
    const categoryParam = searchParams.get('category') || searchParams.get('categories');
    const subcategoryParam = searchParams.get('subcategory') || searchParams.get('subcategories');
    const searchParam = searchParams.get('search');
    const collectionParam = searchParams.get('collection');

    let hasUrlFilter = false;

    if (collectionParam) {
      setActiveCollection(collectionParam);
      hasUrlFilter = true;
    }

    if (categoryParam) {
      const cats = categoryParam.includes('||') ? categoryParam.split('||').map((c) => c.trim()).filter(Boolean) : [categoryParam.trim()];
      setSelectedCategories(cats);
      hasUrlFilter = true;
    }

    if (subcategoryParam) {
      const subs = subcategoryParam.includes('||') ? subcategoryParam.split('||').map((s) => s.trim()).filter(Boolean) : [subcategoryParam.trim()];
      setSelectedSubcategories(subs);
      hasUrlFilter = true;
    }

    if (searchParam) {
      setSearchKeyword(searchParam.trim());
      hasUrlFilter = true;
    }

    if (hasUrlFilter || (typeof window !== 'undefined' && window.location.hash === '#catalog-products-section')) {
      setCurrentPage(1);
      scrollToCatalog();
    }
  }, [searchParams, scrollToCatalog]);

  const handleSelectCategoryFromModal = (categoryName, subcategoryName) => {
    if (categoryName) {
      setSelectedCategories([categoryName]);
      if (subcategoryName) {
        setSelectedSubcategories([subcategoryName]);
      } else {
        setSelectedSubcategories([]);
      }
      setCurrentPage(1);
      setIsCategoryModalOpen(false);
      scrollToCatalog();
    }
  };

  // Accordion open/collapse states
  const [accordions, setAccordions] = useState({
    category: true,
    price: true,
    color: true,
    size: true,
    discount: true,
    rating: true,
    availability: true,
  });

  // Mobile Filter Drawer Toggle
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Redux Wishlist and Cart state
  const likedMap = useSelector((state) => state.wishlist?.likedMap || {});
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

  const toggleAccordion = (key) => {
    setAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDiscountToggle = (minVal) => {
    setCurrentPage(1);
    setSelectedDiscount((prev) => (prev === minVal ? null : minVal));
    scrollToCatalog();
  };

  // 1. Fetch Dynamic Filters Taxonomy
  useEffect(() => {
    let isMounted = true;
    async function loadFilterTaxonomy() {
      try {
        const apiUrl = API_BASE_URL;
        const res = await fetch(`${apiUrl}/products/filters`);
        const json = await res.json();
        if (json.success && isMounted) {
          if (Array.isArray(json.data?.categories)) setDbCategories(json.data.categories);
          if (Array.isArray(json.data?.colors)) setDbColors(json.data.colors);
          if (Array.isArray(json.data?.sizes)) setDbSizes(json.data.sizes);
        }
      } catch {
        // Handled
      }
    }
    loadFilterTaxonomy();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Products dynamically from backend (loads 30 items per batch)
  const fetchProducts = useCallback(async (pageToFetch = 1) => {
    const currentSeq = ++requestSeqRef.current;
    if (pageToFetch === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const apiUrl = API_BASE_URL;
      const params = new URLSearchParams();
      params.set('page', pageToFetch);
      params.set('limit', ITEMS_PER_PAGE);

      if (activeCollection) params.set('collection', activeCollection);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (selectedCategories.length > 0) params.set('category', selectedCategories.join('||'));
      if (selectedSubcategories.length > 0) params.set('subcategory', selectedSubcategories.join('||'));
      if (minPrice > 0) params.set('minPrice', minPrice);
      if (maxPrice < 5000) params.set('maxPrice', maxPrice);
      if (selectedDiscount) params.set('minDiscount', selectedDiscount);
      if (selectedRating) params.set('rating', selectedRating);
      if (selectedColors.length > 0) params.set('colors', selectedColors.join(','));
      if (selectedSizes.length > 0) params.set('sizes', selectedSizes.join(','));
      if (inStockOnly) params.set('inStock', 'true');
      if (sortBy) params.set('sortBy', sortBy);

      const res = await fetch(`${apiUrl}/products?${params.toString()}`);
      const json = await res.json();

      // Discard stale responses if filter changed mid-flight
      if (currentSeq !== requestSeqRef.current) return;

      if (json.success && Array.isArray(json.data?.products)) {
        const newProducts = json.data.products;
        setTotalCount(json.data.pagination?.total ?? newProducts.length);
        setTotalPages(json.data.pagination?.totalPages || 1);

        if (pageToFetch === 1) {
          setRawDbProducts(newProducts);
        } else {
          setRawDbProducts((prev) => {
            const existingIds = new Set(prev.map((p) => String(p.id)));
            const filteredNew = newProducts.filter((p) => !existingIds.has(String(p.id)));
            return [...prev, ...filteredNew];
          });
        }
        setHasFetched(true);
      } else {
        if (pageToFetch === 1) {
          setRawDbProducts([]);
          setTotalCount(0);
          setTotalPages(1);
        }
        setHasFetched(true);
      }
    } catch {
      if (currentSeq === requestSeqRef.current) {
        if (pageToFetch === 1) {
          setRawDbProducts([]);
          setTotalCount(0);
          setTotalPages(1);
        }
        setHasFetched(true);
      }
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [
    activeCollection,
    debouncedSearch,
    selectedCategories,
    selectedSubcategories,
    selectedColors,
    selectedSizes,
    selectedRating,
    minPrice,
    maxPrice,
    selectedDiscount,
    inStockOnly,
    sortBy,
  ]);

  // Initial fetch and on filter changes reset to page 1
  useEffect(() => {
    setCurrentPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  // Load More Handler (button or automatic infinite scroll)
  const handleLoadMore = useCallback(() => {
    if (!loading && !loadingMore && currentPage < totalPages && rawDbProducts.length < totalCount) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchProducts(nextPage);
    }
  }, [loading, loadingMore, currentPage, totalPages, rawDbProducts.length, totalCount, fetchProducts]);

  // Infinite Scroll IntersectionObserver on bottom sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !loading && !loadingMore && currentPage < totalPages && rawDbProducts.length < totalCount) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '250px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [handleLoadMore, loading, loadingMore, currentPage, totalPages, rawDbProducts.length, totalCount]);

  // Transform DB products seamlessly - strictly using backend database results (never dummy fallback)
  const displayProducts = useMemo(() => {
    return rawDbProducts.map((p) => {
      const primaryImg =
        p.images?.find((img) => img.isPrimary)?.imageUrl ||
        p.images?.find((img) => img.isPrimary)?.url ||
        p.images?.[0]?.imageUrl ||
        p.images?.[0]?.url ||
        p.image ||
        '/images/storefront/prod-gold-rope.jpg';
      const catName = p.subcategory?.category?.name || 'Jewellery';
      const subName = p.subcategory?.name || '';
      
      const numPrice = Number(p.price) || 0;
      const numSale = p.salePrice !== undefined && p.salePrice !== null ? Number(p.salePrice) : numPrice;
      const hasDiscount = numSale < numPrice && numPrice > 0;
      const sellingPrice = hasDiscount ? numSale : numPrice;
      const originalPrice = hasDiscount ? numPrice : null;
      const discount = hasDiscount ? Math.round(((numPrice - numSale) / numPrice) * 100) : 0;

      const isBest = p.isBestSeller || (p.badge && p.badge.toUpperCase().includes('BEST'));
      let resolvedBadge = p.badge;
      if (activeCollection === 'best-sellers' || isBest) {
        resolvedBadge = 'BESTSELLER';
      } else if (activeCollection === 'new-arrivals') {
        resolvedBadge = (p.badge && p.badge.toUpperCase().includes('NEW')) ? p.badge : 'NEW ARRIVAL';
      } else if (activeCollection === 'offers' || (hasDiscount && discount > 0)) {
        resolvedBadge = hasDiscount && discount > 0 ? `${discount}% OFF` : (p.badge || 'SPECIAL OFFER');
      } else if (activeCollection === 'gifts') {
        resolvedBadge = p.badge || 'GIFT CHOICE';
      } else if (!resolvedBadge) {
        if (p.isFeatured) resolvedBadge = 'FEATURED';
      }

      const resolvedBadgeColor = (() => {
        const b = (resolvedBadge || '').toUpperCase();
        if (b.includes('EXCLUSIVE')) return '#059669';
        if (b.includes('TRENDING')) return '#DB2777';
        if (b.includes('GIFT')) return '#9333EA';
        if (b.includes('BEST')) return '#6D28D9';
        if (b.includes('NEW')) return '#4338CA';
        if (b.includes('HOT') || b.includes('DEAL') || b.includes('%') || b.includes('OFF')) return '#DC2626';
        if (b.includes('LIMITED')) return '#0284C7';
        return '#6D28D9';
      })();

      return {
        id: String(p.id),
        name: p.name,
        category: catName,
        subcategory: subName,
        price: sellingPrice,
        originalPrice: originalPrice,
        discount,
        rating: Number(p.rating || 4.8),
        reviews: p.reviewCount || 42,
        badge: resolvedBadge,
        badgeColor: resolvedBadgeColor,
        color: p.variants?.[0]?.color?.name || 'Gold',
        colorHex: p.variants?.[0]?.color?.hexCode || '#EAB308',
        size: p.variants?.[0]?.size?.name || 'Standard',
        inStock: (p.stock || 10) > 0,
        image: primaryImg,
        images: p.images && p.images.length > 0 ? p.images.map((img) => img.imageUrl || img.url) : [primaryImg],
        slug: p.slug || p.id,
      };
    });
  }, [rawDbProducts, activeCollection]);

  // Categories list for filters
  const filterCategories = useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        imageUrl: c.imageUrl,
        subcategories: c.subcategories || [],
      }));
    }
    return [
      { id: '1', name: 'Chains', slug: 'chains', subcategories: [{ name: 'Necklaces & Chains' }, { name: 'Bracelets' }] },
      { id: '2', name: 'Earrings', slug: 'earrings', subcategories: [{ name: 'Earrings & Studs' }, { name: 'Jhumkas' }] },
      { id: '3', name: 'Necklaces', slug: 'necklaces', subcategories: [{ name: 'Necklaces & Chains' }, { name: 'Chokers' }] },
      { id: '4', name: 'Bangles', slug: 'bangles', subcategories: [{ name: 'Bangles & Kadas' }] },
      { id: '5', name: 'Rings', slug: 'rings', subcategories: [{ name: 'Rings & Bands' }, { name: 'Solitaire Rings' }] },
      { id: '6', name: 'Teddy Bears', slug: 'teddy-bears', subcategories: [{ name: 'Classic Teddy Bears' }, { name: 'Giant Life-Size Bears' }] },
      { id: '7', name: 'Gifts & Hampers', slug: 'gifts', subcategories: [{ name: 'Celebration Hampers' }, { name: 'Combos' }] },
    ];
  }, [dbCategories]);

  // Colors list for filters
  const filterColors = useMemo(() => {
    if (dbColors.length > 0) {
      return dbColors.map((c) => ({ name: c.name, hex: c.hexCode || '#9333EA' }));
    }
    return [
      { name: 'Gold', hex: '#EAB308' },
      { name: 'Silver', hex: '#E2E8F0' },
      { name: 'Rose Gold', hex: '#FDA4AF' },
      { name: 'Purple', hex: '#9333EA' },
      { name: 'Black', hex: '#18181B' },
      { name: 'Pink', hex: '#F472B6' },
    ];
  }, [dbColors]);

  // Sizes list for filters
  const filterSizes = useMemo(() => {
    if (dbSizes.length > 0) {
      return dbSizes.map((s) => s.name || s.code);
    }
    return ['16 Inch', '18 Inch', '22 Inch', 'Size 7', '2.4', '2.6', '30 cm', '120 cm', 'Standard'];
  }, [dbSizes]);

  // Filter Handlers
  const handleCategoryToggle = (categoryName) => {
    setCurrentPage(1);
    setSelectedCategories((prev) =>
      prev.includes(categoryName) ? prev.filter((c) => c !== categoryName) : [...prev, categoryName]
    );
    scrollToCatalog();
  };

  const handleSubcategoryToggle = (subName) => {
    setCurrentPage(1);
    setSelectedSubcategories((prev) =>
      prev.includes(subName) ? prev.filter((s) => s !== subName) : [...prev, subName]
    );
    scrollToCatalog();
  };

  const handleColorToggle = (colorName) => {
    setCurrentPage(1);
    setSelectedColors((prev) =>
      prev.includes(colorName) ? prev.filter((c) => c !== colorName) : [...prev, colorName]
    );
    scrollToCatalog();
  };

  const handleSizeToggle = (sizeName) => {
    setCurrentPage(1);
    setSelectedSizes((prev) =>
      prev.includes(sizeName) ? prev.filter((s) => s !== sizeName) : [...prev, sizeName]
    );
    scrollToCatalog();
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setMinPrice(0);
    setMaxPrice(5000);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedRating(null);
    setSelectedDiscount(null);
    setInStockOnly(false);
    setSearchKeyword('');
    setCurrentPage(1);
    scrollToCatalog();
  };

  const toggleWishlist = (e, prod) => {
    e.preventDefault();
    e.stopPropagation();
    if (!customerUser) {
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname : '/products';
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }
    // 1. Instant 0ms synchronous UI toggle across all pages
    dispatch(optimisticToggle(prod));
    // 2. Database & auth sync
    dispatch(toggleWishlistProduct(prod));
  };

  const handleAddToCart = (e, prodOrId) => {
    e.preventDefault();
    e.stopPropagation();
    const prod =
      typeof prodOrId === 'object' && prodOrId !== null
        ? prodOrId
        : (filteredProducts?.find((p) => p.id === prodOrId) || products?.find((p) => p.id === prodOrId));

    if (!prod) return;

    const isInCart = Boolean(cartMap[prod.id] || (prod.slug && cartMap[prod.slug]));

    if (isInCart) {
      dispatch(removeFromCart(prod.id));
      dispatch(syncRemoveFromCart(prod.id));
    } else {
      const salePrice = prod.price || prod.salePrice || 999;
      dispatch(
        addToCart({
          productId: prod.id,
          productName: prod.name,
          slug: prod.slug,
          categoryName: prod.categoryName || prod.subcategory?.name || 'Jewellery',
          selectedSize: 'Standard',
          selectedColor: 'Gold',
          metaSubtitle: `${prod.categoryName || 'Jewellery'} | Standard`,
          imageUrl: prod.image || (Array.isArray(prod.images) && prod.images[0]?.imageUrl) || (Array.isArray(prod.images) && prod.images[0]) || '/images/storefront/cat-chains.jpg',
          badge: prod.badge,
          price: salePrice,
          mrp: prod.originalPrice || prod.mrp || salePrice * 1.5,
          discountPercent: prod.discountPercent || 0,
          quantity: 1,
          stock: prod.stock || 20,
          inStock: true,
        })
      );
      dispatch(syncAddToCart({ productId: prod.id, quantity: 1, priceSnapshot: salePrice }));
    }
  };
  // Active filter count
  const activeFilterCount =
    selectedCategories.length +
    selectedSubcategories.length +
    selectedColors.length +
    selectedSizes.length +
    (selectedRating ? 1 : 0) +
    (selectedDiscount ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (minPrice > 0 || maxPrice < 5000 ? 1 : 0) +
    (searchKeyword.trim() ? 1 : 0);

  // Reusable Filter Sidebar Content
  const renderSidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sidebar Header & Clear */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1.5px solid #F3E8FF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={18} color="#7E22CE" />
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#1E1B4B', margin: 0 }}>
            Filter Catalog
          </h2>
          {activeFilterCount > 0 && (
            <span
              style={{
                backgroundColor: '#7E22CE',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '10px',
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: '#DC2626',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: '#FEF2F2',
            }}
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* 1. Category & Subcategory Taxonomy Accordion */}
      <div style={{ borderBottom: '1px solid #FAF5FF', paddingBottom: '14px' }}>
        <button
          type="button"
          onClick={() => toggleAccordion('category')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginBottom: accordions.category ? '12px' : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderTree size={16} color="#7E22CE" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E1B4B' }}>Categories</span>
          </div>
          {accordions.category ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
        </button>

        {accordions.category && (
          <div className="filter-accordion-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
            {filterCategories.map((cat) => {
              const isCatChecked = selectedCategories.includes(cat.name);
              return (
                <div key={cat.id || cat.name} style={{ display: 'flex', flexDirection: 'column' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      backgroundColor: isCatChecked ? '#FAF5FF' : 'transparent',
                      border: isCatChecked ? '1px solid #E9D5FF' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={isCatChecked}
                        onChange={() => handleCategoryToggle(cat.name)}
                        style={{ accentColor: '#7E22CE', width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      {cat.imageUrl && (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #E9D5FF' }}
                        />
                      )}
                      <span style={{ fontSize: '13px', fontWeight: isCatChecked ? 700 : 500, color: isCatChecked ? '#7E22CE' : '#374151' }}>
                        {cat.name}
                      </span>
                    </div>
                  </label>

                  {/* Subcategories (if available) */}
                  {cat.subcategories?.length > 0 && (
                    <div className="filter-accordion-scroll" style={{ paddingLeft: '26px', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                      {cat.subcategories.map((sub) => {
                        const isSubChecked = selectedSubcategories.includes(sub.name);
                        return (
                          <label
                            key={sub.id || sub.name}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: isSubChecked ? '#7E22CE' : '#6B7280',
                              fontWeight: isSubChecked ? 700 : 400,
                              padding: '2px 4px',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSubChecked}
                              onChange={() => handleSubcategoryToggle(sub.name)}
                              style={{ accentColor: '#7E22CE', width: '13px', height: '13px', cursor: 'pointer' }}
                            />
                            <span>{sub.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Price Range Slider & Bounds */}
      <div style={{ borderBottom: '1px solid #FAF5FF', paddingBottom: '14px' }}>
        <button
          type="button"
          onClick={() => toggleAccordion('price')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginBottom: accordions.price ? '12px' : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={16} color="#7E22CE" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E1B4B' }}>Price Range</span>
          </div>
          {accordions.price ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
        </button>

        {accordions.price && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12.5px', fontWeight: 700, color: '#7E22CE' }}>
              <span>₹{minPrice}</span>
              <span>₹{maxPrice}</span>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(Number(e.target.value));
                setCurrentPage(1);
                scrollToCatalog();
              }}
              style={{ width: '100%', accentColor: '#7E22CE', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '2px' }}>MIN PRICE</span>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '12px', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '2px' }}>MAX PRICE</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '12px', outline: 'none' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Color Swatches Accordion - Structured 2-Column Grid */}
      <div style={{ borderBottom: '1px solid #FAF5FF', paddingBottom: '14px' }}>
        <button
          type="button"
          onClick={() => toggleAccordion('color')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginBottom: accordions.color ? '12px' : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette size={16} color="#7E22CE" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E1B4B' }}>Color Palette</span>
          </div>
          {accordions.color ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
        </button>

        {accordions.color && (
          <div
            className="filter-accordion-scroll"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '6px',
              maxHeight: '190px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {filterColors.map((col) => {
              const isSelected = selectedColors.includes(col.name);
              return (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => handleColorToggle(col.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '6px 8px',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? '#FAF5FF' : '#F9FAFB',
                    border: isSelected ? '1.5px solid #7E22CE' : '1px solid #E5E7EB',
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#7E22CE' : '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#F3E8FF';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: col.hex,
                      border: '1.5px solid rgba(0,0,0,0.18)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {col.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Sizes Accordion - Structured Responsive Badges */}
      <div style={{ borderBottom: '1px solid #FAF5FF', paddingBottom: '14px' }}>
        <button
          type="button"
          onClick={() => toggleAccordion('size')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginBottom: accordions.size ? '12px' : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ruler size={16} color="#7E22CE" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E1B4B' }}>Sizes & Dimensions</span>
          </div>
          {accordions.size ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
        </button>

        {accordions.size && (
          <div
            className="filter-accordion-scroll"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              maxHeight: '180px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {filterSizes.map((sz) => {
              const isSelected = selectedSizes.includes(sz);
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleSizeToggle(sz)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? '#7E22CE' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#374151',
                    border: isSelected ? '1.5px solid #7E22CE' : '1px solid #D1D5DB',
                    fontSize: '12px',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 8px rgba(126, 34, 206, 0.25)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#C084FC';
                      e.currentTarget.style.backgroundColor = '#FAF5FF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#D1D5DB';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }
                  }}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Discount / Offers Accordion */}
      <div style={{ borderBottom: '1px solid #FAF5FF', paddingBottom: '14px' }}>
        <button
          type="button"
          onClick={() => toggleAccordion('discount')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginBottom: accordions.discount ? '12px' : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={16} color="#7E22CE" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E1B4B' }}>Discounts & Offers</span>
          </div>
          {accordions.discount ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
        </button>

        {accordions.discount && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {DEFAULT_DISCOUNT_OPTIONS.map((opt) => {
              const isSelected = selectedDiscount === opt.min;
              return (
                <div
                  key={opt.min}
                  onClick={() => handleDiscountToggle(opt.min)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 8px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? '#FAF5FF' : 'transparent',
                    border: isSelected ? '1px solid #E9D5FF' : '1px solid transparent',
                    fontSize: '12.5px',
                    color: isSelected ? '#7E22CE' : '#374151',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    checked={isSelected}
                    onChange={() => handleDiscountToggle(opt.min)}
                    style={{ accentColor: '#7E22CE', cursor: 'pointer', pointerEvents: 'none' }}
                  />
                  <span>{opt.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Stock Availability */}
      <div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: '10px',
            backgroundColor: inStockOnly ? '#FAF5FF' : '#F9FAFB',
            border: inStockOnly ? '1.5px solid #C084FC' : '1px solid #E5E7EB',
            cursor: 'pointer',
          }}
        >
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E1B4B' }}>In Stock Only</span>
            <div style={{ fontSize: '11px', color: '#6B7280' }}>Hide items currently out of stock</div>
          </div>
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              setInStockOnly(e.target.checked);
              setCurrentPage(1);
              scrollToCatalog();
            }}
            style={{ accentColor: '#7E22CE', width: '16px', height: '16px', cursor: 'pointer' }}
          />
        </label>
      </div>
    </div>
  );

  const getCollectionTitle = () => {
    if (activeCollection === 'new-arrivals') return '✨ New Arrivals Collection';
    if (activeCollection === 'best-sellers') return '🔥 Best Sellers & Top Rated';
    if (activeCollection === 'offers' || activeCollection === 'special-offers') return '🏷️ Special Offers & Deals';
    if (activeCollection === 'gifts' || activeCollection === 'gift-cards') return '🎁 Gift Items & Hampers';
    return 'Explore All Products';
  };

  const getCollectionLabel = () => {
    if (activeCollection === 'new-arrivals') return 'New Arrivals';
    if (activeCollection === 'best-sellers') return 'Best Sellers';
    if (activeCollection === 'offers' || activeCollection === 'special-offers') return 'Special Offers';
    if (activeCollection === 'gifts' || activeCollection === 'gift-cards') return 'Gift Items';
    return activeCollection;
  };

  return (
    <div id="catalog-products-section" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Top Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1E1B4B', margin: 0 }}>
              {getCollectionTitle()}
            </h1>
            {activeCollection && (
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: '#FDF2F8',
                  border: '1px solid #FBCFE8',
                  color: '#DB2777',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Collection: {getCollectionLabel()}</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCollection(null);
                    scrollToCatalog();
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DB2777', padding: 0 }}
                  title="Clear collection filter"
                >
                  <X size={13} />
                </button>
              </span>
            )}
            {selectedCategories.length > 0 && (
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: '#FAF5FF',
                  border: '1px solid #E9D5FF',
                  color: '#7E22CE',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Category: {selectedCategories.join(', ')}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategories([]);
                    scrollToCatalog();
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7E22CE', padding: 0 }}
                  title="Clear category filter"
                >
                  <X size={13} />
                </button>
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '3px 0 0 0' }}>
            Handcrafted luxury jewellery, precious ornaments & gift hampers ({totalCount || displayProducts.length} items)
          </p>
        </div>

        {/* Search input, Category Modal & Sort Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* View All Categories Modal Button */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: '#FAF5FF',
              border: '1.5px solid #C084FC',
              color: '#7E22CE',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#7E22CE';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FAF5FF';
              e.currentTarget.style.color = '#7E22CE';
            }}
          >
            <Sparkles size={14} />
            <span>All Categories</span>
          </button>

          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#9CA3AF' }} />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setDebouncedSearch(searchKeyword.trim());
                  setCurrentPage(1);
                  scrollToCatalog();
                }
              }}
              placeholder="Search in products..."
              style={{
                width: '100%',
                padding: '8px 30px 8px 36px',
                borderRadius: '10px',
                border: '1.5px solid #E9D5FF',
                backgroundColor: '#FAF5FF',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword('');
                  setDebouncedSearch('');
                  setCurrentPage(1);
                  scrollToCatalog();
                }}
                style={{ position: 'absolute', right: '10px', top: '9px', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
              scrollToCatalog();
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1.5px solid #E9D5FF',
              backgroundColor: '#FAF5FF',
              color: '#2E1065',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="recommended">Recommended</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="discount">Highest Discount</option>
            <option value="newest">Newest First</option>
          </select>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                padding: '7px 10px',
                backgroundColor: viewMode === 'grid' ? '#FAF5FF' : '#ffffff',
                color: viewMode === 'grid' ? '#7E22CE' : '#9CA3AF',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '7px 10px',
                backgroundColor: viewMode === 'list' ? '#FAF5FF' : '#ffffff',
                color: viewMode === 'list' ? '#7E22CE' : '#9CA3AF',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <List size={16} />
            </button>
          </div>

          {/* Mobile Filter Trigger */}
          <button
            type="button"
            className="mobile-filter-btn"
            onClick={() => setMobileFilterOpen(true)}
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: '#7E22CE',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={15} />
            <span>Filters ({activeFilterCount})</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Active Filters:</span>
          {selectedCategories.map((c) => (
            <span
              key={c}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '16px',
                backgroundColor: '#FAF5FF',
                border: '1px solid #C084FC',
                color: '#7E22CE',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {c}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleCategoryToggle(c)} />
            </span>
          ))}
          {selectedSubcategories.map((s) => (
            <span
              key={s}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '16px',
                backgroundColor: '#FAF5FF',
                border: '1px solid #C084FC',
                color: '#7E22CE',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {s}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleSubcategoryToggle(s)} />
            </span>
          ))}
          {selectedColors.map((c) => (
            <span
              key={c}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '16px',
                backgroundColor: '#FAF5FF',
                border: '1px solid #C084FC',
                color: '#7E22CE',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {c}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleColorToggle(c)} />
            </span>
          ))}
          {selectedSizes.map((sz) => (
            <span
              key={sz}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '16px',
                backgroundColor: '#FAF5FF',
                border: '1px solid #C084FC',
                color: '#7E22CE',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {sz}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleSizeToggle(sz)} />
            </span>
          ))}
          {selectedDiscount && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '16px',
                backgroundColor: '#FAF5FF',
                border: '1px solid #C084FC',
                color: '#7E22CE',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {selectedDiscount}%+ Off
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedDiscount(null)} />
            </span>
          )}
          {inStockOnly && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '16px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#047857',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              In Stock Only
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setInStockOnly(false)} />
            </span>
          )}
          <button
            type="button"
            onClick={handleClearAll}
            style={{
              background: 'none',
              border: 'none',
              color: '#DC2626',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Main Catalog Layout */}
      <div className="catalog-layout-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '30px' }}>
        {/* Desktop Filter Sidebar */}
        <aside
          className="catalog-sidebar"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #E9D5FF',
            padding: '20px',
            height: 'fit-content',
            boxShadow: '0 4px 6px rgba(107, 33, 168, 0.03)',
          }}
        >
          {renderSidebarContent()}
        </aside>

        {/* Mobile Filter Drawer */}
        {mobileFilterOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              style={{
                width: '85%',
                maxWidth: '340px',
                height: '100%',
                backgroundColor: '#ffffff',
                padding: '24px 20px',
                overflowY: 'auto',
                boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={22} color="#374151" />
                </button>
              </div>
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* Products Grid / Results Area */}
        <main>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#7E22CE' }}>
              <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading latest products...</div>
            </div>
          ) : displayProducts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 20px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #E9D5FF',
              }}
            >
              <Search size={40} color="#C084FC" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1E1B4B', margin: '0 0 6px 0' }}>
                No Products Found
              </h3>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 18px 0' }}>
                Try adjusting your selected category, price slider, or keyword filter.
              </p>
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#7E22CE',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div
              className="products-catalog-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '20px',
              }}
            >
              {displayProducts.map((prod) => {
                const isWishlisted = Boolean(likedMap[String(prod.id)] || likedMap[String(prod.productId)]);
                const isAdded = Boolean(cartMap[prod.id] || (prod.slug && cartMap[prod.slug]));

                return (
                  <div
                    key={prod.id}
                    className="product-card-wrap"
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #F3E8FF',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 4px rgba(107, 33, 168, 0.03)',
                      position: 'relative',
                    }}
                  >
                    {/* Badge */}
                    {prod.badge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          backgroundColor: prod.badgeColor || '#7E22CE',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          zIndex: 2,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {prod.badge}
                      </span>
                    )}

                    {/* 1-Click Wishlist / Interest Button */}
                    <button
                      type="button"
                      onClick={(e) => toggleWishlist(e, prod)}
                      aria-label="Save to Wishlist & Interests"
                      title={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: isWishlisted ? '#FEF2F2' : '#ffffff',
                        border: isWishlisted ? '1.5px solid #FECACA' : '1px solid #F3E8FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 2,
                        boxShadow: isWishlisted ? '0 3px 10px rgba(220, 38, 38, 0.18)' : '0 2px 6px rgba(0,0,0,0.08)',
                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transform: isWishlisted ? 'scale(1.08)' : 'scale(1)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.18)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = isWishlisted ? 'scale(1.08)' : 'scale(1)')}
                    >
                      <Heart
                        size={16}
                        fill={isWishlisted ? '#DC2626' : 'none'}
                        color={isWishlisted ? '#DC2626' : '#6B7280'}
                        style={{ transition: 'all 0.2s ease' }}
                      />
                    </button>

                    {/* Image */}
                    <Link
                      href={`/products/${prod.slug}`}
                      style={{
                        display: 'block',
                        position: 'relative',
                        aspectRatio: '1 / 1',
                        backgroundColor: '#FAF5FF',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={prod.image}
                        alt={prod.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                        }}
                        className="catalog-product-img"
                      />
                    </Link>

                    {/* Details */}
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#7E22CE',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        {prod.category}
                      </div>

                      <Link
                        href={`/products/${prod.slug}`}
                        style={{
                          textDecoration: 'none',
                          color: '#1E1B4B',
                          fontSize: '14px',
                          fontWeight: 700,
                          lineHeight: 1.3,
                          marginBottom: '8px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          height: '36px',
                        }}
                      >
                        {prod.name}
                      </Link>

                      {/* Rating */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', color: '#F59E0B' }}>
                          <Star size={12} fill="#F59E0B" />
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1E1B4B' }}>{prod.rating}</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>({prod.reviews})</span>
                      </div>

                      {/* Price & Add to Cart */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 'auto',
                          paddingTop: '8px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E1B4B' }}>₹{prod.price}</span>
                            {prod.originalPrice && prod.originalPrice > prod.price && (
                              <span style={{ fontSize: '11px', color: '#9CA3AF', textDecoration: 'line-through' }}>
                                ₹{prod.originalPrice}
                              </span>
                            )}
                            {prod.discount > 0 && prod.originalPrice && prod.originalPrice > prod.price && (
                              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#16A34A', backgroundColor: '#F0FDF4', padding: '1px 5px', borderRadius: '4px' }}>
                                {prod.discount}% OFF
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleAddToCart(e, prod)}
                          title={isAdded ? 'In Cart - Click to remove' : 'Add to Cart'}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            backgroundColor: isAdded ? '#059669' : '#7E22CE',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s ease',
                            boxShadow: isAdded ? '0 2px 8px rgba(5, 150, 105, 0.25)' : '0 2px 8px rgba(126, 34, 206, 0.25)',
                          }}
                        >
                          {isAdded ? (
                            <>
                              <Check size={13} />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart size={13} />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {displayProducts.map((prod) => {
                const isWishlisted = Boolean(likedMap[String(prod.id)] || likedMap[String(prod.productId)]);
                const isAdded = Boolean(cartMap[prod.id] || (prod.slug && cartMap[prod.slug]));

                return (
                  <div
                    key={prod.id}
                    style={{
                      display: 'flex',
                      gap: '18px',
                      padding: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1.5px solid #F3E8FF',
                      alignItems: 'center',
                      boxShadow: '0 2px 4px rgba(107, 33, 168, 0.03)',
                    }}
                  >
                    <Link
                      href={`/products/${prod.slug}`}
                      style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: '#FAF5FF',
                      }}
                    >
                      <img src={prod.image} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Link>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#7E22CE', fontWeight: 700, textTransform: 'uppercase' }}>
                        {prod.category} {prod.subcategory ? `• ${prod.subcategory}` : ''}
                      </div>
                      <Link
                        href={`/products/${prod.slug}`}
                        style={{ fontSize: '15px', fontWeight: 700, color: '#1E1B4B', textDecoration: 'none', margin: '2px 0 6px 0', display: 'block' }}
                      >
                        {prod.name}
                      </Link>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#1E1B4B' }}>₹{prod.price}</span>
                        {prod.originalPrice > prod.price && (
                          <span style={{ fontSize: '12px', color: '#9CA3AF', textDecoration: 'line-through' }}>
                            ₹{prod.originalPrice}
                          </span>
                        )}
                        {prod.discount > 0 && prod.originalPrice && prod.originalPrice > prod.price && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '2px 6px', borderRadius: '4px' }}>
                            {prod.discount}% OFF
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(e, prod)}
                        title={isAdded ? 'In Cart - Click to remove' : 'Add to Cart'}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          backgroundColor: isAdded ? '#059669' : '#7E22CE',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: isAdded ? '0 2px 8px rgba(5, 150, 105, 0.25)' : '0 2px 8px rgba(126, 34, 206, 0.25)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isAdded ? <Check size={14} /> : <ShoppingCart size={14} />}
                        <span>{isAdded ? 'Added' : 'Add to Cart'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => toggleWishlist(e, prod)}
                        title={isWishlisted ? 'Remove from Interests' : 'Save to Interests'}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          backgroundColor: isWishlisted ? '#FEF2F2' : '#FAF5FF',
                          border: `1px solid ${isWishlisted ? '#FECACA' : '#E9D5FF'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: isWishlisted ? '#DC2626' : '#7E22CE',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Heart size={16} fill={isWishlisted ? '#DC2626' : 'none'} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite Scroll Bottom Controls, Show More Button & Completion Status */}
          {totalCount > 0 && (
            <div
              style={{
                marginTop: '40px',
                paddingTop: '20px',
                borderTop: '1px solid #F3F4F6',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* Progress Count Summary */}
              <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 600, textAlign: 'center' }}>
                Showing{' '}
                <b style={{ color: '#1E1B4B' }}>
                  {Math.min(displayProducts.length, totalCount)}
                </b>{' '}
                of <b style={{ color: '#7E22CE' }}>{totalCount}</b> exquisite products
                {/* Progress bar line */}
                <div
                  style={{
                    width: '240px',
                    height: '5px',
                    backgroundColor: '#EDE9FE',
                    borderRadius: '999px',
                    margin: '8px auto 0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round((displayProducts.length / Math.max(1, totalCount)) * 100))}%`,
                      backgroundColor: '#7E22CE',
                      borderRadius: '999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Show More Products Button (30 more) */}
              {displayProducts.length < totalCount && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', margin: '12px 0 8px' }}>
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={handleLoadMore}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '13px 34px',
                      backgroundColor: '#7E22CE',
                      color: '#FFFFFF',
                      borderRadius: '999px',
                      border: 'none',
                      fontSize: '13.5px',
                      fontWeight: 800,
                      cursor: loadingMore ? 'wait' : 'pointer',
                      boxShadow: '0 6px 20px rgba(126, 34, 206, 0.25)',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={(e) => {
                      if (!loadingMore) {
                        e.currentTarget.style.backgroundColor = '#6B21A8';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 24px rgba(126, 34, 206, 0.35)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loadingMore) {
                        e.currentTarget.style.backgroundColor = '#7E22CE';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(126, 34, 206, 0.25)';
                      }
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        <span>Loading 30 More Products...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>Show More Products (+30)</span>
                      </>
                    )}
                  </button>
                  <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>
                    💡 Automatically loads when scrolling to the bottom
                  </span>
                </div>
              )}

              {/* Sentinel element for infinite scroll observer */}
              <div ref={sentinelRef} style={{ height: '20px', width: '100%', pointerEvents: 'none' }} />

              {/* Completion Banner */}
              {hasFetched && displayProducts.length >= totalCount && totalCount > 0 && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 20px',
                    borderRadius: '999px',
                    backgroundColor: '#FAF5FF',
                    border: '1.5px solid #E9D5FF',
                    color: '#7E22CE',
                    fontWeight: 700,
                    fontSize: '13px',
                    marginTop: '8px',
                  }}
                >
                  <Sparkles size={14} color="#9333EA" />
                  <span>You&apos;ve viewed all {totalCount} products in this collection</span>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Category Grid Modal for Direct Category Filtering (Pure categories with images) */}
      <CategoryGridModal
        isOpen={isCategoryModalOpen || isCategoryModalOpenExternal}
        onClose={() => {
          setIsCategoryModalOpen(false);
          if (onCategoryModalClose) onCategoryModalClose();
        }}
        categories={dbCategories}
        selectedCategory={selectedCategories[0] || null}
        onSelectCategory={handleSelectCategoryFromModal}
      />

      <style jsx global>{`
        .filter-accordion-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .filter-accordion-scroll::-webkit-scrollbar-track {
          background: #FAF5FF;
          border-radius: 4px;
        }
        .filter-accordion-scroll::-webkit-scrollbar-thumb {
          background: #D8B4FE;
          border-radius: 4px;
        }
        .filter-accordion-scroll::-webkit-scrollbar-thumb:hover {
          background: #A855F7;
        }
        :global(.product-card-wrap:hover) {
          transform: translateY(-4px);
          border-color: #C084FC !important;
          box-shadow: 0 12px 24px rgba(126, 34, 206, 0.1) !important;
        }
        :global(.product-card-wrap:hover .prod-card-img) {
          transform: scale(1.06);
        }
        @media (max-width: 1200px) {
          .products-catalog-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 900px) {
          .catalog-layout-grid {
            grid-template-columns: 1fr !important;
          }
          .catalog-sidebar {
            display: none !important;
          }
          .mobile-filter-btn {
            display: inline-flex !important;
          }
          .products-catalog-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 540px) {
          .products-catalog-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}

