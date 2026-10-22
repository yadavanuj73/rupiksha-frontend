import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HandCoins, CheckCircle2, AlertCircle, Clock,
    Search, Check, ShieldCheck, RefreshCw, Printer,
    Wallet, ArrowRight, Info, X, Building2, User,
    FileText, Calendar, DollarSign, ExternalLink, Lock,
    ChevronDown, ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { bbpsService } from '../../../services/apiService';
import { useWallet } from '../../../context/WalletContext';
import BbpsServiceNav from './BbpsServiceNav';
import BbpsReceiptCard from './BbpsReceiptCard';
import { primeBharatConnectSound, playBharatConnectSuccessSound } from '../../../utils/bbpsSound';

const LoanRepaymentFlow = ({ onBack, category }) => {
    const { balance, refreshWallet } = useWallet();
    const numBalance = typeof balance === 'number' ? balance : parseFloat(balance) || 0;

    // Flow steps: 'FORM' | 'CONFIRM' | 'RESULT'
    const [flowStep, setFlowStep] = useState('FORM');

    // Biller list & selection
    const [billers, setBillers] = useState([]);
    const [loadingBillers, setLoadingBillers] = useState(true);
    const [billerSearch, setBillerSearch] = useState('');
    const [selectedBiller, setSelectedBiller] = useState(null);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const comboboxRef = useRef(null);

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

    // Dynamic customer inputs
    const [customerParams, setCustomerParams] = useState({});
    const [customerMobile, setCustomerMobile] = useState('');
    const [paramErrors, setParamErrors] = useState({});

    // Bill fetch / validation state
    const [isFetchingBill, setIsFetchingBill] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [fetchedBill, setFetchedBill] = useState(null);

    // Custom payable amount (for billers that don't support bill fetch or allow adhoc payment)
    const [customAmount, setCustomAmount] = useState('');

    // Payment submission & outcome
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [txnOutcome, setTxnOutcome] = useState(null);

    // Load registered Loan Repayment billers from backend
    useEffect(() => {
        let isMounted = true;
        const fetchBillers = async () => {
            setLoadingBillers(true);
            try {
                const data = await bbpsService.getLoanBillers();
                if (isMounted && Array.isArray(data)) {
                    setBillers(data);
                }
            } catch (err) {
                console.error('Failed to load loan billers:', err);
            } finally {
                if (isMounted) setLoadingBillers(false);
            }
        };

        fetchBillers();
        return () => { isMounted = false; };
    }, []);

    // Filtered billers list based on search with token & symbol normalization
    const filteredBillers = useMemo(() => {
        if (!billerSearch || !billerSearch.trim()) return billers;
        const raw = billerSearch.trim().toLowerCase();
        const normalized = raw.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        const tokens = normalized.split(' ').filter(t => t.length >= 2);

        return billers.filter(b => {
            const name = (b.billerName || '').toLowerCase();
            const id = (b.billerId || '').toLowerCase();
            const desc = (b.description || '').toLowerCase();
            const fullRaw = `${name} ${id} ${desc}`;
            const fullNorm = fullRaw.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ');

            // 1. Direct raw substring match
            if (fullRaw.includes(raw) || fullNorm.includes(normalized)) {
                return true;
            }

            // 2. Multi-token match (all tokens match somewhere in name, ID, or description)
            if (tokens.length > 0 && tokens.every(t => fullNorm.includes(t))) {
                return true;
            }

            return false;
        });
    }, [billers, billerSearch]);

    // Progressive pagination limit to ensure fast rendering of 470+ billers without DOM freezing
    const [displayLimit, setDisplayLimit] = useState(30);

    useEffect(() => {
        setDisplayLimit(30);
    }, [billerSearch]);

    const visibleBillers = useMemo(() => {
        return filteredBillers.slice(0, displayLimit);
    }, [filteredBillers, displayLimit]);

    // On biller selection, initialize customer input parameters
    const handleSelectBiller = (biller) => {
        setSelectedBiller(biller);
        setIsComboboxOpen(false);
        setBillerSearch('');
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setParamErrors({});
        setCustomAmount('');

        const initialParams = {};
        if (biller.inputParams && Array.isArray(biller.inputParams)) {
            biller.inputParams.forEach(p => {
                initialParams[p.paramName] = '';
            });
        }
        setCustomerParams(initialParams);
    };

    const handleChangeLender = () => {
        setSelectedBiller(null);
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setIsComboboxOpen(true);
    };

    const handleParamChange = (paramName, value) => {
        setCustomerParams(prev => ({
            ...prev,
            [paramName]: value
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

    // Client-side validation for customer parameters
    const validateInputs = () => {
        const errors = {};
        if (!customerMobile || !/^[6-9]\d{9}$/.test(customerMobile.trim())) {
            errors.customerMobile = 'Valid 10-digit mobile number starting with 6-9 is required';
        }

        if (!selectedBiller) {
            setFormError('Please select a loan lender or NBFC');
            return false;
        }

        if (selectedBiller.inputParams && Array.isArray(selectedBiller.inputParams)) {
            selectedBiller.inputParams.forEach(param => {
                const val = (customerParams[param.paramName] || '').trim();
                if (!param.optional && !val) {
                    errors[param.paramName] = `${param.paramName} is required`;
                } else if (val) {
                    if (param.minLength > 0 && val.length < param.minLength) {
                        errors[param.paramName] = `Must be at least ${param.minLength} characters`;
                    }
                    if (param.maxLength > 0 && val.length > param.maxLength) {
                        errors[param.paramName] = `Cannot exceed ${param.maxLength} characters`;
                    }
                    if (param.dataType === 'NUMERIC' && !/^\d+$/.test(val)) {
                        errors[param.paramName] = 'Must contain numbers only';
                    }
                    if (param.regEx) {
                        try {
                            const regex = new RegExp(param.regEx);
                            if (!regex.test(val)) {
                                errors[param.paramName] = 'Invalid format';
                            }
                        } catch (ignored) {}
                    }
                }
            });
        }

        setParamErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Fetch loan bill or validate account with provider
    const handleFetchBill = async (e) => {
        if (e) e.preventDefault();
        setFetchError('');
        setFormError('');

        if (!validateInputs()) {
            return;
        }

        setIsFetchingBill(true);
        try {
            const payload = {
                billerId: selectedBiller.billerId,
                customerMobile: customerMobile.trim(),
                customerParams: customerParams
            };

            const result = await bbpsService.fetchLoanBill(payload);

            if (result && result.success) {
                setFetchedBill(result);
                if (result.billAmount && parseFloat(result.billAmount) > 0) {
                    setCustomAmount(parseFloat(result.billAmount).toFixed(2));
                }
            } else {
                const msg = result?.message || 'Unable to fetch loan details. Please verify your loan account number.';
                setFetchError(msg);
                setFetchedBill(null);
            }
        } catch (err) {
            console.error('Loan fetch error:', err);
            setFetchError(err.message || 'Failed to fetch loan details from lender. Please verify the account number.');
            setFetchedBill(null);
        } finally {
            setIsFetchingBill(false);
        }
    };

    // Payable amount calculations
    const effectiveBillAmount = fetchedBill?.billAmount ? parseFloat(fetchedBill.billAmount) : (parseFloat(customAmount) || 0);
    const convenienceFee = 0; // BBPS Loan Repayment has ₹0 retailer convenience fee
    const totalPayable = effectiveBillAmount + convenienceFee;
    const isNoBillDue = Boolean(fetchedBill?.noBillDue || (fetchedBill?.billAmount !== null && fetchedBill?.billAmount !== undefined && effectiveBillAmount === 0));
    const isInsufficient = numBalance < totalPayable;

    // Mask sensitive loan account identifier for privacy
    const primaryAccountVal = useMemo(() => {
        if (!customerParams) return '';
        for (const [k, v] of Object.entries(customerParams)) {
            if (v && (k.toLowerCase().includes('loan') || k.toLowerCase().includes('lan') || k.toLowerCase().includes('account') || k.toLowerCase().includes('contract') || k.toLowerCase().includes('proposal'))) {
                return v;
            }
        }
        return Object.values(customerParams)[0] || '';
    }, [customerParams]);

    const maskAccount = (val) => {
        if (!val || val.length <= 4) return val || '••••';
        const last4 = val.slice(-4);
        return '•••• ' + last4;
    };

    // Open confirmation screen
    const handleOpenConfirm = () => {
        setFormError('');
        if (!validateInputs()) return;

        if (totalPayable <= 0) {
            setFormError('Payable loan repayment amount must be greater than zero');
            return;
        }

        if (isInsufficient) {
            setFormError(`Insufficient wallet balance. Required: ₹${totalPayable.toFixed(2)}, Available: ₹${numBalance.toFixed(2)}`);
            return;
        }

        primeBharatConnectSound();
        setFlowStep('CONFIRM');
    };

    // Submit payment to backend with double-click and idempotency protection
    const handleConfirmPayment = async () => {
        if (isSubmitting) return; // Prevent double click
        if (isInsufficient) {
            setFormError('Payment rejected: Insufficient wallet balance');
            return;
        }

        setIsSubmitting(true);
        setFormError('');

        try {
            const idempotencyKey = `BBPS-LN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

            const payload = {
                billerId: selectedBiller.billerId,
                customerMobile: customerMobile.trim(),
                customerParams: customerParams,
                amount: effectiveBillAmount,
                convenienceFee: convenienceFee,
                fetchRequestId: fetchedBill?.fetchRequestId || null,
                billNumber: fetchedBill?.billNumber || null,
                billDate: fetchedBill?.billDate || null,
                dueDate: fetchedBill?.dueDate || null,
                billPeriod: fetchedBill?.billPeriod || null,
                customerName: fetchedBill?.customerName || null,
                additionalInfo: fetchedBill?.additionalInfo || null,
                idempotencyKey: idempotencyKey
            };

            const res = await bbpsService.payLoanBill(payload);

            // Authoritative balance refresh
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
            console.error('Loan repayment error:', err);
            const msg = err.message || 'Payment processing failed. Please check BBPS history.';
            setFormError(msg);
            setTxnOutcome({
                success: false,
                status: 'FAILED',
                merchantRefNo: idempotencyKey,
                amount: effectiveBillAmount,
                totalAmount: totalPayable,
                customerMobile: customerMobile,
                consumerNumber: primaryAccountVal || 'N/A',
                customerName: fetchedBill?.customerName || 'Borrower',
                billerName: selectedBiller?.billerName,
                billNumber: fetchedBill?.billNumber,
                createdAt: new Date().toISOString(),
                message: msg
            });
            setFlowStep('RESULT');
            refreshWallet && refreshWallet();
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset flow for new repayment
    const handleNewPayment = () => {
        setFlowStep('FORM');
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setTxnOutcome(null);
        setCustomAmount('');
    };

    return (
        <div className="space-y-3 font-['Inter',sans-serif] max-w-full">
            {/* Top Navigation & Service Bar */}
            <BbpsServiceNav
                onBack={onBack}
                title={category?.name || 'Loan Repayment'}
                icon={HandCoins}
                gradient="from-emerald-600 to-teal-700"
                badgeText="Bharat Connect"
            />

            {/* Step 1: FORM (Compact side-by-side without page scroll) */}
            {flowStep === 'FORM' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* LEFT COLUMN: Lender Selection + Customer Loan Parameters */}
                    <div className="lg:col-span-6 space-y-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-black flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-emerald-600" />
                                        Select Lender & Details
                                    </h3>
                                    <p className="text-[11px] text-slate-700 font-bold">
                                        Choose from 470+ Bharat Connect registered lenders
                                    </p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
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

                            {/* LENDER SELECTION: Combobox Dropdown */}
                            <div className="space-y-1 relative" ref={comboboxRef}>
                                <label className="block text-xs font-black text-black">
                                    Lender / Financier <span className="text-rose-600">*</span>
                                </label>

                                {selectedBiller ? (
                                    /* Selected Lender Badge with Change Option */
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/70 shadow-2xs">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                                {selectedBiller.billerName.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="text-xs md:text-sm font-black text-black truncate">
                                                        {selectedBiller.billerName}
                                                    </h4>
                                                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-600 text-white shrink-0">
                                                        <Check className="w-2 h-2" />
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono font-bold text-slate-600">
                                                        {selectedBiller.billerId}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-emerald-800">
                                                        {selectedBiller.billerFetchRequirement === 'NOT_SUPPORTED' ? 'Instant Pay' : 'Fetch Supported'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleChangeLender}
                                            className="px-2.5 py-1 text-xs font-black text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer shrink-0"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    /* Dropdown Input Trigger */
                                    <div className="relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                            <input
                                                type="text"
                                                value={billerSearch}
                                                onFocus={() => setIsComboboxOpen(true)}
                                                onChange={(e) => {
                                                    setBillerSearch(e.target.value);
                                                    setIsComboboxOpen(true);
                                                }}
                                                placeholder={loadingBillers ? "Loading 470+ lenders..." : "Select or search lender (e.g. Annapurna, Bajaj, Muthoot, Tata...)"}
                                                className="w-full pl-9 pr-8 py-2 text-xs md:text-sm rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold text-black placeholder-slate-500 transition-all shadow-2xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsComboboxOpen(prev => !prev)}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black cursor-pointer"
                                            >
                                                <ChevronDown className={`w-4 h-4 transition-transform ${isComboboxOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>

                                        {/* Floating Combobox Dropdown (Absolute - zero document height added!) */}
                                        {isComboboxOpen && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-64 flex flex-col">
                                                {/* Popular Quick-Select Pills */}
                                                {!billerSearch && (
                                                    <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                                                        <span className="text-[10px] font-bold text-slate-500 block mb-1">Quick Select Popular:</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {['Annapurna', 'Aadhar', 'Aditya Birla', 'Piramal', 'Aavas', '121 Finance'].map(pill => (
                                                                <button
                                                                    key={pill}
                                                                    type="button"
                                                                    onClick={() => setBillerSearch(pill)}
                                                                    className="px-2 py-0.5 text-[10px] font-bold bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 rounded-full transition-colors cursor-pointer"
                                                                >
                                                                    {pill}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Searchable Options */}
                                                <div className="overflow-y-auto max-h-52 divide-y divide-slate-100 custom-scrollbar">
                                                    {loadingBillers ? (
                                                        <div className="p-4 text-center">
                                                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 mx-auto mb-1" />
                                                            <p className="text-[11px] font-bold text-slate-500">Loading lenders...</p>
                                                        </div>
                                                    ) : filteredBillers.length === 0 ? (
                                                        <div className="p-3 text-center space-y-2">
                                                            <p className="text-xs font-bold text-slate-600">No lenders found matching "{billerSearch}"</p>
                                                            {billerSearch.trim().length >= 8 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectBiller({
                                                                        billerId: billerSearch.trim().toUpperCase(),
                                                                        billerName: billerSearch.trim(),
                                                                        category: 'Loan Repayment',
                                                                        billerFetchRequirement: 'MANDATORY',
                                                                        billerPaymentExactness: 'Exact',
                                                                        supportBillValidation: 'OPTIONAL',
                                                                        description: 'Bharat Connect Registered Loan Provider',
                                                                        inputParams: [
                                                                            { paramName: 'Loan Account Number', dataType: 'ALPHANUMERIC', optional: false, minLength: 4, maxLength: 30, hint: 'Loan Account Number / LAN' }
                                                                        ]
                                                                    })}
                                                                    className="text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg px-2.5 py-1 hover:bg-emerald-200 transition-colors"
                                                                >
                                                                    Use ID "{billerSearch.trim().toUpperCase()}"
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        filteredBillers.slice(0, 40).map((biller) => (
                                                            <div
                                                                key={biller.billerId}
                                                                onClick={() => handleSelectBiller(biller)}
                                                                className="p-2.5 hover:bg-emerald-50/60 cursor-pointer transition-colors flex items-center justify-between gap-2.5 text-left"
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 font-black text-[10px] flex items-center justify-center shrink-0 border border-slate-200">
                                                                        {biller.billerName.slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="text-xs font-black text-black truncate">
                                                                            {biller.billerName}
                                                                        </div>
                                                                        <div className="text-[10px] font-mono text-slate-500">
                                                                            {biller.billerId}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                                                    {biller.billerFetchRequirement === 'NOT_SUPPORTED' ? 'Pay' : 'Fetch'}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* CUSTOMER LOAN PARAMETERS FORM */}
                            <form onSubmit={handleFetchBill} className="space-y-3 pt-1">
                                {selectedBiller && selectedBiller.inputParams?.map((param) => {
                                    const val = customerParams[param.paramName] || '';
                                    const hasErr = Boolean(paramErrors[param.paramName]);
                                    return (
                                        <div key={param.paramName} className="space-y-1">
                                            <label className="block text-xs font-black text-black">
                                                {param.paramName}
                                                {!param.optional && <span className="text-rose-600 ml-1">*</span>}
                                            </label>
                                            <input
                                                type={param.dataType === 'NUMERIC' ? 'tel' : 'text'}
                                                value={val}
                                                maxLength={param.maxLength > 0 ? param.maxLength : undefined}
                                                onChange={(e) => handleParamChange(param.paramName, e.target.value)}
                                                placeholder={param.hint || `Enter ${param.paramName}`}
                                                className={`w-full px-3 py-2 text-xs md:text-sm rounded-xl border font-bold text-black placeholder-slate-400 transition-all ${
                                                    hasErr
                                                        ? 'border-rose-400 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/20'
                                                        : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                                                }`}
                                            />
                                            {hasErr && (
                                                <p className="text-[11px] font-bold text-rose-600">{paramErrors[param.paramName]}</p>
                                            )}
                                        </div>
                                    );
                                })}

                                {!selectedBiller && (
                                    <div className="space-y-1 opacity-60 pointer-events-none">
                                        <label className="block text-xs font-black text-slate-700">
                                            Loan Account Number / LAN <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            disabled
                                            placeholder="Select a lender above to enter Loan Account Number"
                                            className="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-300 bg-slate-100 font-bold text-slate-500 cursor-not-allowed"
                                        />
                                    </div>
                                )}

                                {/* Customer Mobile Number */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-black text-black">
                                        Customer Mobile Number <span className="text-rose-600">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        value={customerMobile}
                                        disabled={!selectedBiller}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/\D/g, '');
                                            setCustomerMobile(v);
                                            if (paramErrors.customerMobile) {
                                                setParamErrors(prev => {
                                                    const next = { ...prev };
                                                    delete next.customerMobile;
                                                    return next;
                                                });
                                            }
                                        }}
                                        placeholder="10-digit customer mobile for SMS receipt"
                                        className={`w-full px-3 py-2 text-xs md:text-sm rounded-xl border font-bold text-black placeholder-slate-400 transition-all ${
                                            !selectedBiller
                                                ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                                                : paramErrors.customerMobile
                                                ? 'border-rose-400 bg-rose-50/50'
                                                : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                                        }`}
                                    />
                                    {paramErrors.customerMobile && (
                                        <p className="text-[11px] font-bold text-rose-600">{paramErrors.customerMobile}</p>
                                    )}
                                </div>

                                {/* Fetch / Verify Account Button */}
                                <button
                                    type="submit"
                                    disabled={!selectedBiller || isFetchingBill}
                                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                                >
                                    {isFetchingBill ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Connecting to Lender...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-3.5 h-3.5" />
                                            <span>{selectedBiller?.billerFetchRequirement === 'NOT_SUPPORTED' ? 'Verify Account' : 'Fetch Loan Details'}</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Account Details & Repayment Summary */}
                    <div className="lg:col-span-6 space-y-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-black">
                                        Loan Account Details
                                    </h3>
                                    <p className="text-[11px] text-slate-700 font-bold">
                                        {selectedBiller ? selectedBiller.billerName : 'Verified Bharat Connect Bill'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-slate-700 block">Wallet Balance</span>
                                    <span className="text-xs md:text-sm font-black text-black">₹{numBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* State 1: Awaiting Fetch */}
                            {!fetchedBill ? (
                                <div className="py-8 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
                                        <HandCoins className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black text-black">Awaiting Loan Verification</h4>
                                        <p className="text-[11px] font-bold text-slate-600 max-w-sm mx-auto">
                                            Select your lender and enter your Loan Account Number on the left, then click <span className="text-slate-900">"Fetch Loan Details"</span>.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-3 pt-2 text-[10px] font-black text-slate-700">
                                        <span className="flex items-center gap-1">
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> NPCI Certified
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Instant Receipt
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Check className="w-3.5 h-3.5 text-emerald-600" /> ₹0 Convenience Fee
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                /* State 2: Fetched Loan Details Card */
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            Verified Loan Details
                                        </span>
                                        {fetchedBill.dueDate && (
                                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-300">
                                                Due: {fetchedBill.dueDate}
                                            </span>
                                        )}
                                    </div>

                                    {/* Breakdown in the exact series requested: Consumer Name, BillerName, Consumer Number, Ref, Period */}
                                    <div className="space-y-1.5 bg-white p-3 rounded-xl border border-emerald-200">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-700">Consumer Name</span>
                                            <span className="font-black text-black">{fetchedBill.customerName || 'Consumer'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-700">Biller Name</span>
                                            <span className="font-black text-black text-right max-w-[65%] truncate" title={fetchedBill.billerName || selectedBiller?.billerName}>
                                                {fetchedBill.billerName || selectedBiller?.billerName}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-700">Consumer Number</span>
                                            <span className="font-mono font-black text-black">{primaryAccountVal || fetchedBill.consumerNumber}</span>
                                        </div>
                                        {fetchedBill.billNumber && (
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-700">Bill / Loan Ref</span>
                                                <span className="font-mono font-bold text-slate-800">{fetchedBill.billNumber}</span>
                                            </div>
                                        )}
                                        {fetchedBill.billPeriod && fetchedBill.billPeriod !== 'NA' && (
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-700">Period</span>
                                                <span className="font-bold text-slate-800">{fetchedBill.billPeriod}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Amount Section */}
                                    <div className="space-y-2">
                                        {isNoBillDue && (
                                            <div className="p-2.5 rounded-xl bg-teal-100 text-teal-900 border border-teal-300 text-xs font-bold flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                                                <span>No pending EMI due. You may enter an advance repayment amount:</span>
                                            </div>
                                        )}

                                        {fetchedBill.billAmount && !isNoBillDue ? (
                                            <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-200">
                                                <span className="text-xs font-black text-black">EMI / Payable Amount</span>
                                                <span className="text-base font-black text-emerald-700">
                                                    ₹{parseFloat(fetchedBill.billAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="block text-xs font-black text-black">
                                                    {isNoBillDue ? 'Advance / Repayment Amount (₹)' : 'Repayment Amount (₹)'} <span className="text-rose-600">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={customAmount}
                                                    onChange={(e) => setCustomAmount(e.target.value)}
                                                    placeholder="Enter repayment amount"
                                                    className="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-300 bg-white font-black text-black focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                                                />
                                            </div>
                                        )}

                                        {/* Insufficient balance warning */}
                                        {isInsufficient && (
                                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                                                <div>
                                                    <span className="font-black block">Insufficient Wallet Balance</span>
                                                    <span>Available: ₹{numBalance.toFixed(2)} | Required: ₹{totalPayable.toFixed(2)}. Please top up your wallet.</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Proceed to Payment Button */}
                                        <button
                                            type="button"
                                            onClick={handleOpenConfirm}
                                            disabled={isInsufficient || totalPayable <= 0}
                                            className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                                                isInsufficient || totalPayable <= 0
                                                    ? 'bg-slate-200 text-slate-600 cursor-not-allowed border border-slate-300'
                                                    : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white cursor-pointer active:scale-[0.99]'
                                            }`}
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>Review & Pay ₹{totalPayable.toFixed(2)}</span>
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: CONFIRMATION MODAL */}
            {flowStep === 'CONFIRM' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-['Inter',sans-serif]">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 md:p-6 shadow-2xl space-y-4"
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                                    <HandCoins className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-black">Confirm Loan Payment</h3>
                                    <p className="text-[11px] font-bold text-slate-700">Official Bharat Connect Transaction</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFlowStep('FORM')}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Breakdown summary */}
                        <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-bold">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-700">Biller Name</span>
                                <span className="font-black text-black text-right max-w-[200px] truncate">{fetchedBill?.billerName || selectedBiller?.billerName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-700">Consumer Number</span>
                                <span className="font-mono font-black text-black">{primaryAccountVal || fetchedBill?.consumerNumber}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-700">Consumer Name</span>
                                <span className="font-black text-black">{fetchedBill?.customerName || 'Consumer'}</span>
                            </div>
                            {fetchedBill?.dueDate && (
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700">Due Date</span>
                                    <span className="font-bold text-emerald-800">{fetchedBill.dueDate}</span>
                                </div>
                            )}
                            <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                                <span className="text-slate-700">Repayment Amount</span>
                                <span className="font-black text-black">₹{effectiveBillAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-700">Convenience Fee</span>
                                <span className="font-black text-emerald-700">FREE (₹0.00)</span>
                            </div>
                            <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm">
                                <span className="font-black text-black">Total Debit from Wallet</span>
                                <span className="font-black text-emerald-700 text-base">₹{totalPayable.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Wallet Balance check inside confirmation */}
                        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700">Available Wallet Balance:</span>
                            <span className={`font-black ${isInsufficient ? 'text-rose-600' : 'text-black'}`}>
                                ₹{numBalance.toFixed(2)}
                            </span>
                        </div>

                        {isInsufficient && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>Insufficient balance. You cannot confirm this transaction.</span>
                            </div>
                        )}

                        {/* Confirmation Actions */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setFlowStep('FORM')}
                                disabled={isSubmitting}
                                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPayment}
                                disabled={isSubmitting || isInsufficient}
                                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                                    isSubmitting || isInsufficient
                                        ? 'bg-slate-300 text-slate-600 cursor-not-allowed border border-slate-300'
                                        : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white cursor-pointer active:scale-95'
                                }`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Debiting & Paying...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Confirm Payment</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* STEP 3: TRANSACTION RESULT / RECEIPT SCREEN */}
            {flowStep === 'RESULT' && txnOutcome && (
                <BbpsReceiptCard
                    txnOutcome={txnOutcome}
                    category="loan-repayment"
                    billerName={selectedBiller?.billerName}
                    consumerNumber={primaryAccountVal || fetchedBill?.consumerNumber || ''}
                    customerName={fetchedBill?.customerName || txnOutcome.customerName || ''}
                    onReset={handleNewPayment}
                    resetButtonText="+ Pay Another EMI"
                />
            )}
        </div>
    );
};

export default LoanRepaymentFlow;
