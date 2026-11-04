import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CarFront, CheckCircle2, AlertCircle, Clock,
    Search, Check, ShieldCheck, RefreshCw, Printer,
    Wallet, ArrowRight, Info, X, Building2, User,
    FileText, Calendar, DollarSign, ExternalLink, Lock,
    ChevronDown, ChevronRight, Eye, Sparkles,
    Shield, History, Tag, Fuel
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { bbpsService } from '../../../services/apiService';
import { useWallet } from '../../../context/WalletContext';
import BbpsServiceNav from './BbpsServiceNav';
import BbpsReceiptCard from './BbpsReceiptCard';
import { primeBharatConnectSound, playBharatConnectSuccessSound } from '../../../utils/bbpsSound';

// Popular FASTag issuing banks quick chips
const POPULAR_ISSUERS = [
    { label: 'All', query: '' },
    { label: 'ICICI Bank', query: 'ICICI' },
    { label: 'State Bank of India', query: 'SBI' },
    { label: 'HDFC Bank', query: 'HDFC' },
    { label: 'Axis Bank', query: 'Axis' },
    { label: 'Kotak Mahindra', query: 'Kotak' },
    { label: 'IDFC FIRST Bank', query: 'IDFC' },
    { label: 'Bank of Baroda', query: 'Baroda' },
    { label: 'Paytm Payments Bank', query: 'Paytm' },
    { label: 'Airtel Payments Bank', query: 'Airtel' },
    { label: 'IndusInd Bank', query: 'IndusInd' },
    { label: 'Federal Bank', query: 'Federal' },
    { label: 'Canara Bank', query: 'Canara' },
    { label: 'Punjab National Bank', query: 'Punjab' },
    { label: 'Union Bank of India', query: 'Union' }
];

// Quick recharge amount presets
const PRESET_AMOUNTS = [200, 500, 1000, 1500, 2000, 3000, 5000];

// Real-time VRN sanitization
const cleanVehicleNumber = (val) => {
    if (!val) return '';
    return val.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const validateVrn = (vrn) => {
    if (!vrn) return 'Vehicle Registration Number is required';
    const clean = cleanVehicleNumber(vrn);
    if (clean.length < 6 || clean.length > 13) {
        return 'Registration number must be 6-13 alphanumeric characters';
    }
    const standardRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,4}[0-9]{4}$/;
    const bhRegex = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
    if (!standardRegex.test(clean) && !bhRegex.test(clean)) {
        return 'Enter valid vehicle number (e.g. MH12AB1234, DL01C1234 or 22BH1234AA)';
    }
    return null;
};

