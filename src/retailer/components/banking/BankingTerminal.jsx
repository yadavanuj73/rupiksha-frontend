import React, { useState, useEffect } from 'react';
import { Landmark, ArrowRight, Fingerprint, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, KeyRound, Smartphone, Coins } from 'lucide-react';
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

export default function BankingTerminal({ provider, status, setStatus }) {
    const { captureState, status: rdStatus, device, error: rdError, captureResult, capture, reset } = useRD();

    // Available tabs depend on active provider
    // Fingpay supports Cash Deposit, Levin does not
    const isFingpay = provider === 'fingpay';
    const tabs = isFingpay
        ? [
            { id: 'CASH_DEPOSIT', label: 'Cash Deposit' },
            { id: 'CASH_WITHDRAWAL', label: 'Cash Withdrawal' },
            { id: 'BALANCE_INQUIRY', label: 'Balance Inquiry' },
            { id: 'MINI_STATEMENT', label: 'Mini Statement' },
            { id: 'AADHAAR_PAY', label: 'Aadhaar Pay' }
          ]
        : [
            { id: 'CASH_WITHDRAWAL', label: 'Cash Withdrawal' },
            { id: 'BALANCE_INQUIRY', label: 'Balance Inquiry' },
            { id: 'MINI_STATEMENT', label: 'Mini Statement' },
            { id: 'AADHAAR_PAY', label: 'Aadhaar Pay' }
          ];

    const [activeTab, setActiveTab] = useState(tabs[0].id);
    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    
    const [formData, setFormData] = useState({
        mobile: '',
        aadhar: '',
        bankId: '',
        bankName: '',
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
                banks.filter(b => b.bankName.toLowerCase().includes(query) || b.iinno.includes(query))
            );
        }
    }, [bankSearch, banks]);

    // Reset fields on tab change
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setFormData(prev => ({ ...prev, amount: '' }));
        setErrorMsg('');
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
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectBank = (bank) => {
        setFormData(prev => ({
            ...prev,
            bankId: bank.id,
            bankName: bank.bankName
        }));
        setBankSearch(bank.bankName);
        setShowBankDropdown(false);
    };

    const validateForm = () => {
        if (!formData.mobile || formData.mobile.length !== 10) {
            return "Please enter a valid 10-digit customer mobile number.";
        }
        if (!formData.aadhar || (formData.aadhar.length !== 12 && formData.aadhar.length !== 16)) {
            return "Please enter a valid 12-digit Aadhaar number or 16-digit Virtual ID.";
        }
        if (!formData.bankId) {
            return "Please select a bank from the list.";
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
            return "Fingerprint capture must be completed before submission.";
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
                deviceId: device ? device.serial : 'WEB-SCANNER-001',
                ipAddress: '127.0.0.1',
                provider: provider
            };

            const response = await aepsService.transact(payload);
            
            if (response.success && response.data) {
                const data = response.data;
                
                // Construct receipt properties
                const receipt = {
                    status: data.status,
                    message: response.message || 'Transaction Completed',
                    txnId: data.transactionId || 'N/A',
                    fpTxnId: data.providerReference || 'N/A',
                    bankRRN: data.providerReference || 'N/A', // fallback RRN
                    transactionAmount: requiresAmount ? parseFloat(formData.amount) : 0,
                    balanceAmount: data.amount || 0,
                    maskedAadhaar: 'XXXX-XXXX-' + formData.aadhar.slice(-4),
                    mobile: formData.mobile,
                    bankName: formData.bankName,
                    timestamp: new Date().toLocaleString(),
                    agentId: status.agentId || 'BC-TERMINAL'
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
        <div className="w-full font-['Inter',sans-serif]">
            {/* Upper Strategy Routing Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 border border-slate-100 rounded-3xl p-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Fingerprint size={28} className="text-blue-600" />
                        AEPS Banking Hub
                    </h1>
                    <p className="text-xs text-slate-500 font-semibold mt-1">
                        Active Terminal ID: <span className="text-slate-700 font-bold uppercase">{status.agentId}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Route Strategy:</span>
                    <span className="px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-full text-xs font-black uppercase tracking-wide">
                        {provider === 'fingpay' ? 'Fingpay (AEPS 1)' : 'Levin (AEPS 2)'}
                    </span>
                </div>
            </div>

            {/* Hub tabs selector */}
            <div className="flex border-b border-slate-100 mb-6 gap-2 overflow-x-auto pb-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition whitespace-nowrap cursor-pointer ${
                            activeTab === tab.id
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {activeTab === 'AADHAAR_PAY' && isFingpay && !status.ap2faDone ? (
                    <div className="lg:col-span-3 bg-white border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] rounded-3xl p-6 md:p-8">
                        <DailyAuthentication
                            provider={provider}
                            serviceType="AadhaarPay"
                            onSuccess={() => setStatus(prev => ({ ...prev, ap2faDone: true }))}
                            onBack={() => handleTabChange('CASH_WITHDRAWAL')}
                        />
                    </div>
                ) : (
                    <>
                        {/* Form Elements card */}
                        <div className="lg:col-span-2 space-y-6">
                            <form onSubmit={handleSubmit} className="bg-white border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] rounded-3xl p-6 md:p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Customer Mobile */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                            <Smartphone size={14} />
                                            Customer Mobile
                                        </label>
                                        <input
                                            type="text"
                                            name="mobile"
                                            maxLength="10"
                                            placeholder="Enter 10-digit mobile number"
                                            value={formData.mobile}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                            required
                                        />
                                    </div>

                                    {/* Customer Aadhaar / VID */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                            <KeyRound size={14} />
                                            Aadhaar / VID Number
                                        </label>
                                        <input
                                            type="password"
                                            name="aadhar"
                                            maxLength="16"
                                            placeholder="12-digit Aadhaar / 16-digit VID"
                                            value={formData.aadhar}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition tracking-widest"
                                            required
                                        />
                                    </div>

                                    {/* Bank details Searchable select */}
                                    <div className="space-y-2 relative">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                            <Landmark size={14} />
                                            Select Bank Name
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search bank name or IIN..."
                                                value={bankSearch}
                                                onChange={(e) => {
                                                    setBankSearch(e.target.value);
                                                    setShowBankDropdown(true);
                                                }}
                                                onFocus={() => setShowBankDropdown(true)}
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                                required
                                            />
                                            {formData.bankId && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                    Selected
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Dropdown overlay */}
                                        {showBankDropdown && filteredBanks.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-56 overflow-y-auto z-10 p-2 space-y-1">
                                                {filteredBanks.map(bank => (
                                                    <button
                                                        key={bank.id}
                                                        type="button"
                                                        onClick={() => handleSelectBank(bank)}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition flex justify-between"
                                                    >
                                                        <span>{bank.bankName}</span>
                                                        <span className="font-mono text-[10px] text-slate-400 font-semibold">{bank.iinno}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Amount input */}
                                    {requiresAmount && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                                <Coins size={14} />
                                                Transaction Amount
                                            </label>
                                            <input
                                                type="number"
                                                name="amount"
                                                placeholder="Enter amount (₹)"
                                                value={formData.amount}
                                                onChange={handleFormChange}
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Cash Denomination UI - ONLY FOR CASH DEPOSIT */}
                                {isDeposit && (
                                    <div className="border border-slate-100 rounded-3xl p-5 bg-slate-50/50 space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                            <Coins size={14} />
                                            Cash Denomination Registry
                                        </h3>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {[500, 200, 100, 50, 20, 10].map(denom => (
                                                <div key={denom} className="bg-white border border-slate-100 p-3 rounded-2xl flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-slate-400 w-8">₹{denom}</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="Count"
                                                        value={denominations[denom] || ''}
                                                        onChange={(e) => handleDenominationChange(e.target.value, denom)}
                                                        className="w-full text-right text-xs font-black text-slate-700 bg-slate-50 border-0 focus:ring-0 p-1.5 rounded-lg"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                                            <span className="font-semibold text-slate-400">Total Registered Cash:</span>
                                            <span className={`font-black ${formData.amount && parseFloat(formData.amount) === denominationSum ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                ₹{denominationSum.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* BC Declaration consent */}
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-3 items-start">
                                    <input
                                        type="checkbox"
                                        id="bcConsent"
                                        checked={bcConsent}
                                        onChange={(e) => setBcConsent(e.target.checked)}
                                        className="mt-1 rounded border-slate-200 text-blue-600 focus:ring-blue-500/20"
                                    />
                                    <label htmlFor="bcConsent" className="text-[10px] font-semibold leading-normal text-slate-400 cursor-pointer">
                                        I hereby declare that I have collected cash from the customer, verified the amount, completed the biometric authentication in my presence, and will provide an e-receipt to the customer. I confirm standard compliance SOP was strictly followed.
                                    </label>
                                </div>

                                {/* Error Displays */}
                                {errorMsg && (
                                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                        <AlertCircle className="text-rose-500 shrink-0" size={14} />
                                        <div>{errorMsg}</div>
                                    </div>
                                )}

                                {successMsg && (
                                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                        <CheckCircle2 className="text-emerald-500 shrink-0" size={14} />
                                        <div>{successMsg}</div>
                                    </div>
                                )}

                                {locError && (
                                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                                        <AlertCircle className="text-rose-500 shrink-0" size={14} />
                                        <div>{locError}</div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading || !bcConsent || !captureResult}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Processing transaction...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={16} />
                                            Submit Transaction
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Device Diagnostic Right Sidebar card */}
                        <div className="space-y-6">
                            <div className="bg-white border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] rounded-3xl p-6 space-y-6">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                        <Fingerprint size={14} />
                                        Biometric capture
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                        Validate customer Aadhaar fingerprint using Mantra local service agent.
                                    </p>
                                </div>

                                {/* Connected scanner status panel */}
                                <DeviceStatus />

                                {/* Capture triggers */}
                                {device && (
                                    <div className="pt-4 border-t border-slate-100 space-y-4">
                                        <CaptureButton />
                                        <CaptureLoader />
                                        <CaptureError />
                                        <CaptureSuccess />
                                    </div>
                                )}
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
