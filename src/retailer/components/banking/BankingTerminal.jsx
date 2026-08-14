import React, { useState, useEffect } from 'react';
import { 
    Landmark, 
    ArrowRight, 
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
    Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRD } from '../../../hooks/useRD';
import DeviceStatus from '../../../components/DeviceStatus';
import CaptureButton from '../../../components/CaptureButton';
import CaptureLoader from '../../../components/CaptureLoader';
import CaptureError from '../../../components/CaptureError';
import CaptureSuccess from '../../../components/CaptureSuccess';
import { aepsService } from '../../../services/apiService';
import ReceiptModal from './ReceiptModal';
import DailyAuthentication from '../../../components/DailyAuthentication';

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
        amount: ''
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
        setFormData(prev => ({ ...prev, amount: '' }));
        setErrorMsg('');
        setSuccessMsg('');
        setBcConsent(false);
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
            setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 16) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
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

    const validateForm = () => {
        if (!formData.mobile || formData.mobile.length !== 10) {
            return "Please enter a valid 10-digit customer mobile number.";
        }
        if (!formData.aadhar || (formData.aadhar.length !== 12 && formData.aadhar.length !== 16)) {
            return "Please enter a valid 12-digit Aadhaar number or 16-digit Virtual ID.";
        }
        if (!formData.bankId && !formData.bankName) {
            return "Please select a customer bank from the list.";
        }
        if (requiresAmount) {
            const amt = parseFloat(formData.amount);
            if (isNaN(amt) || amt <= 0) {
                return "Please enter a valid transaction amount.";
            }
            if (isDeposit && amt !== denominationSum) {
                return `Denomination total (₹${denominationSum}) does not match the entered transaction amount (₹${formData.amount}).`;
            }
        }
        if (!bcConsent) {
            return "Please confirm standard compliance by ticking the BC declaration consent checkbox.";
        }
        if (!captureResult || !captureResult.pidXml) {
            return "Customer fingerprint capture must be completed using the scanner on the right.";
        }
        if (!location) {
            return "GPS lock is required. Please grant location permissions to continue.";
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        const validationError = validateForm();
        if (validationError) {
            setErrorMsg(validationError);
            return;
        }

        setLoading(true);
        try {
            const payload = {
                amount: requiresAmount ? parseFloat(formData.amount) : 0,
                serviceType: activeTab,
                bankName: formData.bankName,
                adhaarNumber: formData.aadhar,
                pidXml: captureResult.pidXml,
                biometricType: 'FMR',
                latitude: location.latitude,
                longitude: location.longitude,
                deviceId: device ? (device.serial || device.dpID || 'MANTRA-MFS110') : 'WEB-SCANNER-001',
                ipAddress: '127.0.0.1',
                provider: provider
            };

            const response = await aepsService.transact(payload);
            
            if (response.success && response.data) {
                const data = response.data;
                const activeTabObj = tabs.find(t => t.id === activeTab);
                
                // Construct receipt properties
                const receipt = {
                    status: data.status || (response.success ? 'SUCCESS' : 'FAILED'),
                    message: response.message || (response.success ? 'Transaction Completed' : 'Transaction Declined'),
                    txnId: data.transactionId || data.merchantTranId || ('TXN' + Date.now()),
                    fpTxnId: data.providerReference || data.fingpayTransactionId || 'N/A',
                    bankRRN: data.bankRrn || data.stan || data.providerReference || 'N/A',
                    transactionAmount: requiresAmount ? parseFloat(formData.amount) : 0,
                    balanceAmount: data.amount || data.balanceAmount || 0,
                    maskedAadhaar: 'XXXX-XXXX-' + (formData.aadhar.length >= 4 ? formData.aadhar.slice(-4) : 'XXXX'),
                    mobile: formData.mobile,
                    bankName: formData.bankName,
                    timestamp: new Date().toLocaleString(),
                    agentId: status.agentId || 'BC-TERMINAL',
                    serviceLabel: activeTabObj ? activeTabObj.label : 'AEPS Banking',
                    serviceType: activeTab
                };
                
                setReceiptData(receipt);
                setReceiptOpen(true);
                setSuccessMsg("Transaction processed successfully!");
                
                // Reset form fields
                setFormData({
                    mobile: '',
                    aadhar: '',
                    bankId: '',
                    bankName: '',
                    bankIin: '',
                    amount: ''
                });
                setBankSearch('');
                setBcConsent(false);
                setDenominations({
                    500: 0,
                    200: 0,
                    100: 0,
                    50: 0,
                    20: 0,
                    10: 0
                });
            } else {
                setErrorMsg(response.message || "Transaction declined.");
            }
        } catch (err) {
            console.error("AEPS Transaction execution failed", err);
            setErrorMsg(err.message || "Transaction submission failed. Please verify provider connectivity.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full text-left font-['Inter',sans-serif] space-y-6">
            {/* Upper Strategy Routing Header */}
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

            {/* Main Terminal Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {activeTab === 'AADHAAR_PAY' && isFingpay && !status.ap2faDone ? (
                    <div className="lg:col-span-3 bg-white border border-slate-200/80 shadow-sm rounded-3xl p-8 text-center max-w-xl mx-auto">
                        <DailyAuthentication
                            provider={provider}
                            serviceType="AadhaarPay"
                            onSuccess={() => setStatus(prev => ({ ...prev, ap2faDone: true }))}
                            onBack={() => handleTabChange('CASH_WITHDRAWAL')}
                        />
                    </div>
                ) : (
                    <>
                        {/* Form Card (2-Columns on large screen) */}
                        <div className="lg:col-span-2 space-y-6">
                            <form onSubmit={handleSubmit} className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div>
                                        <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
                                            {tabs.find(t => t.id === activeTab)?.label}
                                        </h2>
                                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                            Enter customer details and transaction parameters
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                                        Step 1: Input Data
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Customer Mobile Number */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Smartphone size={14} className="text-blue-600" />
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
                                            placeholder="e.g. 9876543210"
                                            value={formData.mobile}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                            required
                                        />
                                    </div>

                                    {/* Customer Aadhaar / VID Number */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <KeyRound size={14} className="text-blue-600" />
                                                Aadhaar / VID Number
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400">
                                                {formData.aadhar.length}/12
                                            </span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showAadhaar ? "text" : "password"}
                                                name="aadhar"
                                                maxLength="16"
                                                placeholder="12-digit Aadhaar Number"
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
                                    </div>
                                </div>

                                {/* Bank Selection Section */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Landmark size={14} className="text-blue-600" />
                                            Customer Bank
                                        </span>
                                        {formData.bankName && (
                                            <button
                                                type="button"
                                                onClick={clearSelectedBank}
                                                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider"
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
                                                placeholder="Or search bank name or 6-digit IIN..."
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
                                                <span>Selected: <strong>{formData.bankName}</strong></span>
                                            </div>
                                            {formData.bankIin && (
                                                <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                                    IIN {formData.bankIin}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Transaction Amount Section (when required) */}
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
                                                    min="1"
                                                    max="10000"
                                                    step="1"
                                                    placeholder="Enter amount"
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

                                {/* Cash Denomination UI - ONLY FOR CASH DEPOSIT */}
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

                                        {formData.amount && parseFloat(formData.amount) !== denominationSum && (
                                            <p className="text-[11px] font-bold text-amber-600">
                                                ⚠️ Note breakdown (₹{denominationSum}) does not match entered amount (₹{formData.amount}).
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* BC Declaration consent */}
                                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3 items-start">
                                    <input
                                        type="checkbox"
                                        id="bcConsent"
                                        checked={bcConsent}
                                        onChange={(e) => setBcConsent(e.target.checked)}
                                        className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="bcConsent" className="text-xs font-semibold leading-relaxed text-slate-600 cursor-pointer">
                                        I confirm that the customer is physically present at the outlet, customer consent has been obtained, and biometric authentication was conducted as per RBI & NPCI BC guidelines.
                                    </label>
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

                                {locError && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                        <AlertCircle className="text-amber-500 shrink-0" size={16} />
                                        <div>{locError}</div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading || !bcConsent || !captureResult}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/25 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Executing {tabs.find(t => t.id === activeTab)?.label}...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={18} />
                                            Submit {tabs.find(t => t.id === activeTab)?.label}
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Device & Biometric Scanner Panel (Right Column) */}
                        <div className="space-y-6">
                            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 space-y-6 sticky top-6">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                            <Fingerprint size={16} className="text-blue-600" />
                                            Customer Biometric Capture
                                        </h3>
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-full">
                                            Step 2
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                                        Instruct the customer to place their finger on the Mantra scanner and click Capture below.
                                    </p>
                                </div>

                                {/* Scanner Status */}
                                <DeviceStatus />

                                {/* Capture Controls */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <CaptureButton />
                                    <CaptureLoader />
                                    <CaptureError />
                                    <CaptureSuccess />
                                </div>

                                {/* Checklist / Status Info */}
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-semibold text-slate-500 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span>Customer Mobile:</span>
                                        <strong className={formData.mobile.length === 10 ? "text-emerald-600" : "text-slate-400"}>
                                            {formData.mobile.length === 10 ? "✓ Entered" : "Pending"}
                                        </strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Customer Aadhaar:</span>
                                        <strong className={formData.aadhar.length === 12 ? "text-emerald-600" : "text-slate-400"}>
                                            {formData.aadhar.length === 12 ? "✓ Entered" : "Pending"}
                                        </strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Selected Bank:</span>
                                        <strong className={formData.bankName ? "text-emerald-600" : "text-slate-400"}>
                                            {formData.bankName ? "✓ Selected" : "Pending"}
                                        </strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Biometric Scan:</span>
                                        <strong className={captureResult ? "text-emerald-600" : "text-amber-500"}>
                                            {captureResult ? "✓ Scan Ready" : "Awaiting Scan"}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Receipt Modal Overlay */}
            <ReceiptModal
                isOpen={receiptOpen}
                onClose={() => setReceiptOpen(false)}
                txnData={receiptData}
            />
        </div>
    );
}
