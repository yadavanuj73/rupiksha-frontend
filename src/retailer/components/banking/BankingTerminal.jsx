import React, { useState, useEffect } from 'react';
import { 
    Landmark, 
    ArrowRight, 
    ArrowLeft,
    Fingerprint, 
    ShieldCheck, 
    CheckCircle2, 
    AlertCircle, 
    RefreshCw, 
    KeyRound, 
    Smartphone, 
    Coins, 
    Eye, 
    EyeOff, 
    Check, 
    X, 
    Search,
    CreditCard,
    FileText,
    ArrowDownToLine,
    MapPin,
    Sparkles,
    BadgeCheck,
    Building2,
    Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRD } from '../../../hooks/useRD';
import { useWallet } from '../../../context/WalletContext';
import DeviceStatus from '../../../components/DeviceStatus';
import CaptureButton from '../../../components/CaptureButton';
import CaptureLoader from '../../../components/CaptureLoader';
import CaptureError from '../../../components/CaptureError';
import CaptureSuccess from '../../../components/CaptureSuccess';
import { aepsService } from '../../../services/apiService';
import ReceiptModal from './ReceiptModal';
import DailyAuthentication from '../../../components/DailyAuthentication';
import { validateVerhoeff } from '../../../utils/verhoeff';

const POPULAR_BANKS = [
    { name: 'State Bank of India', short: 'SBI', iin: '607082' },
    { name: 'HDFC Bank', short: 'HDFC', iin: '607153' },
    { name: 'ICICI Bank', short: 'ICICI', iin: '608001' },
    { name: 'Punjab National Bank', short: 'PNB', iin: '607027' },
    { name: 'Bank of Baroda', short: 'BOB', iin: '606985' },
    { name: 'Canara Bank', short: 'Canara', iin: '607393' },
    { name: 'Union Bank of India', short: 'Union', iin: '607161' },
    { name: 'Paytm Payments Bank', short: 'Paytm', iin: '608032' }
];

const QUICK_AMOUNTS = [500, 1000, 2000, 3000, 5000, 10000];

