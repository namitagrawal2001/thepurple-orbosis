'use client';

import { API_BASE_URL } from '@/lib/api/url';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import AllCategoriesModal from '../layout/AllCategoriesModal';

const DEFAULT_CATEGORY_DATA = [
  {
    id: 'chains',
    name: 'Chains',
    slug: 'chains',
    image: '/images/storefront/cat-chains.jpg',
  },
  {
    id: 'earrings',
    name: 'Earrings',
    slug: 'earrings',
    image: '/images/storefront/cat-earrings.jpg',
  },
  {
    id: 'necklaces',
    name: 'Necklaces',
    slug: 'necklaces',
    image: '/images/storefront/cat-necklaces.jpg',
  },
  {
    id: 'bangles',
    name: 'Bangles',
    slug: 'bangles',
    image: '/images/storefront/cat-bangles.jpg',
  },
  {
    id: 'rings',
    name: 'Rings',
    slug: 'rings',
    image: '/images/storefront/cat-rings.jpg',
  },
  {
    id: 'teddy-bears',
    name: 'Teddy Bears',
    slug: 'teddy-bears',
    image: '/images/storefront/cat-teddy.jpg',
  },
  {
    id: 'gifts',
    name: 'Gifts & Hampers',
    slug: 'gifts',
    image: '/images/storefront/hero-gifts.jpg',
  },
];

