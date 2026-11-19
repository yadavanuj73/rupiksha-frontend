import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, ShieldAlert, Lock, AlertTriangle, Loader2, X,
    IndianRupee, User, AlertCircle
} from 'lucide-react';
import { fmtINR } from './walletShared';

const AdminWalletPinModal = ({
    isOpen = false,
    title,
    actionTitle,
    actionType = 'ACTION',
    details = {},
    amount,
    targetUser,
    onConfirm,
    onClose,
    submitting = false,
    loading = false
}) => {
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [localError, setLocalError] = useState(null);
    const [isLockedOut, setIsLockedOut] = useState(false);
    const inputRefs = useRef([]);

    const displayTitle = title || actionTitle || 'Confirm Operation';
    const isSubmitting = submitting || loading;
    const displayName = details?.userName || targetUser?.name || targetUser?.fullName || targetUser?.username || 'Selected User';
    const displayCode = details?.userCode || targetUser?.partyCode || (targetUser?.username && targetUser?.username !== displayName ? targetUser?.username : '') || '';
    const displayAmount = details?.amount != null && details?.amount !== '' ? details.amount : (amount != null && amount !== '' ? amount : null);
    const displayNote = details?.customNote || details?.remark || (targetUser?.role ? `Role: ${targetUser.role}` : '');

    // Reset when modal opens or closes
    useEffect(() => {
        if (isOpen) {
            setDigits(['', '', '', '', '', '']);
            setLocalError(null);
            setIsLockedOut(false);
            // Auto focus first input
            setTimeout(() => {
                if (inputRefs.current[0]) {
                    inputRefs.current[0].focus();
                }
            }, 100);
        } else {
            setDigits(['', '', '', '', '', '']);
            setLocalError(null);
            setIsLockedOut(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleDigitChange = (index, value) => {
        // Only accept single numeric digit
        const char = value.replace(/\D/g, '').slice(-1);
        const newDigits = [...digits];
        newDigits[index] = char;
        setDigits(newDigits);
        setLocalError(null);

        // Advance to next box if char was entered
        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace') {
            if (!digits[index] && index > 0) {
                const newDigits = [...digits];
                newDigits[index - 1] = '';
                setDigits(newDigits);
                inputRefs.current[index - 1]?.focus();
            } else {
                const newDigits = [...digits];
                newDigits[index] = '';
                setDigits(newDigits);
            }
            setLocalError(null);
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();
        const numeric = pastedData.replace(/\D/g, '').slice(0, 6);
        if (!numeric) return;

        const newDigits = ['', '', '', '', '', ''];
        for (let i = 0; i < numeric.length; i++) {
            newDigits[i] = numeric[i];
        }
        setDigits(newDigits);
        setLocalError(null);

        // Focus the last filled box or next empty
        const nextIndex = Math.min(numeric.length, 5);
        inputRefs.current[nextIndex]?.focus();
    };

    const fullPin = digits.join('');
    const isPinComplete = fullPin.length === 6 && /^\d{6}$/.test(fullPin);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!isPinComplete || isSubmitting) return;

        try {
            const result = await onConfirm(fullPin);
            if (result && !result.success) {
                // Clear entered digits immediately on error
                setDigits(['', '', '', '', '', '']);
                setTimeout(() => {
                    inputRefs.current[0]?.focus();
                }, 50);

                if (result.status === 429 || result.isLockedOut) {
                    setIsLockedOut(true);
                    setLocalError(result.error || 'Account temporarily locked due to multiple failed PIN attempts. Please try again later.');
                } else if (result.status === 503) {
                    setLocalError('PIN verification service is currently unavailable. Please contact system administrator.');
                } else {
                    setLocalError(result.error || 'Invalid PIN. Operation rejected.');
                }
            }
        } catch (err) {
            setDigits(['', '', '', '', '', '']);
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 50);
            setLocalError(err?.message || 'Verification failed. Please try again.');
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 12 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-900"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
                                <Lock className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{displayTitle}</h3>
                                <p className="text-xs font-semibold text-slate-500">Admin Transaction PIN Required</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Operation Summary Box */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px]">Target User</span>
                                <span className="font-extrabold text-slate-900 text-xs">
                                    {displayName} {displayCode ? `(${displayCode})` : ''}
                                </span>
                            </div>
                            {displayAmount != null && (
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px]">Amount</span>
                                    <span className="font-black text-emerald-600 text-sm">
                                        {fmtINR(displayAmount)}
                                    </span>
                                </div>
                            )}
                            {displayNote && (
                                <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-200">
                                    <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px] shrink-0">Note</span>
                                    <span className="text-slate-900 font-semibold text-right truncate">{displayNote}</span>
                                </div>
                            )}
                        </div>

                        {/* PIN Entry Area */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-extrabold text-slate-900">
                                    Enter 6-Digit Admin Transaction PIN
                                </label>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">
                                    Masked & Encrypted
                                </span>
                            </div>

                            {/* 6 Digit Input Boxes */}
                            <div className="flex justify-between gap-2" onPaste={handlePaste}>
                                {digits.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={(el) => (inputRefs.current[idx] = el)}
                                        type="password"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        autoComplete="off"
                                        disabled={isSubmitting || isLockedOut}
                                        value={digit}
                                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(idx, e)}
                                        className={`w-12 h-14 text-center text-2xl font-black bg-white border-2 rounded-xl text-slate-950 outline-none transition-all duration-150 ${
                                            localError
                                                ? 'border-rose-500 text-rose-700 focus:border-rose-600 focus:ring-4 focus:ring-rose-500/10'
                                                : digit
                                                    ? 'border-indigo-600 bg-indigo-50/40 text-slate-950 shadow-sm shadow-indigo-500/10'
                                                    : 'border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Error or Lockout Notice */}
                        {localError && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs ${
                                    isLockedOut
                                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                                        : 'bg-rose-50 border-rose-200 text-rose-900'
                                }`}
                            >
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <p className="font-extrabold text-rose-800">{isLockedOut ? 'Security Lockout Triggered' : 'Verification Rejected'}</p>
                                    <p className="text-rose-700 font-semibold leading-relaxed">{localError}</p>
                                </div>
                            </motion.div>
                        )}

                        {/* Security Policy Badge */}
                        <div className="flex items-center space-x-2 text-[11px] text-slate-800 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200 font-semibold">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Server-side verification with brute-force protection enabled.</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-3 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="w-1/2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl border border-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!isPinComplete || isSubmitting || isLockedOut}
                                className="w-1/2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Verifying...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>Verify & Continue</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AdminWalletPinModal;
