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
  Phone,
  User as UserIcon,
  HelpCircle,
  Copy,
  Check,
  CheckCircle,
  Zap,
  Layers,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { idPaymentService } from '../services/apiService';

export default function IdPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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
        setPaymentStatus('SUCCESS');
        setSuccessData({
          orderId: orderRes.orderId,
          amount: 0,
          fullName: paymentDetails?.fullName,
          role: paymentDetails?.role,
        });
        setPaying(false);
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

  const getPortalLoginPath = (role) => {
    const r = String(role || '').toUpperCase();
    if (r === 'DISTRIBUTOR') return '/portal/distributor';
    if (r === 'SUPER_DISTRIBUTOR') return '/portal/super-distributor';
    return '/portal/retailer';
  };

  const formatCurrency = (amt) => {
    return `₹${Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* ── Top Navigation Bar ── */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <img
              src="/logo rupiksha.png"
              alt="Rupiksha Logo"
              style={{ height: '42px', width: 'auto', maxHeight: '42px', objectFit: 'contain' }}
            />
            <div className="hidden sm:block border-l border-slate-200 pl-3">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                Partner Activation
              </span>
              <span className="text-[10px] text-slate-500 font-semibold block">
                Secure Payment Gateway
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-xs">
              <ShieldCheck size={15} className="text-emerald-600" />
              <span className="hidden xs:inline">256-Bit SSL</span> Secured
            </div>
            <button
              onClick={() => navigate(getPortalLoginPath(paymentDetails?.role || roleParam))}
              className="text-xs font-bold text-slate-700 hover:text-blue-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-white transition-all shadow-xs"
            >
              Back to Login
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="flex-1 flex items-center justify-center py-8 px-4 sm:px-6">
        <div className="w-full max-w-4xl">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center space-y-4 shadow-sm text-center">
              <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-sm font-bold text-slate-800">
                Loading Partner ID Charge Details...
              </p>
              <p className="text-xs text-slate-400">Please wait a moment</p>
            </div>
          ) : paymentStatus === 'SUCCESS' ? (
            /* ── SUCCESS STATE SCREEN ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-emerald-200 rounded-3xl p-6 sm:p-10 shadow-xl shadow-emerald-500/5 text-center space-y-6 max-w-lg mx-auto"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                  Payment Verified & Activated
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tracking-tight">
                  ID Activation Complete!
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-sm mx-auto">
                  Your ID activation charge is received. Your Rupiksha Partner portal access is now fully active.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-left text-xs space-y-2.5 text-slate-800">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Partner Name:</span>
                  <span className="font-bold text-slate-900">
                    {successData?.fullName || paymentDetails?.fullName || 'Partner'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Role:</span>
                  <span className="font-bold text-blue-600 uppercase">
                    {successData?.role || paymentDetails?.role}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {formatCurrency(successData?.amount || paymentDetails?.finalAmount)}
                  </span>
                </div>
                {successData?.paymentId && (
                  <div className="flex justify-between border-b border-slate-200 pb-2 font-mono">
                    <span className="text-slate-500">Payment ID:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[160px]">
                      {successData.paymentId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Portal Status:</span>
                  <span className="font-black text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={14} /> ACTIVE & UNLOCKED
                  </span>
                </div>
              </div>

              <button
                onClick={() =>
                  navigate(getPortalLoginPath(paymentDetails?.role || successData?.role))
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all hover:scale-[1.02]"
              >
                Proceed to Login & Open Dashboard <ArrowRight size={16} />
              </button>
            </motion.div>
          ) : (
            /* ── MAIN 2-COLUMN CHECKOUT CARD ── */
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden"
            >
              {/* Top Banner */}
              <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 sm:p-8 text-white relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-xl text-[11px] font-black uppercase tracking-wider text-blue-100 mb-2">
                      <Sparkles size={13} /> Official Onboarding Payment
                    </span>
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      Partner ID Activation Fee
                    </h1>
                    <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-xl">
                      Complete your one-time ID charge to unlock AEPS, Micro-ATM, DMT, Bill Payments, and merchant operations.
                    </p>
                  </div>
                  <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 text-center sm:text-right shrink-0">
                    <span className="text-[10px] text-blue-200 font-bold uppercase block tracking-wider">
                      Partner Role
                    </span>
                    <span className="text-base font-black text-white uppercase">
                      {paymentDetails?.role || roleParam || 'RETAILER'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* ── LEFT COLUMN: Account Details & Included Features (7 cols) ── */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Account Info Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                        <UserIcon size={16} className="text-blue-600" /> Account Information
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                        Activation Pending
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                          Full Name
                        </span>
                        <span className="font-black text-slate-900 text-sm block mt-0.5">
                          {paymentDetails?.fullName || 'N/A'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                          Mobile Number
                        </span>
                        <span className="font-bold text-slate-900 font-mono text-sm block mt-0.5">
                          {paymentDetails?.mobile || identifierParam || 'N/A'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                          Partner Code
                        </span>
                        <span className="font-bold text-slate-700 font-mono block mt-0.5">
                          {paymentDetails?.partyCode || paymentDetails?.username || 'N/A'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                          Account Tier
                        </span>
                        <span className="font-black text-blue-600 uppercase block mt-0.5">
                          {paymentDetails?.role || roleParam || 'RETAILER'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Included Services Badge List */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-500" /> What's Included With Your ID
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                        <span className="font-bold">AEPS & Aadhaar Withdrawals</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                        <span className="font-bold">DMT & Instant Money Transfer</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                        <span className="font-bold">BBPS & Utility Bill Payments</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                        <span className="font-bold">Real-time Commission Wallet</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Payment Summary & Actions (5 cols) ── */}
                <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Error Notice */}
                    {errorMessage && (
                      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs font-bold">
                        <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {/* Price Breakdown Card */}
                    <div className="bg-blue-50/70 border-2 border-blue-200 rounded-3xl p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-blue-200/80 pb-3">
                        <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard size={15} className="text-blue-600" /> Payment Summary
                        </span>
                        <span className="text-[11px] font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200 shadow-xs">
                          Authoritative
                        </span>
                      </div>

                      <div className="space-y-2.5 text-xs text-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">ID Activation Charge:</span>
                          <span className="font-black text-slate-900 text-sm">
                            {formatCurrency(paymentDetails?.originalAmount)}
                          </span>
                        </div>

                        {Number(paymentDetails?.discountAmount || 0) > 0 && (
                          <div className="flex justify-between items-center text-emerald-700 font-bold bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                            <span className="flex items-center gap-1">
                              <Tag size={13} /> Coupon Discount (
                              {paymentDetails?.appliedCouponDiscountPercent}% OFF):
                            </span>
                            <span>-{formatCurrency(paymentDetails?.discountAmount)}</span>
                          </div>
                        )}

                        <div className="pt-3 border-t border-blue-200/80 flex justify-between items-baseline">
                          <div>
                            <span className="text-xs font-bold text-slate-500 block uppercase">
                              Total Payable
                            </span>
                            <span className="text-[10px] text-slate-400">Inclusive of all taxes</span>
                          </div>
                          <span className="text-2xl font-black text-blue-700 tracking-tight">
                            {formatCurrency(paymentDetails?.finalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Coupon Code Input */}
                    <form onSubmit={handleApplyCoupon} className="space-y-2">
                      <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                        Have a Discount Coupon?
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="ENTER COUPON CODE"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 uppercase tracking-wider focus:outline-none focus:border-blue-500 shadow-xs"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={couponApplying || !couponCode.trim()}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs"
                        >
                          {couponApplying ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </button>
                      </div>

                      {couponMessage && (
                        <p
                          className={`text-xs font-bold flex items-center gap-1.5 pt-1 ${
                            couponMessage.type === 'success'
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {couponMessage.type === 'success' ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <AlertCircle size={13} />
                          )}
                          {couponMessage.text}
                        </p>
                      )}
                    </form>
                  </div>

                  {/* Pay Now Button */}
                  <div className="space-y-3 pt-4">
                    <button
                      type="button"
                      onClick={handlePayNow}
                      disabled={paying}
                      className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {paying ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Launching Razorpay...
                        </>
                      ) : (
                        <>
                          <Lock size={16} /> Proceed to Pay {formatCurrency(paymentDetails?.finalAmount)}
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>UPI / Cards / NetBanking</span>
                      <span>•</span>
                      <span>Instant Activation</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        © {new Date().getFullYear()} RuPiKsha Digital Services Private Limited | All rights reserved.
      </footer>
    </div>
  );
}
