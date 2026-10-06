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
  Calendar,
  SlidersHorizontal,
  Save,
  Layers,
  Zap,
  Info,
  RotateCcw
} from 'lucide-react';
import { adminIdPaymentService } from '../../services/apiService';

export default function IdChargeManagement() {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'success' | 'setCharges'
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

  // Set ID Charges State
  const [roleCharges, setRoleCharges] = useState([]);
  const [chargeInputs, setChargeInputs] = useState({
    RETAILER: '2999',
    DISTRIBUTOR: '5999',
    SUPER_DISTRIBUTOR: '9999',
  });
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [savingCharges, setSavingCharges] = useState(false);
  const [chargeStatusMessage, setChargeStatusMessage] = useState(null);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [pendingRes, successRes, chargesRes] = await Promise.all([
        adminIdPaymentService.getPendingUsers(),
        adminIdPaymentService.getSuccessUsers(),
        adminIdPaymentService.getRoleCharges().catch(() => null),
      ]);

      if (pendingRes && pendingRes.users) {
        setPendingUsers(pendingRes.users);
      }
      if (successRes && successRes.users) {
        setSuccessUsers(successRes.users);
      }
      if (chargesRes && chargesRes.charges) {
        setRoleCharges(chargesRes.charges);
        const map = {};
        chargesRes.charges.forEach((c) => {
          map[c.role] = String(c.amount);
        });
        setChargeInputs((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.error('Failed to load ID charge data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleChargesOnly = async () => {
    try {
      setLoadingCharges(true);
      const res = await adminIdPaymentService.getRoleCharges();
      if (res && res.charges) {
        setRoleCharges(res.charges);
        const map = {};
        res.charges.forEach((c) => {
          map[c.role] = String(c.amount);
        });
        setChargeInputs((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.error('Failed to load role charges:', err);
    } finally {
      setLoadingCharges(false);
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
      const res = await adminIdPaymentService.generateCoupon(
        couponModalUser.id,
        selectedDiscount
      );
      setGeneratedCoupon(res);
      fetchAllData();
    } catch (err) {
      setCouponError(err.message || 'Failed to generate coupon code');
    } finally {
      setGeneratingCoupon(false);
    }
  };

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Handle Save Role Charges
  const handleSaveCharges = async (e) => {
    e?.preventDefault?.();
    try {
      setSavingCharges(true);
      setChargeStatusMessage(null);

      const rAmt = parseFloat(chargeInputs.RETAILER);
      const dAmt = parseFloat(chargeInputs.DISTRIBUTOR);
      const sdAmt = parseFloat(chargeInputs.SUPER_DISTRIBUTOR);

      if (isNaN(rAmt) || rAmt < 1 || isNaN(dAmt) || dAmt < 1 || isNaN(sdAmt) || sdAmt < 1) {
        setChargeStatusMessage({
          type: 'error',
          text: 'Please enter valid positive numbers (at least ₹1.00) for all partner roles.',
        });
        return;
      }

      const payload = {
        retailerCharge: rAmt,
        distributorCharge: dAmt,
        superDistributorCharge: sdAmt,
      };

      const res = await adminIdPaymentService.updateRoleCharges(payload);
      if (res && res.charges) {
        setRoleCharges(res.charges);
        const map = {};
        res.charges.forEach((c) => {
          map[c.role] = String(c.amount);
        });
        setChargeInputs((prev) => ({ ...prev, ...map }));
      }

      setChargeStatusMessage({
        type: 'success',
        text: 'ID Charges updated successfully! All new logins and registrations will now reflect these amounts.',
      });

      // Refresh pending list to update computed charges
      fetchAllData();
    } catch (err) {
      setChargeStatusMessage({
        type: 'error',
        text: err.message || 'Failed to update ID charges. Please try again.',
      });
    } finally {
      setSavingCharges(false);
    }
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
        minute: '2-digit',
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
            Monitor partner registration payments, set custom ID charges per role, and generate user-specific discount coupons.
          </p>
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold text-amber-600 uppercase block tracking-wider">
              Pending Activation
            </span>
            <span className="text-lg font-black text-amber-900">{pendingUsers.length}</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold text-emerald-600 uppercase block tracking-wider">
              Paid & Active
            </span>
            <span className="text-lg font-black text-emerald-900">{successUsers.length}</span>
          </div>

          <button
            onClick={activeTab === 'setCharges' ? fetchRoleChargesOnly : fetchAllData}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={loading || loadingCharges ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Tabs & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center p-1.5 bg-slate-200/80 rounded-2xl w-fit flex-wrap gap-1">
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
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-300 text-slate-700'
              }`}
            >
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
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-300 text-slate-700'
              }`}
            >
              {successUsers.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('setCharges');
              fetchRoleChargesOnly();
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'setCharges'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal size={14} className="text-blue-600" />
            Set ID Charges
          </button>
        </div>

        {/* Search & Role Filter (Only for Pending & Success tabs) */}
        {activeTab !== 'setCharges' && (
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
        )}
      </div>

      {/* ── TAB 1 & 2: Pending / Success Tables ── */}
      {activeTab !== 'setCharges' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Loading ID Charge records...
              </p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-700">
                No {activeTab === 'pending' ? 'Pending' : 'Completed'} Payments Found
              </h3>
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
                    <th className="py-4 px-4">
                      {activeTab === 'pending' ? 'Registered On' : 'Payment Date'}
                    </th>
                    <th className="py-4 px-4">Original Charge</th>
                    <th className="py-4 px-4">Discount</th>
                    <th className="py-4 px-4">
                      {activeTab === 'pending' ? 'Payable Amount' : 'Amount Paid'}
                    </th>
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
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black flex items-center justify-center text-xs shadow-sm">
                            {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {user.fullName || 'Unnamed Partner'}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                              <span>{user.mobile}</span>
                              {user.partyCode && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                                  {user.partyCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wider uppercase ${
                            user.role === 'SUPER_DISTRIBUTOR'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'DISTRIBUTOR'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-slate-500 font-medium">
                        {formatDate(
                          activeTab === 'pending' ? user.registrationDate : user.paymentDate
                        )}
                      </td>

                      {/* Original Amount */}
                      <td className="py-4 px-4 font-bold text-slate-700">
                        {formatCurrency(user.originalAmount)}
                      </td>

                      {/* Discount / Coupon */}
                      <td className="py-4 px-4">
                        {user.discountAmount > 0 || user.activeCouponCode || user.couponCode ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-emerald-600">
                              -{formatCurrency(user.discountAmount)}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                              {user.couponCode || user.activeCouponCode}
                              {user.activeCouponDiscountPercent
                                ? ` (${user.activeCouponDiscountPercent}%)`
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium">—</span>
                        )}
                      </td>

                      {/* Payable / Amount Paid */}
                      <td className="py-4 px-4">
                        <span
                          className={`font-black text-sm ${
                            activeTab === 'pending' ? 'text-amber-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatCurrency(
                            activeTab === 'pending' ? user.finalAmount : user.finalAmountPaid
                          )}
                        </span>
                      </td>

                      {/* Razorpay Ref (Success Tab Only) */}
                      {activeTab === 'success' && (
                        <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {user.razorpayPaymentId || 'N/A'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {user.razorpayOrderId}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${
                            activeTab === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              activeTab === 'pending' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          {activeTab === 'pending' ? 'PENDING' : 'PAID'}
                        </span>
                      </td>

                      {/* Action Buttons */}
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
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
                            >
                              <Gift size={13} />
                              Give Coupon
                            </button>
                          )}

                          <button
                            onClick={() => setDetailsModalUser(user)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                            title="View Details"
                          >
                            <Eye size={15} />
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
      )}

      {/* ── TAB 3: Set ID Charges Configuration ── */}
      {activeTab === 'setCharges' && (
        <div className="space-y-6">
          {/* Information & Alert Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300 text-[11px] font-bold uppercase tracking-wider">
                  <SlidersHorizontal size={13} /> Real-time Charge Management
                </div>
                <h2 className="text-xl font-black tracking-tight">
                  Configure Partner ID Activation Charges
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Set authoritative ID activation charges for all three partner tiers.
                  Changes reflect <strong>immediately</strong> in real-time — when any partner
                  attempts to log in or register, they will be prompted to pay exactly these amounts
                  on the Razorpay checkout screen.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setChargeInputs({
                      RETAILER: '2999',
                      DISTRIBUTOR: '5999',
                      SUPER_DISTRIBUTOR: '9999',
                    });
                  }}
                  type="button"
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={14} /> Reset Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Status Message */}
          <AnimatePresence>
            {chargeStatusMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between ${
                  chargeStatusMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {chargeStatusMessage.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600" />
                  )}
                  <span>{chargeStatusMessage.text}</span>
                </div>
                <button
                  onClick={() => setChargeStatusMessage(null)}
                  className="p-1 hover:bg-black/5 rounded-lg text-slate-500"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form with 3 Tier Cards */}
          <form onSubmit={handleSaveCharges} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 1. Retailer Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-slate-300 transition-all flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider">
                      Tier 1
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Base Partner</span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white font-bold flex items-center justify-center shadow-md">
                      <UserIcon size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Retailer</h3>
                      <p className="text-[11px] text-slate-400">Direct agent operations & AEPS</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    Authoritative ID Charge (INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={chargeInputs.RETAILER}
                      onChange={(e) =>
                        setChargeInputs((prev) => ({ ...prev, RETAILER: e.target.value }))
                      }
                      required
                      placeholder="2999.00"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-base font-black text-slate-900 focus:outline-none focus:border-blue-500 shadow-inner"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Default: ₹2,999.00</span>
                    <span className="font-bold text-slate-600">
                      Paise: {(parseFloat(chargeInputs.RETAILER || 0) * 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Distributor Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-blue-300 transition-all flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-xl text-[10px] font-black uppercase tracking-wider">
                      Tier 2
                    </span>
                    <span className="text-[11px] text-blue-600 font-medium">Network Manager</span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center shadow-md shadow-blue-500/20">
                      <Layers size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Distributor</h3>
                      <p className="text-[11px] text-slate-400">Retailer network management</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    Authoritative ID Charge (INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={chargeInputs.DISTRIBUTOR}
                      onChange={(e) =>
                        setChargeInputs((prev) => ({ ...prev, DISTRIBUTOR: e.target.value }))
                      }
                      required
                      placeholder="5999.00"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-base font-black text-slate-900 focus:outline-none focus:border-blue-500 shadow-inner"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Default: ₹5,999.00</span>
                    <span className="font-bold text-slate-600">
                      Paise: {(parseFloat(chargeInputs.DISTRIBUTOR || 0) * 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Super Distributor Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-purple-300 transition-all flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-xl text-[10px] font-black uppercase tracking-wider">
                      Tier 3
                    </span>
                    <span className="text-[11px] text-purple-600 font-medium">Master Partner</span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white font-bold flex items-center justify-center shadow-md shadow-purple-500/20">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Super Distributor</h3>
                      <p className="text-[11px] text-slate-400">Master hierarchy distribution</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    Authoritative ID Charge (INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={chargeInputs.SUPER_DISTRIBUTOR}
                      onChange={(e) =>
                        setChargeInputs((prev) => ({
                          ...prev,
                          SUPER_DISTRIBUTOR: e.target.value,
                        }))
                      }
                      required
                      placeholder="9999.00"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-base font-black text-slate-900 focus:outline-none focus:border-purple-500 shadow-inner"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Default: ₹9,999.00</span>
                    <span className="font-bold text-slate-600">
                      Paise: {(parseFloat(chargeInputs.SUPER_DISTRIBUTOR || 0) * 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Server-Authoritative Enforcement</h4>
                  <p className="text-[11px] text-slate-400">
                    Amounts are enforced server-side before Razorpay order creation to prevent browser tampering.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCharges}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {savingCharges ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Saving Changes...
                  </>
                ) : (
                  <>
                    <Save size={15} /> Save & Apply ID Charges
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── GIVE COUPON MODAL ── */}
      <AnimatePresence>
        {couponModalUser && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
                    <Gift size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black">Issue Discount Coupon</h3>
                    <p className="text-xs text-blue-100">
                      Generate a single-use 24-hr discount code
                    </p>
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
                {/* Target User Info Card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Target Partner
                    </span>
                    <span className="text-sm font-black text-slate-900 block">
                      {couponModalUser.fullName}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {couponModalUser.mobile} • {couponModalUser.role}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Payable
                    </span>
                    <span className="text-sm font-black text-amber-600">
                      {formatCurrency(couponModalUser.finalAmount)}
                    </span>
                  </div>
                </div>

                {!generatedCoupon ? (
                  <>
                    {/* Discount Tier Selector */}
                    <div>
                      <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-2">
                        Select Discount Percentage
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[10, 20, 30, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setSelectedDiscount(pct)}
                            className={`py-3 rounded-2xl text-xs font-black transition-all border ${
                              selectedDiscount === pct
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 scale-[1.02]'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {pct}% OFF
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Calculation Preview */}
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Original Charge:</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(couponModalUser.originalAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Discount ({selectedDiscount}%):</span>
                        <span>
                          -
                          {formatCurrency(
                            (couponModalUser.originalAmount * selectedDiscount) / 100
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-black pt-2 border-t border-blue-200 text-sm">
                        <span>New Payable Amount:</span>
                        <span className="text-blue-700">
                          {formatCurrency(
                            couponModalUser.originalAmount * (1 - selectedDiscount / 100)
                          )}
                        </span>
                      </div>
                    </div>

                    {couponError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-bold">
                        <AlertCircle size={15} /> {couponError}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setCouponModalUser(null)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={generatingCoupon}
                        onClick={handleGenerateCoupon}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-3 rounded-xl text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                      >
                        {generatingCoupon ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} /> Generate Code
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  /* Coupon Generated Success View */
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} />
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-900">Coupon Code Generated!</h4>
                      <p className="text-xs text-slate-500">
                        Share this code with the partner to apply at ID payment checkout.
                      </p>
                    </div>

                    {/* Code Display Card */}
                    <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                        One-Time Coupon Code
                      </span>
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl font-black font-mono tracking-widest text-emerald-400">
                          {generatedCoupon.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(generatedCoupon.code)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
                          title="Copy Code"
                        >
                          {copiedCode ? (
                            <Check size={16} className="text-emerald-400" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-center gap-4 pt-1 border-t border-slate-800">
                        <span>
                          Discount: <strong>{generatedCoupon.discountPercent}%</strong>
                        </span>
                        <span>
                          Validity: <strong>24 Hours</strong>
                        </span>
                        <span>
                          Single-Use: <strong>YES</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/91${couponModalUser.mobile}?text=${encodeURIComponent(
                          `Hello ${couponModalUser.fullName}, your Rupiksha ID Activation coupon is ${generatedCoupon.code} for ${generatedCoupon.discountPercent}% OFF. Valid for 24 hours. Complete your payment at https://rupiksha.in/id-payment?identifier=${couponModalUser.mobile}`
                        )}`}
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
                    <p className="text-[11px] text-slate-400 font-mono">
                      {detailsModalUser.partyCode || detailsModalUser.username}
                    </p>
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
                  <span className="font-bold text-slate-900 font-mono">
                    {detailsModalUser.mobile}
                  </span>
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
                  <span className="font-bold text-slate-900">
                    {formatCurrency(detailsModalUser.originalAmount)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Discount Amount:</span>
                  <span className="font-bold text-emerald-600">
                    -{formatCurrency(detailsModalUser.discountAmount)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Final Amount:</span>
                  <span className="font-black text-slate-900">
                    {formatCurrency(
                      detailsModalUser.finalAmount || detailsModalUser.finalAmountPaid
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Status:</span>
                  <span
                    className={`font-black ${
                      detailsModalUser.paymentStatus === 'SUCCESS'
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {detailsModalUser.paymentStatus}
                  </span>
                </div>
                {detailsModalUser.razorpayPaymentId && (
                  <div className="flex justify-between border-b border-slate-100 pb-2 font-mono">
                    <span className="text-slate-400">Payment ID:</span>
                    <span className="font-bold text-slate-900">
                      {detailsModalUser.razorpayPaymentId}
                    </span>
                  </div>
                )}
                {detailsModalUser.razorpayOrderId && (
                  <div className="flex justify-between border-b border-slate-100 pb-2 font-mono">
                    <span className="text-slate-400">Order ID:</span>
                    <span className="font-bold text-slate-900">
                      {detailsModalUser.razorpayOrderId}
                    </span>
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
