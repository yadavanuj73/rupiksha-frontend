import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
    Landmark, Zap, ShieldCheck, CheckCircle2, XCircle, Clock, 
    RefreshCw, Search, ArrowRight, Printer, Download, AlertTriangle, 
    CreditCard, ArrowUpRight, HelpCircle, Check, Copy, ExternalLink, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { payoutService, transactionService, userService } from '../../services/apiService';
import { dataService } from '../../services/dataService';
import { useWallet } from '../../context/WalletContext';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];

const PayoutHub = () => {
    const user = useMemo(() => dataService.getCurrentUser(), []);
    const { balance, refreshWallet, isWalletLoading } = useWallet();
    const walletBalance = Number(balance || 0);

    // Active View Tab: 'transfer' | 'history'
    const [activeTab, setActiveTab] = useState('transfer');

    // Wallet State
    const balanceLoading = isWalletLoading;

    // Form State
    const [form, setForm] = useState({
        accountNumber: '',
        confirmAccountNumber: '',
        ifsc: '',
        beneficiaryName: '',
        bankName: '',
        branchName: '',
        transferMode: 'IMPS',
        amount: '',
        remarks: ''
    });

    // Verification State
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null);
    const [verificationError, setVerificationError] = useState('');

    // Submission & Anti-duplicate State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [receiptData, setReceiptData] = useState(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // History State
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [statusCheckingId, setStatusCheckingId] = useState(null);
    const [copiedField, setCopiedField] = useState('');
    const [serviceDisabled, setServiceDisabled] = useState(false);

    // Fetch Wallet Balance
    const fetchBalance = useCallback(async () => {
        try {
            await refreshWallet();
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    }, [refreshWallet]);

    // Fetch Recent Payout Transactions
    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await payoutService.getTransactions();
            if (Array.isArray(res)) {
                setHistory(res);
            }
        } catch (e) {
            console.warn('Failed to fetch payout history', e);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        const checkService = async () => {
            try {
                const services = await userService.getUserServices();
                if (services && services.PAYOUT === false) {
                    setServiceDisabled(true);
                }
            } catch (e) {
                console.warn('Could not verify payout service status', e);
            }
        };
        checkService();
        fetchBalance();
        fetchHistory();
    }, [fetchBalance, fetchHistory]);

    if (serviceDisabled) {
        return <DisabledServiceBanner serviceName="Payout Hub" />;
    }

    // Validation Flags
    const isAccountValid = /^\d{9,18}$/.test(form.accountNumber.trim());
    const isAccountMatching = form.accountNumber.trim() && form.accountNumber.trim() === form.confirmAccountNumber.trim();
    const isIfscValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase());
    const isAmountEntered = Number(form.amount) > 0;
    const isAmountWithinBalance = Number(form.amount) <= walletBalance;
    const isNameValid = form.beneficiaryName.trim().length >= 2;

    const canVerify = isAccountValid && isIfscValid && !verifying;
    const canSubmit = isAccountValid && isAccountMatching && isIfscValid && isNameValid && isAmountEntered && isAmountWithinBalance && !isSubmitting;

    // Verify Bank Account (Penny-less)
    const handleVerifyAccount = async () => {
        if (!canVerify) return;
        setVerifying(true);
        setVerificationError('');
        setVerificationResult(null);

        try {
            const res = await payoutService.verifyAccount({
                accountNumber: form.accountNumber.trim(),
                ifsc: form.ifsc.trim().toUpperCase(),
                method: 'penny-less'
            });

            if (res && res.success && res.nameAtBank) {
                setVerificationResult(res);
                setForm(prev => ({
                    ...prev,
                    beneficiaryName: res.nameAtBank,
                    bankName: prev.bankName || (form.ifsc.startsWith('SBIN') ? 'State Bank of India' : '')
                }));
            } else {
                setVerificationError(res?.message || 'Bank account verification failed. Please verify details.');
            }
        } catch (err) {
            setVerificationError(err?.message || 'Verification service temporarily unavailable.');
        } finally {
            setVerifying(false);
        }
    };

    // Submit Payout
    const handlePayoutSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        if (!canSubmit) {
            if (!isAmountWithinBalance) {
                setSubmitError(`Insufficient wallet balance. You have ₹${walletBalance.toLocaleString('en-IN')}, but transfer requires ₹${Number(form.amount).toLocaleString('en-IN')}.`);
            } else if (!isAccountMatching) {
                setSubmitError('Account number and confirm account number do not match.');
            } else {
                setSubmitError('Please complete all required beneficiary details correctly.');
            }
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = {
                amount: Number(form.amount),
                beneficiaryName: form.beneficiaryName.trim(),
                accountNumber: form.accountNumber.trim(),
                ifsc: form.ifsc.trim().toUpperCase(),
                bankName: form.bankName.trim() || 'Bank Transfer',
                branchName: form.branchName.trim() || 'Main Branch',
                transferMode: form.transferMode,
                remarks: form.remarks.trim() || 'Instant payout transfer'
            };

            const res = await payoutService.initiatePayout(payload);

            if (res && (res.success || res.status === 'SUCCESS' || res.status === 'INITIATED')) {
                setReceiptData({
                    status: res.status || 'SUCCESS',
                    message: res.message || 'Payout transferred successfully',
                    orderId: res.orderId,
                    txnId: res.transactionId || res.orderId,
                    utr: res.utr || 'Pending / In Progress',
                    amount: form.amount,
                    beneficiaryName: form.beneficiaryName,
                    accountNumber: form.accountNumber,
                    ifsc: form.ifsc,
                    bankName: form.bankName || 'Bank Account',
                    transferMode: form.transferMode,
                    timestamp: new Date().toLocaleString('en-IN')
                });
                setShowReceiptModal(true);

                // Reset Form
                setForm({
                    accountNumber: '',
                    confirmAccountNumber: '',
                    ifsc: '',
                    beneficiaryName: '',
                    bankName: '',
                    branchName: '',
                    transferMode: 'IMPS',
                    amount: '',
                    remarks: ''
                });
                setVerificationResult(null);

                // Refresh balance and history
                fetchBalance();
                fetchHistory();
            } else {
                setSubmitError(res?.message || 'Payout transfer failed. Any debited amount has been auto-refunded to your wallet.');
                fetchBalance();
                fetchHistory();
            }
        } catch (err) {
            setSubmitError(err?.message || 'Transfer request failed. Please check your transaction history.');
            fetchBalance();
            fetchHistory();
        } finally {
            setIsSubmitting(false);
        }
    };

    // Status Check for Pending Items
    const handleCheckStatus = async (orderId) => {
        if (!orderId) return;
        setStatusCheckingId(orderId);
        try {
            const res = await payoutService.checkStatus(orderId);
            if (res) {
                fetchHistory();
                fetchBalance();
            }
        } catch (e) {
            console.warn('Status check failed', e);
        } finally {
            setStatusCheckingId(null);
        }
    };

    const handleCopy = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(''), 2000);
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/60 to-indigo-50/30 p-4 sm:p-6 lg:p-8 font-sans">
            <div className="mx-auto max-w-5xl space-y-6">

                {/* ─── Top Header Card ────────────────────────────────────────── */}
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 sm:p-8 shadow-sm backdrop-blur-xl">
                    <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-gradient-to-bl from-blue-500/10 to-indigo-500/10 blur-3xl pointer-events-none" />

                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-blue-700">
                                <Zap size={14} className="animate-pulse" />
                                Instant Bank Transfer
                            </div>
                            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                                Payout Hub
                            </h1>
                            <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
                                Transfer funds 24x7 securely to any bank account via IMPS, NEFT & RTGS rails.
                            </p>
                        </div>

                        {/* Live Main Wallet Balance Widget */}
                        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 shadow-inner">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                                <CreditCard size={22} />
                            </div>
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    Main Wallet Balance
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                                        ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                    <button 
                                        onClick={fetchBalance} 
                                        disabled={balanceLoading}
                                        title="Refresh Balance"
                                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                                    >
                                        <RefreshCw size={14} className={balanceLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="mt-6 flex gap-2 border-b border-slate-100 pt-2">
                        <button
                            onClick={() => setActiveTab('transfer')}
                            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider transition ${
                                activeTab === 'transfer'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <SendIcon size={16} />
                            New Transfer
                        </button>
                        <button
                            onClick={() => { setActiveTab('history'); fetchHistory(); }}
                            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider transition ${
                                activeTab === 'history'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Clock size={16} />
                            Recent Transfers
                            {history.length > 0 && (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                    {history.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* ─── Tab 1: New Transfer Form ────────────────────────────────── */}
                {activeTab === 'transfer' && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                        {/* Left 2 Cols: Main Transfer Card */}
                        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
                            <form onSubmit={handlePayoutSubmit} className="space-y-5">

                                {/* Step 1: Account Number & Verification */}
                                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">1</span>
                                            Beneficiary Account Details
                                        </label>
                                        {isAccountValid && isIfscValid && (
                                            <button
                                                type="button"
                                                onClick={handleVerifyAccount}
                                                disabled={verifying}
                                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
                                            >
                                                {verifying ? (
                                                    <>
                                                        <RefreshCw size={12} className="animate-spin" />
                                                        Verifying Account...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles size={12} />
                                                        Verify Account Holder
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600">Account Number *</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono transition"
                                                placeholder="Enter bank account number"
                                                value={form.accountNumber}
                                                onChange={(e) => setForm(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, '') }))}
                                                maxLength={18}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                                                Confirm Account Number *
                                                {form.confirmAccountNumber && (
                                                    <span className={`text-[10px] font-black ${isAccountMatching ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                        {isAccountMatching ? '✓ Matched' : '✗ Mismatch'}
                                                    </span>
                                                )}
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none font-mono transition ${
                                                    form.confirmAccountNumber && !isAccountMatching
                                                        ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                                        : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                                }`}
                                                placeholder="Re-enter bank account number"
                                                value={form.confirmAccountNumber}
                                                onChange={(e) => setForm(p => ({ ...p, confirmAccountNumber: e.target.value.replace(/\D/g, '') }))}
                                                maxLength={18}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600">IFSC Code *</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold uppercase text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono transition"
                                                placeholder="e.g. SBIN0001234"
                                                value={form.ifsc}
                                                onChange={(e) => setForm(p => ({ ...p, ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                                                maxLength={11}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600">Beneficiary Legal Name *</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                                placeholder="Name as in bank records"
                                                value={form.beneficiaryName}
                                                onChange={(e) => setForm(p => ({ ...p, beneficiaryName: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    {/* Verification Success Badge */}
                                    {verificationResult && (
                                        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs font-bold text-emerald-800">
                                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                            <span>
                                                Account Verified: <span className="font-extrabold">{verificationResult.nameAtBank}</span> (Status: {verificationResult.acValidationStatus})
                                            </span>
                                        </div>
                                    )}

                                    {/* Verification Error Badge */}
                                    {verificationError && (
                                        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs font-bold text-rose-800">
                                            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                                            <span>{verificationError}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Transfer Mode & Amount */}
                                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">2</span>
                                        Transfer Mode & Amount
                                    </label>

                                    {/* Transfer Mode Selector */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { mode: 'IMPS', title: 'IMPS', desc: 'Instant 24x7' },
                                            { mode: 'NEFT', title: 'NEFT', desc: 'Batch Transfer' },
                                            { mode: 'RTGS', title: 'RTGS', desc: 'High Value (₹2L+)' }
                                        ].map(item => (
                                            <button
                                                key={item.mode}
                                                type="button"
                                                onClick={() => setForm(p => ({ ...p, transferMode: item.mode }))}
                                                className={`rounded-xl border p-2.5 text-center transition ${
                                                    form.transferMode === item.mode
                                                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="text-xs font-black">{item.title}</div>
                                                <div className="text-[10px] font-semibold text-slate-400">{item.desc}</div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Amount Input */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600">Transfer Amount (₹) *</label>
                                        <div className="relative mt-1">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">₹</span>
                                            <input
                                                type="text"
                                                required
                                                className={`w-full rounded-xl border pl-8 pr-4 py-2.5 text-base font-black text-slate-900 placeholder:text-slate-400 outline-none font-mono transition ${
                                                    form.amount && !isAmountWithinBalance
                                                        ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                                        : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                                }`}
                                                placeholder="0.00"
                                                value={form.amount}
                                                onChange={(e) => setForm(p => ({ ...p, amount: e.target.value.replace(/[^\d.]/g, '') }))}
                                            />
                                        </div>

                                        {/* Insufficient Balance Notice */}
                                        {form.amount && !isAmountWithinBalance && (
                                            <p className="mt-1 text-xs font-bold text-rose-600">
                                                Amount exceeds your available wallet balance of ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </p>
                                        )}
                                    </div>

                                    {/* Quick Amount Chips */}
                                    <div className="flex flex-wrap gap-2">
                                        {QUICK_AMOUNTS.map(amt => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setForm(p => ({ ...p, amount: String(amt) }))}
                                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 transition font-mono"
                                            >
                                                +₹{amt.toLocaleString('en-IN')}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Remarks */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600">Transaction Remarks (Optional)</label>
                                        <input
                                            type="text"
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500"
                                            placeholder="e.g. Vendor payout, salary, or refund"
                                            value={form.remarks}
                                            onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))}
                                            maxLength={100}
                                        />
                                    </div>
                                </div>

                                {/* Error message */}
                                {submitError && (
                                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700">
                                        <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                                        <span>{submitError}</span>
                                    </div>
                                )}

                                {/* Submit Action Button */}
                                <button
                                    type="submit"
                                    disabled={!canSubmit || isSubmitting}
                                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.99]"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw size={18} className="animate-spin" />
                                            Processing Payout Transfer...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={18} />
                                            Confirm & Transfer Payout
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Right 1 Col: Guidelines & Security Card */}
                        <div className="space-y-6">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <ShieldCheck size={18} className="text-emerald-600" />
                                    Payout Safeguards
                                </h3>
                                <ul className="mt-4 space-y-3 text-xs font-medium text-slate-600">
                                    <li className="flex items-start gap-2">
                                        <Check size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                                        <span><strong>Instant Auto-Refund:</strong> In case of bank failure, funds are instantly credited back to your wallet.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                                        <span><strong>Account Verification:</strong> Use "Verify Account Holder" to guarantee exact name matches bank records.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                                        <span><strong>Duplicate Protection:</strong> Each payout uses a unique encrypted order ID to prevent accidental double transfers.</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-6">
                                <h4 className="text-xs font-black uppercase tracking-wider text-blue-900">
                                    Need Higher Limits?
                                </h4>
                                <p className="mt-1.5 text-xs text-blue-700/90 leading-relaxed font-semibold">
                                    For high volume bulk payouts and corporate integrations, please ensure your KYC is updated and contact support.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Tab 2: Recent Transfers History ──────────────────────────── */}
                {activeTab === 'history' && (
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-base font-black text-slate-900">Recent Payout History</h2>
                                <p className="text-xs font-semibold text-slate-500">Live status of your initiated payouts</p>
                            </div>
                            <button
                                onClick={fetchHistory}
                                disabled={historyLoading}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                            >
                                <RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>

                        {historyLoading && history.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-400">
                                Loading transfer history...
                            </div>
                        ) : history.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-400">
                                No payout transfers found yet. Initiated transfers will appear here.
                            </div>
                        ) : (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            <th className="pb-3">Date & Time</th>
                                            <th className="pb-3">Order ID / UTR</th>
                                            <th className="pb-3">Beneficiary</th>
                                            <th className="pb-3">Mode</th>
                                            <th className="pb-3 text-right">Amount</th>
                                            <th className="pb-3 text-center">Status</th>
                                            <th className="pb-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                        {history.map(txn => {
                                            const isSuccess = txn.status === 'SUCCESS' || txn.status === 'SUCCESSFUL';
                                            const isFailed = txn.status === 'FAILED' || txn.status === 'FAILURE';
                                            const isPending = !isSuccess && !isFailed;

                                            return (
                                                <tr key={txn.id || txn.orderId} className="hover:bg-slate-50/60 transition">
                                                    <td className="py-3 font-mono text-[11px] text-slate-500">
                                                        {txn.createdAt ? new Date(txn.createdAt).toLocaleString('en-IN') : 'N/A'}
                                                    </td>
                                                    <td className="py-3 font-mono">
                                                        <div className="font-bold text-slate-900">{txn.orderId}</div>
                                                        {txn.utr && (
                                                            <div className="text-[10px] text-slate-400">UTR: {txn.utr}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3">
                                                        <div className="font-bold text-slate-900">{txn.beneficiaryName}</div>
                                                        <div className="font-mono text-[10px] text-slate-400">
                                                            {txn.accountNumber} ({txn.ifsc})
                                                        </div>
                                                    </td>
                                                    <td className="py-3 font-bold text-blue-600 uppercase">
                                                        {txn.transferMode || 'IMPS'}
                                                    </td>
                                                    <td className="py-3 text-right font-black text-slate-900 font-mono">
                                                        ₹{Number(txn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                                                            isSuccess
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : isFailed
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                            {isSuccess ? '✓ Success' : isFailed ? '✕ Failed' : '⏳ Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        {isPending ? (
                                                            <button
                                                                onClick={() => handleCheckStatus(txn.orderId)}
                                                                disabled={statusCheckingId === txn.orderId}
                                                                className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
                                                            >
                                                                {statusCheckingId === txn.orderId ? 'Checking...' : 'Check Status'}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setReceiptData({
                                                                        status: txn.status,
                                                                        message: txn.responseMessage || 'Transfer processed',
                                                                        orderId: txn.orderId,
                                                                        txnId: txn.orderId,
                                                                        utr: txn.utr || 'N/A',
                                                                        amount: txn.amount,
                                                                        beneficiaryName: txn.beneficiaryName,
                                                                        accountNumber: txn.accountNumber,
                                                                        ifsc: txn.ifsc,
                                                                        bankName: txn.bankName || 'Bank Account',
                                                                        transferMode: txn.transferMode || 'IMPS',
                                                                        timestamp: txn.createdAt ? new Date(txn.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')
                                                                    });
                                                                    setShowReceiptModal(true);
                                                                }}
                                                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition"
                                                            >
                                                                Receipt
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Processing Fullscreen Modal Lock ─────────────────────────── */}
            <AnimatePresence>
                {isSubmitting && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
                    >
                        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                                <RefreshCw size={32} className="animate-spin" />
                            </div>
                            <h3 className="mt-4 text-lg font-black text-slate-900">
                                Initiating Payout Transfer
                            </h3>
                            <p className="mt-2 text-xs font-semibold text-slate-500 leading-relaxed">
                                Communicating securely with the banking rail. Please do not refresh, go back, or submit again.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Branded Transaction Receipt Modal ──────────────────────────── */}
            <AnimatePresence>
                {showReceiptModal && receiptData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto"
                    >
                        <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100">
                            {/* Close button */}
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                            >
                                <XCircle size={20} />
                            </button>

                            {/* Status Icon */}
                            <div className="text-center">
                                {receiptData.status === 'SUCCESS' || receiptData.status === 'SUCCESSFUL' ? (
                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md shadow-emerald-500/20">
                                        <CheckCircle2 size={36} />
                                    </div>
                                ) : (
                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-md shadow-rose-500/20">
                                        <XCircle size={36} />
                                    </div>
                                )}

                                <h3 className="mt-3 text-xl font-black text-slate-900">
                                    {receiptData.status === 'SUCCESS' || receiptData.status === 'SUCCESSFUL'
                                        ? 'Payout Transfer Successful'
                                        : 'Payout Transfer Failed'}
                                </h3>
                                <p className="text-xs font-semibold text-slate-500 mt-1">{receiptData.message}</p>
                                <div className="mt-3 text-3xl font-black text-slate-900 font-mono">
                                    ₹{Number(receiptData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                            </div>

                            {/* Details Table */}
                            <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-xs">
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 font-bold">Order ID</span>
                                    <span className="font-mono font-bold text-slate-900">{receiptData.orderId}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 font-bold">Bank UTR / Ref</span>
                                    <span className="font-mono font-bold text-blue-600">{receiptData.utr}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 font-bold">Beneficiary Name</span>
                                    <span className="font-bold text-slate-900">{receiptData.beneficiaryName}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 font-bold">Account Number</span>
                                    <span className="font-mono font-bold text-slate-900">{receiptData.accountNumber}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 font-bold">IFSC Code</span>
                                    <span className="font-mono font-bold uppercase text-slate-900">{receiptData.ifsc}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 font-bold">Transfer Rail</span>
                                    <span className="font-bold text-slate-900 uppercase">{receiptData.transferMode || 'IMPS'}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-500 font-bold">Timestamp</span>
                                    <span className="font-mono text-slate-700">{receiptData.timestamp}</span>
                                </div>
                            </div>

                            {/* Receipt Action Buttons */}
                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={handlePrintReceipt}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
                                >
                                    <Printer size={14} />
                                    Print Receipt
                                </button>
                                <button
                                    onClick={() => setShowReceiptModal(false)}
                                    className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-black uppercase text-white hover:bg-blue-700 transition"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

// Helper SVG icon for transfer
const SendIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

export default PayoutHub;
