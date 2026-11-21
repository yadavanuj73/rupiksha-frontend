import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, Landmark, CreditCard, Hash, Copy, Check, Upload,
    CheckCircle2, AlertCircle, IndianRupee, Clock, ArrowRight,
    Calendar, FileText, Loader2, Sparkles, X, ShieldCheck
} from 'lucide-react';
import { bankAccountService, walletFundRequestService } from '../../services/apiService';

const fmtINR = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(num);
};

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 25000, 50000];
const PAYMENT_MODES = ['IMPS', 'NEFT', 'RTGS', 'UPI Transfer', 'CDM Deposit'];

const ManualWalletRecharge = ({ portalTitle = 'Retailer Portal', onSuccess }) => {
    // Bank accounts state
    const [accounts, setAccounts] = useState([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [copiedField, setCopiedField] = useState(null);

    // Form state
    const [amount, setAmount] = useState('');
    const [utrNumber, setUtrNumber] = useState('');
    const [method, setMethod] = useState('IMPS');
    const [paymentBank, setPaymentBank] = useState('');
    const [paymentDateTime, setPaymentDateTime] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });
    const [userNote, setUserNote] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [proofPreviewUrl, setProofPreviewUrl] = useState(null);

    // Submission & validation state
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);

    const fileInputRef = useRef(null);

    // Load active bank accounts added by Admin
    useEffect(() => {
        let isMounted = true;
        setLoadingAccounts(true);
        bankAccountService.getActiveAccounts()
            .then(res => {
                if (isMounted) {
                    if (res && res.success && Array.isArray(res.accounts)) {
                        setAccounts(res.accounts);
                        if (res.accounts.length > 0) {
                            setSelectedAccount(res.accounts[0]);
                        }
                    } else {
                        setAccounts([]);
                    }
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error('Failed to load active bank accounts:', err);
                    setAccounts([]);
                }
            })
            .finally(() => {
                if (isMounted) setLoadingAccounts(false);
            });

        return () => { isMounted = false; };
    }, []);

    const copyToClipboard = (text, key) => {
        if (!text) return;
        navigator.clipboard?.writeText(text);
        setCopiedField(key);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // File selection handler
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setErrors(prev => ({ ...prev, proof: 'Only JPEG, PNG, and WebP images are allowed' }));
            return;
        }

        // Validate size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, proof: 'File size must be 5MB or smaller' }));
            return;
        }

        setErrors(prev => ({ ...prev, proof: null }));
        setProofFile(file);
        const objectUrl = URL.createObjectURL(file);
        setProofPreviewUrl(objectUrl);
    };

    const handleRemoveProof = () => {
        setProofFile(null);
        if (proofPreviewUrl) {
            URL.revokeObjectURL(proofPreviewUrl);
            setProofPreviewUrl(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Form validation
    const validateForm = () => {
        const newErrors = {};

        if (!selectedAccount) {
            newErrors.account = 'Please select a receiving bank account';
        }

        const numAmount = parseFloat(amount);
        if (!amount || isNaN(numAmount) || numAmount < 1) {
            newErrors.amount = 'Please enter a valid amount (minimum ₹1.00)';
        }

        if (!utrNumber || utrNumber.trim().length < 6) {
            newErrors.utrNumber = 'Please enter a valid UTR / Transaction Reference number (minimum 6 characters)';
        }

        if (!paymentBank || paymentBank.trim().length < 2) {
            newErrors.paymentBank = 'Please enter the bank name you transferred funds from';
        }

        if (!proofFile) {
            newErrors.proof = 'Transaction payment proof receipt is mandatory';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setSubmitting(true);
        setErrors({});

        try {
            const formData = new FormData();
            formData.append('bankAccountId', selectedAccount.id);
            formData.append('amount', parseFloat(amount).toFixed(2));
            formData.append('utrNumber', utrNumber.trim());
            formData.append('method', method);
            formData.append('paymentBank', paymentBank.trim());
            if (paymentDateTime) {
                formData.append('paymentDateTime', new Date(paymentDateTime).toISOString());
            }
            if (userNote.trim()) {
                formData.append('userNote', userNote.trim());
            }
            formData.append('proof', proofFile);

            const res = await walletFundRequestService.submitFundRequest(formData);

            if (res && res.success) {
                const msg = `Fund request for ${fmtINR(amount)} submitted successfully! It is now pending Admin verification.`;
                setSuccessMessage(msg);

                // Reset form fields
                setAmount('');
                setUtrNumber('');
                setPaymentBank('');
                setUserNote('');
                handleRemoveProof();

                if (onSuccess) {
                    setTimeout(() => onSuccess(res.request), 1500);
                }
            } else {
                setErrors({ general: res?.message || 'Failed to submit fund request' });
            }
        } catch (err) {
            setErrors({ general: err.message || 'Network error while submitting fund request. Please check connection.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-3 pb-1">
            {/* Success feedback alert */}
            {successMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start justify-between gap-3 shadow-sm"
                >
                    <div className="flex items-start gap-2.5">
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-black text-xs text-emerald-950 uppercase tracking-wider">Request Submitted Successfully</p>
                            <p className="text-xs font-medium text-emerald-800 mt-0.5">{successMessage}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="text-emerald-600 hover:text-emerald-900 p-1 cursor-pointer"
                    >
                        <X size={15} />
                    </button>
                </motion.div>
            )}

            {/* General Error alert */}
            {errors.general && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2.5 text-xs font-bold">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>{errors.general}</span>
                </div>
            )}

            {/* ── 35% (LEFT) / 65% (RIGHT) VERTICAL SPLIT LAYOUT ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[35%_minmax(0,1fr)] gap-4 items-start">
                {/* ── LEFT SIDE (35%): STEP 1: SELECT RECEIVING BANK ACCOUNT (WITH INTERNAL VERTICAL SCROLL) ── */}
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-500/20">
                                1
                            </div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wide uppercase">
                                Step 1: Select Bank
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                            {accounts.length} Active {accounts.length === 1 ? 'Bank' : 'Banks'}
                        </span>
                    </div>

                    {loadingAccounts ? (
                        <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Loader2 size={22} className="animate-spin text-blue-600" />
                            <p className="text-xs font-bold">Loading receiving banks...</p>
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4">
                            <Building2 size={26} className="mx-auto text-slate-300" />
                            <p className="text-xs font-bold text-slate-700">No active receiving banks</p>
                            <p className="text-[11px] text-slate-500">Please contact administrators to configure receiving banks.</p>
                        </div>
                    ) : (
                        /* Vertical scroll list isolated to bank cards only */
                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto overflow-x-hidden pr-1.5 custom-scrollbar">
                            {accounts.map(acc => {
                                const isSelected = selectedAccount?.id === acc.id;
                                return (
                                    <div
                                        key={acc.id}
                                        onClick={() => setSelectedAccount(acc)}
                                        className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                            isSelected
                                                ? 'border-blue-600 bg-blue-50/40 shadow-sm shadow-blue-500/10'
                                                : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                                        }`}
                                    >
                                        {/* Card Header: Icon + Bank Name & Branch + Selection Badge */}
                                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    <Landmark size={14} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-slate-900 uppercase truncate leading-tight">
                                                        {acc.bankName}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 font-semibold truncate">
                                                        {acc.branch || 'Main Branch'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                                isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                                            }`}>
                                                {isSelected && <Check size={10} strokeWidth={3} />}
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div className="pt-2 space-y-1.5 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Holder</span>
                                                <span className="font-bold text-slate-900 truncate max-w-[160px] text-right text-xs">{acc.accountHolderName}</span>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Number</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                                        {acc.accountNumberMasked}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(acc.accountNumberMasked, `acc-${acc.id}`);
                                                        }}
                                                        title="Copy Account Number"
                                                        className="p-1 hover:bg-slate-200/70 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                                    >
                                                        {copiedField === `acc-${acc.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IFSC Code</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                                                        {acc.ifscCode}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(acc.ifscCode, `ifsc-${acc.id}`);
                                                        }}
                                                        title="Copy IFSC"
                                                        className="p-1 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-800 transition-colors cursor-pointer"
                                                    >
                                                        {copiedField === `ifsc-${acc.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {errors.account && <p className="text-xs font-bold text-rose-600">{errors.account}</p>}
                </div>

                {/* ── RIGHT SIDE (65%): STEP 2: ENTER FUND REQUEST & TRANSFER DETAILS (COMPACT, ZERO SCROLL) ── */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-500/20">
                                2
                            </div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wide uppercase">
                                Step 2: Enter Transfer Details
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">All fields required</span>
                    </div>

                    {/* Compact 3-Column Grid for All 6 Form Fields on Desktop */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {/* 1. Requested Amount (NO shortcut chips) */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                                <span>Amount (₹) *</span>
                                {amount && !isNaN(parseFloat(amount)) && (
                                    <span className="text-blue-600 font-bold lowercase text-[10px]">{fmtINR(amount)}</span>
                                )}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="e.g. 5000"
                                    className={`w-full pl-7 pr-3 py-2 bg-slate-50 border rounded-xl text-xs font-black text-slate-900 outline-none transition-all ${
                                        errors.amount ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:bg-white'
                                    }`}
                                />
                            </div>
                            {errors.amount && <p className="text-[10px] font-bold text-rose-600">{errors.amount}</p>}
                        </div>

                        {/* 2. UTR / Ref Number */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                                <span>UTR / Reference No. *</span>
                            </label>
                            <input
                                type="text"
                                value={utrNumber}
                                onChange={e => setUtrNumber(e.target.value)}
                                placeholder="12-digit UTR or Ref ID"
                                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono font-bold text-slate-900 outline-none transition-all ${
                                    errors.utrNumber ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:bg-white'
                                }`}
                            />
                            {errors.utrNumber && <p className="text-[10px] font-bold text-rose-600">{errors.utrNumber}</p>}
                        </div>

                        {/* 3. Payment Mode */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                                Payment Mode *
                            </label>
                            <select
                                value={method}
                                onChange={e => setMethod(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                            >
                                {PAYMENT_MODES.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        {/* 4. Transferring Bank Name */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                                Your Remitting Bank *
                            </label>
                            <input
                                type="text"
                                value={paymentBank}
                                onChange={e => setPaymentBank(e.target.value)}
                                placeholder="e.g. SBI, HDFC, Kotak"
                                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900 outline-none transition-all ${
                                    errors.paymentBank ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:bg-white'
                                }`}
                            />
                            {errors.paymentBank && <p className="text-[10px] font-bold text-rose-600">{errors.paymentBank}</p>}
                        </div>

                        {/* 5. Payment Date & Time */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                                Payment Date & Time *
                            </label>
                            <input
                                type="datetime-local"
                                value={paymentDateTime}
                                onChange={e => setPaymentDateTime(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                            />
                        </div>

                        {/* 6. User Note */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                                Remarks (Optional)
                            </label>
                            <input
                                type="text"
                                maxLength={500}
                                value={userNote}
                                onChange={e => setUserNote(e.target.value)}
                                placeholder="e.g. Daily wallet recharge"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* ── Compact Proof Upload Row ── */}
                    <div className="space-y-1 pt-1.5 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                                Upload Transaction Proof *
                            </label>
                            <span className="text-[10px] text-slate-400 font-medium">JPEG, PNG, WebP · Max 5MB</span>
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {!proofPreviewUrl ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border border-dashed rounded-xl py-2 px-3.5 flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                    errors.proof
                                        ? 'border-rose-300 bg-rose-50/20'
                                        : 'border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/20'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                        <Upload size={14} />
                                    </div>
                                    <p className="text-xs font-bold text-slate-800 truncate">
                                        Click to upload transfer slip or receipt image
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-white border border-slate-200 text-slate-700 shadow-2xs shrink-0">
                                    Browse File
                                </span>
                            </div>
                        ) : (
                            <div className="py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <img
                                        src={proofPreviewUrl}
                                        alt="Receipt Preview"
                                        className="w-8 h-8 object-cover rounded-lg border border-slate-200 shrink-0"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-900 truncate">{proofFile?.name}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            {(proofFile?.size / 1024).toFixed(1)} KB · Validated Image
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveProof}
                                    className="px-2.5 py-1 text-[10px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                        {errors.proof && <p className="text-[10px] font-bold text-rose-600">{errors.proof}</p>}
                    </div>

                    {/* Submit Button Bar */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                        <div className="text-xs text-slate-600 font-medium truncate">
                            {selectedAccount && amount && !isNaN(parseFloat(amount)) ? (
                                <span>Requesting <strong className="text-slate-900">{fmtINR(amount)}</strong> to <strong className="text-slate-900">{selectedAccount.bankName}</strong></span>
                            ) : (
                                <span className="text-slate-400 text-[11px]">Select a bank and fill required fields</span>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black tracking-wider uppercase shadow-sm shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Submitting Request...
                                </>
                            ) : (
                                <>
                                    Submit Fund Request
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualWalletRecharge;
