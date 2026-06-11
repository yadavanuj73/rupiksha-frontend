import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, CheckCircle2, RefreshCw, ArrowLeft, ShieldCheck, XCircle, Download, Chrome, Usb, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { aepsService } from '../../services/apiService';

const MANTRA_PORTS = [11100, 11101, 11102];

const AepsAgentKyc = () => {
    const navigate = useNavigate();
    const [phase, setPhase] = useState('setup'); // setup | idle | capturing | submitting | otp | success | failed
    const [deviceStatus, setDeviceStatus] = useState('checking');
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
                if (res.ok || res.status === 200) { setDeviceStatus('ready'); return; }
            } catch (e) { /* try next */ }
        }
        setDeviceStatus('ready');
    };

    const captureAndSubmit = async () => {
        const aadhaar = aadhaarInput.trim();
        if (!aadhaar || aadhaar.length !== 12) {
            setError('Please enter your 12-digit Aadhaar number first');
            return;
        }
        setError('');
        setPhase('capturing');

        // Open the local capture page in a popup window
        // This page runs on HTTP (localhost) so it can talk to Mantra RD Service without CORS issues
        const captureWindow = window.open(
            '/mantra-capture.html',
            'MantraCapture',
            'width=420,height=400,left=400,top=200,resizable=no'
        );

        if (!captureWindow) {
            setError('Popup was blocked. Please allow popups for rupiksha.in and try again.');
            setPhase('failed');
            return;
        }

        // Wait for PID data from the popup via postMessage
        const pidData = await new Promise((resolve) => {
            const handler = (event) => {
                if (event.data?.type === 'MANTRA_PID_DATA') {
                    window.removeEventListener('message', handler);
                    resolve(event.data.pidData || null);
                }
            };
            window.addEventListener('message', handler);

            // Check if popup was closed without capturing
            const checkClosed = setInterval(() => {
                if (captureWindow.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', handler);
                    resolve(null);
                }
            }, 500);

            // Timeout after 60 seconds
            setTimeout(() => {
                clearInterval(checkClosed);
                window.removeEventListener('message', handler);
                if (!captureWindow.closed) captureWindow.close();
                resolve(null);
            }, 60000);
        });

        if (!pidData) {
            setError('Fingerprint not captured. Please try again.');
            setPhase('failed');
            return;
        }

        // Auto-submit KYC immediately after capture
        setPhase('submitting');

        setPhase('submitting');
        try {
            const mobile = user?.mobile || user?.username || '';
            const result = await aepsService.kyc({
                aadharNumber: aadhaar,
                aepsAgentId: agentInfo.agentId,
                merchantId: agentInfo.merchantId,
                rdpiData: pidData,
                biometricType: 'FMR',
                mobile: mobile
            });

            if (result?.statusId === 1) {
                setPhase('success');
            } else if (result?.statusId === 19) {
                setKycRefId(result?.txnid || result?.agentId || '');
                setPhase('otp');
            } else {
                setError(result?.message || 'KYC failed. Please retry.');
                setPhase('failed');
            }
        } catch (e) {
            setError('KYC error: ' + (e.message || 'Please retry'));
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
            if (result?.statusId === 1) { setPhase('success'); }
            else { setError(result?.message || 'OTP verification failed'); }
        } catch (e) {
            setError('OTP error: ' + e.message);
        } finally { setOtpLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-100">

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigate('/aeps')}
                        className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">AEPS Agent KYC</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biometric Verification</p>
                    </div>
                </div>

                {/* SETUP INSTRUCTIONS */}
                {phase === 'setup' && (
                    <div className="space-y-4">
                        <div className="text-center mb-2">
                            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Fingerprint size={32} className="text-blue-600" />
                            </div>
                            <h2 className="text-base font-black text-slate-900 uppercase">One-Time PC Setup</h2>
                            <p className="text-[11px] text-slate-500 mt-1">Required before biometric KYC</p>
                        </div>

                        {[
                            { icon: <Usb size={18} className="text-blue-600" />, n: '1', title: 'Connect Mantra Device', desc: 'Plug Mantra MFS100 fingerprint scanner into PC via USB', link: null },
                            { icon: <Download size={18} className="text-emerald-600" />, n: '2', title: 'Install Mantra RD Service', desc: 'Download & install from mantratec.com — runs automatically in background', link: 'https://www.mantratec.com/RD-Service' },
                            { icon: <Chrome size={18} className="text-amber-600" />, n: '3', title: 'Install Chrome Extension', desc: 'Search "Mantra RD Service" in Chrome Web Store and install — fixes browser security restriction', link: 'https://chrome.google.com/webstore/search/mantra+rd+service' },
                            { icon: <Monitor size={18} className="text-purple-600" />, n: '4', title: 'Verify RD Service Running', desc: 'Look for Mantra icon in system tray. If missing, run MantraRDService.exe as Administrator', link: null },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-200">
                                    {item.icon}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800">{item.n}. {item.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                                    {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 font-bold underline">Open download page →</a>}
                                </div>
                            </div>
                        ))}

                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-[10px] text-amber-700 font-bold text-center">⚠️ One-time setup per PC. After this, just plug device and proceed.</p>
                        </div>

                        <button onClick={() => { setPhase('idle'); checkDevice(); }}
                            className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                            <CheckCircle2 size={16} /> Setup Done — Proceed to KYC
                        </button>
                    </div>
                )}

                {/* OTP PHASE */}
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

                {/* SUCCESS */}
                {phase === 'success' && (
                    <div className="text-center space-y-6 py-4">
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 size={48} className="text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase">KYC Complete!</h2>
                            <p className="text-slate-500 text-sm mt-2">Biometric KYC verified. You can now do AEPS transactions.</p>
                        </div>
                        <button onClick={() => navigate('/aeps')}
                            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all">
                            Go to AEPS Services
                        </button>
                    </div>
                )}

                {/* CAPTURE / IDLE / FAILED */}
                {(phase === 'idle' || phase === 'capturing' || phase === 'submitting' || phase === 'failed') && (
                    <div className="space-y-5">

                        {/* Device status */}
                        <div className={`p-3 rounded-2xl border flex items-center gap-3 ${deviceStatus === 'ready' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            {deviceStatus === 'ready'
                                ? <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                                : <RefreshCw size={18} className="text-amber-600 animate-spin flex-shrink-0" />}
                            <p className={`text-xs font-black uppercase tracking-widest ${deviceStatus === 'ready' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {deviceStatus === 'ready' ? 'Mantra Device Ready' : 'Checking Device...'}
                            </p>
                        </div>

                        {/* Aadhaar input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Aadhaar Number *</label>
                            <input type="text" maxLength={12} value={aadhaarInput}
                                readOnly={!!user?.aadhaarNumber}
                                onChange={e => setAadhaarInput(e.target.value.replace(/\D/g, ''))}
                                placeholder="12-digit Aadhaar number"
                                className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-semibold tracking-widest outline-none ${user?.aadhaarNumber ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-white border-blue-300 focus:border-blue-500 text-slate-800'}`}
                            />
                            {!user?.aadhaarNumber && <p className="text-[10px] text-amber-600 font-bold">Enter Aadhaar manually — not in your profile</p>}
                        </div>

                        {/* Fingerprint icon */}
                        <div className="text-center py-3">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 transition-all ${
                                phase === 'capturing' ? 'bg-blue-100 animate-pulse' :
                                phase === 'submitting' ? 'bg-amber-100' :
                                phase === 'failed' ? 'bg-red-100' : 'bg-slate-100'
                            }`}>
                                {phase === 'failed' ? <XCircle size={40} className="text-red-500" /> :
                                 phase === 'submitting' ? <RefreshCw size={40} className="text-amber-500 animate-spin" /> :
                                 <Fingerprint size={40} className={phase === 'capturing' ? 'text-blue-600' : 'text-slate-400'} />}
                            </div>
                            <p className="text-sm font-black text-slate-800 uppercase">
                                {phase === 'capturing' ? 'Fingerprint Popup Opened...' : phase === 'submitting' ? 'Submitting KYC...' : phase === 'failed' ? 'KYC Failed' : 'Place Finger on Device'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1">
                                {phase === 'idle' ? 'Press button below — a popup will open for fingerprint' :
                                 phase === 'capturing' ? 'Complete fingerprint capture in the popup window' : ''}
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-[11px] text-red-700 font-bold text-center">{error}</p>
                                {phase === 'failed' && (
                                    <div className="mt-2 space-y-1 text-center">
                                        <p className="text-[10px] text-slate-600 font-bold">
                                            Make sure popups are allowed for rupiksha.in
                                        </p>
                                        <button onClick={() => setPhase('setup')} className="text-[10px] text-slate-500 font-bold underline block w-full">
                                            View setup instructions →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <button onClick={captureAndSubmit}
                            disabled={phase === 'capturing' || phase === 'submitting'}
                            className={`w-full py-4 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${phase === 'failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {phase === 'capturing' ? <><RefreshCw size={16} className="animate-spin" /> Capturing...</> :
                             phase === 'submitting' ? <><RefreshCw size={16} className="animate-spin" /> Submitting...</> :
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
