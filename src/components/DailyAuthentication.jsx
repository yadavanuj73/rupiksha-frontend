import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle2, ShieldCheck, AlertCircle, MapPin, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRD } from '../hooks/useRD';
import DeviceStatus from './DeviceStatus';
import CaptureButton from './CaptureButton';
import CaptureLoader from './CaptureLoader';
import CaptureError from './CaptureError';
import CaptureSuccess from './CaptureSuccess';
import { daily2faService } from '../services/aeps/daily2faService';

export default function DailyAuthentication({ provider, serviceType = 'AEPS', onSuccess, onBack }) {
    const { captureResult, device } = useRD();

    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState('');
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [authResponse, setAuthResponse] = useState(null);
    const [authError, setAuthError] = useState('');

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

    const handleAuthenticate = async () => {
        if (!captureResult || !captureResult.pidXml) {
            setAuthError("Please capture your fingerprint first.");
            return;
        }
        if (!location) {
            setAuthError("GPS coordinates are required. Please retry capturing your location.");
            return;
        }

        setSubmitting(true);
        setAuthError('');
        setAuthResponse(null);

        try {
            const res = await daily2faService.authenticate(
                captureResult.pidXml,
                location.latitude,
                location.longitude,
                'FMR',
                provider,
                serviceType
            );
            setAuthResponse(res.data);
        } catch (err) {
            console.error("Daily 2FA authentication failed", err);
            setAuthError(err.message || "Daily authentication verification failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const isSuccess = authResponse && authResponse.workflowState === 'READY_FOR_TRANSACTIONS' && authResponse.success;

    return (
        <div className="w-full text-center font-['Inter',sans-serif]">
            {!isSuccess ? (
                <div className="space-y-6">
                    {/* Header */}
                    <div>
                        <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full mb-2">
                            Daily Session Validation ({serviceType === 'AadhaarPay' ? 'Aadhaar Pay' : 'AEPS'})
                        </span>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">
                            {serviceType === 'AadhaarPay' ? 'Aadhaar Pay 2FA' : 'Daily 2FA Required'}
                        </h2>
                        <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                            Under banking guidelines, you must authenticate your biometrics once daily to process {serviceType === 'AadhaarPay' ? 'Aadhaar Pay' : 'AEPS'} transactions.
                        </p>
                    </div>

                    {/* Geolocation Diagnostic Panel */}
                    <div className="border border-slate-100 rounded-3xl p-5 text-left space-y-3 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <MapPin size={14} className="text-slate-400" />
                                Merchant Location Status
                            </span>
                            {loadingLocation && (
                                <Loader2 size={12} className="animate-spin text-blue-500" />
                            )}
                        </div>

                        {location ? (
                            <div className="text-xs font-semibold text-slate-600">
                                <div className="text-emerald-600 font-bold flex items-center gap-1.5 mb-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                    GPS Resolved Successfully
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100/50 text-[10px] font-bold text-slate-400">
                                    <div>LAT: <span className="text-slate-600 font-black">{location.latitude.toFixed(5)}</span></div>
                                    <div>LNG: <span className="text-slate-600 font-black">{location.longitude.toFixed(5)}</span></div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-xs font-semibold text-slate-500">
                                    {locationError || "Waiting for coordinates resolution..."}
                                </p>
                                <button
                                    onClick={fetchCoordinates}
                                    className="mt-2 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                >
                                    Retry GPS Lock
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Device Status & Capture Controls */}
                    <DeviceStatus />

                    {device && (
                        <div className="border border-slate-100 rounded-3xl p-5 space-y-4">
                            <CaptureButton />
                            <CaptureLoader />
                            <CaptureError />
                            <CaptureSuccess />

                            {captureResult && location && (
                                <button
                                    type="button"
                                    onClick={handleAuthenticate}
                                    disabled={submitting}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 disabled:opacity-50 mt-4"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Authenticating daily session...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={16} />
                                            Verify Daily 2FA
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {authError && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold text-left">
                            <AlertCircle className="text-rose-500 shrink-0" size={14} />
                            <div>{authError}</div>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            onClick={onBack}
                            className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition cursor-pointer"
                        >
                            Back
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 py-6">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-3xl flex items-center justify-center mx-auto shadow-md">
                        <CheckCircle2 size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Daily Session Activated</h3>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                            Your merchant daily transaction session has been verified and registered. Terminal is unlocked.
                        </p>
                    </div>
                    <button
                        onClick={onSuccess}
                        className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition shadow-md cursor-pointer"
                    >
                        Enter Transaction Terminal
                    </button>
                </div>
            )}
        </div>
    );
}
