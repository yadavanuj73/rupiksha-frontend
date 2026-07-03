import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, ArrowLeft, Sparkles, UserCheck, AlertCircle, Compass, CheckCircle2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { aepsService } from '../../services/apiService';

export default function AepsOnboarding() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
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
        longitude: ''
    });

    useEffect(() => {
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
            setError("Geolocation is not supported by your browser.");
            return;
        }

        setDetectingGps(true);
        setError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: position.coords.latitude.toFixed(6),
                    longitude: position.coords.longitude.toFixed(6)
                }));
                setDetectingGps(false);
            },
            (err) => {
                console.error("Geolocation error", err);
                setError("Unable to retrieve GPS coordinates automatically. Please input manually or grant location access permissions.");
                setDetectingGps(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const validateStep1 = () => {
        if (!formData.fname.trim()) return "First name is required";
        if (!formData.lname.trim()) return "Last name is required";

        const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panPattern.test(formData.panCard.toUpperCase())) {
            return "Invalid PAN card format (Must match standard e.g. ABCDE1234F)";
        }

        const aadhaarPattern = /^\d{12}$/;
        if (!aadhaarPattern.test(formData.aadharNumber)) {
            return "Aadhaar number must be exactly 12 digits";
        }

        const mobilePattern = /^[6-9]\d{9}$/;
        if (!mobilePattern.test(formData.aepsMobile)) {
            return "Mobile number must be exactly 10 digits starting with 6-9";
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(formData.email)) {
            return "Invalid email address format";
        }

        return null;
    };

    const validateStep2 = () => {
        if (!formData.shopName.trim()) return "Shop name is required";
        if (!formData.address.trim()) return "Shop address is required";

        const pinPattern = /^\d{6}$/;
        if (!pinPattern.test(formData.pinCode)) {
            return "Pincode must be exactly 6 digits";
        }

        if (!formData.city.trim()) return "City is required";
        if (!formData.state.trim()) return "State code is required (e.g. BR, MH, UP)";
        if (!formData.latitude.trim() || !formData.longitude.trim()) {
            return "GPS Coordinates are required. Please click 'Detect GPS'.";
        }

        return null;
    };

    const handleNext = (e) => {
        e.preventDefault();
        setError('');
        const step1Err = validateStep1();
        if (step1Err) {
            setError(step1Err);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        const step2Err = validateStep2();
        if (step2Err) {
            setError(step2Err);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setLoading(true);
        try {
            const correlationId = `corr_${Date.now()}`;
            const payload = {
                ...formData,
                panCard: formData.panCard.toUpperCase(),
                correlationId,
                timestamp: Date.now()
            };

            await aepsService.onboard(payload);

            setSuccessMsg("Merchant Onboarding completed successfully! Agent profile registered. Redirecting to dashboard...");
            setTimeout(() => {
                navigate('/aeps-2');
            }, 3000);
        } catch (err) {
            console.error("Onboarding submission failed", err);
            setError(err.message || "Onboarding execution failed. Please verify credentials and network parameters.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] py-12 px-4 flex justify-center items-center font-['Inter',sans-serif]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 shadow-[0_15px_40px_rgb(0,0,0,0.03)] rounded-3xl w-full max-w-4xl overflow-hidden relative"
            >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />

                {/* Main Content Area */}
                <div className="p-8 md:p-12">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition mb-3"
                            >
                                <ArrowLeft size={14} />
                                Go Back
                            </button>
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                <Landmark className="text-blue-600" size={32} />
                                AEPS Merchant Onboarding
                            </h1>
                            <p className="text-slate-500 text-sm mt-1.5 font-medium leading-relaxed">
                                Complete your one-time onboarding form to register your retail merchant account.
                            </p>
                        </div>
                    </div>

                    {/* Step Progress Indicator */}
                    <div className="flex items-center justify-between gap-2 mb-8 bg-slate-50 border border-slate-100/80 rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${step === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-emerald-100 text-emerald-700 font-bold'}`}>
                                {step > 1 ? '✓' : '1'}
                            </span>
                            <span className={`text-xs font-bold uppercase tracking-wider ${step === 1 ? 'text-slate-700' : 'text-slate-400'}`}>Personal Details</span>
                        </div>
                        <div className="flex-1 h-0.5 bg-slate-200 mx-3 rounded-full overflow-hidden">
                            <div className={`h-full bg-blue-600 transition-all duration-500 ${step === 2 ? 'w-full' : 'w-0'}`} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${step === 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}`}>
                                2
                            </span>
                            <span className={`text-xs font-bold uppercase tracking-wider ${step === 2 ? 'text-slate-700' : 'text-slate-400'}`}>Shop & Location</span>
                        </div>
                    </div>

                    {/* Messages Banners */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3.5 mb-6 text-sm font-semibold shadow-sm"
                            >
                                <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                                <div>{error}</div>
                            </motion.div>
                        )}
                        {successMsg && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-5 py-4 rounded-2xl flex items-start gap-3.5 mb-6 text-sm font-semibold shadow-sm"
                            >
                                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                                <div>{successMsg}</div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Onboarding Form */}
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {step === 1 && (
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-4 border-b border-slate-100 pb-2">
                                    01. Personal Identity Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">First Name *</label>
                                        <input
                                            type="text"
                                            name="fname"
                                            value={formData.fname}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="Enter First Name"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Middle Name</label>
                                        <input
                                            type="text"
                                            name="middlename"
                                            value={formData.middlename}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="Optional"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Last Name *</label>
                                        <input
                                            type="text"
                                            name="lname"
                                            value={formData.lname}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="Enter Last Name"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">PAN Card Number *</label>
                                        <input
                                            type="text"
                                            name="panCard"
                                            value={formData.panCard}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none uppercase transition"
                                            placeholder="E.g. ABCDE1234F"
                                            maxLength={10}
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Aadhaar Number *</label>
                                        <input
                                            type="text"
                                            name="aadharNumber"
                                            value={formData.aadharNumber}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="12 Digit Aadhaar"
                                            maxLength={12}
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">AEPS Mobile Number *</label>
                                        <input
                                            type="text"
                                            name="aepsMobile"
                                            value={formData.aepsMobile}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="10 Digit Mobile"
                                            maxLength={10}
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="E.g. agent@rupiksha.com"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-4 border-b border-slate-100 pb-2">
                                    02. Shop & Geographic Location
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Shop Name *</label>
                                        <input
                                            type="text"
                                            name="shopName"
                                            value={formData.shopName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="E.g. Shreenath Digital Hub"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Shop Full Address *</label>
                                        <textarea
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            rows={2}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none resize-none transition"
                                            placeholder="Shop No, Complex, Street Name, Landmark"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Pincode *</label>
                                        <input
                                            type="text"
                                            name="pinCode"
                                            value={formData.pinCode}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="6 Digit PIN Code"
                                            maxLength={6}
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">City *</label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="E.g. Patna"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">State Code *</label>
                                        <input
                                            type="text"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring focus:ring-blue-100 font-semibold text-slate-700 text-sm outline-none transition"
                                            placeholder="State (E.g. BR, MH, UP)"
                                            disabled={loading}
                                        />
                                    </div>

                                    {/* Geographic GPS Coordinates */}
                                    <div className="border border-dashed border-slate-200 bg-slate-50/50 p-4 rounded-2xl flex flex-col justify-center">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="text-slate-400" size={16} />
                                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">GPS Verification</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={detectLocation}
                                                disabled={detectingGps || loading}
                                                className="px-3.5 py-1.5 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-600 font-bold text-[10px] uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                            >
                                                <Compass className={`animate-spin ${detectingGps ? 'opacity-100' : 'hidden'}`} size={12} />
                                                {detectingGps ? 'Detecting...' : 'Detect GPS'}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3.5">
                                            <div>
                                                <input
                                                    type="text"
                                                    name="latitude"
                                                    value={formData.latitude}
                                                    onChange={handleChange}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-600 text-xs outline-none focus:border-blue-500 transition"
                                                    placeholder="Latitude"
                                                    disabled={loading}
                                                />
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    name="longitude"
                                                    value={formData.longitude}
                                                    onChange={handleChange}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-600 text-xs outline-none focus:border-blue-500 transition"
                                                    placeholder="Longitude"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit Actions */}
                        {step === 1 && (
                            <div className="flex gap-4 pt-6 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="flex-1 py-3.5 border border-slate-200 text-slate-500 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition cursor-pointer"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="flex-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    Next Step
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex gap-4 pt-6 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3.5 border border-slate-200 text-slate-500 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition cursor-pointer"
                                    disabled={loading}
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    className="flex-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Submitting Onboarding...
                                        </>
                                    ) : (
                                        <>
                                            <UserCheck size={16} />
                                            Complete Onboarding
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
