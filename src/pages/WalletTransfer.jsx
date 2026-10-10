import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Send, Search, RefreshCw, CheckCircle2, AlertCircle, 
    ArrowUpRight, ArrowDownLeft, ShieldCheck, UserCheck, 
    Copy, Check, FileText, Printer, ChevronLeft, ChevronRight,
    Coins, Building2, Phone, MapPin, Calendar, Clock, X, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { walletService, walletTransferService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';

export default function WalletTransfer() {
    const { user: currentUser } = useAuth();
    const { refreshBalance: refreshContextBalance } = useWallet();

    // Wallet State
    const [balance, setBalance] = useState(0);
    const [lockedBalance, setLockedBalance] = useState(0);
    const [availableBalance, setAvailableBalance] = useState(0);
    const [balanceLoading, setBalanceLoading] = useState(false);

    // Recipient Search State
    const [searchMobile, setSearchMobile] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [selectedRecipient, setSelectedRecipient] = useState(null);

    // Transfer Form State
    const [amount, setAmount] = useState('');
    const [remarks, setRemarks] = useState('');
    const [formError, setFormError] = useState('');

    // Confirmation & Transfer Execution State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [transferSuccessData, setTransferSuccessData] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Transfer History State
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [directionFilter, setDirectionFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);

    // Receipt Modal for History Item
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [copiedRef, setCopiedRef] = useState(false);

    // Load Balance
    const fetchBalance = useCallback(async () => {
        if (!currentUser?.id) return;
        setBalanceLoading(true);
        try {
            const data = await walletService.getBalance(currentUser.id);
            if (data) {
                const bal = Number(data.balance || 0);
                const locked = Number(data.lockedAmount || data.lockedBalance || 0);
                const avail = Number(data.availableBalance ?? (bal - locked));
                setBalance(bal);
                setLockedBalance(locked);
                setAvailableBalance(avail);
            }
        } catch (err) {
            console.error('Failed to load wallet balance:', err);
        } finally {
            setBalanceLoading(false);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    // Load Transfer History
    const fetchHistory = useCallback(async (targetPage = page) => {
        setHistoryLoading(true);
        try {
            const res = await walletTransferService.getHistory({
                direction: directionFilter !== 'ALL' ? directionFilter : undefined,
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                search: searchTerm.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                page: targetPage,
                size: 10,
                sortBy: 'createdAt',
                sortDirection: 'desc'
            });

            if (res && res.success) {
                setHistory(res.data || []);
                setTotalPages(res.totalPages || 1);
                setTotalElements(res.totalElements || 0);
                setPage(res.page || 0);
            } else {
                setHistory([]);
            }
        } catch (err) {
            console.error('Failed to load transfer history:', err);
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    }, [directionFilter, statusFilter, searchTerm, startDate, endDate, page]);

    useEffect(() => {
        fetchHistory(0);
    }, [directionFilter, statusFilter, startDate, endDate]);

    // Handle Recipient Search
    const handleSearchRecipient = async (e) => {
        if (e) e.preventDefault();
        const cleanNumber = searchMobile.replace(/\D/g, '');
        if (cleanNumber.length !== 10) {
            setSearchError('Please enter a valid 10-digit mobile number');
            setSearchResult(null);
            return;
        }

        setSearchLoading(true);
        setSearchError('');
        setSearchResult(null);
        setSelectedRecipient(null);

        try {
            const res = await walletTransferService.searchRecipient(cleanNumber);
            if (res && res.success && res.data) {
                setSearchResult(res.data);
            } else {
                setSearchError(res?.message || 'No Rupiksha user found with this mobile number.');
            }
        } catch (err) {
            setSearchError(err.message || 'No Rupiksha user found with this mobile number.');
        } finally {
            setSearchLoading(false);
        }
    };

    // Quick Amount Chips
    const handleQuickAmount = (val) => {
        if (val === 'ALL') {
            setAmount(availableBalance.toFixed(2));
        } else {
            setAmount(String(val));
        }
        setFormError('');
    };

    // Review Transfer Action
    const handleReviewTransfer = () => {
        setFormError('');
        const numAmount = parseFloat(amount);

        if (!selectedRecipient) {
            setFormError('Please search and select an eligible recipient');
            return;
        }

        if (isNaN(numAmount) || numAmount <= 0) {
            setFormError('Please enter a valid transfer amount (min ₹1.00)');
            return;
        }

        if (numAmount > availableBalance) {
            setFormError(`Insufficient wallet balance. Maximum transferable amount is ₹${availableBalance.toFixed(2)}`);
            return;
        }

        setShowConfirmModal(true);
    };

    // Execute Transfer
    const handleExecuteTransfer = async () => {
        if (transferring) return;
        setTransferring(true);
        setFormError('');

        try {
            const res = await walletTransferService.transfer({
                recipientId: selectedRecipient.id,
                recipientMobile: selectedRecipient.mobile,
                amount: parseFloat(amount),
                remarks: remarks.trim() || 'Wallet Transfer'
            });

            if (res && res.success && res.data) {
                setTransferSuccessData(res.data);
                setShowConfirmModal(false);
                setShowSuccessModal(true);

                // Reset form
                setAmount('');
                setRemarks('');
                setSelectedRecipient(null);
                setSearchResult(null);
                setSearchMobile('');

                // Refresh balance & history
                fetchBalance();
                if (refreshContextBalance) refreshContextBalance();
                fetchHistory(0);
            } else {
                setFormError(res?.message || 'Transfer failed. Please try again.');
                setShowConfirmModal(false);
            }
        } catch (err) {
            setFormError(err.message || 'Failed to complete wallet transfer');
            setShowConfirmModal(false);
        } finally {
            setTransferring(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-['Inter',sans-serif] space-y-8">
            {/* 1. Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl shadow-md">
                            <Coins size={24} className="stroke-[2.2]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Wallet to Wallet</h1>
                            <p className="text-xs sm:text-sm text-slate-500 font-medium">Transfer funds securely to another Rupiksha wallet.</p>
                        </div>
                    </div>
                </div>

                {/* Available Balance Header Badge */}
                <div className="flex items-center gap-3 bg-white p-2.5 px-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex flex-col">
                        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Available Balance</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-slate-900">
                                ₹{balanceLoading ? '...' : availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={fetchBalance}
                        disabled={balanceLoading}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        title="Refresh Balance"
                    >
                        <RefreshCw size={16} className={balanceLoading ? 'animate-spin text-blue-600' : ''} />
                    </button>
                </div>
            </div>

            {/* 2. Main Transfer Section (Two-Column Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Recipient Search & Selection */}
                <div className="lg:col-span-6 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">1</span>
                                <h2 className="text-base font-black text-slate-900">Search Recipient</h2>
                            </div>
                            {selectedRecipient && (
                                <button
                                    onClick={() => {
                                        setSelectedRecipient(null);
                                        setSearchResult(null);
                                        setSearchMobile('');
                                    }}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                                >
                                    Change Recipient
                                </button>
                            )}
                        </div>

                        {!selectedRecipient ? (
                            <>
                                <form onSubmit={handleSearchRecipient} className="space-y-4">
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                        Search by registered mobile number
                                    </label>
                                    <div className="relative flex items-center">
                                        <div className="absolute left-3.5 flex items-center gap-1 text-slate-400 font-bold text-sm">
                                            <span>+91</span>
                                            <span className="text-slate-300">|</span>
                                        </div>
                                        <input
                                            type="tel"
                                            maxLength={10}
                                            value={searchMobile}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setSearchMobile(val);
                                                setSearchError('');
                                                if (val.length === 10) {
                                                    // Auto-trigger search when 10 digits entered
                                                    setTimeout(() => handleSearchRecipient(), 100);
                                                }
                                            }}
                                            placeholder="Enter 10-digit mobile number"
                                            className="w-full pl-16 pr-24 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-sm font-black text-slate-900 transition-all outline-none"
                                        />
                                        <button
                                            type="submit"
                                            disabled={searchLoading || searchMobile.length !== 10}
                                            className="absolute right-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                                        >
                                            {searchLoading ? (
                                                <RefreshCw size={14} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <Search size={14} />
                                                    <span>Search</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>

                                {searchError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2"
                                    >
                                        <AlertCircle size={16} className="shrink-0 text-rose-600" />
                                        <span>{searchError}</span>
                                    </motion.div>
                                )}

                                {/* Search Result Card (Before Selecting) */}
                                {searchResult && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="border border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white rounded-xl p-4.5 space-y-4"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-black text-slate-900">{searchResult.fullName}</h3>
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-extrabold text-[10px] rounded-full uppercase">
                                                        {searchResult.role}
                                                    </span>
                                                </div>
                                                {searchResult.businessName && searchResult.businessName !== searchResult.fullName && (
                                                    <p className="text-xs text-slate-600 font-bold mt-0.5">{searchResult.businessName}</p>
                                                )}
                                            </div>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-full">
                                                <UserCheck size={12} />
                                                Verified
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Party Code</span>
                                                <p className="font-black text-slate-800">{searchResult.partyCode || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Registered Mobile</span>
                                                <p className="font-black text-slate-800">{searchResult.mobile}</p>
                                            </div>
                                            {(searchResult.city || searchResult.stateName) && (
                                                <div className="col-span-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
                                                    <p className="font-bold text-slate-700 truncate">
                                                        {[searchResult.city, searchResult.stateName].filter(Boolean).join(', ')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedRecipient(searchResult)}
                                            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <span>Select this Recipient</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    </motion.div>
                                )}
                            </>
                        ) : (
                            /* Confirmed Selected Recipient Card */
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4.5 space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                                            {selectedRecipient.fullName?.slice(0, 2).toUpperCase() || 'RX'}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900">{selectedRecipient.fullName}</h3>
                                            <p className="text-[11px] font-bold text-slate-500">{selectedRecipient.businessName}</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-full uppercase">
                                        {selectedRecipient.role}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-200/60">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Party Code</span>
                                        <p className="font-black text-emerald-950 font-mono">{selectedRecipient.partyCode || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Full Mobile No.</span>
                                        <p className="font-black text-slate-800 font-mono">{selectedRecipient.mobile}</p>
                                    </div>
                                    {(selectedRecipient.city || selectedRecipient.stateName) && (
                                        <div className="col-span-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Registered Location</span>
                                            <p className="font-bold text-slate-700 truncate">
                                                {[selectedRecipient.city, selectedRecipient.stateName].filter(Boolean).join(', ')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Right: Transfer Amount & Action Form */}
                <div className="lg:col-span-6 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">2</span>
                            <h2 className="text-base font-black text-slate-900">Transfer Amount</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                                    Amount to Transfer (INR)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">₹</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="any"
                                        value={amount}
                                        onChange={(e) => {
                                            setAmount(e.target.value);
                                            setFormError('');
                                        }}
                                        placeholder="0.00"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-lg font-black text-slate-900 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            {/* Quick Amount Chips */}
                            <div>
                                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Quick Select</span>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                    {[100, 500, 1000, 2000, 5000].map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => handleQuickAmount(val)}
                                            className="px-3 py-1.5 text-xs font-black rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 transition cursor-pointer"
                                        >
                                            ₹{val.toLocaleString('en-IN')}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => handleQuickAmount('ALL')}
                                        className="px-3 py-1.5 text-xs font-black rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                                    >
                                        All Balance
                                    </button>
                                </div>
                            </div>

                            {/* Optional Remarks */}
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                    Remarks / Narration (Optional)
                                </label>
                                <input
                                    type="text"
                                    maxLength={100}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="e.g. Wallet top-up / settlement"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-900 transition-all outline-none"
                                />
                            </div>

                            {/* Error Alert */}
                            {formError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2"
                                >
                                    <AlertCircle size={15} className="shrink-0 text-rose-600" />
                                    <span>{formError}</span>
                                </motion.div>
                            )}

                            {/* Breakdown Summary */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                                <div className="flex justify-between text-slate-500 font-bold">
                                    <span>Transfer Amount:</span>
                                    <span className="text-slate-900 font-black">₹{parseFloat(amount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-500 font-bold">
                                    <span>Transfer Fee:</span>
                                    <span className="text-emerald-600 font-black">₹0.00 (Free)</span>
                                </div>
                                <div className="flex justify-between text-slate-900 font-black border-t border-slate-200 pt-2 text-sm">
                                    <span>Total Debit:</span>
                                    <span className="text-blue-600">₹{parseFloat(amount || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Review & Continue Button */}
                            <button
                                type="button"
                                onClick={handleReviewTransfer}
                                disabled={!selectedRecipient || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableBalance}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 disabled:opacity-50 text-white text-sm font-black rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
                                <span>Review & Transfer</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Confirmation Review Modal */}
            <AnimatePresence>
                {showConfirmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 relative"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="text-blue-600" size={22} />
                                    <h3 className="text-base font-black text-slate-900">Confirm Wallet Transfer</h3>
                                </div>
                                <button
                                    onClick={() => !transferring && setShowConfirmModal(false)}
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Recipient Name:</span>
                                    <span className="text-slate-900 font-black">{selectedRecipient?.fullName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Party Code:</span>
                                    <span className="text-slate-900 font-mono font-black">{selectedRecipient?.partyCode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Recipient Mobile:</span>
                                    <span className="text-slate-900 font-mono font-bold">{selectedRecipient?.mobile}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Recipient Role:</span>
                                    <span className="text-indigo-700 font-black uppercase text-[10px]">{selectedRecipient?.role}</span>
                                </div>
                            </div>

                            <div className="space-y-2 text-xs border-y border-slate-100 py-3">
                                <div className="flex justify-between text-slate-600 font-bold">
                                    <span>Transfer Amount:</span>
                                    <span className="text-slate-900 font-black">₹{parseFloat(amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600 font-bold">
                                    <span>Platform Fee:</span>
                                    <span className="text-emerald-600 font-black">₹0.00</span>
                                </div>
                                <div className="flex justify-between text-slate-900 font-black text-sm pt-1">
                                    <span>Total Debit Amount:</span>
                                    <span className="text-blue-600">₹{parseFloat(amount).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmModal(false)}
                                    disabled={transferring}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteTransfer}
                                    disabled={transferring}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {transferring ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            <span>Confirm & Send</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 4. Success Receipt Modal */}
            <AnimatePresence>
                {showSuccessModal && transferSuccessData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 text-center"
                        >
                            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                <CheckCircle2 size={32} className="stroke-[2.5]" />
                            </div>

                            <div>
                                <h3 className="text-xl font-black text-slate-900">Transfer Successful!</h3>
                                <p className="text-xs text-slate-500 font-bold mt-1">Funds have been credited instantly.</p>
                            </div>

                            <div className="text-2xl font-black text-slate-900 font-mono">
                                ₹{Number(transferSuccessData.amount || 0).toFixed(2)}
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5 text-left">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-bold">Transaction Ref:</span>
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono font-black text-slate-900">{transferSuccessData.transferReference}</span>
                                        <button
                                            onClick={() => copyToClipboard(transferSuccessData.transferReference)}
                                            className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                                            title="Copy Reference"
                                        >
                                            {copiedRef ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Recipient:</span>
                                    <span className="font-black text-slate-900">{transferSuccessData.recipientName} ({transferSuccessData.recipientPartyCode})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Recipient Mobile:</span>
                                    <span className="font-mono font-bold text-slate-800">{transferSuccessData.recipientMobile}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Updated Balance:</span>
                                    <span className="font-black text-emerald-600 font-mono">₹{Number(transferSuccessData.senderBalance || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Date & Time:</span>
                                    <span className="font-bold text-slate-700">{new Date(transferSuccessData.createdAt).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handlePrintReceipt}
                                    className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Printer size={14} />
                                    <span>Print Receipt</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSuccessModal(false)}
                                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 5. Transfer History Section */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Transfer History</h2>
                        <p className="text-xs text-slate-500 font-medium">All sent and received wallet-to-wallet transactions.</p>
                    </div>

                    {/* Direction Tabs */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-black">
                        {['ALL', 'SENT', 'RECEIVED'].map((dir) => (
                            <button
                                key={dir}
                                onClick={() => setDirectionFilter(dir)}
                                className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                                    directionFilter === dir
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                {dir === 'ALL' ? 'All' : dir === 'SENT' ? 'Sent' : 'Received'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchHistory(0)}
                            placeholder="Search reference, party code, name..."
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                        >
                            <option value="ALL">All Status</option>
                            <option value="SUCCESS">Success</option>
                            <option value="FAILED">Failed</option>
                        </select>
                    </div>

                    <div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Reference / Date</th>
                                <th className="px-4 py-3">Direction</th>
                                <th className="px-4 py-3">Counterparty</th>
                                <th className="px-4 py-3">Party Code</th>
                                <th className="px-4 py-3">Amount</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Receipt</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {historyLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold">
                                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                                        Loading transfers...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold">
                                        No wallet transfers found matching the criteria.
                                    </td>
                                </tr>
                            ) : (
                                history.map((item) => {
                                    const isSent = item.direction === 'SENT';
                                    return (
                                        <tr key={item.id || item.transferReference} className="hover:bg-slate-50/80 transition">
                                            <td className="px-4 py-3">
                                                <div className="font-mono font-black text-slate-900">{item.transferReference}</div>
                                                <div className="text-[10px] text-slate-400 font-bold">{new Date(item.createdAt).toLocaleString()}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                    isSent ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    {isSent ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                    {isSent ? 'Sent' : 'Received'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-black text-slate-900">{isSent ? item.recipientName : item.senderName}</div>
                                                <div className="text-[10px] font-mono text-slate-500">{isSent ? item.recipientMobile : item.senderMobile}</div>
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-slate-700">
                                                {isSent ? item.recipientPartyCode : item.senderPartyCode}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-black font-mono ${isSent ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {isSent ? '-' : '+'}₹{Number(item.amount || 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-full uppercase">
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setSelectedHistoryItem(item)}
                                                    className="px-2.5 py-1 text-[11px] font-black text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-slate-500 font-bold">
                            Showing page {page + 1} of {totalPages} ({totalElements} total records)
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => fetchHistory(page - 1)}
                                disabled={page === 0 || historyLoading}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => fetchHistory(page + 1)}
                                disabled={page >= totalPages - 1 || historyLoading}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 6. History Item Receipt Modal */}
            <AnimatePresence>
                {selectedHistoryItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="text-base font-black text-slate-900">Transfer Receipt</h3>
                                <button
                                    onClick={() => setSelectedHistoryItem(null)}
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Reference ID:</span>
                                    <span className="font-mono font-black text-slate-900">{selectedHistoryItem.transferReference}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Direction:</span>
                                    <span className="font-black">{selectedHistoryItem.direction}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Sender:</span>
                                    <span className="font-black text-slate-900">{selectedHistoryItem.senderName} ({selectedHistoryItem.senderPartyCode})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Recipient:</span>
                                    <span className="font-black text-slate-900">{selectedHistoryItem.recipientName} ({selectedHistoryItem.recipientPartyCode})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Amount:</span>
                                    <span className="font-mono font-black text-slate-900">₹{Number(selectedHistoryItem.amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Status:</span>
                                    <span className="font-black text-emerald-600">{selectedHistoryItem.status}</span>
                                </div>
                                {selectedHistoryItem.remarks && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-bold">Remarks:</span>
                                        <span className="font-medium text-slate-700">{selectedHistoryItem.remarks}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Date:</span>
                                    <span className="font-bold text-slate-700">{new Date(selectedHistoryItem.createdAt).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handlePrintReceipt}
                                    className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Printer size={14} />
                                    <span>Print</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedHistoryItem(null)}
                                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
