import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, CheckCircle2, AlertCircle, Clock,
    Search, Check, ShieldCheck, RefreshCw, Printer,
    Wallet, ArrowRight, Info, X, Building2, User,
    FileText, Calendar, DollarSign, ExternalLink, Lock,
    ChevronDown, ChevronRight, Eye, Sparkles,
    Shield, History, Tag, Briefcase, Phone, BadgeCheck, XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { bbpsService } from '../../../services/apiService';
import { useWallet } from '../../../context/WalletContext';
import BbpsServiceNav from './BbpsServiceNav';
import BbpsReceiptCard from './BbpsReceiptCard';
import { primeBharatConnectSound, playBharatConnectSuccessSound } from '../../../utils/bbpsSound';

// Official Bharat Connect Agent Collection Billers (BillAvenue Version 2.8.7)
const DEFAULT_COLLECTION_BILLERS = [
    { billerId: 'BAJA00000NAT9L', billerName: 'Bajaj Finance Limited Agent Collection', agencyName: 'Bajaj Finance Limited', paramName: 'Consumer No.' },
    { billerId: 'DMIH00020NATNH', billerName: 'DMI Housing Finance Pvt Ltd', agencyName: 'DMI Housing Finance Private Limited', paramName: 'Agent Code' },
    { billerId: 'HDBF00019NATJC', billerName: 'HDB Financial Agent Services', agencyName: 'HDB Financial Services Limited', paramName: 'Agent Code' },
    { billerId: 'HIRA00027NAT83', billerName: 'Hiranandani Financial Services Pvt Ltd', agencyName: 'Hiranandani Financial Services Private Limited', paramName: 'Agent Code' }
];

// Popular Agent Collection quick chips
const POPULAR_COLLECTIONS = [
    { label: 'All', query: '' },
    { label: 'Bajaj Finance', query: 'Bajaj' },
    { label: 'DMI Housing', query: 'DMI' },
    { label: 'HDB Financial', query: 'HDB' },
    { label: 'Hiranandani', query: 'Hiranandani' }
];

// Quick collection amount presets
const PRESET_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

