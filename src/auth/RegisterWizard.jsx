import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, Lock, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, 
  User, Mail, KeyRound, Sparkles, Send, RefreshCw, Upload, Image, Building, MapPin, CreditCard, Camera
} from 'lucide-react';
import { authService, otpService, adminService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';

export default function RegisterWizard() {
  const navigate = useNavigate();
  const { login: contextLogin } = useAuth();

  const [step, setStep] = useState(1); // 1: Mobile & Auth Info, 2: OTP Verification, 3: PIN & Onboarding & Documents, 4: Auto Approval Success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);

  // Form State with Onboarding & Document Uploads
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
    role: 'RETAILER',
    state: '',
    city: '',
    pincode: '',
    address: '',
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
    photoUrl: '',
    aadhaarPhotoUrl: '',
    aadhaarBackPhotoUrl: '',
    panPhotoUrl: '',
    shopPhotoUrl: '',
    bankPassbookUrl: '',
    liveSelfieUrl: '',
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
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
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

  // STEP 3: Onboarding & PIN Setup -> AUTO APPROVAL REGISTRATION
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
        address: formData.address.trim(),
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
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-3 sm:p-6 relative font-sans overflow-y-auto">
      {/* Ambient Glows */}
      <div className="fixed top-1/4 left-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed bottom-1/4 right-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="w-full max-w-2xl bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-7 relative z-10 my-6 flex flex-col justify-center">
        
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/20 mb-2">
            <ShieldCheck className="w-7 h-7 text-slate-950" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
            Create Rupiksha Account
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Instant Auto-Approved Partner Registration & Onboarding
          </p>
        </div>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-between mb-5 px-4 sm:px-8 relative">
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-8 h-0.5 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-300"
              style={{ width: `${((step - 1) / 2) * 80 + 10}%` }}
            />

            {[
              { num: 1, label: 'Account Details' },
              { num: 2, label: 'OTP Verification' },
              { num: 3, label: 'PIN & Documents' }
            ].map(s => (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                  step > s.num 
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' 
                    : step === s.num 
                    ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-[10px] sm:text-xs font-semibold mt-1 ${step >= s.num ? 'text-emerald-400' : 'text-slate-500'}`}>
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
              initial={{ opacity: 0, y: -6 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 1: FIRST NAME, LAST NAME & ACCOUNT INFO */}
        {step === 1 && (
          <form onSubmit={handleStep1Continue} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  First Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="e.g. First Name"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Last Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="e.g. Last Name"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. name@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Partner Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="RETAILER">Retailer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="SUPER_DISTRIBUTOR">Super Distributor</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Assign Parent (Optional)
                </label>
                <select
                  name="parentUserId"
                  value={formData.parentUserId}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
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
              className="w-full mt-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3 rounded-xl shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Continue & Send Mobile OTP <ArrowRight className="w-4 h-4" /></>}
            </button>

            <p className="text-center text-xs text-slate-400 mt-2">
              Already registered? <Link to="/login" className="text-emerald-400 hover:underline font-semibold">Login here</Link>
            </p>
          </form>
        )}

        {/* STEP 2: 2FACTOR OTP VERIFICATION */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-center py-2">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs sm:text-sm">
              <Send className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
              OTP has been sent to <strong>+91 {formData.mobile}</strong> via mobile SMS.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
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
                className="w-full max-w-xs mx-auto bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 px-2">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Account Details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpTimer > 0 || loading}
                className="text-emerald-400 hover:underline disabled:opacity-50 font-semibold"
              >
                {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'Resend OTP'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-3.5 rounded-xl shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Verify OTP & Proceed to Onboarding <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {/* STEP 3: SECURITY PIN + ONBOARDING & DOCUMENT UPLOADS */}
        {step === 3 && (
          <form onSubmit={handleCompleteRegistration} className="space-y-4">
            
            {/* Section A: Security PIN */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">1. Create Security Login PIN</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Section B: Business & Identity Details */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <Building className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">2. Business & Identity Info</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Business Name</label>
                  <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} placeholder="e.g. Rupiksha Store"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Aadhaar Number</label>
                  <input type="text" name="aadhaarNumber" maxLength={12} value={formData.aadhaarNumber} onChange={handleChange} placeholder="12 Digit Aadhaar"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">PAN Card Number</label>
                  <input type="text" name="panNumber" maxLength={10} value={formData.panNumber} onChange={handleChange} placeholder="10 Digit PAN"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">State</label>
                  <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="e.g. Bihar"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">City</label>
                  <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Muzaffarpur"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Pincode</label>
                  <input type="text" name="pincode" maxLength={6} value={formData.pincode} onChange={handleChange} placeholder="6 Digit Pincode"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                </div>
              </div>
            </div>

            {/* Section C: Bank Details */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">3. Bank Account Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Bank Name</label>
                  <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="e.g. State Bank of India"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Account Number</label>
                  <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} placeholder="Account Number"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">IFSC Code</label>
                  <input type="text" name="bankIfsc" value={formData.bankIfsc} onChange={handleChange} placeholder="SBIN0001234"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase" />
                </div>
              </div>
            </div>

            {/* Section D: Upload Registration Photos / Documents */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">4. Upload Documents & Registration Photos</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: 'aadhaarPhotoUrl', label: 'Aadhaar Front' },
                  { key: 'aadhaarBackPhotoUrl', label: 'Aadhaar Back' },
                  { key: 'panPhotoUrl', label: 'PAN Card' },
                  { key: 'bankPassbookUrl', label: 'Bank Passbook / Cheque' },
                  { key: 'shopPhotoUrl', label: 'Shop Photo' },
                  { key: 'liveSelfieUrl', label: 'Live Selfie / Photo' },
                ].map((doc) => (
                  <div key={doc.key} className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wide truncate mb-1">{doc.label}</p>
                      {formData[doc.key] ? (
                        <div className="relative w-full h-16 rounded-lg overflow-hidden border border-emerald-500/40 mb-2">
                          <img src={formData[doc.key]} alt={doc.label} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full h-16 rounded-lg border border-dashed border-slate-700 bg-slate-950 flex flex-col items-center justify-center text-slate-500 mb-2">
                          <Image className="w-5 h-5 mb-0.5" />
                          <span className="text-[9px]">No photo</span>
                        </div>
                      )}
                    </div>
                    <label className="cursor-pointer w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-semibold text-emerald-400 flex items-center justify-center gap-1 transition-colors">
                      <Upload className="w-3 h-3" /> Select File
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(doc.key, e)} />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Submit & Auto-Approve Registration <Sparkles className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {/* STEP 4: AUTO APPROVAL SUCCESS & LOGIN */}
        {step === 4 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Registration & Onboarding: AUTO APPROVED
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">Welcome to Rupiksha!</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                Your account and onboarding are <strong>ACTIVE & APPROVED</strong>. Basic services are enabled. (AEPS, BBPS & Payout are pending Admin activation).
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-2 text-slate-300 max-w-md mx-auto">
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-semibold text-white">{formData.firstName} {formData.lastName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Mobile Number:</span>
                <span className="font-mono text-white">+91 {formData.mobile}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Role:</span>
                <span className="font-semibold text-emerald-400">{formData.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account & Onboarding Status:</span>
                <span className="text-emerald-400 font-bold">APPROVED & ACTIVE</span>
              </div>
            </div>

            <button
              onClick={handleImmediateLogin}
              disabled={loading}
              className="w-full max-w-md mx-auto bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 text-sm transition-all"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Login Immediately & Open Dashboard <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
