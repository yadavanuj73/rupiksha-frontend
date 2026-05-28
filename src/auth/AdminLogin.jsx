import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye, EyeOff, RefreshCcw, ArrowRight, ShieldCheck,
    Lock, User, KeyRound, CheckCircle2, AlertCircle, Loader2, ChevronLeft, Check, Palette
} from 'lucide-react';
import logo from '../assets/rupiksha_logo.png';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

const OTP_LENGTH = 6;
const OTP_EXPIRY = 120;

const AdminLogin = () => {
    const navigate = useNavigate();
    const { user: currentUser, loading: authLoading, setUser, setIsLocked } = useAuth();
    const otpRefs = useRef([]);
    const timerRef = useRef(null);

    // If the admin (or any staff role) is already authenticated, skip the login
    // screen entirely on refresh — otherwise pressing F5 after OTP verify briefly
    // rehydrates AuthContext and flashes this splash screen before landing back
    // on /admin, which is what made the page look like it "redirected" away.
    useEffect(() => {
        if (authLoading || !currentUser) return;
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

    const [brandColor, setBrandColor] = useState(localStorage.getItem('rupiksha_brand_color') || '#064e3b');
    const [step, setStep] = useState('credentials');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(''));
    const [timer, setTimer] = useState(0);
    const [captcha, setCaptcha] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loadingLogin, setLoadingLogin] = useState(false);
    const [loadingOtp, setLoadingOtp] = useState(false);

    useEffect(() => {
        document.documentElement.style.setProperty('--brand-color', brandColor);
        localStorage.setItem('rupiksha_brand_color', brandColor);
    }, [brandColor]);

    const genCaptcha = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 4; i += 1) {
            result += chars[Math.floor(Math.random() * chars.length)];
            if (i === 1) result += ' ';
        }
        setCaptcha(result);
    };

    useEffect(() => {
        genCaptcha();
    }, []);

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

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        const rawCaptcha = captcha.replace(/\s/g, '').toLowerCase();
        if (captchaInput.replace(/\s/g, '').toLowerCase() !== rawCaptcha) {
            setError('Incorrect captcha. Please try again.');
            setCaptchaInput('');
            genCaptcha();
            return;
        }

        setLoadingLogin(true);
        try {
            const res = await dataService.loginUser(username, password);
            if (!res.success) {
                setError(res.message || 'Invalid credentials.');
                setCaptchaInput('');
                genCaptcha();
                return;
            }

            const roleList = (res.user?.roles || [res.user?.role]).map((r) => String(r || '').toUpperCase());
            const isAdmin = roleList.some((r) =>
                ['ADMIN', 'SUPER_DISTRIBUTOR', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].includes(r)
            );
            if (!isAdmin) {
                localStorage.removeItem('rupiksha_user');
                localStorage.removeItem('rupiksha_token');
                setError('These credentials are not authorized for the admin portal.');
                setCaptchaInput('');
                genCaptcha();
                return;
            }

            setStep('otp');
            setOtpValues(Array(OTP_LENGTH).fill(''));
            setTimer(OTP_EXPIRY);
            setInfo('Credentials verified. Enter any 6-digit code to continue (dev 2FA).');
            setTimeout(() => otpRefs.current[0]?.focus(), 120);
        } catch (err) {
            setError(err?.message || 'Unable to reach server. Please check your connection and try again.');
        } finally {
            setLoadingLogin(false);
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

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        if (timer <= 0) {
            setError('OTP expired. Please login again.');
            return;
        }
        const otp = otpValues.join('');
        if (otp.length !== OTP_LENGTH) {
            setError('Please enter complete 6-digit OTP.');
            return;
        }

        setLoadingOtp(true);
        try {
            // JWT already stored by the credential step via dataService.loginUser.
            // Admin OTP is a dev-only 2FA gate; any 6-digit code proceeds.
            const savedUser = localStorage.getItem('rupiksha_user');
            const token = localStorage.getItem('rupiksha_token');
            if (!savedUser || !token) {
                setError('Session expired. Please sign in again.');
                setStep('credentials');
                return;
            }
            const adminUser = JSON.parse(savedUser);
            sessionStorage.setItem('admin_auth', 'true');
            setUser(adminUser);
            setIsLocked(false);
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err?.message || 'Could not complete login.');
        } finally {
            setLoadingOtp(false);
        }
    };

    const restartLogin = () => {
        setStep('credentials');
        setOtpValues(Array(OTP_LENGTH).fill(''));
        setTimer(0);
        setPassword('');
        setError('');
        setInfo('');
        setCaptchaInput('');
        genCaptcha();
    };

    const timerFmt = `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`;

    return (
        <div className="h-screen bg-slate-50 flex flex-col font-['Montserrat',sans-serif] overflow-hidden">
            <header className="bg-white px-6 md:px-12 py-3 flex items-center justify-between shadow-sm border-b border-slate-100 sticky top-0 z-50">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/login')}>
                    <img src={logo} alt="RUPIKSHA" style={{ height: '40px', width: 'auto' }} className="object-contain" />
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <div className="w-6 h-6 rounded-lg shadow-inner flex items-center justify-center overflow-hidden relative" style={{ backgroundColor: brandColor }}>
                            <input
                                type="color"
                                value={brandColor}
                                onChange={(e) => setBrandColor(e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-10 h-10"
                                title="Choose Theme Color"
                            />
                            <Palette size={12} className={parseInt(brandColor.replace('#',''), 16) > 0xffffff/2 ? 'text-black' : 'text-white'} />
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest hidden sm:inline">Theme Control</span>
                    </div>

                    <div className="hidden md:flex flex-col items-end">
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm" style={{ color: brandColor, borderColor: brandColor + '20', backgroundColor: brandColor + '05' }}>
                            Headquarters Protocol
                        </span>
                    </div>
                    <button
                        onClick={() => navigate('/login')}
                        className="h-10 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all flex items-center gap-2 group border border-slate-200"
                    >
                        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[11px] font-black uppercase tracking-wider">Back</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col md:flex-row bg-white">
                {/* Left: Login Form */}
                <div className="w-full md:w-[45%] lg:w-[42%] p-8 md:p-10 flex flex-col items-center justify-center bg-amber-100 border-r border-amber-200/50 shadow-2xl relative z-10 h-full overflow-y-auto">
                    <div className="w-full max-w-[420px] space-y-6">
                        <div className="text-center space-y-1">
                            <h2 className="text-3xl md:text-4xl font-black tracking-tighter italic" style={{ color: brandColor }}>
                                Login
                            </h2>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Access System Headquarters</p>
                        </div>

                        <div className="bg-white rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden">
                            <div className="text-white text-center py-4 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2" style={{ backgroundColor: brandColor }}>
                                <ShieldCheck size={16} /> Restricted Access — Authorized Personnel
                            </div>

                            <div className="p-6">
                                <AnimatePresence mode="wait">
                                    <motion.div key={step} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                                        <AnimatePresence>
                                            {error && (
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                                                    <AlertCircle size={13} />{error}
                                                </motion.div>
                                            )}
                                            {info && !error && (
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                                                    <CheckCircle2 size={13} />{info}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {step === 'credentials' ? (
                                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></div>
                                                    <input type="text" placeholder="Admin Username" value={username} onChange={(e) => setUsername(e.target.value)} required
                                                        className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-xl text-slate-800 focus:border-emerald-500 outline-none text-sm font-bold transition-all" />
                                                </div>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
                                                    <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
                                                        className="w-full pl-11 pr-12 py-3.5 bg-white border-2 border-slate-100 rounded-xl text-slate-800 focus:border-emerald-500 outline-none text-sm font-bold transition-all" />
                                                    <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors">
                                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex items-center justify-between bg-slate-50 border-2 border-slate-100 px-3 py-2.5 rounded-xl">
                                                        <span className="text-xl tracking-widest text-slate-600 select-none flex-1 text-center line-through decoration-slate-400 font-mono italic font-black">{captcha}</span>
                                                        <button type="button" onClick={genCaptcha} className="text-slate-400 hover:text-emerald-500 hover:rotate-180 transition-all duration-500 ml-2"><RefreshCcw size={14} /></button>
                                                    </div>
                                                    <input type="text" placeholder="Enter captcha" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} required
                                                        className="w-full px-4 py-3.5 bg-white border-2 border-slate-100 rounded-xl text-slate-800 focus:border-emerald-500 outline-none text-sm font-bold transition-all" />
                                                </div>
                                                <motion.button type="submit" disabled={loadingLogin} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                                    className="w-full mt-2 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-black hover:to-slate-800 text-white font-black py-4 rounded-xl text-[11px] uppercase tracking-widest shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 transition-all disabled:opacity-60">
                                                    {loadingLogin ? <><Loader2 size={14} className="animate-spin" /> Validating...</> : <><ShieldCheck size={15} /> Continue to OTP <ArrowRight size={14} /></>}
                                                </motion.button>
                                            </form>
                                        ) : (
                                            <form onSubmit={handleVerifyOtp} className="space-y-5">
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Enter 6-digit OTP</p>
                                                        <span className={`text-[11px] font-black tabular-nums ${timer > 30 ? 'text-emerald-500' : 'text-red-500'}`}>â± {timerFmt}</span>
                                                    </div>
                                                    <div className="flex gap-2 justify-center">
                                                        {Array(OTP_LENGTH).fill(0).map((_, i) => (
                                                            <input key={i} ref={(el) => { otpRefs.current[i] = el; }}
                                                                type="text" inputMode="numeric" maxLength={1} value={otpValues[i]}
                                                                onChange={(e) => handleOtpKey(e.target.value, i)}
                                                                onKeyDown={(e) => handleOtpBack(e, i)}
                                                                className={`w-11 h-12 text-center text-slate-800 font-black text-lg bg-white border-2 rounded-xl border-slate-200 outline-none transition-all
                                                                    ${otpValues[i] ? 'border-emerald-500 bg-emerald-50' : 'focus:border-emerald-400'}`} />
                                                        ))}
                                                    </div>
                                                    <p className="text-slate-400 text-[9px] font-bold text-center mt-3 uppercase tracking-widest">User: {username}</p>
                                                </div>

                                                <motion.button type="submit" disabled={loadingOtp || timer === 0} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                                    className="w-full text-white font-black py-4 rounded-xl text-[11px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all disabled:opacity-60"
                                                    style={{ backgroundColor: brandColor, boxShadow: `0 20px 40px ${brandColor}33` }}>
                                                    {loadingOtp ? <><Loader2 size={14} className="animate-spin" /> Verifying...</> : <><KeyRound size={14} /> Verify & Login <ArrowRight size={14} /></>}
                                                </motion.button>

                                                <button type="button" onClick={restartLogin}
                                                    className="w-full text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                                                    <RefreshCcw size={12} /> Back to Password Step
                                                </button>
                                            </form>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="text-center opacity-40">
                            <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.8em]">Â© 2026 RuPiKsha Digital</p>
                        </div>
                    </div>
                </div>

                {/* Right: Splash */}
                <div className="hidden md:flex flex-1 relative overflow-hidden items-center justify-center p-8 h-full" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}>
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/10 blur-[150px] rounded-full -mr-48 -mt-48" />
                        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 blur-[120px] rounded-full -ml-40 -mb-40" />
                    </div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12 text-white max-w-md text-center space-y-6 z-10"
                    >
                        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl" style={{ backgroundColor: 'white', color: brandColor, boxShadow: `0 20px 40px rgba(0,0,0,0.2)` }}>
                            <ShieldCheck size={40} />
                        </div>
                        <div className="space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-70">Headquarters Protocol</span>
                            <h3 className="text-3xl font-black tracking-tight">System<br />Administration</h3>
                            <p className="text-white/60 text-sm font-bold">Manage the entire platform layout, monitor live active employees, and maintain system integrity.</p>
                        </div>
                        {[
                            'Real-time Employee Directory',
                            'Geofenced Tracking Map',
                            'System Integrity & Security',
                            'Hierarchical Flow Management',
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3 text-left bg-white/10 border border-white/10 rounded-xl px-4 py-3">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: brandColor }}>
                                    <Check size={11} className="text-white" />
                                </div>
                                <span className="text-sm font-bold text-white/80">{f}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </main>
        </div>
    );
};

export default AdminLogin;
