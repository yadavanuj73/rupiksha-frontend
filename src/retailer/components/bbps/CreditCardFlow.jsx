import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CreditCard, CheckCircle2, AlertCircle, Clock,
    Search, Check, ShieldCheck, RefreshCw, Printer,
    Wallet, ArrowRight, Info, X, Building2, User,
    FileText, Calendar, DollarSign, ExternalLink, Lock,
    ChevronDown, ChevronRight, Eye, EyeOff, Sparkles,
    Shield, History
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { bbpsService } from '../../../services/apiService';
import { useWallet } from '../../../context/WalletContext';
import BbpsServiceNav from './BbpsServiceNav';
import BbpsReceiptCard from './BbpsReceiptCard';
import { primeBharatConnectSound, playBharatConnectSuccessSound } from '../../../utils/bbpsSound';

// Popular credit card issuers quick chips
const POPULAR_ISSUERS = [
    { label: 'All', query: '' },
    { label: 'SBI Card', query: 'SBI' },
    { label: 'HDFC Bank', query: 'HDFC' },
    { label: 'ICICI Bank', query: 'ICICI' },
    { label: 'Axis Bank', query: 'Axis' },
    { label: 'Kotak', query: 'Kotak' },
    { label: 'BoB Card', query: 'BoB' },
    { label: 'PNB', query: 'Punjab' },
    { label: 'RBL Bank', query: 'RBL' },
    { label: 'IndusInd', query: 'IndusInd' },
    { label: 'IDFC FIRST', query: 'IDFC' },
    { label: 'Canara', query: 'Canara' },
    { label: 'Union Bank', query: 'Union' },
    { label: 'Yes Bank', query: 'Yes' },
    { label: 'Federal', query: 'Federal' },
    { label: 'AU Bank', query: 'AU' }
];

/**
 * Detect card network from card number prefix
 */
const detectCardNetwork = (cleanNumber) => {
    if (!cleanNumber) return null;
    if (cleanNumber.startsWith('4')) return { name: 'Visa', color: 'from-blue-600 to-indigo-700', badge: 'bg-blue-100 text-blue-800' };
    if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(cleanNumber)) {
        return { name: 'Mastercard', color: 'from-amber-600 to-red-600', badge: 'bg-amber-100 text-amber-800' };
    }
    if (/^(60|65|81|82|508)/.test(cleanNumber)) {
        return { name: 'RuPay', color: 'from-emerald-600 to-teal-700', badge: 'bg-emerald-100 text-emerald-800' };
    }
    if (/^(34|37)/.test(cleanNumber)) {
        return { name: 'Amex', color: 'from-cyan-600 to-blue-700', badge: 'bg-cyan-100 text-cyan-800' };
    }
    return { name: 'Credit Card', color: 'from-slate-700 to-slate-900', badge: 'bg-slate-100 text-slate-800' };
};

