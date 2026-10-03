'use client';

import { API_BASE_URL } from '@/lib/api/url';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, ChevronDown, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import AllCategoriesModal from './AllCategoriesModal';

const DEFAULT_FALLBACK_CATEGORIES = [
  { name: 'Chains', slug: 'chains' },
  { name: 'Earrings', slug: 'earrings' },
  { name: 'Necklaces', slug: 'necklaces' },
  { name: 'Bangles', slug: 'bangles' },
  { name: 'Teddy Bears', slug: 'teddy-bears' },
  { name: 'Gifts', slug: 'gifts' },
];

export default function CategoryNav() {
  const pathname = usePathname();
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const scrollContainerRef = useRef(null);

  // Fetch active categories from backend
  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const apiUrl = API_BASE_URL;
        const res = await fetch(`${apiUrl}/categories`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.categories) && isMounted) {
          setCategories(json.data.categories);
        }
      } catch (err) {
        console.warn('Could not fetch storefront categories, using fallback:', err.message);
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute dynamic navigation items:
  // [Home, New Arrivals, Best Sellers] + [Featured Categories from Admin]
  const navLinks = useMemo(() => {
    const fixedPrefix = [
      { label: 'Home', href: '/' },
      { label: 'New Arrivals', href: '/new-arrivals' },
      { label: 'Best Sellers', href: '/best-sellers' },
    ];

    const featured = categories.filter((c) => c.isActive && c.isFeatured);

    let middleItems = [];
    if (featured.length > 0) {
      middleItems = featured.map((cat) => ({
        label: cat.name,
        href: `/category/${cat.slug}`,
        id: cat.id,
      }));
    } else if (categories.length > 0) {
      // If none explicitly marked as featured, display top 6 active categories
      middleItems = categories.slice(0, 6).map((cat) => ({
        label: cat.name,
        href: `/category/${cat.slug}`,
        id: cat.id,
      }));
    } else {
      // Default fallback
      middleItems = DEFAULT_FALLBACK_CATEGORIES.map((cat) => ({
        label: cat.name,
        href: `/category/${cat.slug}`,
      }));
    }

    return [...fixedPrefix, ...middleItems];
  }, [categories]);

  return (
    <>
      <nav
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #F0ECF8',
          userSelect: 'none',
          position: 'relative',
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: '1420px',
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            height: '50px',
            gap: '20px',
          }}
        >
          {/* All Categories Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            aria-label="Open All Categories Menu"
            className="category-nav-all-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #7E22CE 0%, #6D28D9 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(109, 40, 217, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #6D28D9 0%, #581C87 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #7E22CE 0%, #6D28D9 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Menu size={16} strokeWidth={2.4} className="category-nav-menu-icon" />
            <span>All Categories</span>
            <ChevronDown size={14} />
          </button>

          {/* Navigation Items Wrapper with Clean Native Horizontal Scroll */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {/* Scrollable Nav Links */}
            <div
              ref={scrollContainerRef}
              className="category-nav-scroll"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '22px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                flex: 1,
                scrollBehavior: 'smooth',
                padding: '0 4px',
              }}
            >
              {navLinks.map((item, idx) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                return (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    style={{
                      fontSize: '13.5px',
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#6D28D9' : '#374151',
                      textDecoration: 'none',
                      padding: '6px 2px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0,
                      transition: 'color 0.15s ease',
                      borderBottom: isActive
                        ? '2px solid #6D28D9'
                        : '2px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = '#6D28D9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = '#374151';
                      }
                    }}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <style jsx global>{`
          .category-nav-scroll::-webkit-scrollbar {
            display: none;
          }
          @media (max-width: 640px) {
            .category-nav-menu-icon {
              display: none !important;
            }
            .category-nav-all-btn {
              padding: 6px 10px !important;
              font-size: 12px !important;
              gap: 4px !important;
            }
          }
        `}</style>
      </nav>

      {/* All Categories & Subcategories Modal */}
      <AllCategoriesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
      />
    </>
  );
}
