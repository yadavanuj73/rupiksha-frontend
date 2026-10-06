import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Tag,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Gift,
  Copy,
  Check,
  Eye,
  X,
  Sparkles,
  AlertCircle,
  Phone,
  Mail,
  User as UserIcon,
  Send,
  ExternalLink,
  IndianRupee,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { adminIdPaymentService } from '../../services/apiService';

export default function IdChargeManagement() {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'success'
  const [pendingUsers, setPendingUsers] = useState([]);
  const [successUsers, setSuccessUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Coupon Generation Modal State
  const [couponModalUser, setCouponModalUser] = useState(null);
  const [selectedDiscount, setSelectedDiscount] = useState(20);
  const [generatingCoupon, setGeneratingCoupon] = useState(false);
  const [generatedCoupon, setGeneratedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // User Details Modal State
  const [detailsModalUser, setDetailsModalUser] = useState(null);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [pendingRes, successRes] = await Promise.all([
        adminIdPaymentService.getPendingUsers(),
        adminIdPaymentService.getSuccessUsers(),
      ]);

      if (pendingRes && pendingRes.users) {
        setPendingUsers(pendingRes.users);
      }
      if (successRes && successRes.users) {
        setSuccessUsers(successRes.users);
      }
    } catch (err) {
      console.error('Failed to load ID charge data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter Logic
  const filterList = (list) => {
    return list.filter((user) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (user.fullName && user.fullName.toLowerCase().includes(q)) ||
        (user.username && user.username.toLowerCase().includes(q)) ||
        (user.mobile && user.mobile.includes(q)) ||
        (user.partyCode && user.partyCode.toLowerCase().includes(q)) ||
        (user.email && user.email.toLowerCase().includes(q)) ||
        (user.razorpayPaymentId && user.razorpayPaymentId.toLowerCase().includes(q)) ||
        (user.razorpayOrderId && user.razorpayOrderId.toLowerCase().includes(q));

      const matchesRole =
        roleFilter === 'ALL' ||
        String(user.role).toUpperCase() === roleFilter.toUpperCase();

      return matchesSearch && matchesRole;
    });
  };

  const currentList = activeTab === 'pending' ? filterList(pendingUsers) : filterList(successUsers);

  // Handle Generate Coupon
  const handleGenerateCoupon = async () => {
    if (!couponModalUser) return;
    try {
      setGeneratingCoupon(true);
      setCouponError('');
      const res = await adminIdPaymentService.generateCoupon(couponModalUser.id, Number(selectedDiscount));
      if (res && res.code) {
        setGeneratedCoupon(res);
        // Refresh list in background
        fetchAllData();
      } else {
        setCouponError(res?.message || 'Failed to generate coupon.');
      }
    } catch (err) {
      setCouponError(err.message || 'Error creating coupon.');
    } finally {
      setGeneratingCoupon(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const getRoleBadgeColor = (role) => {
    const r = String(role || '').toUpperCase();
    if (r === 'SUPER_DISTRIBUTOR') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (r === 'DISTRIBUTOR') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  const formatCurrency = (amt) => {
    return `₹${Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ── Top Header Banner ── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase tracking-wider mb-1">
            <CreditCard size={15} /> Partner Management Operations
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            ID Charge & Coupon Control
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor partner registration payments, control ID charges, and generate user-specific discount coupons.
          </p>
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold text-amber-600 uppercase block tracking-wider">Pending Activation</span>
            <span className="text-lg font-black text-amber-900">{pendingUsers.length}</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold text-emerald-600 uppercase block tracking-wider">Paid & Active</span>
            <span className="text-lg font-black text-emerald-900">{successUsers.length}</span>
          </div>

          <button
            onClick={fetchAllData}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Tabs & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Navigation Tabs */}
        <div className="flex items-center p-1.5 bg-slate-200/80 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={14} className="text-amber-500" />
            Pending Payment
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-300 text-slate-700'
            }`}>
              {pendingUsers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('success')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'success'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 size={14} className="text-emerald-500" />
            Success Payment
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-300 text-slate-700'
            }`}>
              {successUsers.length}
            </span>
          </button>
        </div>

        {/* Search & Role Filter */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, mobile, code..."
              className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-64 shadow-sm"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
          >
            <option value="ALL">All Roles</option>
            <option value="RETAILER">Retailer</option>
            <option value="DISTRIBUTOR">Distributor</option>
            <option value="SUPER_DISTRIBUTOR">Super Distributor</option>
          </select>
        </div>

      </div>

      {/* ── Table Container ── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading ID Charge records...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No {activeTab === 'pending' ? 'Pending' : 'Completed'} Payments Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || roleFilter !== 'ALL'
                ? 'Try adjusting your search criteria or role filters.'
                : activeTab === 'pending'
                ? 'All registered users have completed their ID Charge payments.'
                : 'No successful ID Charge payments recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-5">Partner Details</th>
                  <th className="py-4 px-4">Role</th>
                  <th className="py-4 px-4">{activeTab === 'pending' ? 'Registered On' : 'Payment Date'}</th>
                  <th className="py-4 px-4">Original Charge</th>
                  <th className="py-4 px-4">Discount</th>
                  <th className="py-4 px-4">{activeTab === 'pending' ? 'Payable Amount' : 'Amount Paid'}</th>
                  {activeTab === 'success' && <th className="py-4 px-4">Razorpay Reference</th>}
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentList.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* User Details */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-black flex items-center justify-center shrink-0">
                          {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900">{user.fullName || 'N/A'}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                            <span>{user.mobile}</span>
                            {user.partyCode && (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-bold">
                                {user.partyCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getRoleBadgeColor(user.role)}`}>
                        {user.role ? String(user.role).replace(/_/g, ' ') : 'RETAILER'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-4 px-4 text-[11px] text-slate-500">
                      {formatDate(activeTab === 'pending' ? user.registrationDate : user.paymentDate)}
                    </td>

                    {/* Original Charge */}
                    <td className="py-4 px-4 font-semibold text-slate-700">
                      {formatCurrency(user.originalAmount)}
                    </td>

                    {/* Discount */}
                    <td className="py-4 px-4">
                      {Number(user.discountAmount || 0) > 0 ? (
                        <div className="space-y-0.5">
                          <span className="text-emerald-600 font-bold">
                            -{formatCurrency(user.discountAmount)}
                          </span>
                          {user.activeCouponCode && (
                            <span className="block text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit border border-blue-100">
                              {user.activeCouponCode} ({user.activeCouponDiscountPercent}%)
                            </span>
                          )}
                          {user.couponCode && (
                            <span className="block text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit border border-blue-100">
                              {user.couponCode}
                            </span>
                          )}
                        </div>
                      ) : user.activeCouponCode ? (
                        <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {user.activeCouponCode} ({user.activeCouponDiscountPercent}% ready)
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Final Amount */}
                    <td className="py-4 px-4">
                      <span className="text-sm font-black text-slate-900">
                        {formatCurrency(activeTab === 'pending' ? user.finalAmount : user.finalAmountPaid)}
                      </span>
                    </td>

                    {/* Razorpay Ref (Success tab only) */}
                    {activeTab === 'success' && (
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-500 space-y-0.5">
                        <p className="truncate max-w-[140px]" title={user.razorpayPaymentId}>
                          {user.razorpayPaymentId || 'N/A'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]" title={user.razorpayOrderId}>
                          {user.razorpayOrderId}
                        </p>
                      </td>
                    )}

                    {/* Status */}
                    <td className="py-4 px-4">
                      {activeTab === 'pending' ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit">
                          <Clock size={11} /> PENDING
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit">
                          <CheckCircle2 size={11} /> SUCCESS
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {activeTab === 'pending' && (
                          <button
                            onClick={() => {
                              setCouponModalUser(user);
                              setGeneratedCoupon(null);
                              setCouponError('');
                              setSelectedDiscount(20);
                            }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                          >
                            <Gift size={13} /> Give Coupon
                          </button>
                        )}

                        <button
                          onClick={() => setDetailsModalUser(user)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                          title="View Details"
                        >
                          <Eye size={13} /> Details
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── GIVE COUPON MODAL ── */}
      <AnimatePresence>
        {couponModalUser && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Gift size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black">Generate Discount Coupon</h3>
                    <p className="text-[11px] text-blue-100">For user: {couponModalUser.fullName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setCouponModalUser(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                
                {/* User Info Overview */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-1.5 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Partner Name:</span>
                    <span className="font-bold text-slate-900">{couponModalUser.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Mobile Number:</span>
                    <span className="font-mono font-bold text-slate-900">{couponModalUser.mobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Role:</span>
                    <span className="font-bold text-blue-600 uppercase">{couponModalUser.role}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-slate-400 font-medium">Original ID Charge:</span>
                    <span className="font-black text-slate-900">{formatCurrency(couponModalUser.originalAmount)}</span>
                  </div>
                </div>

                {!generatedCoupon ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-2">
                        Select Discount Percentage:
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[10, 20, 30, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setSelectedDiscount(pct)}
                            className={`py-3 rounded-xl font-black text-xs transition-all border ${
                              selectedDiscount === pct
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 scale-105'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {pct}% OFF
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Calculated Preview */}
                    <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 text-xs space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Discount ({selectedDiscount}%):</span>
                        <span className="font-bold text-emerald-600">
                          -{formatCurrency((Number(couponModalUser.originalAmount) * selectedDiscount) / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-bold border-t border-blue-200/60 pt-1">
                        <span>New Payable Amount:</span>
                        <span className="text-blue-700 font-black">
                          {formatCurrency(Number(couponModalUser.originalAmount) * (1 - selectedDiscount / 100))}
                        </span>
                      </div>
                    </div>

                    {couponError && (
                      <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                        {couponError}
                      </p>
                    )}

                    <button
                      onClick={handleGenerateCoupon}
                      disabled={generatingCoupon}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {generatingCoupon ? <RefreshCw size={14} className="animate-spin" /> : <>Generate Coupon Code <Sparkles size={14} /></>}
                    </button>
                  </div>
                ) : (
                  
                  /* Generated Success Card */
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} />
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-900">Coupon Generated Successfully!</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Share this code with the partner to complete payment.</p>
                    </div>

                    <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 border border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">COUPON CODE</span>
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl font-black font-mono tracking-widest text-emerald-400">
                          {generatedCoupon.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(generatedCoupon.code)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
                          title="Copy Code"
                        >
                          {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-center gap-4 pt-1 border-t border-slate-800">
                        <span>Discount: <strong>{generatedCoupon.discountPercent}%</strong></span>
                        <span>Validity: <strong>24 Hours</strong></span>
                        <span>Single-Use: <strong>YES</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/91${couponModalUser.mobile}?text=${encodeURIComponent(`Hello ${couponModalUser.fullName}, your Rupiksha ID Activation coupon is ${generatedCoupon.code} for ${generatedCoupon.discountPercent}% OFF. Valid for 24 hours. Complete your payment at https://rupiksha.in/id-payment?identifier=${couponModalUser.mobile}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
                      >
                        <Send size={14} /> Send via WhatsApp
                      </a>

                      <button
                        onClick={() => setCouponModalUser(null)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-5 rounded-xl text-xs transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── USER DETAILS MODAL ── */}
      <AnimatePresence>
        {detailsModalUser && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
                    <UserIcon size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">{detailsModalUser.fullName}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{detailsModalUser.partyCode || detailsModalUser.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailsModalUser(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-3 text-xs text-slate-700">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Mobile:</span>
                  <span className="font-bold text-slate-900 font-mono">{detailsModalUser.mobile}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-bold text-slate-900">{detailsModalUser.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Role:</span>
                  <span className="font-bold text-blue-600 uppercase">{detailsModalUser.role}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Original ID Charge:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(detailsModalUser.originalAmount)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Discount Amount:</span>
                  <span className="font-bold text-emerald-600">-{formatCurrency(detailsModalUser.discountAmount)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Final Amount:</span>
                  <span className="font-black text-slate-900">{formatCurrency(detailsModalUser.finalAmount || detailsModalUser.finalAmountPaid)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-black ${detailsModalUser.paymentStatus === 'SUCCESS' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {detailsModalUser.paymentStatus}
                  </span>
                </div>
                {detailsModalUser.razorpayPaymentId && (
                  <div className="flex justify-between border-b border-slate-100 pb-2 font-mono">
                    <span className="text-slate-400">Payment ID:</span>
                    <span className="font-bold text-slate-900">{detailsModalUser.razorpayPaymentId}</span>
                  </div>
                )}
                {detailsModalUser.razorpayOrderId && (
                  <div className="flex justify-between border-b border-slate-100 pb-2 font-mono">
                    <span className="text-slate-400">Order ID:</span>
                    <span className="font-bold text-slate-900">{detailsModalUser.razorpayOrderId}</span>
                  </div>
                )}

                <div className="pt-3">
                  <button
                    onClick={() => setDetailsModalUser(null)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
