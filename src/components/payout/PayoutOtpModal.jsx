import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, X, RefreshCw, AlertCircle, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';

/**
 * PayoutOtpModal - Mandatory OTP Verification popup for Payout transfers across all panels.
 * Features:
 * - Pure white background (#FFFFFF) with dark black typography (#0F172A / #000000).
 * - Clean, professional layout with live payout transaction telemetry preview.
 * - 6-digit individual numeric input with auto-advance, backspace handling, paste support.
 * - Resend countdown cooldown timer.
 * - Anti-tampering and double-submission protection.
 * - Responsive on all viewports (desktop, laptop, tablet, mobile, small screens).
 */
const PayoutOtpModal = ({
    isOpen,
    onClose,
    challengeData, // { challengeId, payoutIntentId, maskedMobile, resendCooldownSeconds, expiresInSeconds, amount, totalCharges, totalDeduction, beneficiaryName, accountNumber, ifsc, transferMode }
    onVerifyAndConfirm, // async (otp, challengeData) => Promise<boolean>
    onResendOtp, // async () => Promise<challengeData>
}) => {
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [cooldown, setCooldown] = useState(60);

    const inputRefs = useRef([]);

    // Initialize countdown timer when modal opens or challenge updates
    useEffect(() => {
        if (!isOpen) {
            setOtpDigits(['', '', '', '', '', '']);
            setErrorMessage('');
            setSuccessMessage('');
            setVerifying(false);
            setResending(false);
            return;
        }

        const initialCooldown = challengeData?.resendCooldownSeconds || 60;
        setCooldown(initialCooldown);

        const timer = setInterval(() => {
            setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        // Autofocus first digit box
        setTimeout(() => {
            if (inputRefs.current[0]) {
                inputRefs.current[0].focus();
            }
        }, 150);

        return () => clearInterval(timer);
    }, [isOpen, challengeData?.challengeId]);

    // Handle Escape key to cancel
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape' && !verifying) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, verifying, onClose]);

    if (!isOpen) return null;

    const fullOtp = otpDigits.join('');

    const handleDigitChange = (index, value) => {
        setErrorMessage('');
        // Handle pasting of full 6-digit OTP
        if (value.length > 1) {
            const pasted = value.replace(/\D/g, '').slice(0, 6);
            if (pasted.length > 0) {
                const newDigits = [...otpDigits];
                for (let i = 0; i < 6; i++) {
                    newDigits[i] = pasted[i] || '';
                }
                setOtpDigits(newDigits);
                const focusIdx = Math.min(pasted.length, 5);
                if (inputRefs.current[focusIdx]) {
                    inputRefs.current[focusIdx].focus();
                }
            }
            return;
        }

        const cleanVal = value.replace(/\D/g, '');
        const newDigits = [...otpDigits];
        newDigits[index] = cleanVal;
        setOtpDigits(newDigits);

        // Auto-advance to next input if digit entered
        if (cleanVal && index < 5 && inputRefs.current[index + 1]) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && inputRefs.current[index - 1]) {
            inputRefs.current[index - 1].focus();
        } else if (e.key === 'Enter' && fullOtp.length === 6 && !verifying) {
            handleVerifySubmit();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        setErrorMessage('');
        const text = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
        if (text) {
            const newDigits = ['', '', '', '', '', ''];
            for (let i = 0; i < text.length; i++) {
                newDigits[i] = text[i];
            }
            setOtpDigits(newDigits);
            const focusIdx = Math.min(text.length, 5);
            if (inputRefs.current[focusIdx]) {
                inputRefs.current[focusIdx].focus();
            }
        }
    };

    const handleVerifySubmit = async () => {
        if (fullOtp.length !== 6) {
            setErrorMessage('Please enter the complete 6-digit numeric OTP.');
            return;
        }

        setVerifying(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await onVerifyAndConfirm(fullOtp);
        } catch (err) {
            setErrorMessage(err?.message || 'OTP verification failed. Please check the code and try again.');
            // Clear OTP inputs on failure so user can re-enter cleanly
            setOtpDigits(['', '', '', '', '', '']);
            if (inputRefs.current[0]) {
                inputRefs.current[0].focus();
            }
        } finally {
            setVerifying(false);
        }
    };

    const handleResendClick = async () => {
        if (cooldown > 0 || resending) return;
        setResending(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            if (onResendOtp) {
                await onResendOtp();
                setSuccessMessage('A fresh OTP has been sent to your registered mobile number.');
                setCooldown(60);
                setOtpDigits(['', '', '', '', '', '']);
                if (inputRefs.current[0]) {
                    inputRefs.current[0].focus();
                }
            }
        } catch (err) {
            setErrorMessage(err?.message || 'Failed to resend OTP. Please wait before retrying.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
            {/* Modal Dialog Box */}
            <div
                className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 flex flex-col max-h-[92vh] sm:max-h-[90vh]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-payout-otp-title"
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/10">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 id="modal-payout-otp-title" className="text-lg sm:text-xl font-black text-black tracking-tight">
                                Verify Your Payout
                            </h2>
                            <p className="text-[11px] sm:text-xs text-slate-600 font-medium">
                                Two-step mandatory security verification
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={verifying}
                        aria-label="Close"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="px-5 sm:px-6 py-4 overflow-y-auto space-y-4">
                    {/* Information Banner with Masked Mobile */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm">
                        <p className="font-semibold text-slate-900 leading-snug">
                            OTP has been sent to your registered mobile number:
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                            <span className="font-mono font-bold text-black text-sm tracking-wide bg-white px-2.5 py-0.5 rounded border border-slate-300">
                                {challengeData?.maskedMobile || '******0000'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                                (Valid for 5 minutes)
                            </span>
                        </div>
                    </div>

                    {/* Transaction Binding Telemetry Preview Card */}
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                            <span className="flex items-center gap-1.5 text-black">
                                <Lock className="w-3.5 h-3.5 text-slate-700" /> Bound Payout Details
                            </span>
                            <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-black">
                                {challengeData?.transferMode || 'IMPS'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div>
                                <span className="text-slate-600 block text-[11px]">Beneficiary Name:</span>
                                <span className="font-bold text-black truncate block">
                                    {challengeData?.beneficiaryName || 'Beneficiary'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-600 block text-[11px]">Account / IFSC:</span>
                                <span className="font-mono font-semibold text-black truncate block">
                                    {challengeData?.accountNumber ? `••••${challengeData.accountNumber.slice(-4)}` : '••••'} / {challengeData?.ifsc || 'IFSC'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-600 block text-[11px]">Transfer Amount:</span>
                                <span className="font-black text-black text-sm">
                                    ₹{Number(challengeData?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-600 block text-[11px]">Total Deductions (Inc. GST):</span>
                                <span className="font-black text-black text-sm">
                                    ₹{Number(challengeData?.totalDeduction || challengeData?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Alert / Error Messages */}
                    {errorMessage && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <span className="font-medium leading-relaxed">{errorMessage}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="font-medium leading-relaxed">{successMessage}</span>
                        </div>
                    )}

                    {/* Six-digit Numeric OTP Input Boxes */}
                    <div className="space-y-2 pt-1">
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider text-center">
                            Enter 6-Digit Verification Code
                        </label>
                        <div
                            className="flex items-center justify-center gap-2 sm:gap-3"
                            onPaste={handlePaste}
                        >
                            {otpDigits.map((digit, idx) => (
                                <input
                                    key={idx}
                                    ref={(el) => (inputRefs.current[idx] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={1}
                                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                                    value={digit}
                                    disabled={verifying}
                                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(idx, e)}
                                    className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black rounded-xl border transition-all duration-150 outline-none ${
                                        digit
                                            ? 'border-black bg-white text-black ring-2 ring-black/10'
                                            : 'border-slate-300 bg-white text-black hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-black/10'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Resend Cooldown Section */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-600">Didn't receive the SMS code?</span>
                        {cooldown > 0 ? (
                            <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                                Resend in <span className="font-mono text-black">{cooldown}s</span>
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleResendClick}
                                disabled={resending || verifying}
                                className="font-bold text-black hover:text-slate-800 underline underline-offset-2 flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                                {resending ? 'Sending...' : 'Resend OTP'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Modal Footer / Action Buttons */}
                <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={verifying}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-bold transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleVerifySubmit}
                        disabled={fullOtp.length !== 6 || verifying}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white text-xs sm:text-sm font-black shadow-lg shadow-black/10 flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {verifying ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                                <span>Verifying & Confirming...</span>
                            </>
                        ) : (
                            <>
                                <span>Verify & Confirm Payout</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayoutOtpModal;
