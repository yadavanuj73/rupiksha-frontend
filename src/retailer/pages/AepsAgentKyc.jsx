import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, CheckCircle2, RefreshCw, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { aepsService } from '../../services/apiService';

// Mantra RD Service runs locally at port 11100 or 11101
const MANTRA_PORTS = [11100, 11101, 11102];

const AepsAgentKyc = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('capture'); // capture | otp | success | error
    const [loading, setLoading] = useState(false);
    const [deviceStatus, setDeviceStatus] = useState('checking'); // checking | ready | notfound
    const [pidData, setPidData] = useState(null);
    const [kycResponse, setKycResponse] = useState(null);
    const [otp, setOtp] = useState('');
    const [kycRefId, setKycRefId] = useState('');
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);
    const [agentInfo, setAgentInfo] = useState({ agentId: '', merchantId: '' });
    const [aadhaarInput, setAadhaarInput] = useState(''); // manual aadhaar input

    useEffect(() => {
        // Get user from localStorage
        const impUser = localStorage.getItem('rupiksha_imp_user');
        const normalUser = localStorage.getItem('rupiksha_user');
        const currentUser = impUser ? JSON.parse(impUser) : (normalUser ? JSON.parse(normalUser) : null);
        setUser(currentUser);

        // Get agent info from status API
        const loadStatus = async () => {
            try {
                const mobile = currentUser?.mobile || currentUser?.username;
                if (!mobile) return;
                const status = await aepsService.checkStatus(mobile);
                if (!status?.onboarded) {
                    navigate('/aeps-kyc'); // Go to onboarding first
                    return;
                }
                if (status?.kycDone) {
                    navigate('/aeps'); // KYC already done
                    return;
                }
                setAgentInfo({
                    agentId: status.agentId || '',
                    merchantId: status.merchantId || ''
                });
            } catch (e) {
                console.error('Status check failed', e);
            }
        };
        loadStatus();
        checkMantraDevice();
    }, []);

    // Check if Mantra RD Service is running
    const checkMantraDevice = async () => {
        setDeviceStatus('checking');
        for (const port of MANTRA_PORTS) {
            try {
                const res = await fetch(`http://127.0.0.1:${port}/rd/info`, {
                    method: 'DEVICEINFO',
                    headers: { 'Content-Type': 'text/xml' }
                });
                if (res.ok) {
                    setDeviceStatus('ready');
                    return;
                }
            } catch (e) {
                // Try next port
            }
        }
        setDeviceStatus('notfound');
    };

    // Capture fingerprint from Mantra device
    const captureFingerprint = async () => {
        setLoading(true);
        setError('');
        try {
            // Try each port
            let captured = false;
            for (const port of MANTRA_PORTS) {
                try {
                    const xmlBody = `<?xml version="1.0"?>
<PidOptions ver="1.0">
  <Opts fCount="1" fType="2" iCount="0" iType="" pCount="0" pType="" format="0" pidVer="2.0" timeout="10000" posh="UNKNOWN" env="P" wadh="" />
  <CustOpts><Param name="mantrakey" value="" /></CustOpts>
</PidOptions>`;

                    const response = await fetch(`http://127.0.0.1:${port}/rd/capture`, {
                        method: 'CAPTURE',
                        headers: { 'Content-Type': 'text/xml' },
                        body: xmlBody
                    });

                    if (response.ok) {
                        const text = await response.text();
                        // Parse PID XML response
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(text, 'text/xml');
                        const pidDataEl = xmlDoc.querySelector('PidData');
                        const resp = xmlDoc.querySelector('Resp');
                        const errCode = resp?.getAttribute('errCode');

                        if (errCode === '0' || errCode === null) {
                            // Success — encode full XML as base64
                            const base64Pid = btoa(unescape(encodeURIComponent(text)));
                            setPidData(base64Pid);
                            setDeviceStatus('ready');
                            captured = true;
                            break;
                        } else {
                            const errInfo = resp?.getAttribute('errInfo') || 'Capture failed';
                            setError(`Device error: ${errInfo}`);
                        }
                    }
                } catch (portErr) {
                    // Try next port
                }
            }
            if (!captured && !error) {
                setError('No fingerprint captured. Make sure Mantra RD Service is running and device is connected.');
                setDeviceStatus('notfound');
            }
        } catch (e) {
            setError('Failed to capture: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Submit KYC to Levin
    const submitKyc = async () => {
        if (!pidData) {
            setError('Please capture fingerprint first');
            return;
        }
        const aadhaar = user?.aadhaarNumber || aadhaarInput;
        if (!aadhaar || aadhaar.length !== 12) {
            setError('Please enter a valid 12-digit Aadhaar number below');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const mobile = user?.mobile || user?.username || '';
            const aadhaar = user?.aadhaarNumber || aadhaarInput;

            const payload = {
                aadharNumber: aadhaar,
                aepsAgentId: agentInfo.agentId,
                merchantId: agentInfo.merchantId,
                rdpiData: pidData,
                biometricType: 'FMR',
                mobile: mobile
            };

            const result = await aepsService.kyc(payload);
            setKycResponse(result);

            if (result?.statusId === 1) {
                // KYC success
                setStep('success');
            } else if (result?.statusId === 19) {
                // OTP sent — need OTP verification
                setKycRefId(result?.txnid || result?.agentId || '');
                setStep('otp');
            } else {
                setError(result?.message || 'KYC failed. Please try again.');
            }
        } catch (e) {
            setError('KYC submission failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Verify OTP
    const verifyOtp = async () => {
        if (otp.length < 4) {
            setError('Enter valid OTP');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const mobile = user?.mobile || user?.username || '';
            const payload = {
                verifyKycOtp: otp,
                email: user?.email || '',
                contactNumber: mobile,
                kycRefId: kycRefId,
                clientRefId: 'KYC_' + Date.now(),
                aepsAgentId: agentInfo.agentId,
                merchantId: agentInfo.merchantId
            };

            const result = await aepsService.verifyKycOtp(payload);

            if (result?.statusId === 1) {
                setStep('success');
            } else {
                setError(result?.message || 'OTP verification failed');
            }
        } catch (e) {
            setError('OTP verification failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-100"
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button onClick={() => navigate('/aeps')}
                        className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">AEPS Agent KYC</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biometric Verification Required</p>
                    </div>
                </div>

                {/* Step: Fingerprint Capture */}
                {step === 'capture' && (
                    <div className="space-y-6">
                        {/* Device Status */}
                        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                            deviceStatus === 'ready' ? 'bg-emerald-50 border-emerald-200' :
                            deviceStatus === 'notfound' ? 'bg-red-50 border-red-200' :
                            'bg-amber-50 border-amber-200'
                        }`}>
                            {deviceStatus === 'ready' && <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />}
                            {deviceStatus === 'notfound' && <AlertCircle size={20} className="text-red-600 flex-shrink-0" />}
                            {deviceStatus === 'checking' && <RefreshCw size={20} className="text-amber-600 animate-spin flex-shrink-0" />}
                            <div>
                                <p className={`text-xs font-black uppercase tracking-widest ${
                                    deviceStatus === 'ready' ? 'text-emerald-700' :
                                    deviceStatus === 'notfound' ? 'text-red-700' : 'text-amber-700'
                                }`}>
                                    {deviceStatus === 'ready' ? 'Mantra Device Ready' :
                                     deviceStatus === 'notfound' ? 'Device Not Found' : 'Checking Device...'}
                                </p>
                                {deviceStatus === 'notfound' && (
                                    <p className="text-[10px] text-red-600 mt-0.5">
                                        Start Mantra RD Service on your PC and reconnect device
                                    </p>
                                )}
                            </div>
                            {deviceStatus === 'notfound' && (
                                <button onClick={checkMantraDevice}
                                    className="ml-auto px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[10px] font-black uppercase">
                                    Retry
                                </button>
                            )}
                        </div>

                        {/* Fingerprint Icon */}
                        <div className="text-center py-6">
                            <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-4 ${
                                pidData ? 'bg-emerald-100' : 'bg-blue-50'
                            }`}>
                                {pidData
                                    ? <CheckCircle2 size={56} className="text-emerald-500" />
                                    : <Fingerprint size={56} className="text-blue-600" />
                                }
                            </div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                {pidData ? 'Fingerprint Captured!' : 'Place Finger on Device'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">
                                {pidData ? 'Ready to submit KYC' : 'Press capture when ready'}
                            </p>
                        </div>

                        {/* Aadhaar input — always show so user can enter/verify */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Aadhaar Number {user?.aadhaarNumber ? '(from profile)' : '* Enter manually'}
                            </label>
                            <input
                                type="text"
                                maxLength={12}
                                value={user?.aadhaarNumber || aadhaarInput}
                                readOnly={!!user?.aadhaarNumber}
                                onChange={e => setAadhaarInput(e.target.value.replace(/\D/g, ''))}
                                placeholder="12-digit Aadhaar number"
                                className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-semibold text-slate-800 outline-none tracking-widest ${
                                    user?.aadhaarNumber
                                        ? 'bg-slate-50 border-slate-200 text-slate-500'
                                        : 'bg-white border-blue-300 focus:border-blue-500'
                                }`}
                            />
                            {!user?.aadhaarNumber && (
                                <p className="text-[10px] text-amber-600 font-bold">
                                    ⚠️ Aadhaar not in profile — enter it here to proceed
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-[11px] text-red-700 font-bold">{error}</p>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={captureFingerprint}
                                disabled={loading || deviceStatus === 'notfound'}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <><RefreshCw size={16} className="animate-spin" /> Capturing...</> :
                                 <><Fingerprint size={16} /> Capture Fingerprint</>}
                            </button>

                            {pidData && (
                                <button
                                    onClick={submitKyc}
                                    disabled={loading}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? <><RefreshCw size={16} className="animate-spin" /> Submitting KYC...</> :
                                     <><ShieldCheck size={16} /> Submit KYC</>}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Step: OTP Verification */}
                {step === 'otp' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck size={40} className="text-blue-600" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase">OTP Verification</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                An OTP has been sent to your registered mobile number
                            </p>
                        </div>

                        <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter OTP"
                            className="w-full px-4 py-4 border-2 border-slate-200 rounded-xl text-center text-2xl font-black tracking-[0.5em] text-slate-900 outline-none focus:border-blue-500"
                        />

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-[11px] text-red-700 font-bold">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={verifyOtp}
                            disabled={loading || otp.length < 4}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <><RefreshCw size={16} className="animate-spin" /> Verifying...</> : 'Verify OTP'}
                        </button>
                    </div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                    <div className="text-center space-y-6 py-4">
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 size={48} className="text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase">KYC Complete!</h2>
                            <p className="text-slate-500 text-sm mt-2">
                                Your AEPS Agent KYC has been verified successfully.
                            </p>
                            <p className="text-slate-400 text-xs mt-1">
                                You can now perform AEPS transactions.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/aeps')}
                            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all"
                        >
                            Go to AEPS Services
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default AepsAgentKyc;
