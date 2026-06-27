import React, { useState } from 'react';
import { ArrowLeft, Terminal, Code, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRD } from '../hooks/useRD';
import DeviceStatus from '../components/DeviceStatus';
import CaptureButton from '../components/CaptureButton';
import CaptureLoader from '../components/CaptureLoader';
import CaptureError from '../components/CaptureError';
import CaptureSuccess from '../components/CaptureSuccess';
import { aepsService } from '../../services/apiService';
import { useNavigate } from 'react-router-dom';

export default function AepsDeviceTest() {
    const navigate = useNavigate();
    const { captureResult, device } = useRD();
    
    const [verifyingBackend, setVerifyingBackend] = useState(false);
    const [backendResult, setBackendResult] = useState(null);
    const [backendError, setBackendError] = useState('');

    const handleVerifyWithBackend = async () => {
        if (!captureResult || !captureResult.pidXml) return;
        
        setVerifyingBackend(true);
        setBackendResult(null);
        setBackendError('');
        
        try {
            const res = await aepsService.validateRdTest(captureResult.pidXml);
            setBackendResult(res.data);
        } catch (err) {
            console.error("Backend PID XML validation failed", err);
            setBackendError(err.message || "Failed to communicate with backend validator");
        } finally {
            setVerifyingBackend(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] py-12 px-4 flex justify-center items-center font-['Inter',sans-serif]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 shadow-[0_15px_40px_rgb(0,0,0,0.03)] rounded-3xl w-full max-w-3xl overflow-hidden relative"
            >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
                
                <div className="p-8 md:p-10">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition mb-3 cursor-pointer"
                        >
                            <ArrowLeft size={14} />
                            Exit Diagnostics
                        </button>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <Terminal className="text-slate-700" size={32} />
                            Mantra Device Diagnostics
                        </h1>
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-md mt-2">
                            Development Mode Only
                        </span>
                    </div>

                    <div className="space-y-6">
                        {/* Device Health Card */}
                        <DeviceStatus />

                        {/* Capture Components Container */}
                        {device && (
                            <div className="border border-slate-100 rounded-3xl p-6 space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                    <Code size={14} />
                                    Biometric Test Trigger
                                </h3>
                                
                                <CaptureButton />
                                <CaptureLoader />
                                <CaptureError />
                                <CaptureSuccess />

                                {/* Verification with Backend button */}
                                {captureResult && (
                                    <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                                        <button
                                            type="button"
                                            onClick={handleVerifyWithBackend}
                                            disabled={verifyingBackend}
                                            className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                                        >
                                            {verifyingBackend ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Verifying XML on Server...
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck size={16} />
                                                    Validate XML on Server
                                                </>
                                            )}
                                        </button>

                                        {/* Backend verify results */}
                                        {backendResult && (
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-xs font-semibold text-slate-600">
                                                <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1 mb-1">
                                                    <CheckCircle2 size={14} className="text-emerald-500" /> Server Validation Passed
                                                </h4>
                                                <div>• <span className="font-bold text-slate-700">RD Version:</span> {backendResult.rdVersion || 'N/A'}</div>
                                                <div>• <span className="font-bold text-slate-700">PID Version:</span> {backendResult.pidVersion || 'N/A'}</div>
                                                <div>• <span className="font-bold text-slate-700">Scan Quality:</span> {backendResult.captureQuality}%</div>
                                                <div>• <span className="font-bold text-slate-700">Timestamp:</span> {backendResult.timestamp || 'N/A'}</div>
                                                <div className="text-[10px] text-slate-400 mt-1 font-mono break-all leading-normal">{backendResult.message}</div>
                                            </div>
                                        )}

                                        {backendError && (
                                            <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold">
                                                <AlertCircle className="text-rose-500 shrink-0" size={14} />
                                                <div>{backendError}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
