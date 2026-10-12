import React, { useState, useEffect, useCallback } from 'react';
import {
    Send, Search, RefreshCw, CheckCircle2, AlertCircle, 
    ShieldCheck, UserCheck, Copy, Check, Printer, 
    Coins, ArrowRight, X, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { walletService, walletTransferService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';

export default function WalletTransfer() {
    const { user: currentUser } = useAuth();
    const { refreshWallet } = useWallet();
    const navigate = useNavigate();

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

                // Immediately update local page balance if senderBalance is returned
                if (res.data?.senderBalance !== undefined && res.data?.senderBalance !== null) {
                    const newBal = Number(res.data.senderBalance);
                    setBalance(newBal);
                    setAvailableBalance(newBal - lockedBalance);

                    // Update localStorage caches for header and navbar
                    try {
                        if (currentUser?.id) {
                            localStorage.setItem(`rupiksha_wallet_${currentUser.id}`, newBal.toFixed(2));
                        }
                        if (currentUser?.username) {
                            localStorage.setItem(`rupiksha_wallet_${currentUser.username}`, newBal.toFixed(2));
                        }
                        if (currentUser?.mobile) {
                            localStorage.setItem(`rupiksha_wallet_${currentUser.mobile}`, newBal.toFixed(2));
                        }
                        const sessionRaw = localStorage.getItem('rupiksha_user');
                        if (sessionRaw) {
                            const sessionUser = JSON.parse(sessionRaw);
                            sessionUser.balance = newBal.toFixed(2);
                            sessionUser.walletBalance = newBal.toFixed(2);
                            localStorage.setItem('rupiksha_user', JSON.stringify(sessionUser));
                        }
                    } catch (_) {}
                }

                // Refresh global wallet context & dispatch event for header / all components
                if (refreshWallet) {
                    try {
                        await refreshWallet();
                    } catch (_) {}
                }
                window.dispatchEvent(new Event('walletUpdated'));
                window.dispatchEvent(new Event('storage'));
                fetchBalance();
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

    // Determine Transfer History Route based on role
    const getHistoryPageRoute = () => {
        const roles = (Array.isArray(currentUser?.roles) && currentUser.roles.length ? currentUser.roles : [currentUser?.role])
            .map(r => String(typeof r === 'string' ? r : r?.name || '').trim().toUpperCase());
        if (roles.includes('SUPER_DISTRIBUTOR')) return '/super-distributor/transactions/wallet-to-wallet';
        if (roles.includes('DISTRIBUTOR')) return '/distributor/transactions/wallet-to-wallet';
        return '/transactions/wallet-to-wallet';
    };

    return (
        <div className="p-2.5 sm:p-4 lg:p-5 max-w-6xl mx-auto font-['Inter',sans-serif] space-y-3 sm:space-y-4 overflow-x-hidden">
            {/* 1. Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl shadow-xs">
                            <Coins size={20} className="stroke-[2.2]" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Wallet to Wallet</h1>
                            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Transfer funds securely to another Rupiksha wallet.</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => navigate(getHistoryPageRoute())}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                        <History size={14} />
                        <span>View History</span>
                    </button>

                    <div className="flex items-center gap-2.5 bg-white p-1.5 px-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <div className="flex flex-col">
                            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Available Balance</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-base sm:text-lg font-black text-slate-900">
                                    ₹{balanceLoading ? '...' : availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={fetchBalance}
                            disabled={balanceLoading}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Refresh Balance"
                        >
                            <RefreshCw size={14} className={balanceLoading ? 'animate-spin text-blue-600' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Main Transfer Section (Two-Column Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
                {/* Left: Recipient Search & Selection */}
                <div className="lg:col-span-6 flex flex-col">
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-black">1</span>
                                    <h2 className="text-sm sm:text-base font-black text-slate-900">Search Recipient</h2>
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
                                <div className="space-y-3">
                                    <form onSubmit={handleSearchRecipient} className="space-y-2">
                                        <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                            Search by registered mobile number
                                        </label>
                                        <div className="relative flex items-center">
                                            <div className="absolute left-3 flex items-center gap-1 text-slate-400 font-bold text-xs">
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
                                                        setTimeout(() => handleSearchRecipient(), 100);
                                                    }
                                                }}
                                                placeholder="Enter 10-digit mobile number"
                                                className="w-full pl-14 pr-22 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs sm:text-sm font-black text-slate-900 transition-all outline-none"
                                            />
                                            <button
                                                type="submit"
                                                disabled={searchLoading || searchMobile.length !== 10}
                                                className="absolute right-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                {searchLoading ? (
                                                    <RefreshCw size={13} className="animate-spin" />
                                                ) : (
                                                    <>
                                                        <Search size={13} />
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
                                            className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2"
                                        >
                                            <AlertCircle size={15} className="shrink-0 text-rose-600" />
                                            <span>{searchError}</span>
                                        </motion.div>
                                    )}

                                    {/* Search Result Card (Before Selecting) */}
                                    {searchResult ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="border border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white rounded-xl p-3.5 space-y-3"
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
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-full">
                                                    <UserCheck size={11} />
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
                                                className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <span>Select this Recipient</span>
                                                <ArrowRight size={13} />
                                            </button>
                                        </motion.div>
                                    ) : (
                                        /* Subtle Guide Helper */
                                        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center space-y-1.5 py-5">
                                            <div className="w-8 h-8 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <UserCheck size={16} />
                                            </div>
                                            <p className="text-xs font-black text-slate-700">Instant Verification</p>
                                            <p className="text-[11px] text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
                                                Enter the recipient's 10-digit number to verify their name and party code before transferring.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Confirmed Selected Recipient Card */
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3.5 space-y-2.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
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
                </div>

                {/* Right: Transfer Amount & Action Form */}
                <div className="lg:col-span-6 flex flex-col">
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-black">2</span>
                                <h2 className="text-sm sm:text-base font-black text-slate-900">Transfer Amount</h2>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                                    Amount to Transfer (INR)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-base">₹</span>
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
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-base font-black text-slate-900 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            {/* Quick Amount Chips */}
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Select</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {[100, 500, 1000, 2000, 5000].map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => handleQuickAmount(val)}
                                            className="px-2.5 py-1 text-xs font-black rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 transition cursor-pointer"
                                        >
                                            ₹{val.toLocaleString('en-IN')}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => handleQuickAmount('ALL')}
                                        className="px-2.5 py-1 text-xs font-black rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                                    >
                                        All Balance
                                    </button>
                                </div>
                            </div>

                            {/* Optional Remarks */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                                    Remarks / Narration (Optional)
                                </label>
                                <input
                                    type="text"
                                    maxLength={100}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="e.g. Wallet top-up / settlement"
                                    className="w-full px-3 py-1.5 sm:py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-900 transition-all outline-none"
                                />
                            </div>

                            {/* Error Alert */}
                            {formError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2"
                                >
                                    <AlertCircle size={14} className="shrink-0 text-rose-600" />
                                    <span>{formError}</span>
                                </motion.div>
                            )}

                            {/* Breakdown Summary */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                                <div className="flex justify-between text-slate-500 font-bold">
                                    <span>Transfer Amount:</span>
                                    <span className="text-slate-900 font-black">₹{parseFloat(amount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-500 font-bold">
                                    <span>Transfer Fee:</span>
                                    <span className="text-emerald-600 font-black">₹0.00 (Free)</span>
                                </div>
                                <div className="flex justify-between text-slate-900 font-black border-t border-slate-200 pt-1 text-xs sm:text-sm">
                                    <span>Total Debit:</span>
                                    <span className="text-blue-600">₹{parseFloat(amount || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Review & Continue Button */}
                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={handleReviewTransfer}
                                disabled={!selectedRecipient || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableBalance}
                                className="w-full py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                                <Send size={15} />
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
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto relative"
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
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 text-center max-h-[92vh] overflow-y-auto"
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
        </div>
    );
}
