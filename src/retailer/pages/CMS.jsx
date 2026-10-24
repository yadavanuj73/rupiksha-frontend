import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, RefreshCw, Receipt, BellRing, User
} from 'lucide-react';
import { initSpeech, speak, announceProcessing, announceGrandSuccess, announceWarning } from '../../services/speechService';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';

import { userService } from '../../services/apiService';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';

const NAVY = '#0f2557';
const NAVY3 = '#2257a8';

const Icon3D = ({ icon: Icon, color, size = 48, shadow }) => (
    <div className="flex items-center justify-center rounded-2xl" style={{
        width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}dd)`,
        boxShadow: shadow || `0 8px 16px ${color}40, inset 0 1px 0 rgba(255,255,255,0.3)`,
        position: 'relative', overflow: 'hidden'
    }}>
        <div style={{ position: 'absolute', top: '10%', left: '10%', right: '40%', bottom: '40%', background: 'rgba(255,255,255,0.25)', borderRadius: '50%', filter: 'blur(3px)' }} />
        <Icon size={size * 0.5} color="white" strokeWidth={2.5} />
    </div>
);

const CMS = () => {
    const [biller, setBiller] = useState('');
    const [consumerNo, setConsumerNo] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [serviceDisabled, setServiceDisabled] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkService = async () => {
            try {
                const services = await userService.getUserServices();
                if (services && services.CMS === false) {
                    setServiceDisabled(true);
                }
            } catch (e) {
                console.warn("Could not check CMS service status", e);
            }
        };
        checkService();

        const currentUser = dataService.getCurrentUser();
        setUser(currentUser);
    }, []);

    if (serviceDisabled) {
        return <DisabledServiceBanner serviceName="CMS (Cash Management Service)" />;
    }

    const handlePay = () => {
        if (!biller) { announceWarning('बैलर चुनें'); return; }
        if (!consumerNo) { announceWarning('कस्टमर आईडी डालें'); return; }
        if (!amount) { announceWarning('राशि डालें'); return; }

        setLoading(true);
        initSpeech();
        announceProcessing("सी एम एस भुगतान प्रक्रिया में है।");

        setTimeout(async () => {
            const { default: confetti } = await import('canvas-confetti');
            confetti({ particleCount: 160, spread: 80, origin: { y: 0.5 }, colors: ['#10b981', '#0f2557', '#fbbf24', '#a78bfa', '#38bdf8'] });

            announceGrandSuccess("CMS Payment Successful!", `₹${amount} paid to ${biller}`);
            setShowSuccess(true);
            setLoading(false);
        }, 2000);
    };

    if (showSuccess) return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 max-w-lg w-full text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-emerald-500 mx-auto flex items-center justify-center text-white text-4xl shadow-lg border-8 border-emerald-50">
                    ✓
                </div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Payment Success</h2>
                <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Company</span>
                        <span className="font-black text-slate-800">{biller}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Loan ID</span>
                        <span className="font-black text-slate-800">{consumerNo}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-slate-200 pt-4">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Amount Paid</span>
                        <span className="font-black text-2xl text-emerald-600">₹{Number(amount).toLocaleString('en-IN')}</span>
                    </div>
                </div>
                <button onClick={() => { setShowSuccess(false); setBiller(''); setConsumerNo(''); setAmount(''); }}
                    className="w-full py-4 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest">
                    Pay Another EMI
                </button>
            </motion.div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

            <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div className="flex items-center gap-3">
                        <Icon3D icon={Building2} color="#4f46e5" size={40} />
                        <div>
                            <h1 className="text-lg font-black text-slate-900 leading-none">Fingpay Cms</h1>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Cash Collection & Loan EMI</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Live Billing</span>
                        <button onClick={() => { initSpeech(); speak("फिंगपे सी एम एस में आपका स्वागत है।", "hi-IN"); }}
                            className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-black text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all">
                            <BellRing size={12} /> Voice
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex justify-center items-start">
                <div className="w-full max-w-2xl bg-white rounded-2xl md:rounded-3xl border border-slate-200/90 p-6 sm:p-8 md:p-10 shadow-sm space-y-7 md:space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Receipt size={28} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Loan EMI Payment</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">Direct Settlement Hub</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Biller Category</label>
                            <div className="relative">
                                <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select value={biller} onChange={e => setBiller(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-bold text-sm outline-none focus:border-blue-500 appearance-none cursor-pointer">
                                    <option value="">Select Company</option>
                                    <option value="L&T Finance">L&T Finance</option>
                                    <option value="Hero Fincorp">Hero Fincorp</option>
                                    <option value="Bajaj Finance">Bajaj Finance</option>
                                    <option value="Mahindra Finance">Mahindra Finance</option>
                                    <option value="Muthoot Finance">Muthoot Finance</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Customer / Loan ID</label>
                            <div className="relative">
                                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input value={consumerNo} onChange={e => setConsumerNo(e.target.value)}
                                    placeholder="Enter ID"
                                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:border-blue-500" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Collection Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">₹</span>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                                placeholder="0"
                                className="w-full pl-10 pr-4 py-5 sm:py-6 rounded-2xl border-2 border-slate-200 bg-slate-50 font-black text-3xl sm:text-4xl text-slate-900 outline-none focus:border-blue-500 transition-all" />
                        </div>
                    </div>

                    <motion.button onClick={handlePay} disabled={loading}
                        whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
                        className="w-full py-4 sm:py-5 rounded-2xl text-white font-black text-xs sm:text-sm uppercase tracking-[0.2em] relative overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY3})`, boxShadow: `0 8px 30px ${NAVY}40` }}>
                        <motion.div className="absolute inset-0"
                            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                            animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity }} />
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            {loading ? <><RefreshCw className="animate-spin" size={18} /> PROCESSING...</> : <><Receipt size={18} /> PROCEED EMI COLLECTION</>}
                        </span>
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default CMS;
