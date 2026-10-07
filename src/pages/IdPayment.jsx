import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  CreditCard,
  Tag,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Lock,
  User as UserIcon,
  CheckCircle,
  Zap
} from 'lucide-react';
import { idPaymentService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';

export default function IdPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const identifierParam =
    searchParams.get('identifier') ||
    searchParams.get('mobile') ||
    searchParams.get('userId') ||
    '';
  const roleParam = searchParams.get('role') || '';

  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponMessage, setCouponMessage] = useState(null);
  const [paying, setPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('PENDING'); // PENDING, SUCCESS, FAILED, CANCELLED
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [autoRedirecting, setAutoRedirecting] = useState(false);

  // Dynamic Razorpay Script Loader
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
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

  const getPortalLoginPath = (role) => {
    const r = String(role || '').toUpperCase();
    if (r === 'DISTRIBUTOR') return '/portal/distributor';
    if (r === 'SUPER_DISTRIBUTOR') return '/portal/super-distributor';
    return '/portal/retailer';
  };

  const formatCurrency = (amt) => {
    return `₹${Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  // Helper to establish session in local storage & context and navigate to dashboard
  const handleAutoLoginAndRedirect = (userObj, token) => {
    setAutoRedirecting(true);
    if (userObj && token) {
      const roles = Array.isArray(userObj.roles)
        ? userObj.roles.map(r => String(typeof r === 'string' ? r : r?.name || '').replace(/^ROLE_/i, '').replace(/[\s-]+/g, '_').toUpperCase()).filter(Boolean)
        : [];
      const role = String(userObj.role || '').replace(/^ROLE_/i, '').replace(/[\s-]+/g, '_').toUpperCase();
      const allRoles = Array.from(new Set([...roles, ...(role ? [role] : [])]));
      const preferred = ['ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'].find(r => allRoles.includes(r)) || allRoles[0] || 'RETAILER';

      const normalized = {
        ...userObj,
        roles: allRoles.length ? allRoles : [preferred],
        role: preferred,
      };

      localStorage.removeItem('rupiksha_imp_token');
      localStorage.removeItem('rupiksha_imp_user');
      localStorage.setItem('rupiksha_user', JSON.stringify(normalized));
      localStorage.setItem('rupiksha_token', token);
      localStorage.setItem('last_activity', Date.now().toString());
      if (setUser) {
        setUser(normalized);
      }
    }

    const targetRole = String(userObj?.role || paymentDetails?.role || roleParam || 'RETAILER').toUpperCase();
    setTimeout(() => {
      if (targetRole === 'DISTRIBUTOR') {
        navigate('/distributor');
      } else if (targetRole === 'SUPER_DISTRIBUTOR') {
        navigate('/super-distributor');
      } else if (['ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].includes(targetRole)) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }, 1500);
  };

  const fetchDetails = async (identifierToUse) => {
    const id = identifierToUse || identifierParam;
    if (!id) {
      setLoading(false);
      setErrorMessage('No user account specified. Please login or register to complete ID Payment.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      const res = await idPaymentService.getDetails(id);
      if (res && res.userId) {
        setPaymentDetails(res);
        if (res.appliedCouponCode && !couponCode) {
          setCouponCode(res.appliedCouponCode);
        }
        if (res.paymentStatus === 'SUCCESS') {
          setPaymentStatus('SUCCESS');
          setSuccessData({
            amount: res.finalAmount,
            userId: res.userId,
            fullName: res.fullName,
            role: res.role,
          });
        }
      } else {
        setErrorMessage(res?.message || 'Could not load payment details for this account.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [identifierParam]);

  // Handle Apply Coupon
  const handleApplyCoupon = async (e) => {
    if (e) e.preventDefault();
    if (!couponCode.trim()) return;

    const id =
      paymentDetails?.userId ||
      paymentDetails?.mobile ||
      paymentDetails?.username ||
      identifierParam;
    if (!id) return;

    try {
      setCouponApplying(true);
      setCouponMessage(null);
      const res = await idPaymentService.applyCoupon(id, couponCode.trim());
      if (res && res.valid) {
        setCouponMessage({ type: 'success', text: res.message });
        setPaymentDetails((prev) => ({
          ...prev,
          originalAmount: res.originalAmount,
          discountAmount: res.discountAmount,
          finalAmount: res.finalAmount,
          appliedCouponCode: res.couponCode,
          appliedCouponDiscountPercent: res.discountPercent,
        }));
      } else {
        setCouponMessage({ type: 'error', text: res?.message || 'Invalid coupon code.' });
      }
    } catch (err) {
      setCouponMessage({ type: 'error', text: err.message || 'Failed to validate coupon.' });
    } finally {
      setCouponApplying(false);
    }
  };

  // Handle Pay Now / Razorpay Standard Checkout
  const handlePayNow = async () => {
    const id =
      paymentDetails?.userId ||
      paymentDetails?.mobile ||
      paymentDetails?.username ||
      identifierParam;
    if (!id) {
      alert('Missing user account information.');
      return;
    }

    try {
      setPaying(true);
      setErrorMessage('');

      // 1. Create order on backend
      const orderRes = await idPaymentService.createOrder(
        id,
        paymentDetails?.appliedCouponCode || couponCode.trim() || null
      );
      if (!orderRes || !orderRes.orderId) {
        throw new Error(orderRes?.message || 'Failed to generate payment order.');
      }

      // Check if order was already activated (e.g. 100% discount coupon)
      if (
        orderRes.status === 'SUCCESS' ||
        Number(orderRes.finalAmount) === 0 ||
        orderRes.orderId?.startsWith('FREE_ACTIVATION_')
      ) {
        const verifyRes = await idPaymentService.verifyPayment({
          razorpayOrderId: orderRes.orderId,
          razorpayPaymentId: 'pay_free_' + Math.random().toString(36).substring(2, 10),
          razorpaySignature: 'sig_free_verified',
        }).catch(() => null);

        setPaymentStatus('SUCCESS');
        setSuccessData({
          orderId: orderRes.orderId,
          amount: 0,
          fullName: paymentDetails?.fullName,
          role: paymentDetails?.role,
        });
        setPaying(false);

        if (verifyRes && verifyRes.accessToken && verifyRes.user) {
          handleAutoLoginAndRedirect(verifyRes.user, verifyRes.accessToken);
        } else {
          handleAutoLoginAndRedirect({ role: paymentDetails?.role || roleParam }, null);
        }
        return;
      }

      // Check if backend returned mock or real Razorpay
      const isMockOrder = orderRes.orderId.startsWith('order_mock_');

      if (isMockOrder) {
        const verifyRes = await idPaymentService.verifyPayment({
          razorpayOrderId: orderRes.orderId,
          razorpayPaymentId: 'pay_mock_' + Math.random().toString(36).substring(2, 10),
          razorpaySignature: 'sig_mock_verified',
        });

        if (verifyRes && verifyRes.success) {
          setPaymentStatus('SUCCESS');
          setSuccessData({
            orderId: orderRes.orderId,
            amount: orderRes.finalAmount,
            fullName: paymentDetails?.fullName,
            role: paymentDetails?.role,
          });
          if (verifyRes.accessToken && verifyRes.user) {
            handleAutoLoginAndRedirect(verifyRes.user, verifyRes.accessToken);
          } else {
            handleAutoLoginAndRedirect({ role: paymentDetails?.role || roleParam }, null);
          }
        } else {
          setPaymentStatus('FAILED');
          setErrorMessage('Payment verification failed.');
        }
        setPaying(false);
        return;
      }

      // 2. Real Razorpay Checkout flow
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Could not load Razorpay SDK. Please check your internet connection.');
      }

      const options = {
        key: orderRes.razorpayKeyId,
        amount: orderRes.finalAmount * 100, // smallest currency subunit (paise)
        currency: orderRes.currency || 'INR',
        name: 'Rupiksha Fintech',
        description: `${paymentDetails?.role || roleParam || 'Partner'} ID Activation Fee`,
        order_id: orderRes.orderId,
        image: '/logo rupiksha.png',
        prefill: {
          name: orderRes.customerName || paymentDetails?.fullName || '',
          email: orderRes.customerEmail || paymentDetails?.email || '',
          contact: orderRes.customerMobile || paymentDetails?.mobile || identifierParam || '',
        },
        notes: {
          userId: paymentDetails?.userId || id,
          role: paymentDetails?.role || roleParam || 'RETAILER',
          coupon: paymentDetails?.appliedCouponCode || couponCode.trim() || '',
        },
        theme: {
          color: '#2563EB',
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
            setPaymentStatus('CANCELLED');
          },
        },
        handler: async function (response) {
          try {
            setPaying(true);
            const verifyPayload = {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            };

            const verifyRes = await idPaymentService.verifyPayment(verifyPayload);
            if (verifyRes && verifyRes.success) {
              setPaymentStatus('SUCCESS');
              setSuccessData({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                amount: orderRes.finalAmount,
                fullName: paymentDetails?.fullName,
                role: paymentDetails?.role,
              });
              if (verifyRes.accessToken && verifyRes.user) {
                handleAutoLoginAndRedirect(verifyRes.user, verifyRes.accessToken);
              } else {
                handleAutoLoginAndRedirect({ role: paymentDetails?.role || roleParam }, null);
              }
            } else {
              setPaymentStatus('FAILED');
              setErrorMessage(verifyRes?.message || 'Payment signature verification failed.');
            }
          } catch (vErr) {
            setPaymentStatus('FAILED');
            setErrorMessage(vErr.message || 'Verification failed. Please contact support.');
          } finally {
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setPaying(false);
        setPaymentStatus('FAILED');
        setErrorMessage(resp.error?.description || 'Payment was declined or failed.');
      });
      rzp.open();
    } catch (err) {
      setPaying(false);
      setPaymentStatus('FAILED');
      setErrorMessage(err.message || 'Payment initiation failed.');
    }
  };

  const currentRole = paymentDetails?.role || roleParam || 'RETAILER';

  return (
    <div className="h-screen max-h-screen w-screen bg-slate-100 text-slate-900 flex flex-col font-sans overflow-hidden select-none">
      
      {/* ── Top Navigation Bar (Crisp, Clean, No Overflow) ── */}
      <header className="w-full h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between z-30 shrink-0 shadow-xs">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img
            src="/logo rupiksha.png"
            alt="Rupiksha Logo"
            style={{ height: '34px', width: 'auto', maxHeight: '34px', objectFit: 'contain' }}
          />
          <div className="border-l border-slate-200 pl-3">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider block leading-tight">
              Partner Activation
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
              Secure ID Payment Gateway
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold shadow-xs">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span className="hidden sm:inline text-[11px]">256-Bit SSL</span> Secured
          </div>
          <button
            onClick={() => navigate(getPortalLoginPath(currentRole))}
            className="text-xs font-bold text-slate-700 hover:text-blue-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-white transition-all shadow-xs"
          >
            Back to Login
          </button>
        </div>
      </header>

      {/* ── Main Container (Two-Sided Compact Layout, No Vertical Scroll) ── */}
      <main className="flex-1 w-full max-w-5xl xl:max-w-6xl mx-auto p-3 sm:p-5 flex items-center justify-center overflow-hidden min-h-0">
        <div className="w-full h-full max-h-[580px] sm:max-h-[600px] flex items-center justify-center">
          
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center space-y-3 shadow-sm text-center w-full max-w-md">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm font-bold text-slate-800">
                Loading Partner ID Charge Details...
              </p>
              <p className="text-xs text-slate-400">Please wait a moment</p>
            </div>
          ) : paymentStatus === 'SUCCESS' ? (
            /* ── SUCCESS & AUTO-LOGIN STATE SCREEN ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-emerald-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-500/5 text-center space-y-4 max-w-md w-full mx-auto"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  Payment Verified & Activated
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
                  ID Activation Complete!
                </h1>
                <p className="text-xs text-slate-600 mt-0.5 max-w-sm mx-auto">
                  {autoRedirecting ? 'Logging you directly into your portal dashboard...' : 'Your Rupiksha Partner portal access is now fully active.'}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-left text-xs space-y-2 text-slate-800">
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Partner Name:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[180px]">
                    {successData?.fullName || paymentDetails?.fullName || 'Partner'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Role:</span>
                  <span className="font-bold text-blue-600 uppercase">
                    {successData?.role || paymentDetails?.role}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {formatCurrency(successData?.amount || paymentDetails?.finalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Portal Status:</span>
                  <span className="font-black text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={13} /> ACTIVE & UNLOCKED
                  </span>
                </div>
              </div>

              <button
                onClick={() =>
                  handleAutoLoginAndRedirect(null, null)
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all hover:scale-[1.01]"
              >
                {autoRedirecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Open Dashboard <ArrowRight size={14} /></>}
              </button>
            </motion.div>
          ) : (
            /* ── MAIN TWO-SIDED PAYMENT UI (No Scroll) ── */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full h-full bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden grid grid-cols-1 lg:grid-cols-12"
            >
              {/* ── LEFT COLUMN (7 cols): Onboarding Info & Services ── */}
              <div className="lg:col-span-7 bg-slate-50/80 border-b lg:border-b-0 lg:border-r border-slate-200 text-slate-900 p-5 sm:p-7 flex flex-col justify-between overflow-hidden relative">
                {/* Left Top: Header & Role */}
                <div className="relative z-10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-700 shadow-xs">
                      <Sparkles size={11} className="text-blue-600" /> Official Onboarding
                    </span>
                    <span className="px-3 py-1 rounded-full bg-blue-600 border border-blue-700 text-white font-black text-[11px] uppercase tracking-wider shadow-xs">
                      {currentRole.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-2">
                    Partner ID Activation Fee
                  </h1>
                  <p className="text-xs text-slate-600 font-medium line-clamp-1">
                    Complete your one-time ID charge to unlock all merchant banking services.
                  </p>
                </div>

                {/* Left Middle: Account Information Box */}
                <div className="relative z-10 bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 my-2.5 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                      <UserIcon size={14} className="text-blue-600" /> Account Information
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Activation Pending
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                        Full Name
                      </span>
                      <span className="font-bold text-black text-xs sm:text-sm block mt-0.5 truncate">
                        {paymentDetails?.fullName || 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                        Mobile Number
                      </span>
                      <span className="font-bold text-black font-mono text-xs sm:text-sm block mt-0.5">
                        {paymentDetails?.mobile || identifierParam || 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                        Partner Code
                      </span>
                      <span className="font-bold text-blue-700 font-mono text-xs sm:text-sm block mt-0.5 truncate">
                        {paymentDetails?.partyCode || paymentDetails?.username || 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                        Account Tier
                      </span>
                      <span className="font-black text-slate-900 uppercase text-xs sm:text-sm block mt-0.5">
                        {currentRole.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Left Bottom: What's Included */}
                <div className="relative z-10 space-y-1.5">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Zap size={12} className="text-amber-500" /> What's Included With Your ID
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-900">
                    <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      <CheckCircle size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900 truncate">AEPS & Aadhaar ATM</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      <CheckCircle size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900 truncate">DMT & Instant Transfer</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      <CheckCircle size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900 truncate">BBPS & Utility Bills</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      <CheckCircle size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900 truncate">Commission Wallet</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN (5 cols): Payment Summary, Coupon & Pay ── */}
              <div className="lg:col-span-5 p-5 sm:p-7 flex flex-col justify-between bg-white overflow-hidden space-y-3">
                <div className="space-y-3">
                  {/* Error Notice */}
                  {errorMessage && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2 text-rose-800 text-xs font-bold">
                      <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{errorMessage}</span>
                    </div>
                  )}

                  {/* Payment Summary Box */}
                  <div className="bg-blue-50/70 border-2 border-blue-200 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard size={14} className="text-blue-600" /> Payment Summary
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200 shadow-xs">
                        Authoritative
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">ID Activation Charge:</span>
                        <span className="font-black text-slate-900 text-xs sm:text-sm">
                          {formatCurrency(paymentDetails?.originalAmount)}
                        </span>
                      </div>

                      {Number(paymentDetails?.discountAmount || 0) > 0 && (
                        <div className="flex justify-between items-center text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-xs">
                          <span className="flex items-center gap-1">
                            <Tag size={12} /> Coupon ({paymentDetails?.appliedCouponDiscountPercent}% OFF):
                          </span>
                          <span>-{formatCurrency(paymentDetails?.discountAmount)}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-blue-200/80 flex justify-between items-baseline">
                        <div>
                          <span className="text-xs font-bold text-slate-500 block uppercase">
                            Total Payable
                          </span>
                          <span className="text-[9px] text-slate-400">Inclusive of all taxes</span>
                        </div>
                        <span className="text-xl sm:text-2xl font-black text-blue-700 tracking-tight">
                          {formatCurrency(paymentDetails?.finalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Coupon Code Section */}
                  <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                      Have a Discount Coupon?
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="ENTER COUPON CODE"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-2.5 py-2 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 uppercase tracking-wider focus:outline-none focus:border-blue-500 shadow-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={couponApplying || !couponCode.trim()}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs shrink-0"
                      >
                        {couponApplying ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          'Apply'
                        )}
                      </button>
                    </div>

                    {couponMessage && (
                      <p
                        className={`text-[11px] font-bold flex items-center gap-1 pt-0.5 ${
                          couponMessage.type === 'success'
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {couponMessage.type === 'success' ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                        {couponMessage.text}
                      </p>
                    )}
                  </form>
                </div>

                {/* Bottom Action: Proceed To Pay Button */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePayNow}
                    disabled={paying}
                    className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {paying ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" /> Launching Razorpay...
                      </>
                    ) : (
                      <>
                        <Lock size={15} /> Proceed to Pay {formatCurrency(paymentDetails?.finalAmount)}
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>UPI / Cards / NetBanking</span>
                    <span>•</span>
                    <span>Instant Auto-Login</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </main>

    </div>
  );
}
