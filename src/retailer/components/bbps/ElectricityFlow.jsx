import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, ArrowLeft, CheckCircle2, AlertCircle, Clock,
    Search, Check, ShieldCheck, RefreshCw, Printer,
    Wallet, ArrowRight, Info, X, Building2, User,
    FileText, Calendar, DollarSign, MapPin, ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { bbpsService } from '../../../services/apiService';
import { useWallet } from '../../../context/WalletContext';

const ALL_INDIAN_STATES = [
    'All India',
    'Andhra Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Delhi',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jammu & Kashmir',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal'
];

const ElectricityFlow = ({ onBack }) => {
    const { balance, refreshWallet } = useWallet();
    const numBalance = typeof balance === 'number' ? balance : parseFloat(balance) || 0;

    // Flow navigation: 'FORM' | 'CONFIRM' | 'RESULT'
    const [flowStep, setFlowStep] = useState('FORM');

    // Biller list & selection
    const [billers, setBillers] = useState([]);
    const [loadingBillers, setLoadingBillers] = useState(true);
    const [selectedState, setSelectedState] = useState('All India');
    const [billerSearch, setBillerSearch] = useState('');
    const [selectedBiller, setSelectedBiller] = useState(null);

    // Dynamic customer inputs
    const [customerParams, setCustomerParams] = useState({});
    const [customerMobile, setCustomerMobile] = useState('');
    const [paramErrors, setParamErrors] = useState({});

    // Bill fetch state
    const [isFetchingBill, setIsFetchingBill] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [fetchedBill, setFetchedBill] = useState(null);

    // Payment submission & outcome
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [txnOutcome, setTxnOutcome] = useState(null);

    // Load Electricity Billers from backend
    useEffect(() => {
        let isMounted = true;
        const fetchBillers = async () => {
            setLoadingBillers(true);
            try {
                const stateParam = selectedState === 'All India' ? null : selectedState;
                const data = await bbpsService.getElectricityBillers(stateParam);
                if (isMounted && Array.isArray(data)) {
                    setBillers(data);
                    // If previously selected biller is not in new state, reset or re-match
                    if (selectedBiller) {
                        const stillExists = data.find(b => b.billerId === selectedBiller.billerId);
                        if (!stillExists && selectedState !== 'All India') {
                            setSelectedBiller(null);
                            setFetchedBill(null);
                            setCustomerParams({});
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load electricity billers:', err);
            } finally {
                if (isMounted) setLoadingBillers(false);
            }
        };

        fetchBillers();
        return () => { isMounted = false; };
    }, [selectedState]);

    // Filtered billers list based on search
    const filteredBillers = useMemo(() => {
        if (!billerSearch || !billerSearch.trim()) return billers;
        const query = billerSearch.toLowerCase().trim();
        return billers.filter(b =>
            (b.billerName && b.billerName.toLowerCase().includes(query)) ||
            (b.billerAliasName && b.billerAliasName.toLowerCase().includes(query)) ||
            (b.state && b.state.toLowerCase().includes(query)) ||
            (b.billerId && b.billerId.toLowerCase().includes(query))
        );
    }, [billers, billerSearch]);

    // On biller selection, initialize customer input parameters
    const handleSelectBiller = (biller) => {
        setSelectedBiller(biller);
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setParamErrors({});

        // Initialize empty fields for mandatory parameters
        const initialParams = {};
        if (biller.inputParams && Array.isArray(biller.inputParams)) {
            biller.inputParams.forEach(p => {
                initialParams[p.paramName] = '';
            });
        }
        setCustomerParams(initialParams);
    };

    const handleParamChange = (paramName, value) => {
        setCustomerParams(prev => ({
            ...prev,
            [paramName]: value
        }));
        // Clear error for this field
        if (paramErrors[paramName]) {
            setParamErrors(prev => {
                const next = { ...prev };
                delete next[paramName];
                return next;
            });
        }
        // Invalidate previous bill fetch if customer edits identifiers
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
            setFormError('Please select an electricity distribution company (DISCOM)');
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

    // Fetch bill details from provider
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

            const result = await bbpsService.fetchElectricityBill(payload);

            if (result && result.success) {
                setFetchedBill(result);
            } else {
                const msg = result?.message || 'Unable to fetch bill. Please verify the consumer identifier.';
                setFetchError(msg);
                setFetchedBill(null);
            }
        } catch (err) {
            console.error('Bill fetch error:', err);
            setFetchError(err.message || 'Failed to fetch bill from electricity board. Please verify details.');
            setFetchedBill(null);
        } finally {
            setIsFetchingBill(false);
        }
    };

    // Calculated amounts
    const billAmount = fetchedBill?.billAmount ? parseFloat(fetchedBill.billAmount) : 0;
    const convenienceFee = 0; // standard BBPS CCF
    const totalPayable = billAmount + convenienceFee;
    const hasSufficientBalance = numBalance >= totalPayable && totalPayable > 0;

    const handleProceedToConfirm = () => {
        setFormError('');
        if (!fetchedBill) {
            setFormError('Please fetch and verify your bill before proceeding to payment.');
            return;
        }
        if (totalPayable <= 0) {
            setFormError('Invalid payable amount.');
            return;
        }
        if (!hasSufficientBalance) {
            setFormError(`Insufficient wallet balance. Required: ₹${totalPayable.toFixed(2)}, Available: ₹${numBalance.toFixed(2)}`);
            return;
        }
        setFlowStep('CONFIRM');
    };

    // Execute Electricity Bill Payment
    const handleExecutePayment = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setFormError('');

        const idempotencyKey = `BBPS-EL-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

        const payload = {
            billerId: selectedBiller.billerId,
            customerMobile: customerMobile.trim(),
            customerParams: customerParams,
            amount: billAmount,
            convenienceFee: convenienceFee,
            fetchRequestId: fetchedBill?.fetchRequestId,
            billNumber: fetchedBill?.billNumber,
            billDate: fetchedBill?.billDate,
            dueDate: fetchedBill?.dueDate,
            customerName: fetchedBill?.customerName,
            additionalInfo: fetchedBill?.additionalInfo,
            idempotencyKey: idempotencyKey
        };

        try {
            const res = await bbpsService.payElectricityBill(payload);

            // Authoritative balance refresh
            refreshWallet && refreshWallet();
            try { window.dispatchEvent(new Event('walletUpdated')); } catch (e) {}

            setTxnOutcome(res);
            setFlowStep('RESULT');

            if (res.success || res.status === 'SUCCESS') {
                try {
                    confetti({
                        particleCount: 100,
                        spread: 75,
                        origin: { y: 0.6 }
                    });
                } catch (e) {}
            }
        } catch (err) {
            console.error('Electricity bill payment error:', err);
            const msg = err.message || 'Payment processing failed. Please check BBPS history.';
            setFormError(msg);
            setTxnOutcome({
                success: false,
                status: 'FAILED',
                amount: billAmount,
                totalAmount: totalPayable,
                customerMobile: customerMobile,
                consumerNumber: fetchedBill?.consumerNumber,
                customerName: fetchedBill?.customerName,
                billerName: selectedBiller.billerName,
                billNumber: fetchedBill?.billNumber,
                message: msg
            });
            setFlowStep('RESULT');
            refreshWallet && refreshWallet();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetAll = () => {
        setSelectedBiller(null);
        setCustomerParams({});
        setCustomerMobile('');
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setParamErrors({});
        setTxnOutcome(null);
        setFlowStep('FORM');
    };

    return (
        <div className="space-y-5 font-['Inter',sans-serif] max-w-full">
            {/* Top Navigation & Balance Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-black font-black text-xs hover:border-blue-600 hover:text-blue-700 hover:shadow-xs transition-all cursor-pointer"
                >
                    <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                    <span>Back to all BBPS categories</span>
                </button>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Wallet Available:</span>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        ₹{numBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-xs">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 opacity-10 blur-2xl" />
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md flex items-center justify-center shrink-0">
                            <Zap className="h-7 w-7" strokeWidth={2.3} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg md:text-2xl font-black text-black tracking-tight">
                                    Electricity Bill Payment
                                </h1>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                    Bharat Connect
                                </span>
                            </div>
                            <p className="text-xs md:text-sm font-bold text-slate-700 mt-0.5">
                                Official BBPS bill fetch & payment across 35+ state & private DISCOMs in India
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Notification Banner */}
            {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <span>{formError}</span>
                    </div>
                    <button type="button" onClick={() => setFormError('')} className="text-rose-500 hover:text-rose-700">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* STEP 1: MAIN FORM */}
            {flowStep === 'FORM' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* LEFT COLUMN: State, DISCOM & Consumer Parameters (7 Cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* State & Biller Picker Card */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h2 className="text-sm font-black text-black">1. Select Electricity Board (DISCOM)</h2>
                                    <p className="text-xs text-slate-500 font-bold">Choose your state and utility provider</p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    {billers.length} Boards
                                </span>
                            </div>

                            {/* State Dropdown & Search Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-5">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                                        Filter by State
                                    </label>
                                    <select
                                        value={selectedState}
                                        onChange={(e) => setSelectedState(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-black cursor-pointer shadow-2xs"
                                    >
                                        {ALL_INDIAN_STATES.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-7">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                                        Search Board / DISCOM
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={billerSearch}
                                            onChange={(e) => setBillerSearch(e.target.value)}
                                            placeholder="Search by DISCOM name, e.g. MSEDCL, BSES, Tata..."
                                            className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-black placeholder-slate-400 shadow-2xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* DISCOM List Grid */}
                            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                {loadingBillers ? (
                                    <div className="py-8 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                                        <span>Loading electricity providers...</span>
                                    </div>
                                ) : filteredBillers.length > 0 ? (
                                    filteredBillers.map(b => {
                                        const isSelected = selectedBiller?.billerId === b.billerId;
                                        return (
                                            <button
                                                key={b.billerId}
                                                type="button"
                                                onClick={() => handleSelectBiller(b)}
                                                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                                    isSelected
                                                        ? 'border-amber-500 bg-amber-50/60 shadow-xs ring-1 ring-amber-500'
                                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 font-black text-xs ${
                                                        isSelected ? 'bg-amber-500 shadow-xs' : 'bg-slate-700'
                                                    }`}>
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black text-black truncate leading-snug">
                                                            {b.billerName}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mt-0.5">
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="w-3 h-3 text-slate-400" />
                                                                {b.state}
                                                            </span>
                                                            <span>•</span>
                                                            <span className="text-emerald-700 font-mono">Fetch Supported</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="shrink-0">
                                                    {isSelected ? (
                                                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                                            <Check className="w-3 h-3" strokeWidth={3} />
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 group-hover:text-black">Select</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="py-8 text-center text-xs font-bold text-slate-500">
                                        No electricity boards found matching your search.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Customer Parameters Form Card */}
                        {selectedBiller && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
                            >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div>
                                        <h2 className="text-sm font-black text-black">2. Enter Consumer Details</h2>
                                        <p className="text-xs text-slate-500 font-bold">
                                            As specified by {selectedBiller.billerName}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                        {selectedBiller.billerId}
                                    </span>
                                </div>

                                <form onSubmit={handleFetchBill} className="space-y-3.5">
                                    {/* Registered Mobile Number */}
                                    <div>
                                        <label className="block text-xs font-black text-black mb-1">
                                            Customer Mobile Number <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                                                +91
                                            </span>
                                            <input
                                                type="tel"
                                                maxLength={10}
                                                value={customerMobile}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    setCustomerMobile(val);
                                                    if (paramErrors.customerMobile) {
                                                        setParamErrors(prev => {
                                                            const next = { ...prev };
                                                            delete next.customerMobile;
                                                            return next;
                                                        });
                                                    }
                                                }}
                                                placeholder="10-digit mobile number for bill alerts"
                                                className={`w-full pl-12 pr-4 py-2.5 text-xs md:text-sm font-bold rounded-xl border bg-slate-50 focus:bg-white focus:outline-none transition-all ${
                                                    paramErrors.customerMobile
                                                        ? 'border-rose-300 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500'
                                                        : 'border-slate-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                                                } text-black placeholder-slate-400 shadow-2xs`}
                                            />
                                        </div>
                                        {paramErrors.customerMobile && (
                                            <p className="text-[11px] font-bold text-rose-600 mt-1">
                                                {paramErrors.customerMobile}
                                            </p>
                                        )}
                                    </div>

                                    {/* Dynamic Input Parameters */}
                                    {selectedBiller.inputParams && selectedBiller.inputParams.map((param) => {
                                        const hasError = !!paramErrors[param.paramName];
                                        return (
                                            <div key={param.paramName}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-black text-black">
                                                        {param.paramName} {!param.optional && <span className="text-rose-500">*</span>}
                                                    </label>
                                                    {param.hint && (
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            {param.hint}
                                                        </span>
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={customerParams[param.paramName] || ''}
                                                    maxLength={param.maxLength > 0 ? param.maxLength : 30}
                                                    onChange={(e) => handleParamChange(param.paramName, e.target.value)}
                                                    placeholder={param.hint || `Enter ${param.paramName}`}
                                                    className={`w-full px-3.5 py-2.5 text-xs md:text-sm font-bold rounded-xl border bg-slate-50 focus:bg-white focus:outline-none transition-all ${
                                                        hasError
                                                            ? 'border-rose-300 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500'
                                                            : 'border-slate-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                                                    } text-black placeholder-slate-400 shadow-2xs font-mono`}
                                                />
                                                {hasError && (
                                                    <p className="text-[11px] font-bold text-rose-600 mt-1">
                                                        {paramErrors[param.paramName]}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Fetch Bill Action Button */}
                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={isFetchingBill}
                                            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
                                        >
                                            {isFetchingBill ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    <span>Fetching Verified Bill Details...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Fetch Bill Details</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Fetch Error Callout */}
                                    {fetchError && (
                                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5">
                                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-black">Bill Fetch Failed</div>
                                                <div className="text-[11px] mt-0.5 text-rose-700">{fetchError}</div>
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </motion.div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Verified Bill Summary / Guidance Card (5 Cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        {fetchedBill ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-md space-y-5"
                            >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
                                            Verified Bill Details
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">
                                        Live from CU
                                    </span>
                                </div>

                                {/* Bill Meta Information */}
                                <div className="space-y-2.5 text-xs font-bold text-slate-700 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90">
                                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                                        <span className="text-slate-500">Consumer Name</span>
                                        <span className="font-black text-black">{fetchedBill.customerName || 'Electricity Consumer'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                                        <span className="text-slate-500">Consumer Number</span>
                                        <span className="font-mono font-black text-black">{fetchedBill.consumerNumber || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                                        <span className="text-slate-500">Electricity Board</span>
                                        <span className="font-black text-black">{selectedBiller.billerName}</span>
                                    </div>
                                    {fetchedBill.billNumber && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                                            <span className="text-slate-500">Bill Number</span>
                                            <span className="font-mono font-black text-black">{fetchedBill.billNumber}</span>
                                        </div>
                                    )}
                                    {fetchedBill.dueDate && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                                            <span className="text-slate-500">Due Date</span>
                                            <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                                {fetchedBill.dueDate}
                                            </span>
                                        </div>
                                    )}
                                    {fetchedBill.billDate && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                                            <span className="text-slate-500">Bill Date</span>
                                            <span className="font-black text-slate-800">{fetchedBill.billDate}</span>
                                        </div>
                                    )}

                                    {/* Additional info tags if returned by provider */}
                                    {fetchedBill.additionalInfo && fetchedBill.additionalInfo.length > 0 && (
                                        <div className="pt-1 space-y-1">
                                            {fetchedBill.additionalInfo.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-[11px] text-slate-500">
                                                    <span>{item.infoName}</span>
                                                    <span className="text-slate-700 font-mono">{item.infoValue}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Payable Breakdown */}
                                    <div className="pt-2 border-t border-slate-200">
                                        <div className="flex justify-between py-0.5 text-xs">
                                            <span className="text-slate-500">Bill Amount</span>
                                            <span className="font-black text-black">₹{billAmount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between py-0.5 text-xs">
                                            <span className="text-slate-500">BBPS Convenience Fee</span>
                                            <span className="font-black text-emerald-700">₹0.00 (FREE)</span>
                                        </div>
                                        <div className="flex justify-between pt-2 items-baseline text-sm">
                                            <span className="font-black text-black">Total Payable</span>
                                            <span className="font-black text-amber-600 text-xl">₹{totalPayable.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Wallet Balance Alert */}
                                {!hasSufficientBalance ? (
                                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold space-y-1">
                                        <div className="flex items-center gap-1.5 font-black">
                                            <AlertCircle className="w-4 h-4 text-rose-600" />
                                            <span>Insufficient Wallet Balance</span>
                                        </div>
                                        <p className="text-[11px] text-rose-700">
                                            Your wallet has ₹{numBalance.toFixed(2)}, but this bill requires ₹{totalPayable.toFixed(2)}. Please top up your retailer wallet to pay.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Wallet className="w-4 h-4 text-emerald-600" />
                                            <span>Sufficient Wallet Balance</span>
                                        </div>
                                        <span className="font-mono text-emerald-700">₹{numBalance.toFixed(2)}</span>
                                    </div>
                                )}

                                {/* Proceed to Confirm Button */}
                                <button
                                    type="button"
                                    onClick={handleProceedToConfirm}
                                    disabled={!hasSufficientBalance}
                                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span>Proceed to Confirm Payment</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        ) : (
                            /* Informational Guidance Card */
                            <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                                        <Info className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-black">How to find your Consumer ID</h3>
                                        <p className="text-xs text-slate-500 font-bold">Check your physical electricity bill</p>
                                    </div>
                                </div>

                                <div className="space-y-3 text-xs text-slate-600 font-bold">
                                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                                        <span className="font-black text-black block">MSEDCL / Mahavitaran (Maharashtra)</span>
                                        <span className="text-[11px] text-slate-500">Requires 12-digit Consumer Number and 4-digit Billing Unit (BU) printed on top left.</span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                                        <span className="font-black text-black block">BSES Rajdhani & Yamuna (Delhi)</span>
                                        <span className="text-[11px] text-slate-500">Requires 9-digit CA Number located at the top right of the bill.</span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                                        <span className="font-black text-black block">UPPCL (Uttar Pradesh)</span>
                                        <span className="text-[11px] text-slate-500">Requires 10-digit Account Number for Rural / Urban connections.</span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                                        <span className="font-black text-black block">BESCOM (Karnataka)</span>
                                        <span className="text-[11px] text-slate-500">Requires 10-digit Consumer ID / Account ID.</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                    <span className="flex items-center gap-1 text-emerald-700">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        Official NPCI Bharat Connect Certified
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* STEP 2: CONFIRMATION MODAL / SCREEN */}
            {flowStep === 'CONFIRM' && fetchedBill && (
                <div className="max-w-xl mx-auto rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xl space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-black">Confirm Electricity Payment</h2>
                                <p className="text-xs text-slate-500 font-bold">Please verify the details before payment</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFlowStep('FORM')}
                            className="text-xs font-bold text-slate-600 hover:text-black"
                        >
                            Edit
                        </button>
                    </div>

                    <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 text-xs font-bold">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Electricity Board</span>
                            <span className="font-black text-black">{selectedBiller.billerName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Consumer Name</span>
                            <span className="font-black text-black">{fetchedBill.customerName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Consumer Number</span>
                            <span className="font-mono font-black text-black">{fetchedBill.consumerNumber}</span>
                        </div>
                        {fetchedBill.billNumber && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">Bill Number</span>
                                <span className="font-mono font-black text-black">{fetchedBill.billNumber}</span>
                            </div>
                        )}
                        {fetchedBill.dueDate && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">Due Date</span>
                                <span className="font-black text-amber-700">{fetchedBill.dueDate}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Customer Mobile</span>
                            <span className="font-mono font-black text-black">+91 {customerMobile}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Payment Instrument</span>
                            <span className="font-black text-black flex items-center gap-1">
                                <Wallet className="w-3.5 h-3.5 text-blue-600" />
                                Rupiksha Retailer Wallet
                            </span>
                        </div>
                        <div className="flex justify-between py-2 items-baseline text-sm">
                            <span className="font-black text-black">Total Amount Payable</span>
                            <span className="font-black text-amber-600 text-xl">₹{totalPayable.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setFlowStep('FORM')}
                            disabled={isSubmitting}
                            className="flex-1 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs transition-colors cursor-pointer"
                        >
                            Back & Edit
                        </button>
                        <button
                            type="button"
                            onClick={handleExecutePayment}
                            disabled={isSubmitting}
                            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.99] disabled:opacity-60"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Processing Payment...</span>
                                </>
                            ) : (
                                <>
                                    <span>Confirm & Pay ₹{totalPayable.toFixed(2)}</span>
                                    <Check className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3: TRANSACTION RESULT / RECEIPT SCREEN */}
            {flowStep === 'RESULT' && txnOutcome && (
                <div className="max-w-xl mx-auto rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xl text-center space-y-5">
                    {txnOutcome.status === 'SUCCESS' ? (
                        <>
                            <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
                                <CheckCircle2 className="w-9 h-9" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-black">Electricity Bill Paid!</h2>
                                <p className="text-xs font-bold text-slate-600">
                                    Your electricity bill payment has been verified & completed via Bharat Connect
                                </p>
                            </div>
                        </>
                    ) : txnOutcome.status === 'PENDING' ? (
                        <>
                            <div className="w-16 h-16 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center mx-auto text-amber-600 shadow-xs">
                                <Clock className="w-9 h-9" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-black">Payment In Progress</h2>
                                <p className="text-xs font-bold text-slate-600">
                                    The electricity board is reconciling the transaction. You can check the final status in BBPS History.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-rose-50 border-4 border-rose-100 flex items-center justify-center mx-auto text-rose-600 shadow-xs">
                                <AlertCircle className="w-9 h-9" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-black">Payment Failed</h2>
                                <p className="text-xs font-bold text-slate-600">
                                    {txnOutcome.message || 'The bill payment could not be processed.'}
                                </p>
                            </div>
                        </>
                    )}

                    {/* Printable Receipt Box */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs font-bold space-y-2">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Transaction ID</span>
                            <span className="font-mono font-black text-black">{txnOutcome.merchantRefNo || txnOutcome.transactionId || 'N/A'}</span>
                        </div>
                        {txnOutcome.providerTxnId && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">BBPS Provider Ref</span>
                                <span className="font-mono font-black text-black">{txnOutcome.providerTxnId}</span>
                            </div>
                        )}
                        {txnOutcome.approvalRefNo && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">Approval Number</span>
                                <span className="font-mono font-black text-black">{txnOutcome.approvalRefNo}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Electricity Board</span>
                            <span className="font-black text-black">{txnOutcome.billerName || selectedBiller?.billerName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Consumer Number</span>
                            <span className="font-mono font-black text-black">{txnOutcome.consumerNumber || 'N/A'}</span>
                        </div>
                        {txnOutcome.customerName && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">Customer Name</span>
                                <span className="font-black text-black">{txnOutcome.customerName}</span>
                            </div>
                        )}
                        {txnOutcome.billNumber && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">Bill Number</span>
                                <span className="font-mono font-black text-black">{txnOutcome.billNumber}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-1 items-baseline">
                            <span className="text-slate-500">Amount Paid</span>
                            <span className="font-black text-amber-600 text-base">₹{Number(txnOutcome.amount || txnOutcome.totalAmount || 0).toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Receipt Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex-1 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print Receipt</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleResetAll}
                            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-all cursor-pointer shadow-sm"
                        >
                            + Pay Another Bill
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ElectricityFlow;
