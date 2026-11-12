import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Smartphone, ArrowRight, ArrowLeft, RefreshCw, AlertCircle,
    CheckCircle2, ShieldCheck, KeyRound, CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiService';

const OtpLoginForm = ({ role = 'RETAILER', onBackToPassword, onSuccess, portalTitle }) => {
    const navigate = useNavigate();
    const { loginWithOtp } = useAuth();

    // Step: 'mobile' | 'verify'
    const [step, setStep] = useState('mobile');
    const [mobile, setMobile] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [challengeId, setChallengeId] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [paymentError, setPaymentError] = useState(null);

    const inputRefs = useRef([]);

    // Cooldown countdown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const interval = setInterval(() => {
            setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [cooldown]);

    // Format masked mobile: e.g. +91 ******3456
    const getMaskedMobile = (num) => {
        if (!num || num.length < 10) return num;
        return `+91 ******${num.slice(-4)}`;
    };

    // Clean mobile input
    const handleMobileChange = (e) => {
        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
        setMobile(cleaned);
        if (errorMessage) setErrorMessage('');
    };

    // ── STEP 1: Request OTP ──
    const handleRequestOtp = async (e) => {
        e?.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');
        setPaymentError(null);

        const cleanMobile = mobile.trim();
        if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
            setErrorMessage('Enter a valid 10-digit mobile number.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await authService.otpLoginRequest(cleanMobile, role);
            if (res && res.success) {
                setChallengeId(res.challengeId);
                setCooldown(res.cooldownSeconds || 60);
                setStep('verify');
                setOtpDigits(['', '', '', '', '', '']);
                setSuccessMessage('OTP sent to your registered mobile number.');
                setTimeout(() => {
                    inputRefs.current[0]?.focus();
                }, 100);
            } else {
                setErrorMessage(res?.message || 'Unable to send OTP. Please try again.');
            }
        } catch (err) {
            setErrorMessage(err?.message || 'Unable to send OTP. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── STEP 2: Resend OTP ──
    const handleResendOtp = async () => {
        if (cooldown > 0 || isLoading || !challengeId) return;
        setErrorMessage('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            const res = await authService.otpLoginResend(challengeId);
            if (res && res.success) {
                setChallengeId(res.challengeId);
                setCooldown(res.cooldownSeconds || 60);
                setSuccessMessage('A new OTP has been sent.');
                setOtpDigits(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            } else {
                setErrorMessage(res?.message || 'Please wait before requesting another OTP.');
            }
        } catch (err) {
            setErrorMessage(err?.message || 'Failed to resend OTP. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── OTP Inputs Management ──
    const handleOtpChange = (index, value) => {
        const sanitized = value.replace(/\D/g, '');
        if (!sanitized) {
            const newDigits = [...otpDigits];
            newDigits[index] = '';
            setOtpDigits(newDigits);
            return;
        }

        // Handle single digit input
        const newDigits = [...otpDigits];
        newDigits[index] = sanitized[sanitized.length - 1];
        setOtpDigits(newDigits);

        // Auto move focus to next input
        if (index < 5 && sanitized) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;

        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
            newDigits[i] = pasted[i] || '';
        }
        setOtpDigits(newDigits);

        const nextFocus = Math.min(pasted.length, 5);
        inputRefs.current[nextFocus]?.focus();
    };

    // ── STEP 3: Verify OTP & Authenticate ──
    const handleVerifyOtp = async (e) => {
        e?.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');
        setPaymentError(null);

        const otp = otpDigits.join('');
        if (otp.length !== 6) {
            setErrorMessage('Please enter the complete 6-digit OTP.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await loginWithOtp(challengeId, otp, role);
            if (res && res.success) {
                if (onSuccess) {
                    onSuccess(res.user);
                } else {
                    const normRole = String(role).toUpperCase();
                    if (normRole === 'DISTRIBUTOR') {
                        navigate('/distributor');
                    } else if (normRole === 'SUPER_DISTRIBUTOR') {
                        navigate('/super-distributor');
                    } else {
                        navigate('/dashboard');
                    }
                }
            } else if (res?.code === 'ID_PAYMENT_REQUIRED' || res?.paymentRequired) {
                setPaymentError(res);
                setErrorMessage(res.message || 'ID charge payment is required before portal access.');
            } else {
                setErrorMessage(res?.message || 'Incorrect OTP. Please try again.');
            }
        } catch (err) {
            setErrorMessage(err?.message || 'Authentication failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Color theme classes depending on role
    const getThemeConfig = () => {
        switch (role) {
            case 'DISTRIBUTOR':
                return {
                    primaryBtn: 'bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900',
                    shadow: 'shadow-blue-500/20',
                    accentText: 'text-blue-600',
                    focusBorder: 'focus:border-blue-600',
                };
            case 'SUPER_DISTRIBUTOR':
                return {
                    primaryBtn: 'bg-gradient-to-r from-indigo-700 to-indigo-900 hover:from-indigo-800 hover:to-indigo-950',
                    shadow: 'shadow-indigo-500/20',
                    accentText: 'text-indigo-600',
                    focusBorder: 'focus:border-indigo-600',
                };
            default: // RETAILER
                return {
                    primaryBtn: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
                    shadow: 'shadow-blue-500/20',
                    accentText: 'text-blue-600',
                    focusBorder: 'focus:border-blue-600',
                };
        }
    };

    const theme = getThemeConfig();

    return (
        <div className="space-y-4">
            {/* Header info */}
            <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck size={13} />
                    <span>Secure OTP Login</span>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                    {step === 'mobile'
                        ? 'Sign in instantly with your verified mobile number'
                        : 'Enter the 6-digit verification code sent to your phone'}
                </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
                <div className={`p-3.5 rounded-2xl text-xs font-bold ${
                    paymentError
                        ? 'bg-amber-50 border-2 border-amber-300 text-amber-900 space-y-2 shadow-sm'
                        : 'bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2'
                }`}>
                    <div className="flex items-center gap-2">
                        <AlertCircle className={`w-4 h-4 shrink-0 ${paymentError ? 'text-amber-600' : 'text-rose-600'}`} />
                        <span>{errorMessage}</span>
                    </div>
                    {paymentError && (
                        <button
                            type="button"
                            onClick={() => {
                                const target = paymentError.userId || paymentError.username || mobile.trim();
                                navigate(`/id-payment?identifier=${encodeURIComponent(target)}&mobile=${encodeURIComponent(paymentError.mobile || mobile.trim())}&role=${encodeURIComponent(role)}`);
                            }}
                            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            <CreditCard size={15} /> Pay ID Activation Fee Now →
                        </button>
                    )}
                </div>
            )}

            {/* Success Banner */}
            {successMessage && !errorMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* ── STEP 1: MOBILE ENTRY ── */}
            {step === 'mobile' && (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div className="relative group">
                        {/* Country code prefix */}
                        <div className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center text-slate-700 border-r border-slate-200 bg-slate-50/80 rounded-l-2xl font-bold text-xs">
                            +91
                        </div>
                        <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            placeholder="10-Digit Mobile Number"
                            value={mobile}
                            onChange={handleMobileChange}
                            required
                            autoFocus
                            className="w-full pl-20 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none text-sm font-bold text-slate-900 transition-all tracking-wider"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || mobile.length !== 10}
                        className={`w-full ${theme.primaryBtn} text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] shadow-xl ${theme.shadow} flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer`}
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Sending OTP...</span>
                            </>
                        ) : (
                            <>
                                <span>Send OTP</span>
                                <ArrowRight size={15} />
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onBackToPassword}
                        className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-900 uppercase tracking-wider pt-1 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={14} />
                        <span>Back to Password Login</span>
                    </button>
                </form>
            )}

            {/* ── STEP 2: OTP VERIFICATION ── */}
            {step === 'verify' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                        <span>Code sent to <b className="text-slate-900 font-bold">{getMaskedMobile(mobile)}</b></span>
                        <button
                            type="button"
                            onClick={() => {
                                setStep('mobile');
                                setErrorMessage('');
                                setSuccessMessage('');
                                setPaymentError(null);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-bold text-xs underline cursor-pointer"
                        >
                            Change
                        </button>
                    </div>

                    {/* 6-box OTP input */}
                    <div className="flex items-center justify-between gap-2" onPaste={handleOtpPaste}>
                        {otpDigits.map((digit, idx) => (
                            <input
                                key={idx}
                                ref={(el) => (inputRefs.current[idx] = el)}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                className="w-12 h-13 text-center text-lg font-black text-slate-900 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:bg-blue-50/20 outline-none transition-all shadow-sm"
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || otpDigits.join('').length !== 6}
                        className={`w-full ${theme.primaryBtn} text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] shadow-xl ${theme.shadow} flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer`}
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Verifying OTP...</span>
                            </>
                        ) : (
                            <>
                                <KeyRound size={15} />
                                <span>Verify & Login</span>
                            </>
                        )}
                    </button>

                    {/* Resend & Back controls */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                        <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={cooldown > 0 || isLoading}
                            className={`font-bold transition-colors ${
                                cooldown > 0
                                    ? 'text-slate-400 cursor-not-allowed'
                                    : 'text-blue-600 hover:text-blue-800 cursor-pointer'
                            }`}
                        >
                            {cooldown > 0 ? (
                                `Resend OTP in ${cooldown}s`
                            ) : (
                                'Resend OTP'
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onBackToPassword}
                            className="text-slate-500 hover:text-slate-900 font-bold transition-colors cursor-pointer"
                        >
                            Back to Password Login
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default OtpLoginForm;