const AgentCollectionFlow = ({ onBack, category }) => {
    const { balance, refreshWallet } = useWallet();
    const numBalance = typeof balance === 'number' ? balance : parseFloat(balance) || 0;

    // Flow steps: 'FORM' | 'CONFIRM' | 'RESULT'
    const [flowStep, setFlowStep] = useState('FORM');

    // Biller list & selection
    const [billers, setBillers] = useState(DEFAULT_COLLECTION_BILLERS);
    const [billerSearch, setBillerSearch] = useState('');
    const [selectedQuickChip, setSelectedQuickChip] = useState('All');
    const [selectedBiller, setSelectedBiller] = useState(DEFAULT_COLLECTION_BILLERS[0]);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const comboboxRef = useRef(null);

    // Form inputs
    const [customerMobile, setCustomerMobile] = useState('');
    const [customerParams, setCustomerParams] = useState({});
    const [paramErrors, setParamErrors] = useState({});

    // Bill fetch & dues
    const [isFetchingBill, setIsFetchingBill] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [fetchedBill, setFetchedBill] = useState(null);
    const [collectionAmount, setCollectionAmount] = useState('1000');

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

    // Sync live billers catalogue from server in background
    useEffect(() => {
        let isMounted = true;
        const fetchBillers = async () => {
            try {
                const res = await bbpsService.getAgentCollectionBillers();
                if (isMounted && Array.isArray(res) && res.length > 0) {
                    setBillers(res);
                }
            } catch (err) {
                // Silently keep DEFAULT_COLLECTION_BILLERS fallback
            }
        };
        fetchBillers();
        return () => { isMounted = false; };
    }, []);

    // Filter billers based on search query
    const filteredBillers = useMemo(() => {
        const pool = billers && billers.length > 0 ? billers : DEFAULT_COLLECTION_BILLERS;
        if (!billerSearch.trim()) return pool;
        const search = billerSearch.toLowerCase().trim();
        return pool.filter(b =>
            (b.billerName || '').toLowerCase().includes(search) ||
            (b.agencyName || '').toLowerCase().includes(search) ||
            (b.billerId || '').toLowerCase().includes(search)
        );
    }, [billers, billerSearch]);

    // Handle biller selection
    const handleSelectBiller = (biller) => {
        setSelectedBiller(biller);
        setIsComboboxOpen(false);
        setFetchedBill(null);
        setFetchError('');
        setFormError('');
        setParamErrors({});

        // Initialize customer parameters
        const initialParams = {};
        if (biller.inputParams && biller.inputParams.length > 0) {
            biller.inputParams.forEach(p => {
                initialParams[p.paramName] = '';
            });
        } else {
            initialParams['Agent Code'] = '';
        }
        setCustomerParams(initialParams);

        // Match chip if applicable
        const matchingChip = POPULAR_COLLECTIONS.find(c => c.query && (
            (biller.billerName || '').toLowerCase().includes(c.query.toLowerCase()) ||
            (biller.agencyName || '').toLowerCase().includes(c.query.toLowerCase())
        ));
        if (matchingChip) {
            setSelectedQuickChip(matchingChip.label);
        } else {
            setSelectedQuickChip('');
        }
    };

    // Quick chip click handler
    const handleQuickChipClick = (chip) => {
        setSelectedQuickChip(chip.label);
        setBillerSearch('');
        if (!chip.query) {
            return;
        }
        const found = (billers || DEFAULT_COLLECTION_BILLERS).find(b =>
            (b.billerName || '').toLowerCase().includes(chip.query.toLowerCase()) ||
            (b.agencyName || '').toLowerCase().includes(chip.query.toLowerCase())
        );
        if (found) {
            handleSelectBiller(found);
        }
    };

    const handleParamChange = (name, val) => {
        setCustomerParams(prev => ({ ...prev, [name]: val }));
        if (paramErrors[name]) {
            setParamErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    // Dynamic input parameters defined by biller
    const activeParams = useMemo(() => {
        if (selectedBiller && selectedBiller.inputParams && selectedBiller.inputParams.length > 0) {
            return selectedBiller.inputParams;
        }
        return [
            {
                paramName: 'Agent Code',
                dataType: 'ALPHANUMERIC',
                optional: false,
                minLength: 3,
                maxLength: 30
            },
            {
                paramName: 'Center ID / Group Code',
                dataType: 'ALPHANUMERIC',
                optional: true,
                minLength: 2,
                maxLength: 30
            }
        ];
    }, [selectedBiller]);

    // Validate inputs
    const validateInputs = () => {
        const errors = {};
        if (!selectedBiller) {
            errors.biller = 'Please select a collection institution';
        }

        if (!customerMobile || !/^[6-9]\d{9}$/.test(customerMobile)) {
            errors.mobile = 'Enter a valid 10-digit Indian mobile number';
        }

        activeParams.forEach(p => {
            const val = (customerParams[p.paramName] || '').trim();
            if (!p.optional && !val) {
                errors[p.paramName] = `${p.paramName} is required`;
            } else if (val) {
                if (p.minLength && val.length < p.minLength) {
                    errors[p.paramName] = `Must be at least ${p.minLength} characters`;
                }
                if (p.maxLength && val.length > p.maxLength) {
                    errors[p.paramName] = `Cannot exceed ${p.maxLength} characters`;
                }
            }
        });

        const amt = parseFloat(collectionAmount) || 0;
        if (amt < 1) {
            errors.amount = 'Amount must be at least ₹1.00';
        }

        setParamErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Common agent identifier and collection reference
    const mainCode = customerParams['Agent Code'] || customerParams['Agent ID'] || customerParams['Collector ID'] || customerParams['Delivery Agent ID'] || customerParams['Rider ID'] || Object.values(customerParams)[0] || '';
    const centerCode = customerParams['Center ID'] || customerParams['Group Code'] || customerParams['Branch Code'] || '';

    // Fetch bill / dues
    const handleFetchBill = async () => {
        if (!validateInputs()) return;

        setIsFetchingBill(true);
        setFetchError('');
        setFormError('');

        try {
            const res = await bbpsService.fetchAgentCollectionBill({
                billerId: selectedBiller.billerId,
                customerMobile: customerMobile.trim(),
                customerParams: customerParams
            });

            if (res && res.success) {
                setFetchedBill(res);
                if (res.billAmount && res.billAmount > 0) {
                    setCollectionAmount(String(res.billAmount));
                }
            } else {
                setFetchError(res?.message || 'Unable to fetch collection details from provider');
            }
        } catch (err) {
            setFetchError(err?.message || 'Failed to connect to Bharat Connect provider');
        } finally {
            setIsFetchingBill(false);
        }
    };

    // Proceed to confirmation modal
    const handleProceedToConfirm = () => {
        if (!validateInputs()) return;

        const amt = parseFloat(collectionAmount) || 0;
        if (amt > numBalance) {
            setFormError(`Insufficient wallet balance. Available: ₹${numBalance.toFixed(2)}, Required: ₹${amt.toFixed(2)}`);
            return;
        }

        setFormError('');
        setFlowStep('CONFIRM');
    };

    // Pay Agent Collection Deposit
    const handleConfirmPayment = async () => {
        if (isSubmitting) return;

        const amt = parseFloat(collectionAmount) || 0;
        if (amt > numBalance) {
            setFormError(`Insufficient wallet balance. Available: ₹${numBalance.toFixed(2)}, Required: ₹${amt.toFixed(2)}`);
            setFlowStep('FORM');
            return;
        }

        setIsSubmitting(true);
        setFormError('');

        try {
            const payload = {
                billerId: selectedBiller.billerId,
                customerMobile: customerMobile.trim(),
                customerParams: customerParams,
                amount: amt,
                convenienceFee: 0,
                agentCode: mainCode,
                collectionRef: centerCode,
                customerName: fetchedBill?.customerName || (mainCode ? `Agent ${mainCode}` : 'Agent Collection'),
                billNumber: fetchedBill?.billNumber,
                billDate: fetchedBill?.billDate,
                dueDate: fetchedBill?.dueDate,
                billPeriod: fetchedBill?.billPeriod,
                fetchRequestId: fetchedBill?.fetchRequestId,
                additionalInfo: fetchedBill?.additionalInfo
            };

            const res = await bbpsService.payAgentCollectionBill(payload);

            if (res) {
                setTxnOutcome(res);
                setFlowStep('RESULT');

                if (res.success || res.status === 'SUCCESS') {
                    playBharatConnectSuccessSound();
                    confetti({
                        particleCount: 80,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
                refreshWallet();
            } else {
                setFormError('No response from payment server');
                setFlowStep('FORM');
            }
        } catch (err) {
            setFormError(err?.message || 'Transaction submission failed');
            setFlowStep('FORM');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetFlow = () => {
        setFlowStep('FORM');
        setFetchedBill(null);
        setTxnOutcome(null);
        setFetchError('');
        setFormError('');
        setCollectionAmount('1000');
        refreshWallet();
    };

    return (
        <div className="space-y-4 font-['Inter',sans-serif] max-w-full overflow-hidden">
            {/* Top Navigation Bar */}
            <BbpsServiceNav
                onBack={onBack}
                title="Agent Collection"
                icon={Users}
                gradient="from-emerald-500 to-teal-600"
                badgeText="Bharat Connect"
            />

            {/* Error Banner */}
            {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs font-bold shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">{formError}</div>
                    <button onClick={() => setFormError('')} className="text-rose-500 hover:text-rose-700">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* STEP 1: FORM */}
            {flowStep === 'FORM' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* LEFT COLUMN: Institution Selection & Quick Chips */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-black">
                                        Select Collection Institution
                                    </h3>
                                    <p className="text-xs text-slate-600 font-bold">
                                        Search authorized microfinance, NBFC, or logistics cash-drop partner
                                    </p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    30+ Verified Partners
                                </span>
                            </div>

                            {/* Quick Filter Chips */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                                {POPULAR_COLLECTIONS.map(chip => (
                                    <button
                                        key={chip.label}
                                        type="button"
                                        onClick={() => handleQuickChipClick(chip)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                                            selectedQuickChip === chip.label
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                                        }`}
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                            </div>

                            {/* Searchable Combobox */}
                            <div className="relative" ref={comboboxRef}>
                                <label className="block text-xs font-black text-black mb-1.5">
                                    Collection Institution / Biller <span className="text-rose-600">*</span>
                                </label>
                                <div
                                    onClick={() => setIsComboboxOpen(!isComboboxOpen)}
                                    className="w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-white focus:bg-white text-xs md:text-sm font-bold text-black flex items-center justify-between cursor-pointer transition-all shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span className="truncate">
                                            {selectedBiller ? selectedBiller.billerName : 'Choose an institution...'}
                                        </span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isComboboxOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isComboboxOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-300 rounded-2xl shadow-xl z-50 overflow-hidden max-h-72 flex flex-col">
                                        <div className="p-2 border-b border-slate-200 bg-slate-50">
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={billerSearch}
                                                    onChange={e => setBillerSearch(e.target.value)}
                                                    placeholder="Search by company name or ID..."
                                                    className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto max-h-56 divide-y divide-slate-100">
                                            {filteredBillers.length > 0 ? (
                                                filteredBillers.map(b => (
                                                    <div
                                                        key={b.billerId}
                                                        onClick={() => handleSelectBiller(b)}
                                                        className={`p-3 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between hover:bg-emerald-50 ${
                                                            selectedBiller?.billerId === b.billerId ? 'bg-emerald-50 text-emerald-900' : 'text-slate-900'
                                                        }`}
                                                    >
                                                        <div className="truncate pr-2">
                                                            <div className="font-black text-black truncate">{b.billerName}</div>
                                                            <div className="text-[11px] text-slate-600 truncate">{b.agencyName || b.billerId}</div>
                                                        </div>
                                                        {selectedBiller?.billerId === b.billerId && (
                                                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-xs text-slate-500 font-bold">
                                                    No collection institution found matching &ldquo;{billerSearch}&rdquo;
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected Biller Info Card */}
                            {selectedBiller && (
                                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-black text-black truncate">{selectedBiller.billerName}</h4>
                                        <p className="text-[11px] text-slate-600 font-bold truncate">
                                            Biller ID: <span className="font-mono text-emerald-800 font-black">{selectedBiller.billerId}</span>
                                        </p>
                                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-700 font-bold">
                                            <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-900 font-black">
                                                Cash & Online Modes
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                                Instant Credit
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Wallet Balance Status Card */}
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-600 font-bold">Available Wallet Balance</div>
                                        <div className="text-sm font-black text-black">₹{numBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={refreshWallet}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
                                    title="Refresh Balance"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Dynamic Input Parameters & Payment Amount */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-black">
                                        Agent / Collector Details
                                    </h3>
                                    <p className="text-xs text-slate-600 font-bold">
                                        Enter required identifiers for {selectedBiller?.billerName ? 'the partner' : 'the service'}
                                    </p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                    Step 1 of 2
                                </span>
                            </div>

                            {/* Dynamic Input Parameters */}
                            {activeParams.map(param => (
                                <div key={param.paramName} className="space-y-1.5">
                                    <label className="block text-xs font-black text-black">
                                        {param.paramName} {!param.optional && <span className="text-rose-600">*</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={customerParams[param.paramName] || ''}
                                        onChange={e => handleParamChange(param.paramName, e.target.value)}
                                        placeholder={`Enter ${param.paramName}`}
                                        className={`w-full px-3.5 py-2.5 text-xs md:text-sm rounded-xl border bg-slate-50 focus:bg-white text-black font-bold outline-none transition-all shadow-2xs ${
                                            paramErrors[param.paramName] ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                                        }`}
                                    />
                                    {paramErrors[param.paramName] && (
                                        <p className="text-[11px] text-rose-600 font-bold">{paramErrors[param.paramName]}</p>
                                    )}
                                </div>
                            ))}

                            {/* Customer Mobile Number */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-black">
                                    Agent / Customer Mobile Number <span className="text-rose-600">*</span>
                                </label>
                                <div className="relative">
                                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        value={customerMobile}
                                        onChange={e => {
                                            setCustomerMobile(e.target.value.replace(/\D/g, ''));
                                            if (paramErrors.mobile) setParamErrors(prev => ({ ...prev, mobile: null }));
                                        }}
                                        placeholder="10-digit mobile number for SMS confirmation"
                                        className={`w-full pl-9 pr-3.5 py-2.5 text-xs md:text-sm rounded-xl border bg-slate-50 focus:bg-white text-black font-bold outline-none transition-all shadow-2xs ${
                                            paramErrors.mobile ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                                        }`}
                                    />
                                </div>
                                {paramErrors.mobile && (
                                    <p className="text-[11px] text-rose-600 font-bold">{paramErrors.mobile}</p>
                                )}
                            </div>

                            {/* Optional Fetch Button if bill fetch supported */}
                            {selectedBiller?.billerFetchRequirement !== 'NOT_SUPPORTED' && (
                                <button
                                    type="button"
                                    onClick={handleFetchBill}
                                    disabled={isFetchingBill}
                                    className="w-full py-2 px-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                                >
                                    {isFetchingBill ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Fetching Live Account Details...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-3.5 h-3.5" />
                                            <span>Validate Account / Fetch Dues</span>
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Fetch Error Display */}
                            {fetchError && (
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                                    {fetchError}
                                </div>
                            )}

                            {/* Fetched Account & Bill Verification Card */}
                            {fetchedBill && (
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-slate-50 to-white border border-emerald-200 shadow-xs space-y-3">
                                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                                                <BadgeCheck className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                                                    <span>Account Verified</span>
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        Active Biller
                                                    </span>
                                                </div>
                                                <div className="text-[11px] font-bold text-slate-500">
                                                    {fetchedBill.billerName || selectedBiller?.billerName}
                                                </div>
                                            </div>
                                        </div>
                                        {fetchedBill.fetchRequestId && (
                                            <span className="text-[10px] font-mono font-bold text-slate-400 hidden sm:inline">
                                                ID: {fetchedBill.fetchRequestId.slice(-8)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Account & Details Grid */}
                                    <div className="space-y-1.5 text-xs">
                                        {/* Customer / Agent Name */}
                                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                                            <span className="font-bold text-slate-600">Customer / Agent Name:</span>
                                            {fetchedBill.customerName ? (
                                                <span className="font-black text-black text-right">{fetchedBill.customerName}</span>
                                            ) : (
                                                <span className="font-bold text-slate-500 italic text-right">Not provided by biller (Verified Account)</span>
                                            )}
                                        </div>

                                        {/* Agent Code / ID */}
                                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                                            <span className="font-bold text-slate-600">Agent Code / ID:</span>
                                            <span className="font-black font-mono text-black">{fetchedBill.consumerNumber || mainCode || 'Verified'}</span>
                                        </div>

                                        {/* Collection Reference if available */}
                                        {centerCode && (
                                            <div className="flex items-center justify-between py-1 border-b border-slate-100">
                                                <span className="font-bold text-slate-600">Collection Ref:</span>
                                                <span className="font-black font-mono text-black">{centerCode}</span>
                                            </div>
                                        )}

                                        {/* Due Date if available */}
                                        {fetchedBill.dueDate && (
                                            <div className="flex items-center justify-between py-1 border-b border-slate-100">
                                                <span className="font-bold text-slate-600">Due Date:</span>
                                                <span className="font-black text-amber-700">{fetchedBill.dueDate}</span>
                                            </div>
                                        )}

                                        {/* Bill Number if available */}
                                        {fetchedBill.billNumber && (
                                            <div className="flex items-center justify-between py-1 border-b border-slate-100">
                                                <span className="font-bold text-slate-600">Bill Number:</span>
                                                <span className="font-mono font-bold text-slate-800">{fetchedBill.billNumber}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Due Amount vs No Bill Due Display */}
                                    {fetchedBill.billAmount && Number(fetchedBill.billAmount) > 0 ? (
                                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                                            <div>
                                                <div className="text-[11px] font-black text-amber-900 uppercase tracking-wide">
                                                    Outstanding Bill Due
                                                </div>
                                                <div className="text-base font-black text-amber-700 font-mono mt-0.5">
                                                    ₹{Number(fetchedBill.billAmount).toFixed(2)}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setCollectionAmount(String(fetchedBill.billAmount))}
                                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer shadow-xs transition"
                                            >
                                                Apply Due Amount
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-950 text-xs space-y-1">
                                            <div className="flex items-center gap-1.5 font-black text-emerald-900">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                                <span>No Bill Due • Flexible Collection Deposit</span>
                                            </div>
                                            <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                                                No overdue bill on this account. You can enter any collection amount to deposit below.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Collection Amount Entry */}
                            <div className="space-y-2 pt-2 border-t border-slate-200">
                                <label className="block text-xs font-black text-black">
                                    Collection Amount (₹) <span className="text-rose-600">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">₹</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={collectionAmount}
                                        onChange={e => {
                                            setCollectionAmount(e.target.value);
                                            if (paramErrors.amount) setParamErrors(prev => ({ ...prev, amount: null }));
                                        }}
                                        placeholder="Enter collection amount"
                                        className={`w-full pl-8 pr-3.5 py-3 text-sm md:text-base font-black rounded-xl border bg-slate-50 focus:bg-white text-black outline-none transition-all shadow-2xs ${
                                            paramErrors.amount ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                                        }`}
                                    />
                                </div>
                                {paramErrors.amount && (
                                    <p className="text-[11px] text-rose-600 font-bold">{paramErrors.amount}</p>
                                )}

                                {/* Quick Amount Chips */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {PRESET_AMOUNTS.map(preset => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setCollectionAmount(String(preset))}
                                            className={`px-2.5 py-1 text-xs font-black rounded-lg border cursor-pointer transition-all ${
                                                collectionAmount === String(preset)
                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                    : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                                            }`}
                                        >
                                            ₹{preset.toLocaleString('en-IN')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Continue Button */}
                            <button
                                type="button"
                                onClick={handleProceedToConfirm}
                                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98 mt-3"
                            >
                                <span>Continue to Confirmation</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: CONFIRMATION MODAL */}
            {flowStep === 'CONFIRM' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-['Inter',sans-serif]">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black">Confirm Collection Deposit</h3>
                                    <p className="text-xs text-white/80 font-bold">Bharat Connect BBPS Payment</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFlowStep('FORM')}
                                disabled={isSubmitting}
                                className="p-1 rounded-lg hover:bg-white/20 text-white transition disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Details Breakdown */}
                        <div className="p-5 space-y-4">
                            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-600 font-bold">Institution / Biller:</span>
                                    <span className="font-black text-black text-right max-w-[200px] truncate">{selectedBiller?.billerName}</span>
                                </div>

                                {Object.entries(customerParams).map(([k, v]) => v ? (
                                    <div key={k} className="flex items-center justify-between">
                                        <span className="text-slate-600 font-bold">{k}:</span>
                                        <span className="font-black text-black font-mono">{v}</span>
                                    </div>
                                ) : null)}

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 font-bold">Mobile Number:</span>
                                    <span className="font-black text-black font-mono">{customerMobile}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 font-bold">Collection Amount:</span>
                                    <span className="font-black text-black">₹{parseFloat(collectionAmount).toFixed(2)}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 font-bold">Convenience Fee:</span>
                                    <span className="font-bold text-emerald-700">₹0.00 (FREE)</span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm font-black text-black">
                                    <span>Total Payable:</span>
                                    <span className="text-emerald-700 font-mono">₹{parseFloat(collectionAmount).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Wallet Deduction Preview */}
                            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                                <div>
                                    <div className="text-slate-600 font-bold">Current Wallet Balance:</div>
                                    <div className="font-black text-black">₹{numBalance.toFixed(2)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-slate-600 font-bold">Balance After Deposit:</div>
                                    <div className="font-black text-emerald-700">₹{(numBalance - parseFloat(collectionAmount)).toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setFlowStep('FORM')}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPayment}
                                    disabled={isSubmitting}
                                    className="flex-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-98 disabled:opacity-60"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Processing Deposit...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Authorize Payment</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* STEP 3: RESULT SCREEN & RECEIPT */}
            {flowStep === 'RESULT' && txnOutcome && (
                <div className="max-w-xl mx-auto space-y-4">
                    <BbpsReceiptCard
                        transaction={{
                            id: txnOutcome.transactionId,
                            merchantRefNo: txnOutcome.merchantRefNo,
                            providerTxnId: txnOutcome.providerTxnId,
                            approvalRefNo: txnOutcome.approvalRefNo,
                            category: 'Agent Collection',
                            billerName: txnOutcome.billerName || selectedBiller?.billerName,
                            billerId: txnOutcome.billerId || selectedBiller?.billerId,
                            consumerNumber: txnOutcome.agentCode || customerParams['Agent Code'] || Object.values(customerParams)[0],
                            customerName: txnOutcome.customerName,
                            mobileNumber: txnOutcome.customerMobile || customerMobile,
                            amount: txnOutcome.amount,
                            convenienceFee: txnOutcome.convenienceFee || 0,
                            status: txnOutcome.status,
                            createdAt: txnOutcome.createdAt,
                            message: txnOutcome.message
                        }}
                        onClose={handleResetFlow}
                    />

                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={handleResetFlow}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Make Another Deposit</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentCollectionFlow;

