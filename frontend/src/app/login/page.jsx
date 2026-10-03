"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { signInWithPopup } from 'firebase/auth';
import { auth, firebaseConfigured, googleProvider } from '@/lib/firebase/config';
import { customerApi } from '@/lib/api/customer';
import { setCustomerSession, getStoredCustomerToken } from '@/lib/auth/session';
import { setCustomer } from '@/store/slices/authSlice';
import { syncMergeCart, fetchCart } from '@/store/slices/cartSlice';
import { fetchWishlist } from '@/store/slices/wishlistSlice';
import { getCartSessionId } from '@/lib/api/cart';

import BrandHeader from '@/components/auth/BrandHeader';
import LoginBackground from '@/components/auth/LoginBackground';
import LoginMarketingPanel from '@/components/auth/LoginMarketingPanel';
import LoginCard from '@/components/auth/LoginCard';

function CustomerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rawRedirect = searchParams?.get('redirect') || '/';
  const redirectUrl = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  useEffect(() => {
    const token = getStoredCustomerToken();
    if (token) {
      router.replace(redirectUrl);
    }
  }, [router, redirectUrl]);

  const handleGoogleLogin = async () => {
    if (!firebaseConfigured || !auth || !googleProvider) {
      setError('Google sign-in is not configured for this deployment.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      if (!firebaseUser) {
        throw new Error('Google authentication returned empty user profile.');
      }

      const idToken = await firebaseUser.getIdToken();
      const response = await customerApi.loginWithGoogle(idToken);

      if (!response?.token || !response?.user) {
        throw new Error(response?.message || 'Failed to authenticate with ThePurple backend.');
      }

      const guestSid = getCartSessionId();
      setCustomerSession(response.token, response.user);
      dispatch(setCustomer({ token: response.token, user: response.user }));

      // Merge guest cart items into user's DB cart
      await dispatch(syncMergeCart(guestSid));
      dispatch(fetchCart());
      dispatch(fetchWishlist());

      router.push(redirectUrl);
    } catch (err) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        setError('Google sign-in was cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Google sign-in popup was blocked. Please enable popups for this site.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-in is not enabled in your Firebase Console. Please enable Google provider under Firebase Console > Authentication > Sign-in method.');
      } else {
        setError(err?.message || 'Unable to sign you in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#F4EEF7',
      }}
    >
      <BrandHeader />
      <LoginBackground />

      <main
        className="login-main-container"
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '76px 52px 36px 52px',
          gap: '32px',
        }}
      >
        <div className="login-left-panel" style={{ flex: '1 1 40%', maxWidth: '460px', alignSelf: 'center' }}>
          <LoginMarketingPanel />
        </div>

        <div
          className="login-right-panel"
          style={{
            flex: '0 0 auto',
            width: 'min(440px, 36vw)',
            minWidth: '360px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignSelf: 'center',
            marginRight: '8px',
          }}
        >
          <LoginCard
            onGoogleLogin={handleGoogleLogin}
            loading={loading}
            error={error}
            googleLoginEnabled={firebaseConfigured}
          />
        </div>
      </main>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 1100px) {
          .login-right-panel {
            width: min(400px, 40vw) !important;
            min-width: 320px !important;
          }
        }
        @media (max-width: 860px) {
          .login-left-panel {
            display: none !important;
          }
          .login-right-panel {
            width: 100% !important;
            min-width: 0 !important;
            justify-content: center !important;
            margin-right: 0 !important;
          }
          .login-main-container {
            padding: 68px 16px 20px 16px !important;
            justify-content: center !important;
            align-items: center !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#F4EEF7' }} />}>
      <CustomerLoginContent />
    </Suspense>
  );
}
