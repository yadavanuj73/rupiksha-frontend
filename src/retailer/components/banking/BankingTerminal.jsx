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
    Edit3,
    Banknote,
    Zap,
    Shield
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
    { name: 'State Bank of India', short: 'SBI', iin: '607094' },
    { name: 'Punjab National Bank', short: 'PNB', iin: '607027' },
    { name: 'Bank of Baroda', short: 'BOB', iin: '606985' },
    { name: 'Canara Bank', short: 'Canara', iin: '607393' },
    { name: 'Union Bank of India', short: 'Union', iin: '607161' },
    { name: 'HDFC Bank', short: 'HDFC', iin: '607152' },
    { name: 'ICICI Bank', short: 'ICICI', iin: '508534' },
    { name: 'Axis Bank', short: 'Axis', iin: '607153' },
    { name: 'Kotak Mahindra Bank', short: 'Kotak', iin: '607363' },
    { name: 'Airtel Payments Bank', short: 'Airtel', iin: '990308' },
    { name: 'Paytm Payments Bank', short: 'Paytm', iin: '608032' },
    { name: 'Bank of India', short: 'BOI', iin: '607064' },
    { name: 'Central Bank of India', short: 'Central', iin: '607076' },
    { name: 'Indian Bank', short: 'Indian', iin: '607105' },
    { name: 'UCO Bank', short: 'UCO', iin: '607137' }
];

const QUICK_AMOUNTS = [500, 1000, 2000, 3000, 5000, 10000];

const TAB_CONFIG = {
    CASH_WITHDRAWAL: {
        label: 'Cash Withdrawal',
        shortLabel: 'Withdrawal',
        icon: Banknote,
        gradient: 'from-blue-600 via-indigo-600 to-indigo-700',
        bgGlow: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        activePill: 'from-blue-600 to-indigo-700',
        badge: 'Cash Out',
        desc: 'Instant Aadhaar biometric cash withdrawal'
    },
    BALANCE_INQUIRY: {
        label: 'Balance Inquiry',
        shortLabel: 'Balance',
        icon: Search,
        gradient: 'from-sky-500 via-blue-600 to-indigo-600',
        bgGlow: 'bg-sky-500/10',
        borderColor: 'border-sky-500/30',
        activePill: 'from-sky-500 to-blue-700',
        badge: 'Live Balance',
        desc: 'Real-time bank account balance check'
    },
    MINI_STATEMENT: {
        label: 'Mini Statement',
        shortLabel: 'Statement',
        icon: FileText,
        gradient: 'from-purple-600 via-violet-600 to-indigo-700',
        bgGlow: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        activePill: 'from-purple-600 to-violet-700',
        badge: 'Past 9 Txns',
        desc: 'Instant 9-10 recent bank account entries'
    },
    AADHAAR_PAY: {
        label: 'Aadhaar Pay',
        shortLabel: 'Aadhaar Pay',
        icon: CreditCard,
        gradient: 'from-rose-500 via-pink-600 to-indigo-600',
        bgGlow: 'bg-rose-500/10',
        borderColor: 'border-rose-500/30',
        activePill: 'from-rose-600 to-pink-700',
        badge: 'Merchant Pay',
        desc: 'High-limit merchant customer payment'
    },
    CASH_DEPOSIT: {
        label: 'Cash Deposit',
        shortLabel: 'Deposit',
        icon: ArrowDownToLine,
        gradient: 'from-emerald-500 via-teal-600 to-blue-600',
        bgGlow: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        activePill: 'from-emerald-600 to-teal-700',
        badge: 'Cash In',
        desc: 'Deposit cash directly to customer bank'
    }
};