const CreditCardFlow = ({ onBack, category }) => {
    const { balance, refreshWallet } = useWallet();
    const numBalance = typeof balance === 'number' ? balance : parseFloat(balance) || 0;

    // Flow steps: 'FORM' | 'CONFIRM' | 'RESULT'
    const [flowStep, setFlowStep] = useState('FORM');

    // Biller list & selection
    const [billers, setBillers] = useState([]);
    const [loadingBillers, setLoadingBillers] = useState(true);
    const [billerSearch, setBillerSearch] = useState('');
    const [selectedQuickChip, setSelectedQuickChip] = useState('All');
    const [selectedBiller, setSelectedBiller] = useState(null);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const comboboxRef = useRef(null);

    // Form inputs
    const [customerParams, setCustomerParams] = useState({});
    const [customerMobile, setCustomerMobile] = useState('');
    const [paramErrors, setParamErrors] = useState({});
    const [showCardNumber, setShowCardNumber] = useState(false);

    // Bill fetch & dues
    const [isFetchingBill, setIsFetchingBill] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [fetchedBill, setFetchedBill] = useState(null);
    const [paymentOption, setPaymentOption] = useState('TOTAL'); // 'TOTAL' | 'MIN' | 'CUSTOM'
    const [customAmount, setCustomAmount] = useState('');

    // Payment submission & outcome
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [txnOutcome, setTxnOutcome] = useState(null);

    // Close combobox when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
                setIsComboboxOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load registered Credit Card billers from backend
    useEffect(() => {
        let isMounted = true;
        const fetchBillers = async () => {
            setLoadingBillers(true);
            try {
                const data = await bbpsService.getCreditCardBillers();
                if (isMounted && Array.isArray(data)) {
                    setBillers(data);
                }
            } catch (err) {
                console.error('Failed to load credit card billers:', err);
            } finally {
                if (isMounted) setLoadingBillers(false);
            }
        };

        fetchBillers();
        return () => { isMounted = false; };
    }, []);

    // Filtered billers list
    const filteredBillers = useMemo(() => {
        let list = billers;
        if (selectedQuickChip !== 'All') {
            const chip = POPULAR_ISSUERS.find(p => p.label === selectedQuickChip);
            if (chip && chip.query) {
                const q = chip.query.toLowerCase();
                list = list.filter(b =>
                    (b.billerName || '').toLowerCase().includes(q) ||
                    (b.issuer || '').toLowerCase().includes(q) ||
                    (b.billerId || '').toLowerCase().includes(q)
                );
            }
        }
        if (!billerSearch || !billerSearch.trim()) return list;
        const raw = billerSearch.trim().toLowerCase();
        return list.filter(b =>
            (b.billerName || '').toLowerCase().includes(raw) ||
            (b.issuer || '').toLowerCase().includes(raw) ||
            (b.billerId || '').toLowerCase().includes(raw) ||
            (b.description || '').toLowerCase().includes(raw)
        );
    }, [billers, billerSearch, selectedQuickChip]);

    // Select biller
    const handleSelectBiller = (biller) => {
        setSelectedBiller(biller);
        setIsComboboxOpen(false);
        setBillerSearch('');
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setParamErrors({});
        setCustomAmount('');
        setPaymentOption('TOTAL');

        const initialParams = {};
        if (biller.inputParams && Array.isArray(biller.inputParams)) {
            biller.inputParams.forEach(p => {
                initialParams[p.paramName] = '';
            });
        }
        setCustomerParams(initialParams);
    };

    const handleChangeBiller = () => {
        setSelectedBiller(null);
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setIsComboboxOpen(true);
    };

    // Format card number with spaces (e.g., 4532 1234 5678 9012)
    const formatCardInput = (value) => {
        const digits = value.replace(/\D/g, '').slice(0, 19);
        return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    };

    const handleParamChange = (paramName, rawValue) => {
        const isCardInput = (paramName.toLowerCase().includes('card') || paramName.toLowerCase().includes('last 4') || paramName.toLowerCase().includes('digits')) && !paramName.toLowerCase().includes('mobile');
        const formatted = isCardInput ? formatCardInput(rawValue) : rawValue;

        setCustomerParams(prev => ({
            ...prev,
            [paramName]: formatted
        }));

        if (paramErrors[paramName]) {
            setParamErrors(prev => {
                const next = { ...prev };
                delete next[paramName];
                return next;
            });
        }
        if (fetchedBill) {
            setFetchedBill(null);
        }
    };

    // Extract raw card digits and last 4
    const rawCardDigits = useMemo(() => {
        for (const [k, v] of Object.entries(customerParams)) {
            if ((k.toLowerCase().includes('card') || k.toLowerCase().includes('last 4') || k.toLowerCase().includes('digits')) && !k.toLowerCase().includes('mobile')) {
                return (v || '').replace(/\D/g, '');
            }
        }
        return '';
    }, [customerParams]);

    const cardNetwork = useMemo(() => detectCardNetwork(rawCardDigits), [rawCardDigits]);

    const cardLastFour = useMemo(() => {
        if (rawCardDigits.length >= 4) {
            return rawCardDigits.slice(-4);
        }
        return rawCardDigits;
    }, [rawCardDigits]);

    // Client-side validation
    const validateInputs = () => {
        const errors = {};
        if (!customerMobile || !/^[6-9]\d{9}$/.test(customerMobile.trim())) {
            errors.customerMobile = 'Valid 10-digit mobile number starting with 6-9 is required';
        }

        if (!selectedBiller) {
            setFormError('Please select a credit card issuer bank');
            return false;
        }

        if (selectedBiller.inputParams && Array.isArray(selectedBiller.inputParams)) {
            selectedBiller.inputParams.forEach(param => {
                const pLower = param.paramName.toLowerCase();
                // Mobile is validated via customerMobile
                if (pLower.includes('mobile')) return;

                const rawVal = customerParams[param.paramName] || '';
                const val = (pLower.includes('card') || pLower.includes('last 4') || pLower.includes('digits'))
                    ? rawVal.replace(/\D/g, '')
                    : rawVal.trim();

                if (!param.optional && !val) {
                    errors[param.paramName] = `${param.paramName} is required`;
                } else if (val) {
                    if (pLower.includes('last') || pLower.includes('4')) {
                        if (val.length < 4) {
                            errors[param.paramName] = 'Must enter at least 4 digits';
                        }
                    } else if (param.minLength > 0 && val.length < param.minLength) {
                        errors[param.paramName] = `Must be at least ${param.minLength} digits`;
                    }
                    if (param.dataType === 'NUMERIC' && !/^\d+$/.test(val)) {
                        errors[param.paramName] = 'Must contain numbers only';
                    }
                }
            });
        }

        setParamErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Fetch Credit Card Bill
    const handleFetchBill = async (e) => {
        if (e) e.preventDefault();
        setFetchError('');
        setFormError('');

        if (!validateInputs()) return;

        setIsFetchingBill(true);
        try {
            // Strip formatting spaces from card number before sending to backend
            const cleanParams = {};
            for (const [k, v] of Object.entries(customerParams)) {
                cleanParams[k] = (k.toLowerCase().includes('card') || k.toLowerCase().includes('last 4')) ? (v || '').replace(/\s+/g, '') : v;
            }
            // Ensure registered mobile parameter is seamlessly passed in customerParams
            cleanParams['Registered Mobile No'] = customerMobile.trim();

            const payload = {
                billerId: selectedBiller.billerId,
                customerMobile: customerMobile.trim(),
                customerParams: cleanParams
            };

            const result = await bbpsService.fetchCreditCardBill(payload);

            if (result && result.success) {
                setFetchedBill(result);

                // Check for minimum due and total due in additionalInfo
                let minDue = null;
                let totDue = null;
                if (result.additionalInfo && Array.isArray(result.additionalInfo)) {
                    result.additionalInfo.forEach(item => {
                        const name = (item.infoName || '').toLowerCase();
                        if (name.includes('minimum') || name.includes('min due')) {
                            minDue = parseFloat(item.infoValue.replace(/[^0-9.]/g, ''));
                        }
                        if (name.includes('total') || name.includes('total due')) {
                            totDue = parseFloat(item.infoValue.replace(/[^0-9.]/g, ''));
                        }
                    });
                }

                const effectiveTotal = totDue || (result.billAmount ? parseFloat(result.billAmount) : null);
                if (effectiveTotal && effectiveTotal > 0) {
                    setCustomAmount(effectiveTotal.toFixed(2));
                    setPaymentOption('TOTAL');
                } else if (minDue && minDue > 0) {
                    setCustomAmount(minDue.toFixed(2));
                    setPaymentOption('MIN');
                }
            } else {
                const msg = result?.message || 'Unable to fetch credit card bill. Please verify the card number and mobile.';
                setFetchError(msg);
                setFetchedBill(null);
            }
        } catch (err) {
            console.error('Credit card fetch error:', err);
            setFetchError(err.message || 'Failed to fetch credit card details from provider.');
            setFetchedBill(null);
        } finally {
            setIsFetchingBill(false);
        }
    };

    // Additional info extraction
    const extractedInfo = useMemo(() => {
        if (!fetchedBill?.additionalInfo) return {};
        const map = {};
        fetchedBill.additionalInfo.forEach(item => {
            const k = (item.infoName || '').toLowerCase();
            const v = item.infoValue || '';
            if (k.includes('min') && k.includes('due')) map.minDue = parseFloat(v.replace(/[^0-9.]/g, '')) || null;
            if (k.includes('total') && k.includes('due')) map.totalDue = parseFloat(v.replace(/[^0-9.]/g, '')) || null;
            if (k.includes('statement') || k.includes('bill date')) map.statementDate = v;
            if (k.includes('unbilled')) map.unbilled = v;
        });
        return map;
    }, [fetchedBill]);

    const billTotalDue = extractedInfo.totalDue || (fetchedBill?.billAmount ? parseFloat(fetchedBill.billAmount) : null);
    const billMinDue = extractedInfo.minDue;

    // Amount calculation
    const effectiveBillAmount = useMemo(() => {
        if (paymentOption === 'TOTAL' && billTotalDue !== null && billTotalDue > 0) {
            return billTotalDue;
        }
        if (paymentOption === 'MIN' && billMinDue !== null && billMinDue > 0) {
            return billMinDue;
        }
        return parseFloat(customAmount) || 0;
    }, [paymentOption, billTotalDue, billMinDue, customAmount]);

    const convenienceFee = 0; // BBPS Credit Card bill payments standard fee = 0
    const totalPayable = effectiveBillAmount + convenienceFee;
    const isInsufficient = numBalance < totalPayable;
    const isNoBillDue = Boolean(fetchedBill?.noBillDue || (fetchedBill?.billAmount !== null && fetchedBill?.billAmount !== undefined && effectiveBillAmount === 0));

    // Handle Payment Confirmation Screen
    const handleOpenConfirm = () => {
        setFormError('');
        if (!validateInputs()) return;

        if (totalPayable < 1) {
            setFormError('Credit card bill payment amount must be at least ₹1.00');
            return;
        }

        if (isInsufficient) {
            setFormError(`Insufficient wallet balance. Required: ₹${totalPayable.toFixed(2)}, Available: ₹${numBalance.toFixed(2)}`);
            return;
        }

        primeBharatConnectSound();
        setFlowStep('CONFIRM');
    };

    // Execute Payment
    const handleConfirmPayment = async () => {
        if (isSubmitting) return;
        if (isInsufficient) {
            setFormError('Payment rejected: Insufficient wallet balance');
            return;
        }

        setIsSubmitting(true);
        setFormError('');

        try {
            const idempotencyKey = `BBPS-CC-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

            // Clean card number for submission
            const cleanParams = {};
            for (const [k, v] of Object.entries(customerParams)) {
                cleanParams[k] = (k.toLowerCase().includes('card') || k.toLowerCase().includes('last 4')) ? (v || '').replace(/\s+/g, '') : v;
            }
            cleanParams['Registered Mobile No'] = customerMobile.trim();

            const payload = {
                billerId: selectedBiller.billerId,
                customerMobile: customerMobile.trim(),
                customerParams: cleanParams,
                amount: effectiveBillAmount,
                convenienceFee: convenienceFee,
                fetchRequestId: fetchedBill?.fetchRequestId || null,
                billNumber: fetchedBill?.billNumber || null,
                billDate: fetchedBill?.billDate || null,
                dueDate: fetchedBill?.dueDate || null,
                billPeriod: fetchedBill?.billPeriod || null,
                customerName: fetchedBill?.customerName || null,
                statementDate: extractedInfo.statementDate || null,
                minimumDue: billMinDue || null,
                totalDue: billTotalDue || null,
                additionalInfo: fetchedBill?.additionalInfo || null,
                idempotencyKey: idempotencyKey
            };

            const res = await bbpsService.payCreditCardBill(payload);

            refreshWallet && refreshWallet();
            try { window.dispatchEvent(new Event('walletUpdated')); } catch (e) {}

            setTxnOutcome(res);
            setFlowStep('RESULT');

            if (res && (res.success || res.status === 'SUCCESS')) {
                playBharatConnectSuccessSound();
                try {
                    confetti({
                        particleCount: 100,
                        spread: 75,
                        origin: { y: 0.6 }
                    });
                } catch (ignored) {}
            }
        } catch (err) {
            console.error('Credit card payment error:', err);
            const msg = err.message || 'Payment processing failed. Please check BBPS history.';
            setFormError(msg);
            setTxnOutcome({
                success: false,
                status: 'FAILED',
                merchantRefNo: `BBPSCC${Date.now()}`,
                amount: effectiveBillAmount,
                totalAmount: totalPayable,
                customerMobile: customerMobile,
                consumerNumber: cardLastFour ? `•••• ${cardLastFour}` : 'N/A',
                customerName: fetchedBill?.customerName || 'Cardholder',
                billerName: selectedBiller?.billerName,
                createdAt: new Date().toISOString(),
                message: msg
            });
            setFlowStep('RESULT');
            refreshWallet && refreshWallet();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNewPayment = () => {
        setFlowStep('FORM');
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setTxnOutcome(null);
        setCustomAmount('');
        setPaymentOption('TOTAL');
    };

    return (
        <div className="space-y-3 font-['Inter',sans-serif] max-w-full">
            {/* Top Navigation */}
            <BbpsServiceNav
                onBack={onBack}
                title={category?.name || 'Credit Card Bill Payment'}
                icon={CreditCard}
                gradient="from-amber-500 to-yellow-600"
                badgeText="Bharat Connect"
            />

            {/* STEP 1: FORM */}
            {flowStep === 'FORM' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* LEFT COLUMN: Issuer Selection + Card Details */}
                    <div className="lg:col-span-6 space-y-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-black flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-amber-600" />
                                        Credit Card Details
                                    </h3>
                                    <p className="text-[11px] text-slate-700 font-bold">
                                        Pay Visa, Mastercard & RuPay credit card bills across 38 registered Indian banks
                                    </p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                                    Official BBPS
                                </span>
                            </div>

                            {/* Form error alert */}
                            {formError && (
                                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            {/* Fetch error alert */}
                            {fetchError && (
                                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{fetchError}</span>
                                </div>
                            )}

                            {/* ISSUER SELECTION */}
                            <div className="space-y-1 relative" ref={comboboxRef}>
                                <label className="block text-xs font-black text-black">
                                    Card Issuer Bank <span className="text-rose-600">*</span>
                                </label>

                                {selectedBiller ? (
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-300 bg-amber-50/70 shadow-2xs">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                                {selectedBiller.billerName.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="text-xs md:text-sm font-black text-black truncate">
                                                        {selectedBiller.billerName}
                                                    </h4>
                                                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-600 text-white shrink-0">
                                                        <Check className="w-2 h-2" />
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono font-bold text-slate-600">
                                                        {selectedBiller.billerId}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-amber-800">
                                                        Fetch Supported
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleChangeBiller}
                                            className="px-2.5 py-1 text-xs font-black text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        {/* Quick Issuer Filter Pills */}
                                        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 scrollbar-none mb-1.5">
                                            {POPULAR_ISSUERS.map(chip => (
                                                <button
                                                    key={chip.label}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedQuickChip(chip.label);
                                                        setIsComboboxOpen(true);
                                                    }}
                                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 transition-all cursor-pointer ${
                                                        selectedQuickChip === chip.label
                                                            ? 'bg-amber-600 text-white shadow-2xs'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {chip.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Dropdown trigger */}
                                        <div
                                            onClick={() => setIsComboboxOpen(!isComboboxOpen)}
                                            className="w-full flex items-center justify-between px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-300 bg-slate-50 hover:bg-white cursor-pointer transition-all shadow-2xs"
                                        >
                                            <span className="font-bold text-slate-600">
                                                {loadingBillers ? 'Loading card issuers...' : 'Select or search bank (e.g. SBI, HDFC, ICICI)...'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-slate-500" />
                                        </div>

                                        {/* Dropdown list */}
                                        {isComboboxOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl border border-slate-300 shadow-xl max-h-64 overflow-y-auto p-1.5 space-y-1">
                                                <div className="sticky top-0 bg-white pb-1 z-10">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            value={billerSearch}
                                                            onChange={(e) => setBillerSearch(e.target.value)}
                                                            placeholder="Type issuer bank name..."
                                                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>

                                                {filteredBillers.length === 0 ? (
                                                    <div className="p-3 text-center text-xs font-bold text-slate-500">
                                                        No credit card issuers found matching query.
                                                    </div>
                                                ) : (
                                                    filteredBillers.map(b => (
                                                        <div
                                                            key={b.billerId}
                                                            onClick={() => handleSelectBiller(b)}
                                                            className="p-2 rounded-lg hover:bg-amber-50 cursor-pointer flex items-center justify-between transition-colors"
                                                        >
                                                            <div className="min-w-0 pr-2">
                                                                <h5 className="text-xs font-black text-black truncate">
                                                                    {b.billerName}
                                                                </h5>
                                                                <p className="text-[10px] text-slate-500 truncate">
                                                                    {b.issuer || b.description || b.billerId}
                                                                </p>
                                                            </div>
                                                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold shrink-0">
                                                                {b.billerId}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* DYNAMIC PARAMETERS (CARD NUMBER + REGISTERED MOBILE) */}
                            {selectedBiller && (
                                <form onSubmit={handleFetchBill} className="space-y-3 pt-1">
                                    {selectedBiller.inputParams?.filter(p => !p.paramName.toLowerCase().includes('mobile')).map(param => {
                                        const isCardInput = (param.paramName.toLowerCase().includes('card') || param.paramName.toLowerCase().includes('last 4') || param.paramName.toLowerCase().includes('digits')) && !param.paramName.toLowerCase().includes('mobile');
                                        const val = customerParams[param.paramName] || '';
                                        const err = paramErrors[param.paramName];

                                        return (
                                            <div key={param.paramName} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-xs font-black text-black">
                                                        {param.paramName} {!param.optional && <span className="text-rose-600">*</span>}
                                                    </label>
                                                    {isCardInput && cardNetwork && rawCardDigits.length >= 2 && (
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cardNetwork.badge}`}>
                                                            {cardNetwork.name}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="relative">
                                                    <input
                                                        type={isCardInput && !showCardNumber ? 'password' : 'text'}
                                                        inputMode="numeric"
                                                        value={val}
                                                        onChange={(e) => handleParamChange(param.paramName, e.target.value)}
                                                        placeholder={param.hint || (isCardInput ? 'Enter last 4 digits (e.g. 0998) or card number' : `Enter ${param.paramName}`)}
                                                        className={`w-full px-3 py-2 text-xs md:text-sm rounded-xl border font-bold text-black placeholder-slate-400 focus:outline-none transition-all shadow-2xs font-mono ${
                                                            err
                                                                ? 'border-rose-400 bg-rose-50/50 focus:ring-1 focus:ring-rose-500'
                                                                : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500'
                                                        }`}
                                                    />

                                                    {isCardInput && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowCardNumber(!showCardNumber)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                        >
                                                            {showCardNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </div>

                                                {err && (
                                                    <p className="text-[10px] font-bold text-rose-600">{err}</p>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Registered Customer Mobile */}
                                    <div className="space-y-1">
                                        <label className="block text-xs font-black text-black">
                                            Registered Mobile Number <span className="text-rose-600">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">
                                                +91
                                            </span>
                                            <input
                                                type="tel"
                                                maxLength={10}
                                                value={customerMobile}
                                                onChange={(e) => {
                                                    const clean = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                    setCustomerMobile(clean);
                                                    if (paramErrors.customerMobile) {
                                                        setParamErrors(prev => ({ ...prev, customerMobile: null }));
                                                    }
                                                }}
                                                placeholder="9876543210"
                                                className={`w-full pl-11 pr-3 py-2 text-xs md:text-sm rounded-xl border font-bold text-black placeholder-slate-400 focus:outline-none transition-all shadow-2xs font-mono ${
                                                    paramErrors.customerMobile
                                                        ? 'border-rose-400 bg-rose-50/50 focus:ring-1 focus:ring-rose-500'
                                                        : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500'
                                                }`}
                                            />
                                        </div>
                                        {paramErrors.customerMobile && (
                                            <p className="text-[10px] font-bold text-rose-600">{paramErrors.customerMobile}</p>
                                        )}
                                        <p className="text-[10px] text-slate-500 font-bold">
                                            OTP & payment SMS confirmation will be delivered to this number
                                        </p>
                                    </div>

                                    {/* Fetch Bill Button */}
                                    <button
                                        type="submit"
                                        disabled={isFetchingBill}
                                        className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {isFetchingBill ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Fetching Bill Details from Bank...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                <span>Fetch Bill & Outstanding Dues</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Safe Storage Notice */}
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 font-bold">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Security: Only the last 4 digits are saved. CVV or ATM PIN is never requested or stored.</span>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Bill Dues & Payment Breakdown */}
                    <div className="lg:col-span-6 space-y-3">
                        {fetchedBill ? (
                            /* FETCHED BILL CARD */
                            <div className="rounded-2xl border border-amber-300 bg-white p-4 md:p-5 shadow-xs space-y-4">
                                <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
                                    <div>
                                        <h3 className="text-sm md:text-base font-black text-black flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-amber-600" />
                                            Credit Card Statement
                                        </h3>
                                        <p className="text-[11px] text-slate-700 font-bold">
                                            Verified by {selectedBiller?.billerName}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                                        Verified Bill
                                    </span>
                                </div>

                                {/* Card Preview Banner */}
                                <div className={`p-4 rounded-xl bg-gradient-to-br ${cardNetwork ? cardNetwork.color : 'from-slate-800 to-slate-900'} text-white shadow-md relative overflow-hidden`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold block">
                                                {selectedBiller?.billerName}
                                            </span>
                                            <span className="text-sm font-black tracking-wide">
                                                {fetchedBill.customerName || 'Credit Card Customer'}
                                            </span>
                                        </div>
                                        <span className="text-xs font-black tracking-wider uppercase px-2 py-0.5 bg-white/20 rounded backdrop-blur-xs">
                                            {cardNetwork ? cardNetwork.name : 'CREDIT'}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-end font-mono">
                                        <div className="text-sm font-black tracking-widest">
                                            •••• •••• •••• {cardLastFour || '••••'}
                                        </div>
                                        {fetchedBill.dueDate && (
                                            <div className="text-right">
                                                <span className="text-[9px] block text-slate-300 uppercase font-sans font-bold">Due Date</span>
                                                <span className="text-xs font-black text-amber-300 font-sans">{fetchedBill.dueDate}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bill Attributes Grid */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {fetchedBill.billDate && (
                                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                                            <span className="text-[10px] font-bold text-slate-500 block">Statement Date</span>
                                            <span className="font-black text-black">{fetchedBill.billDate}</span>
                                        </div>
                                    )}
                                    {fetchedBill.billNumber && (
                                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                                            <span className="text-[10px] font-bold text-slate-500 block">Bill Number</span>
                                            <span className="font-mono font-black text-black truncate block">{fetchedBill.billNumber}</span>
                                        </div>
                                    )}
                                    {extractedInfo.unbilled && (
                                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                                            <span className="text-[10px] font-bold text-slate-500 block">Unbilled Dues</span>
                                            <span className="font-black text-slate-800">{extractedInfo.unbilled}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Payment Options (Total Due vs Min Due vs Custom) */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-black">
                                        Select Repayment Option
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {billTotalDue !== null && billTotalDue > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPaymentOption('TOTAL');
                                                    setCustomAmount(billTotalDue.toFixed(2));
                                                }}
                                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                    paymentOption === 'TOTAL'
                                                        ? 'border-amber-500 bg-amber-50/70 shadow-2xs ring-1 ring-amber-500'
                                                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[11px] font-black text-slate-700">Total Due</span>
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Recommended</span>
                                                </div>
                                                <span className="text-base font-black text-black">
                                                    ₹{billTotalDue.toFixed(2)}
                                                </span>
                                            </button>
                                        )}

                                        {billMinDue !== null && billMinDue > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPaymentOption('MIN');
                                                    setCustomAmount(billMinDue.toFixed(2));
                                                }}
                                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                    paymentOption === 'MIN'
                                                        ? 'border-amber-500 bg-amber-50/70 shadow-2xs ring-1 ring-amber-500'
                                                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                                                }`}
                                            >
                                                <span className="text-[11px] font-black text-slate-700 block mb-1">Minimum Due</span>
                                                <span className="text-base font-black text-black">
                                                    ₹{billMinDue.toFixed(2)}
                                                </span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Custom Amount Field */}
                                    <div className="pt-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black text-black">Pay Other Amount</span>
                                            <span className="text-[10px] font-bold text-slate-500">Min ₹1.00</span>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-600">₹</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="1"
                                                value={customAmount}
                                                onChange={(e) => {
                                                    setPaymentOption('CUSTOM');
                                                    setCustomAmount(e.target.value);
                                                }}
                                                placeholder="Enter custom amount"
                                                className="w-full pl-8 pr-3 py-2 text-xs md:text-sm rounded-xl border border-slate-300 bg-white font-black text-black focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Balance & Proceed Summary */}
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-600 font-bold">Repayment Amount</span>
                                        <span className="font-black text-black">₹{effectiveBillAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-600 font-bold">Convenience Fee</span>
                                        <span className="font-black text-emerald-700">₹0.00 (FREE)</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center">
                                        <span className="text-xs font-black text-black">Total Payable</span>
                                        <span className="text-base font-black text-amber-600">₹{totalPayable.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] text-slate-600 pt-1">
                                        <span className="flex items-center gap-1 font-bold">
                                            <Wallet className="w-3.5 h-3.5 text-slate-500" />
                                            Wallet Balance
                                        </span>
                                        <span className={`font-black ${isInsufficient ? 'text-rose-600' : 'text-slate-900'}`}>
                                            ₹{numBalance.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Proceed Button */}
                                <button
                                    type="button"
                                    onClick={handleOpenConfirm}
                                    disabled={totalPayable < 1 || isInsufficient}
                                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    <span>Proceed to Pay ₹{totalPayable.toFixed(2)}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            /* EMPTY STATE (Before Bill Fetch) */
                            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 md:p-8 text-center space-y-3">
                                <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-xs">
                                    <CreditCard className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-black">
                                        Bill Statement & Dues
                                    </h4>
                                    <p className="text-xs font-bold text-slate-600 max-w-sm mx-auto leading-relaxed">
                                        Select your credit card issuer bank and enter your card details to instantly fetch your total amount due, minimum due, and statement due date.
                                    </p>
                                </div>
                                <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold text-slate-600">
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">Instant Credit</span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">Zero Retailer Surcharge</span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">Direct Bank Settlement</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* STEP 2: CONFIRMATION MODAL */}
            {flowStep === 'CONFIRM' && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-5 md:p-6 space-y-4"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-black">Confirm Credit Card Payment</h3>
                                    <p className="text-[10px] text-slate-500 font-bold">Bharat Connect BBPS Gateway</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFlowStep('FORM')}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Bill Breakdown */}
                        <div className="space-y-2 text-xs">
                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-bold">Bank Issuer</span>
                                    <span className="font-black text-black text-right">{selectedBiller?.billerName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-bold">Card Number</span>
                                    <span className="font-mono font-black text-black">•••• •••• •••• {cardLastFour}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-bold">Customer Name</span>
                                    <span className="font-black text-black uppercase">{fetchedBill?.customerName || 'Cardholder'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-bold">Registered Mobile</span>
                                    <span className="font-mono font-black text-black">+91 {customerMobile}</span>
                                </div>
                                {fetchedBill?.dueDate && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 font-bold">Due Date</span>
                                        <span className="font-black text-rose-600">{fetchedBill.dueDate}</span>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-bold">Payment Amount</span>
                                    <span className="font-black text-black">₹{effectiveBillAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-bold">BBPS Convenience Fee</span>
                                    <span className="font-black text-emerald-700">₹0.00</span>
                                </div>
                                <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center">
                                    <span className="font-black text-black text-sm">Total Wallet Debit</span>
                                    <span className="font-black text-amber-600 text-lg">₹{totalPayable.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Security compliance notice */}
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[10px] text-blue-900 font-bold flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <span>
                                In accordance with RBI & BillAvenue guidelines, Credit Card bill payments are settled in Cash mode through authorized BBPS agent channels.
                            </span>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setFlowStep('FORM')}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-black text-xs transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPayment}
                                disabled={isSubmitting}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Debiting & Paying...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Confirm & Pay</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* STEP 3: RESULT / RECEIPT */}
            {flowStep === 'RESULT' && txnOutcome && (
                <div className="max-w-xl mx-auto py-2">
                    <BbpsReceiptCard
                        txnOutcome={txnOutcome}
                        category="credit-card"
                        billerName={selectedBiller?.billerName}
                        consumerNumber={cardLastFour ? `•••• ${cardLastFour}` : 'N/A'}
                        customerName={txnOutcome.customerName || fetchedBill?.customerName || 'Cardholder'}
                        onReset={handleNewPayment}
                        resetButtonText="+ Pay Another Credit Card"
                    />
                </div>
            )}
        </div>
    );
};

export default CreditCardFlow;
