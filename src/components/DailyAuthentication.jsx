import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, CheckCircle2, ShieldCheck, AlertCircle, MapPin, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRD } from '../hooks/useRD';
import DeviceStatus from './DeviceStatus';
import CaptureButton from './CaptureButton';
import CaptureLoader from './CaptureLoader';
import CaptureError from './CaptureError';
import CaptureSuccess from './CaptureSuccess';
import { daily2faService } from '../services/aeps/daily2faService';

export default function DailyAuthentication({ provider, serviceType = 'AEPS', onSuccess, onBack }) {
    const navigate = useNavigate();
    const { captureResult, device, reset } = useRD();

    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState('');
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [authResponse, setAuthResponse] = useState(null);
    const [authError, setAuthError] = useState('');
    const [kycReset, setKycReset] = useState(false);

    const fetchCoordinates = () => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser.");
            return;
        }

        setLoadingLocation(true);
        setLocationError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                setLoadingLocation(false);
            },
            (error) => {
                console.error("GPS capture failed", error);
                let msg = "Failed to resolve GPS coordinates. Please grant location permissions.";
                if (error.code === error.PERMISSION_DENIED) {
                    msg = "Location permission denied. Please enable location access in browser settings.";
                }
                setLocationError(msg);
                setLoadingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    useEffect(() => {
        fetchCoordinates();
    }, []);

    const handleAuthenticate = async (customResult = null) => {
        const activeCapture = (customResult && customResult.pidXml) ? customResult : captureResult;
        if (!activeCapture || !activeCapture.pidXml) {
            setAuthError("Please capture your fingerprint first.");
            return;
        }
        if (!location) {
            setAuthError("GPS coordinates are required. Please grant location access.");
            return;
        }

        setSubmitting(true);
        setAuthError('');
        setAuthResponse(null);
        setKycReset(false);

        try {
            const res = await daily2faService.authenticate(
                activeCapture.pidXml,
                location.latitude,
                location.longitude,
                'FMR',
                provider,
                serviceType
            );
            const data = res.data;
            setAuthResponse(data);

            if (data && data.success) {
                if (reset) reset();
                if (onSuccess) {
                    onSuccess();
                }
            } else if (data && data.workflowState === 'KYC_REQUIRED' && !data.success) {
                if (reset) reset();
                setKycReset(true);
                setAuthError(data.message || "Your merchant profile is invalid. You need to redo Biometric KYC.");
                setTimeout(() => {
                    navigate(`/aeps-agent-kyc?provider=${provider}`);
                }, 3000);
            } else {
                if (reset) reset();
                setAuthError(data?.message || res?.message || "2FA authentication declined by bank gateway.");
            }
        } catch (err) {
            console.error("Daily 2FA authentication failed", err);
            if (reset) reset();
            setAuthError(err.message || "Daily authentication verification failed.");
        } finally {
            setSubmitting(false);
        }
    };

    // Auto-proceed immediately upon biometric scan completion
    useEffect(() => {
        if (captureResult && captureResult.pidXml && !submitting && !authResponse?.success && location) {
            handleAuthenticate(captureResult);
        }
    }, [captureResult, location]);

    const isSuccess = authResponse && authResponse.workflowState === 'READY_FOR_TRANSACTIONS' && authResponse.success;

    return (
        <div className="w-full text-center font-['Inter',sans-serif] text-black">
            {!isSuccess ? (
                <div className="space-y-3">
                    {/* Header */}
                    <div>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="inline-block px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-950 text-[9px] font-black uppercase tracking-wider rounded-full">
                                Daily Session Validation ({serviceType === 'AadhaarPay' ? 'Aadhaar Pay' : 'AEPS'})
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-black uppercase tracking-tight">
                            {serviceType === 'AadhaarPay' ? 'Aadhaar Pay 2FA' : 'Daily 2FA Required'}
                        </h2>
                        <p className="text-slate-600 text-[11px] font-bold mt-0.5">
                            Authenticate your biometric once daily to unlock AEPS banking operations.
                        </p>
                    </div>

                    {/* Geolocation Diagnostic Panel */}
                    <div className="border border-slate-300 rounded-2xl p-2.5 text-left bg-slate-50/80">
                        <div className="flex items-center justify-between text-[11px] font-black">
                            <span className="text-black uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin size={13} className="text-blue-700 font-bold" />
                                Merchant Location
                            </span>
                            {loadingLocation && (
                                <Loader2 size={12} className="animate-spin text-blue-600" />
                            )}
                        </div>

                        {location ? (
                            <div className="flex items-center justify-between mt-1 text-[10.5px] font-bold">
                                <div className="text-emerald-800 font-black flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping" />
                                    GPS Resolved
                                </div>
                                <div className="text-black font-mono font-bold">
                                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-1 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-slate-600">
                                    {locationError || "Resolving GPS..."}
                                </p>
                                <button
                                    type="button"
                                    onClick={fetchCoordinates}
                                    className="text-[9px] font-black text-blue-700 hover:text-blue-900 uppercase cursor-pointer"
                                >
                                    Retry GPS
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Device Status & Capture Controls */}
                    <DeviceStatus />

                    {device && (
                        <div className="border border-slate-300 rounded-2xl p-3 space-y-2 bg-white">
                            <CaptureButton onCaptureSuccess={handleAuthenticate} />
                            <CaptureLoader />
                            <CaptureError />
                            {!authError && !submitting && <CaptureSuccess />}

                            {/* Processing or Instruction Status */}
                            {submitting ? (
                                <div className="w-full py-2.5 px-3 bg-slate-950 text-white rounded-xl font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 shadow-md animate-pulse">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                                    <span>Verifying Daily 2FA Session...</span>
                                </div>
                            ) : (
                                <p className="text-[10px] text-center text-slate-500 font-bold">
                                    Scan registered fingerprint above — 2FA will automatically verify.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Error Alerts */}
                    {authError && (
                        <div className={`${kycReset ? 'bg-amber-100 border-amber-300 text-amber-950' : 'bg-rose-100 border-rose-300 text-rose-950'} border text-xs p-2.5 rounded-2xl flex items-start gap-2 font-black text-left`}>
                            <AlertCircle className={`${kycReset ? 'text-amber-700' : 'text-rose-700'} shrink-0 mt-0.5`} size={15} />
                            <div>
                                <div className="text-xs font-black leading-tight">{authError}</div>
                                {kycReset && (
                                    <div className="mt-1 text-[10px] font-bold text-amber-900">
                                        Redirecting to Biometric KYC...{' '}
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/aeps-agent-kyc?provider=${provider}`)}
                                            className="underline text-blue-700 hover:text-blue-900 cursor-pointer font-black"
                                        >
                                            Go now →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Back button */}
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-full py-2 border-2 border-slate-300 text-black rounded-xl font-black uppercase tracking-wider text-[11px] hover:bg-slate-100 transition cursor-pointer"
                    >
                        Back to Dashboard
                    </button>
                </div>
            ) : (
                <div className="space-y-4 py-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-black uppercase tracking-wide">Daily Session Activated</h3>
                        <p className="text-xs text-slate-600 font-bold mt-0.5">
                            Your merchant 2FA session is active. Terminal is unlocked.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onSuccess}
                        className="w-full py-3 bg-black hover:bg-slate-900 text-white rounded-2xl font-black uppercase tracking-wider text-xs transition shadow-md cursor-pointer"
                    >
                        Enter Transaction Terminal
                    </button>
                </div>
            )}
        </div>
    );
}