export default function BankingTerminal({ provider, status, setStatus }) {
    const { captureState, status: rdStatus, device, error: rdError, captureResult, capture, reset } = useRD();
    const { refreshWallet } = useWallet();

    const isFingpay = provider === 'fingpay';
    const tabs = isFingpay
        ? [
            { id: 'CASH_WITHDRAWAL', label: 'Cash Withdrawal', icon: Coins },
            { id: 'BALANCE_INQUIRY', label: 'Balance Inquiry', icon: Search },
            { id: 'MINI_STATEMENT', label: 'Mini Statement', icon: FileText },
            { id: 'AADHAAR_PAY', label: 'Aadhaar Pay', icon: CreditCard },
            { id: 'CASH_DEPOSIT', label: 'Cash Deposit', icon: ArrowDownToLine }
          ]
        : [
            { id: 'CASH_WITHDRAWAL', label: 'Cash Withdrawal', icon: Coins },
            { id: 'BALANCE_INQUIRY', label: 'Balance Inquiry', icon: Search },
            { id: 'MINI_STATEMENT', label: 'Mini Statement', icon: FileText },
            { id: 'AADHAAR_PAY', label: 'Aadhaar Pay', icon: CreditCard }
          ];

    const [activeTab, setActiveTab] = useState('CASH_WITHDRAWAL');
    const [currentStep, setCurrentStep] = useState(1); // 1 = Input Details, 2 = Biometric Capture & Confirm
    const [idType, setIdType] = useState('AADHAAR'); // 'AADHAAR' (12 digits) or 'VID' (16 digits)
    
    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [showAadhaar, setShowAadhaar] = useState(false);
    
    const [formData, setFormData] = useState({
        mobile: '',
        aadhar: '',
        bankId: '',
        bankName: '',
        bankIin: '',
        amount: '',
        remarks: 'Cash Withdrawal'
    });

    // GPS location state
    const [location, setLocation] = useState(null);
    const [locError, setLocError] = useState('');

    // Denominations for Cash Deposit
    const [denominations, setDenominations] = useState({
        500: 0,
        200: 0,
        100: 0,
        50: 0,
        20: 0,
        10: 0
    });

    const [bcConsent, setBcConsent] = useState(false);
    
    // UI state
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    
    // Receipt Modal state
    const [receiptOpen, setReceiptOpen] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [show2faModal, setShow2faModal] = useState(false);

    // Fetch banks and lock location on mount
    useEffect(() => {
        const loadBanks = async () => {
            try {
                const res = await aepsService.getBanks();
                if (res.success && res.data) {
                    setBanks(res.data);
                    setFilteredBanks(res.data);
                }
            } catch (e) {
                console.error("Failed to load Fingpay banks", e);
            }
        };
        loadBanks();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocation({
                        latitude: pos.coords.latitude.toFixed(6),
                        longitude: pos.coords.longitude.toFixed(6)
                    });
                },
                (err) => {
                    console.warn("Geolocation permission rejected", err);
                    setLocError("GPS permissions are required for AEPS transactions.");
                }
            );
        } else {
            setLocError("Geolocation not supported by browser.");
        }
    }, []);

    // Recalculate filtered banks
    useEffect(() => {
        if (!bankSearch.trim()) {
            setFilteredBanks(banks);
        } else {
            const query = bankSearch.toLowerCase();
            setFilteredBanks(
                banks.filter(b => b.bankName.toLowerCase().includes(query) || (b.iinno && b.iinno.includes(query)))
            );
        }
    }, [bankSearch, banks]);

    // Reset fields on tab change
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setCurrentStep(1);
        setFormData(prev => ({ 
            ...prev, 
            amount: '',
            remarks: tabId === 'CASH_WITHDRAWAL' ? 'Cash Withdrawal' : 
                     tabId === 'BALANCE_INQUIRY' ? 'Balance Inquiry' : 
                     tabId === 'MINI_STATEMENT' ? 'Mini Statement' : 
                     tabId === 'AADHAAR_PAY' ? 'Aadhaar Pay' : 'Cash Deposit'
        }));
        setErrorMsg('');
        setSuccessMsg('');
        setBcConsent(false);
        if (reset) reset();
        setDenominations({
            500: 0,
            200: 0,
            100: 0,
            50: 0,
            20: 0,
            10: 0
        });
    };

    // Calculate denomination sum
    const denominationSum = 
        (denominations[500] * 500) +
        (denominations[200] * 200) +
        (denominations[100] * 100) +
        (denominations[50] * 50) +
        (denominations[20] * 20) +
        (denominations[10] * 10);

    const isDeposit = activeTab === 'CASH_DEPOSIT';
    const requiresAmount = activeTab === 'CASH_DEPOSIT' || activeTab === 'CASH_WITHDRAWAL' || activeTab === 'AADHAAR_PAY';

    const handleDenominationChange = (val, denomination) => {
        const count = parseInt(val) || 0;
        setDenominations(prev => ({
            ...prev,
            [denomination]: count >= 0 ? count : 0
        }));
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        if (name === 'mobile') {
            setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 10) }));
        } else if (name === 'aadhar') {
            const maxLen = idType === 'VID' ? 16 : 12;
            setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, maxLen) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleIdTypeChange = (newType) => {
        setIdType(newType);
        setFormData(prev => ({
            ...prev,
            aadhar: prev.aadhar.slice(0, newType === 'VID' ? 16 : 12)
        }));
    };

    const handleSelectBank = (bank) => {
        setFormData(prev => ({
            ...prev,
            bankId: bank.id,
            bankName: bank.bankName,
            bankIin: bank.iinno
        }));
        setBankSearch(bank.bankName);
        setShowBankDropdown(false);
    };

    const handleQuickBankSelect = (popular) => {
        const found = banks.find(b => b.iinno === popular.iin || b.bankName.toLowerCase().includes(popular.name.toLowerCase()));
        if (found) {
            handleSelectBank(found);
        } else {
            setFormData(prev => ({
                ...prev,
                bankId: popular.iin,
                bankName: popular.name,
                bankIin: popular.iin
            }));
            setBankSearch(popular.name);
            setShowBankDropdown(false);
        }
    };

    const clearSelectedBank = () => {
        setFormData(prev => ({ ...prev, bankId: '', bankName: '', bankIin: '' }));
        setBankSearch('');
        setShowBankDropdown(false);
    };

    const isAadhaarChecksumValid = formData.aadhar.length === (idType === 'VID' ? 16 : 12) && validateVerhoeff(formData.aadhar);

    // Validation for Step 1
    const validateStep1 = () => {
        if (!formData.mobile || formData.mobile.length !== 10) {
            return "Please enter a valid 10-digit customer mobile number.";
        }
        const expectedLen = idType === 'VID' ? 16 : 12;
        if (!formData.aadhar || formData.aadhar.length !== expectedLen) {
            return idType === 'VID' 
                ? "Please enter a valid 16-digit Virtual ID (VID)." 
                : "Please enter a valid 12-digit Aadhaar number.";
        }
        if (!formData.bankName && !formData.bankIin) {
            return "Please select a customer bank from the list.";
        }
        if (requiresAmount) {
            const amt = parseFloat(formData.amount);
            if (isNaN(amt) || amt <= 0) {
                return "Please enter a valid transaction amount.";
            }
            if (amt < 100 || amt > 10000) {
                return "Transaction amount must be between ₹100 and ₹10,000.";
            }
            if (isDeposit && amt !== denominationSum) {
                return `Denomination total (₹${denominationSum}) does not match entered transaction amount (₹${formData.amount}).`;
            }
        }
        if (!bcConsent) {
            return "Please confirm standard compliance by checking the BC declaration consent.";
        }
        if (!location) {
            return "GPS lock is required. Please grant location permissions to continue.";
        }
        return null;
    };

    // Transition from Step 1 to Step 2
    const handleProceedToStep2 = (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');
        const err = validateStep1();
        if (err) {
            setErrorMsg(err);
            return;
        }
        setCurrentStep(2);
    };

    // Submit Final Transaction (Step 2)
    const handleFinalSubmit = async (e) => {
        if (e) e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!captureResult || !captureResult.pidXml) {
            setErrorMsg("Please scan customer fingerprint before submitting.");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                amount: requiresAmount ? parseFloat(formData.amount) : 0,
                serviceType: activeTab,
                bankName: formData.bankName || formData.bankIin,
                adhaarNumber: formData.aadhar,
                customerMobile: formData.mobile,
                mobileNumber: formData.mobile,
                requestRemarks: formData.remarks || (activeTab === 'CASH_WITHDRAWAL' ? 'Cash Withdrawal' : activeTab),
                pidXml: captureResult.pidXml,
                biometricType: 'FMR',
                latitude: location?.latitude || "28.6139",
                longitude: location?.longitude || "77.2090",
                deviceId: device ? (device.serial || device.dpID || '10068311') : '10068311',
                ipAddress: '127.0.0.1',
                provider: provider
            };

            const response = await aepsService.transact(payload);
            
            if (response.success && response.data) {
                const data = response.data;
                const activeTabObj = tabs.find(t => t.id === activeTab);
                
                // Construct receipt properties according to Fingpay documentation
                const receipt = {
                    status: data.status || (response.success ? 'SUCCESS' : 'FAILED'),
                    message: response.message || (response.success ? 'Transaction Completed' : 'Transaction Declined'),
                    txnId: data.transactionId || data.merchantTxnId || ('TXN' + Date.now()),
                    fpTxnId: data.providerReference || data.fingpayTransactionId || data.fpTransactionId || 'N/A',
                    bankRRN: data.bankRrn || data.bankRRN || data.stan || data.providerReference || 'N/A',
                    transactionAmount: requiresAmount ? parseFloat(formData.amount) : 0,
                    balanceAmount: data.balanceAmount !== undefined ? data.balanceAmount : (data.amount || 0),
                    maskedAadhaar: (idType === 'VID' ? 'VID: ' : 'Aadhaar: ') + 'XXXX-XXXX-' + (formData.aadhar.length >= 4 ? formData.aadhar.slice(-4) : 'XXXX'),
                    mobile: formData.mobile,
                    bankName: formData.bankName,
                    timestamp: new Date().toLocaleString('en-IN'),
                    agentId: status.agentId || 'BC-TERMINAL',
                    serviceLabel: activeTabObj ? activeTabObj.label : 'AEPS Banking',
                    serviceType: activeTab
                };
                
                setReceiptData(receipt);
                setReceiptOpen(true);
                setSuccessMsg("Cash withdrawal transaction approved successfully!");
                
                // Trigger real-time wallet balance sync for retailer
                try {
                    if (refreshWallet) refreshWallet();
                    window.dispatchEvent(new Event('walletUpdated'));
                    window.dispatchEvent(new Event('dataUpdated'));
                } catch (we) {
                    console.warn("Wallet refresh trigger:", we);
                }

                // Reset form fields and step
                setFormData({
                    mobile: '',
                    aadhar: '',
                    bankId: '',
                    bankName: '',
                    bankIin: '',
                    amount: '',
                    remarks: 'Cash Withdrawal'
                });
                setBankSearch('');
                setBcConsent(false);
                setCurrentStep(1);
                if (reset) reset();
                setDenominations({
                    500: 0,
                    200: 0,
                    100: 0,
                    50: 0,
                    20: 0,
                    10: 0
                });
            } else {
                const failData = response.data;
                const respCode = failData?.responseCode || '';
                const respMsg = response.message || failData?.responseMessage || '';
                
                if (respCode === 'FP069' || respMsg.toLowerCase().includes('2fa')) {
                    if (setStatus) {
                        setStatus(prev => ({ ...prev, aeps2faDone: false }));
                    }
                    setShow2faModal(true);
                    setErrorMsg("Daily 2FA authentication is required by Fingpay. Please authenticate your biometric below.");
                } else {
                    setErrorMsg(respMsg || "Transaction declined by bank/gateway.");
                }
            }
        } catch (err) {
            console.error("AEPS Transaction execution failed", err);
            const errMsg = err.message || "";
            if (errMsg.toLowerCase().includes('2fa')) {
                if (setStatus) {
                    setStatus(prev => ({ ...prev, aeps2faDone: false }));
                }
                setShow2faModal(true);
                setErrorMsg("Daily 2FA session is required. Please complete biometric authentication.");
            } else {
                setErrorMsg(errMsg || "Transaction submission failed. Please verify provider connectivity.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full text-left font-['Inter',sans-serif] space-y-6">
            {/* Strategy Routing Header */}
            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                        <Fingerprint size={26} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-black text-slate-800 tracking-tight">
                                AEPS Banking Terminal
                            </h1>
                            <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                                Live Session
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                            <span>Terminal ID: <strong className="text-slate-700 font-bold uppercase">{status.agentId || 'RPRMH62955'}</strong></span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {location && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-bold text-slate-600">
                            <MapPin size={12} className="text-emerald-500" />
                            <span>GPS: {location.latitude}, {location.longitude}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Service Navigation Tabs */}
            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-2 flex flex-wrap gap-2">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex-1 min-w-[150px] py-3.5 px-4 rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                                isActive
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            <Icon size={16} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Daily 2FA Warning Banner for Fingpay (when 2FA session is pending/expired) */}
            {isFingpay && !status.aeps2faDone && (
                <div className="bg-amber-50 border border-amber-200/90 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 shadow-sm">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
                            <Fingerprint size={26} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">Daily 2FA Authentication Required</h4>
                                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-black uppercase rounded-full">Once / 24 Hours</span>
                            </div>
                            <p className="text-xs text-amber-700/90 font-medium mt-0.5">Under NPCI & Fingpay guidelines, retailers must complete merchant biometric 2FA once daily before doing transactions.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShow2faModal(true)}
                        className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-md shadow-amber-500/25 shrink-0 flex items-center gap-2"
                    >
                        <ShieldCheck size={16} />
                        <span>Authenticate 2FA Now</span>
                    </button>
                </div>
            )}

            {/* Step Wizard Progress Header */}
            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-4 sm:p-5">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
                    {/* Step 1 Pill */}
                    <div 
                        onClick={() => currentStep === 2 && setCurrentStep(1)}
                        className={`flex items-center gap-3 cursor-pointer transition ${
                            currentStep === 1 ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                        }`}
                    >
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black transition shadow-sm ${
                            currentStep === 1 
                                ? 'bg-blue-600 text-white shadow-blue-500/25' 
                                : 'bg-emerald-600 text-white'
                        }`}>
                            {currentStep === 2 ? <Check size={16} /> : "1"}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 1</p>
                            <p className={`text-xs font-black ${currentStep === 1 ? 'text-slate-800' : 'text-slate-600'}`}>
                                Customer & Amount
                            </p>
                        </div>
                    </div>

                    {/* Divider bar */}
                    <div className="flex-1 mx-4 sm:mx-8 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${
                            currentStep === 2 ? 'bg-emerald-500 w-full' : 'bg-blue-600 w-1/2'
                        }`} />
                    </div>

                    {/* Step 2 Pill */}
                    <div className={`flex items-center gap-3 transition ${
                        currentStep === 2 ? 'opacity-100' : 'opacity-50'
                    }`}>
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black transition shadow-sm ${
                            currentStep === 2 
                                ? 'bg-blue-600 text-white shadow-blue-500/25' 
                                : 'bg-slate-100 text-slate-500'
                        }`}>
                            2
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 2</p>
                            <p className={`text-xs font-black ${currentStep === 2 ? 'text-slate-800' : 'text-slate-400'}`}>
                                Biometric Scan & Confirm
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily 2FA Gate check for Aadhaar Pay */}
            {activeTab === 'AADHAAR_PAY' && isFingpay && !status.ap2faDone ? (
                <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-8 text-center max-w-xl mx-auto">
                    <DailyAuthentication
                        provider={provider}
                        serviceType="AadhaarPay"
                        onSuccess={() => setStatus(prev => ({ ...prev, ap2faDone: true }))}
                        onBack={() => handleTabChange('CASH_WITHDRAWAL')}
                    />
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {/* STEP 1: CUSTOMER DETAILS & PARAMETERS                           */}
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                <div>
                                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
                                        {tabs.find(t => t.id === activeTab)?.label}
                                    </h2>
                                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                        Step 1: Enter customer details and transaction parameters
                                    </p>
                                </div>
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-blue-100">
                                    Step 1 of 2
                                </span>
                            </div>

                            <form onSubmit={handleProceedToStep2} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Customer Mobile Number */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Smartphone size={14} className="text-blue-600" />
                                                Customer Mobile Number
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400">
                                                {formData.mobile.length}/10
                                            </span>
                                        </label>
                                        <input
                                            type="tel"
                                            name="mobile"
                                            maxLength="10"
                                            placeholder="e.g. 9876543210"
                                            value={formData.mobile}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                            required
                                        />
                                    </div>

                                    {/* ID Type & Aadhaar / VID Input */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                <KeyRound size={14} className="text-blue-600" />
                                                Customer Identification
                                            </label>
                                            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
                                                <button
                                                    type="button"
                                                    onClick={() => handleIdTypeChange('AADHAAR')}
                                                    className={`px-2 py-0.5 rounded-lg transition ${
                                                        idType === 'AADHAAR' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                                                    }`}
                                                >
                                                    Aadhaar (12D)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleIdTypeChange('VID')}
                                                    className={`px-2 py-0.5 rounded-lg transition ${
                                                        idType === 'VID' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                                                    }`}
                                                >
                                                    Virtual ID (16D)
                                                </button>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type={showAadhaar ? "text" : "password"}
                                                name="aadhar"
                                                maxLength={idType === 'VID' ? 16 : 12}
                                                placeholder={idType === 'VID' ? "16-digit Virtual ID" : "12-digit Aadhaar Number"}
                                                value={formData.aadhar}
                                                onChange={handleFormChange}
                                                className="w-full px-4 pr-12 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition tracking-wider"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAadhaar(!showAadhaar)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                            >
                                                {showAadhaar ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>

                                        {formData.aadhar.length > 0 && (
                                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                                                <span className="text-slate-400">
                                                    Length: {formData.aadhar.length}/{idType === 'VID' ? 16 : 12}
                                                </span>
                                                {formData.aadhar.length === (idType === 'VID' ? 16 : 12) && (
                                                    <span className={`font-bold flex items-center gap-1 ${
                                                        isAadhaarChecksumValid ? 'text-emerald-600' : 'text-amber-600'
                                                    }`}>
                                                        {isAadhaarChecksumValid ? (
                                                            <>
                                                                <BadgeCheck size={12} />
                                                                <span>Verhoeff Checksum Valid</span>
                                                            </>
                                                        ) : (
                                                            <span>⚠️ Verify checksum</span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bank Selection Section */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Landmark size={14} className="text-blue-600" />
                                            Customer Bank (IIN)
                                        </span>
                                        {formData.bankName && (
                                            <button
                                                type="button"
                                                onClick={clearSelectedBank}
                                                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider cursor-pointer"
                                            >
                                                Change Bank
                                            </button>
                                        )}
                                    </label>

                                    {/* Quick Popular Banks Chips */}
                                    <div className="flex flex-wrap gap-2">
                                        {POPULAR_BANKS.map(pb => {
                                            const isSelected = formData.bankIin === pb.iin || formData.bankName.toLowerCase().includes(pb.short.toLowerCase());
                                            return (
                                                <button
                                                    key={pb.iin}
                                                    type="button"
                                                    onClick={() => handleQuickBankSelect(pb)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-blue-600 text-white shadow-sm'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                                                    }`}
                                                >
                                                    <span>{pb.short}</span>
                                                    {isSelected && <Check size={12} />}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Searchable Bank Input & Dropdown */}
                                    <div className="relative">
                                        <div className="relative">
                                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search bank name or 6-digit IIN..."
                                                value={bankSearch}
                                                onChange={(e) => {
                                                    setBankSearch(e.target.value);
                                                    setShowBankDropdown(true);
                                                }}
                                                onFocus={() => setShowBankDropdown(true)}
                                                className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                                required={!formData.bankName}
                                            />
                                            {bankSearch && (
                                                <button
                                                    type="button"
                                                    onClick={clearSelectedBank}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Dropdown list */}
                                        {showBankDropdown && filteredBanks.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto z-30 p-2 space-y-1">
                                                {filteredBanks.slice(0, 50).map(bank => (
                                                    <button
                                                        key={bank.id || bank.iinno}
                                                        type="button"
                                                        onClick={() => handleSelectBank(bank)}
                                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition flex justify-between items-center cursor-pointer"
                                                    >
                                                        <span>{bank.bankName}</span>
                                                        <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">
                                                            IIN: {bank.iinno}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Selected Bank Banner */}
                                    {formData.bankName && (
                                        <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-800 font-bold">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={16} className="text-emerald-600" />
                                                <span>Selected Bank: <strong>{formData.bankName}</strong></span>
                                            </div>
                                            {formData.bankIin && (
                                                <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                                    IIN {formData.bankIin}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Transaction Amount Section */}
                                {requiresAmount && (
                                    <div className="space-y-3 pt-2 border-t border-slate-100">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                                <span className="flex items-center gap-1.5">
                                                    <Coins size={14} className="text-blue-600" />
                                                    Transaction Amount (₹)
                                                </span>
                                                <span className="text-[10px] font-semibold text-slate-400">
                                                    Min: ₹100 • Max: ₹10,000
                                                </span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                                                    ₹
                                                </span>
                                                <input
                                                    type="number"
                                                    name="amount"
                                                    min="100"
                                                    max="10000"
                                                    step="1"
                                                    placeholder="Enter withdrawal amount"
                                                    value={formData.amount}
                                                    onChange={handleFormChange}
                                                    className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Quick Amount Pills */}
                                        <div className="flex flex-wrap gap-2">
                                            {QUICK_AMOUNTS.map(amt => (
                                                <button
                                                    key={amt}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, amount: String(amt) }))}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                                        formData.amount === String(amt)
                                                            ? 'bg-blue-600 text-white shadow-sm'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                                                    }`}
                                                >
                                                    +₹{amt.toLocaleString('en-IN')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Remarks (Optional) */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                        <span>Request Remarks (Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="remarks"
                                        placeholder="e.g. Cash Withdrawal"
                                        value={formData.remarks}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                    />
                                </div>

                                {/* Cash Denomination Breakdown - ONLY FOR CASH DEPOSIT */}
                                {isDeposit && (
                                    <div className="border border-slate-200 rounded-3xl p-5 bg-slate-50/50 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <Coins size={14} className="text-blue-600" />
                                                Cash Denomination Breakdown
                                            </h3>
                                            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                                formData.amount && parseFloat(formData.amount) === denominationSum
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                Total: ₹{denominationSum.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {[500, 200, 100, 50, 20, 10].map(denom => (
                                                <div key={denom} className="bg-white border border-slate-200/80 p-3 rounded-2xl flex items-center justify-between gap-2 shadow-sm">
                                                    <span className="text-xs font-black text-slate-700 w-12">₹{denom}</span>
                                                    <span className="text-xs text-slate-400 font-bold">×</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        value={denominations[denom] || ''}
                                                        onChange={(e) => handleDenominationChange(e.target.value, denom)}
                                                        className="w-16 text-right text-xs font-black text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 p-1.5 rounded-lg"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* BC Declaration Consent */}
                                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3 items-start">
                                    <input
                                        type="checkbox"
                                        id="bcConsent"
                                        checked={bcConsent}
                                        onChange={(e) => setBcConsent(e.target.checked)}
                                        className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="bcConsent" className="text-xs font-semibold leading-relaxed text-slate-600 cursor-pointer">
                                        I confirm that the customer is physically present at the outlet, customer consent has been obtained, and biometric authentication will be conducted as per RBI & NPCI BC guidelines.
                                    </label>
                                </div>

                                {/* Alerts */}
                                {errorMsg && (
                                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                        <AlertCircle className="text-rose-500 shrink-0" size={16} />
                                        <div>{errorMsg}</div>
                                    </div>
                                )}

                                {/* Proceed to Step 2 Button */}
                                <button
                                    type="submit"
                                    disabled={!bcConsent}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/25 disabled:opacity-50"
                                >
                                    <span>Proceed to Biometric Capture</span>
                                    <ArrowRight size={16} />
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {/* STEP 2: BIOMETRIC CAPTURE & CONFIRM SUBMISSION                  */}
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                        >
                            {/* Left Column: Transaction Summary Ticket */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 space-y-5">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                            <FileText size={15} className="text-blue-600" />
                                            Transaction Overview
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Edit3 size={13} />
                                            <span>Edit Details</span>
                                        </button>
                                    </div>

                                    {/* Amount Callout (when required) */}
                                    {requiresAmount && (
                                        <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-center space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                                                Withdrawal Amount
                                            </p>
                                            <p className="text-2xl font-black text-slate-800">
                                                ₹ {parseFloat(formData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    )}

                                    {/* Parameter list */}
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                            <span className="text-slate-400 font-semibold">Service Type:</span>
                                            <strong className="text-slate-700 font-bold uppercase">
                                                {tabs.find(t => t.id === activeTab)?.label}
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                            <span className="text-slate-400 font-semibold">Customer Mobile:</span>
                                            <strong className="text-slate-700 font-bold font-mono">
                                                +91 {formData.mobile}
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                            <span className="text-slate-400 font-semibold">Customer ID:</span>
                                            <strong className="text-slate-700 font-bold font-mono">
                                                XXXX-XXXX-{formData.aadhar.slice(-4)} ({idType})
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                            <span className="text-slate-400 font-semibold">Customer Bank:</span>
                                            <strong className="text-slate-700 font-bold truncate max-w-[150px] text-right">
                                                {formData.bankName}
                                            </strong>
                                        </div>

                                        {formData.bankIin && (
                                            <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                                <span className="text-slate-400 font-semibold">Bank IIN:</span>
                                                <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                                    {formData.bankIin}
                                                </span>
                                            </div>
                                        )}

                                        {formData.remarks && (
                                            <div className="flex justify-between items-center py-1.5">
                                                <span className="text-slate-400 font-semibold">Remarks:</span>
                                                <span className="text-slate-600 font-medium truncate max-w-[140px]">
                                                    {formData.remarks}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(1)}
                                        className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <ArrowLeft size={14} />
                                        <span>Back to Edit Details</span>
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Biometric Capture & Final Execution */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
                                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                        <div>
                                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                                <Fingerprint size={20} className="text-blue-600" />
                                                Step 2: Biometric Authentication
                                            </h3>
                                            <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                                Place customer finger on the scanner and click Capture below
                                            </p>
                                        </div>
                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-100">
                                            Step 2 of 2
                                        </span>
                                    </div>

                                    {/* Scanner Device Status */}
                                    <DeviceStatus />

                                    {/* Capture Controls */}
                                    <div className="space-y-4 pt-2">
                                        <CaptureButton />
                                        <CaptureLoader />
                                        <CaptureError />
                                        <CaptureSuccess />
                                    </div>

                                    {/* Alerts */}
                                    {errorMsg && (
                                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                            <AlertCircle className="text-rose-500 shrink-0" size={16} />
                                            <div>{errorMsg}</div>
                                        </div>
                                    )}

                                    {successMsg && (
                                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                            <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                                            <div>{successMsg}</div>
                                        </div>
                                    )}

                                    {/* Final Submit Button */}
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={handleFinalSubmit}
                                            disabled={loading || !captureResult || !captureResult.pidXml}
                                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                                        >
                                            {loading ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    Processing Fingpay Cash Withdrawal...
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck size={18} />
                                                    {requiresAmount 
                                                        ? `Confirm & Withdraw Cash (₹${formData.amount})` 
                                                        : `Submit ${tabs.find(t => t.id === activeTab)?.label}`}
                                                </>
                                            )}
                                        </button>
                                        
                                        {!captureResult && (
                                            <p className="text-[11px] text-center text-slate-400 font-semibold mt-2">
                                                Please capture customer biometric fingerprint to enable withdrawal.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* Receipt Modal Overlay */}
            <ReceiptModal
                isOpen={receiptOpen}
                onClose={() => setReceiptOpen(false)}
                txnData={receiptData}
            />

            {/* Daily 2FA Modal Dialog Overlay */}
            {show2faModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => setShow2faModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                        <DailyAuthentication
                            provider={provider}
                            serviceType={activeTab === 'AADHAAR_PAY' ? 'AadhaarPay' : 'AEPS'}
                            onSuccess={() => {
                                setShow2faModal(false);
                                if (setStatus) {
                                    setStatus(prev => ({ ...prev, aeps2faDone: true, ap2faDone: true }));
                                }
                                setSuccessMsg("Daily 2FA session activated successfully! You can now execute your cash withdrawal.");
                                setErrorMsg('');
                            }}
                            onBack={() => setShow2faModal(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
