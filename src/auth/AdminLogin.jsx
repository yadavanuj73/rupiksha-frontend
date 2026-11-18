import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye, EyeOff, RefreshCcw, ArrowRight, ShieldCheck,
    Lock, User, KeyRound, CheckCircle2, AlertCircle, Loader2, ChevronLeft, Check, Palette,
    Clock, MapPin, Users, Network, BarChart3, Smartphone
} from 'lucide-react';
import logo from '../assets/logo rupiksha.png';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

const OTP_LENGTH = 6;
const DEFAULT_OTP_EXPIRY = 300; // 5 minutes validity
const DEFAULT_RESEND_COOLDOWN = 60; // 60 seconds

const AdminLogin = () => {
    const navigate = useNavigate();
    const { user: currentUser, loading: authLoading, setUser, setIsLocked } = useAuth();
    const otpRefs = useRef([]);
    const timerRef = useRef(null);
    const cooldownRef = useRef(null);

    // If the admin is already authenticated and completed server-side OTP in this session, skip login
    useEffect(() => {
        if (authLoading || !currentUser) return;
        const isOtpVerified = sessionStorage.getItem('admin_otp_verified') === 'true';
        if (!isOtpVerified) return;

        const roles = (Array.isArray(currentUser.roles) && currentUser.roles.length
            ? currentUser.roles
            : [currentUser.role]
        ).map((r) => String(r || '').toUpperCase());
        const isStaff = roles.some((r) =>
            ['ADMIN', 'SUPER_DISTRIBUTOR', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].includes(r)
        );
        if (isStaff) {
            if (!sessionStorage.getItem('admin_auth')) {
                sessionStorage.setItem('admin_auth', 'true');
            }
            navigate('/admin/dashboard', { replace: true });
        }
    }, [currentUser, authLoading, navigate]);

    useEffect(() => {
        if (sessionStorage.getItem('admin_otp_verified') !== 'true') {
            sessionStorage.removeItem('admin_auth');
        }
    }, []);

    const [brandColor, setBrandColor] = useState(localStorage.getItem('rupiksha_brand_color') || '#064e3b');
    // Steps: 'credentials' -> 'destination' -> 'otp'
    const [step, setStep] = useState('credentials');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);

    // Challenge & Destination State (in-memory only, not persistent)
    const [challengeId, setChallengeId] = useState('');
    const [destinations, setDestinations] = useState([]);
    const [selectedDestination, setSelectedDestination] = useState('');
    const [maskedDestination, setMaskedDestination] = useState('');

    const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(''));
    const [timer, setTimer] = useState(0);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [captcha, setCaptcha] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');

    const [loadingLogin, setLoadingLogin] = useState(false);
    const [loadingSendOtp, setLoadingSendOtp] = useState(false);
    const [loadingResend, setLoadingResend] = useState(false);
    const [loadingOtp, setLoadingOtp] = useState(false);

    useEffect(() => {
        document.documentElement.style.setProperty('--brand-color', brandColor);
        localStorage.setItem('rupiksha_brand_color', brandColor);
    }, [brandColor]);

    const genCaptcha = () => {
        const num1 = Math.floor(Math.random() * 9) + 1;
        const num2 = Math.floor(Math.random() * 9) + 1;
        const isAddition = Math.random() > 0.5;
        if (isAddition) {
            setCaptcha(`${num1} + ${num2} = ?`);
            setCaptchaAnswer(String(num1 + num2));
        } else {
            const max = Math.max(num1, num2);
            const min = Math.min(num1, num2);
            setCaptcha(`${max} - ${min} = ?`);
            setCaptchaAnswer(String(max - min));
        }
    };

    useEffect(() => {
        genCaptcha();
    }, []);

    // OTP Expiry Countdown Timer
    useEffect(() => {
        clearInterval(timerRef.current);
        if (timer <= 0) return undefined;
        timerRef.current = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [timer]);

    // Resend 60-Second Cooldown Countdown Timer
    useEffect(() => {
        clearInterval(cooldownRef.current);
        if (resendCooldown <= 0) return undefined;
        cooldownRef.current = setInterval(() => {
            setResendCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(cooldownRef.current);
    }, [resendCooldown]);

    // Step 1: Password & Captcha Submission -> Server Validates and Returns Restricted Challenge
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        if (captchaInput.trim() !== captchaAnswer) {
            setError('Incorrect captcha. Please try again.');
            setCaptchaInput('');
            genCaptcha();
            return;
        }

        setLoadingLogin(true);
        try {
            // Call dedicated backend admin initiate login endpoint
            const res = await dataService.adminInitiateLogin(username.trim(), password);
            if (!res.success) {
                setError(res.message || 'Invalid admin credentials.');
                setCaptchaInput('');
                genCaptcha();
                return;
            }

            setChallengeId(res.challengeId);
            setDestinations(res.destinations || []);
            if (res.destinations && res.destinations.length > 0) {
                setSelectedDestination(res.destinations[0].id);
            }

            setStep('destination');
            setInfo('Credentials verified. Select an authorized mobile number to receive your OTP.');
        } catch (err) {
            setError(err?.message || 'Unable to reach server. Please check your connection and try again.');
        } finally {
            setLoadingLogin(false);
        }
    };

    // Step 2: Select OTP Destination -> Server Generates and Sends Real SMS OTP
    const handleSendOtp = async () => {
        if (!selectedDestination) {
            setError('Please select an authorized destination to receive your code.');
            return;
        }

        setError('');
        setInfo('');
        setLoadingSendOtp(true);

        try {
            const res = await dataService.adminSendOtp(challengeId, selectedDestination);
            if (!res.success) {
                setError(res.message || 'Unable to send OTP. Please try again.');
                return;
            }

            setMaskedDestination(res.maskedDestination);
            setTimer(res.expiresInSeconds || DEFAULT_OTP_EXPIRY);
            setResendCooldown(res.resendCooldownSeconds || DEFAULT_RESEND_COOLDOWN);
            setStep('otp');
            setOtpValues(Array(OTP_LENGTH).fill(''));
            setInfo(`Verification code sent to ${res.maskedDestination}. Valid for 5 minutes.`);
            setTimeout(() => otpRefs.current[0]?.focus(), 120);
        } catch (err) {
            setError(err?.message || 'Failed to deliver OTP code.');
        } finally {
            setLoadingSendOtp(false);
        }
    };

    // Resend OTP Action (Respects Server-Enforced Cooldown)
    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;

        setError('');
        setInfo('');
        setLoadingResend(true);

        try {
            const res = await dataService.adminResendOtp(challengeId);
            if (!res.success) {
                setError(res.message || 'Unable to resend code.');
                return;
            }

            setTimer(res.expiresInSeconds || DEFAULT_OTP_EXPIRY);
            setResendCooldown(res.resendCooldownSeconds || DEFAULT_RESEND_COOLDOWN);
            setOtpValues(Array(OTP_LENGTH).fill(''));
            setInfo(`New verification code delivered to ${res.maskedDestination || maskedDestination}.`);
            setTimeout(() => otpRefs.current[0]?.focus(), 120);
        } catch (err) {
            setError(err?.message || 'Failed to resend verification code.');
        } finally {
            setLoadingResend(false);
        }
    };

    const handleOtpKey = (value, idx) => {
        if (!/^\d?$/.test(value)) return;
        const next = [...otpValues];
        next[idx] = value;
        setOtpValues(next);
        if (value && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus();
    };

    const handleOtpBack = (e, idx) => {
        if (e.key === 'Backspace' && !otpValues[idx] && idx > 0) {
            otpRefs.current[idx - 1]?.focus();
        }
    };

    // Step 3: Complete Server-Side OTP Verification
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        if (timer <= 0) {
            setError('OTP expired. Please request a new verification code.');
            return;
        }

        const otp = otpValues.join('');
        if (otp.length !== OTP_LENGTH) {
            setError('Please enter complete 6-digit OTP.');
            return;
        }

        setLoadingOtp(true);
        try {
            // Critical: Server performs complete verification against real SMS provider and salted hash
            const res = await dataService.adminVerifyOtp(challengeId, otp);
            if (!res.success) {
                setError(res.message || 'Invalid verification code.');
                return;
            }

            setUser(res.user);
            setIsLocked(false);

            // Clean up temporary challenge state
            setChallengeId('');
            setDestinations([]);
            setSelectedDestination('');
            setOtpValues(Array(OTP_LENGTH).fill(''));

            navigate('/admin/dashboard', { replace: true });
        } catch (err) {
            setError(err?.message || 'Could not complete login.');
        } finally {
            setLoadingOtp(false);
        }
    };

    const handleChangeDeliveryOption = () => {
        setError('');
        setInfo('');
        setOtpValues(Array(OTP_LENGTH).fill(''));
        setStep('destination');
    };

    const restartLogin = () => {
        setChallengeId('');
        setDestinations([]);
        setSelectedDestination('');
        setMaskedDestination('');
        setStep('credentials');
        setOtpValues(Array(OTP_LENGTH).fill(''));
        setTimer(0);
        setResendCooldown(0);
        setPassword('');
        setError('');
        setInfo('');
        setCaptchaInput('');
        genCaptcha();
    };

    const timerFmt = `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`;

    return (
        <div className="relative h-screen w-screen bg-[#FAF9F6] overflow-hidden font-outfit">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                .font-outfit {
                    font-family: 'Outfit', sans-serif;
                }
                @keyframes orbit-slow {
                    0% { transform: translate(-50%, -50%) rotate(0deg); }
                    100% { transform: translate(-50%, -50%) rotate(360deg); }
                }
                @keyframes orbit-reverse {
                    0% { transform: translate(-50%, -50%) rotate(360deg); }
                    100% { transform: translate(-50%, -50%) rotate(0deg); }
                }
                .animate-orbit-slow {
                    animation: orbit-slow 50s linear infinite;
                }
                .animate-orbit-reverse {
                    animation: orbit-reverse 40s linear infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-10px) rotate(1.5deg); }
                }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(-1.5deg); }
                }
                @keyframes orbit-dash {
                    to {
                        stroke-dashoffset: -350;
                    }
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                .animate-float-delayed {
                    animation: float-slow 8s ease-in-out infinite;
                    animation-delay: 2s;
                }
                .animate-orbit-flow {
                    animation: orbit-dash 15s linear infinite;
                }
            `}</style>

            {/* Navigation Header Overlay */}
            <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-3 bg-transparent pointer-events-none">
                <div className="flex items-center gap-4 cursor-pointer pointer-events-auto" onClick={() => navigate('/login')}>
                    <img src={logo} alt="RUPIKSHA" style={{ height: '54px', width: 'auto' }} className="object-contain select-none" />
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    {/* Theme Control */}
                    <div className="flex items-center gap-2 bg-white/85 md:bg-[#03251f]/60 border border-slate-200/80 md:border-[#043d33]/80 px-2.5 py-1 rounded-xl shadow-sm backdrop-blur-sm">
                        <div className="w-4.5 h-4.5 rounded-lg shadow-inner flex items-center justify-center overflow-hidden relative" style={{ backgroundColor: brandColor }}>
                            <input
                                type="color"
                                value={brandColor}
                                onChange={(e) => setBrandColor(e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6"
                                title="Choose Theme Color"
                            />
                            <Palette size={10} className={parseInt(brandColor.replace('#',''), 16) > 0xffffff/2 ? 'text-black' : 'text-white'} />
                        </div>
                        <span className="text-[8px] font-black uppercase text-slate-500 md:text-emerald-400/80 tracking-widest">Theme</span>
                    </div>

                    {/* Protocol Badge (hidden on mobile) */}
                    <div className="hidden md:flex items-center gap-1.5 bg-[#03251f]/60 border border-[#043d33]/80 px-3 py-1.5 rounded-xl backdrop-blur-sm text-emerald-400 text-[9px] font-black uppercase tracking-widest shadow-sm">
                        <ShieldCheck size={12} className="text-emerald-400" />
                        <span>Headquarters Protocol</span>
                    </div>

                    {/* Back Button */}
                    <button
                        onClick={() => navigate('/login')}
                        className="h-8 px-3 bg-white/80 hover:bg-slate-50 md:bg-[#03251f]/60 md:hover:bg-[#043d33]/80 text-slate-700 md:text-white rounded-xl transition-all flex items-center gap-1.5 group border border-slate-200/80 md:border-[#043d33]/80 shadow-sm backdrop-blur-sm cursor-pointer"
                    >
                        <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Back</span>
                    </button>
                </div>
            </header>

            {/* Split Page columns wrapper */}
            <div className="w-full flex flex-col md:flex-row h-screen overflow-hidden">
                {/* Left Section (Login & Controls) */}
                <div className="w-full md:w-1/2 h-full bg-[#FAF9F6] relative flex flex-col justify-between p-6 md:p-12 pt-24 z-10 overflow-hidden">
                    {/* Background Orbits */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                        <div className="absolute top-[20%] left-[10%] w-[380px] h-[380px] bg-emerald-500/[0.04] rounded-full blur-[70px]" />
                        <div className="absolute bottom-[20%] right-[10%] w-[280px] h-[280px] bg-lime-500/[0.03] rounded-full blur-[70px]" />
                        
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-emerald-500/10 rounded-full animate-orbit-slow" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] border border-slate-200/50 rounded-full animate-orbit-reverse" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-emerald-500/[0.05] rounded-full" />
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative py-4">
                        <div className="w-full max-w-[390px] z-10 relative space-y-6">
                            <div className="text-center space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400/80 block">Welcome Back!</span>
                                <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-800 italic" style={{ color: brandColor }}>
                                    Login
                                </h2>
                                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Access System Headquarters</p>
                            </div>

                            <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
                                <div className="text-white text-center py-3 md:py-3.5 font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-800 to-emerald-600">
                                    <ShieldCheck size={14} /> Restricted Access — Authorized Personnel
                                </div>

                                <div className="p-6">
                                    <AnimatePresence mode="wait">
                                        <motion.div key={step} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                                            <AnimatePresence>
                                                {error && (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                        className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                                                        <AlertCircle size={13} className="shrink-0" /><span>{error}</span>
                                                    </motion.div>
                                                )}
                                                {info && !error && (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                        className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                                                        <CheckCircle2 size={13} className="shrink-0" /><span>{info}</span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* SCREEN 1: Admin Username + Password Step */}
                                            {step === 'credentials' && (
                                                <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
                                                    <div className="relative">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><User size={15} /></div>
                                                        <input type="text" placeholder="Admin Username" value={username} onChange={(e) => setUsername(e.target.value)} required
                                                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-emerald-500 outline-none text-sm font-semibold transition-all" />
                                                    </div>
                                                    <div className="relative">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={15} /></div>
                                                        <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
                                                            className="w-full pl-11 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-emerald-500 outline-none text-sm font-semibold transition-all" />
                                                        <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer">
                                                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
                                                            <span className="text-base tracking-widest text-slate-600 select-none flex-1 text-center font-outfit font-bold">{captcha}</span>
                                                            <button type="button" onClick={genCaptcha} className="text-slate-400 hover:text-emerald-500 transition-all duration-500 ml-2 cursor-pointer"><RefreshCcw size={13} /></button>
                                                        </div>
                                                        <input type="text" placeholder="Enter answer" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} required
                                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-emerald-500 outline-none text-sm font-semibold transition-all" />
                                                    </div>
                                                    <motion.button type="submit" disabled={loadingLogin} whileHover={{ scale: 1.02, boxShadow: '0 10px 20px rgba(16, 185, 129, 0.15)' }} whileTap={{ scale: 0.98 }}
                                                        className="w-full mt-2 bg-gradient-to-r from-teal-800 via-emerald-600 to-lime-500 text-white font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer">
                                                        {loadingLogin ? <><Loader2 size={13} className="animate-spin" /> Validating...</> : <><ShieldCheck size={14} /> Continue to Verification <ArrowRight size={13} /></>}
                                                    </motion.button>
                                                </form>
                                            )}

                                            {/* SCREEN 2: Select OTP Destination Step (Fixed Authorized Mobile Numbers) */}
                                            {step === 'destination' && (
                                                <div className="space-y-4">
                                                    <div className="text-center space-y-1">
                                                        <h4 className="text-base font-black text-slate-800 tracking-tight">Verify Your Identity</h4>
                                                        <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                                                            Select your registered mobile number to receive a secure login verification code.
                                                        </p>
                                                    </div>

                                                    <div className="space-y-2.5">
                                                        {destinations.map((dest) => {
                                                            const isSelected = selectedDestination === dest.id;
                                                            return (
                                                                <div
                                                                    key={dest.id}
                                                                    onClick={() => setSelectedDestination(dest.id)}
                                                                    className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all flex items-center justify-between ${
                                                                        isSelected
                                                                            ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
                                                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                            isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
                                                                        }`}>
                                                                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-black text-slate-800 tracking-wider font-mono">{dest.masked}</p>
                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                                {dest.id === 'ADMIN_PHONE_1' ? 'Primary Security Line' : 'Secondary Security Line'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <Smartphone size={18} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <motion.button
                                                        type="button"
                                                        onClick={handleSendOtp}
                                                        disabled={loadingSendOtp || !selectedDestination}
                                                        whileHover={{ scale: 1.02, boxShadow: '0 10px 20px rgba(16, 185, 129, 0.15)' }}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="w-full bg-gradient-to-r from-teal-800 via-emerald-600 to-lime-500 text-white font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer"
                                                    >
                                                        {loadingSendOtp ? (
                                                            <><Loader2 size={13} className="animate-spin" /> Delivering Code...</>
                                                        ) : (
                                                            <><ShieldCheck size={14} /> Send Verification Code <ArrowRight size={13} /></>
                                                        )}
                                                    </motion.button>

                                                    <button
                                                        type="button"
                                                        onClick={restartLogin}
                                                        className="w-full text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                                    >
                                                        <RefreshCcw size={12} /> Back to Password Step
                                                    </button>
                                                </div>
                                            )}

                                            {/* SCREEN 3: OTP Verification Step */}
                                            {step === 'otp' && (
                                                <form onSubmit={handleVerifyOtp} className="space-y-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Enter 6-digit OTP</p>
                                                            <span className={`text-[11px] font-black tabular-nums ${timer > 30 ? 'text-emerald-500' : 'text-red-500'}`}>⏱ {timerFmt}</span>
                                                        </div>
                                                        <p className="text-[11px] font-semibold text-slate-500 mb-3 text-center">
                                                            Sent to <span className="font-mono font-bold text-slate-800">{maskedDestination}</span>
                                                        </p>
                                                        <div className="flex gap-2 justify-center">
                                                            {Array(OTP_LENGTH).fill(0).map((_, i) => (
                                                                <input
                                                                    key={i}
                                                                    ref={(el) => { otpRefs.current[i] = el; }}
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    maxLength={1}
                                                                    value={otpValues[i]}
                                                                    onChange={(e) => handleOtpKey(e.target.value, i)}
                                                                    onKeyDown={(e) => handleOtpBack(e, i)}
                                                                    className={`w-10 h-11 text-center text-slate-800 font-black text-lg bg-white border-2 rounded-xl outline-none transition-all
                                                                        ${otpValues[i] ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 focus:border-emerald-400'}`}
                                                                />
                                                            ))}
                                                        </div>
                                                        <p className="text-slate-400 text-[9px] font-bold text-center mt-2.5 uppercase tracking-widest">User: {username}</p>
                                                    </div>

                                                    <motion.button
                                                        type="submit"
                                                        disabled={loadingOtp || timer === 0 || otpValues.join('').length !== OTP_LENGTH}
                                                        whileHover={{ scale: 1.02, boxShadow: '0 10px 20px rgba(16, 185, 129, 0.15)' }}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="w-full bg-gradient-to-r from-teal-800 via-emerald-600 to-lime-500 text-white font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer"
                                                    >
                                                        {loadingOtp ? (
                                                            <><Loader2 size={13} className="animate-spin" /> Verifying Code...</>
                                                        ) : (
                                                            <><KeyRound size={13} /> Verify & Login <ArrowRight size={13} /></>
                                                        )}
                                                    </motion.button>

                                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={handleChangeDeliveryOption}
                                                            className="text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Smartphone size={12} /> Change number
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={handleResendOtp}
                                                            disabled={resendCooldown > 0 || loadingResend}
                                                            className="text-slate-500 hover:text-emerald-700 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <RefreshCcw size={11} className={loadingResend ? 'animate-spin' : ''} />
                                                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                                                        </button>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={restartLogin}
                                                        className="w-full text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer pt-1"
                                                    >
                                                        <ChevronLeft size={13} /> Back to Password Step
                                                    </button>
                                                </form>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-slate-400/80 text-[9px] font-black uppercase tracking-widest">
                                <CheckCircle2 size={12} className="text-emerald-500/80" />
                                Secure Login Protected by AES-256 Encryption
                            </div>
                        </div>
                    </div>

                    <div className="text-center opacity-40 py-2">
                        <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.8em]">© 2026 RuPiKsha Digital</p>
                    </div>
                </div>

                {/* Right Section (Futuristic Administration Display) */}
                <div className="hidden md:flex md:w-1/2 h-full bg-[#021612] relative flex-col justify-between p-6 md:p-12 pt-24 z-10 overflow-hidden">
                    {/* Background Glows */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />
                    </div>

                    <div className="flex-1 flex items-center justify-center relative">
                        <div className="relative flex items-center justify-center w-full max-w-[480px] h-[360px]">
                            {/* SVG Paths & Glow Filters */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible" viewBox="0 0 480 360">
                                <defs>
                                    <linearGradient id="orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
                                        <stop offset="50%" stopColor="#34d399" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <ellipse cx="240" cy="180" rx="170" ry="120" stroke="rgba(16, 185, 129, 0.18)" strokeWidth="1.5" strokeDasharray="5 7" />
                                <ellipse cx="240" cy="180" rx="210" ry="150" stroke="rgba(16, 185, 129, 0.06)" strokeWidth="1.5" strokeDasharray="10 10" />
                                <ellipse cx="240" cy="180" rx="170" ry="120" stroke="url(#orbit-grad)" strokeWidth="2" strokeDasharray="50 300" className="animate-orbit-flow" />
                            </svg>

                            {/* Central Glassmorphic Dashboard Card */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="relative bg-teal-950/15 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-5 md:p-6 text-white max-w-[270px] w-full text-center space-y-3 md:space-y-4 z-10 shadow-[0_30px_70px_rgba(0,0,0,0.5)]"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center mx-auto shadow-2xl animate-float relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10" />
                                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-inner relative z-10">
                                        <ShieldCheck size={18} className="text-teal-800 animate-pulse" />
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-emerald-400/80 block">Headquarters Protocol</span>
                                    <h3 className="text-lg md:text-xl font-black tracking-tight leading-tight">System<br />Administration</h3>
                                    <p className="text-white/60 text-[10.5px] font-medium leading-relaxed">
                                        Manage the entire platform seamlessly. Monitor, control and secure live operations in real-time.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    {[
                                        { text: 'Real-time Employee Directory', icon: Clock },
                                        { text: 'Geo-fenced Tracking Map', icon: MapPin },
                                        { text: 'System Integrity & Security', icon: ShieldCheck },
                                        { text: 'Hierarchical Flow Management', icon: Network }
                                    ].map((item, i) => {
                                        const IconComp = item.icon;
                                        return (
                                            <div key={i} className="flex items-center gap-2 text-left bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 rounded-xl px-3 py-2 transition-all duration-300 group">
                                                <div className="w-5.5 h-5.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:border-emerald-400 transition-all duration-300">
                                                    <IconComp size={10} className="text-emerald-400 group-hover:text-white transition-colors duration-300" />
                                                </div>
                                                <span className="text-[10px] font-bold text-white/80 group-hover:text-white transition-colors duration-300">{item.text}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    <div className="text-right opacity-40 py-2">
                        <p className="text-emerald-400 text-[9px] font-black uppercase tracking-[0.4em]">Secure Admin Gateway</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
