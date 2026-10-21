import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, CheckCircle2, AlertCircle, Clock,
    Search, Check, ShieldCheck, RefreshCw, Printer,
    Wallet, ArrowRight, Info, X, Building2, User,
    FileText, Calendar, DollarSign, MapPin, ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { bbpsService } from '../../../services/apiService';
import { useWallet } from '../../../context/WalletContext';
import BbpsServiceNav from './BbpsServiceNav';
import BbpsReceiptCard from './BbpsReceiptCard';

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

    // Meter Mode: 'POSTPAID' | 'PREPAID'
    const [meterMode, setMeterMode] = useState('POSTPAID');
    const [prepaidRechargeAmount, setPrepaidRechargeAmount] = useState('');

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
                    const effectiveMinLength = isPrepaid ? Math.min(param.minLength, 9) : param.minLength;
                    const effectiveMaxLength = isPrepaid ? Math.max(param.maxLength, 20) : param.maxLength;

                    if (effectiveMinLength > 0 && val.length < effectiveMinLength) {
                        errors[param.paramName] = `Must be at least ${effectiveMinLength} characters`;
                    }
                    if (effectiveMaxLength > 0 && val.length > effectiveMaxLength) {
                        errors[param.paramName] = `Cannot exceed ${effectiveMaxLength} characters`;
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
    const isPrepaid = meterMode === 'PREPAID';
    const parsedPrepaidAmt = parseFloat(prepaidRechargeAmount) || 0;
    const billAmount = isPrepaid ? parsedPrepaidAmt : (fetchedBill?.billAmount ? parseFloat(fetchedBill.billAmount) : 0);
    const isNoBillDue = !isPrepaid && Boolean(fetchedBill?.noBillDue || (fetchedBill && billAmount === 0));

    // CCF1 fee calculation per BillAvenue doc (pages 71-75):
    // CCF1 = (Payment Amount * percentFee / 100) + flatFee
    // GST = CCF1 * 18 / 100
    // Total CCF1 = Floor(CCF1 + GST)
    const ccf1Fee = useMemo(() => {
        if (!isPrepaid || billAmount <= 0) return 0;
        const percent = selectedBiller?.ccf1Percent || 0;
        const flatFeePaise = selectedBiller?.ccf1FlatFeePaise || 0;
        if (percent === 0 && flatFeePaise === 0) return 0;
        const amtPaise = billAmount * 100;
        const rawCcf1 = (amtPaise * percent / 100) + flatFeePaise;
        const gst = rawCcf1 * 0.18;
        const totalPaise = Math.floor(rawCcf1 + gst);
        return totalPaise / 100;
    }, [isPrepaid, billAmount, selectedBiller]);

    const convenienceFee = isPrepaid ? ccf1Fee : 0; // standard BBPS CCF or Prepaid CCF1
    const totalPayable = billAmount + convenienceFee;
    const hasSufficientBalance = isNoBillDue ? true : (numBalance >= totalPayable && totalPayable > 0);

    const handleProceedToConfirm = () => {
        setFormError('');
        if (isPrepaid) {
            if (!validateInputs()) return;
            if (billAmount < 10) {
                setFormError('Please enter a valid prepaid recharge amount of at least ₹10.');
                return;
            }
            if (billAmount > 50000) {
                setFormError('Prepaid recharge amount cannot exceed ₹50,000.');
                return;
            }
        } else {
            if (!fetchedBill) {
                setFormError('Please fetch and verify your bill before proceeding to payment.');
                return;
            }
            if (isNoBillDue || totalPayable <= 0) {
                setFormError('No payment required: all dues are already cleared for this billing period.');
                return;
            }
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
            ccf1Fee: ccf1Fee,
            meterType: isPrepaid ? 'PREPAID' : 'POSTPAID',
            fetchRequestId: fetchedBill?.fetchRequestId,
            billNumber: fetchedBill?.billNumber,
            billDate: fetchedBill?.billDate,
            dueDate: fetchedBill?.dueDate,
            billPeriod: fetchedBill?.billPeriod,
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
                merchantRefNo: idempotencyKey,
                amount: billAmount,
                totalAmount: totalPayable,
                customerMobile: customerMobile,
                consumerNumber: fetchedBill?.consumerNumber || Object.values(customerParams)[0] || 'N/A',
                customerName: fetchedBill?.customerName || (isPrepaid ? 'Prepaid Meter Consumer' : 'Electricity Consumer'),
                billerName: selectedBiller.billerName,
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

    const handleResetAll = () => {
        setSelectedBiller(null);
        setCustomerParams({});
        setCustomerMobile('');
        setFetchedBill(null);
        setPrepaidRechargeAmount('');
        setFetchError('');
        setFormError('');
        setParamErrors({});
        setTxnOutcome(null);
        setFlowStep('FORM');
    };

    return (
        <div className="space-y-5 font-['Inter',sans-serif] max-w-full">
            {/* Top Navigation & Service Bar */}
            <BbpsServiceNav
                onBack={onBack}
                title="Electricity Bill Payment"
                icon={Zap}
                gradient="from-amber-400 to-amber-600"
                badgeText="Bharat Connect"
                badgeColor="amber"
            />

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
                            <div className="max-h-72 md:max-h-[380px] lg:max-h-[440px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
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

                    </div>

                    {/* RIGHT COLUMN: Step 2 Consumer Details OR Verified Bill Details (5 Cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        {fetchedBill ? (
                            /* Verified Bill Details */
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-md space-y-5"
                            >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
                                            Verified Bill Details
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFetchedBill(null)}
                                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-black transition-colors cursor-pointer"
                                            title="Click to edit mobile or consumer number"
                                        >
                                            Edit Details
                                        </button>
                                        <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">
                                            Live from CU
                                        </span>
                                    </div>
                                </div>

                                {/* Zero Due / All Cleared Banner */}
                                {isNoBillDue && (
                                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold space-y-1">
                                        <div className="flex items-center gap-2 font-black text-emerald-800 text-sm">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                            <span>No Bill Due • All Dues Cleared</span>
                                        </div>
                                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                                            {fetchedBill.message || 'Payment received for the billing period - no bill due. There are no outstanding charges on this consumer account.'}
                                        </p>
                                    </div>
                                )}

                                {/* Bill Meta Information */}
                                <div className="space-y-2.5 text-xs font-bold text-slate-700 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90">
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 gap-2">
                                        <span className="text-slate-500 shrink-0">Consumer Name</span>
                                        <span className="font-black text-black text-right truncate max-w-[65%]">{fetchedBill.customerName || 'Electricity Consumer'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 gap-2">
                                        <span className="text-slate-500 shrink-0">Consumer Number</span>
                                        <span className="font-mono font-black text-black text-right truncate max-w-[65%]">{fetchedBill.consumerNumber || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 gap-2">
                                        <span className="text-slate-500 shrink-0">Electricity Board</span>
                                        <span className="font-black text-black text-right truncate max-w-[65%]">{selectedBiller.billerName}</span>
                                    </div>
                                    {fetchedBill.billNumber && (
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 gap-2">
                                            <span className="text-slate-500 shrink-0">Bill Number</span>
                                            <span className="font-mono font-black text-black text-right truncate max-w-[65%]">{fetchedBill.billNumber}</span>
                                        </div>
                                    )}
                                    {fetchedBill.dueDate && (
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 gap-2">
                                            <span className="text-slate-500 shrink-0">Due Date</span>
                                            <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                                {fetchedBill.dueDate}
                                            </span>
                                        </div>
                                    )}
                                    {fetchedBill.billDate && (
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 gap-2">
                                            <span className="text-slate-500 shrink-0">Bill Date</span>
                                            <span className="font-black text-slate-800">{fetchedBill.billDate}</span>
                                        </div>
                                    )}

                                    {/* Additional info tags if returned by provider */}
                                    {fetchedBill.additionalInfo && fetchedBill.additionalInfo.length > 0 && (
                                        <div className="pt-1 space-y-1">
                                            {fetchedBill.additionalInfo.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px] text-slate-500 gap-2">
                                                    <span className="shrink-0">{item.infoName}</span>
                                                    <span className="text-slate-700 font-mono text-right truncate max-w-[65%]">{item.infoValue}</span>
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

                                {/* Wallet Balance Alert / Status */}
                                {isNoBillDue ? (
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            <span>Account in good standing • No bill payment required</span>
                                        </div>
                                    </div>
                                ) : !hasSufficientBalance ? (
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

                                {/* Proceed to Confirm Button / Zero Due State */}
                                {isNoBillDue ? (
                                    <div className="w-full py-3.5 px-4 rounded-2xl bg-emerald-100/70 border border-emerald-300 text-emerald-800 font-black text-xs md:text-sm text-center flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                        <span>No Bill Due • All Dues Cleared (₹0.00)</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleProceedToConfirm}
                                        disabled={!hasSufficientBalance}
                                        className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span>Proceed to Confirm Payment</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </motion.div>
                        ) : selectedBiller ? (
                            /* Step 2: Enter Consumer Details (moved to right side) */
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs space-y-4"
                            >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-black text-black">2. Enter Consumer Details</h2>
                                        <p className="text-xs text-slate-500 font-bold truncate max-w-[240px] sm:max-w-xs" title={selectedBiller.billerName}>
                                            As specified by {selectedBiller.billerName}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                        {selectedBiller.billerId}
                                    </span>
                                </div>

                                {/* Meter Mode Switcher (Postpaid Bill vs Prepaid Smart Meter) */}
                                {selectedBiller.prepaidMeterSupported && (
                                    <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMeterMode('POSTPAID');
                                                setFetchedBill(null);
                                                setFetchError('');
                                                setFormError('');
                                            }}
                                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                                meterMode === 'POSTPAID'
                                                    ? 'bg-white text-black shadow-xs'
                                                    : 'text-slate-600 hover:text-black'
                                            }`}
                                        >
                                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Postpaid Bill</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMeterMode('PREPAID');
                                                setFetchedBill(null);
                                                setFetchError('');
                                                setFormError('');
                                            }}
                                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                                meterMode === 'PREPAID'
                                                    ? 'bg-amber-500 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-black'
                                            }`}
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            <span>Smart Prepaid Meter</span>
                                        </button>
                                    </div>
                                )}

                                <form onSubmit={isPrepaid ? (e) => { e.preventDefault(); handleProceedToConfirm(); } : handleFetchBill} className="space-y-3.5">
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
                                        const effectiveMaxLength = isPrepaid ? Math.max(param.maxLength, 25) : (param.maxLength > 0 ? param.maxLength : 30);
                                        const effectiveHint = isPrepaid ? 'CA Number or Smart Meter Number (e.g. 9 to 16+ digits)' : (param.hint || `Enter ${param.paramName}`);
                                        return (
                                            <div key={param.paramName}>
                                                <div className="flex items-center justify-between mb-1 gap-2">
                                                    <label className="text-xs font-black text-black truncate">
                                                        {isPrepaid ? 'CA Number / Smart Meter Number' : param.paramName} {!param.optional && <span className="text-rose-500">*</span>}
                                                    </label>
                                                    <span className="text-[10px] font-bold text-slate-400 truncate max-w-[180px]">
                                                        {effectiveHint}
                                                    </span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={customerParams[param.paramName] || ''}
                                                    maxLength={effectiveMaxLength}
                                                    onChange={(e) => handleParamChange(param.paramName, e.target.value)}
                                                    placeholder={effectiveHint}
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

                                    {/* Prepaid Meter Custom Amount Entry & Quick Pills */}
                                    {isPrepaid && (
                                        <div className="space-y-2 pt-1 border-t border-slate-100">
                                            <label className="block text-xs font-black text-black">
                                                Recharge Amount (₹) <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">
                                                    ₹
                                                </span>
                                                <input
                                                    type="number"
                                                    min="10"
                                                    max="50000"
                                                    step="1"
                                                    value={prepaidRechargeAmount}
                                                    onChange={(e) => setPrepaidRechargeAmount(e.target.value)}
                                                    placeholder="Enter recharge amount (e.g. 500)"
                                                    className="w-full pl-8 pr-4 py-2.5 text-sm font-black rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-black placeholder-slate-400 shadow-2xs font-mono"
                                                />
                                            </div>

                                            {/* Quick amount presets */}
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                {['100', '200', '500', '1000', '2000'].map(amt => (
                                                    <button
                                                        key={amt}
                                                        type="button"
                                                        onClick={() => setPrepaidRechargeAmount(amt)}
                                                        className={`px-2.5 py-1 text-[11px] font-black rounded-lg border transition-all cursor-pointer ${
                                                            prepaidRechargeAmount === amt
                                                                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        +₹{amt}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* CCF1 & Total Payable Notice for Prepaid Meter */}
                                            {billAmount > 0 && (
                                                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs font-bold space-y-1 mt-2">
                                                    <div className="flex justify-between items-center text-slate-600">
                                                        <span>Recharge Amount:</span>
                                                        <span className="font-black text-black">₹{billAmount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-slate-600">
                                                        <span>CCF1 Fee (incl. 18% GST):</span>
                                                        <span className="font-black text-amber-800">₹{ccf1Fee.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-1 border-t border-amber-200/60 font-black text-black text-sm">
                                                        <span>Total Payable:</span>
                                                        <span className="text-amber-700">₹{totalPayable.toFixed(2)}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 pt-0.5">
                                                        * Standard BBPS CCF1 tag applied per NBBL Prepaid Meter guidelines.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <div className="pt-2">
                                        {isPrepaid ? (
                                            <button
                                                type="submit"
                                                disabled={billAmount <= 0 || !hasSufficientBalance}
                                                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
                                            >
                                                <span>Proceed to Recharge ₹{totalPayable > 0 ? totalPayable.toFixed(2) : ''}</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        ) : (
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
                                        )}
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
                        ) : (
                            /* Guidance / Empty State when no biller is selected yet (replaces old static card) */
                            <div className="hidden lg:flex rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center flex-col items-center justify-center min-h-[380px] shadow-xs">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center mb-3">
                                    <Zap className="w-7 h-7" />
                                </div>
                                <h3 className="text-sm font-black text-black">Select Electricity Board</h3>
                                <p className="text-xs text-slate-500 font-bold max-w-xs mt-1 leading-relaxed">
                                    Choose your state and electricity board (DISCOM) from the list on the left to enter consumer details and fetch your bill.
                                </p>
                                <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Official NPCI Bharat Connect Certified</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* STEP 2: CONFIRMATION MODAL / SCREEN */}
            {flowStep === 'CONFIRM' && (fetchedBill || isPrepaid) && (
                <div className="max-w-xl mx-auto rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xl space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-black">
                                    {isPrepaid ? 'Confirm Smart Prepaid Meter Recharge' : 'Confirm Electricity Payment'}
                                </h2>
                                <p className="text-xs text-slate-500 font-bold">Please verify the details before payment</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFlowStep('FORM')}
                            className="text-xs font-bold text-slate-600 hover:text-black cursor-pointer"
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
                            <span className="text-slate-500">Service Type</span>
                            <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                {isPrepaid ? 'Smart Prepaid Meter Recharge' : 'Postpaid Electricity Bill'}
                            </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Consumer Number / CA</span>
                            <span className="font-mono font-black text-black">{fetchedBill?.consumerNumber || Object.values(customerParams)[0] || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Consumer Name</span>
                            <span className="font-black text-black">{fetchedBill?.customerName || (isPrepaid ? 'Prepaid Meter Consumer' : 'Electricity Consumer')}</span>
                        </div>
                        {fetchedBill?.billNumber && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">Bill Number</span>
                                <span className="font-mono font-black text-black">{fetchedBill.billNumber}</span>
                            </div>
                        )}
                        {fetchedBill?.dueDate && (
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
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">{isPrepaid ? 'Recharge Amount' : 'Bill Amount'}</span>
                            <span className="font-black text-black">₹{billAmount.toFixed(2)}</span>
                        </div>
                        {isPrepaid && ccf1Fee > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">BBPS CCF1 Fee (incl. GST)</span>
                                <span className="font-black text-amber-800">₹{ccf1Fee.toFixed(2)}</span>
                            </div>
                        )}
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
                <BbpsReceiptCard
                    txnOutcome={txnOutcome}
                    category="electricity"
                    isPrepaid={isPrepaid}
                    billerName={selectedBiller?.billerName}
                    consumerNumber={fetchedBill?.consumerNumber || Object.values(customerParams)[0] || ''}
                    customerName={fetchedBill?.customerName || ''}
                    onReset={handleResetAll}
                    resetButtonText="+ Pay Another Bill"
                />
            )}
        </div>
    );
};

export default ElectricityFlow;
