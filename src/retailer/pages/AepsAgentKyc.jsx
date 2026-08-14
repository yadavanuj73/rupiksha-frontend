import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Fingerprint, CheckCircle2, ShieldCheck, AlertCircle, KeyRound, Smartphone, Sparkles, RefreshCw, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRD } from '../../hooks/useRD';
import DeviceStatus from '../../components/DeviceStatus';
import CaptureButton from '../../components/CaptureButton';
import CaptureLoader from '../../components/CaptureLoader';
import CaptureError from '../../components/CaptureError';
import CaptureSuccess from '../../components/CaptureSuccess';
import { kycWorkflowService } from '../../services/aeps/kycService';
import { otpVerificationService } from '../../services/aeps/otpVerificationService';
import { userService } from '../../services/apiService';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';

export default function AepsAgentKyc() {
    const navigate = useNavigate();
    const query = new URLSearchParams(window.location.search);
    const provider = query.get('provider') || 'fingpay';
    const { captureResult, device } = useRD();

    const [submitting, setSubmitting] = useState(false);
    const [serviceDisabled, setServiceDisabled] = useState(false);
    const [submittingOtp, setSubmittingOtp] = useState(false);
    const [kycResponse, setKycResponse] = useState(null);
    const [kycError, setKycError] = useState('');
    const [otpError, setOtpError] = useState('');
    const [otpCode, setOtpCode] = useState('');

    useEffect(() => {
        const checkService = async () => {
            try {
                const services = await userService.getUserServices();
                if (services && services.AEPS === false) {
                    setServiceDisabled(true);
                }
            } catch (e) {
                console.warn("Could not check service enablement", e);
            }
        };
        checkService();
    }, []);

    if (serviceDisabled) {
        return <DisabledServiceBanner serviceName="AEPS" />;
    }

    const handleKycSubmit = async () => {
        if (!captureResult || !captureResult.pidXml) {
            setKycError("Please capture your fingerprint first using the connected RD scanner.");
            return;
        }

        setSubmitting(true);
        setKycError('');
        setKycResponse(null);

        try {
            const res = await kycWorkflowService.submitBiometricKyc(captureResult.pidXml, 'FMR', provider);
            setKycResponse(res.data);
        } catch (err) {
            console.error("Biometric KYC submission failed", err);
            setKycError(err.message || "Failed to submit biometric KYC to provider.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOtpSubmit = async () => {
        if (!otpCode || otpCode.length !== 6) {
            setOtpError("Please enter a valid 6-digit OTP code.");
            return;
        }

        setSubmittingOtp(true);
        setOtpError('');

        try {
            const res = await otpVerificationService.verifyKycOtp(otpCode, provider);
            setKycResponse(res.data);
        } catch (err) {
            console.error("OTP verification failed", err);
            setOtpError(err.message || "Failed to verify OTP code.");
        } finally {
            setSubmittingOtp(false);
        }
    };

    const isKycSuccess = kycResponse && kycResponse.workflowState === 'READY_FOR_DAILY_2FA' && kycResponse.success;
    const isOtpRequired = kycResponse && kycResponse.workflowState === 'OTP_VERIFICATION_REQUIRED';
    const isBankEkycRequired = kycResponse && kycResponse.workflowState === 'BANK_EKYC_REQUIRED';

    // Step calculation for progress indicator
    let currentStep = 1;
    if (isOtpRequired) currentStep = 2;
    if (isKycSuccess) currentStep = 3;

    return (
        <div className="min-h-screen bg-slate-50/70 py-10 px-4 flex justify-center items-center font-['Inter',sans-serif]">
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white border border-slate-200/80 shadow-[0_20px_50px_rgba(15,23,42,0.08)] rounded-3xl w-full max-w-xl overflow-hidden relative"
            >
                {/* Header Gradient Top Line */}
                <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

                <div className="p-7 md:p-9">
                    {/* Exit Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => navigate(provider === 'fingpay' ? '/aeps-1' : '/aeps-2')}
                            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition cursor-pointer group"
                        >
                            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                            Exit KYC
                        </button>
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={12} />
                            Fingpay AEPS eKYC
                        </span>
                    </div>

                    {/* Page Title */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <Fingerprint size={24} />
                            </div>
                            <div>
                                Merchant AEPS eKYC
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                    Verify your identity to activate Aadhaar payment services
                                </p>
                            </div>
                        </h1>
                    </div>

                    {/* Workflow Progress Bar */}
                    <div className="mb-8 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                            <span className={currentStep >= 1 ? "text-blue-600 font-black" : ""}>1. Fingerprint Scan</span>
                            <span className={currentStep >= 2 ? "text-blue-600 font-black" : ""}>2. OTP Verification</span>
                            <span className={currentStep === 3 ? "text-emerald-600 font-black" : ""}>3. Complete</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                            <div
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-500 rounded-full"
                                style={{ width: currentStep === 1 ? '33%' : currentStep === 2 ? '66%' : '100%' }}
                            />
                        </div>
                    </div>

                    {/* STEP 1: FINGERPRINT CAPTURE SCREEN */}
                    <AnimatePresence mode="wait">
                        {!isOtpRequired && !isKycSuccess && !isBankEkycRequired && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-6"
                            >
                                {/* RD Device diagnostic panel */}
                                <DeviceStatus />

                                {/* Capture elements */}
                                {device && (
                                    <div className="border border-slate-200/80 bg-slate-50/50 rounded-2xl p-5 space-y-4">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                                            <Fingerprint size={16} className="text-blue-600" />
                                            Step 1: Capture Biometric Data
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Place your finger firmly on the Mantra scanner and click the button below to capture your FMR biometric record.
                                        </p>

                                        <CaptureButton />
                                        <CaptureLoader />
                                        <CaptureError />
                                        <CaptureSuccess />

                                        {captureResult && (
                                            <button
                                                type="button"
                                                onClick={handleKycSubmit}
                                                disabled={submitting}
                                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 disabled:opacity-50 mt-4"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Initiating OTP Request...
                                                    </>
                                                ) : (
                                                    <>
                                                        <ShieldCheck size={18} />
                                                        Submit Biometric & Request OTP
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {kycError && (
                                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3.5 rounded-2xl flex items-start gap-2.5 font-medium shadow-sm">
                                        <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                                        <div className="leading-snug">{kycError}</div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {isBankEkycRequired && (
                            <motion.div
                                key="bank-ekyc-required"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="space-y-6"
                            >
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                                    <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-amber-500/20">
                                        <AlertCircle size={22} />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Bank eKYC Required</h3>
                                    <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                                        {kycResponse?.message || 'Your merchant profile is registered, but Fingpay requires the bank eKYC step to be completed before transactions can be enabled.'}
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: OTP VERIFICATION SCREEN */}
                        {isOtpRequired && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="space-y-6"
                            >
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 rounded-2xl p-5 text-center relative overflow-hidden">
                                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20">
                                        <Smartphone size={22} />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Enter 6-Digit OTP</h3>
                                    <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                                        A 6-digit verification code has been sent to your Fingpay registered mobile number.
                                    </p>
                                    {(kycResponse?.providerReference || kycResponse?.providerTxnId) && (
                                        <div className="inline-block mt-2 px-3 py-1 bg-white border border-blue-200 rounded-full text-[11px] font-bold text-blue-700 shadow-xs">
                                            Txn Ref: <span className="font-mono">{kycResponse?.providerReference || kycResponse?.providerTxnId}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                                        <KeyRound size={14} className="text-blue-600" />
                                        Verification OTP Code
                                    </label>
                                    <input
                                        type="text"
                                        maxLength="6"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="••••••"
                                        className="w-full px-4 py-4 border-2 border-slate-200 focus:border-blue-600 rounded-2xl text-center font-mono font-bold tracking-[0.4em] text-2xl text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                                        autoFocus
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={handleOtpSubmit}
                                    disabled={submittingOtp || otpCode.length !== 6}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {submittingOtp ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Verifying OTP & Submitting eKYC...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={18} />
                                            Verify OTP & Complete eKYC
                                        </>
                                    )}
                                </button>

                                {otpError && (
                                    <div className="space-y-3">
                                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3.5 rounded-2xl flex items-start gap-2.5 font-medium shadow-sm">
                                            <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                                            <div className="leading-snug">{otpError}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setKycResponse(null);
                                                setOtpError('');
                                                setOtpCode('');
                                            }}
                                            className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <RefreshCw size={14} />
                                            Re-capture Biometrics & Request New OTP
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* STEP 3: SUCCESS SCREEN */}
                        {isKycSuccess && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-6 text-center py-4"
                            >
                                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
                                    <CheckCircle2 size={42} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Merchant eKYC Verified</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1 max-w-sm mx-auto leading-relaxed">
                                        Your Fingpay eKYC merchant authentication is completed. Your AEPS terminal is now active.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left text-xs space-y-2">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Verification Status</span>
                                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                                            <Check size={14} /> Approved & Active
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Provider</span>
                                        <span className="font-bold text-slate-700 uppercase">Fingpay AEPS</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => navigate(provider === 'fingpay' ? '/aeps-1' : '/aeps-2')}
                                    className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    Proceed to AEPS Terminal
                                    <ChevronRight size={16} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
