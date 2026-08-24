import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    KeyRound, 
    ShieldCheck, 
    Smartphone, 
    AlertCircle, 
    RotateCw, 
    CheckCircle2, 
    X, 
    ArrowRight,
    Lock,
    Coins,
    Building
} from 'lucide-react';

export default function AadhaarOtpModal({
    isOpen,
    onClose,
    onVerifySuccess,
    onResendOtp,
    txnDetails = {},
    loading = false,
    error = '',
    fpTransactionId = ''
}) {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timer, setTimer] = useState(60);
    const [isTimerActive, setIsTimerActive] = useState(true);
    const [localError, setLocalError] = useState('');
    const inputRefs = useRef([]);

    // Reset timer and OTP fields when modal opens
    useEffect(() => {
        if (isOpen) {
            setOtp(['', '', '', '', '', '']);
            setTimer(60);
            setIsTimerActive(true);
            setLocalError('');
            setTimeout(() => {
                if (inputRefs.current[0]) {
                    inputRefs.current[0].focus();
                }
            }, 150);
        }
    }, [isOpen]);

    // Timer countdown
    useEffect(() => {
        let interval = null;
        if (isTimerActive && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else if (timer === 0) {
            setIsTimerActive(false);
            if (interval) clearInterval(interval);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isTimerActive, timer]);

    if (!isOpen) return null;

    const handleOtpChange = (index, value) => {
        const val = value.replace(/\D/g, '');
        if (!val) {
            const newOtp = [...otp];
            newOtp[index] = '';
            setOtp(newOtp);
            return;
        }

        const newOtp = [...otp];
        // Handle copy paste of whole 6-digit OTP
        if (val.length > 1) {
            const digits = val.slice(0, 6).split('');
            for (let i = 0; i < 6; i++) {
                newOtp[i] = digits[i] || '';
            }
            setOtp(newOtp);
            const nextIdx = Math.min(digits.length, 5);
            if (inputRefs.current[nextIdx]) {
                inputRefs.current[nextIdx].focus();
            }
            return;
        }

        newOtp[index] = val.slice(-1);
        setOtp(newOtp);

        if (index < 5 && val) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pastedData) {
            const newOtp = [...otp];
            for (let i = 0; i < 6; i++) {
                newOtp[i] = pastedData[i] || '';
            }
            setOtp(newOtp);
            const focusIndex = Math.min(pastedData.length, 5);
            inputRefs.current[focusIndex]?.focus();
        }
    };

    const handleResend = () => {
        if (isTimerActive) return;
        setOtp(['', '', '', '', '', '']);
        setTimer(60);
        setIsTimerActive(true);
        setLocalError('');
        if (onResendOtp) {
            onResendOtp();
        }
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setLocalError('');
        const fullOtp = otp.join('');
        if (fullOtp.length !== 6) {
            setLocalError('Please enter complete 6-digit Aadhaar OTP.');
            return;
        }
        if (onVerifySuccess) {
            onVerifySuccess(fullOtp);
        }
    };

    const formattedAmount = txnDetails.amount ? parseFloat(txnDetails.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';
    const maskedAadhaar = txnDetails.aadhar 
        ? `XXXX-XXXX-${txnDetails.aadhar.slice(-4)}` 
        : 'XXXX-XXXX-XXXX';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md font-['Inter',sans-serif]">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="bg-white rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 relative text-black text-left overflow-hidden"
            >
                {/* Ambient glow accent */}
                <div className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/20 blur-2xl" />

                {/* Header Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 text-slate-500 hover:text-black p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                    <X size={18} />
                </button>

                {/* Header Title & Compliance Badge */}
                <div className="flex items-start gap-3 pb-3 border-b border-slate-200">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                        <KeyRound size={20} className="drop-shadow" />
                    </div>
                    <div className="pr-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-black uppercase tracking-tight text-black">
                                Aadhaar OTP Verification
                            </h3>
                            <span className="px-2 py-0.5 bg-blue-100 border border-blue-300 text-blue-950 rounded-full text-[9px] font-black uppercase tracking-wider">
                                &gt; ₹5,000 Mandate
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-bold mt-0.5 leading-tight">
                            NPCI requires customer Aadhaar OTP verification for transactions exceeding ₹5,000.
                        </p>
                    </div>
                </div>

                {/* Transaction Summary Card */}
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                            <Coins size={12} className="text-blue-600" />
                            Amount:
                        </span>
                        <strong className="text-base font-black text-black tracking-tight">
                            ₹ {formattedAmount}
                        </strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-700">
                        <div className="flex items-center gap-1 truncate">
                            <Smartphone size={11} className="text-slate-500 shrink-0" />
                            <span className="truncate">Mob: <strong className="text-black">{txnDetails.mobile || 'N/A'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 truncate justify-end">
                            <ShieldCheck size={11} className="text-emerald-600 shrink-0" />
                            <span className="truncate"><strong className="text-black">{maskedAadhaar}</strong></span>
                        </div>
                        {txnDetails.bankName && (
                            <div className="col-span-2 flex items-center gap-1 truncate text-slate-600">
                                <Building size={11} className="text-slate-500 shrink-0" />
                                <span className="truncate">Bank: <strong className="text-black">{txnDetails.bankName}</strong></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    {/* 6 Digit OTP Input Grid */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black text-black flex items-center gap-1">
                                <Lock size={12} className="text-blue-600" />
                                Enter 6-Digit Aadhaar OTP
                            </label>
                            <span className="text-[10px] font-bold text-slate-500">
                                Sent to Aadhaar linked mobile
                            </span>
                        </div>

                        <div className="flex justify-between gap-1.5 sm:gap-2" onPaste={handlePaste}>
                            {otp.map((digit, idx) => (
                                <input
                                    key={idx}
                                    ref={(el) => (inputRefs.current[idx] = el)}
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength="1"
                                    value={digit}
                                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(idx, e)}
                                    className="w-11 h-12 sm:w-12 sm:h-13 rounded-2xl border-2 border-slate-300 text-center text-lg sm:text-xl font-black text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition bg-slate-50 shadow-xs"
                                    required
                                />
                            ))}
                        </div>
                    </div>

                    {/* Timer & Resend Button */}
                    <div className="flex items-center justify-between text-xs font-bold px-1">
                        <span className="text-slate-600 text-[11px]">
                            {isTimerActive ? (
                                <span className="text-slate-700 font-extrabold">
                                    Resend OTP in <strong className="text-blue-600 font-mono font-black">{timer}s</strong>
                                </span>
                            ) : (
                                <span className="text-amber-800 font-bold">Didn't receive OTP?</span>
                            )}
                        </span>

                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={isTimerActive || loading}
                            className={`flex items-center gap-1 text-[11px] font-black uppercase tracking-wider transition ${
                                isTimerActive || loading
                                    ? 'text-slate-400 cursor-not-allowed'
                                    : 'text-blue-700 hover:text-blue-900 cursor-pointer underline'
                            }`}
                        >
                            <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
                            <span>Resend OTP</span>
                        </button>
                    </div>

                    {/* Alert / Errors */}
                    {(error || localError) && (
                        <div className="bg-rose-100 border border-rose-300 text-rose-950 text-xs p-2.5 rounded-2xl flex items-center gap-2 font-black">
                            <AlertCircle className="text-rose-700 shrink-0" size={15} />
                            <span className="text-[11px] leading-tight font-black">{error || localError}</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-1">
                        <motion.button
                            type="submit"
                            disabled={loading || otp.join('').length !== 6}
                            whileHover={{ scale: (loading || otp.join('').length !== 6) ? 1 : 1.01 }}
                            whileTap={{ scale: (loading || otp.join('').length !== 6) ? 1 : 0.98 }}
                            className={`w-full py-3 px-4 rounded-2xl font-black uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                                otp.join('').length === 6 && !loading
                                    ? 'bg-black hover:bg-slate-900 text-white shadow-black/20'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            }`}
                        >
                            {loading ? (
                                <>
                                    <RotateCw className="animate-spin" size={14} />
                                    <span>Generating OTP Reference...</span>
                                </>
                            ) : (
                                <>
                                    <span>Verify & Proceed to Biometric</span>
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </motion.button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
