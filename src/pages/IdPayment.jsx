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
  Check
} from 'lucide-react';
import { idPaymentService } from '../services/apiService';

export default function IdPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const identifierParam = searchParams.get('identifier') || searchParams.get('mobile') || searchParams.get('userId') || '';
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
  const [copied, setCopied] = useState(false);

  // Load Razorpay Script dynamically
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
            role: res.role
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

    const id = paymentDetails?.userId || paymentDetails?.mobile || paymentDetails?.username || identifierParam;
    if (!id) return;

    try {
      setCouponApplying(true);
      setCouponMessage(null);
      const res = await idPaymentService.applyCoupon(id, couponCode.trim());
      if (res && res.valid) {
        setCouponMessage({ type: 'success', text: res.message });
        // Update local price breakdown from backend authoritative response
        setPaymentDetails((prev) => ({
          ...prev,
          originalAmount: res.originalAmount,
          discountAmount: res.discountAmount,
          finalAmount: res.finalAmount,
          appliedCouponCode: res.couponCode,
          appliedCouponDiscountPercent: res.discountPercent
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

  // Handle Pay Now
  const handlePayNow = async () => {
    const id = paymentDetails?.userId || paymentDetails?.mobile || paymentDetails?.username || identifierParam;
    if (!id) {
      alert('Missing user account information.');
      return;
    }

    try {
      setPaying(true);
      setErrorMessage('');

      // 1. Create order on backend
      const orderRes = await idPaymentService.createOrder(id, paymentDetails?.appliedCouponCode || couponCode.trim() || null);
      if (!orderRes || !orderRes.orderId) {
        throw new Error(orderRes?.message || 'Failed to generate payment order.');
      }

      // Check if order was already activated (e.g. 100% discount coupon)
      if (orderRes.status === 'SUCCESS' || Number(orderRes.finalAmount) === 0 || orderRes.orderId?.startsWith('FREE_ACTIVATION_')) {
        setPaymentStatus('SUCCESS');
        setSuccessData({
          orderId: orderRes.orderId,
          amount: 0,
          fullName: paymentDetails?.fullName,
          role: paymentDetails?.role
        });
        setPaying(false);
        return;
      }

      // Check if backend returned mock or real Razorpay
      const isMockOrder = orderRes.orderId.startsWith('order_mock_');


      if (isMockOrder) {
        // Auto-verify mock order in test/dev environment
        const verifyRes = await idPaymentService.verifyPayment({
          razorpayOrderId: orderRes.orderId,
          razorpayPaymentId: 'pay_mock_' + Math.random().toString(36).substring(2, 10),
          razorpaySignature: 'sig_mock_verified'
        });

        if (verifyRes && verifyRes.success) {
          setPaymentStatus('SUCCESS');
          setSuccessData({
            orderId: orderRes.orderId,
            amount: orderRes.finalAmount,
            fullName: paymentDetails?.fullName,
            role: paymentDetails?.role
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
        amount: Math.round(Number(orderRes.finalAmount) * 100),
        currency: orderRes.currency || 'INR',
        name: 'RuPiKsha Digital Services',
        description: `ID Charge Payment for ${paymentDetails?.role || 'Partner'}`,
        image: '/logo rupiksha.png',
        order_id: orderRes.orderId,
        prefill: {
          name: orderRes.customerName || paymentDetails?.fullName || '',
          contact: orderRes.customerMobile || paymentDetails?.mobile || '',
          email: orderRes.customerEmail || paymentDetails?.email || ''
        },
        theme: {
          color: '#2563eb'
        },
        handler: async (response) => {
          try {
            setPaying(true);
            const verifyRes = await idPaymentService.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });

            if (verifyRes && verifyRes.success) {
              setPaymentStatus('SUCCESS');
              setSuccessData({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                amount: orderRes.finalAmount,
                fullName: paymentDetails?.fullName,
                role: paymentDetails?.role
              });
            } else {
              setPaymentStatus('FAILED');
              setErrorMessage('Payment verification was rejected by server. Please contact support.');
            }
          } catch (vErr) {
            setPaymentStatus('FAILED');
            setErrorMessage(vErr.message || 'Error verifying payment with server.');
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setPaymentStatus('CANCELLED');
          }
        }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-slate-100 flex flex-col font-sans">
      
      {/* ── Top Header ── */}
      <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-700/60 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo rupiksha.png" alt="Rupiksha" className="h-9 w-auto object-contain bg-white/10 p-1 rounded-lg" />
          <span className="text-xs sm:text-sm font-bold tracking-wide text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> ID ACTIVATION GATEWAY
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full font-semibold">
            <ShieldCheck size={14} /> 256-Bit SSL Secured
          </div>
          <button
            onClick={() => navigate(getPortalLoginPath(paymentDetails?.role || roleParam))}
            className="text-slate-300 hover:text-white px-3 py-1 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 md:p-8">
        <div className="w-full max-w-2xl">
          
          {loading ? (
            <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-10 flex flex-col items-center justify-center space-y-4 shadow-2xl backdrop-blur-xl">
              <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm font-medium text-slate-300">Loading ID Charge details...</p>
            </div>
          ) : paymentStatus === 'SUCCESS' ? (
            
            /* ── SUCCESS STATE SCREEN ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800/95 border border-emerald-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl text-center space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div>
                <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
                  PAYMENT VERIFIED & ACTIVATED
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">ID Activation Completed!</h2>
                <p className="text-sm text-slate-300 mt-1 max-w-md mx-auto">
                  Congratulations! Your ID Charge payment has been verified. Your Rupiksha Partner portal access is now fully active.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 sm:p-5 text-left text-xs sm:text-sm space-y-2.5 max-w-md mx-auto">
                <div className="flex justify-between border-b border-slate-700/60 pb-2">
                  <span className="text-slate-400">Partner Name:</span>
                  <span className="font-bold text-white">{successData?.fullName || paymentDetails?.fullName || 'Partner'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-700/60 pb-2">
                  <span className="text-slate-400">Account Role:</span>
                  <span className="font-bold text-blue-400">{successData?.role || paymentDetails?.role}</span>
                </div>
                <div className="flex justify-between border-b border-slate-700/60 pb-2">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="font-black text-emerald-400 text-base">₹{Number(successData?.amount || paymentDetails?.finalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {successData?.paymentId && (
                  <div className="flex justify-between border-b border-slate-700/60 pb-2 font-mono">
                    <span className="text-slate-400">Payment ID:</span>
                    <span className="text-slate-300 truncate max-w-[180px]">{successData.paymentId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Portal Access:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={13} /> UNLOCKED
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigate(getPortalLoginPath(paymentDetails?.role || successData?.role))}
                className="w-full max-w-md mx-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm transition-all transform active:scale-98"
              >
                Proceed to Login & Open Dashboard <ArrowRight size={16} />
              </button>
            </motion.div>
          ) : (
            
            /* ── PAYMENT CHECKOUT FORM CARD ── */
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/90 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl"
            >
              {/* Card Banner Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 sm:p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-blue-200 text-xs font-black uppercase tracking-wider mb-1">
                    <Sparkles size={14} /> Mandatory Partner ID Activation
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-white">
                    ID Charge Payment
                  </h1>
                  <p className="text-xs text-blue-100 mt-1 max-w-lg">
                    Complete your one-time ID charge to unlock full platform features, AEPS, Recharge, BBPS, and commission wallet services.
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-7 space-y-6">
                
                {/* Error Banner if any */}
                {errorMessage && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3 text-rose-300 text-xs">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">Notice</p>
                      <p>{errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Cancelled Alert Banner */}
                {paymentStatus === 'CANCELLED' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between text-amber-300 text-xs">
                    <span>Payment was cancelled. You can retry anytime.</span>
                    <button onClick={handlePayNow} className="font-bold text-amber-400 underline">Retry</button>
                  </div>
                )}

                {/* User Info Grid */}
                <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-700/60 pb-1.5 flex items-center gap-1.5">
                    <UserIcon size={13} className="text-blue-400" /> Account Details
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Full Name</span>
                      <span className="font-bold text-white truncate block">{paymentDetails?.fullName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Mobile Number</span>
                      <span className="font-bold text-white font-mono">{paymentDetails?.mobile || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Assigned Role</span>
                      <span className="font-bold text-blue-400 uppercase">{paymentDetails?.role || roleParam || 'Retailer'}</span>
                    </div>
                  </div>
                </div>

                {/* Pricing Summary Card */}
                <div className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-inner">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-700/60 pb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={13} className="text-blue-400" /> Payment Summary
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ID Payment Status: {paymentDetails?.paymentStatus || 'PENDING'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between text-slate-300">
                      <span>Original ID Charge:</span>
                      <span className="font-semibold text-slate-200">
                        ₹{Number(paymentDetails?.originalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {Number(paymentDetails?.discountAmount || 0) > 0 && (
                      <div className="flex justify-between text-emerald-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <Tag size={12} /> Coupon Discount ({paymentDetails?.appliedCouponDiscountPercent}% OFF):
                        </span>
                        <span>
                          -₹{Number(paymentDetails?.discountAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="border-t border-slate-700/80 pt-2.5 flex justify-between items-baseline">
                      <span className="text-sm font-bold text-white">Final Payable Amount:</span>
                      <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 font-mono">
                        ₹{Number(paymentDetails?.finalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coupon Code Section */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Tag size={13} className="text-blue-400" /> Apply Discount Coupon (Optional)
                  </label>

                  {/* Admin Coupon Suggestion Banner if available */}
                  {paymentDetails?.appliedCouponCode && Number(paymentDetails?.discountAmount || 0) === 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs text-blue-300">
                      <span>Admin assigned coupon <strong>{paymentDetails.appliedCouponCode}</strong> ({paymentDetails.appliedCouponDiscountPercent}% OFF) for you!</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCouponCode(paymentDetails.appliedCouponCode);
                          handleApplyCoupon();
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1 rounded-lg text-[10px]"
                      >
                        Apply Now
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="e.g. RUP20"
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={couponApplying || !couponCode.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-md"
                    >
                      {couponApplying ? <RefreshCw size={13} className="animate-spin" /> : 'Apply Coupon'}
                    </button>
                  </form>

                  {couponMessage && (
                    <p className={`text-[11px] font-medium ${couponMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {couponMessage.text}
                    </p>
                  )}
                </div>

                {/* Pay Now Button */}
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={paying || !paymentDetails}
                  className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 disabled:opacity-60 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2.5 text-sm sm:text-base transition-all transform active:scale-99"
                >
                  {paying ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" /> Processing Razorpay Payment...
                    </>
                  ) : (
                    <>
                      <Lock size={16} /> Pay ₹{Number(paymentDetails?.finalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Now
                    </>
                  )}
                </button>

                {/* Footer Notes */}
                <div className="text-center text-[10px] text-slate-400 space-y-1 pt-1">
                  <p>Razorpay standard 100% secure payment gateway with Instant Verification.</p>
                  <p>Need assistance? Contact Rupiksha Support: <strong>+91 7004128310</strong></p>
                </div>

              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full bg-slate-900/90 border-t border-slate-800 py-3 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} RuPiKsha Digital Services Private Limited • All Rights Reserved.
      </footer>

    </div>
  );
}
