import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Fingerprint, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRD } from '../../hooks/useRD';
import DeviceStatus from '../../components/DeviceStatus';
import CaptureButton from '../../components/CaptureButton';
import CaptureLoader from '../../components/CaptureLoader';
import CaptureError from '../../components/CaptureError';
import CaptureSuccess from '../../components/CaptureSuccess';
import { kycWorkflowService } from '../../services/aeps/kycService';
import { otpVerificationService } from '../../services/aeps/otpVerificationService';

export default function AepsAgentKyc() {
    const navigate = useNavigate();
    const { captureResult, device } = useRD();

    const [submitting, setSubmitting] = useState(false);
    const [submittingOtp, setSubmittingOtp] = useState(false);
    const [kycResponse, setKycResponse] = useState(null);
    const [kycError, setKycError] = useState('');
    const [otpError, setOtpError] = useState('');
    const [otpCode, setOtpCode] = useState('');

    const handleKycSubmit = async () => {
        if (!captureResult || !captureResult.pidXml) {
            setKycError("Please capture your fingerprint first.");
            return;
        }

        setSubmitting(true);
        setKycError('');
        setKycResponse(null);

        try {
            const res = await kycWorkflowService.submitBiometricKyc(captureResult.pidXml, 'FMR');
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
            setOtpError("Please enter a valid 6-digit OTP.");
            return;
        }

        setSubmittingOtp(true);
        setOtpError('');

        try {
            const res = await otpVerificationService.verifyKycOtp(otpCode);
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

    return (
        <div className="min-h-screen bg-[#f8fafc] py-12 px-4 flex justify-center items-center font-['Inter',sans-serif]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 shadow-[0_15px_40px_rgb(0,0,0,0.03)] rounded-3xl w-full max-w-xl overflow-hidden relative"
            >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
                
                <div className="p-8 md:p-10">
                    {/* Header */}
                    <div className="mb-6">
                        <button
                            onClick={() => navigate('/aeps')}
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition mb-3 cursor-pointer"
                        >
                            <ArrowLeft size={14} />
                            Exit KYC
                        </button>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <Fingerprint className="text-slate-700" size={28} />
                            AEPS Biometric KYC
                        </h1>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                            Complete Aadhaar fingerprint validation to activate AEPS transaction terminal.
                        </p>
                    </div>

                    {!isOtpRequired && !isKycSuccess && (
                        <div className="space-y-6">
                            {/* Device diagnostic panel */}
                            <DeviceStatus />

                            {/* Capture elements */}
                            {device && (
                                <div className="border border-slate-100 rounded-3xl p-5 space-y-4">
                                    <CaptureButton />
                                    <CaptureLoader />
                                    <CaptureError />
                                    <CaptureSuccess />

                                    {captureResult && (
                                        <button
                                            type="button"
                                            onClick={handleKycSubmit}
                                            disabled={submitting}
                                            className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 mt-4"
                                        >
                                            {submitting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Submitting KYC...
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck size={16} />
                                                    Submit Biometric KYC
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}

                            {kycError && (
                                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold">
                                    <AlertCircle className="text-rose-500 shrink-0" size={14} />
                                    <div>{kycError}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* OTP Entry Screen */}
                    {isOtpRequired && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 text-center">
                                <h3 className="text-sm font-black text-blue-800 uppercase tracking-wide">OTP Verification Required</h3>
                                <p className="text-xs text-blue-600 font-semibold mt-1">
                                    Levin provider has generated OTP validation credentials for Transaction ID: <span className="font-bold text-slate-700">{kycResponse.providerReference}</span>.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Enter OTP Code</label>
                                <input
                                    type="text"
                                    maxLength="6"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Enter 6-digit OTP"
                                    className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl text-center font-bold tracking-[0.2em] text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleOtpSubmit}
                                disabled={submittingOtp || otpCode.length !== 6}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 disabled:opacity-50"
                            >
                                {submittingOtp ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Verifying OTP...
                                    </>
                                ) : (
                                    "Verify OTP"
                                )}
                            </button>

                            {otpError && (
                                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold">
                                    <AlertCircle className="text-rose-500 shrink-0" size={14} />
                                    <div>{otpError}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Success Screen */}
                    {isKycSuccess && (
                        <div className="space-y-6 text-center py-6">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-3xl flex items-center justify-center mx-auto shadow-md">
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">KYC Verification Completed</h3>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Your merchant account has been authenticated successfully. AEPS terminal is now active.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/aeps')}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition shadow-md cursor-pointer"
                            >
                                Go to Terminal
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
