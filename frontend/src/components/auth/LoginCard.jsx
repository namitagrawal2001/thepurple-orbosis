"use client";

import Link from 'next/link';
import { ShoppingBag, Heart, Bell, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

export default function LoginCard({ onGoogleLogin, loading, error, googleLoginEnabled = true }) {
  return (
    <div
      className="login-glass-card"
      style={{
        position: 'relative',
        zIndex: 20,
        width: '100%',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.48) 0%, rgba(255, 255, 255, 0.28) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1.5px solid rgba(255, 255, 255, 0.85)',
        borderRadius: '36px',
        padding: '42px 32px 30px 32px',
        boxShadow:
          '0 0 45px 2px rgba(255, 255, 255, 0.85), 0 20px 60px rgba(109, 40, 217, 0.12), inset 0 1.5px 3px rgba(255, 255, 255, 0.95)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--purple-accent, #7C3AED)',
          marginBottom: '8px',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 1.6l1.55 7.1L21 12l-7.45 3.3L12 22.4l-1.55-7.1L3 12l7.45-3.3L12 1.6z"
            fill="#7C3AED"
          />
        </svg>
      </div>

      <div
        style={{
          fontSize: '15px',
          fontWeight: 500,
          color: 'var(--secondary-text, #5F5A6B)',
          fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)",
        }}
      >
        Welcome to
      </div>

      <div style={{ marginBottom: '14px', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)",
            fontSize: '2.15rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--primary-text, #18181B)',
          }}
        >
          the
        </span>
        <span
          style={{
            fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)",
            fontSize: '2.15rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--primary-purple, #6D28D9)',
          }}
        >
          purple
        </span>
      </div>

      <p
        style={{
          fontSize: '13px',
          lineHeight: '1.55',
          color: 'var(--secondary-text, #5F5A6B)',
          margin: '0 0 26px 0',
          maxWidth: '320px',
          fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
        }}
      >
        Sign in with your Google account to continue shopping, saving your favourites, and more.
      </p>

      {error && (
        <div
          style={{
            width: '100%',
            padding: '10px 14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            color: '#DC2626',
            fontSize: '12px',
            fontWeight: 500,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left',
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        disabled={loading || !googleLoginEnabled}
        onClick={onGoogleLogin}
        style={{
          width: '100%',
          height: '52px',
          borderRadius: '999px',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(232, 225, 245, 0.9)',
          boxShadow: '0 8px 24px rgba(24, 24, 27, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 28px rgba(109, 40, 217, 0.16)';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(24, 24, 27, 0.08)';
          }
        }}
      >
        <div style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center' }}>
          {loading ? (
            <Loader2 size={20} style={{ color: 'var(--primary-purple, #6D28D9)', animation: 'spin 1s linear infinite' }} />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          )}
        </div>

        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--primary-text, #18181B)',
            letterSpacing: '-0.01em',
            fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
          }}
        >
          {loading ? 'Signing you in...' : googleLoginEnabled ? 'Continue with Google' : 'Google sign-in unavailable'}
        </span>

        <div style={{ width: '22px', display: 'flex', justifyContent: 'flex-end', color: 'var(--muted-text, #8B8795)' }}>
          <ChevronRight size={17} />
        </div>
      </button>

      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '26px 0 22px 0',
        }}
      >
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(232, 225, 245, 0.9)' }} />
        <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted-text, #8B8795)', letterSpacing: '0.14em' }}>
          OR
        </span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(232, 225, 245, 0.9)' }} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '10px',
          width: '100%',
          marginBottom: '26px',
        }}
      >
        {[
          { icon: ShoppingBag, label: 'Faster Checkout' },
          { icon: Heart, label: 'Save Favourites' },
          { icon: Bell, label: 'Track Orders' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.55)',
                  border: '1px solid rgba(232, 225, 245, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-purple, #6D28D9)',
                }}
              >
                <Icon size={18} strokeWidth={1.9} />
              </div>
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--primary-text, #18181B)',
                  lineHeight: 1.25,
                  fontFamily: "var(--font-heading, 'Outfit', sans-serif)",
                }}
              >
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          fontSize: '11px',
          lineHeight: '1.6',
          color: 'var(--secondary-text, #5F5A6B)',
          maxWidth: '320px',
          fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
        }}
      >
        <div>By continuing, you agree to our</div>
        <div>
          <Link
            href="/terms"
            style={{ color: 'var(--primary-text, #18181B)', textDecoration: 'underline', fontWeight: 500 }}
          >
            Terms & Conditions
          </Link>
          {' and '}
          <Link
            href="/privacy"
            style={{ color: 'var(--primary-text, #18181B)', textDecoration: 'underline', fontWeight: 500 }}
          >
            Privacy Policy
          </Link>
          .
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.login-glass-card) {
            padding: 28px 18px 22px 18px !important;
            border-radius: 28px !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
    </div>
  );
}
