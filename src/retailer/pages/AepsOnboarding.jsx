import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, MapPin, Building2, CheckCircle2, ArrowLeft,
    ShieldCheck, RefreshCw, ChevronRight, FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { aepsService } from '../../services/apiService';

const STATE_CODES = {
    "Jammu and Kashmir":"JK","Himachal Pradesh":"HP","Punjab":"PB","Chandigarh":"CH",
    "Uttarakhand":"UA","Haryana":"HR","Delhi":"DL","Rajasthan":"RJ","Uttar Pradesh":"UP",
    "Bihar":"BR","Sikkim":"SK","Arunachal Pradesh":"AR","Nagaland":"NL","Manipur":"MN",
    "Mizoram":"MZ","Tripura":"TR","Meghalaya":"ML","Assam":"AS","West Bengal":"WB",
    "Jharkhand":"JH","Odisha":"OR","Chhattisgarh":"CG","Madhya Pradesh":"MP",
    "Gujarat":"GJ","Daman and Diu":"DD","Dadra and Nagar Haveli":"DN","Maharashtra":"MH",
    "Andhra Pradesh":"AP","Karnataka":"KA","Goa":"GA","Lakshadweep":"LD","Kerala":"KL",
    "Tamil Nadu":"TN","Puducherry":"PY","Andaman and Nicobar Islands":"AN",
    "Telangana":"TS"
};

const INDIAN_STATES = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
    "Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir",
    "Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra",
    "Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
    "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
    "Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Puducherry",
    "Chandigarh","Dadra and Nagar Haveli","Daman and Diu","Lakshadweep",
    "Andaman and Nicobar Islands"
].sort();

const STEPS = [
    { id: 1, label: 'Personal Details', icon: User },
    { id: 2, label: 'Shop & Address', icon: Building2 },
    { id: 3, label: 'Documents & Submit', icon: FileText },
];

