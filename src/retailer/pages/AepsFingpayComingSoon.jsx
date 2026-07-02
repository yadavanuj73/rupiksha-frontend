import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, ArrowLeft, Fingerprint, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AepsFingpayComingSoon() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 font-['Inter',sans-serif]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] max-w-lg w-full text-center relative overflow-hidden"
            >
                {/* Decorative gradients */}
                <div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-50 rounded-full blur-xl animate-pulse" />
                <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-violet-50 rounded-full blur-xl animate-pulse" />

                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 relative">
                        <Fingerprint size={32} className="relative z-10" />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-indigo-100/40 rounded-2xl z-0"
                        />
                    </div>
                </div>

                <div className="flex justify-center mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                        <Sparkles size={10} className="text-indigo-500 animate-spin" />
                        AEPS Services 1 (Fingpay)
                    </span>
                </div>

                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">
                    Service Coming Soon
                </h2>

                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                    Fingpay AEPS banking operations are currently undergoing integration. Once the API credentials and credentials setup are completed, you will be able to process transactions here.
                </p>

                <div className="bg-slate-50/80 rounded-2xl p-4 mb-6 border border-slate-100 text-left text-xs font-semibold text-slate-600 space-y-3">
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <Clock size={14} className="text-amber-500" />
                        Integration Pipeline:
                    </div>
                    <div className="pl-6 space-y-1.5">
                        <div className="flex items-center gap-2 text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Frontend layout structures ready
                        </div>
                        <div className="flex items-center gap-2 text-indigo-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            Awaiting Fingpay merchant onboarding API credentials
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            Biometric device testing & live execution
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                    >
                        <ArrowLeft size={12} />
                        Back to Dashboard
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
