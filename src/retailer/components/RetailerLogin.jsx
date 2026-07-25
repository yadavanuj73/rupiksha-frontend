import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye, EyeOff, Smartphone, Lock, KeyRound, ChevronRight,
    ArrowRight, ArrowLeft, CheckCircle2, Shield, Users, AlertCircle, RefreshCw
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/apiService';

const RetailerLogin = ({ onFormModeChange }) => {
    const { login } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [mode, setMode] = useState('login'); // 'login' | 'forgot_password' | 'forgot_pin'

    useEffect(() => {
        onFormModeChange?.(mode);
    }, [mode, onFormModeChange]);

    // ── Login Form ──
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // ── Forgot Password State ──
    const [forgotMobile, setForgotMobile] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [forgotStep, setForgotStep] = useState(1); // 1: Send OTP, 2: Reset

    // ── Forgot PIN State ──
    const [forgotPinMobile, setForgotPinMobile] = useState('');
    const [forgotPinOtp, setForgotPinOtp] = useState('');
    const [newPin, setNewPin] = useState('');
    const [forgotPinStep, setForgotPinStep] = useState(1); // 1: Send OTP, 2: Reset

    const normalizeRole = (role) => String(role || '').trim().replace(/[\s-]+/g, '_').toUpperCase();

    // ── Login Handler ──
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);

        try {
            const res = await authService.login(username.trim(), password, pin.trim());
            if (res && res.accessToken) {
                const user = res.user;
                const rolesArr = Array.isArray(user?.roles)
                    ? user.roles.map((r) => normalizeRole(typeof r === 'string' ? r : r?.name))
                    : [];
                const role = normalizeRole(user?.role);
                const allRoles = Array.from(new Set([...(rolesArr || []), ...(role ? [role] : [])]));

                if (!allRoles.includes('RETAILER') && !allRoles.includes('ADMIN')) {
                    setLoginError('Account not authorized for Retailer portal');
                    setIsLoading(false);
                    return;
                }

                login(user, res.accessToken);
                navigate('/dashboard');
            } else {
                setLoginError('Invalid credentials or PIN');
            }
        } catch (err) {
            setLoginError(err.message || 'Invalid credentials or Login PIN');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Forgot Password Handlers ──
    const handleSendPasswordOtp = async (e) => {
        e.preventDefault();
        setLoginError('');
        if (!forgotMobile || forgotMobile.length < 10) {
            setLoginError('Please enter a valid 10-digit mobile number');
            return;
        }
        setIsLoading(true);
        try {
            await authService.forgotPasswordSendOtp(forgotMobile.trim());
            setForgotStep(2);
        } catch (err) {
            setLoginError(err.message || 'Failed to send OTP for password reset');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoginError('');
        if (!forgotOtp || forgotOtp.length < 4) {
            setLoginError('Please enter the OTP sent to your mobile');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            setLoginError('New password must be at least 6 characters');
            return;
        }
        setIsLoading(true);
        try {
            const res = await authService.resetPassword(forgotMobile.trim(), forgotOtp.trim(), newPassword.trim());
            if (res && res.success) {
                alert('Password reset successfully! Please log in with your new password.');
                setMode('login');
                setForgotStep(1);
            } else {
                setLoginError(res.message || 'Failed to reset password');
            }
        } catch (err) {
            setLoginError(err.message || 'Password reset failed');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Forgot PIN Handlers ──
    const handleSendPinOtp = async (e) => {
        e.preventDefault();
        setLoginError('');
        if (!forgotPinMobile || forgotPinMobile.length < 10) {
            setLoginError('Please enter a valid 10-digit mobile number');
            return;
        }
        setIsLoading(true);
        try {
            await authService.forgotPinSendOtp(forgotPinMobile.trim());
            setForgotPinStep(2);
        } catch (err) {
            setLoginError(err.message || 'Failed to send OTP for PIN reset');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPin = async (e) => {
        e.preventDefault();
        setLoginError('');
        if (!forgotPinOtp || forgotPinOtp.length < 4) {
            setLoginError('Please enter the OTP sent to your mobile');
            return;
        }
        if (!newPin || newPin.length < 4) {
            setLoginError('New PIN must be at least 4 digits');
            return;
        }
        setIsLoading(true);
        try {
            const res = await authService.resetPin(forgotPinMobile.trim(), forgotPinOtp.trim(), newPin.trim());
            if (res && res.success) {
                alert('Login PIN reset successfully! Please log in with your new PIN.');
                setMode('login');
                setForgotPinStep(1);
            } else {
                setLoginError(res.message || 'Failed to reset Login PIN');
            }
        } catch (err) {
            setLoginError(err.message || 'PIN reset failed');
        } finally {
            setIsLoading(false);
        }
    };

    // ── FORGOT PASSWORD SCREEN ──
    if (mode === 'forgot_password') {
        return (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="text-center">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Forgot Password</h3>
                    <p className="text-xs text-slate-500 mt-1">Verify mobile via 2Factor OTP to reset password</p>
                </div>

                {loginError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{loginError}</span>
                    </div>
                )}

                {forgotStep === 1 ? (
                    <form onSubmit={handleSendPasswordOtp} className="space-y-4">
                        <div className="relative">
                            <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="tel"
                                maxLength={10}
                                placeholder="10-Digit Mobile Number"
                                value={forgotMobile}
                                onChange={e => setForgotMobile(e.target.value.replace(/\D/g, ''))}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send OTP via 2Factor'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                maxLength={6}
                                placeholder="Enter 6-Digit OTP"
                                value={forgotOtp}
                                onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-mono tracking-widest text-slate-900"
                            />
                        </div>
                        <div className="relative">
                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="password"
                                placeholder="Enter New Password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                        </button>
                    </form>
                )}

                <button
                    type="button"
                    onClick={() => { setMode('login'); setForgotStep(1); }}
                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-wider mt-2"
                >
                    ← Back to Login
                </button>
            </motion.div>
        );
    }

    // ── FORGOT PIN SCREEN ──
    if (mode === 'forgot_pin') {
        return (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="text-center">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Reset Login PIN</h3>
                    <p className="text-xs text-slate-500 mt-1">Verify mobile via 2Factor OTP to create new PIN</p>
                </div>

                {loginError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{loginError}</span>
                    </div>
                )}

                {forgotPinStep === 1 ? (
                    <form onSubmit={handleSendPinOtp} className="space-y-4">
                        <div className="relative">
                            <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="tel"
                                maxLength={10}
                                placeholder="10-Digit Mobile Number"
                                value={forgotPinMobile}
                                onChange={e => setForgotPinMobile(e.target.value.replace(/\D/g, ''))}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send OTP via 2Factor'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPin} className="space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                maxLength={6}
                                placeholder="Enter 6-Digit OTP"
                                value={forgotPinOtp}
                                onChange={e => setForgotPinOtp(e.target.value.replace(/\D/g, ''))}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-mono tracking-widest text-slate-900"
                            />
                        </div>
                        <div className="relative">
                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="password"
                                maxLength={6}
                                placeholder="Enter New 4-Digit PIN"
                                value={newPin}
                                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-mono tracking-widest text-slate-900"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Reset Login PIN'}
                        </button>
                    </form>
                )}

                <button
                    type="button"
                    onClick={() => { setMode('login'); setForgotPinStep(1); }}
                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-wider mt-2"
                >
                    ← Back to Login
                </button>
            </motion.div>
        );
    }

    // ── MAIN LOGIN SCREEN ──
    return (
        <div className="space-y-5">
            {loginError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-2xl text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
                {/* Mobile / Username */}
                <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-400 border-r border-slate-200 bg-slate-50/50 rounded-l-2xl group-focus-within:text-blue-600 group-focus-within:bg-blue-50 transition-colors">
                        <Smartphone size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Mobile Number / Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        className="w-full pl-14 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none text-sm font-bold text-slate-900 transition-all"
                    />
                </div>

                {/* Password */}
                <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-400 border-r border-slate-200 bg-slate-50/50 rounded-l-2xl group-focus-within:text-blue-600 group-focus-within:bg-blue-50 transition-colors">
                        <Lock size={18} />
                    </div>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="w-full pl-14 pr-12 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none text-sm font-bold text-slate-900 transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-400 hover:text-blue-600"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                {/* Login PIN */}
                <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-400 border-r border-slate-200 bg-slate-50/50 rounded-l-2xl group-focus-within:text-blue-600 group-focus-within:bg-blue-50 transition-colors">
                        <KeyRound size={18} />
                    </div>
                    <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={6}
                        placeholder="Login PIN (Default 4 Digits)"
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-14 pr-12 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none text-sm font-bold text-slate-900 transition-all font-mono tracking-widest"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-400 hover:text-blue-600"
                    >
                        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                {/* Login Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-60"
                >
                    {isLoading ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Signing in...
                        </>
                    ) : (
                        <>
                            Login to Dashboard <ArrowRight size={16} />
                        </>
                    )}
                </button>

                {/* Account Action Helpers */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="text-blue-600 hover:text-blue-700 uppercase tracking-wider flex items-center gap-1"
                    >
                        <Users size={14} /> New Partner? Register
                    </button>

                    <div className="flex items-center gap-3 text-slate-500">
                        <button
                            type="button"
                            onClick={() => setMode('forgot_password')}
                            className="hover:text-blue-600 uppercase tracking-wider"
                        >
                            Forgot Password?
                        </button>
                        <span>|</span>
                        <button
                            type="button"
                            onClick={() => setMode('forgot_pin')}
                            className="hover:text-blue-600 uppercase tracking-wider"
                        >
                            Forgot PIN?
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default RetailerLogin;
