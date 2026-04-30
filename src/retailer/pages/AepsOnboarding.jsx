import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    User, MapPin, Building2, CreditCard, 
    CheckCircle2, ArrowLeft, ShieldCheck,
    Smartphone, Mail, Briefcase, Landmark, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../../services/dataService';
import { aepsService } from '../../services/apiService';
import logo from '../../assets/rupiksha_logo.png';

const AepsOnboarding = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [location, setLocation] = useState(null);
    const [onboardResult, setOnboardResult] = useState(null);
    
    const [formData, setFormData] = useState({
        fname: user?.fullName?.split(' ')[0] || '',
        middlename: '',
        lname: user?.fullName?.split(' ').slice(1).join(' ') || '',
        pan_card: user?.panNumber || '',
        aadhar_number: user?.aadhaarNumber || '',
        pinCode: user?.pincode || '',
        address: user?.address || '',
        aeps_mobile: user?.mobile || '',
        state: user?.state || 'BR',
        shop_name: user?.businessName || '',
        city: user?.city || '',
        latitude: '',
        longitude: '',
        email: user?.email || '',
        ad1: '',
        ad2: '',
        ad3: '',
        ad4: ''
    });

    useEffect(() => {
        dataService.verifyLocation()
            .then(loc => {
                setLocation(loc);
                setFormData(prev => ({
                    ...prev,
                    latitude: loc.lat,
                    longitude: loc.long
                }));
            })
            .catch(err => console.error("Location Tracking Error:", err));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        if (!formData.fname || !formData.lname || !formData.aadhar_number || !formData.pan_card) {
            alert("Please fill all required fields");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                latitude: location?.lat || '26.6745',
                longitude: location?.long || '84.9160'
            };

            const result = await aepsService.onboard(payload);
            setOnboardResult(result);
            
            if (result.statusId === 1) {
                // Save agent ID and merchant ID to user profile
                const updatedUser = {
                    ...user,
                    aepsAgentId: result.agentId,
                    merchantId: result.merchant_id,
                    aepsOnboarded: true
                };
                localStorage.setItem('rupiksha_user', JSON.stringify(updatedUser));
                setUser(updatedUser);
                setStep(2);
            } else {
                alert(result.message || "Onboarding failed. Please try again.");
            }
        } catch (err) {
            alert("Network error: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (step === 2 && onboardResult) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-12 text-center max-w-lg w-full">
                    <CheckCircle2 size={64} className="text-emerald-400 mx-auto mb-6" />
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">AEPS Onboarding Complete!</h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4">
                        Your AEPS agent account has been created successfully
                    </p>
                    
                    <div className="mt-8 bg-white/5 rounded-2xl p-6 text-left space-y-4">
                        <div className="flex justify-between">
                            <span className="text-slate-400 text-xs">Agent ID</span>
                            <span className="text-white font-black text-sm">{onboardResult.agentId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 text-xs">Merchant ID</span>
                            <span className="text-white font-black text-sm">{onboardResult.merchant_id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 text-xs">Status</span>
                            <span className="text-emerald-400 font-black text-sm">ACTIVE</span>
                        </div>
                    </div>
                    
                    <div className="mt-8 space-y-3">
                        <button onClick={() => navigate('/aeps-kyc')} 
                            className="w-full px-10 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-emerald-400 transition-all">
                            Complete KYC Verification
                        </button>
                        <button onClick={() => navigate('/dashboard')} 
                            className="w-full px-10 py-4 bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all">
                            Go to Dashboard
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f1f5f9] flex flex-col p-4 pb-24 font-sans">
            <div className="max-w-6xl mx-auto w-full">
                
                <div className="mb-10 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <button onClick={() => navigate('/dashboard')} 
                            className="w-12 h-12 bg-white shadow-xl hover:shadow-indigo-500/10 border-0 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mix-blend-multiply">
                                AEPS Onboarding
                            </h1>
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">
                                Register for AEPS Services via Levin API
                            </p>
                        </div>
                    </div>
                    <img src={logo} alt="Rupiksha" className="h-12 object-contain" />
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-0 overflow-hidden relative">
                    <div className="p-8 md:p-12 space-y-10">
                        
                        {/* Section 1: Personal Information */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 border-l-4 border-indigo-600 pl-4">
                                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">01 | Personal Details</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Input label="First Name *" name="fname" value={formData.fname} onChange={handleChange} required />
                                <Input label="Middle Name" name="middlename" value={formData.middlename} onChange={handleChange} />
                                <Input label="Last Name *" name="lname" value={formData.lname} onChange={handleChange} required />
                                <Input label="Mobile Number *" name="aeps_mobile" value={formData.aeps_mobile} onChange={handleChange} maxLength={10} required />
                                <Input label="Email *" type="email" name="email" value={formData.email} onChange={handleChange} required />
                                <Input label="PAN Card *" name="pan_card" value={formData.pan_card} onChange={handleChange} maxLength={10} required />
                            </div>
                        </div>

                        {/* Section 2: Aadhaar & Address */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 border-l-4 border-indigo-600 pl-4">
                                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">02 | Aadhaar & Address</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Input label="Aadhaar Number *" name="aadhar_number" value={formData.aadhar_number} onChange={handleChange} maxLength={12} required />
                                <Input label="Address *" name="address" value={formData.address} onChange={handleChange} required />
                                <Input label="Pincode *" name="pinCode" value={formData.pinCode} onChange={handleChange} maxLength={6} required />
                                <Input label="City *" name="city" value={formData.city} onChange={handleChange} required />
                                <Input label="State *" name="state" value={formData.state} onChange={handleChange} required />
                                <Input label="Shop Name *" name="shop_name" value={formData.shop_name} onChange={handleChange} required />
                            </div>
                        </div>

                        {/* Section 3: Location Data */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 border-l-4 border-indigo-600 pl-4">
                                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">03 | Geo Location</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input 
                                    label="Latitude" 
                                    name="latitude" 
                                    value={formData.latitude} 
                                    onChange={handleChange}
                                    placeholder={location?.lat || 'Auto-detected'}
                                />
                                <Input 
                                    label="Longitude" 
                                    name="longitude" 
                                    value={formData.longitude} 
                                    onChange={handleChange}
                                    placeholder={location?.long || 'Auto-detected'}
                                />
                            </div>
                            {!location && (
                                <p className="text-[10px] text-amber-600 font-bold">
                                    Please allow location access for NPCI compliance
                                </p>
                            )}
                        </div>

                        {/* Submit Section */}
                        <div className="pt-6 flex flex-col items-center gap-6">
                            <button 
                                type="submit" 
                                disabled={submitting || !location}
                                className="w-full max-w-lg py-6 bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.5em] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] hover:from-indigo-800 hover:to-indigo-700 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {submitting ? (
                                    <><RefreshCw className="animate-spin" size={20} /> PROCESSING...</>
                                ) : !location ? (
                                    <><MapPin size={20} /> ACQUIRING LOCATION...</>
                                ) : (
                                    <><ShieldCheck size={20} /> INITIATE ONBOARDING</>
                                )}
                            </button>
                            
                            <p className="text-[10px] text-slate-400 font-bold text-center max-w-md">
                                By submitting, you agree to NPCI AEPS terms and conditions. 
                                Your data will be processed through Levin Fintech API.
                            </p>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Components
const Input = ({ label, ...props }) => (
    <div className="space-y-2">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">
            {label}
        </label>
        <input 
            {...props} 
            className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] font-bold text-[13px] text-slate-800 focus:bg-white focus:border-indigo-500 hover:border-slate-300 outline-none transition-all placeholder:text-slate-300 shadow-sm" 
        />
    </div>
);

export default AepsOnboarding;