const AepsOnboarding = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [checking, setChecking] = useState(true);
    const [location, setLocation] = useState(null);
    const [onboardResult, setOnboardResult] = useState(null);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        // Step 1 — Personal
        fname: '',
        middlename: '',
        lname: '',
        aeps_mobile: user?.mobile || '',
        email: user?.email || '',
        pan_card: user?.panNumber || '',
        aadhar_number: user?.aadhaarNumber || '',
        // Step 2 — Shop & Address
        address: user?.address || '',
        city: user?.city || '',
        state: user?.state || 'Uttar Pradesh',
        pinCode: user?.pincode || '',
        shop_name: user?.businessName || '',
        // geo (auto-detected)
        latitude: '',
        longitude: '',
    });

    // Check DB for existing onboarding status on mount
    useEffect(() => {
        const checkOnboardingStatus = async () => {
            try {
                // Fast path: check localStorage first
                const impUser = localStorage.getItem('rupiksha_imp_user');
                const normalUser = localStorage.getItem('rupiksha_user');
                const storedUser = impUser ? JSON.parse(impUser) : (normalUser ? JSON.parse(normalUser) : null);
                
                if (storedUser?.aepsOnboarded === true && storedUser?.aepsAgentId) {
                    navigate('/aeps');
                    return;
                }

                // Get mobile from multiple possible sources
                const mobile = user?.mobile || user?.phone || storedUser?.mobile || storedUser?.phone;
                if (!mobile) { setChecking(false); return; }

                const status = await aepsService.checkStatus(mobile);
                if (status?.onboarded) {
                    // Already onboarded — update correct localStorage and redirect
                    const updatedUser = {
                        ...(storedUser || user),
                        aepsAgentId: status.agentId,
                        merchantId: status.merchantId,
                        aepsOnboarded: true,
                    };
                    if (impUser) {
                        localStorage.setItem('rupiksha_imp_user', JSON.stringify(updatedUser));
                    } else {
                        localStorage.setItem('rupiksha_user', JSON.stringify(updatedUser));
                    }
                    setUser(updatedUser);
                    navigate('/aeps');
                    return;
                }
            } catch (e) {
                // If status check fails, just show the form
            } finally {
                setChecking(false);
            }
        };
        checkOnboardingStatus();
    }, []);

    useEffect(() => {
        navigator.geolocation?.getCurrentPosition(
            (pos) => {
                const loc = { lat: String(pos.coords.latitude), long: String(pos.coords.longitude) };
                setLocation(loc);
                setFormData(prev => ({ ...prev, latitude: loc.lat, longitude: loc.long }));
            },
            () => {
                setLocation({ lat: '26.8467', long: '80.9462' });
                setFormData(prev => ({ ...prev, latitude: '26.8467', longitude: '80.9462' }));
            }
        );
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateStep1 = () => {
        const e = {};
        if (!formData.fname.trim()) e.fname = 'Required';
        if (!formData.lname.trim()) e.lname = 'Required';
        if (!/^\d{10}$/.test(formData.aeps_mobile)) e.aeps_mobile = 'Enter valid 10-digit mobile';
        if (!formData.email.trim()) e.email = 'Required';
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(formData.pan_card.toUpperCase())) e.pan_card = 'Enter valid PAN (e.g. ABCDE1234F)';
        if (!/^\d{12}$/.test(formData.aadhar_number)) e.aadhar_number = 'Enter valid 12-digit Aadhaar';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const validateStep2 = () => {
        const e = {};
        if (!formData.address.trim()) e.address = 'Required';
        if (!formData.city.trim()) e.city = 'Required';
        if (!formData.state.trim()) e.state = 'Required';
        if (!/^\d{6}$/.test(formData.pinCode)) e.pinCode = 'Enter valid 6-digit pincode';
        if (!formData.shop_name.trim()) e.shop_name = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        setStep(s => s + 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Use GPS if available, otherwise use a default coordinate for the state
            // Levin validates lat/long — use registered address location not live GPS
            const STATE_COORDS = {
                'BR': { lat: '25.0961', lon: '85.3131' }, // Bihar
                'UP': { lat: '26.8467', lon: '80.9462' }, // Uttar Pradesh
                'DL': { lat: '28.6139', lon: '77.2090' }, // Delhi
                'MH': { lat: '19.7515', lon: '75.7139' }, // Maharashtra
                'RJ': { lat: '27.0238', lon: '74.2179' }, // Rajasthan
                'GJ': { lat: '22.2587', lon: '71.1924' }, // Gujarat
                'MP': { lat: '22.9734', lon: '78.6569' }, // Madhya Pradesh
                'WB': { lat: '22.9868', lon: '87.8550' }, // West Bengal
                'TN': { lat: '11.1271', lon: '78.6569' }, // Tamil Nadu
                'KA': { lat: '15.3173', lon: '75.7139' }, // Karnataka
                'AP': { lat: '15.9129', lon: '79.7400' }, // Andhra Pradesh
                'TS': { lat: '18.1124', lon: '79.0193' }, // Telangana
                'KL': { lat: '10.8505', lon: '76.2711' }, // Kerala
                'OR': { lat: '20.9517', lon: '85.0985' }, // Odisha
                'JH': { lat: '23.6102', lon: '85.2799' }, // Jharkhand
                'HR': { lat: '29.0588', lon: '76.0856' }, // Haryana
                'PB': { lat: '31.1471', lon: '75.3412' }, // Punjab
                'HP': { lat: '31.1048', lon: '77.1734' }, // Himachal Pradesh
                'UK': { lat: '30.0668', lon: '79.0193' }, // Uttarakhand
                'AS': { lat: '26.2006', lon: '92.9376' }, // Assam
                'CG': { lat: '21.2787', lon: '81.8661' }, // Chhattisgarh
            };

            const stateCode = STATE_CODES[formData.state.trim()] || formData.state.trim();
            const stateCoord = STATE_COORDS[stateCode] || { lat: '26.8467', lon: '80.9462' };

            const payload = {
                fname: formData.fname.trim(),
                middlename: formData.middlename.trim(),
                lname: formData.lname.trim(),
                pan_card: formData.pan_card.trim().toUpperCase(),
                aadhar_number: formData.aadhar_number.trim(),
                pinCode: formData.pinCode.trim(),
                address: formData.address.trim(),
                aeps_mobile: formData.aeps_mobile.trim(),
                state: stateCode,
                shop_name: formData.shop_name.trim(),
                city: formData.city.trim(),
                latitude: formData.latitude || stateCoord.lat,
                longitude: formData.longitude || stateCoord.lon,
                email: formData.email.trim(),
                ad1: formData.address.trim(),
                ad2: '',
                ad3: '',
                ad4: '',
            };

            const result = await aepsService.onboard(payload);
            setOnboardResult(result);

            if (result?.statusId === 1 || (result?.message && result.message.toLowerCase().includes('already'))) {
                const updatedUser = {
                    ...user,
                    aepsAgentId: result.agentId || ('RUP0' + formData.aeps_mobile.trim()),
                    merchantId: result.merchantId || '',
                    aepsOnboarded: true,
                };
                // Save to correct localStorage key
                const isImp = !!localStorage.getItem('rupiksha_imp_user');
                if (isImp) {
                    localStorage.setItem('rupiksha_imp_user', JSON.stringify(updatedUser));
                } else {
                    localStorage.setItem('rupiksha_user', JSON.stringify(updatedUser));
                }
                setUser(updatedUser);
                setStep(4); // success screen
            } else {
                alert(result?.message || 'Onboarding failed. Please check your details and try again.');
            }
        } catch (err) {
            alert('Network error: ' + (err?.message || 'Please try again'));
        } finally {
            setSubmitting(false);
        }
    };

    // Loading screen while checking DB status
    if (checking) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-semibold text-sm">Checking AEPS status...</p>
                </div>
            </div>
        );
    }

    // Success screen
    if (step === 4 && onboardResult) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center p-6">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl p-10 text-center max-w-md w-full shadow-2xl">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} className="text-emerald-500" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">AEPS Onboarding Complete!</h1>
                    <p className="text-slate-500 text-sm font-semibold mt-2">Your AEPS agent account has been created successfully.</p>
                    <div className="mt-6 bg-slate-50 rounded-2xl p-5 text-left space-y-3">
                        <Row label="Agent ID" value={onboardResult.agentId} />
                        <Row label="Merchant ID" value={onboardResult.merchant_id} />
                        <Row label="Status" value="ACTIVE" green />
                    </div>
                    <div className="mt-6 space-y-3">
                        <button onClick={() => navigate('/aeps')}
                            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all">
                            Go to AEPS Services
                        </button>
                        <button onClick={() => navigate('/dashboard')}
                            className="w-full py-3.5 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                            Dashboard
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between h-14">
                <div className="flex items-center gap-3">
                    <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/dashboard')}
                        className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 transition-all flex-shrink-0">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">AEPS Retailer Onboarding</h1>
                    </div>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="max-w-2xl mx-auto px-6 pt-8">
                <div className="flex items-center justify-between mb-8">
                    {STEPS.map((s, idx) => {
                        const Icon = s.icon;
                        const isActive = step === s.id;
                        const isDone = step > s.id;
                        return (
                            <React.Fragment key={s.id}>
                                <div className="flex flex-col items-center gap-2">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all font-black text-sm
                                        ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                        {isDone ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {s.label}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 mb-6 rounded-full transition-all ${step > s.id ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Form Card */}
                <AnimatePresence mode="wait">
                    <motion.div key={step}
                        initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        {/* ── STEP 1: Personal Details ── */}
                        {step === 1 && (
                            <div className="p-6 space-y-5">
                                <SectionHeader icon={<User size={16} />} title="Personal Details" sub="As per Aadhaar / PAN card" />
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <Field label="First Name *" name="fname" value={formData.fname} onChange={handleChange} error={errors.fname} placeholder="e.g. Rajesh" />
                                    <Field label="Middle Name" name="middlename" value={formData.middlename} onChange={handleChange} placeholder="Optional" />
                                    <Field label="Last Name *" name="lname" value={formData.lname} onChange={handleChange} error={errors.lname} placeholder="e.g. Kumar" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Mobile Number *" name="aeps_mobile" value={formData.aeps_mobile} onChange={handleChange} error={errors.aeps_mobile} placeholder="10-digit mobile" maxLength={10} />
                                    <Field label="Email Address *" type="email" name="email" value={formData.email} onChange={handleChange} error={errors.email} placeholder="your@email.com" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="PAN Card Number *" name="pan_card" value={formData.pan_card} onChange={e => handleChange({ target: { name: 'pan_card', value: e.target.value.toUpperCase() } })} error={errors.pan_card} placeholder="ABCDE1234F" maxLength={10} />
                                    <Field label="Aadhaar Number *" name="aadhar_number" value={formData.aadhar_number} onChange={handleChange} error={errors.aadhar_number} placeholder="12-digit Aadhaar" maxLength={12} />
                                </div>
                            </div>
                        )}

                        {/* ── STEP 2: Shop & Address ── */}
                        {step === 2 && (
                            <div className="p-6 space-y-5">
                                <SectionHeader icon={<Building2 size={16} />} title="Shop & Address Details" sub="As per business registration" />
                                <Field label="Shop / Business Name *" name="shop_name" value={formData.shop_name} onChange={handleChange} error={errors.shop_name} placeholder="Your shop name" />
                                <Field label="Address *" name="address" value={formData.address} onChange={handleChange} error={errors.address} placeholder="House No, Street, Area" />
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <Field label="City *" name="city" value={formData.city} onChange={handleChange} error={errors.city} placeholder="City name" />
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">State *</label>
                                        <select name="state" value={formData.state} onChange={handleChange}
                                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100">
                                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        {errors.state && <p className="text-[10px] text-red-500 font-bold">{errors.state}</p>}
                                    </div>
                                    <Field label="Pincode *" name="pinCode" value={formData.pinCode} onChange={handleChange} error={errors.pinCode} placeholder="6-digit PIN" maxLength={6} />
                                </div>
                                {location && (
                                    <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                                        <MapPin size={12} /> GPS acquired: {parseFloat(formData.latitude).toFixed(4)}, {parseFloat(formData.longitude).toFixed(4)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEP 3: Review & Submit ── */}
                        {step === 3 && (
                            <form onSubmit={handleSubmit}>
                                <div className="p-6 space-y-5">
                                    <SectionHeader icon={<FileText size={16} />} title="Review & Submit" sub="Confirm your details before submitting" />

                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-[12px]">
                                        <p className="font-black text-slate-500 uppercase tracking-widest text-[9px] mb-2">Personal Details</p>
                                        <Row label="Full Name" value={`${formData.fname} ${formData.middlename} ${formData.lname}`.replace(/\s+/g,' ').trim()} />
                                        <Row label="Mobile" value={formData.aeps_mobile} />
                                        <Row label="Email" value={formData.email} />
                                        <Row label="PAN" value={formData.pan_card.toUpperCase()} />
                                        <Row label="Aadhaar" value={`XXXX XXXX XXXX ${formData.aadhar_number.slice(-4)}`} />
                                        <hr className="border-slate-200 my-1" />
                                        <p className="font-black text-slate-500 uppercase tracking-widest text-[9px] mb-2">Shop & Address</p>
                                        <Row label="Shop Name" value={formData.shop_name} />
                                        <Row label="Address" value={formData.address} />
                                        <Row label="City" value={formData.city} />
                                        <Row label="State" value={formData.state} />
                                        <Row label="Pincode" value={formData.pinCode} />
                                        {location && <Row label="GPS" value={`${parseFloat(formData.latitude).toFixed(4)}, ${parseFloat(formData.longitude).toFixed(4)}`} />}
                                    </div>

                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input type="checkbox" required className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300" />
                                        <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-700 transition-colors leading-relaxed">
                                            I confirm that all details are accurate and I consent to AEPS registration under NPCI guidelines.
                                        </span>
                                    </label>

                                    <button type="submit" disabled={submitting}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                                        {submitting ? <><RefreshCw size={16} className="animate-spin" /> Processing...</> : <><ShieldCheck size={16} /> Submit Onboarding Request</>}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Navigation Footer (steps 1 & 2) */}
                        {step < 3 && (
                            <div className="px-6 pb-6">
                                <button type="button" onClick={handleNext}
                                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                                    Next: {STEPS[step].label} <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

// ── Sub-components ──
const SectionHeader = ({ icon, title, sub }) => (
    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">{icon}</div>
        <div>
            <p className="text-sm font-black text-slate-800">{title}</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{sub}</p>
        </div>
    </div>
);

const Field = ({ label, error, ...props }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{label}</label>
        <input {...props} className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-1 transition-all ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'}`} />
        {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
    </div>
);

const Row = ({ label, value, green }) => (
    <div className="flex justify-between items-center">
        <span className="text-slate-400 font-semibold">{label}</span>
        <span className={`font-black ${green ? 'text-emerald-600' : 'text-slate-700'}`}>{value || '—'}</span>
    </div>
);

export default AepsOnboarding;