export default function FeaturedCategories() {
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sliderRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Fetch live categories from backend API
  useEffect(() => {
    let isMounted = true;
    async function fetchStoreCategories() {
      try {
        const apiUrl = API_BASE_URL;
        const res = await fetch(`${apiUrl}/categories`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.categories) && isMounted) {
          setCategories(json.data.categories);
        }
      } catch {
        // Fallback to default categories
      }
    }
    fetchStoreCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute featured category cards (matching 6 visible boxes with slider)
  const displayCategories = useMemo(() => {
    const featured = categories.filter((c) => c.isActive && c.isFeatured);

    if (featured.length > 0) {
      return featured.map((cat, idx) => {
        // Match with default image if cat imageUrl not set
        const defaultMatch = DEFAULT_CATEGORY_DATA.find(
          (d) => d.slug === cat.slug || cat.name.toLowerCase().includes(d.name.toLowerCase())
        );
        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          image: cat.imageUrl || defaultMatch?.image || DEFAULT_CATEGORY_DATA[idx % DEFAULT_CATEGORY_DATA.length].image,
        };
      });
    }

    if (categories.length > 0) {
      return categories.map((cat, idx) => {
        const defaultMatch = DEFAULT_CATEGORY_DATA.find(
          (d) => d.slug === cat.slug || cat.name.toLowerCase().includes(d.name.toLowerCase())
        );
        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          image: cat.imageUrl || defaultMatch?.image || DEFAULT_CATEGORY_DATA[idx % DEFAULT_CATEGORY_DATA.length].image,
        };
      });
    }

    return DEFAULT_CATEGORY_DATA;
  }, [categories]);

  // Scroll checking
  const checkScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [displayCategories]);

  const handleScroll = (direction) => {
    const el = sliderRef.current;
    if (!el) return;
    const scrollAmount = direction === 'left' ? -260 : 260;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <section
      style={{
        maxWidth: '1420px',
        margin: '20px auto 28px auto',
        padding: '0 20px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header with Title and View All */}
      <div
        className="featured-cat-header"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: '20px',
          gap: '12px',
        }}
      >
        <div className="featured-cat-header-text">
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#18181B',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
              fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
            }}
          >
            Shop By Category
          </h2>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#6B7280' }}>
            Explore our most-loved collections
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#6D28D9',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#581C87')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6D28D9')}
        >
          <span>View All Categories</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Categories Slider Container */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScroll('left')}
            aria-label="Scroll left categories"
            className="featured-cat-arrow"
            style={{
              position: 'absolute',
              left: '-14px',
              zIndex: 10,
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(109, 40, 217, 0.18)',
              border: '1px solid #E9D5FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#7E22CE',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#7E22CE';
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.color = '#7E22CE';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>
        )}

        {/* Categories Row / Slider (Exactly 6 visible on desktop) */}
        <div
          ref={sliderRef}
          onScroll={checkScroll}
          className="featured-cat-slider"
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: '16px',
            overflowX: 'auto',
            scrollBehavior: 'smooth',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            width: '100%',
            padding: '6px 4px 12px',
            boxSizing: 'border-box',
          }}
        >
          {displayCategories.map((cat, idx) => (
            <Link
              key={cat.id || idx}
              href={`/category/${cat.slug}`}
              className="featured-cat-card"
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                padding: '18px 12px 20px',
                border: '1px solid #F0ECF8',
                boxShadow: '0 2px 8px rgba(109, 40, 217, 0.04)',
                boxSizing: 'border-box',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                cursor: 'pointer',
              }}
            >
              {/* Circular Product Image Container */}
              <div
                className="featured-cat-img-wrapper"
                style={{
                  width: '108px',
                  height: '108px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '4px auto 14px',
                  border: '2.5px solid #F3ECFF',
                  boxShadow: '0 4px 14px rgba(109, 40, 217, 0.08)',
                  backgroundColor: '#FAF5FF',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.35s ease',
                  }}
                />
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#18181B',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
                }}
              >
                {cat.name}
              </div>
            </Link>
          ))}
        </div>

        {/* Right Arrow Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScroll('right')}
            aria-label="Scroll right categories"
            className="featured-cat-arrow"
            style={{
              position: 'absolute',
              right: '-14px',
              zIndex: 10,
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(109, 40, 217, 0.18)',
              border: '1px solid #E9D5FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#7E22CE',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#7E22CE';
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.color = '#7E22CE';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <ChevronRight size={20} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* All Categories Modal Integration */}
      <AllCategoriesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
      />

      <style jsx>{`
        .featured-cat-slider::-webkit-scrollbar {
          display: none;
        }
        :global(.featured-cat-card) {
          /* Exactly 6 visible boxes per view on large desktop */
          flex: 0 0 calc((100% - 5 * 16px) / 6);
          min-width: 175px;
        }
        :global(.featured-cat-card:hover) {
          transform: translateY(-5px);
          border-color: #C084FC !important;
          box-shadow: 0 14px 28px rgba(126, 34, 206, 0.12) !important;
        }
        :global(.featured-cat-card:hover img) {
          transform: scale(1.08);
        }
        @media (max-width: 1200px) {
          :global(.featured-cat-card) {
            flex: 0 0 calc((100% - 4 * 14px) / 5);
            min-width: 160px;
          }
        }
        @media (max-width: 992px) {
          :global(.featured-cat-card) {
            flex: 0 0 calc((100% - 3 * 12px) / 4);
            min-width: 145px;
          }
        }
        @media (max-width: 768px) {
          :global(.featured-cat-arrow) {
            display: none !important;
          }
          :global(.featured-cat-card) {
            flex: 0 0 calc((100% - 2 * 10px) / 3.2);
            min-width: 130px;
            padding: 14px 8px 16px !important;
          }
          :global(.featured-cat-img-wrapper) {
            width: 86px !important;
            height: 86px !important;
          }
        }
        @media (max-width: 640px) {
          .featured-cat-header {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 10px !important;
          }
          .featured-cat-header-text {
            text-align: center !important;
          }
        }
        @media (max-width: 500px) {
          :global(.featured-cat-card) {
            flex: 0 0 calc((100% - 10px) / 2.35);
            min-width: 122px;
            padding: 12px 6px 14px !important;
          }
          :global(.featured-cat-img-wrapper) {
            width: 76px !important;
            height: 76px !important;
          }
        }
      `}</style>
    </section>
  );
}
