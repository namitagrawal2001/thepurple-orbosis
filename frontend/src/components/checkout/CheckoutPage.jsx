'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import {
  ShieldCheck,
  Lock,
  Truck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ChevronRight,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import MainHeader from '@/components/layout/MainHeader';
import Footer from '@/components/layout/Footer';
import { orderApi } from '@/lib/api/orders';
import { syncClearCart, clearCart } from '@/store/slices/cartSlice';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Chandigarh',
];

export default function CheckoutPage() {
  const router = useRouter();
  const dispatch = useDispatch();

  // Redux State
  const customerUser = useSelector((state) => state.auth?.customer?.user);
  const cartItems = useSelector((state) => state.cart?.items || []);
  const appliedCoupon = useSelector((state) => state.cart?.appliedCoupon);

  // Address Form State
  const [formData, setFormData] = useState({
    customerName: '',
    customerMobile: '',
    customerEmail: '',
    shippingAddress: '',
    landmark: '',
    city: '',
    state: 'Delhi',
    pincode: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingInfo, setShippingInfo] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Prefill Customer User profile and saved address on mount
  useEffect(() => {
    let savedLocal = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('thepurple_saved_address_profile');
        if (raw) savedLocal = JSON.parse(raw);
      } catch {}
    }

    setFormData((prev) => ({
      customerName: customerUser?.name || savedLocal?.customerName || prev.customerName || '',
      customerMobile: customerUser?.mobile || savedLocal?.customerMobile || prev.customerMobile || '',
      customerEmail: customerUser?.email || savedLocal?.customerEmail || prev.customerEmail || '',
      shippingAddress: customerUser?.shippingAddress || savedLocal?.shippingAddress || prev.shippingAddress || '',
      landmark: customerUser?.landmark || savedLocal?.landmark || prev.landmark || '',
      city: customerUser?.city || savedLocal?.city || prev.city || '',
      state: customerUser?.state || savedLocal?.state || prev.state || 'Delhi',
      pincode: customerUser?.pincode || savedLocal?.pincode || prev.pincode || '',
      notes: prev.notes || savedLocal?.notes || '',
    }));
  }, [customerUser]);

  // Selected items from Cart (or all items if none explicitly filtered)
  const checkoutItems = useMemo(() => {
    const selected = cartItems.filter((i) => i.selected);
    return selected.length > 0 ? selected : cartItems;
  }, [cartItems]);

  // Financial Calculations
  const subtotal = useMemo(() => {
    return checkoutItems.reduce((acc, item) => {
      const price = parseFloat(item.price || 0);
      const qty = parseInt(item.quantity, 10) || 1;
      return acc + price * qty;
    }, 0);
  }, [checkoutItems]);

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
    const flatVal = appliedCoupon.discountAmount || appliedCoupon.discountValue || 0;
    return Math.min(subtotal, flatVal);
  }, [appliedCoupon, subtotal]);

  // Dynamic Shipping Calculation from Live Shiprocket API
  const shippingCharge = shippingInfo?.shippingAmount ?? null;
  const finalTotal = Math.max(0, subtotal - discountAmount + (shippingCharge !== null ? shippingCharge : 0));

  // Auto calculate shipping when 6-digit pincode is entered
  useEffect(() => {
    const cleanPin = String(formData.pincode || '').trim();
    if (cleanPin.length === 6 && /^\d+$/.test(cleanPin)) {
      let isSubscribed = true;
      async function fetchRate() {
        try {
          setIsCalculatingShipping(true);
          const data = await orderApi.calculateShipping({ pincode: cleanPin, subtotal });
          if (isSubscribed) {
            setShippingInfo(data);
          }
        } catch {
          if (isSubscribed) {
            setShippingInfo({ serviceable: true, shippingAmount: 99, courierName: 'Express Courier' });
          }
        } finally {
          if (isSubscribed) setIsCalculatingShipping(false);
        }
      }
      fetchRate();
      return () => {
        isSubscribed = false;
      };
    } else {
      setShippingInfo(null);
    }
  }, [formData.pincode, subtotal]);

  // Load Razorpay Script Dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Form Validation
  const validateForm = () => {
    const errs = {};
    if (!formData.customerName.trim() || formData.customerName.trim().length < 2) {
      errs.customerName = 'Please enter your full name';
    }

    const cleanMobile = formData.customerMobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      errs.customerMobile = 'Please enter a valid 10-digit mobile number';
    }

    if (formData.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail.trim())) {
      errs.customerEmail = 'Please enter a valid email address';
    }

    if (!formData.shippingAddress.trim() || formData.shippingAddress.trim().length < 8) {
      errs.shippingAddress = 'Please enter a complete address (House/Flat No, Building, Street)';
    }

    if (!formData.city.trim() || formData.city.trim().length < 2) {
      errs.city = 'Please enter your city';
    }

    if (!formData.state.trim()) {
      errs.state = 'Please select your state';
    }

    const cleanPin = formData.pincode.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      errs.pincode = 'Please enter a valid 6-digit postal pincode';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('thepurple_saved_address_profile', JSON.stringify(updated));
          if (field === 'customerEmail') localStorage.setItem('thepurple_customer_email', value);
          if (field === 'customerMobile') localStorage.setItem('thepurple_customer_mobile', value);
        } catch {}
      }
      return updated;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Handle Checkout & Razorpay Payment
  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    setPaymentError(null);

    if (checkoutItems.length === 0) {
      setPaymentError('Your cart is empty. Please add items to proceed.');
      return;
    }

    if (!validateForm()) {
      window.scrollTo({ top: 150, behavior: 'smooth' });
      return;
    }

    try {
      setIsProcessingPayment(true);

      // 1. Load Razorpay SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection and try again.');
      }

      // 2. Initialize Payment Intent on Backend
      const guestSessionId = typeof window !== 'undefined' ? localStorage.getItem('thepurple_guest_session_id') : null;
      const intentData = await orderApi.createPaymentIntent({
        items: checkoutItems.map((item) => ({
          productId: item.productId || item.id,
          productName: item.productName || item.name,
          slug: item.slug,
          price: item.price,
          quantity: item.quantity || 1,
        })),
        customerDetails: {
          customerName: formData.customerName.trim(),
          customerMobile: formData.customerMobile.replace(/\D/g, ''),
          customerEmail: formData.customerEmail.trim(),
          shippingAddress: `${formData.shippingAddress.trim()}${formData.landmark ? `, Landmark: ${formData.landmark.trim()}` : ''}`,
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: formData.pincode.trim(),
          notes: formData.notes.trim(),
        },
        couponCode: appliedCoupon?.code || null,
      });

      // 3. Launch Razorpay Modal
      const razorpayKeyId = intentData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKeyId) {
        throw new Error('Payments are not configured for this deployment. Please contact support.');
      }

      const options = {
        key: razorpayKeyId,
        amount: intentData.amount,
        currency: intentData.currency || 'INR',
        name: 'ThePurple Jewellery',
        description: `Order #${intentData.orderNumber}`,
        image: '/images/logo.png',
        order_id: intentData.razorpayOrderId,
        prefill: {
          name: formData.customerName,
          email: formData.customerEmail || '',
          contact: formData.customerMobile,
        },
        theme: {
          color: '#7E22CE',
        },
        handler: async function (response) {
          try {
            setIsProcessingPayment(true);
            // 4. Verify Payment on Backend & Dispatch Order
            const verificationResult = await orderApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderNumber: intentData.orderNumber,
              customerDetails: intentData.customerDetails,
              items: checkoutItems,
              appliedCouponCode: appliedCoupon?.code || null,
              amounts: intentData.breakdown,
              guestSessionId,
            });

            // 5. Store customer identifiers and order info for seamless retrieval
            if (typeof window !== 'undefined') {
              if (formData.customerEmail) localStorage.setItem('thepurple_customer_email', formData.customerEmail.trim());
              if (formData.customerMobile) localStorage.setItem('thepurple_customer_mobile', formData.customerMobile.replace(/\D/g, ''));
              
              const placedNum = verificationResult.orderNumber || intentData.orderNumber;
              if (placedNum) {
                const existingRecent = localStorage.getItem('thepurple_recent_orders') || '';
                const recentsList = existingRecent.split(',').filter(Boolean);
                if (!recentsList.includes(placedNum)) recentsList.unshift(placedNum);
                localStorage.setItem('thepurple_recent_orders', recentsList.slice(0, 10).join(','));
              }
            }

            // 6. Clear Local and Redux Cart
            dispatch(clearCart());
            dispatch(syncClearCart([]));

            // 7. Navigate to Order Success Page
            router.push(`/order-success/${verificationResult.orderNumber || verificationResult.orderId}`);
          } catch (verifyErr) {
            setPaymentError(verifyErr.message || 'Payment verification failed. Please contact customer support.');
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', function (resp) {
        setPaymentError(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
        setIsProcessingPayment(false);
      });
      razorpayInstance.open();
    } catch (err) {
      setPaymentError(err.message || 'Could not initiate checkout');
      setIsProcessingPayment(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', backgroundColor: '#FCFBFE', color: '#1E1B4B', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box' }}>
      
      {/* Responsive Stylesheet */}
      <style>{`
        .checkout-main-wrapper {
          max-width: 1320px;
          margin: 0 auto;
          width: 100%;
          padding: 12px 20px 60px;
          box-sizing: border-box;
          flex: 1;
        }

        .checkout-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 400px;
          gap: 28px;
          align-items: start;
          width: 100%;
          box-sizing: border-box;
        }

        .checkout-card {
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

        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-row-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }

        .input-field {
          width: 100%;
          padding: 11px 13px;
          border-radius: 10px;
          border: 1.5px solid #E5E7EB;
          background-color: #FAF8FC;
          font-size: 13.5px;
          color: #1E1B4B;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }
        .input-field:focus {
          border-color: #7E22CE;
          background-color: #FFFFFF;
        }
        .input-field.error {
          border-color: #EF4444;
          background-color: #FEF2F2;
        }

        .input-label {
          display: block;
          font-size: 12.5px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 6px;
        }

        @media (max-width: 1040px) {
          .checkout-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 24px;
          }
          .checkout-main-wrapper {
            padding: 10px 16px 44px;
          }
        }

        @media (max-width: 840px) {
          .form-row-3 {
            grid-template-columns: 1fr;
            gap: 14px;
          }
        }

        @media (max-width: 680px) {
          .checkout-card {
            padding: 18px 14px;
            border-radius: 14px;
          }
          .form-row-2 {
            grid-template-columns: 1fr;
            gap: 14px;
          }
        }

        @media (max-width: 480px) {
          .checkout-main-wrapper {
            padding: 8px 10px 32px;
          }
          .checkout-card {
            padding: 14px 10px;
          }
          .input-field {
            padding: 10px 12px;
          }
        }
      `}</style>

      {/* 1. Header Navigation */}
      <AnnouncementBar />
      <MainHeader />

      {/* 2. Breadcrumbs & Step Indicator */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', width: '100%', padding: '14px 20px 8px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280' }}>
            <Link href="/" style={{ color: '#6B7280', textDecoration: 'none' }}>Home</Link>
            <span>/</span>
            <Link href="/cart" style={{ color: '#6B7280', textDecoration: 'none' }}>Cart</Link>
            <span>/</span>
            <span style={{ color: '#7E22CE', fontWeight: 800 }}>Secure Checkout</span>
          </nav>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#15803D', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: '20px', border: '1px solid #BBF7D0' }}>
            <ShieldCheck size={14} />
            <span>256-Bit SSL Encrypted Checkout</span>
          </div>
        </div>
      </div>

      {/* 3. Main Checkout Container */}
      <main className="checkout-main-wrapper">
        
        {/* Title */}
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.9rem)', fontWeight: 900, color: '#1E1B4B', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Shipping & Payment
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            Enter your delivery address to calculate live shipping and complete your order.
          </p>
        </div>

        {/* Global Error Banner */}
        {paymentError && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: '12px', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600 }}>
            <AlertCircle size={18} flexShrink={0} />
            <span>{paymentError}</span>
          </div>
        )}

        {checkoutItems.length === 0 ? (
          <div className="checkout-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <ShoppingBag size={48} color="#7E22CE" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1E1B4B', marginBottom: '8px' }}>Your cart is empty</h2>
            <p style={{ color: '#6B7280', fontSize: '13.5px', marginBottom: '20px' }}>Please add some beautiful jewellery pieces before proceeding to checkout.</p>
            <Link href="/products" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#7E22CE', color: '#FFFFFF', borderRadius: '10px', fontWeight: 800, fontSize: '13px', textDecoration: 'none' }}>
              <ArrowLeft size={16} /> Return to Store
            </Link>
          </div>
        ) : (
          <form onSubmit={handleProceedToPayment} className="checkout-grid">
            
            {/* ========================================================================= */}
            {/* LEFT COLUMN: SHIPPING ADDRESS & PAYMENT METHOD */}
            {/* ========================================================================= */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Shipping Address Card */}
              <div className="checkout-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE', fontWeight: 900, fontSize: '14px' }}>
                    1
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E1B4B', margin: 0 }}>
                      Delivery Address (Shiprocket Standard)
                    </h2>
                    <span style={{ fontSize: '11.5px', color: '#6B7280' }}>
                      All fields required for accurate courier dispatch
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Full Name & Phone */}
                  <div className="form-row-2">
                    <div>
                      <label className="input-label">Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Priya Sharma"
                        value={formData.customerName}
                        onChange={(e) => handleInputChange('customerName', e.target.value)}
                        className={`input-field ${errors.customerName ? 'error' : ''}`}
                      />
                      {errors.customerName && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>{errors.customerName}</div>}
                    </div>

                    <div>
                      <label className="input-label">Mobile Number *</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile number"
                        value={formData.customerMobile}
                        onChange={(e) => handleInputChange('customerMobile', e.target.value)}
                        className={`input-field ${errors.customerMobile ? 'error' : ''}`}
                      />
                      {errors.customerMobile && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>{errors.customerMobile}</div>}
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="input-label">Email Address (Optional for Order Updates)</label>
                    <input
                      type="email"
                      placeholder="e.g. priya@example.com"
                      value={formData.customerEmail}
                      onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                      className={`input-field ${errors.customerEmail ? 'error' : ''}`}
                    />
                    {errors.customerEmail && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>{errors.customerEmail}</div>}
                  </div>

                  {/* Street Address */}
                  <div>
                    <label className="input-label">Street Address / Flat / House No. / Building *</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Flat 302, Lotus Residency, 4th Cross Road"
                      value={formData.shippingAddress}
                      onChange={(e) => handleInputChange('shippingAddress', e.target.value)}
                      className={`input-field ${errors.shippingAddress ? 'error' : ''}`}
                      style={{ resize: 'vertical' }}
                    />
                    {errors.shippingAddress && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>{errors.shippingAddress}</div>}
                  </div>

                  {/* Landmark */}
                  <div>
                    <label className="input-label">Landmark (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Near City Mall / Opp. Metro Station"
                      value={formData.landmark}
                      onChange={(e) => handleInputChange('landmark', e.target.value)}
                      className="input-field"
                    />
                  </div>

                  {/* Pincode, City, State */}
                  <div className="form-row-3">
                    <div>
                      <label className="input-label">Postal Pincode *</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit PIN"
                        value={formData.pincode}
                        onChange={(e) => handleInputChange('pincode', e.target.value)}
                        className={`input-field ${errors.pincode ? 'error' : ''}`}
                      />
                      {errors.pincode && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>{errors.pincode}</div>}
                    </div>

                    <div>
                      <label className="input-label">City *</label>
                      <input
                        type="text"
                        placeholder="City"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        className={`input-field ${errors.city ? 'error' : ''}`}
                      />
                      {errors.city && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>{errors.city}</div>}
                    </div>

                    <div>
                      <label className="input-label">State *</label>
                      <select
                        value={formData.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        className={`input-field ${errors.state ? 'error' : ''}`}
                        style={{ cursor: 'pointer' }}
                      >
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      {errors.state && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>{errors.state}</div>}
                    </div>
                  </div>

                  {/* Dynamic Shiprocket Pincode Status */}
                  {isCalculatingShipping ? (
                    <div style={{ padding: '12px 14px', backgroundColor: '#FAF5FF', border: '1.5px solid #E9D5FF', borderRadius: '10px', fontSize: '12.5px', color: '#7E22CE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '14px', height: '14px', border: '2px solid #7E22CE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span>Fetching live Shiprocket courier serviceability & lowest rates for PIN {formData.pincode}...</span>
                    </div>
                  ) : shippingInfo ? (
                    <div
                      style={{
                        padding: '14px 16px',
                        backgroundColor: '#FAF5FF',
                        border: '1.5px solid #C084FC',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: '#7E22CE', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Truck size={14} />
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#581C87' }}>
                              {shippingInfo.courierName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6B7280' }}>
                              Estimated Delivery: <strong>{shippingInfo.estimatedDays}</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: 900, color: '#1E1B4B' }}>
                            ₹{shippingInfo.shippingAmount ?? shippingCharge}
                          </span>
                          <div style={{ fontSize: '10.5px', color: '#7E22CE', fontWeight: 700 }}>
                            Live Express Rate
                          </div>
                        </div>
                      </div>

                      {/* Available Couriers tags if returned by Shiprocket */}
                      {shippingInfo.availableCouriers && shippingInfo.availableCouriers.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid #F3E8FF', fontSize: '11px', color: '#6B7280' }}>
                          <span style={{ fontWeight: 700 }}>Available Couriers:</span>
                          {shippingInfo.availableCouriers.map((c, idx) => (
                            <span key={idx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9D5FF', padding: '1px 6px', borderRadius: '4px', color: '#7E22CE', fontWeight: 600 }}>
                              {c.name} (₹{c.rate})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Payment Method Card (Secure Online Payment) */}
              <div className="checkout-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE', fontWeight: 900, fontSize: '14px' }}>
                    2
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E1B4B', margin: 0 }}>
                      Payment Method
                    </h2>
                    <span style={{ fontSize: '11.5px', color: '#6B7280' }}>
                      100% Safe & Secure Online Payment Gateway
                    </span>
                  </div>
                </div>

                {/* Razorpay Online Option (Pre-selected) */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '2px solid #7E22CE',
                    backgroundColor: '#FAF5FF',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                  }}
                >
                  <input
                    type="radio"
                    checked={true}
                    readOnly
                    style={{ marginTop: '3px', accentColor: '#7E22CE', width: '18px', height: '18px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#1E1B4B' }}>
                        Razorpay Secure Online Checkout
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#7E22CE', backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E9D5FF' }}>
                          UPI / GPay / PhonePe
                        </span>
                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#7E22CE', backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E9D5FF' }}>
                          Cards & NetBanking
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                      Pay instantly via any UPI app (Google Pay, PhonePe, Paytm), Debit/Credit Cards, Net Banking, or Digital Wallets.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* RIGHT COLUMN: ORDER SUMMARY & PAYMENT CTA */}
            {/* ========================================================================= */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="checkout-card">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E1B4B', margin: '0 0 16px', paddingBottom: '12px', borderBottom: '1px solid #F3F4F6' }}>
                  Order Summary ({checkoutItems.length} {checkoutItems.length === 1 ? 'item' : 'items'})
                </h2>

                {/* Items Mini List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '240px', overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
                  {checkoutItems.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: '#FAF5FF', border: '1px solid #E5E7EB', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={item.imageUrl} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E1B4B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.productName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>
                          Qty: {item.quantity} × ₹{parseFloat(item.price || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#1E1B4B', flexShrink: 0 }}>
                        ₹{(parseFloat(item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', borderTop: '1px solid #F3F4F6', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563' }}>
                    <span>Subtotal</span>
                    <span style={{ fontWeight: 700, color: '#1E1B4B' }}>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontWeight: 700 }}>
                      <span>Coupon ({appliedCoupon?.code})</span>
                      <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563', alignItems: 'center' }}>
                    <span>Shiprocket Delivery</span>
                    <span style={{ fontWeight: 800, color: shippingCharge !== null ? '#1E1B4B' : '#6B7280', fontSize: shippingCharge !== null ? '13px' : '11.5px' }}>
                      {isCalculatingShipping ? (
                        'Calculating...'
                      ) : shippingCharge !== null ? (
                        `₹${shippingCharge}`
                      ) : (
                        'Enter Pincode'
                      )}
                    </span>
                  </div>

                  <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#1E1B4B' }}>Total Amount</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>Inclusive of all taxes</div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#7E22CE' }}>
                      ₹{finalTotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Pay & Place Order CTA */}
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  style={{
                    marginTop: '20px',
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: isProcessingPayment ? '#A855F7' : '#7E22CE',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 800,
                    border: 'none',
                    cursor: isProcessingPayment ? 'wait' : 'pointer',
                    boxShadow: '0 4px 16px rgba(126, 34, 206, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isProcessingPayment ? (
                    <>
                      <div style={{ width: '16px', height: '16px', border: '2px solid #FFFFFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span>Opening Secure Razorpay Gateway...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      <span>Pay ₹{finalTotal.toLocaleString('en-IN')} & Place Order</span>
                    </>
                  )}
                </button>

                {/* Trust Footer Badges */}
                <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px', color: '#6B7280' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} color="#16A34A" />
                    <span>Instant Order ID & Shiprocket Dispatch Creation</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} color="#16A34A" />
                    <span>Free cancellation before shipping label generation</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>

      {/* 4. Footer */}
      <Footer />
    </div>
  );
}
