import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, RefreshCw, ExternalLink, ShieldCheck, MapPin, 
    Coins, History, AlertTriangle, CheckCircle, Info, BellRing,
    Lock, ArrowRight, UserCheck, Smartphone, Landmark
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { initSpeech, speak, announceProcessing, announceGrandSuccess, announceWarning } from '../../services/speechService';
import { dataService } from '../../services/dataService';
import { userService, fingpayCmsService } from '../../services/apiService';
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
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [serviceDisabled, setServiceDisabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [launchUrl, setLaunchUrl] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [coords, setCoords] = useState({ latitude: '19.0760', longitude: '72.8777', acquired: false });
    const [popupBlocked, setPopupBlocked] = useState(false);

    // Initial check and GPS acquisition
    useEffect(() => {
        const currentUser = dataService.getCurrentUser();
        setUser(currentUser);

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

        // Acquire location via browser geolocation with fallback
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCoords({
                        latitude: pos.coords.latitude.toFixed(6),
                        longitude: pos.coords.longitude.toFixed(6),
                        acquired: true
                    });
                },
                (err) => {
                    console.log("GPS permission not granted or unavailable, using certified state coordinates fallback", err.message);
                },
                { timeout: 8000, enableHighAccuracy: true }
            );
        }
    }, []);

    const handleLaunchCms = async () => {
        setErrorMsg('');
        setPopupBlocked(false);
        setLoading(true);

        initSpeech();
        announceProcessing("फिंगपे सी एम एस पोर्टल तैयार किया जा रहा है।");

        try {
            const response = await fingpayCmsService.launch({
                latitude: coords.latitude,
                longitude: coords.longitude
            });

            if (response && response.success && response.launchUrl) {
                setLaunchUrl(response.launchUrl);

                // Confetti animation
                const { default: confetti } = await import('canvas-confetti');
                confetti({
                    particleCount: 120,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#4f46e5', '#2563eb', '#10b981', '#fbbf24']
                });

                announceGrandSuccess("Fingpay CMS Ready", "Opening secure Fingpay Cash Management portal");

                // Open the authenticated Fingpay Uber CMS web application in a new secure window
                const newWindow = window.open(response.launchUrl, '_blank', 'noopener,noreferrer');
                if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    setPopupBlocked(true);
                }
            } else {
                const msg = response?.message || "Failed to initialize Fingpay CMS session";
                setErrorMsg(msg);
                announceWarning("सी एम एस कनेक्शन विफल रहा");
            }
        } catch (err) {
            console.error("CMS Launch error:", err);
            const msg = err.response?.data?.message || err.message || "Failed to connect to Fingpay CMS provider";
            setErrorMsg(msg);
            announceWarning("कनेक्शन त्रुटि");
        } finally {
            setLoading(false);
        }
    };

    if (serviceDisabled) {
        return <DisabledServiceBanner serviceName="CMS (Cash Management Services)" />;
    }

    const merchantIdDisplay = user?.partyCode || user?.aepsMerchantId || user?.username || user?.mobile || 'CSP-MERCHANT';
    const mobileDisplay = user?.mobile || user?.username || 'N/A';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* Top Navigation & Status Bar */}
            <div className="shrink-0 bg-white border-b border-slate-200/90 px-4 sm:px-6 py-4 shadow-sm">
                <div className="flex items-center justify-between max-w-6xl mx-auto">
                    <div className="flex items-center gap-3">
                        <Icon3D icon={Building2} color="#4f46e5" size={42} />
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg md:text-xl font-black text-slate-900 leading-none">Fingpay Cms</h1>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                                    Uber CMS
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Cash Management Services & Corporate Collections
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Gateway Live</span>
                        </div>
                        <button
                            onClick={() => {
                                initSpeech();
                                speak("फिंगपे सी एम एस कैश मैनेजमेंट सर्विस में आपका स्वागत है।", "hi-IN");
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-black text-slate-600 hover:border-purple-300 hover:text-purple-700 transition-all cursor-pointer"
                        >
                            <BellRing size={12} /> Voice
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Terminal Body */}
            <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">

                {/* Hero Launch Console */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        <div className="lg:col-span-7 space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black uppercase tracking-wider">
                                <ShieldCheck size={14} className="text-indigo-600" /> Authorized Retailer BC Terminal
                            </div>

                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                                Cash Drop & Corporate EMI Collection Terminal
                            </h2>

                            <p className="text-sm font-medium text-slate-600 leading-relaxed">
                                Access the official Fingpay Uber CMS system to process instant cash collections, corporate drops (CDC), and loan repayments for leading financial institutions. Authenticated directly with your Rupiksha retailer BC credentials.
                            </p>

                            {/* Merchant Identity Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">BC Merchant ID</span>
                                    <span className="text-xs font-black text-slate-800 tracking-tight block mt-0.5 truncate">{merchantIdDisplay}</span>
                                </div>
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Registered Mobile</span>
                                    <span className="text-xs font-black text-slate-800 tracking-tight block mt-0.5">{mobileDisplay}</span>
                                </div>
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">GPS Coordinates</span>
                                    <span className="text-xs font-black text-slate-800 tracking-tight block mt-0.5 flex items-center gap-1">
                                        <MapPin size={11} className={coords.acquired ? "text-emerald-500" : "text-amber-500"} />
                                        {coords.latitude}, {coords.longitude}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Panel */}
                        <div className="lg:col-span-5 flex flex-col justify-center items-stretch space-y-4 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-6 sm:p-8 rounded-3xl border border-slate-200/80">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Terminal Status</span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ready To Launch
                                </span>
                            </div>

                            {errorMsg && (
                                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            {popupBlocked && (
                                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Info size={16} className="shrink-0 text-amber-600" />
                                        <span>Browser blocked the popup window.</span>
                                    </div>
                                    <a
                                        href={launchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-black uppercase tracking-wider hover:bg-amber-700 transition-colors"
                                    >
                                        Click To Open Fingpay CMS <ExternalLink size={12} />
                                    </a>
                                </div>
                            )}

                            {/* Main Launch Button */}
                            <motion.button
                                onClick={handleLaunchCms}
                                disabled={loading}
                                whileHover={{ scale: 1.01, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-4 sm:py-4.5 rounded-2xl text-white font-black text-xs sm:text-sm uppercase tracking-widest relative overflow-hidden shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2.5"
                                style={{
                                    background: `linear-gradient(135deg, ${NAVY}, ${NAVY3})`,
                                    boxShadow: `0 8px 24px ${NAVY}40`
                                }}
                            >
                                <motion.div
                                    className="absolute inset-0"
                                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }}
                                    animate={{ x: ['-100%', '200%'] }}
                                    transition={{ duration: 2.2, repeat: Infinity }}
                                />
                                <span className="relative z-10 flex items-center justify-center gap-2.5">
                                    {loading ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={18} />
                                            INITIALIZING TERMINAL...
                                        </>
                                    ) : (
                                        <>
                                            <ExternalLink size={18} />
                                            OPEN FINGPAY UBER CMS
                                        </>
                                    )}
                                </span>
                            </motion.button>

                            {/* Secondary Link to History */}
                            <button
                                onClick={() => navigate('/reports?report=fingpay_cms')}
                                className="w-full py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                                <History size={15} className="text-purple-600" />
                                View CMS Transactions History
                            </button>

                            <p className="text-[10px] font-semibold text-slate-400 text-center leading-tight">
                                Encrypted with 128-bit AES & SHA-256 HMAC cryptographic signatures.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Features & Service Overview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm">
                            <Coins size={24} />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Corporate Cash Drops (CDC)</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Collect cash drops from field logistics, e-commerce delivery executives, and corporate loan recovery agents with real-time BC wallet balance sync.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                            <Landmark size={24} />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Loan & EMI Collections</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Collect loan repayments for major NBFCs and banks, including Bajaj Finance, L&T Finance, Hero Fincorp, Muthoot Finance, and Mahindra Finance.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                            <ShieldCheck size={24} />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Instant Float Reconciliation</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Server-to-server callback integration with cryptographic authenticity verification, duplicate protection, and automated financial refunds.
                        </p>
                    </div>
                </div>

                {/* BC Agent Best Practices & Checklist */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">BC Merchant Security Advisory</span>
                            </div>
                            <h4 className="text-lg font-black tracking-tight">Cash Collection Security Guidelines</h4>
                            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                                Always count and verify physical currency notes before confirming collection. Ensure your Rupiksha wallet has sufficient float balance to authorize the debit callback from Fingpay.
                            </p>
                        </div>

                        <button
                            onClick={() => navigate('/reports?report=fingpay_cms')}
                            className="shrink-0 px-5 py-3 rounded-xl bg-white text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-slate-100 transition-all flex items-center gap-2 cursor-pointer shadow-md"
                        >
                            Open CMS Logs <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CMS;
