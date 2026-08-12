import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, ArrowLeft, Sparkles, UserCheck, AlertCircle, Compass, CheckCircle2, MapPin, Upload, Camera, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { aepsService, userService } from '../../services/apiService';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';

export default function AepsOnboarding() {
    const navigate = useNavigate();
    const query = new URLSearchParams(window.location.search);
    const provider = query.get('provider') || 'fingpay';
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [serviceDisabled, setServiceDisabled] = useState(false);
    const [detectingGps, setDetectingGps] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [formData, setFormData] = useState({
        fname: '',
        middlename: '',
        lname: '',
        panCard: '',
        aadharNumber: '',
        aepsMobile: '',
        email: '',
        shopName: '',
        address: '',
        pinCode: '',
        city: '',
        state: '',
        latitude: '',
        longitude: '',
        companyType: 2, // Default to Individual / Sole Proprietor
        gstinNumber: '',
        panImage: '',
        shopImage: '',
        tradeBusinessProof: '',
        cancelledCheque: '',
        physicalVerificationImage: '',
        videoKycData: ''
    });

    const [recordingVideo, setRecordingVideo] = useState(false);
    const [videoTimer, setVideoTimer] = useState(0);

    useEffect(() => {
        const checkService = async () => {
            try {
                const services = await userService.getUserServices();
                if (services && services.AEPS === false) {
                    setServiceDisabled(true);
                }
            } catch (e) {
                console.warn("Could not check service enablement", e);
            }
        };
        checkService();

        const rawUser = localStorage.getItem('rupiksha_imp_user') || localStorage.getItem('rupiksha_user');
        if (rawUser) {
            try {
                const parsed = JSON.parse(rawUser);
                setFormData(prev => ({
                    ...prev,
                    aepsMobile: parsed.mobile || '',
                    email: parsed.email || '',
                    fname: parsed.fullName ? parsed.fullName.split(' ')[0] : '',
                    lname: parsed.fullName && parsed.fullName.split(' ').length > 1 ? parsed.fullName.split(' ').slice(1).join(' ') : ''
                }));
            } catch (e) {
                console.error("Failed to parse user session metadata", e);
            }
        }

        // Auto-detect GPS silently on page load
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFormData(prev => ({
                        ...prev,
                        latitude: position.coords.latitude.toFixed(6),
                        longitude: position.coords.longitude.toFixed(6)
                    }));
                },
                () => {
                    console.warn("GPS auto-detection failed or denied. Default coordinates will be used.");
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const detectLocation = () => {
        if (!navigator.geolocation) {
            setError('Browser does not support automatic Geolocation.');
            return;
        }
        setDetectingGps(true);
        setError('');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: String(pos.coords.latitude),
                    longitude: String(pos.coords.longitude)
                }));
                setDetectingGps(false);
                setSuccessMsg('Location captured successfully via GPS.');
                setTimeout(() => setSuccessMsg(''), 4000);
            },
            (err) => {
                setDetectingGps(false);
                setError('GPS capture failed: ' + err.message + '. Please enter manually or allow location access.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const validateStep1 = () => {
        if (!formData.fname.trim()) return "First name is required";
        if (!formData.lname.trim()) return "Last name is required";
        const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panPattern.test(formData.panCard.toUpperCase())) return "Invalid PAN card format";
        const aadhaarPattern = /^\d{12}$/;
        if (!aadhaarPattern.test(formData.aadharNumber)) return "Aadhaar number must be 12 digits";
        const mobilePattern = /^[6-9]\d{9}$/;
        if (!mobilePattern.test(formData.aepsMobile)) return "Mobile number must be 10 digits";
        return null;
    };

    const validateStep2 = () => {
        if (!formData.shopName.trim()) return "Shop name is required";
        if (!formData.address.trim()) return "Address is required";
        if (!/^\d{6}$/.test(formData.pinCode)) return "Invalid Pincode";
        if (!formData.city.trim() || !formData.state) return "City and State are required";
        return null;
    };

    const validateStep3 = () => {
        if (provider === 'fingpay') {
            if (!formData.bankAccountName || !formData.bankAccountName.trim()) {
                return "Account holder name is required for bank settlement";
            }
            if (!formData.bankAccountNumber || !formData.bankAccountNumber.trim()) {
                return "Bank account number is required for settlement";
            }
            if (!/^\d{9,18}$/.test(formData.bankAccountNumber.trim())) {
                return "Bank account number must be between 9 and 18 digits";
            }
            if (!formData.ifscCode || !formData.ifscCode.trim()) {
                return "Bank IFSC code is required";
            }
            const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
            if (!ifscRegex.test(formData.ifscCode.trim())) {
                return "Invalid IFSC code format (e.g. IDIB000P107)";
            }
            if (!formData.bankName || !formData.bankName.trim()) {
                return "Bank name is required";
            }
        }
        return null;
    };

    const handleNext = (e) => {
        e.preventDefault();
        setError('');
        if (step === 1) {
            const err = validateStep1();
            if (err) return setError(err);
            setStep(2);
        } else if (step === 2) {
            const err = validateStep2();
            if (err) return setError(err);
            if (provider === 'fingpay') setStep(3);
            else handleSubmit(e);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        if (step === 3 || provider !== 'fingpay') {
            const err = validateStep3();
            if (err) return setError(err);
        }
        setLoading(true);
        try {
            const correlationId = `corr_${Date.now()}`;
            const payload = {
                ...formData,
                panCard: formData.panCard.toUpperCase(),
                ifscCode: formData.ifscCode.toUpperCase(),
                provider,
                correlationId,
                timestamp: Date.now()
            };
            await aepsService.onboard(payload);
            setSuccessMsg('Fingpay Onboarding completed successfully! Redirecting to Biometric KYC...');
            setTimeout(() => {
                navigate(`/aeps-kyc?mobile=${encodeURIComponent(formData.aepsMobile)}&provider=${encodeURIComponent(provider)}`);
            }, 1500);
        } catch (err) {
            console.error("Onboarding submission error:", err);
            const msg = err.response?.data?.message || err.message || 'Onboarding failed. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (serviceDisabled) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
                <DisabledServiceBanner serviceName="AEPS Services" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-600 hover:text-blue-600 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold">
                        <Sparkles size={14} /> AEPS Onboarding Gateway
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
                >
                    <div className="bg-slate-900 text-white p-6 sm:p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
                                    <Landmark className="text-blue-400" size={24} />
                                    Fingpay Merchant Onboarding
                                </h1>
                                <p className="text-slate-400 text-xs mt-1">
                                    Complete merchant registration & bank settlement details for AEPS 1 transactions
                                </p>
                            </div>
                            <span className="hidden sm:inline-block px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
                                Provider: {provider.toUpperCase()}
                            </span>
                        </div>

                        <div className="mt-8 flex items-center justify-between max-w-lg mx-auto">
                            <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${step === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-emerald-100 text-emerald-700 font-bold'}`}>
                                    {step > 1 ? '✓' : '1'}
                                </span>
                                <span className={`text-xs font-bold uppercase tracking-wider ${step === 1 ? 'text-slate-700' : 'text-slate-400'}`}>Personal Details</span>
                            </div>
                            <div className="flex-1 h-0.5 bg-slate-800 mx-3 overflow-hidden">
                                <div className={`h-full bg-blue-600 transition-all duration-500 ${step >= 2 ? 'w-full' : 'w-0'}`} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${step === 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : step > 2 ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-100 text-slate-400'}`}>
                                    {step > 2 ? '✓' : '2'}
                                </span>
                                <span className={`text-xs font-bold uppercase tracking-wider ${step === 2 ? 'text-slate-700' : 'text-slate-400'}`}>Shop & Location</span>
                            </div>
                            {provider === 'fingpay' && (
                                <>
                                    <div className="flex-1 h-0.5 bg-slate-800 mx-3 overflow-hidden">
                                        <div className={`h-full bg-blue-600 transition-all duration-500 ${step === 3 ? 'w-full' : 'w-0'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${step === 3 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}`}>
                                            3
                                        </span>
                                        <span className={`text-xs font-bold uppercase tracking-wider ${step === 3 ? 'text-slate-700' : 'text-slate-400'}`}>Settlement Bank</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2"
                                >
                                    <AlertCircle size={16} className="shrink-0" />
                                    {error}
                                </motion.div>
                            )}
                            {successMsg && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold flex items-center gap-2"
                                >
                                    <CheckCircle2 size={16} className="shrink-0" />
                                    {successMsg}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {step === 1 && (
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-4 border-b border-slate-100 pb-2">
                                    01. Retailer Personal Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">First Name *</label>
                                        <input type="text" name="fname" value={formData.fname} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="First Name" disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Middle Name</label>
                                        <input type="text" name="middlename" value={formData.middlename} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="Middle Name (Optional)" disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Last Name *</label>
                                        <input type="text" name="lname" value={formData.lname} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="Last Name" disabled={loading} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">PAN Card Number *</label>
                                        <input type="text" name="panCard" value={formData.panCard} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none uppercase transition" placeholder="ABCDE1234F" maxLength={10} disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Aadhaar Number *</label>
                                        <input type="text" name="aadharNumber" value={formData.aadharNumber} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="12 Digit Aadhaar Number" maxLength={12} disabled={loading} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">AEPS Mobile Number *</label>
                                        <input type="text" name="aepsMobile" value={formData.aepsMobile} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="10 Digit Registered Mobile" maxLength={10} disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address *</label>
                                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="email@example.com" disabled={loading} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-4 border-b border-slate-100 pb-2">
                                    02. Shop & Location Details
                                </h3>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Shop / Business Legal Name *</label>
                                    <input type="text" name="shopName" value={formData.shopName} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="Shop / Enterprise Name" disabled={loading} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Shop Full Address *</label>
                                    <textarea name="address" value={formData.address} onChange={handleChange} rows={2} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="Complete outlet address..." disabled={loading} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Pincode *</label>
                                        <input type="text" name="pinCode" value={formData.pinCode} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="6 Digit Pincode" maxLength={6} disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">City / District *</label>
                                        <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="City" disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">State *</label>
                                        <select name="state" value={formData.state} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition bg-white" disabled={loading}>
                                            <option value="">Select State</option>
                                            <option value="ANDAMAN AND NICOBAR ISLANDS">Andaman and Nicobar Islands</option>
                                            <option value="ANDHRA PRADESH">Andhra Pradesh</option>
                                            <option value="ARUNACHAL PRADESH">Arunachal Pradesh</option>
                                            <option value="ASSAM">Assam</option>
                                            <option value="BIHAR">Bihar</option>
                                            <option value="CHANDIGARH">Chandigarh</option>
                                            <option value="CHHATTISGARH">Chhattisgarh</option>
                                            <option value="DADRA AND NAGAR HAVELI">Dadra and Nagar Haveli</option>
                                            <option value="DELHI">Delhi</option>
                                            <option value="GOA">Goa</option>
                                            <option value="GUJARAT">Gujarat</option>
                                            <option value="HARYANA">Haryana</option>
                                            <option value="HIMACHAL PRADESH">Himachal Pradesh</option>
                                            <option value="JAMMU AND KASHMIR">Jammu and Kashmir</option>
                                            <option value="JHARKHAND">Jharkhand</option>
                                            <option value="KARNATAKA">Karnataka</option>
                                            <option value="KERALA">Kerala</option>
                                            <option value="LAKSHADWEEP">Lakshadweep</option>
                                            <option value="MADHYA PRADESH">Madhya Pradesh</option>
                                            <option value="MAHARASHTRA">Maharashtra</option>
                                            <option value="MANIPUR">Manipur</option>
                                            <option value="MEGHALAYA">Meghalaya</option>
                                            <option value="MIZORAM">Mizoram</option>
                                            <option value="NAGALAND">Nagaland</option>
                                            <option value="ODISHA">Odisha</option>
                                            <option value="PUDUCHERRY">Puducherry</option>
                                            <option value="PUNJAB">Punjab</option>
                                            <option value="RAJASTHAN">Rajasthan</option>
                                            <option value="SIKKIM">Sikkim</option>
                                            <option value="TAMIL NADU">Tamil Nadu</option>
                                            <option value="TELANGANA">Telangana</option>
                                            <option value="TRIPURA">Tripura</option>
                                            <option value="UTTAR PRADESH">Uttar Pradesh</option>
                                            <option value="UTTARAKHAND">Uttarakhand</option>
                                            <option value="WEST BENGAL">West Bengal</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <Compass size={14} className="text-blue-600" /> GPS Geolocation (Latitude / Longitude)
                                        </label>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {formData.latitude && formData.longitude
                                                ? `Lat: ${formData.latitude}, Long: ${formData.longitude}`
                                                : 'Auto-detect coordinates for Fingpay outlet verification'}
                                        </p>
                                    </div>
                                    <button type="button" onClick={detectLocation} disabled={detectingGps || loading} className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer">
                                        {detectingGps ? 'Detecting...' : 'Detect GPS Coordinates'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && provider === 'fingpay' && (
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-4 border-b border-slate-100 pb-2">
                                    03. Settlement Bank Account Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Account Holder Name *</label>
                                        <input type="text" name="bankAccountName" value={formData.bankAccountName} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="Account Holder Full Name" disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank Account Number *</label>
                                        <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="9 to 18 Digit Account Number" maxLength={18} disabled={loading} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank Name *</label>
                                        <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition" placeholder="e.g. Indian Bank, HDFC Bank" disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank IFSC Code *</label>
                                        <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none uppercase transition" placeholder="11 Digit IFSC (e.g. IDIB000P107)" maxLength={11} disabled={loading} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">GSTIN Number (Optional)</label>
                                        <input type="text" name="gstinNumber" value={formData.gstinNumber} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none uppercase transition" placeholder="15 Digit GSTIN (Optional for Individual Retailer)" maxLength={15} disabled={loading} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="flex justify-end pt-6 border-t border-slate-100">
                                <button type="button" onClick={handleNext} className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/20 transition cursor-pointer">
                                    Next Step
                                </button>
                            </div>
                        )}
                        {step === 2 && (
                            <div className="flex gap-4 pt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3.5 border border-slate-200 text-slate-500 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition cursor-pointer">
                                    Back
                                </button>
                                {provider === 'fingpay' ? (
                                    <button type="button" onClick={handleNext} className="flex-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer">
                                        Next Step (Settlement Bank Details)
                                    </button>
                                ) : (
                                    <button type="submit" className="flex-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75" disabled={loading}>
                                        {loading ? <>Submitting...</> : <>Complete Onboarding</>}
                                    </button>
                                )}
                            </div>
                        )}
                        {step === 3 && provider === 'fingpay' && (
                            <div className="flex gap-4 pt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setStep(2)} className="flex-1 py-3.5 border border-slate-200 text-slate-500 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition cursor-pointer">
                                    Back
                                </button>
                                <button type="submit" className="flex-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75" disabled={loading}>
                                    {loading ? <>Submitting...</> : <>Complete Onboarding</>}
                                </button>
                            </div>
                        )}
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
