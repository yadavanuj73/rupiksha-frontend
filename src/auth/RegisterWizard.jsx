import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, Lock, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, 
  User, Mail, Building2, MapPin, KeyRound, Sparkles, Send, RefreshCw
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

  // Form State
  const [formData, setFormData] = useState({
    mobile: '',
    fullName: '',
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
    // Load candidate parents for hierarchy selection
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

  // STEP 1: Validate Mobile & Basic details, send OTP
  const handleStep1Continue = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.mobile || formData.mobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!formData.fullName.trim()) {
      setError('Full Name is required');
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

      const payload = {
        username: username,
        mobile: formData.mobile.trim(),
        email: email,
        fullName: formData.fullName.trim(),
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

      const userView = await authService.register(payload);
      setStep(4); // Auto-Approval Success Step
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-10 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/20 mb-3">
            <ShieldCheck className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Create Rupiksha Account
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Instant Auto-Approved Partner Registration
          </p>
        </div>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-between mb-8 px-4 relative">
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-8 h-0.5 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-300"
              style={{ width: `${((step - 1) / 2) * 80 + 10}%` }}
            />

            {[
              { num: 1, label: 'Details' },
              { num: 2, label: 'OTP' },
              { num: 3, label: 'Security PIN' }
            ].map(s => (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  step > s.num 
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30' 
                    : step === s.num 
                    ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
                </div>
                <span className={`text-[11px] font-semibold mt-1 ${step >= s.num ? 'text-emerald-400' : 'text-slate-500'}`}>
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
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 1: MOBILE & ACCOUNT INFO */}
        {step === 1 && (
          <form onSubmit={handleStep1Continue} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. Anujkumar Yadav"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Mobile Number * (10 Digits)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    name="mobile"
                    maxLength={10}
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="9876543210"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="user@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Partner Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="RETAILER">Retailer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="SUPER_DISTRIBUTOR">Super Distributor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Assign Parent (Optional)
                </label>
                <select
                  name="parentUserId"
                  value={formData.parentUserId}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
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
              className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Continue & Send OTP <ArrowRight className="w-4 h-4" /></>}
            </button>

            <p className="text-center text-xs text-slate-400 mt-4">
              Already have an account? <Link to="/login" className="text-emerald-400 hover:underline font-semibold">Login here</Link>
            </p>
          </form>
        )}

        {/* STEP 2: 2FACTOR OTP VERIFICATION */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              <Send className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
              OTP has been sent to <strong>+91 {formData.mobile}</strong> via 2Factor SMS.
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Mobile
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
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Verify OTP & Set PIN <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {/* STEP 3: CREATE LOGIN PIN */}
        {step === 3 && (
          <form onSubmit={handleCompleteRegistration} className="space-y-4">
            <div className="text-center mb-4">
              <KeyRound className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
              <h3 className="text-base font-bold text-white">Create Security Login PIN</h3>
              <p className="text-xs text-slate-400">Default 4-digit PIN for instant secure login</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Complete Auto-Approval Registration <Sparkles className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {/* STEP 4: AUTO APPROVAL SUCCESS & LOGIN */}
        {step === 4 && (
          <div className="text-center py-4 space-y-5">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-2xl shadow-emerald-500/30">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Registration Status: APPROVED
              </span>
              <h2 className="text-2xl font-black text-white mt-3">Welcome to Rupiksha!</h2>
              <p className="text-sm text-slate-300 mt-1">
                Your account is <strong>ACTIVE</strong> and auto-approved. Wallet created with default services enabled.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-2 text-slate-300">
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Mobile Number:</span>
                <span className="font-mono text-white">+91 {formData.mobile}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Account Status:</span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Default Services:</span>
                <span className="text-emerald-400">Wallet, Recharge, BBPS, Reports Enabled</span>
              </div>
            </div>

            <button
              onClick={handleImmediateLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 text-base transition-all"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Login Immediately & Open Portal <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
