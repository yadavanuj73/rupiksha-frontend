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
        <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
            {/* Modal Dialog Box */}
            <div
                className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 flex flex-col my-auto max-h-[calc(100vh-2rem)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-payout-otp-title"
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                            <ShieldCheck className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <h2 id="modal-payout-otp-title" className="text-base sm:text-lg font-black text-black tracking-tight leading-tight">
                                Verify Your Payout
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                                Two-step mandatory security verification
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={verifying}
                        aria-label="Close"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="px-5 py-3.5 overflow-y-auto space-y-3">
                    {/* Information Banner with Masked Mobile */}
                    <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                        <div>
                            <p className="text-[11px] text-slate-600 font-semibold leading-tight">OTP sent to registered mobile</p>
                            <p className="font-mono font-black text-black text-sm tracking-wider mt-0.5">
                                {challengeData?.maskedMobile || '******0000'}
                            </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shrink-0 shadow-xs">
                            Valid 5 mins
                        </span>
                    </div>

                    {/* Transaction Binding Telemetry Preview Card */}
                    <div className="p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-1">
                            <span className="flex items-center gap-1.5 text-black text-[11px] uppercase tracking-wider">
                                <Lock className="w-3 h-3 text-slate-700" /> Bound Payout Details
                            </span>
                            <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-black tracking-wider">
                                {challengeData?.transferMode || 'IMPS'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-0.5">
                            <div>
                                <span className="text-slate-500 block text-[10px] font-medium leading-none mb-0.5">Beneficiary Name:</span>
                                <span className="font-bold text-black truncate block text-xs">
                                    {challengeData?.beneficiaryName || 'Beneficiary'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 block text-[10px] font-medium leading-none mb-0.5">Account / IFSC:</span>
                                <span className="font-mono font-semibold text-black truncate block text-xs">
                                    {challengeData?.accountNumber ? `••••${challengeData.accountNumber.slice(-4)}` : '••••'} / {challengeData?.ifsc || 'IFSC'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 block text-[10px] font-medium leading-none mb-0.5">Transfer Amount:</span>
                                <span className="font-black text-black text-xs sm:text-sm">
                                    ₹{Number(challengeData?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 block text-[10px] font-medium leading-none mb-0.5">Total Deductions (Inc. GST):</span>
                                <span className="font-black text-black text-xs sm:text-sm">
                                    ₹{Number(challengeData?.totalDeduction || challengeData?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Alert / Error Messages */}
                    {errorMessage && (
                        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <span className="font-medium leading-tight">{errorMessage}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="font-medium leading-tight">{successMessage}</span>
                        </div>
                    )}

                    {/* Six-digit Numeric OTP Input Boxes */}
                    <div className="space-y-1.5 pt-0.5">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider text-center">
                            Enter 6-Digit Verification Code
                        </label>
                        <div
                            className="flex items-center justify-center gap-1.5 sm:gap-2.5"
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
                                    className={`w-9 h-11 sm:w-11 sm:h-12 text-center text-lg sm:text-xl font-black rounded-xl border transition-all duration-150 outline-none ${
                                        digit
                                            ? 'border-black bg-white text-black ring-2 ring-black/10'
                                            : 'border-slate-300 bg-white text-black hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-black/10'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Resend Cooldown Section */}
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                        <span className="text-slate-500 text-[11px]">Didn't receive the SMS code?</span>
                        {cooldown > 0 ? (
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                Resend in <span className="font-mono text-black font-extrabold">{cooldown}s</span>
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleResendClick}
                                disabled={resending || verifying}
                                className="font-bold text-black hover:text-slate-800 underline underline-offset-2 flex items-center gap-1 transition-colors disabled:opacity-50 text-[11px] cursor-pointer"
                            >
                                <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                                {resending ? 'Sending...' : 'Resend OTP'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Modal Footer / Action Buttons */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={verifying}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleVerifySubmit}
                        disabled={fullOtp.length !== 6 || verifying}
                        className="w-full sm:w-auto px-5 py-2 rounded-xl bg-black hover:bg-slate-800 text-white text-xs sm:text-sm font-black shadow-md shadow-black/10 flex items-center justify-center gap-1.5 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