const FastagFlow = ({ onBack, category }) => {
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
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    const [customerParams, setCustomerParams] = useState({});
    const [paramErrors, setParamErrors] = useState({});

    // Bill fetch & dues
    const [isFetchingBill, setIsFetchingBill] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [fetchedBill, setFetchedBill] = useState(null);
    const [rechargeAmount, setRechargeAmount] = useState('500');

    // Payment submission & outcome
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [txnOutcome, setTxnOutcome] = useState(null);

    // Close combobox on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
                setIsComboboxOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Prime audio context on user interaction
    useEffect(() => {
        const handleInteraction = () => primeBharatConnectSound();
        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('keydown', handleInteraction, { once: true });
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    // Load FASTag billers on mount
    useEffect(() => {
        let isMounted = true;
        const fetchBillers = async () => {
            setLoadingBillers(true);
            try {
                const res = await bbpsService.getFastagBillers();
                if (isMounted && Array.isArray(res)) {
                    setBillers(res);
                    // Default select ICICI Bank if available
                    const defaultBiller = res.find(b => b.billerId === 'ICIC00000NAT01') || res[0];
                    if (defaultBiller) {
                        setSelectedBiller(defaultBiller);
                    }
                }
            } catch (err) {
                console.error('Failed to load FASTag billers:', err);
            } finally {
                if (isMounted) setLoadingBillers(false);
            }
        };
        fetchBillers();
        return () => { isMounted = false; };
    }, []);

    // Filter billers based on search query or quick chip
    const filteredBillers = useMemo(() => {
        if (!billers) return [];
        let list = billers;
        if (selectedQuickChip && selectedQuickChip !== 'All') {
            const chip = POPULAR_ISSUERS.find(c => c.label === selectedQuickChip);
            if (chip && chip.query) {
                const q = chip.query.toLowerCase();
                list = list.filter(b =>
                    (b.billerName || '').toLowerCase().includes(q) ||
                    (b.bankName || '').toLowerCase().includes(q) ||
                    (b.billerId || '').toLowerCase().includes(q)
                );
            }
        }
        if (billerSearch.trim()) {
            const search = billerSearch.toLowerCase().trim();
            list = list.filter(b =>
                (b.billerName || '').toLowerCase().includes(search) ||
                (b.bankName || '').toLowerCase().includes(search) ||
                (b.billerId || '').toLowerCase().includes(search)
            );
        }
        return list;
    }, [billers, billerSearch, selectedQuickChip]);

    // Handle biller selection
    const handleSelectBiller = (biller) => {
        setSelectedBiller(biller);
        setIsComboboxOpen(false);
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setParamErrors({});
    };

    // Real-time vehicle registration formatting
    const handleVehicleChange = (e) => {
        const clean = cleanVehicleNumber(e.target.value);
        setVehicleNumber(clean);
        setCustomerParams(prev => ({
            ...prev,
            'Vehicle Registration Number': clean,
            'Vehicle Number': clean
        }));
        if (paramErrors.vehicleNumber) {
            setParamErrors(prev => ({ ...prev, vehicleNumber: null }));
        }
    };

    // Mobile number change
    const handleMobileChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
        setCustomerMobile(val);
        if (paramErrors.customerMobile) {
            setParamErrors(prev => ({ ...prev, customerMobile: null }));
        }
    };

    // Form validation before fetch
    const validateForm = () => {
        const errors = {};
        if (!selectedBiller) {
            errors.biller = 'Please select a FASTag issuing bank';
        }

        const vrnErr = validateVrn(vehicleNumber);
        if (vrnErr) {
            errors.vehicleNumber = vrnErr;
        }

        if (!customerMobile || !/^[6-9]\d{9}$/.test(customerMobile)) {
            errors.customerMobile = 'Enter a valid 10-digit customer mobile number';
        }

        setParamErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Fetch FASTag Bill / Balance
    const handleFetchBill = async () => {
        if (!validateForm()) return;

        setIsFetchingBill(true);
        setFetchError('');
        setFetchedBill(null);

        const cleanVrn = cleanVehicleNumber(vehicleNumber);
        const payload = {
            billerId: selectedBiller.billerId,
            customerMobile: customerMobile.trim(),
            customerParams: {
                ...customerParams,
                'Vehicle Registration Number': cleanVrn,
                'Vehicle Number': cleanVrn,
                'Mobile Number': customerMobile.trim()
            }
        };

        try {
            const res = await bbpsService.fetchFastagBill(payload);
            if (res && res.success) {
                setFetchedBill(res);
                const billAmt = res.billAmount ? parseFloat(res.billAmount) : 0;
                if (billAmt > 0) {
                    setRechargeAmount(String(billAmt));
                } else {
                    setRechargeAmount('500');
                }
            } else {
                setFetchError(res?.message || 'Unable to fetch FASTag details. Please verify the vehicle registration number.');
            }
        } catch (err) {
            console.error('FASTag fetch error:', err);
            setFetchError(err.message || 'Failed to fetch FASTag details from bank switch.');
        } finally {
            setIsFetchingBill(false);
        }
    };

    // Proceed to Confirmation Modal
    const handleProceedToConfirm = () => {
        if (!validateForm()) return;

        const amt = parseFloat(rechargeAmount);
        if (isNaN(amt) || amt < 100 || amt > 50000) {
            setFormError('Recharge amount must be between ₹100 and ₹50,000');
            return;
        }

        if (numBalance < amt) {
            setFormError(`Insufficient wallet balance (₹${numBalance.toFixed(2)}). Please top up your wallet.`);
            return;
        }

        setFormError('');
        setFlowStep('CONFIRM');
    };

    // Execute Payment
    const handleExecutePayment = async () => {
        if (isSubmitting) return;

        const amt = parseFloat(rechargeAmount);
        if (numBalance < amt) {
            setFormError(`Insufficient wallet balance. Available: ₹${numBalance.toFixed(2)}`);
            setFlowStep('FORM');
            return;
        }

        setIsSubmitting(true);
        setFormError('');

        const cleanVrn = cleanVehicleNumber(vehicleNumber);
        const idempotencyKey = `BBPS-FT-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

        const payload = {
            billerId: selectedBiller.billerId,
            vehicleNumber: cleanVrn,
            customerMobile: customerMobile.trim(),
            amount: amt,
            idempotencyKey,
            fetchRequestId: fetchedBill?.fetchRequestId || '',
            billNumber: fetchedBill?.billNumber || '',
            dueDate: fetchedBill?.dueDate || '',
            customerName: fetchedBill?.customerName || '',
            customerParams: {
                ...customerParams,
                'Vehicle Registration Number': cleanVrn,
                'Vehicle Number': cleanVrn,
                'Mobile Number': customerMobile.trim()
            }
        };

        try {
            const res = await bbpsService.payFastagBill(payload);
            setTxnOutcome(res);
            setFlowStep('RESULT');

            if (res && (res.status === 'SUCCESS' || res.success)) {
                playBharatConnectSuccessSound();
                confetti({
                    particleCount: 120,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
            // Immediate wallet balance refresh
            refreshWallet();
        } catch (err) {
            console.error('FASTag payment error:', err);
            setTxnOutcome({
                success: false,
                status: 'FAILED',
                amount: amt,
                billerName: selectedBiller.billerName,
                vehicleNumber: cleanVrn,
                message: err.message || 'Payment processing failed. Any debited amount has been refunded.'
            });
            setFlowStep('RESULT');
            refreshWallet();
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset flow for next recharge
    const handleReset = () => {
        setFlowStep('FORM');
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setTxnOutcome(null);
        setVehicleNumber('');
        setCustomerMobile('');
        setCustomerParams({});
        setRechargeAmount('500');
    };

    const finalAmount = parseFloat(rechargeAmount) || 0;
    const estimatedBalanceAfter = Math.max(0, numBalance - finalAmount);

    return (
        <div className="space-y-4 font-['Inter',sans-serif] max-w-full overflow-hidden">
            {/* Top Navigation & Service Bar */}
            <BbpsServiceNav
                onBack={onBack}
                title="FASTag Bill Payment"
                icon={CarFront}
                gradient="from-purple-600 to-indigo-700"
                badgeText="Bharat Connect"
            />

            {/* FLOW STEP: FORM VIEW */}
            {flowStep === 'FORM' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* LEFT COLUMN: Issuing Bank Selection & Customer Input */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* 1. Fastag Issuing Bank Selector */}
                        <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs">
                            <div className="flex items-center justify-between mb-3.5">
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-black">
                                        Select FASTag Issuer Bank
                                    </h3>
                                    <p className="text-xs text-slate-600 font-bold">
                                        Select your vehicle FASTag issuing bank or provider
                                    </p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                    32+ Issuers
                                </span>
                            </div>

                            {/* Popular Issuer Quick Chips */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
                                {POPULAR_ISSUERS.map(chip => (
                                    <button
                                        key={chip.label}
                                        type="button"
                                        onClick={() => {
                                            setSelectedQuickChip(chip.label);
                                            setBillerSearch('');
                                        }}
                                        className={`px-3 py-1 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                                            selectedQuickChip === chip.label
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black'
                                        }`}
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                            </div>

                            {/* Searchable Combobox */}
                            <div className="relative" ref={comboboxRef}>
                                <div
                                    onClick={() => setIsComboboxOpen(!isComboboxOpen)}
                                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer bg-slate-50/50 hover:bg-white ${
                                        isComboboxOpen
                                            ? 'border-purple-600 ring-2 ring-purple-100 bg-white shadow-xs'
                                            : selectedBiller
                                                ? 'border-slate-300'
                                                : 'border-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black shrink-0 text-sm">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div className="truncate text-left">
                                            <div className="text-sm font-black text-black truncate">
                                                {selectedBiller ? selectedBiller.billerName : 'Search or Select FASTag Bank'}
                                            </div>
                                            <div className="text-[11px] font-bold text-slate-500 font-mono">
                                                {selectedBiller ? `${selectedBiller.billerId} • NETC FASTag` : '32 NPCI Certified Banks'}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isComboboxOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {isComboboxOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-72 flex flex-col"
                                        >
                                            {/* Dropdown Search Bar */}
                                            <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 sticky top-0">
                                                <div className="relative">
                                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={billerSearch}
                                                        onChange={(e) => setBillerSearch(e.target.value)}
                                                        placeholder="Type bank name or biller ID..."
                                                        className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-purple-600"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            {/* Biller List */}
                                            <div className="overflow-y-auto divide-y divide-slate-100">
                                                {loadingBillers ? (
                                                    <div className="p-6 text-center text-xs font-bold text-slate-500">
                                                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-purple-600" />
                                                        Loading verified FASTag issuers...
                                                    </div>
                                                ) : filteredBillers.length === 0 ? (
                                                    <div className="p-6 text-center text-xs font-bold text-slate-500">
                                                        No FASTag biller found matching &quot;{billerSearch}&quot;
                                                    </div>
                                                ) : (
                                                    filteredBillers.map((biller) => {
                                                        const isSelected = selectedBiller?.billerId === biller.billerId;
                                                        return (
                                                            <div
                                                                key={biller.billerId}
                                                                onClick={() => handleSelectBiller(biller)}
                                                                className={`p-3 flex items-center justify-between hover:bg-purple-50/60 cursor-pointer transition-colors ${
                                                                    isSelected ? 'bg-purple-50/80' : ''
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                                                                        <CarFront className="w-4 h-4 text-purple-600" />
                                                                    </div>
                                                                    <div className="truncate">
                                                                        <div className="text-xs font-black text-black truncate">
                                                                            {biller.billerName}
                                                                        </div>
                                                                        <div className="text-[10px] font-mono text-slate-500">
                                                                            {biller.billerId}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <Check className="w-4 h-4 text-purple-600 shrink-0" />
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* 2. Vehicle & Customer Details Form */}
                        <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-black">
                                        Vehicle & Customer Details
                                    </h3>
                                    <p className="text-xs text-slate-600 font-bold">
                                        Enter vehicle number as registered on FASTag
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    NPCI Verified
                                </span>
                            </div>

                            {/* Vehicle Registration Number Input */}
                            <div>
                                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                                    Vehicle Registration Number (VRN) <span className="text-rose-600">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                        <span className="text-xs font-black px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 border border-slate-200">
                                            IND
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={vehicleNumber}
                                        onChange={handleVehicleChange}
                                        maxLength={13}
                                        placeholder="MH12AB1234 or DL01CA1234"
                                        className={`w-full pl-16 pr-4 py-3 rounded-2xl border font-mono font-black text-sm tracking-wider uppercase transition-all bg-slate-50/50 focus:bg-white focus:outline-hidden ${
                                            paramErrors.vehicleNumber
                                                ? 'border-rose-300 ring-2 ring-rose-100 text-rose-900'
                                                : 'border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-100'
                                        }`}
                                    />
                                </div>
                                {paramErrors.vehicleNumber && (
                                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {paramErrors.vehicleNumber}
                                    </p>
                                )}
                                <p className="text-[11px] font-bold text-slate-500 mt-1">
                                    Standard Indian vehicle plates (e.g. MH12AB1234) and Bharat Series (e.g. 22BH1234AA) supported.
                                </p>
                            </div>

                            {/* Customer Mobile Number */}
                            <div>
                                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                                    Customer Mobile Number <span className="text-rose-600">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">
                                        +91
                                    </span>
                                    <input
                                        type="tel"
                                        value={customerMobile}
                                        onChange={handleMobileChange}
                                        maxLength={10}
                                        placeholder="10-digit mobile number"
                                        className={`w-full pl-12 pr-4 py-3 rounded-2xl border font-mono font-black text-sm transition-all bg-slate-50/50 focus:bg-white focus:outline-hidden ${
                                            paramErrors.customerMobile
                                                ? 'border-rose-300 ring-2 ring-rose-100 text-rose-900'
                                                : 'border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-100'
                                        }`}
                                    />
                                </div>
                                {paramErrors.customerMobile && (
                                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {paramErrors.customerMobile}
                                    </p>
                                )}
                            </div>

                            {/* Fetch Bill Trigger Button */}
                            <button
                                type="button"
                                onClick={handleFetchBill}
                                disabled={isFetchingBill || !vehicleNumber || !customerMobile}
                                className="w-full py-3.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs"
                            >
                                {isFetchingBill ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Fetching FASTag Bill From Bank...</span>
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-4 h-4" />
                                        <span>Fetch FASTag Bill & Dues</span>
                                    </>
                                )}
                            </button>

                            {/* Fetch Error Display */}
                            {fetchError && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800"
                                >
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-black">FASTag Fetch Notice</div>
                                        <div className="font-bold text-[11px] text-rose-700 mt-0.5">
                                            {fetchError}
                                        </div>
                                        <div className="font-bold text-[11px] text-rose-700 mt-1">
                                            You can still proceed with adhoc recharge below if this issuer bank permits adhoc toll top-ups.
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Fetched Details & Payment Amount */}
                    <div className="lg:col-span-5 space-y-4">
                        {/* 1. Wallet Balance Quick Card */}
                        <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-black uppercase text-slate-500">Retailer Wallet</div>
                                        <div className="text-base font-black text-black">
                                            ₹{numBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={refreshWallet}
                                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                                    title="Refresh Balance"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* 2. Fetched Bill Details or Recharge Amount Card */}
                        <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h4 className="text-sm font-black text-black">
                                        Recharge Amount
                                    </h4>
                                    <p className="text-[11px] font-bold text-slate-500">
                                        {fetchedBill ? 'FASTag tag details fetched' : 'Enter recharge amount'}
                                    </p>
                                </div>
                                {fetchedBill && (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Bill Verified
                                    </span>
                                )}
                            </div>

                            {/* Fetched Tag Information if available */}
                            {fetchedBill && (
                                <div className="rounded-2xl bg-purple-50/50 border border-purple-100 p-3.5 space-y-2 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 font-bold">Customer Name:</span>
                                        <span className="font-black text-black uppercase">{fetchedBill.customerName || 'FASTag Customer'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 font-bold">Vehicle No:</span>
                                        <span className="font-mono font-black text-black">{fetchedBill.consumerNumber || vehicleNumber}</span>
                                    </div>
                                    {fetchedBill.billNumber && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 font-bold">Bill Reference:</span>
                                            <span className="font-mono font-black text-slate-700">{fetchedBill.billNumber}</span>
                                        </div>
                                    )}
                                    {fetchedBill.dueDate && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 font-bold">Due Date:</span>
                                            <span className="font-black text-slate-700">{fetchedBill.dueDate}</span>
                                        </div>
                                    )}
                                    {fetchedBill.additionalInfo && fetchedBill.additionalInfo.length > 0 && (
                                        <div className="pt-1.5 border-t border-purple-100/70 space-y-1">
                                            {fetchedBill.additionalInfo.map((info, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-500 font-bold">{info.infoName}:</span>
                                                    <span className="font-black text-slate-800">{info.infoValue}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Preset Amount Chips */}
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                                    Quick Recharge Amounts
                                </label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {PRESET_AMOUNTS.map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setRechargeAmount(String(amt))}
                                            className={`py-2 px-1 text-center rounded-xl text-xs font-black transition-all cursor-pointer ${
                                                rechargeAmount === String(amt)
                                                    ? 'bg-purple-600 text-white shadow-xs'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black'
                                            }`}
                                        >
                                            ₹{amt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Amount Input */}
                            <div>
                                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                                    Recharge Amount (₹) <span className="text-rose-600">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-600">
                                        ₹
                                    </span>
                                    <input
                                        type="number"
                                        min="100"
                                        max="50000"
                                        step="1"
                                        value={rechargeAmount}
                                        onChange={(e) => setRechargeAmount(e.target.value)}
                                        placeholder="500"
                                        className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-200 font-black text-base transition-all bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 mt-1">
                                    <span>Min: ₹100</span>
                                    <span>Max: ₹50,000</span>
                                </div>
                            </div>

                            {/* Form Error Banner */}
                            {formError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            {/* Proceed to Payment Button */}
                            <button
                                type="button"
                                onClick={handleProceedToConfirm}
                                disabled={!vehicleNumber || !customerMobile || finalAmount <= 0}
                                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 disabled:from-slate-200 disabled:to-slate-200 text-white disabled:text-slate-400 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md"
                            >
                                <span>Proceed to Recharge (₹{finalAmount.toFixed(2)})</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>

                            {/* Security Note */}
                            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500 pt-1">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>256-bit Encrypted BBPS Transaction</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOW STEP: CONFIRMATION MODAL */}
            <AnimatePresence>
                {flowStep === 'CONFIRM' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden p-5 sm:p-6 space-y-4"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                                        <CarFront className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-black">Confirm FASTag Payment</h3>
                                        <p className="text-xs font-bold text-slate-500">Bharat Connect NETC Portal</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFlowStep('FORM')}
                                    disabled={isSubmitting}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-black hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Confirmation Summary */}
                            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5 text-xs font-bold text-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">FASTag Issuer:</span>
                                    <span className="font-black text-black text-right max-w-[65%] truncate">
                                        {selectedBiller?.billerName}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Vehicle Number:</span>
                                    <span className="font-mono font-black text-black">
                                        {cleanVehicleNumber(vehicleNumber)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Customer Mobile:</span>
                                    <span className="font-mono font-black text-slate-800">
                                        {customerMobile}
                                    </span>
                                </div>
                                {fetchedBill?.customerName && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Customer Name:</span>
                                        <span className="font-black text-slate-800 uppercase">
                                            {fetchedBill.customerName}
                                        </span>
                                    </div>
                                )}
                                <div className="border-t border-slate-200/80 pt-2.5 flex justify-between items-center">
                                    <span className="text-slate-500">Recharge Amount:</span>
                                    <span className="font-black text-black text-sm">
                                        ₹{finalAmount.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Convenience Fee:</span>
                                    <span className="font-black text-emerald-600">
                                        FREE (₹0.00)
                                    </span>
                                </div>
                                <div className="border-t border-slate-200/80 pt-2.5 flex justify-between items-center text-sm">
                                    <span className="font-black text-black uppercase">Total Wallet Debit:</span>
                                    <span className="font-black text-purple-700 text-base">
                                        ₹{finalAmount.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Wallet Balance Impact */}
                            <div className="rounded-2xl bg-purple-50/60 border border-purple-100 p-3.5 space-y-1.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-bold">Current Wallet Balance:</span>
                                    <span className="font-black text-black">₹{numBalance.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-bold">Balance After Payment:</span>
                                    <span className="font-black text-emerald-700">₹{estimatedBalanceAfter.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Confirm Action Button */}
                            <div className="pt-2 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFlowStep('FORM')}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs transition-colors cursor-pointer"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecutePayment}
                                    disabled={isSubmitting}
                                    className="flex-2 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:bg-slate-300"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Debiting & Recharging...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-4 h-4" />
                                            <span>Pay Now ₹{finalAmount.toFixed(2)}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FLOW STEP: RESULT & RECEIPT VIEW */}
            {flowStep === 'RESULT' && txnOutcome && (
                <div className="space-y-4">
                    <BbpsReceiptCard
                        txnOutcome={txnOutcome}
                        category="fastag"
                        billerName={selectedBiller?.billerName}
                        consumerNumber={cleanVehicleNumber(vehicleNumber)}
                        customerName={fetchedBill?.customerName || 'FASTag Customer'}
                        onReset={handleReset}
                        resetButtonText="+ Recharge Another FASTag"
                    />
                </div>
            )}
        </div>
    );
};

export default FastagFlow;

