import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, Lock, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, 
  User, Mail, KeyRound, Sparkles, Send, RefreshCw
} from 'lucide-react';
import { authService, otpService, adminService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';

export default function RegisterWizard() {
  const navigate = useNavigate();
  const { login: contextLogin } = useAuth();

  const [step, setStep] = useState(1); // 1: Mobile & Auth Info, 2: OTP Verification, 3: PIN Setup, 4: Auto Approval Success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);

  // Form State with First Name & Last Name
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
    parentUserId: '',
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

  // STEP 3: PIN Setup & System Validation -> AUTO APPROVAL REGISTRATION
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
        password: formData.password,
        pin: formData.pin.trim(),
        otp: formData.otp.trim(),
        role: formData.role,
        state: formData.state.trim(),
        city: formData.city.trim(),
        pincode: formData.pincode.trim(),
        address: formData.address.trim(),
        businessName: formData.businessName.trim(),
        parentUserId: formData.parentUserId,
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
    <div className="h-screen w-screen max-h-screen max-w-vw overflow-hidden bg-slate-950 text-slate-100 flex items-center justify-center p-2 sm:p-4 relative font-sans">
      {/* Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="w-full max-w-lg bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 relative z-10 my-auto flex flex-col justify-center">
        
        {/* Header */}
        <div className="text-center mb-3 sm:mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/20 mb-1.5">
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-slate-950" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
            Create Rupiksha Account
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Instant Auto-Approved Partner Registration
          </p>
        </div>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-between mb-3 sm:mb-4 px-3 sm:px-6 relative">
            <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-6 h-0.5 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-300"
              style={{ width: `${((step - 1) / 2) * 80 + 10}%` }}
            />

            {[
              { num: 1, label: 'Details' },
              { num: 2, label: 'OTP' },
              { num: 3, label: 'Security PIN' }
            ].map(s => (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                  step > s.num 
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' 
                    : step === s.num 
                    ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-[10px] sm:text-[11px] font-semibold mt-0.5 ${step >= s.num ? 'text-emerald-400' : 'text-slate-500'}`}>
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
              className="mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 1: FIRST NAME, LAST NAME & ACCOUNT INFO */}
        {step === 1 && (
          <form onSubmit={handleStep1Continue} className="space-y-2.5">
            {/* First Name & Last Name (2 Sections) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  First Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="e.g. Anujkumar"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Last Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="e.g. Yadav"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Mobile Number & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Mobile Number * (10 Digits)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="tel"
                    name="mobile"
                    maxLength={10}
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="9876543210"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="user@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Role & Parent Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Partner Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
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
              className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-2.5 sm:py-3 rounded-lg sm:rounded-xl shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Continue & Send OTP <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>

            <p className="text-center text-[11px] text-slate-400 mt-2">
              Already have an account? <Link to="/login" className="text-emerald-400 hover:underline font-semibold">Login here</Link>
            </p>
          </form>
        )}

        {/* STEP 2: 2FACTOR OTP VERIFICATION */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-center">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs sm:text-sm">
              <Send className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
              OTP has been sent to <strong>+91 {formData.mobile}</strong> via 2Factor SMS.
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-center text-xl font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpTimer > 0 || loading}
                className="text-emerald-400 hover:underline disabled:opacity-50 font-medium"
              >
                {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'Resend OTP'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-3 rounded-xl shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Verify OTP & Set PIN <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>
        )}

        {/* STEP 3: CREATE LOGIN PIN */}
        {step === 3 && (
          <form onSubmit={handleCompleteRegistration} className="space-y-3">
            <div className="text-center mb-2">
              <KeyRound className="w-7 h-7 text-emerald-400 mx-auto mb-1" />
              <h3 className="text-sm sm:text-base font-bold text-white">Create Security Login PIN</h3>
              <p className="text-[11px] text-slate-400">Default 4-digit PIN for instant secure login</p>
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Create Login PIN * (4 Digits)
              </label>
              <input
                type="password"
                name="pin"
                maxLength={6}
                value={formData.pin}
                onChange={handleChange}
                placeholder="••••"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Confirm Login PIN *
              </label>
              <input
                type="password"
                name="confirmPin"
                maxLength={6}
                value={formData.confirmPin}
                onChange={handleChange}
                placeholder="••••"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-3 rounded-xl shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Complete Auto-Approval Registration <Sparkles className="w-3.5 h-3.5" /></>}
            </button>
          </form>
        )}

        {/* STEP 4: AUTO APPROVAL SUCCESS & LOGIN */}
        {step === 4 && (
          <div className="text-center py-2 space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/30">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                Registration Status: APPROVED
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-2">Welcome to Rupiksha!</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Your account is <strong>ACTIVE</strong> and auto-approved. Wallet created with default services enabled.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left text-[11px] space-y-1.5 text-slate-300">
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-500">Name:</span>
                <span className="font-semibold text-white">{formData.firstName} {formData.lastName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-500">Mobile Number:</span>
                <span className="font-mono text-white">+91 {formData.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Status:</span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>
            </div>

            <button
              onClick={handleImmediateLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-3 rounded-xl shadow-md shadow-emerald-500/30 flex items-center justify-center gap-2 text-sm transition-all"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Login Immediately & Open Portal <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
