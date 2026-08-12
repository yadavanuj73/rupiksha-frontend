import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, ArrowLeft, Sparkles, Server, UserPlus, Fingerprint, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { aepsService, userService } from '../../services/apiService';
import DailyAuthentication from '../../components/DailyAuthentication';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';
import BankingTerminal from '../components/banking/BankingTerminal';

export default function AEPS() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [serviceDisabled, setServiceDisabled] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState({
        onboarded: false,
        kycDone: false,
        agentId: '',
        merchantId: ''
    });

    const provider = window.location.pathname.includes('aeps-1') ? 'fingpay' : 'levin';

    useEffect(() => {
        const rawUser = localStorage.getItem('rupiksha_imp_user') || localStorage.getItem('rupiksha_user');
        if (!rawUser) {
            setError("No active user session found. Please log in.");
            setLoading(false);
            return;
        }

        const fetchStatus = async () => {
            try {
                // Check service enablement first
                try {
                    const services = await userService.getUserServices();
                    if (services && services.AEPS === false) {
                        setServiceDisabled(true);
                        setLoading(false);
                        return;
                    }
                } catch (se) {
                    console.warn("Could not verify user service status", se);
                }

                const parsed = JSON.parse(rawUser);
                const mobile = parsed.mobile;
                if (!mobile) {
                    setError("Mobile number is missing in your user profile.");
                    setLoading(false);
                    return;
                }
                const res = await aepsService.getStatus(mobile, provider);
                setStatus(res);
            } catch (e) {
                console.error("Failed to fetch AEPS status", e);
                setError("Unable to sync AEPS registration status. Check network.");
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, [provider]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin mb-4" />
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Checking registration status...</p>
            </div>
        );
    }

    if (serviceDisabled) {
        return <DisabledServiceBanner serviceName="AEPS" />;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 font-['Inter',sans-serif]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] max-w-lg w-full text-center relative overflow-hidden"
            >
                {/* Accent blobs */}
                <div className="absolute -top-12 -left-12 w-24 h-24 bg-blue-50 rounded-full blur-xl" />
                <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-indigo-50 rounded-full blur-xl" />

                {error ? (
                    <>
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                                <AlertCircle size={32} />
                            </div>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-3">Sync Error</h2>
                        <p className="text-slate-500 text-sm mb-8 leading-relaxed">{error}</p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-blue-700 transition"
                        >
                            Return to Dashboard
                        </button>
                    </>
                ) : !status.onboarded ? (
                    /* Step 1: Onboarding Required */
                    <>
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                <UserPlus size={32} />
                            </div>
                        </div>
                        <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full mb-3">
                            Step 1 of 2
                        </span>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">
                            Onboarding Required
                        </h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">
                            To start using Aadhaar-enabled Payment System (AEPS) banking operations, you must first register your shop and merchant details.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition"
                            >
                                Back
                            </button>
                             <button
                                onClick={() => navigate(`/aeps-onboarding?provider=${provider}`)}
                                className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-1.5"
                            >
                                Start Onboarding
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </>
                ) : !status.kycDone ? (
                    /* Step 2: KYC Required */
                    <>
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <Fingerprint size={32} />
                            </div>
                        </div>
                        <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-full mb-3">
                            Step 2 of 2
                        </span>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">
                            Biometric KYC Required
                        </h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-4">
                            Merchant ID <strong className="text-slate-700 font-black">{status.merchantId}</strong> has been registered. You must complete your Aadhaar Biometric KYC check to start executing transactions.
                        </p>
                        <div className="bg-slate-50/80 rounded-2xl p-4 mb-6 border border-slate-100 text-left text-xs font-semibold text-slate-600 space-y-1.5">
                            <div>• <span className="font-bold text-slate-700">Merchant ID:</span> {status.merchantId}</div>
                            <div>• <span className="font-bold text-slate-700">Agent ID:</span> {status.agentId}</div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => navigate(`/aeps-agent-kyc?provider=${provider}`)}
                                className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-1.5"
                            >
                                Start Biometric KYC
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </>
                ) : !status.aeps2faDone ? (
                    /* Step 3: Daily 2FA Session Verification */
                    <DailyAuthentication
                        provider={provider}
                        serviceType="AEPS"
                        onSuccess={() => setStatus(prev => ({ ...prev, aeps2faDone: true }))}
                        onBack={() => navigate('/dashboard')}
                    />
                ) : (
                    /* Step 4: Fully Active Services */
                    <BankingTerminal provider={provider} status={status} setStatus={setStatus} />
                )}
            </motion.div>
        </div>
    );
}
