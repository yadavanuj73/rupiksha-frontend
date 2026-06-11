import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, CheckCircle2, RefreshCw, ArrowLeft, ShieldCheck, AlertCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { aepsService } from '../../services/apiService';

// Mantra RD Service ports
const MANTRA_PORTS = [11100, 11101, 11102];

const AepsAgentKyc = () => {
    const navigate = useNavigate();
    const [phase, setPhase] = useState('idle'); // idle | capturing | submitting | otp | success | failed
    const [deviceStatus, setDeviceStatus] = useState('checking'); // checking | ready | notfound
    const [error, setError] = useState('');
    const [otp, setOtp] = useState('');
    const [kycRefId, setKycRefId] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [agentInfo, setAgentInfo] = useState({ agentId: '', merchantId: '' });
    const [aadhaarInput, setAadhaarInput] = useState('');

    useEffect(() => {
        const impUser = localStorage.getItem('rupiksha_imp_user');
        const normalUser = localStorage.getItem('rupiksha_user');
        const currentUser = impUser ? JSON.parse(impUser) : (normalUser ? JSON.parse(normalUser) : null);
        setUser(currentUser);
        if (currentUser?.aadhaarNumber) setAadhaarInput(currentUser.aadhaarNumber);

        const loadStatus = async () => {
            try {
                const mobile = currentUser?.mobile || currentUser?.username;
                if (!mobile) return;
                const status = await aepsService.checkStatus(mobile);
                if (!status?.onboarded) { navigate('/aeps-kyc'); return; }
                if (status?.kycDone) { navigate('/aeps'); return; }
                setAgentInfo({ agentId: status.agentId || '', merchantId: status.merchantId || '' });
            } catch (e) { console.error('Status check failed', e); }
        };
        loadStatus();
        checkDevice();
    }, []);

    const checkDevice = async () => {
        setDeviceStatus('checking');
        for (const port of MANTRA_PORTS) {
            try {
                const res = await fetch(`http://127.0.0.1:${port}/rd/info`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/xml' },
                    body: '<?xml version="1.0"?><DeviceInfo/>'
                });
                if (res.ok || res.status === 200) {
                    setDeviceStatus('ready');
                    return;
                }
            } catch (e) { /* try next */ }
        }
        // Mark ready anyway — capture will fail gracefully if device not connected
        setDeviceStatus('ready');
    };

    // Single button click: capture fingerprint then auto-submit KYC
    const captureAndSubmit = async () => {
        const aadhaar = aadhaarInput.trim();
        if (!aadhaar || aadhaar.length !== 12) {
            setError('Please enter your 12-digit Aadhaar number first');
            return;
        }

        setError('');
        setPhase('capturing');

        // Step 1: Capture fingerprint from Mantra RD Service
        // Mantra RD Service uses POST method (not custom CAPTURE method)
        let pidData = null;
        const xmlBody = `<?xml version="1.0"?><PidOptions ver="1.0"><Opts fCount="1" fType="2" iCount="0" iType="" pCount="0" pType="" format="0" pidVer="2.0" timeout="10000" posh="UNKNOWN" env="P" wadh="" /><CustOpts><Param name="mantrakey" value="" /></CustOpts></PidOptions>`;

        for (const port of MANTRA_PORTS) {
            try {
                const response = await fetch(`http://127.0.0.1:${port}/rd/capture`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
                    body: xmlBody
                });
                if (response.ok || response.status === 200) {
                    const text = await response.text();
                    if (!text || text.trim() === '') continue;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, 'text/xml');
                    const resp = xmlDoc.querySelector('Resp');
                    const errCode = resp?.getAttribute('errCode');
                    if (errCode === '0' || errCode === null || errCode === undefined) {
                        // Valid PID data captured — base64 encode
                        pidData = btoa(unescape(encodeURIComponent(text)));
                        break;
                    } else {
                        const errInfo = resp?.getAttribute('errInfo') || 'Capture failed';
                        setError(`Device error (${errCode}): ${errInfo}`);
                        setPhase('idle');
                        return;
                    }
                }
            } catch (e) {
                console.log(`Port ${port} failed:`, e.message);
                // Continue to next port
            }
        }

        if (!pidData) {
            setError('Fingerprint capture failed. Make sure Mantra RD Service is running and device is connected.');
            setPhase('idle');
            return;
        }

        // Step 2: Auto-submit KYC immediately after capture
        setPhase('submitting');
        try {
            const mobile = user?.mobile || user?.username || '';
            const payload = {
                aadharNumber: aadhaar,
                aepsAgentId: agentInfo.agentId,
                merchantId: agentInfo.merchantId,
                rdpiData: pidData,
                biometricType: 'FMR',
                mobile: mobile
            };

            const result = await aepsService.kyc(payload);

            if (result?.statusId === 1) {
                setPhase('success');
            } else if (result?.statusId === 19) {
                // OTP required
                setKycRefId(result?.txnid || result?.agentId || '');
                setPhase('otp');
            } else {
                setError(result?.message || 'KYC failed. Please retry.');
                setPhase('failed');
            }
        } catch (e) {
            setError('KYC submission error: ' + (e.message || 'Please retry'));
            setPhase('failed');
        }
    };

    const verifyOtp = async () => {
        if (otp.length < 4) { setError('Enter valid OTP'); return; }
        setOtpLoading(true);
        setError('');
        try {
            const mobile = user?.mobile || user?.username || '';
            const result = await aepsService.verifyKycOtp({
                verifyKycOtp: otp,
                email: user?.email || '',
                contactNumber: mobile,
                kycRefId: kycRefId,
                clientRefId: 'KYC_' + Date.now(),
                aepsAgentId: agentInfo.agentId,
                merchantId: agentInfo.merchantId
            });
            if (result?.statusId === 1) {
                setPhase('success');
            } else {
                setError(result?.message || 'OTP verification failed. Retry.');
            }
        } catch (e) {
            setError('OTP error: ' + e.message);
        } finally {
            setOtpLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-100">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button onClick={() => navigate('/aeps')}
                        className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">AEPS Agent KYC</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biometric Verification</p>
                    </div>
                </div>

                {/* OTP Phase */}
                {phase === 'otp' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck size={40} className="text-blue-600" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase">Enter OTP</h2>
                            <p className="text-sm text-slate-500 mt-2">OTP sent to your registered mobile</p>
                        </div>
                        <input type="text" maxLength={6} value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className="w-full px-4 py-4 border-2 border-slate-200 rounded-xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-blue-500" />
                        {error && <p className="text-red-600 text-sm font-bold text-center">{error}</p>}
                        <button onClick={verifyOtp} disabled={otpLoading || otp.length < 4}
                            className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                            {otpLoading ? <><RefreshCw size={16} className="animate-spin" /> Verifying...</> : 'Verify OTP'}
                        </button>
                    </div>
                )}

                {/* Success Phase */}
                {phase === 'success' && (
                    <div className="text-center space-y-6 py-4">
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 size={48} className="text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase">KYC Complete!</h2>
                            <p className="text-slate-500 text-sm mt-2">Your biometric KYC is verified. You can now do AEPS transactions.</p>
                        </div>
                        <button onClick={() => navigate('/aeps')}
                            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all">
                            Go to AEPS Services
                        </button>
                    </div>
                )}

                {/* Idle / Capturing / Submitting / Failed Phase */}
                {(phase === 'idle' || phase === 'capturing' || phase === 'submitting' || phase === 'failed') && (
                    <div className="space-y-5">

                        {/* Device status */}
                        <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
                            deviceStatus === 'ready' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                        }`}>
                            {deviceStatus === 'ready'
                                ? <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                                : <RefreshCw size={18} className="text-amber-600 animate-spin flex-shrink-0" />}
                            <p className={`text-xs font-black uppercase tracking-widest ${
                                deviceStatus === 'ready' ? 'text-emerald-700' : 'text-amber-700'
                            }`}>
                                {deviceStatus === 'ready' ? 'Mantra Device Ready' : 'Checking Device...'}
                            </p>
                        </div>

                        {/* Aadhaar input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Aadhaar Number *
                            </label>
                            <input type="text" maxLength={12}
                                value={aadhaarInput}
                                readOnly={!!user?.aadhaarNumber}
                                onChange={e => setAadhaarInput(e.target.value.replace(/\D/g, ''))}
                                placeholder="12-digit Aadhaar number"
                                className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-semibold tracking-widest outline-none ${
                                    user?.aadhaarNumber
                                        ? 'bg-slate-50 border-slate-200 text-slate-500'
                                        : 'bg-white border-blue-300 focus:border-blue-500 text-slate-800'
                                }`}
                            />
                            {!user?.aadhaarNumber && (
                                <p className="text-[10px] text-amber-600 font-bold">Enter Aadhaar manually — not saved in your profile</p>
                            )}
                        </div>

                        {/* Fingerprint icon */}
                        <div className="text-center py-4">
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-3 transition-all ${
                                phase === 'capturing' ? 'bg-blue-100 animate-pulse' :
                                phase === 'submitting' ? 'bg-amber-100' :
                                phase === 'failed' ? 'bg-red-100' : 'bg-slate-100'
                            }`}>
                                {phase === 'failed'
                                    ? <XCircle size={48} className="text-red-500" />
                                    : phase === 'submitting'
                                    ? <RefreshCw size={48} className="text-amber-500 animate-spin" />
                                    : <Fingerprint size={48} className={phase === 'capturing' ? 'text-blue-600' : 'text-slate-400'} />
                                }
                            </div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                {phase === 'capturing' ? 'Scanning Fingerprint...' :
                                 phase === 'submitting' ? 'Submitting KYC...' :
                                 phase === 'failed' ? 'KYC Failed' :
                                 'Place Finger on Device'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">
                                {phase === 'idle' ? 'Press button below to capture & submit automatically' :
                                 phase === 'capturing' ? 'Keep finger steady...' :
                                 phase === 'submitting' ? 'Sending to Levin...' : ''}
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-[11px] text-red-700 font-bold text-center">{error}</p>
                            </div>
                        )}

                        {/* Single action button */}
                        <button
                            onClick={captureAndSubmit}
                            disabled={phase === 'capturing' || phase === 'submitting'}
                            className={`w-full py-4 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                                phase === 'failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {phase === 'capturing' ? <><RefreshCw size={16} className="animate-spin" /> Capturing...</> :
                             phase === 'submitting' ? <><RefreshCw size={16} className="animate-spin" /> Submitting KYC...</> :
                             phase === 'failed' ? <><Fingerprint size={16} /> Retry KYC</> :
                             <><Fingerprint size={16} /> Capture & Submit KYC</>}
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default AepsAgentKyc;
