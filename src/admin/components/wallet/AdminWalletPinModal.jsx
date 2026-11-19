import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, ShieldAlert, Lock, AlertTriangle, Loader2, X,
    IndianRupee, User, AlertCircle
} from 'lucide-react';
import { fmtINR } from './walletShared';

const AdminWalletPinModal = ({
    isOpen = false,
    title = 'Confirm Operation',
    actionType = 'ACTION',
    details = {},
    onConfirm,
    onClose,
    submitting = false
}) => {
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [localError, setLocalError] = useState(null);
    const [isLockedOut, setIsLockedOut] = useState(false);
    const inputRefs = useRef([]);

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
        if (!isPinComplete || submitting) return;

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

    const getActionBadgeColor = () => {
        const op = String(actionType).toUpperCase();
        if (op.includes('CREDIT') || op.includes('APPROVE') || op.includes('RELEASE') || op.includes('UNFREEZE')) {
            return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        }
        if (op.includes('DEBIT') || op.includes('REJECT') || op.includes('FREEZE')) {
            return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
        }
        if (op.includes('LOCK')) {
            return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        }
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 12 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                                <Lock className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
                                <p className="text-xs text-slate-400">Admin Transaction PIN Required</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Operation Summary Box */}
                        <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Target User</span>
                                <span className="font-semibold text-slate-200">
                                    {details.userName || 'Selected User'} {details.userCode ? `(${details.userCode})` : ''}
                                </span>
                            </div>
                            {details.amount != null && details.amount !== '' && (
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Amount</span>
                                    <span className="font-bold text-emerald-400 text-sm">
                                        {fmtINR(details.amount)}
                                    </span>
                                </div>
                            )}
                            {details.customNote && (
                                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-700/40">
                                    <span className="text-slate-400 shrink-0">Note</span>
                                    <span className="text-slate-300 text-right truncate">{details.customNote}</span>
                                </div>
                            )}
                        </div>

                        {/* PIN Entry Area */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-slate-300">
                                    Enter 6-Digit Admin Transaction PIN
                                </label>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
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
                                        disabled={submitting || isLockedOut}
                                        value={digit}
                                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(idx, e)}
                                        className={`w-12 h-14 text-center text-2xl font-bold bg-slate-950/80 border rounded-xl text-white outline-none transition-all duration-150 ${
                                            localError
                                                ? 'border-rose-500/70 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                                                : digit
                                                    ? 'border-indigo-500/70 shadow-sm shadow-indigo-500/20 bg-indigo-950/10'
                                                    : 'border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
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
                                className={`p-3 rounded-xl border flex items-start space-x-2.5 text-xs ${
                                    isLockedOut
                                        ? 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                }`}
                            >
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <p className="font-semibold">{isLockedOut ? 'Security Lockout Triggered' : 'Verification Rejected'}</p>
                                    <p className="text-slate-300 leading-relaxed">{localError}</p>
                                </div>
                            </motion.div>
                        )}

                        {/* Security Policy Badge */}
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Server-side verification with brute-force protection enabled.</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-3 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="w-1/2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700/80 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!isPinComplete || submitting || isLockedOut}
                                className="w-1/2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
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
