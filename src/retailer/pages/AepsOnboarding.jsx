import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, MapPin, Building2, CheckCircle2, ArrowLeft,
    ShieldCheck, RefreshCw, ChevronRight, Camera,
    CreditCard, Landmark, FileText, Upload
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../../services/dataService';
import { aepsService } from '../../services/apiService';
import logo from '../../assets/rupiksha_logo.png';

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
    const [location, setLocation] = useState(null);
    const [onboardResult, setOnboardResult] = useState(null);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        // Step 1 — Personal
        fname: user?.fullName?.split(' ')[0] || '',
        middlename: '',
        lname: user?.fullName?.split(' ').slice(1).join(' ') || '',
        aeps_mobile: user?.mobile || '',
        email: user?.email || '',
        pan_card: user?.panNumber || '',
        aadhar_number: user?.aadhaarNumber || '',
        // Step 2 — Shop & Address
        address: user?.address || '',       // permanent address (ad1)
        ad2: '',                            // area/landmark
        city: user?.city || '',
        state: user?.state || 'Uttar Pradesh',
        pinCode: user?.pincode || '',
        shop_name: user?.businessName || '',
        ad3: '',                            // shop address line
        ad4: '',                            // shop city/area
        // geo
        latitude: '',
        longitude: '',
    });

    const [files, setFiles] = useState({
        panImage: null,
        shopImage: null,
        chequeImage: null,
    });

    useEffect(() => {
        navigator.geolocation?.getCurrentPosition(
            (pos) => {
                const loc = { lat: String(pos.coords.latitude), long: String(pos.coords.longitude) };
                setLocation(loc);
                setFormData(prev => ({ ...prev, latitude: loc.lat, longitude: loc.long }));
            },
            () => {
                // fallback — allow submission without GPS
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

    const handleFileChange = (e) => {
        const { name, files: f } = e.target;
        if (f && f[0]) {
            const reader = new FileReader();
            reader.onloadend = () => setFiles(prev => ({ ...prev, [name]: reader.result }));
            reader.readAsDataURL(f[0]);
        }
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
            const payload = {
                fname: formData.fname.trim(),
                middlename: formData.middlename.trim(),
                lname: formData.lname.trim(),
                pan_card: formData.pan_card.trim().toUpperCase(),
                aadhar_number: formData.aadhar_number.trim(),
                pinCode: formData.pinCode.trim(),
                address: formData.address.trim(),
                aeps_mobile: formData.aeps_mobile.trim(),
                state: formData.state.trim(),
                shop_name: formData.shop_name.trim(),
                city: formData.city.trim(),
                latitude: formData.latitude || location?.lat || '26.8467',
                longitude: formData.longitude || location?.long || '80.9462',
                email: formData.email.trim(),
                ad1: formData.address.trim(),
                ad2: formData.ad2.trim(),
                ad3: formData.ad3.trim() || formData.shop_name.trim(),
                ad4: formData.ad4.trim() || formData.city.trim(),
            };

            const result = await aepsService.onboard(payload);
            setOnboardResult(result);

            if (result?.statusId === 1) {
                const updatedUser = {
                    ...user,
                    aepsAgentId: result.agentId,
                    merchantId: result.merchant_id,
                    aepsOnboarded: true,
                };
                localStorage.setItem('rupiksha_user', JSON.stringify(updatedUser));
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
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/dashboard')}
                        className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-600 transition-all">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">AEPS Retailer Onboarding</h1>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Powered by Levin Fintech API</p>
                    </div>
                </div>
                <img src={logo} alt="Rupiksha" className="h-9 object-contain" />
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
                                <SectionHeader icon={<Building2 size={16} />} title="Shop & Address Details" sub="Permanent address + shop location" />
                                <Field label="Shop / Business Name *" name="shop_name" value={formData.shop_name} onChange={handleChange} error={errors.shop_name} placeholder="Your shop name" />
                                <Field label="Permanent Address (Street / Premise) *" name="address" value={formData.address} onChange={handleChange} error={errors.address} placeholder="House No, Street, Area" />
                                <Field label="Area / Landmark" name="ad2" value={formData.ad2} onChange={handleChange} placeholder="Nearby landmark (optional)" />
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
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Shop Location (if different from above)</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                        <Field label="Shop Address Line" name="ad3" value={formData.ad3} onChange={handleChange} placeholder="Same as above if blank" />
                                        <Field label="Shop City / Area" name="ad4" value={formData.ad4} onChange={handleChange} placeholder="Same as above if blank" />
                                    </div>
                                </div>
                                {location && (
                                    <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold">
                                        <MapPin size={12} /> GPS location acquired: {parseFloat(formData.latitude).toFixed(4)}, {parseFloat(formData.longitude).toFixed(4)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEP 3: Documents & Submit ── */}
                        {step === 3 && (
                            <form onSubmit={handleSubmit}>
                                <div className="p-6 space-y-5">
                                    <SectionHeader icon={<FileText size={16} />} title="Upload Documents" sub="Required for AEPS onboarding verification" />
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                        <DocUpload label="PAN Card Photo *" name="panImage" icon={<CreditCard size={22} className="text-blue-500" />} value={files.panImage} onChange={handleFileChange} />
                                        <DocUpload label="Shop Photo *" name="shopImage" icon={<Building2 size={22} className="text-indigo-500" />} value={files.shopImage} onChange={handleFileChange} />
                                        <DocUpload label="Cancelled Cheque *" name="chequeImage" icon={<Landmark size={22} className="text-emerald-500" />} value={files.chequeImage} onChange={handleFileChange} />
                                    </div>

                                    {/* Summary */}
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-[11px]">
                                        <p className="font-black text-slate-700 uppercase tracking-widest text-[10px] mb-3">Review Details</p>
                                        <Row label="Name" value={`${formData.fname} ${formData.middlename} ${formData.lname}`.trim()} />
                                        <Row label="Mobile" value={formData.aeps_mobile} />
                                        <Row label="PAN" value={formData.pan_card.toUpperCase()} />
                                        <Row label="Aadhaar" value={`XXXX XXXX ${formData.aadhar_number.slice(-4)}`} />
                                        <Row label="Shop" value={formData.shop_name} />
                                        <Row label="City / State" value={`${formData.city}, ${formData.state} - ${formData.pinCode}`} />
                                    </div>

                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input type="checkbox" required className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300" />
                                        <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-700 transition-colors leading-relaxed">
                                            I confirm that all provided details are accurate and authentic. I agree to the AEPS compliance framework as defined by Levin Fintech - Rupiksha.
                                        </span>
                                    </label>

                                    <button type="submit" disabled={submitting}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                                        {submitting ? <><RefreshCw size={16} className="animate-spin" /> Processing...</> : <><ShieldCheck size={16} /> Initiate AEPS Onboarding</>}
                                    </button>
                                    <p className="text-[10px] text-slate-400 font-semibold text-center">
                                        Data processed securely via Levin Fintech AEPS API. NPCI compliant.
                                    </p>
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

const DocUpload = ({ label, name, icon, value, onChange }) => (
    <div className="flex flex-col items-center gap-2">
        <div className={`relative w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all overflow-hidden cursor-pointer
            ${value ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50 bg-slate-50'}`}>
            <input type="file" name={name} accept="image/*" onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" />
            {value ? (
                <>
                    <img src={value} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" />
                    <CheckCircle2 size={28} className="text-emerald-500 relative z-10" />
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest relative z-10">Uploaded</p>
                </>
            ) : (
                <>
                    {icon}
                    <Upload size={14} className="text-slate-400" />
                    <p className="text-[9px] font-bold text-slate-400 text-center px-2">{label}</p>
                </>
            )}
        </div>
        <p className="text-[10px] font-bold text-slate-500 text-center">{label}</p>
    </div>
);

export default AepsOnboarding;
