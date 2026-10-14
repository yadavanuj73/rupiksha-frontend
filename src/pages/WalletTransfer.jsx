import React, { useState, useEffect, useCallback } from 'react';
import {
    Send, Search, RefreshCw, CheckCircle2, AlertCircle, 
    ShieldCheck, UserCheck, Copy, Check, Printer, 
    Coins, ArrowRight, X, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { walletService, walletTransferService } from '../services/apiService';
import { dataService } from '../services/dataService';
import { sharedDataService } from '../services/sharedDataService';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { printWalletTransferReceipt } from '../utils/walletTransferReceiptPrint';

export default function WalletTransfer() {
    const { user: currentUser } = useAuth();
    const { 
        availableBalance: walletAvailable, 
        balance: walletBalance, 
        isFrozen: isContextFrozen,
        triggerFrozenModal,
        refreshWallet 
    } = useWallet();
    const navigate = useNavigate();

    // Use live balance from the wallet context / navbar (no duplicate API call!)
    const activeUser = currentUser || dataService.getCurrentUser?.() || {};
    const isUserFrozen = Boolean(
        isContextFrozen || 
        activeUser?.isFrozen || 
        activeUser?.walletStatus === 'FROZEN' || 
        activeUser?.status === 'FROZEN' ||
        (activeUser?.id && localStorage.getItem(`rupiksha_frozen_${activeUser.id}`) === 'true') ||
        (activeUser?.username && localStorage.getItem(`rupiksha_frozen_${activeUser.username}`) === 'true') ||
        (activeUser?.mobile && localStorage.getItem(`rupiksha_frozen_${activeUser.mobile}`) === 'true')
    );

    const availableBalance = parseFloat(
        walletAvailable ?? 
        walletBalance ?? 
        activeUser.availableBalance ?? 
        activeUser.balance ?? 
        0
    ) || 0;

    // Recipient Search State
    const [searchMobile, setSearchMobile] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [selectedRecipient, setSelectedRecipient] = useState(null);

    // Transfer Form State
    const [amount, setAmount] = useState('');
    const [remarks, setRemarks] = useState('');
    const [formError, setFormError] = useState('');

    // Confirmation & Transfer Execution State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showFrozenModal, setShowFrozenModal] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [transferSuccessData, setTransferSuccessData] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [copiedRef, setCopiedRef] = useState(false);

    // Alert if wallet is frozen on mount
    useEffect(() => {
        if (isUserFrozen) {
            setShowFrozenModal(true);
            if (triggerFrozenModal) triggerFrozenModal('Your wallet is frozen. Please contact admin.');
        }
    }, [isUserFrozen, triggerFrozenModal]);

    // Role Details & Badge Styling
    const getRoleDetails = useCallback((role) => {
        const r = (role || '').toUpperCase();
        if (r.includes('SUPER')) {
            return {
                badge: 'bg-purple-100 text-purple-900 border-purple-300',
                panelBadge: 'bg-purple-50 text-purple-800 border-purple-200',
                cardBorder: 'border-purple-300/80 hover:border-purple-500',
                bg: 'bg-gradient-to-br from-purple-50/90 via-indigo-50/40 to-white',
                btnBg: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800',
                avatarBg: 'bg-purple-700',
                roleName: 'SUPER DISTRIBUTOR',
                panelName: 'Super Distributor Panel'
            };
        }
        if (r.includes('DISTRIBUTOR')) {
            return {
                badge: 'bg-amber-100 text-amber-900 border-amber-300',
                panelBadge: 'bg-amber-50 text-amber-800 border-amber-200',
                cardBorder: 'border-amber-300/80 hover:border-amber-500',
                bg: 'bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-white',
                btnBg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800',
                avatarBg: 'bg-amber-600',
                roleName: 'DISTRIBUTOR',
                panelName: 'Distributor Panel'
            };
        }
        return {
            badge: 'bg-blue-100 text-blue-900 border-blue-300',
            panelBadge: 'bg-blue-50 text-blue-800 border-blue-200',
            cardBorder: 'border-blue-300/80 hover:border-blue-500',
            bg: 'bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white',
            btnBg: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800',
            avatarBg: 'bg-blue-600',
            roleName: 'RETAILER',
            panelName: 'Retailer Panel'
        };
    }, []);

    // Live Suggestions Fetcher (3 to 9 digits)
    const fetchSuggestions = useCallback(async (prefix) => {
        if (!prefix || prefix.length < 3 || prefix.length >= 10) {
            setSuggestions([]);
            return;
        }
        setSuggestionsLoading(true);
        try {
            const res = await walletTransferService.searchRecipient(prefix);
            const list = Array.isArray(res?.accounts) ? res.accounts : [];
            setSuggestions(list);
        } catch {
            setSuggestions([]);
        } finally {
            setSuggestionsLoading(false);
        }
    }, []);

    // Debounce suggestions when typing
    useEffect(() => {
        const clean = searchMobile.replace(/\D/g, '');
        if (clean.length >= 3 && clean.length < 10) {
            const timer = setTimeout(() => {
                fetchSuggestions(clean);
            }, 250);
            return () => clearTimeout(timer);
        } else {
            setSuggestions([]);
        }
    }, [searchMobile, fetchSuggestions]);

    // Handle Recipient Search (Explicit button click or auto on 10 digits)
    const handleSearchRecipient = async (numberOrEvent) => {
        let cleanNumber = '';
        if (typeof numberOrEvent === 'string') {
            cleanNumber = numberOrEvent.replace(/\D/g, '');
        } else if (numberOrEvent && typeof numberOrEvent.preventDefault === 'function') {
            numberOrEvent.preventDefault();
            cleanNumber = searchMobile.replace(/\D/g, '');
        } else {
            cleanNumber = searchMobile.replace(/\D/g, '');
        }

        if (cleanNumber.length !== 10) {
            setSearchError('Please enter a valid 10-digit mobile number');
            setSearchResults([]);
            return;
        }

        setSearchLoading(true);
        setSearchError('');
        setSuggestions([]);
        setSearchResults([]);
        setSelectedRecipient(null);

        try {
            const res = await walletTransferService.searchRecipient(cleanNumber);
            const accounts = Array.isArray(res?.accounts) && res.accounts.length > 0
                ? res.accounts
                : (res?.data ? [res.data] : []);

            if (accounts.length > 0) {
                setSearchResults(accounts);
            } else {
                setSearchError(res?.message || 'No Rupiksha user found with this mobile number.');
            }
        } catch (err) {
            setSearchError(err.message || 'No Rupiksha user found with this mobile number.');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectSuggestion = (acc) => {
        setSearchMobile(acc.mobile);
        setSuggestions([]);
        handleSearchRecipient(acc.mobile);
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
        if (isUserFrozen) {
            setShowFrozenModal(true);
            if (triggerFrozenModal) triggerFrozenModal('Your wallet is frozen. Please contact admin.');
            setFormError('Your wallet is frozen. Please contact admin.');
            return;
        }

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
        if (isUserFrozen) {
            setShowConfirmModal(false);
            setShowFrozenModal(true);
            if (triggerFrozenModal) triggerFrozenModal('Your wallet is frozen. Please contact admin.');
            setFormError('Your wallet is frozen. Please contact admin.');
            return;
        }

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
                setSearchResults([]);
                setSearchMobile('');

                // Clear any cached balance in memory so fresh calls query the backend database directly
                if (dataService?.clearWalletBalanceCache) {
                    dataService.clearWalletBalanceCache();
                }

                // Refresh global wallet context & dispatch event for header / all components
                if (refreshWallet) {
                    try {
                        await refreshWallet();
                    } catch (_) {}
                }
                window.dispatchEvent(new CustomEvent('walletUpdated', { detail: { balance: res.data?.senderBalance } }));
                window.dispatchEvent(new Event('walletUpdated'));
                window.dispatchEvent(new Event('distributorDataUpdated'));
                window.dispatchEvent(new Event('SuperDistributorDataUpdated'));
                window.dispatchEvent(new Event('dataUpdated'));
            } else {
                const errMsg = res?.message || 'Transfer failed. Please try again.';
                if (errMsg.toLowerCase().includes('frozen') || errMsg.toLowerCase().includes('freez') || errMsg.toLowerCase().includes('blocked')) {
                    setFormError('Your wallet is frozen. Please contact admin.');
                    setShowConfirmModal(false);
                    setShowFrozenModal(true);
                    if (triggerFrozenModal) triggerFrozenModal('Your wallet is frozen. Please contact admin.');
                } else {
                    setFormError(errMsg);
                    setShowConfirmModal(false);
                }
            }
        } catch (err) {
            const errStr = String(err?.message || err || '');
            if (errStr.toLowerCase().includes('frozen') || errStr.toLowerCase().includes('freez') || errStr.toLowerCase().includes('blocked')) {
                setFormError('Your wallet is frozen. Please contact admin.');
                setShowConfirmModal(false);
                setShowFrozenModal(true);
                if (triggerFrozenModal) triggerFrozenModal('Your wallet is frozen. Please contact admin.');
            } else {
                setFormError(errStr || 'Failed to complete wallet transfer');
                setShowConfirmModal(false);
            }
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
        if (transferSuccessData) {
            const item = {
                ...transferSuccessData,
                direction: 'SENT',
                senderName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'You',
                senderPartyCode: currentUser?.partyCode || currentUser?.userId || '',
                senderMobile: currentUser?.mobile || ''
            };
            printWalletTransferReceipt(item);
        } else {
            window.print();
        }
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
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                        <History size={15} />
                        <span>View History</span>
                    </button>
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
                                        }}
                                        className="text-xs font-black text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                    >
                                        Change Recipient
                                    </button>
                                )}
                            </div>

                            {!selectedRecipient ? (
                                <div className="space-y-3">
                                    <form onSubmit={handleSearchRecipient} className="space-y-2 relative">
                                        <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                            Search by registered mobile number
                                        </label>
                                        <div className="relative flex items-center">
                                            <div className="absolute left-3 flex items-center gap-1 text-slate-400 font-bold text-xs pointer-events-none">
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
                                                        setSuggestions([]);
                                                        handleSearchRecipient(val);
                                                    } else {
                                                        setSearchResults([]);
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

                                        {/* Live Suggestions Dropdown while typing digits (3 to 9 digits) */}
                                        <AnimatePresence>
                                            {suggestions.length > 0 && !selectedRecipient && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -4 }}
                                                    className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-60 overflow-y-auto divide-y divide-slate-100"
                                                >
                                                    <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center justify-between">
                                                        <span>Matching Registered Accounts ({suggestions.length})</span>
                                                        {suggestionsLoading && <RefreshCw size={10} className="animate-spin text-blue-600" />}
                                                    </div>
                                                    {suggestions.map((item, idx) => {
                                                        const rStyle = getRoleDetails(item.role);
                                                        return (
                                                            <button
                                                                key={item.id || idx}
                                                                type="button"
                                                                onClick={() => handleSelectSuggestion(item)}
                                                                className="w-full text-left p-2.5 hover:bg-slate-50 transition flex items-center justify-between gap-2 cursor-pointer"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="font-black text-slate-900 text-xs truncate">{item.fullName}</span>
                                                                        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-sm uppercase ${rStyle.badge} border`}>
                                                                            {rStyle.roleName}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[11px] font-bold text-slate-500 font-mono mt-0.5">
                                                                        {item.mobile} • {item.partyCode || 'N/A'} {item.businessName ? `• ${item.businessName}` : ''}
                                                                    </p>
                                                                </div>
                                                                <ArrowRight size={13} className="text-slate-400 shrink-0" />
                                                            </button>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
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

                                    {/* Search Results: Multi-account list or single account */}
                                    {searchResults.length > 0 ? (
                                        <div className="space-y-3">
                                            {searchResults.length > 1 && (
                                                <div className="p-2.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-start gap-2 text-xs text-blue-900 font-bold">
                                                    <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="font-black">Found {searchResults.length} accounts for {searchResults[0]?.mobile || searchMobile}</p>
                                                        <p className="text-[11px] text-blue-700 font-medium">This mobile number is registered in multiple panels. Please select which account wallet you want to transfer funds to:</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2.5">
                                                {searchResults.map((acc, index) => {
                                                    const rStyle = getRoleDetails(acc.role);
                                                    return (
                                                        <motion.div
                                                            key={acc.id || index}
                                                            initial={{ opacity: 0, scale: 0.98 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ duration: 0.15, delay: index * 0.04 }}
                                                            className={`border ${rStyle.cardBorder} ${rStyle.bg} rounded-xl p-3.5 space-y-3 shadow-xs transition-all`}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <h3 className="text-sm font-black text-slate-900">{acc.fullName}</h3>
                                                                        <span className={`px-2 py-0.5 ${rStyle.badge} font-black text-[10px] rounded-full uppercase border`}>
                                                                            {rStyle.roleName}
                                                                        </span>
                                                                    </div>
                                                                    {acc.businessName && acc.businessName !== acc.fullName && (
                                                                        <p className="text-xs text-slate-600 font-bold mt-0.5 truncate">{acc.businessName}</p>
                                                                    )}
                                                                </div>
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-full shrink-0">
                                                                    <UserCheck size={11} />
                                                                    Verified
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-200/60">
                                                                <div>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Party Code</span>
                                                                    <p className="font-black text-slate-800 font-mono">{acc.partyCode || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Mobile</span>
                                                                    <p className="font-black text-slate-800 font-mono">{acc.mobile}</p>
                                                                </div>
                                                                {(acc.city || acc.stateName) && (
                                                                    <div className="col-span-2">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</span>
                                                                        <p className="font-bold text-slate-700 truncate">
                                                                            {[acc.city, acc.stateName].filter(Boolean).join(', ')}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedRecipient(acc)}
                                                                className={`w-full py-2.5 ${rStyle.btnBg} text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer`}
                                                            >
                                                                <span>Select this {rStyle.roleName} Recipient</span>
                                                                <ArrowRight size={13} />
                                                            </button>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
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
                                            <div className={`w-8 h-8 rounded-full ${getRoleDetails(selectedRecipient.role).avatarBg} text-white flex items-center justify-center font-black text-xs`}>
                                                {selectedRecipient.fullName?.slice(0, 2).toUpperCase() || 'RX'}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900">{selectedRecipient.fullName}</h3>
                                                <p className="text-[11px] font-bold text-slate-500">{selectedRecipient.businessName}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 ${getRoleDetails(selectedRecipient.role).badge} font-black text-[10px] rounded-full uppercase border`}>
                                            {getRoleDetails(selectedRecipient.role).roleName}
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
                        <div className="pt-1 space-y-2">
                            {isUserFrozen && (
                                <div className="p-3 bg-rose-50 border-2 border-rose-200 rounded-xl flex items-center justify-between gap-2 text-rose-700 animate-in fade-in">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={16} className="shrink-0 text-rose-600" />
                                        <p className="text-xs font-black text-rose-600">Your wallet is frozen. Please contact admin.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowFrozenModal(true)}
                                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm shrink-0"
                                    >
                                        Notice
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={isUserFrozen ? () => setShowFrozenModal(true) : handleReviewTransfer}
                                disabled={!selectedRecipient || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableBalance || isUserFrozen}
                                className="w-full py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                                <Send size={15} />
                                <span>{isUserFrozen ? 'Wallet Frozen — Transfer Blocked' : 'Review & Transfer'}</span>
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
                    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="relative bg-white rounded-2xl border-2 border-slate-300 shadow-2xl max-w-md w-full p-4 sm:p-5 my-auto max-h-[94vh] overflow-y-auto text-center font-['Inter',sans-serif] space-y-3.5 text-black"
                        >
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                <CheckCircle2 size={28} className="stroke-[2.5]" />
                            </div>

                            <div>
                                <h3 className="text-lg sm:text-xl font-black text-black">Transfer Successful!</h3>
                                <p className="text-xs text-slate-700 font-bold mt-0.5">Funds have been credited instantly.</p>
                            </div>

                            <div className="text-2xl sm:text-3xl font-black text-black font-mono">
                                ₹{Number(transferSuccessData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>

                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 text-left text-black">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold text-[11px]">Transaction Ref:</span>
                                    <div className="flex items-center gap-1 font-mono font-black text-black">
                                        <span>{transferSuccessData.transferReference}</span>
                                        <button
                                            onClick={() => copyToClipboard(transferSuccessData.transferReference)}
                                            className="p-0.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                                            title="Copy Reference"
                                        >
                                            {copiedRef ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold text-[11px]">Recipient:</span>
                                    <span className="font-black text-black">{transferSuccessData.recipientName} ({transferSuccessData.recipientPartyCode})</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold text-[11px]">Recipient Mobile:</span>
                                    <span className="font-mono font-bold text-black">{transferSuccessData.recipientMobile}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold text-[11px]">Updated Balance:</span>
                                    <span className="font-black text-emerald-700 font-mono">₹{Number(transferSuccessData.senderBalance || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold text-[11px]">Date & Time:</span>
                                    <span className="font-bold text-black">{new Date(transferSuccessData.createdAt).toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            <div className="flex gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={handlePrintReceipt}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                                >
                                    <Printer size={14} />
                                    <span>Print Receipt</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSuccessModal(false)}
                                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer active:scale-98"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Frozen Wallet Pop-up Modal */}
            <AnimatePresence>
                {showFrozenModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-rose-100 max-w-md w-full overflow-hidden text-center p-6 space-y-4"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                                <AlertCircle size={32} />
                            </div>
                            
                            <div className="space-y-1">
                                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                                    Administrative Hold
                                </span>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight pt-2">
                                    Wallet is Frozen
                                </h3>
                                <p className="text-sm font-black text-rose-600">
                                    Your wallet is frozen. Please contact admin.
                                </p>
                            </div>

                            <p className="text-xs text-slate-500 font-semibold leading-relaxed px-2">
                                You cannot perform any wallet-to-wallet transfers or use wallet balance while your wallet is frozen. Please contact administrator to review and restore your wallet access.
                            </p>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowFrozenModal(false)}
                                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-slate-900/20 transition-all cursor-pointer"
                                >
                                    Understood
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
