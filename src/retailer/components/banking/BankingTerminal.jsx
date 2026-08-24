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
    BadgeCheck,
    Edit3,
    Banknote
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
import AadhaarOtpModal from './AadhaarOtpModal';
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
        borderColor: 'border-blue-500/40',
        activePill: 'from-blue-600 to-indigo-700',
        badge: 'Cash Out',
        balloonColor: 'from-blue-400 to-indigo-500',
        desc: 'Instant Aadhaar biometric cash withdrawal'
    },
    BALANCE_INQUIRY: {
        label: 'Balance Inquiry',
        shortLabel: 'Balance',
        icon: Search,
        gradient: 'from-sky-500 via-blue-600 to-indigo-600',
        bgGlow: 'bg-sky-500/10',
        borderColor: 'border-sky-500/40',
        activePill: 'from-sky-500 to-blue-700',
        badge: 'Live Balance',
        balloonColor: 'from-sky-400 to-blue-500',
        desc: 'Real-time bank account balance check'
    },
    MINI_STATEMENT: {
        label: 'Mini Statement',
        shortLabel: 'Statement',
        icon: FileText,
        gradient: 'from-purple-600 via-violet-600 to-indigo-700',
        bgGlow: 'bg-purple-500/10',
        borderColor: 'border-purple-500/40',
        activePill: 'from-purple-600 to-violet-700',
        badge: 'Past 9 Txns',
        balloonColor: 'from-purple-400 to-violet-600',
        desc: 'Instant 9-10 recent bank account entries'
    },
    AADHAAR_PAY: {
        label: 'Aadhaar Pay',
        shortLabel: 'Aadhaar Pay',
        icon: CreditCard,
        gradient: 'from-rose-500 via-pink-600 to-indigo-600',
        bgGlow: 'bg-rose-500/10',
        borderColor: 'border-rose-500/40',
        activePill: 'from-rose-600 to-pink-700',
        badge: 'Merchant Pay',
        balloonColor: 'from-rose-400 to-orange-500',
        desc: 'High-limit merchant customer payment'
    },
    CASH_DEPOSIT: {
        label: 'Cash Deposit',
        shortLabel: 'Deposit',
        icon: ArrowDownToLine,
        gradient: 'from-emerald-500 via-teal-600 to-blue-600',
        bgGlow: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/40',
        activePill: 'from-emerald-600 to-teal-700',
        badge: 'Cash In',
        balloonColor: 'from-emerald-400 to-teal-500',
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

    // Aadhaar OTP Verification State for Amount > ₹5,000 (Fingpay NPCI Mandate)
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [txnOtpData, setTxnOtpData] = useState({ otp: '', fpTransactionId: '' });

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
        setShowOtpModal(false);
        setOtpError('');
        setTxnOtpData({ otp: '', fpTransactionId: '' });
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

    // Trigger Aadhaar OTP generation for transactions > 5000 (Fingpay Cash Withdrawal & Aadhaar Pay)
    const triggerSendTxnOtp = async () => {
        setOtpLoading(true);
        setOtpError('');
        try {
            const payload = {
                amount: parseFloat(formData.amount),
                serviceType: activeTab,
                bankName: formData.bankIin || formData.bankName,
                adhaarNumber: formData.aadhar,
                customerMobile: formData.mobile,
                mobileNumber: formData.mobile,
                requestRemarks: formData.remarks || (activeTab === 'CASH_WITHDRAWAL' ? 'Cash Withdrawal OTP request' : 'AadhaarPay OTP request'),
                latitude: location?.latitude || "28.6139",
                longitude: location?.longitude || "77.2090",
                deviceId: device ? (device.serial || device.dpID || '10068311') : '10068311',
                provider: provider
            };
            const res = await aepsService.sendTxnOtp(payload);
            if (res.success && res.data) {
                setTxnOtpData(prev => ({
                    ...prev,
                    fpTransactionId: res.data.fpTransactionId || res.data.merchantTxnId
                }));
            } else {
                setOtpError(res.message || "Failed to generate Aadhaar OTP. Please check details or retry.");
            }
        } catch (err) {
            console.error("sendTxnOtp error", err);
            setOtpError(err.message || "Failed to send OTP to Aadhaar linked mobile.");
        } finally {
            setOtpLoading(false);
        }
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

        // Check if Amount > 5000 for Cash Withdrawal or Aadhaar Pay (NPCI Mandate)
        const isEligibleForOtp = (activeTab === 'CASH_WITHDRAWAL' || activeTab === 'AADHAAR_PAY') && parseFloat(formData.amount) > 5000;
        if (isEligibleForOtp) {
            setShowOtpModal(true);
            triggerSendTxnOtp();
        } else {
            setTxnOtpData({ otp: '', fpTransactionId: '' });
            setCurrentStep(2);
        }
    };

    // Submit Final Transaction (Step 2)
    const handleFinalSubmit = async (customResult = null) => {
        const activeResult = (customResult && customResult.pidXml) ? customResult : captureResult;
        setErrorMsg('');
        setSuccessMsg('');

        if (!activeResult || !activeResult.pidXml) {
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
                pidXml: activeResult.pidXml,
                biometricType: 'FMR',
                latitude: location?.latitude || "28.6139",
                longitude: location?.longitude || "77.2090",
                deviceId: device ? (device.serial || device.dpID || '10068311') : '10068311',
                ipAddress: '127.0.0.1',
                provider: provider,
                txnOtpRequestId: txnOtpData.fpTransactionId || null,
                otp: txnOtpData.otp || null
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
                    maskedAadhaar: data.maskedAadhaar || ((idType === 'VID' ? 'VID: ' : 'Aadhaar: ') + 'XXXX-XXXX-' + (formData.aadhar.length >= 4 ? formData.aadhar.slice(-4) : 'XXXX')),
                    mobile: formData.mobile,
                    bankName: data.bankName || formData.bankName,
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
                setTxnOtpData({ otp: '', fpTransactionId: '' });
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
                
                if (reset) reset();

                if (respCode === 'FP069' || respMsg.toLowerCase().includes('2fa')) {
                    if (setStatus) {
                        setStatus(prev => ({ ...prev, aeps2faDone: false }));
                    }
                    setShow2faModal(true);
                    setErrorMsg("Daily 2FA authentication is required. Please authenticate your biometric below.");
                } else {
                    setErrorMsg(respMsg || "Transaction declined by bank/gateway.");
                }
            }
        } catch (err) {
            console.error("AEPS Transaction execution failed", err);
            if (reset) reset();
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

    // Auto-proceed transaction immediately when finger capture completes in Step 2
    useEffect(() => {
        if (currentStep === 2 && captureResult && captureResult.pidXml && !loading && !receiptOpen) {
            handleFinalSubmit(captureResult);
        }
    }, [captureResult, currentStep]);

    const currentTabObj = TAB_CONFIG[activeTab] || TAB_CONFIG.CASH_WITHDRAWAL;

    return (
        <div className="w-full h-full flex flex-col justify-between space-y-3 text-left font-['Inter',sans-serif] text-black">
            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* BALANCED & HANDSOME TERMINAL HEADER (BALLOON PARTICLES & TABS)    */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            <div className="bg-white/95 backdrop-blur-xl border border-slate-300 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-3xl p-3.5 sm:p-4 relative overflow-hidden shrink-0">
                {/* 🎈 MOVING BALLOONS & BUBBLE PARTICLES IN HEADER */}
                <motion.div
                    animate={{ y: [0, -12, 0], x: [0, 8, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="pointer-events-none absolute top-1 right-28 w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-500 opacity-25 blur-[1px] shadow-md shadow-blue-500/20"
                >
                    <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-white/70 blur-[0.5px]" />
                </motion.div>

                <motion.div
                    animate={{ y: [0, -14, 0], x: [0, -7, 0], scale: [1, 1.25, 1] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="pointer-events-none absolute -bottom-2 left-1/3 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 opacity-25 blur-[1px]"
                >
                    <div className="absolute top-2 left-2.5 w-3.5 h-3.5 rounded-full bg-white/60 blur-[0.5px]" />
                </motion.div>

                <motion.div
                    animate={{ y: [0, -10, 0], x: [0, 10, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 4.0, repeat: Infinity, ease: 'easeInOut', delay: 1.0 }}
                    className="pointer-events-none absolute top-2 left-1/2 w-9 h-9 rounded-full bg-gradient-to-tr from-rose-400 via-pink-500 to-amber-400 opacity-30 blur-[1px]"
                >
                    <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-white/80" />
                </motion.div>

                <motion.div
                    animate={{ y: [0, -12, 0], x: [0, -8, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 6.0, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                    className="pointer-events-none absolute bottom-1 right-1/4 w-11 h-11 rounded-full bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 opacity-25 blur-[1px]"
                >
                    <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-white/70" />
                </motion.div>

                {/* Primary dynamic background ambient aura */}
                <div className={`pointer-events-none absolute -right-16 -top-16 w-60 h-60 rounded-full bg-gradient-to-br ${currentTabObj.gradient} opacity-15 blur-3xl transition-all duration-700`} />

                {/* Top Terminal Info & Stepper */}
                <div className="relative z-10 flex flex-wrap justify-between items-center gap-2 pb-2.5 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${currentTabObj.gradient} text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0`}>
                            <Fingerprint size={18} className="drop-shadow" />
                        </div>
                        <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
                            <h1 className="text-sm sm:text-base font-black text-black tracking-tight uppercase">
                                {isFingpay ? "AEPS 1 Terminal" : "AEPS 2 Terminal"}
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-full text-[9px] font-black uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping inline-block" />
                                Live Terminal
                            </span>
                            <span className="text-xs font-black text-black">
                                ID: <strong className="text-black font-extrabold uppercase">
                                    {status.agentId || status.merchantId || (isFingpay ? 'RPRMH62955' : 'LVN7292987918')}
                                </strong>
                            </span>
                            {location && (
                                <span className="hidden md:inline-flex items-center gap-1 text-black font-bold text-[10px]">
                                    • <MapPin size={10} className="text-emerald-700" />
                                    {location.latitude}, {location.longitude}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Interactive Stepper */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
                        <button
                            type="button"
                            onClick={() => currentStep === 2 && setCurrentStep(1)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                                currentStep === 1
                                    ? 'bg-black text-white shadow-xs'
                                    : 'text-slate-800 hover:text-black'
                            }`}
                        >
                            <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black ${
                                currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                            }`}>
                                {currentStep === 2 ? <Check size={10} /> : "1"}
                            </span>
                            <span>Customer & Amount</span>
                        </button>

                        <div className="w-3 h-0.5 bg-slate-300" />

                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition ${
                            currentStep === 2
                                ? 'bg-black text-white shadow-xs'
                                : 'text-slate-500'
                        }`}>
                            <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black ${
                                currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-black'
                            }`}>
                                2
                            </span>
                            <span>Biometric & Submit</span>
                        </div>
                    </div>
                </div>

                {/* Service Navigation Tabs Bar */}
                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-2.5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <motion.button
                                key={tab.id}
                                type="button"
                                whileHover={{ y: -1, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleTabChange(tab.id)}
                                className={`group relative overflow-hidden py-2 px-3 rounded-2xl font-black text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer border text-left ${
                                    isActive
                                        ? `bg-black text-white border-black shadow-md shadow-black/20`
                                        : 'bg-slate-50/90 hover:bg-white text-black border-slate-300 hover:border-slate-400'
                                }`}
                            >
                                {/* Active Liquid Glow & Animated Floating Micro Balloon */}
                                {isActive && (
                                    <>
                                        <div className={`absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-gradient-to-br ${tab.gradient} opacity-40 blur-md`} />
                                        <motion.div
                                            animate={{ y: [0, -4, 0], scale: [1, 1.2, 1] }}
                                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                                            className="pointer-events-none absolute top-1 right-2 w-3 h-3 rounded-full bg-white/40 blur-[0.5px]"
                                        />
                                    </>
                                )}

                                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                                    isActive 
                                        ? `bg-gradient-to-br ${tab.gradient} text-white shadow-xs` 
                                        : 'bg-white border border-slate-300 text-black shadow-xs'
                                }`}>
                                    <Icon size={14} className="drop-shadow-xs" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`truncate text-xs font-black leading-tight ${isActive ? 'text-white' : 'text-black'}`}>
                                        {tab.label}
                                    </p>
                                    <p className={`text-[9px] font-extrabold truncate ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>
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
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-100/90 border border-amber-300 rounded-2xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-black shadow-xs shrink-0"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-200 border border-amber-400 flex items-center justify-center text-amber-950 shrink-0">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">Daily Merchant 2FA Required</h4>
                                <span className="px-2 py-0.5 bg-amber-300 text-black text-[9px] font-black uppercase rounded-full">Once / Day</span>
                            </div>
                            <p className="text-[11px] text-black font-semibold">NPCI guidelines require merchant fingerprint authentication once daily before processing transactions.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShow2faModal(true)}
                        className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5"
                    >
                        <Fingerprint size={13} />
                        <span>Authenticate 2FA</span>
                    </button>
                </motion.div>
            )}

            {/* Daily 2FA Gate check for Aadhaar Pay */}
            {activeTab === 'AADHAAR_PAY' && isFingpay && !status.ap2faDone ? (
                <div className="bg-white border border-slate-300 shadow-sm rounded-3xl p-6 text-center max-w-lg mx-auto text-black flex-1 flex flex-col justify-center">
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
                    {/* STEP 1: FULL SCREEN-OCCUPYING 2-COLUMN COCKPIT                    */}
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {currentStep === 1 && (
                        <motion.form
                            key="step1"
                            onSubmit={handleProceedToStep2}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 text-black items-stretch min-h-[460px]"
                        >
                            {/* LEFT PANEL: Customer & Bank Identification (Span 7) - FULL AREA OCCUPIED */}
                            <div className="lg:col-span-7 bg-white/95 backdrop-blur-md border border-slate-300 shadow-sm rounded-3xl p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${currentTabObj.gradient} text-white flex items-center justify-center text-xs shadow-xs`}>
                                                <KeyRound size={13} />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-black text-black uppercase tracking-tight">
                                                    CUSTOMER IDENTIFICATION
                                                </h3>
                                                <p className="text-[10px] text-slate-700 font-bold">Mobile, Aadhaar & Bank Details</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black px-2.5 py-0.5 bg-slate-100 text-black border border-slate-300 rounded-full">
                                            Step 1 of 2
                                        </span>
                                    </div>

                                    {/* Row 1: Mobile & Identification (Big, comfortable, bold) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Customer Mobile Number */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-black text-black flex items-center justify-between">
                                                <span className="flex items-center gap-1 text-black">
                                                    <Smartphone size={13} className="text-blue-700 font-bold" />
                                                    Customer Mobile
                                                </span>
                                                <span className="text-[10px] font-black text-slate-700">
                                                    {formData.mobile.length}/10
                                                </span>
                                            </label>
                                            <input
                                                type="tel"
                                                name="mobile"
                                                maxLength="10"
                                                placeholder="10-digit mobile number"
                                                value={formData.mobile}
                                                onChange={handleFormChange}
                                                className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-slate-300 text-sm font-black text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition tracking-wide bg-slate-50/70"
                                                required
                                            />
                                        </div>

                                        {/* Aadhaar / VID Switcher & Input */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black text-black flex items-center gap-1">
                                                    <Fingerprint size={13} className="text-blue-700 font-bold" />
                                                    Identity ({idType})
                                                </label>
                                                <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-lg text-[9px] font-black">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleIdTypeChange('AADHAAR')}
                                                        className={`px-2 py-0.5 rounded-md transition ${
                                                            idType === 'AADHAAR' ? 'bg-black text-white shadow-xs' : 'text-slate-800'
                                                        }`}
                                                    >
                                                        12D Aadhaar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleIdTypeChange('VID')}
                                                        className={`px-2 py-0.5 rounded-md transition ${
                                                            idType === 'VID' ? 'bg-black text-white shadow-xs' : 'text-slate-800'
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
                                                    className="w-full px-3.5 pr-10 py-2.5 rounded-2xl border-2 border-slate-300 text-sm font-black text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition tracking-wider bg-slate-50/70"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAadhaar(!showAadhaar)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-black p-0.5 cursor-pointer"
                                                >
                                                    {showAadhaar ? <EyeOff size={15} /> : <Eye size={15} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inline Verhoeff Status Indicator */}
                                    {formData.aadhar.length > 0 && (
                                        <div className="flex items-center justify-between text-[10px] px-1 font-bold">
                                            <span className="text-black font-extrabold">
                                                Digits: {formData.aadhar.length}/{idType === 'VID' ? 16 : 12}
                                            </span>
                                            {formData.aadhar.length === (idType === 'VID' ? 16 : 12) && (
                                                <span className={`font-black flex items-center gap-1 ${
                                                    isAadhaarChecksumValid ? 'text-emerald-700' : 'text-amber-800'
                                                }`}>
                                                    {isAadhaarChecksumValid ? (
                                                        <>
                                                            <BadgeCheck size={12} />
                                                            <span>Verhoeff Checksum Verified</span>
                                                        </>
                                                    ) : (
                                                        <span>⚠️ Verify digits checksum</span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Bank Selection Section (Prominent search input & styled chips) */}
                                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-black text-black flex items-center gap-1.5">
                                                <Landmark size={13} className="text-blue-700" />
                                                Select Customer Bank
                                            </label>
                                            {formData.bankName && (
                                                <button
                                                    type="button"
                                                    onClick={clearSelectedBank}
                                                    className="text-[10px] font-black text-rose-600 hover:text-rose-800 uppercase tracking-wider cursor-pointer"
                                                >
                                                    Change Bank
                                                </button>
                                            )}
                                        </div>

                                        {/* Search Input with dropdown */}
                                        <div className="relative">
                                            <div className="relative">
                                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 font-bold" />
                                                <input
                                                    type="text"
                                                    placeholder="Search bank name or 6-digit IIN..."
                                                    value={bankSearch}
                                                    onChange={(e) => {
                                                        setBankSearch(e.target.value);
                                                        setShowBankDropdown(true);
                                                    }}
                                                    onFocus={() => setShowBankDropdown(true)}
                                                    className="w-full pl-9 pr-9 py-2 rounded-2xl border-2 border-slate-300 text-xs font-black text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition bg-slate-50/70"
                                                    required={!formData.bankName}
                                                />
                                                {bankSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={clearSelectedBank}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-black p-0.5"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {/* Dropdown list */}
                                            {showBankDropdown && filteredBanks.length > 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-slate-300 rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-40 p-1.5 space-y-0.5">
                                                    {filteredBanks.slice(0, 40).map(bank => (
                                                        <button
                                                            key={bank.id || bank.iinno}
                                                            type="button"
                                                            onClick={() => handleSelectBank(bank)}
                                                            className="w-full text-left px-3 py-2 text-xs font-black text-black hover:bg-blue-50 hover:text-blue-700 rounded-xl transition flex justify-between items-center cursor-pointer"
                                                        >
                                                            <span className="truncate pr-2 font-bold">{bank.bankName}</span>
                                                            <span className="font-mono text-[10px] bg-slate-200 text-black px-2 py-0.5 rounded font-black shrink-0">
                                                                {bank.iinno}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Selected Bank Banner or Popular Banks Grid */}
                                        {formData.bankName ? (
                                            <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-2xl flex items-center justify-between text-xs text-black font-black">
                                                <div className="flex items-center gap-2 truncate">
                                                    <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                                                    <span className="truncate">Bank: <strong className="text-black font-extrabold">{formData.bankName}</strong></span>
                                                </div>
                                                {formData.bankIin && (
                                                    <span className="text-[10px] text-black font-mono bg-emerald-200 px-2 py-0.5 rounded-md shrink-0 ml-1 font-black">
                                                        IIN {formData.bankIin}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            /* Quick Popular Banks Chips Grid (Dark Black Font, Filling Area) */
                                            <div className="grid grid-cols-5 sm:grid-cols-5 gap-1.5 pt-1">
                                                {POPULAR_BANKS.map(pb => {
                                                    const isSelected = formData.bankIin === pb.iin || formData.bankName.toLowerCase().includes(pb.short.toLowerCase());
                                                    return (
                                                        <button
                                                            key={pb.iin}
                                                            type="button"
                                                            onClick={() => handleQuickBankSelect(pb)}
                                                            className={`py-1.5 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-0.5 cursor-pointer border text-center ${
                                                                isSelected
                                                                    ? 'bg-black text-white border-black shadow-xs'
                                                                    : 'bg-slate-100 text-black border-slate-300 hover:bg-slate-200 hover:border-slate-400'
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
                            <div className="lg:col-span-5 bg-white/95 backdrop-blur-md border border-slate-300 shadow-sm rounded-3xl p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${currentTabObj.gradient} text-white flex items-center justify-center text-xs shadow-xs`}>
                                                <Coins size={13} />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-black text-black uppercase tracking-tight">
                                                    TRANSACTION PARAMETERS
                                                </h3>
                                                <p className="text-[10px] text-slate-700 font-bold">{currentTabObj.label}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                            requiresAmount ? 'bg-blue-100 text-blue-950 border-blue-300' : 'bg-slate-200 text-black border-slate-300'
                                        }`}>
                                            {requiresAmount ? 'Amount Required' : 'No Amount'}
                                        </span>
                                    </div>

                                    {/* Amount Section (if required) */}
                                    {requiresAmount ? (
                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <label className="text-xs font-black text-black flex items-center justify-between">
                                                    <span>Transaction Amount (₹)</span>
                                                    <span className="text-[10px] font-black text-slate-700">
                                                        ₹100 - ₹10,000
                                                    </span>
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black font-black text-lg">
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
                                                        className="w-full pl-8 pr-3.5 py-2.5 rounded-2xl border-2 border-slate-300 text-lg font-black text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition bg-slate-50/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                                        className={`py-1.5 px-1.5 rounded-xl text-xs font-black transition cursor-pointer text-center border ${
                                                            formData.amount === String(amt)
                                                                ? 'bg-black text-white border-black shadow-xs'
                                                                : 'bg-slate-100 text-black border-slate-300 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        ₹{amt.toLocaleString('en-IN')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-center space-y-0.5">
                                            <p className="text-xs font-black text-black">{currentTabObj.label}</p>
                                            <p className="text-[10px] text-slate-700 font-bold">{currentTabObj.desc}</p>
                                        </div>
                                    )}

                                    {/* Denomination Breakdown for Cash Deposit */}
                                    {isDeposit && (
                                        <div className="border-2 border-slate-300 rounded-2xl p-2.5 bg-slate-50 space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-black">
                                                    Cash Denominations
                                                </span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    formData.amount && parseFloat(formData.amount) === denominationSum
                                                        ? 'bg-emerald-200 text-black'
                                                        : 'bg-amber-200 text-black'
                                                }`}>
                                                    Sum: ₹{denominationSum.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[500, 200, 100, 50, 20, 10].map(denom => (
                                                    <div key={denom} className="bg-white border border-slate-300 p-1.5 rounded-xl flex items-center justify-between text-[11px] font-black">
                                                        <span className="text-black font-black">₹{denom}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            value={denominations[denom] || ''}
                                                            onChange={(e) => handleDenominationChange(e.target.value, denom)}
                                                            className="w-10 text-right text-xs font-black text-black bg-slate-100 border border-slate-300 rounded px-1 py-0.5"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Remarks field */}
                                    <div className="space-y-0.5">
                                        <label className="text-[10px] font-black text-black uppercase tracking-wider">
                                            Remarks
                                        </label>
                                        <input
                                            type="text"
                                            name="remarks"
                                            placeholder="Optional remarks"
                                            value={formData.remarks}
                                            onChange={handleFormChange}
                                            className="w-full px-3 py-1.5 rounded-xl border-2 border-slate-300 text-xs font-bold text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/70"
                                        />
                                    </div>

                                    {/* BC Declaration Consent Checkbox */}
                                    <div className="bg-slate-100 border border-slate-300 rounded-2xl p-2 flex gap-2 items-start">
                                        <input
                                            type="checkbox"
                                            id="bcConsent"
                                            checked={bcConsent}
                                            onChange={(e) => setBcConsent(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-slate-400 text-black focus:ring-black cursor-pointer shrink-0"
                                        />
                                        <label htmlFor="bcConsent" className="text-[10.5px] font-bold leading-tight text-black cursor-pointer">
                                            Customer is physically present at the outlet & consent obtained as per RBI/NPCI BC guidelines.
                                        </label>
                                    </div>
                                </div>

                                {/* Alerts */}
                                {errorMsg && (
                                    <div className="bg-rose-100 border border-rose-300 text-rose-950 text-xs p-2 rounded-2xl flex items-center gap-2 font-black">
                                        <AlertCircle className="text-rose-700 shrink-0" size={14} />
                                        <span className="text-[11px] leading-tight">{errorMsg}</span>
                                    </div>
                                )}

                                {/* Proceed Button */}
                                <motion.button
                                    type="submit"
                                    disabled={!bcConsent}
                                    whileHover={{ scale: bcConsent ? 1.01 : 1 }}
                                    whileTap={{ scale: bcConsent ? 0.98 : 1 }}
                                    className={`w-full py-3 px-4 rounded-2xl font-black uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md group ${
                                        bcConsent 
                                            ? `bg-black hover:bg-slate-900 text-white shadow-black/25` 
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                    }`}
                                >
                                    <span>Proceed to Biometric Capture</span>
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
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
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 text-black items-stretch min-h-[460px]"
                        >
                            {/* Left Column: Transaction Summary Ticket (Span 5) */}
                            <div className="lg:col-span-5 bg-white/95 backdrop-blur-md border border-slate-300 shadow-sm rounded-3xl p-4 sm:p-5 space-y-3 flex flex-col justify-between h-full">
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                            <FileText size={14} className="text-blue-700 font-bold" />
                                            Transaction Overview
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="text-[11px] font-black text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Edit3 size={12} />
                                            <span>Edit Details</span>
                                        </button>
                                    </div>

                                    {/* Amount Callout */}
                                    {requiresAmount && (
                                        <div className={`p-3 rounded-2xl text-center space-y-0.5 border-2 ${currentTabObj.bgGlow} ${currentTabObj.borderColor}`}>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-black">
                                                {currentTabObj.label} Amount
                                            </p>
                                            <p className="text-2xl font-black text-black tracking-tight">
                                                ₹ {parseFloat(formData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    )}

                                    {/* Parameter Summary List */}
                                    <div className="space-y-1.5 text-xs bg-slate-100 p-2.5 rounded-2xl border border-slate-200 font-bold text-black">
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                            <span className="text-slate-700 font-bold text-[11px]">Service:</span>
                                            <strong className="text-black font-black uppercase text-[11px]">
                                                {currentTabObj.label}
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                            <span className="text-slate-700 font-bold text-[11px]">Customer Mobile:</span>
                                            <strong className="text-black font-black font-mono text-[11px]">
                                                +91 {formData.mobile}
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                            <span className="text-slate-700 font-bold text-[11px]">Identification:</span>
                                            <strong className="text-black font-black font-mono text-[11px]">
                                                XXXX-XXXX-{formData.aadhar.slice(-4)} ({idType})
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                            <span className="text-slate-700 font-bold text-[11px]">Bank:</span>
                                            <strong className="text-black font-black truncate max-w-[160px] text-right text-[11px]">
                                                {formData.bankName}
                                            </strong>
                                        </div>

                                        {formData.bankIin && (
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-slate-700 font-bold text-[11px]">Bank IIN:</span>
                                                <span className="font-mono text-[10px] font-black bg-white text-black px-2 py-0.5 rounded border border-slate-300">
                                                    {formData.bankIin}
                                                </span>
                                            </div>
                                        )}

                                        {txnOtpData.otp && (
                                            <div className="flex justify-between items-center py-1 border-t border-slate-200">
                                                <span className="text-slate-700 font-bold text-[11px]">Aadhaar OTP:</span>
                                                <span className="font-mono text-[10px] font-black bg-blue-100 text-blue-950 px-2 py-0.5 rounded border border-blue-300 flex items-center gap-1">
                                                    <Check size={10} className="text-blue-700" />
                                                    Verified (• • • • • •)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-black rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <ArrowLeft size={13} />
                                    <span>Back to Edit Details</span>
                                </button>
                            </div>

                            {/* Right Column: Biometric Capture & Execution (Span 7) */}
                            <div className="lg:col-span-7 bg-white/95 backdrop-blur-md border border-slate-300 shadow-sm rounded-3xl p-4 sm:p-5 space-y-3 flex flex-col justify-between h-full">
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                                        <div>
                                            <h3 className="text-xs font-black text-black uppercase tracking-tight flex items-center gap-1.5">
                                                <Fingerprint size={15} className="text-blue-700 font-bold" />
                                                Step 2: Biometric Authentication
                                            </h3>
                                            <p className="text-[10px] text-slate-700 font-bold">
                                                Scan customer fingerprint to authorize transaction
                                            </p>
                                        </div>
                                        <span className="px-2 py-0.5 bg-emerald-100 text-black text-[9px] font-black uppercase tracking-wider rounded-full border border-emerald-300">
                                            Step 2 of 2
                                        </span>
                                    </div>

                                    {/* Scanner Device Status */}
                                    <DeviceStatus />

                                    {/* Capture Controls */}
                                    <div className="space-y-2">
                                        <CaptureButton 
                                            onCaptureSuccess={handleFinalSubmit} 
                                            customPidOptions={
                                                txnOtpData.otp ? 
                                                `<PidOptions ver='1.0'> <Opts fCount='1' fType='2' iCount='0' iType='0' indicatorforUID='0' pCount='0' pType='0' format='0' pidVer='2.0' env='P' timeout='15000' otp='${txnOtpData.otp}' wadh='' posh='UNKNOWN'/> <Demo></Demo> <CustOpts> <Param name='' value=''/> </CustOpts> </PidOptions>`
                                                : null
                                            }
                                        />
                                        <CaptureLoader />
                                        <CaptureError />
                                        {!errorMsg && !loading && <CaptureSuccess />}
                                    </div>

                                    {/* Alerts */}
                                    {errorMsg && (
                                        <div className="bg-rose-100 border border-rose-300 text-rose-950 text-xs p-2.5 rounded-2xl flex items-center gap-2 font-black text-left">
                                            <AlertCircle className="text-rose-700 shrink-0" size={16} />
                                            <div className="text-xs leading-tight font-black">{errorMsg}</div>
                                        </div>
                                    )}

                                    {successMsg && (
                                        <div className="bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs p-2.5 rounded-2xl flex items-center gap-2 font-black text-left">
                                            <CheckCircle2 className="text-emerald-700 shrink-0" size={16} />
                                            <div className="text-xs leading-tight font-black">{successMsg}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Auto-Processing Status Indicator */}
                                <div>
                                    {loading ? (
                                        <div className="w-full py-3.5 px-4 rounded-2xl font-black uppercase tracking-wider text-xs bg-slate-950 text-white flex items-center justify-center gap-2 shadow-lg animate-pulse">
                                            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                                            <span>Processing AEPS Transaction with Bank Gateway...</span>
                                        </div>
                                    ) : (
                                        <div className="text-center py-2 px-3 bg-slate-100 border border-slate-200 rounded-2xl">
                                            <p className="text-[11px] text-black font-extrabold flex items-center justify-center gap-1.5">
                                                <Fingerprint size={14} className="text-blue-700 font-bold" />
                                                <span>Scan fingerprint above to auto-submit transaction</span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* Aadhaar OTP Verification Modal for Transactions > ₹5,000 */}
            <AadhaarOtpModal
                isOpen={showOtpModal}
                onClose={() => setShowOtpModal(false)}
                onVerifySuccess={(enteredOtp) => {
                    setTxnOtpData(prev => ({ ...prev, otp: enteredOtp }));
                    setShowOtpModal(false);
                    setCurrentStep(2);
                }}
                onResendOtp={triggerSendTxnOtp}
                txnDetails={{
                    amount: formData.amount,
                    mobile: formData.mobile,
                    aadhar: formData.aadhar,
                    bankName: formData.bankName,
                    serviceType: activeTab
                }}
                loading={otpLoading}
                error={otpError}
                fpTransactionId={txnOtpData.fpTransactionId}
            />

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
                            className="absolute right-5 top-5 text-slate-600 hover:text-black p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
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
