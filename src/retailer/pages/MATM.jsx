import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    CreditCard, Landmark, Banknote, History,
    Search, CheckCircle, AlertCircle, RefreshCw, ArrowRight,
    MapPin, Smartphone, User, ShieldCheck, Waves, Layers, BellRing, Phone, Receipt, TrendingUp, Wallet, Terminal
} from 'lucide-react';
import { initSpeech, speak, announceSuccess, announceFailure, announceProcessing, announceError, announceWarning, announceGrandSuccess } from '../../services/speechService';
import { dataService } from '../../services/dataService';
import { userService } from '../../services/apiService';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';

/* ── Constants ── */
const NAVY = '#0f2557';
const NAVY2 = '#1a3a6b';
const NAVY3 = '#2257a8';

const NAV_TABS = [
    { id: 'withdrawal', label: 'Cash Withdrawal', icon: Banknote, color: '#3b82f6' },
    { id: 'balance', label: 'Balance Inquiry', icon: Landmark, color: '#10b981' },
];

const DEVICE_LIST = [
    { id: 'mp63', name: 'MoreFun MP63' },
    { id: 'd180', name: 'Pax D180' },
    { id: 'mpos', name: 'Standard mPOS' },
];

const BANKING_QUICK_LINKS = [
    { id: 'aeps_services_1', label: 'AEPS Services 1', route: '/aeps-1' },
    { id: 'aeps_services_2', label: 'AEPS Services 2', route: '/aeps-2' },
    { id: 'cms', label: 'CMS - Loan EMI', route: '/cms' },
    { id: 'matm', label: 'MATM', route: '/matm' },
    { id: 'add_money', label: 'Add Money', route: '/add-money' },
];

/* ══════════════════════════════════════════════════════════════════
   🏆 GRAND SUCCESS SCREEN
   ══════════════════════════════════════════════════════════════════ */
function GrandSuccessScreen({ title, subtitle, details = [], onReset, resetLabel = '+ New Transaction' }) {
    const DOTS = [
        { x: 8, y: 15, s: 10, dur: 2.1, delay: 0, col: '#10b981' },
        { x: 88, y: 10, s: 7, dur: 2.6, delay: 0.3, col: '#fbbf24' },
        { x: 20, y: 75, s: 14, dur: 1.9, delay: 0.6, col: '#6ee7b7' },
        { x: 78, y: 80, s: 9, dur: 2.4, delay: 0.2, col: '#a78bfa' },
        { x: 50, y: 5, s: 6, dur: 2.8, delay: 0.9, col: '#38bdf8' },
        { x: 5, y: 50, s: 11, dur: 2.0, delay: 1.1, col: '#34d399' },
        { x: 93, y: 45, s: 8, dur: 2.3, delay: 0.4, col: '#fbbf24' },
        { x: 40, y: 90, s: 13, dur: 1.7, delay: 0.8, col: '#10b981' },
        { x: 65, y: 20, s: 5, dur: 3.0, delay: 1.4, col: '#a78bfa' },
        { x: 30, y: 35, s: 7, dur: 2.2, delay: 0.5, col: '#38bdf8' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md" style={{ fontFamily: "'Inter', sans-serif" }}>

            {DOTS.map((d, i) => (
                <motion.div key={i} animate={{ y: [0, -18, 0], opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: d.dur, repeat: Infinity, delay: d.delay }}
                    style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, borderRadius: '50%', background: d.col, pointerEvents: 'none' }} />
            ))}

            <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 30 }} transition={{ type: 'spring', damping: 20 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full text-center relative overflow-hidden shadow-2xl border border-slate-100">

                <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
                    className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                    <CheckCircle size={40} strokeWidth={2.5} />
                </motion.div>

                <h2 className="text-xl font-black text-slate-900 mb-1">{title}</h2>
                <p className="text-xs font-bold text-slate-500 mb-6">{subtitle}</p>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2.5 mb-6 text-xs">
                    {details.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center pb-2 border-b border-slate-200/60 last:border-0 last:pb-0">
                            <span className="font-bold text-slate-400 uppercase text-[10px]">{item.label}</span>
                            <span className="font-black text-slate-800">{item.value}</span>
                        </div>
                    ))}
                </div>

                <button onClick={onReset}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]">
                    {resetLabel}
                </button>
            </motion.div>
        </motion.div>
    );
}

