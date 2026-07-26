import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, Lock, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, 
  User, Mail, KeyRound, Sparkles, Send, RefreshCw, Upload, Image as ImageIcon, Building, MapPin, CreditCard, Camera, FileText,
  ChevronLeft, ChevronRight, Check, Users, Play, Pause
} from 'lucide-react';
import { authService, otpService, adminService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const logo = '/rupiksha logo.jpeg';

const INDIAN_STATES = [
  "BIHAR",
  "MAHARASHTRA",
  "UTTAR PRADESH",
  "DELHI",
  "WEST BENGAL",
  "RAJASTHAN",
  "PUNJAB",
  "HARYANA",
  "GUJARAT",
  "KARNATAKA",
  "TAMIL NADU",
  "TELANGANA",
  "ANDHRA PRADESH",
  "MADHYA PRADESH",
  "ODISHA",
  "JHARKHAND",
  "CHHATTISGARH",
  "ASSAM",
  "KERALA",
  "UTTARAKHAND",
  "HIMACHAL PRADESH",
  "JAMMU AND KASHMIR",
  "GOA",
  "MANIPUR",
  "MEGHALAYA",
  "MIZORAM",
  "NAGALAND",
  "SIKKIM",
  "TRIPURA",
  "ARUNACHAL PRADESH",
  "PUDUCHERRY",
  "CHANDIGARH",
  "LADAKH",
  "ANDAMAN AND NICOBAR ISLANDS",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "LAKSHADWEEP"
];

const PROMO_SLIDES = [
  {
    src: '/aeps_promo.png',
    title: 'AEPS & Aadhaar Withdrawals',
    badge: 'BANKING SERVICES',
    desc: 'Provide instant cash withdrawal, mini-statement & balance inquiry.'
  },
  {
    src: '/AEPS.png',
    title: 'Instant Cash Payout & Money Transfer',
    badge: 'INSTANT SETTLEMENT',
    desc: 'Direct account settlement and 24x7 IMPS money transfer across India.'
  },
  {
    src: '/mobile recharge.png',
    title: 'Mobile Recharge & BBPS Utility Bills',
    badge: 'BILL PAYMENTS',
    desc: 'High commission on mobile, DTH, electricity, water & gas bill payments.'
  },
  {
    src: '/rupiksha logo.jpeg',
    title: 'Rupiksha Partner Network',
    badge: 'JOIN 50K+ MERCHANTS',
    desc: 'Start your digital banking enterprise with instant auto-approval.'
  }
];

export default function RegisterWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: contextLogin } = useAuth();
  const { language: lang, setLanguage: setLang } = useLanguage();

  const [step, setStep] = useState(1); // 1: Mobile & Auth Info, 2: OTP Verification, 3: PIN, Business, KYC & Documents, 4: Auto Approval Success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);

  // Image Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  useEffect(() => {
    if (isCarouselPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % PROMO_SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isCarouselPaused]);

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % PROMO_SLIDES.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length);
  };

  // Form State
  const initialRole = (searchParams.get('role') || 'RETAILER').toUpperCase();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
    otp: '',
    pin: '',
    confirmPin: '',
    role: ['RETAILER', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR'].includes(initialRole) ? initialRole : 'RETAILER',
    state: 'BIHAR',
    city: '',
    pincode: '',
    address: '',
    shopAddress: '',
    permanentAddress: '',
    businessName: '',
    businessType: 'Retail Store',
    parentUserId: '',
    dob: '',
    fatherName: '',
    gender: 'Male',
    gstNumber: '',
    aadhaarNumber: '',
    panNumber: '',
    bankName: '',
    bankAccountHolder: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    upiId: '',
    photoUrl: '',
    aadhaarPhotoUrl: '',
    aadhaarBackPhotoUrl: '',
    panPhotoUrl: '',
    shopPhotoUrl: '',
    bankPassbookUrl: '',
    liveSelfieUrl: '',
    electricityBillUrl: '',
  });

  const [parents, setParents] = useState([]);

  useEffect(() => {
    adminService.getCandidateParents()
      .then(res => {
        if (res && res.parents) setParents(res.parents);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let interval = null;
    if (otpSent && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer(prev => prev - 1), 1000);
    } else if (otpTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [otpSent, otpTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Strict digit formatting for Aadhaar
    if (name === 'aadhaarNumber') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 12);
      setFormData(prev => ({ ...prev, aadhaarNumber: digitsOnly }));
      if (error) setError('');
      return;
    }

    // Pincode auto-lookup
    if (name === 'pincode') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
      setFormData(prev => ({ ...prev, pincode: digitsOnly }));
      if (digitsOnly.length === 6) {
        fetchPincodeDetails(digitsOnly);
      }
      if (error) setError('');
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  // Pincode Auto-Fill for City & State
  const fetchPincodeDetails = async (pin) => {
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const po = data[0].PostOffice[0];
        const stateName = po.State ? po.State.toUpperCase() : '';
        const cityName = po.District || po.Block || po.Name || '';
        
        // Find matching state in INDIAN_STATES
        const matchedState = INDIAN_STATES.find(s => s === stateName || stateName.includes(s) || s.includes(stateName));

        setFormData(prev => ({
          ...prev,
          city: cityName || prev.city,
          state: matchedState || prev.state
        }));
      }
    } catch (err) {
      console.warn('Pincode fetch error:', err);
    }
  };

  const handleFileUpload = (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size should be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, [field]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // STEP 1: Validate Details & send OTP
  const handleStep1Continue = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim()) {
      setError('First Name is required');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Last Name is required');
      return;
    }
    if (!formData.mobile || formData.mobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await otpService.sendOtp(formData.mobile.trim());
      setOtpSent(true);
      setOtpTimer(60);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to send OTP to mobile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.otp || formData.otp.length < 4) {
      setError('Please enter the 6-digit OTP sent to your mobile');
      return;
    }

    setLoading(true);
    try {
      const res = await otpService.verifyOtp(formData.mobile.trim(), formData.otp.trim());
      if (res && res.success) {
        setStep(3);
      } else {
        setError(res.message || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setError('');
    setLoading(true);
    try {
      await otpService.resendOtp(formData.mobile.trim());
      setOtpTimer(60);
      setOtpSent(true);
    } catch (err) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Onboarding Registration Submission
  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.pin || formData.pin.length < 4) {
      setError('Login PIN must be at least 4 digits');
      return;
    }
    if (formData.pin !== formData.confirmPin) {
      setError('Login PINs do not match');
      return;
    }
    if (formData.aadhaarNumber && formData.aadhaarNumber.length !== 12) {
      setError('Aadhaar Number must be exactly 12 digits');
      return;
    }

    setLoading(true);
    try {
      const username = formData.mobile.trim();
      const email = formData.email.trim() || `${username}@rupiksha.local`;
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

      const payload = {
        username: username,
        mobile: formData.mobile.trim(),
        email: email,
        fullName: fullName,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        password: formData.password,
        pin: formData.pin.trim(),
        otp: formData.otp.trim(),
        role: formData.role,
        state: formData.state.trim(),
        city: formData.city.trim(),
        pincode: formData.pincode.trim(),
        address: formData.shopAddress.trim() || formData.address.trim(),
        shopAddress: formData.shopAddress.trim() || formData.address.trim(),
        permanentAddress: formData.permanentAddress.trim(),
        businessName: formData.businessName.trim(),
        businessType: formData.businessType.trim(),
        parentUserId: formData.parentUserId,
        dob: formData.dob.trim(),
        fatherName: formData.fatherName.trim(),
        gender: formData.gender,
        gstNumber: formData.gstNumber.trim(),
        aadhaarNumber: formData.aadhaarNumber.trim(),
        panNumber: formData.panNumber.trim(),
        bankName: formData.bankName.trim(),
        bankAccountHolder: formData.bankAccountHolder.trim() || fullName,
        bankAccountNumber: formData.bankAccountNumber.trim(),
        bankIfsc: formData.bankIfsc.trim(),
        bankBranch: formData.bankBranch.trim(),
        photoUrl: formData.liveSelfieUrl || formData.photoUrl,
        aadhaarPhotoUrl: formData.aadhaarPhotoUrl,
        aadhaarBackPhotoUrl: formData.aadhaarBackPhotoUrl,
        panPhotoUrl: formData.panPhotoUrl,
        shopPhotoUrl: formData.shopPhotoUrl,
        bankPassbookUrl: formData.bankPassbookUrl,
        liveSelfieUrl: formData.liveSelfieUrl,
        voterIdUrl: formData.electricityBillUrl || formData.voterIdUrl
      };

      await authService.register(payload);
      setStep(4);
    } catch (err) {
      setError(err.message || 'Registration failed. Please verify details.');
    } finally {
      setLoading(false);
    }
  };

  // Immediate Login Action
  const handleImmediateLogin = async () => {
    setLoading(true);
    try {
      const res = await authService.login(formData.mobile.trim(), formData.password, formData.pin.trim());
      contextLogin(res.user, res.accessToken);
      if (res.user?.roles?.includes('ADMIN')) {
        navigate('/admin');
      } else if (res.user?.roles?.includes('SUPER_DISTRIBUTOR')) {
        navigate('/super-distributor');
      } else if (res.user?.roles?.includes('DISTRIBUTOR')) {
        navigate('/distributor');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen max-h-screen w-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden">
      
      {/* ── Top Header Navigation Bar (Locked at top) ── */}
      <header className="w-full h-12 sm:h-14 bg-white/95 backdrop-blur-md border-b border-slate-100 px-3 sm:px-6 py-2 flex items-center justify-between z-30 shrink-0 shadow-sm">
        <motion.div 
          initial={{ opacity: 0, x: -10 }} 
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => navigate('/login')}
        >
          <img src={logo} alt="RUPIKSHA" style={{ height: '36px', width: 'auto' }} className="object-contain" />
        </motion.div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Language Switcher */}
          <div className="flex items-center bg-slate-100 rounded-full p-0.5 border border-slate-200">
            <button 
              type="button"
              onClick={() => setLang('en')} 
              className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${lang === 'en' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              EN
            </button>
            <button 
              type="button"
              onClick={() => setLang('hi')} 
              className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${lang === 'hi' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              HI
            </button>
          </div>

          {/* Portal / Login Back Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            className="bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-blue-100 flex items-center gap-1 hover:bg-blue-100/70 transition-all shadow-sm"
          >
            <ChevronLeft size={12} />
            Retailer Login
          </motion.button>

          {/* Contacts */}
          <div className="hidden sm:flex flex-col text-[10px] sm:text-[11px] font-bold text-slate-600 tracking-wide border-l border-slate-200 pl-3 space-y-0.5">
            <span className="flex items-center gap-1 uppercase">
              <Phone size={12} className="text-blue-600 fill-blue-50" strokeWidth={2.5} /> 0621-4008548 | 7004128310
            </span>
            <span className="flex items-center gap-1 lowercase">
              <Mail size={12} className="text-blue-600 fill-blue-50" strokeWidth={2.5} /> customercare@rupiksha.com
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content Area (Two-Column Responsive Layout) ── */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 h-[calc(100vh-48px)] sm:h-[calc(100vh-56px)] overflow-y-auto md:overflow-hidden">
        
        {/* ── LEFT COLUMN: Registration Form Card (Increased Width & Clear Readable Text) ── */}
        <div className="md:col-span-8 lg:col-span-8 xl:col-span-8 p-3 sm:p-4 lg:p-5 flex flex-col justify-center items-center bg-gradient-to-br from-amber-50/50 via-blue-50/30 to-slate-50 overflow-y-auto md:overflow-hidden h-full min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-2xl lg:max-w-3xl flex flex-col justify-center max-h-full py-0.5"
          >
            {/* Header Title */}
            <div className="space-y-0.5 text-center sm:text-left mb-1.5 shrink-0">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Welcome to <span className="text-blue-600">Rupiksha</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Create your partner account & complete instant auto-approval onboarding
              </p>
            </div>

            {/* Main Form White Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-blue-100/70 border border-blue-50 overflow-hidden text-slate-800 flex flex-col max-h-full">
              
              {/* Blue Header Pill Banner */}
              <div className="bg-blue-600 py-2.5 px-4 text-center shadow-sm shrink-0">
                <span className="text-white text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
                  {step === 1 && 'NEW PARTNER REGISTRATION'}
                  {step === 2 && 'MOBILE OTP VERIFICATION'}
                  {step === 3 && 'ONBOARDING & KYC DOCUMENTS'}
                  {step === 4 && 'ACCOUNT REGISTRATION COMPLETED'}
                </span>
              </div>

              <div className="p-3.5 sm:p-4 space-y-2.5 flex-1 flex flex-col justify-center overflow-hidden">
                
                {/* Step Indicator Bar */}
                {step < 4 && (
                  <div className="flex items-center justify-between mb-2 px-2 sm:px-6 relative shrink-0">
                    <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
                    <div 
                      className="absolute top-1/2 left-6 h-0.5 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-300"
                      style={{ width: `${((step - 1) / 2) * 80 + 10}%` }}
                    />

                    {[
                      { num: 1, label: 'Account Details' },
                      { num: 2, label: 'OTP Verify' },
                      { num: 3, label: 'PIN & Documents' }
                    ].map(s => (
                      <div key={s.num} className="relative z-10 flex flex-col items-center">
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                          step > s.num 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                            : step === s.num 
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md' 
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                          {step > s.num ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
                        </div>
                        <span className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${step >= s.num ? 'text-blue-600' : 'text-slate-400'}`}>
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error Alert */}
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -4 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0 }}
                      className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-600 text-xs font-semibold shrink-0"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── STEP 1: FIRST NAME, LAST NAME & ACCOUNT INFO ── */}
                {step === 1 && (
                  <form onSubmit={handleStep1Continue} className="space-y-3 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          First Name *
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            placeholder="First Name"
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Last Name *
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            placeholder="Last Name"
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Mobile Number * (10 Digits)
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="tel"
                            name="mobile"
                            maxLength={10}
                            value={formData.mobile}
                            onChange={handleChange}
                            placeholder="e.g. 9876543210"
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="name@example.com"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Password *
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Confirm Password *
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Role Fixed to RETAILER & Parent Option */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Partner Role
                        </label>
                        <div className="w-full bg-blue-50/80 border border-blue-200 rounded-xl px-3.5 py-2 sm:py-2.5 flex items-center justify-between shadow-sm">
                          <span className="text-xs sm:text-sm font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-blue-600" /> RETAILER
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full uppercase tracking-widest">Default</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Assign Parent (Optional)
                        </label>
                        <select
                          name="parentUserId"
                          value={formData.parentUserId}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        >
                          <option value="">-- Direct Parent --</option>
                          {parents.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.fullName} ({p.partyCode || p.username}) - {p.role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50 active:scale-[0.99]"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Continue & Send Mobile OTP <ArrowRight className="w-4 h-4" /></>}
                    </button>

                    <div className="pt-1.5 flex items-center justify-center gap-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-t border-slate-100 mt-2">
                      <Link to="/login" className="text-blue-600 hover:underline flex items-center gap-1">
                        <User size={13} /> Already Registered? Login
                      </Link>
                    </div>
                  </form>
                )}

                {/* ── STEP 2: MOBILE OTP VERIFICATION (No Vertical Scroll) ── */}
                {step === 2 && (
                  <form onSubmit={handleVerifyOtp} className="space-y-3 text-center py-2">
                    <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-blue-900 text-xs sm:text-sm font-medium">
                      <Send className="w-5 h-5 mx-auto mb-1.5 text-blue-600" />
                      OTP has been sent to <strong>+91 {formData.mobile}</strong> via mobile SMS.
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        Enter 6-Digit OTP *
                      </label>
                      <input
                        type="text"
                        name="otp"
                        maxLength={6}
                        value={formData.otp}
                        onChange={handleChange}
                        placeholder="123456"
                        required
                        className="w-full max-w-xs mx-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center text-xl font-mono tracking-widest text-blue-600 focus:outline-none focus:border-blue-600 focus:bg-white shadow-inner"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 px-2">
                      <button 
                        type="button" 
                        onClick={() => setStep(1)} 
                        className="flex items-center gap-1 font-semibold hover:text-slate-800"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to Step 1
                      </button>

                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={otpTimer > 0 || loading}
                        className="text-blue-600 hover:underline disabled:opacity-50 font-bold"
                      >
                        {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'Resend OTP'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50 active:scale-[0.99]"
                    >
                      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Verify OTP & Proceed <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                )}

                {/* ── STEP 3: SECURITY PIN + ONBOARDING DETAILS (Scrollable inside form only) ── */}
                {step === 3 && (
                  <form onSubmit={handleCompleteRegistration} className="space-y-3.5 max-h-[calc(100vh-210px)] overflow-y-auto pr-1 text-left">
                    
                    {/* Section 1: Security PIN */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                        <KeyRound className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">1. Create Security Login PIN</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                            4-Digit Login PIN *
                          </label>
                          <input
                            type="password"
                            name="pin"
                            maxLength={4}
                            value={formData.pin}
                            onChange={handleChange}
                            placeholder="••••"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                            Confirm Login PIN *
                          </label>
                          <input
                            type="password"
                            name="confirmPin"
                            maxLength={4}
                            value={formData.confirmPin}
                            onChange={handleChange}
                            placeholder="••••"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Business & Address Details */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                        <Building className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Business & Address Details</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Shop / Business Name *</label>
                          <input 
                            type="text" 
                            name="businessName" 
                            value={formData.businessName} 
                            onChange={handleChange} 
                            placeholder="e.g. Rupiksha Store"
                            required
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Shop Address *</label>
                          <input 
                            type="text" 
                            name="shopAddress" 
                            value={formData.shopAddress} 
                            onChange={handleChange} 
                            placeholder="e.g. Main Market, Station Road"
                            required
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Permanent Address *</label>
                          <input 
                            type="text" 
                            name="permanentAddress" 
                            value={formData.permanentAddress} 
                            onChange={handleChange} 
                            placeholder="e.g. Village/Town, Post Office"
                            required
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                            Pincode * <span className="text-[9px] text-blue-600 font-semibold">(Auto-fills City & State)</span>
                          </label>
                          <input 
                            type="text" 
                            name="pincode" 
                            maxLength={6} 
                            value={formData.pincode} 
                            onChange={handleChange} 
                            placeholder="6 Digit Pincode (e.g. 842001)"
                            required
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">State *</label>
                          <select 
                            name="state" 
                            value={formData.state} 
                            onChange={handleChange} 
                            required
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm"
                          >
                            {INDIAN_STATES.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">City / District *</label>
                          <input 
                            type="text" 
                            name="city" 
                            value={formData.city} 
                            onChange={handleChange} 
                            placeholder="e.g. Muzaffarpur"
                            required
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: KYC & Banking */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">3. KYC & FINANCE DETAILS</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                            Aadhaar Number * <span className="text-[9px] text-slate-400">(12 Digits)</span>
                          </label>
                          <input 
                            type="text" 
                            name="aadhaarNumber" 
                            maxLength={12} 
                            value={formData.aadhaarNumber} 
                            onChange={handleChange} 
                            placeholder="12 Digit Aadhaar Number"
                            required
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono tracking-wider focus:border-blue-600 focus:outline-none shadow-sm" 
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">PAN Card Number *</label>
                          <input 
                            type="text" 
                            name="panNumber" 
                            maxLength={10} 
                            value={formData.panNumber} 
                            onChange={handleChange} 
                            placeholder="10 Digit PAN (e.g. ABCDE1234F)"
                            required
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 uppercase font-mono tracking-wider focus:border-blue-600 focus:outline-none shadow-sm" 
                          />
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5">Bank Account & Settlement Details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Account Holder Name *</label>
                            <input 
                              type="text" 
                              name="bankAccountHolder" 
                              value={formData.bankAccountHolder} 
                              onChange={handleChange} 
                              placeholder="Holder Name"
                              required
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Account Number *</label>
                            <input 
                              type="text" 
                              name="bankAccountNumber" 
                              value={formData.bankAccountNumber} 
                              onChange={handleChange} 
                              placeholder="Account Number"
                              required
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-600 focus:outline-none shadow-sm" 
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Bank Name *</label>
                            <input 
                              type="text" 
                              name="bankName" 
                              value={formData.bankName} 
                              onChange={handleChange} 
                              placeholder="e.g. SBI Bank"
                              required
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">IFSC Code *</label>
                            <input 
                              type="text" 
                              name="bankIfsc" 
                              value={formData.bankIfsc} 
                              onChange={handleChange} 
                              placeholder="e.g. SBIN0001234"
                              required
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 uppercase font-mono focus:border-blue-600 focus:outline-none shadow-sm" 
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">UPI ID (Optional)</label>
                            <input 
                              type="text" 
                              name="upiId" 
                              value={formData.upiId} 
                              onChange={handleChange} 
                              placeholder="e.g. name@upi"
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Document & Photo Uploads */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                        <Camera className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">4. DOCUMENT & PHOTO UPLOADS</h3>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'aadhaarPhotoUrl', label: 'Aadhaar Front' },
                          { key: 'aadhaarBackPhotoUrl', label: 'Aadhaar Back' },
                          { key: 'panPhotoUrl', label: 'PAN Card' },
                          { key: 'bankPassbookUrl', label: 'Bank Passbook' },
                          { key: 'shopPhotoUrl', label: 'Shop Photo' },
                          { key: 'liveSelfieUrl', label: 'User Live Selfie' },
                          { key: 'electricityBillUrl', label: 'Electricity Bill' },
                        ].map((doc) => (
                          <div key={doc.key} className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
                            <div>
                              <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wide truncate mb-1">{doc.label}</p>
                              {formData[doc.key] ? (
                                <div className="relative w-full h-14 rounded-lg overflow-hidden border border-blue-500 mb-1.5">
                                  <img src={formData[doc.key]} alt={doc.label} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-full h-14 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 mb-1.5">
                                  <ImageIcon className="w-4 h-4 mb-0.5" />
                                  <span className="text-[8px]">No file</span>
                                </div>
                              )}
                            </div>
                            <label className="cursor-pointer w-full py-1 px-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[9px] font-bold text-blue-600 flex items-center justify-center gap-1 transition-colors">
                              <Upload className="w-3 h-3" /> Upload
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(doc.key, e)} />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50 active:scale-[0.99]"
                    >
                      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Submit & Auto-Approve Registration <Sparkles className="w-4 h-4" /></>}
                    </button>
                  </form>
                )}

                {/* ── STEP 4: AUTO APPROVAL SUCCESS & LOGIN ── */}
                {step === 4 && (
                  <div className="text-center py-2 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-600 shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <div>
                      <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold uppercase tracking-wider">
                        STATUS: AUTO APPROVED & ACTIVE
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">Welcome to Rupiksha!</h2>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-md mx-auto">
                        Your partner account has been successfully registered and <strong>APPROVED</strong>.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1.5 text-slate-700 max-w-md mx-auto">
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-400">Full Name:</span>
                        <span className="font-bold text-slate-900">{formData.firstName} {formData.lastName}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-400">Mobile Number:</span>
                        <span className="font-mono font-bold text-slate-900">+91 {formData.mobile}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-400">Partner Role:</span>
                        <span className="font-bold text-blue-600">{formData.role}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-400">State:</span>
                        <span className="font-bold text-slate-900">{formData.state}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Onboarding Status:</span>
                        <span className="text-emerald-600 font-bold">APPROVED & ACTIVE</span>
                      </div>
                    </div>

                    <button
                      onClick={handleImmediateLogin}
                      disabled={loading}
                      className="w-full max-w-md mx-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.99]"
                    >
                      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Login Immediately & Open Dashboard <ArrowRight className="w-5 h-5" /></>}
                    </button>
                  </div>
                )}

              </div>
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN: Animated Image Carousel Slider (Tall Prominent Size) ── */}
        <div className="hidden md:flex md:col-span-4 lg:col-span-4 xl:col-span-4 bg-blue-50/80 border-l border-blue-100/60 p-3 sm:p-4 flex-col justify-center items-center relative overflow-hidden h-full min-h-0 shrink-0">
          
          {/* Ambient Decorative Blurs */}
          <div className="absolute top-0 right-0 w-[22rem] h-[22rem] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[18rem] h-[18rem] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 w-full max-w-sm lg:max-w-md mx-auto space-y-2 flex flex-col items-center justify-center my-auto">
            
            {/* ── ANIMATED IMAGE CAROUSEL / CARD HOLDER SLIDER ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full space-y-2"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-100/70 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles size={11} /> FEATURED SERVICES
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {currentSlide + 1} / {PROMO_SLIDES.length}
                </span>
              </div>

              <div 
                className="relative bg-white rounded-2xl sm:rounded-3xl p-3 shadow-xl shadow-blue-900/10 border border-blue-100 overflow-hidden group w-full"
                onMouseEnter={() => setIsCarouselPaused(true)}
                onMouseLeave={() => setIsCarouselPaused(false)}
              >
                {/* Carousel Image Container (Increased Height) */}
                <div className="relative h-56 sm:h-64 lg:h-[21rem] xl:h-[23rem] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
                  
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSlide}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 flex items-center justify-center bg-slate-950/90"
                    >
                      <img 
                        src={PROMO_SLIDES[currentSlide].src} 
                        alt={PROMO_SLIDES[currentSlide].title}
                        className="w-full h-full object-contain p-2"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Gradient Overlay for Title & Badge */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 text-white flex flex-col justify-end z-10">
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-0.5">
                      {PROMO_SLIDES[currentSlide].badge}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-white drop-shadow-sm">
                      {PROMO_SLIDES[currentSlide].title}
                    </h4>
                    <p className="text-[11px] text-slate-300 font-medium line-clamp-2 mt-0.5">
                      {PROMO_SLIDES[currentSlide].desc}
                    </p>
                  </div>

                  {/* Prev & Next Arrow Buttons */}
                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-all z-20"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={handleNextSlide}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-all z-20"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                {/* Carousel Indicator Dots */}
                <div className="flex items-center justify-center gap-1.5 mt-2 mb-0.5">
                  {PROMO_SLIDES.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentSlide(idx)}
                      className={`transition-all rounded-full ${
                        idx === currentSlide 
                          ? 'w-5 h-1.5 bg-blue-600 shadow-sm' 
                          : 'w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

          </div>

          <div className="text-center text-[10px] text-slate-400 font-medium py-0.5 shrink-0">
            © RuPiKsha Digital Services Private Limited
          </div>
        </div>

      </main>

      {/* ── WhatsApp Floating Icon (Matches Image 1) ── */}
      <a 
        href="https://wa.me/917004128310" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="fixed bottom-6 right-6 z-[100] group"
      >
        <div className="absolute -top-14 right-0 bg-white text-blue-600 px-4 py-2 rounded-lg shadow-2xl text-[10px] font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 border border-slate-100 uppercase">
          Chat with Us
          <div className="absolute bottom-[-6px] right-6 w-3 h-3 bg-white rotate-45 border-r border-b border-slate-100" />
        </div>
        <div className="bg-[#25D366] text-white p-4 rounded-full shadow-[0_10px_30px_rgba(37,211,102,0.5)] hover:bg-[#128C7E] hover:scale-110 active:scale-90 transition-all relative flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.134.298-.348.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.446 4.432-9.877 9.888-9.877 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.446-4.435 9.878-9.89 9.878m8.391-18.332A11.944 11.944 0 0012.05 0C5.41 0 .011 5.399.007 12.04c0 2.123.554 4.197 1.608 6.022L0 24l6.117-1.605a11.947 11.947 0 005.933 1.568h.005c6.637 0 12.036-5.402 12.041-12.042a11.95 11.95 0 00-3.645-8.522" />
          </svg>
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold animate-bounce shadow">1</span>
        </div>
      </a>

    </div>
  );
}