export default function BankingTerminal({ provider, status, setStatus }) {
    const { captureState, status: rdStatus, device, error: rdError, captureResult, capture, reset } = useRD();
    const { refreshWallet } = useWallet();

    const isFingpay = provider === 'fingpay';
    const tabKeys = isFingpay
        ? ['CASH_WITHDRAWAL', 'BALANCE_INQUIRY', 'MINI_STATEMENT', 'AADHAAR_PAY', 'CASH_DEPOSIT']
        : ['CASH_WITHDRAWAL', 'BALANCE_INQUIRY', 'MINI_STATEMENT', 'AADHAAR_PAY'];

    const tabs = tabKeys.map(key => ({
        id: key,
        ...TAB_CONFIG[key]
    }));

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
                bankName: formData.bankIin || formData.bankName,
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
                setSuccessMsg("Transaction executed successfully!");
                
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

    const currentTabObj = TAB_CONFIG[activeTab] || TAB_CONFIG.CASH_WITHDRAWAL;

    return (
        <div className="w-full text-left font-['Inter',sans-serif] space-y-4">
            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* UNIFIED COMPACT HEADER & SERVICE NAVIGATION TABS                 */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-3xl p-3.5 sm:p-4 space-y-3 relative overflow-hidden">
                {/* Ambient dynamic background gradient glow */}
                <div className={`pointer-events-none absolute -right-20 -top-20 w-72 h-72 rounded-full bg-gradient-to-br ${currentTabObj.gradient} opacity-10 blur-3xl transition-all duration-700`} />
                <div className="pointer-events-none absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-blue-500/5 blur-3xl" />

                {/* Top Terminal Info & Stepper Bar */}
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100/90">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${currentTabObj.gradient} text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0`}>
                            <Fingerprint size={20} className="drop-shadow" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base font-black text-slate-800 tracking-tight">
                                    AEPS Banking Terminal
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                                    Live
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-2">
                                <span>ID: <strong className="text-slate-700 font-bold uppercase">{status.agentId || 'RPRMH62955'}</strong></span>
                                {location && (
                                    <>
                                        <span className="text-slate-300">•</span>
                                        <span className="inline-flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                                            <MapPin size={10} className="text-emerald-500" />
                                            {location.latitude}, {location.longitude}
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Compact Interactive Mini-Stepper */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl self-stretch md:self-auto justify-center">
                        <button
                            type="button"
                            onClick={() => currentStep === 2 && setCurrentStep(1)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                currentStep === 1
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black ${
                                currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'
                            }`}>
                                {currentStep === 2 ? <Check size={12} /> : "1"}
                            </span>
                            <span>Customer & Amount</span>
                        </button>

                        <div className="w-4 h-0.5 bg-slate-200" />

                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                            currentStep === 2
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-400'
                        }`}>
                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black ${
                                currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>
                                2
                            </span>
                            <span>Biometric & Submit</span>
                        </div>
                    </div>
                </div>

                {/* Service Navigation Tabs Bar (With Liquid Motion & Gradient Icons) */}
                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-0.5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <motion.button
                                key={tab.id}
                                type="button"
                                whileHover={{ y: -2, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleTabChange(tab.id)}
                                className={`group relative overflow-hidden py-2.5 px-3 rounded-2xl font-bold text-xs transition-all duration-200 flex items-center gap-2.5 cursor-pointer border text-left ${
                                    isActive
                                        ? `bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/15`
                                        : 'bg-slate-50/70 hover:bg-white text-slate-700 border-slate-200/70 hover:border-slate-300'
                                }`}
                            >
                                {/* Floating mini glow on active */}
                                {isActive && (
                                    <div className={`absolute -right-6 -bottom-6 w-16 h-16 rounded-full bg-gradient-to-br ${tab.gradient} opacity-30 blur-md`} />
                                )}

                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                                    isActive 
                                        ? `bg-gradient-to-br ${tab.gradient} text-white shadow-sm` 
                                        : 'bg-white border border-slate-200/90 text-slate-600'
                                }`}>
                                    <Icon size={16} className="drop-shadow-xs" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-black leading-tight">{tab.label}</p>
                                    <p className={`text-[10px] font-semibold truncate ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>
                                        {tab.badge}
                                    </p>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* Daily 2FA Warning Banner for Fingpay */}
            {isFingpay && !status.aeps2faDone && (
                <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50/90 border border-amber-200 rounded-3xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-xs"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">Daily Merchant 2FA Required</h4>
                                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-[9px] font-black uppercase rounded-full">Once / Day</span>
                            </div>
                            <p className="text-[11px] text-amber-700/90 font-medium">NPCI guidelines require merchant fingerprint authentication once daily before processing transactions.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShow2faModal(true)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5"
                    >
                        <Fingerprint size={14} />
                        <span>Authenticate 2FA</span>
                    </button>
                </motion.div>
            )}

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
                    {/* STEP 1: ULTRA-COMPACT 2-COLUMN COCKPIT (NO SCROLL)              */}
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {currentStep === 1 && (
                        <motion.form
                            key="step1"
                            onSubmit={handleProceedToStep2}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="grid grid-cols-1 lg:grid-cols-12 gap-4"
                        >
                            {/* LEFT PANEL: Customer & Bank Identification (Span 7) */}
                            <div className="lg:col-span-7 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-3xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${currentTabObj.gradient} text-white flex items-center justify-center text-xs shadow-xs`}>
                                                <KeyRound size={14} />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                                    Customer Identification
                                                </h3>
                                                <p className="text-[10px] text-slate-400 font-semibold">Mobile number, Aadhaar & Bank</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                            Step 1 of 2
                                        </span>
                                    </div>

                                    {/* Row 1: Mobile & Identification (2-col grid) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Customer Mobile Number */}
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                                <span className="flex items-center gap-1">
                                                    <Smartphone size={12} className="text-blue-600" />
                                                    Customer Mobile
                                                </span>
                                                <span className="text-[10px] font-semibold text-slate-400">
                                                    {formData.mobile.length}/10
                                                </span>
                                            </label>
                                            <input
                                                type="tel"
                                                name="mobile"
                                                maxLength="10"
                                                placeholder="10-digit mobile"
                                                value={formData.mobile}
                                                onChange={handleFormChange}
                                                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition tracking-wide"
                                                required
                                            />
                                        </div>

                                        {/* Aadhaar / VID Switcher & Input */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                                    <Fingerprint size={12} className="text-blue-600" />
                                                    Identity ({idType})
                                                </label>
                                                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[9px] font-black">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleIdTypeChange('AADHAAR')}
                                                        className={`px-1.5 py-0.5 rounded-md transition ${
                                                            idType === 'AADHAAR' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                                                        }`}
                                                    >
                                                        12D Aadhaar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleIdTypeChange('VID')}
                                                        className={`px-1.5 py-0.5 rounded-md transition ${
                                                            idType === 'VID' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                                                        }`}
                                                    >
                                                        16D VID
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
                                                    className="w-full px-3.5 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition tracking-wider"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAadhaar(!showAadhaar)}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                                >
                                                    {showAadhaar ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inline Verhoeff Status Indicator */}
                                    {formData.aadhar.length > 0 && (
                                        <div className="flex items-center justify-between text-[10px] px-1">
                                            <span className="text-slate-400 font-semibold">
                                                Input: {formData.aadhar.length}/{idType === 'VID' ? 16 : 12} digits
                                            </span>
                                            {formData.aadhar.length === (idType === 'VID' ? 16 : 12) && (
                                                <span className={`font-bold flex items-center gap-1 ${
                                                    isAadhaarChecksumValid ? 'text-emerald-600' : 'text-amber-600'
                                                }`}>
                                                    {isAadhaarChecksumValid ? (
                                                        <>
                                                            <BadgeCheck size={11} />
                                                            <span>Verhoeff Checksum Verified</span>
                                                        </>
                                                    ) : (
                                                        <span>⚠️ Checksum mismatch, verify digits</span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Bank Selection Section */}
                                    <div className="space-y-2 pt-1 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                                <Landmark size={12} className="text-blue-600" />
                                                Select Customer Bank
                                            </label>
                                            {formData.bankName && (
                                                <button
                                                    type="button"
                                                    onClick={clearSelectedBank}
                                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider cursor-pointer"
                                                >
                                                    Change
                                                </button>
                                            )}
                                        </div>

                                        {/* Search Input with dropdown */}
                                        <div className="relative">
                                            <div className="relative">
                                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search bank name or 6-digit IIN..."
                                                    value={bankSearch}
                                                    onChange={(e) => {
                                                        setBankSearch(e.target.value);
                                                        setShowBankDropdown(true);
                                                    }}
                                                    onFocus={() => setShowBankDropdown(true)}
                                                    className="w-full pl-9 pr-9 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                                    required={!formData.bankName}
                                                />
                                                {bankSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={clearSelectedBank}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {/* Dropdown list */}
                                            {showBankDropdown && filteredBanks.length > 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-40 p-1.5 space-y-0.5">
                                                    {filteredBanks.slice(0, 40).map(bank => (
                                                        <button
                                                            key={bank.id || bank.iinno}
                                                            type="button"
                                                            onClick={() => handleSelectBank(bank)}
                                                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition flex justify-between items-center cursor-pointer"
                                                        >
                                                            <span className="truncate pr-2">{bank.bankName}</span>
                                                            <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold shrink-0">
                                                                {bank.iinno}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Selected Bank Banner or Popular Banks Grid */}
                                        {formData.bankName ? (
                                            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800 font-bold">
                                                <div className="flex items-center gap-2 truncate">
                                                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                                    <span className="truncate">Bank: <strong>{formData.bankName}</strong></span>
                                                </div>
                                                {formData.bankIin && (
                                                    <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100/90 px-2 py-0.5 rounded-md shrink-0 ml-2">
                                                        IIN {formData.bankIin}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            /* Quick Popular Banks Chips Grid */
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {POPULAR_BANKS.map(pb => {
                                                    const isSelected = formData.bankIin === pb.iin || formData.bankName.toLowerCase().includes(pb.short.toLowerCase());
                                                    return (
                                                        <button
                                                            key={pb.iin}
                                                            type="button"
                                                            onClick={() => handleQuickBankSelect(pb)}
                                                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                                    : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80'
                                                            }`}
                                                        >
                                                            <span>{pb.short}</span>
                                                            {isSelected && <Check size={10} />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT PANEL: Amount, Parameters & Proceed Action (Span 5) */}
                            <div className="lg:col-span-5 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-3xl p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${currentTabObj.gradient} text-white flex items-center justify-center text-xs shadow-xs`}>
                                                <Coins size={14} />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                                    Transaction Parameters
                                                </h3>
                                                <p className="text-[10px] text-slate-400 font-semibold">{currentTabObj.label}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                            requiresAmount ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {requiresAmount ? 'Amount Required' : 'No Amount'}
                                        </span>
                                    </div>

                                    {/* Amount Section (if required) */}
                                    {requiresAmount ? (
                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                                    <span>Transaction Amount (₹)</span>
                                                    <span className="text-[10px] font-semibold text-slate-400">
                                                        ₹100 - ₹10,000
                                                    </span>
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                                                        ₹
                                                    </span>
                                                    <input
                                                        type="number"
                                                        name="amount"
                                                        min="100"
                                                        max="10000"
                                                        step="1"
                                                        placeholder="Enter amount"
                                                        value={formData.amount}
                                                        onChange={handleFormChange}
                                                        onWheel={(e) => e.target.blur()}
                                                        className="w-full pl-8 pr-3.5 py-2.5 rounded-2xl border border-slate-200 text-base font-black text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {/* Quick Amount Pills */}
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {QUICK_AMOUNTS.map(amt => (
                                                    <button
                                                        key={amt}
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, amount: String(amt) }))}
                                                        className={`py-1.5 px-2 rounded-xl text-xs font-black transition cursor-pointer text-center ${
                                                            formData.amount === String(amt)
                                                                ? `bg-gradient-to-r ${currentTabObj.gradient} text-white shadow-xs`
                                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                                                        }`}
                                                    >
                                                        ₹{amt.toLocaleString('en-IN')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-0.5">
                                            <p className="text-xs font-bold text-slate-700">{currentTabObj.label}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{currentTabObj.desc}</p>
                                        </div>
                                    )}

                                    {/* Denomination Breakdown for Cash Deposit */}
                                    {isDeposit && (
                                        <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/70 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                                                    Cash Denominations
                                                </span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    formData.amount && parseFloat(formData.amount) === denominationSum
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    Sum: ₹{denominationSum.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[500, 200, 100, 50, 20, 10].map(denom => (
                                                    <div key={denom} className="bg-white border border-slate-200/90 p-1.5 rounded-xl flex items-center justify-between text-[11px] font-bold">
                                                        <span className="text-slate-600 font-bold">₹{denom}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            value={denominations[denom] || ''}
                                                            onChange={(e) => handleDenominationChange(e.target.value, denom)}
                                                            className="w-10 text-right text-xs font-black bg-slate-50 border border-slate-200 rounded px-1 py-0.5"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Remarks field */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Remarks
                                        </label>
                                        <input
                                            type="text"
                                            name="remarks"
                                            placeholder="Optional remarks"
                                            value={formData.remarks}
                                            onChange={handleFormChange}
                                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* BC Declaration Consent Checkbox */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 flex gap-2.5 items-start">
                                        <input
                                            type="checkbox"
                                            id="bcConsent"
                                            checked={bcConsent}
                                            onChange={(e) => setBcConsent(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                        />
                                        <label htmlFor="bcConsent" className="text-[11px] font-medium leading-tight text-slate-600 cursor-pointer">
                                            Customer is physically present at the outlet & consent obtained as per RBI/NPCI BC guidelines.
                                        </label>
                                    </div>
                                </div>

                                {/* Alerts */}
                                {errorMsg && (
                                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2.5 rounded-2xl flex items-center gap-2 font-semibold">
                                        <AlertCircle className="text-rose-500 shrink-0" size={14} />
                                        <span className="text-[11px] leading-tight">{errorMsg}</span>
                                    </div>
                                )}

                                {/* Proceed Button */}
                                <motion.button
                                    type="submit"
                                    disabled={!bcConsent}
                                    whileHover={{ scale: bcConsent ? 1.01 : 1 }}
                                    whileTap={{ scale: bcConsent ? 0.98 : 1 }}
                                    className={`w-full py-3.5 px-4 rounded-2xl font-black uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg group ${
                                        bcConsent 
                                            ? `bg-gradient-to-r ${currentTabObj.gradient} text-white shadow-blue-500/25` 
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                    }`}
                                >
                                    <span>Proceed to Biometric Capture</span>
                                    <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                                </motion.button>
                            </div>
                        </motion.form>
                    )}

                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {/* STEP 2: BIOMETRIC CAPTURE & CONFIRM SUBMISSION                  */}
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="grid grid-cols-1 lg:grid-cols-12 gap-4"
                        >
                            {/* Left Column: Transaction Summary Ticket (Span 5) */}
                            <div className="lg:col-span-5 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-3xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                                <div className="space-y-3.5">
                                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                            <FileText size={14} className="text-blue-600" />
                                            Transaction Overview
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Edit3 size={12} />
                                            <span>Edit Details</span>
                                        </button>
                                    </div>

                                    {/* Amount Callout */}
                                    {requiresAmount && (
                                        <div className={`p-3.5 rounded-2xl text-center space-y-0.5 border ${currentTabObj.bgGlow} ${currentTabObj.borderColor}`}>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                {currentTabObj.label} Amount
                                            </p>
                                            <p className="text-2xl font-black text-slate-800 tracking-tight">
                                                ₹ {parseFloat(formData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    )}

                                    {/* Parameter Summary List */}
                                    <div className="space-y-2 text-xs bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                            <span className="text-slate-400 font-semibold text-[11px]">Service:</span>
                                            <strong className="text-slate-800 font-bold uppercase text-[11px]">
                                                {currentTabObj.label}
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                            <span className="text-slate-400 font-semibold text-[11px]">Customer Mobile:</span>
                                            <strong className="text-slate-800 font-bold font-mono text-[11px]">
                                                +91 {formData.mobile}
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                            <span className="text-slate-400 font-semibold text-[11px]">Identification:</span>
                                            <strong className="text-slate-800 font-bold font-mono text-[11px]">
                                                XXXX-XXXX-{formData.aadhar.slice(-4)} ({idType})
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                            <span className="text-slate-400 font-semibold text-[11px]">Bank:</span>
                                            <strong className="text-slate-800 font-bold truncate max-w-[160px] text-right text-[11px]">
                                                {formData.bankName}
                                            </strong>
                                        </div>

                                        {formData.bankIin && (
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-slate-400 font-semibold text-[11px]">Bank IIN:</span>
                                                <span className="font-mono text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                                    {formData.bankIin}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <ArrowLeft size={13} />
                                    <span>Back to Edit Details</span>
                                </button>
                            </div>

                            {/* Right Column: Biometric Capture & Execution (Span 7) */}
                            <div className="lg:col-span-7 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-3xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                                <div className="space-y-3.5">
                                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                                        <div>
                                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                                                <Fingerprint size={16} className="text-blue-600" />
                                                Step 2: Biometric Authentication
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-semibold">
                                                Scan customer fingerprint to authorize transaction
                                            </p>
                                        </div>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-100">
                                            Step 2 of 2
                                        </span>
                                    </div>

                                    {/* Scanner Device Status */}
                                    <DeviceStatus />

                                    {/* Capture Controls */}
                                    <div className="space-y-3">
                                        <CaptureButton />
                                        <CaptureLoader />
                                        <CaptureError />
                                        <CaptureSuccess />
                                    </div>

                                    {/* Alerts */}
                                    {errorMsg && (
                                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                            <AlertCircle className="text-rose-500 shrink-0" size={15} />
                                            <div className="text-[11px] leading-tight">{errorMsg}</div>
                                        </div>
                                    )}

                                    {successMsg && (
                                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                            <CheckCircle2 className="text-emerald-500 shrink-0" size={15} />
                                            <div className="text-[11px] leading-tight">{successMsg}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Final Submit Button */}
                                <div>
                                    <motion.button
                                        type="button"
                                        onClick={handleFinalSubmit}
                                        disabled={loading || !captureResult || !captureResult.pidXml}
                                        whileHover={{ scale: (!loading && captureResult?.pidXml) ? 1.01 : 1 }}
                                        whileTap={{ scale: (!loading && captureResult?.pidXml) ? 0.98 : 1 }}
                                        className={`w-full py-3.5 px-4 rounded-2xl font-black uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                                            loading 
                                                ? 'bg-slate-800 text-white shadow-none cursor-wait' 
                                                : captureResult?.pidXml 
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25' 
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                        }`}
                                    >
                                        {loading ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Processing AEPS Transaction...
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck size={16} />
                                                {requiresAmount 
                                                    ? `Confirm & Execute (₹${formData.amount})` 
                                                    : `Submit ${currentTabObj.label}`}
                                            </>
                                        )}
                                    </motion.button>
                                    
                                    {!captureResult && (
                                        <p className="text-[10px] text-center text-slate-400 font-semibold mt-1.5">
                                            Capture customer biometric fingerprint above to enable execution.
                                        </p>
                                    )}
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
                                setSuccessMsg("Daily 2FA session activated successfully! You can now execute your transaction.");
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