const Icon3D = ({ icon: Icon, color, size = 38, shadow }) => (
    <div style={{
        width: size, height: size, borderRadius: size * 0.32,
        background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: shadow || `0 8px 16px ${color}40, inset 0 1px 0 rgba(255,255,255,0.3)`,
        position: 'relative', overflow: 'hidden'
    }}>
        <div style={{ position: 'absolute', top: '10%', left: '10%', right: '40%', bottom: '40%', background: 'rgba(255,255,255,0.25)', borderRadius: '50%', filter: 'blur(3px)' }} />
        <Icon size={size * 0.5} color="white" strokeWidth={2.5} />
    </div>
);

/* ══════════════════════════════════════════════════════════════════
   🏧 MAIN MATM COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const MATM = () => {
    const [tab, setTab] = useState('withdrawal');
    const [device, setDevice] = useState('mp63');
    const [mobile, setMobile] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [serviceDisabled, setServiceDisabled] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastTx, setLastTx] = useState(null);
    const [user, setUser] = useState(null);
    const [location, setLocation] = useState({ lat: '...', long: '...' });
    const navigate = useNavigate();
    const currentPath = useLocation().pathname;

    useEffect(() => {
        const currentUser = dataService.getCurrentUser();
        setUser(currentUser);
        dataService.verifyLocation().then(loc => setLocation(loc));
    }, []);

    const handleTransaction = async () => {
        if (!mobile || mobile.length < 10) { announceWarning('सही मोबाइल नंबर दर्ज करें'); return; }
        if (tab === 'withdrawal' && (!amount || amount < 100)) { announceWarning('निकासी कम से कम 100 होनी चाहिए'); return; }

        setLoading(true);
        initSpeech();
        announceProcessing("Micro-ATM डिवाइस कनेक्ट हो रहा है। कृपया कार्ड स्वाइप करें और पिन दर्ज करें।");

        setTimeout(async () => {
            const txData = {
                type: tab === 'withdrawal' ? 'Withdrawal' : 'Inquiry',
                amount: tab === 'withdrawal' ? amount : '—',
                card: 'XXXX XXXX XXXX 4242',
                bank: 'STATE BANK OF INDIA',
                txId: 'MATM' + Date.now(),
                date: new Date().toLocaleString()
            };
            setLastTx(txData);
            announceGrandSuccess("सफल रहा।", "निकासी सफल रही।");

            try {
                const { default: confetti } = await import('canvas-confetti');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            } catch (e) { }

            setShowSuccess(true);
            setLoading(false);
        }, 3000);
    };

    if (showSuccess) return (
        <div className="h-full bg-slate-50 overflow-y-auto">
            <GrandSuccessScreen
                title={`${tab === 'withdrawal' ? 'Withdrawal' : 'Balance Inquiry'} Success! 🎉`}
                subtitle="Request processed successfully via Micro-ATM Switch"
                details={[
                    { label: 'Merchant', value: 'RUPIKSHA DIGITAL' },
                    { label: 'Bank Name', value: lastTx.bank },
                    { label: 'Card Number', value: lastTx.card },
                    { label: 'Transaction ID', value: lastTx.txId },
                    { label: 'Date & Time', value: lastTx.date },
                    lastTx.amount !== '—' ? { label: 'Amount Debited', value: `₹${Number(lastTx.amount).toLocaleString('en-IN')}`, highlight: true } : { label: 'Status', value: 'Active', highlight: true }
                ]}
                onReset={() => { setShowSuccess(false); setAmount(''); setMobile(''); }}
                resetLabel="Process New Card"
            />
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Icon3D icon={Terminal} color={NAVY} size={40} />
                        <div>
                            <h1 className="text-lg font-black text-slate-900">Micro-ATM Hub</h1>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Premium Card Swiping Services</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase">Device Connected</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    {NAV_TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${tab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200'}`}>
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {BANKING_QUICK_LINKS.map((item) => {
                        const isCurrent = currentPath === item.route;
                        return (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.route)}
                                className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                                    isCurrent
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                                }`}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 max-w-7xl mx-auto">
                    {/* Left Form */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <CreditCard size={28} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-900 uppercase">Input Transaction Details</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Ready for Swiping / Insertion</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase px-1">Micro-ATM Device</label>
                                <select value={device} onChange={e => setDevice(e.target.value)}
                                    className="w-full py-3.5 px-4 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:border-blue-500 transition-all">
                                    {DEVICE_LIST.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase px-1">Customer Mobile</label>
                                <div className="relative">
                                    <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input type="text" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Mobile Number" className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:border-blue-500 focus:bg-white" />
                                </div>
                            </div>
                        </div>

                        {tab === 'withdrawal' && (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase px-1">Amount to Withdraw</label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-200">₹</span>
                                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                                        placeholder="0" className="w-full pl-12 pr-4 py-6 rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-5xl text-slate-900 outline-none focus:border-blue-500 focus:bg-white" />
                                </div>
                                <div className="flex gap-2">
                                    {[500, 1000, 2000, 5000].map(v => (
                                        <button key={v} onClick={() => setAmount(v)} className="flex-1 py-2 rounded-xl bg-slate-100 text-[10px] font-black text-slate-500 hover:bg-blue-600 hover:text-white transition-all">₹{v}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <motion.button onClick={handleTransaction} disabled={loading}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                            className="w-full py-5 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest shadow-2xl relative overflow-hidden">
                            {loading ? <span className="flex items-center justify-center gap-3"><RefreshCw size={20} className="animate-spin" /> WAITING FOR DEVICE...</span>
                                : <span className="flex items-center justify-center gap-3"><Terminal size={20} /> INITIATE MATM TRANSACTION</span>}
                        </motion.button>
                        <div className="flex items-center justify-center gap-6 opacity-30 grayscale pt-2">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" className="h-4" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png" className="h-4" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Rupay-Logo.png/1200px-Rupay-Logo.png" className="h-4" />
                        </div>
                    </div>

                    {/* Right Unified Hub */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
                        {/* Wallet */}
                        <div className="p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50" />
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Wallet size={14} className="text-blue-500" /> Settled Wallet
                            </h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-400">₹</span>
                                <span className="text-4xl font-black text-slate-900 tracking-tighter">{user?.wallet?.balance || "0.00"}</span>
                            </div>
                            <div className="mt-4 flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100 w-fit">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[9px] font-black text-blue-700 uppercase">Live MATM Settlements</span>
                            </div>
                        </div>

                        {/* Bank */}
                        <div className="p-8">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Landmark size={14} className="text-emerald-500" /> Settlement Bank
                            </h3>
                            {user?.banks?.[0] ? (
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                    <h4 className="text-xs font-black text-slate-900 uppercase mb-2">{user.banks[0].bankName}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Account</p><p className="text-[10px] font-black text-slate-900">XXXX{user.banks[0].accountNumber?.slice(-4)}</p></div>
                                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">IFSC</p><p className="text-[10px] font-black text-slate-900">{user.banks[0].ifscCode}</p></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 text-center"><p className="text-[9px] font-bold text-orange-600">No Bank Linked</p></div>
                            )}
                        </div>

                        {/* Location */}
                        <div className="p-8 bg-slate-50/50">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2">
                                <MapPin size={14} className="text-red-500" /> Live Geo-Lock
                            </h3>
                            <div className="w-full h-32 rounded-2xl overflow-hidden border border-slate-200 bg-white relative">
                                {location.lat !== '...' ? (
                                    <iframe width="100%" height="100%" frameBorder="0" src={`https://maps.google.com/maps?q=${location.lat},${location.long}&z=14&output=embed`} className="grayscale-[20%]" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"><div className="w-5 h-5 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin" /></div>
                                )}
                            </div>
                            <div className="flex justify-between mt-3 px-1">
                                <div className="flex gap-4">
                                    <div><span className="text-[8px] font-bold text-slate-400 uppercase mr-1">Lat</span><span className="text-[10px] font-black text-slate-900">{location.lat}</span></div>
                                    <div><span className="text-[8px] font-bold text-slate-400 uppercase mr-1">Long</span><span className="text-[10px] font-black text-slate-900">{location.long}</span></div>
                                </div>
                                <ShieldCheck size={12} className="text-emerald-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MATM;
