'use client';

import { API_BASE_URL } from '@/lib/api/url';
import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import MainHeader from '@/components/layout/MainHeader';
import ProductsPageCarousel from '@/components/products/ProductsPageCarousel';
import ProductsCategoryBar from '@/components/products/ProductsCategoryBar';
import CategoryGridModal from '@/components/products/CategoryGridModal';
import AllProductsCatalog from '@/components/products/AllProductsCatalog';
import Footer from '@/components/layout/Footer';

function slugToName(slug) {
  if (!slug) return null;
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function CategoryPage({ params }) {
  const routeParams = useParams();
  const slug = routeParams?.slug || params?.slug || '';
  const initialCategoryName = slugToName(slug);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategoryName);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const apiUrl = API_BASE_URL;
        const res = await fetch(`${apiUrl}/categories`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.categories) && isMounted) {
          setCategories(json.data.categories);
          // Match slug to exact category name if exists
          const matched = json.data.categories.find(
            (c) => c.slug === slug || c.name.toLowerCase() === slug.replace(/-/g, ' ').toLowerCase()
          );
          if (matched) {
            setSelectedCategory(matched.name);
          }
        }
      } catch {
        // Fallback
      }
    }
    loadCategories();

    // Auto-scroll directly to catalog section
    const scrollTimer = setTimeout(() => {
      const catalogEl = document.getElementById('catalog-products-section');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(scrollTimer);
    };
  }, [slug]);

  const handleSelectCategory = (catName) => {
    setSelectedCategory(catName);
    const catalogEl = document.getElementById('catalog-products-section');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#FCFBFE',
      }}
    >
      <AnnouncementBar />
      <MainHeader />

      <main style={{ flex: 1 }}>
        <ProductsPageCarousel
          onOpenCategoryModal={() => setIsCatModalOpen(true)}
          onSelectCategory={handleSelectCategory}
        />

        <ProductsCategoryBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          onOpenAllCategoriesModal={() => setIsCatModalOpen(true)}
        />

        <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center', color: '#7E22CE' }}>Loading products catalog...</div>}>
          <AllProductsCatalog
            initialCategory={selectedCategory}
            isCategoryModalOpenExternal={isCatModalOpen}
            onCategoryModalClose={() => setIsCatModalOpen(false)}
          />
        </Suspense>
      </main>

      <CategoryGridModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
      />

      <Footer />
    </div>
  );
}
