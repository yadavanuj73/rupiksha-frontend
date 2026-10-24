import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, RefreshCw, ExternalLink, ShieldCheck, MapPin, 
    History, AlertTriangle, CheckCircle, Info,
    Lock, UserCheck, Smartphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

                // Open the authenticated Fingpay Uber CMS web application in a new secure window
                const newWindow = window.open(response.launchUrl, '_blank', 'noopener,noreferrer');
                if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    setPopupBlocked(true);
                }
            } else {
                const msg = response?.message || "Failed to initialize Fingpay CMS session";
                setErrorMsg(msg);
            }
        } catch (err) {
            console.error("CMS Launch error:", err);
            const msg = err.response?.data?.message || err.message || "Failed to connect to Fingpay CMS provider";
            setErrorMsg(msg);
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
        <div className="w-full bg-slate-50 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* Top Navigation & Status Bar */}
            <div className="shrink-0 bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2.5 shadow-sm">
                <div className="flex items-center justify-between max-w-6xl mx-auto">
                    <div className="flex items-center gap-3">
                        <Icon3D icon={Building2} color="#4f46e5" size={38} />
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base md:text-lg font-black text-slate-900 leading-none">Fingpay Cms</h1>
                                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                                    Fingpay CMS
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                Cash Management Services & Collections
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Gateway Live</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Terminal Body */}
            <div className="flex-1 p-3 sm:p-5 md:p-6 max-w-6xl w-full mx-auto">

                {/* Hero Launch Console (Height and content increased by 30%) */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 md:p-9 py-7 sm:py-9 md:py-10 relative overflow-hidden min-h-[360px] sm:min-h-[410px] flex flex-col justify-center">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                        <div className="lg:col-span-7 space-y-4 sm:space-y-4.5">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs sm:text-[13px] font-black uppercase tracking-wider">
                                <ShieldCheck size={16} className="text-indigo-600" /> Authorized Retailer BC Terminal
                            </div>

                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                                Cash Drop & EMI Collection Terminal
                            </h2>

                            <p className="text-sm sm:text-base font-medium text-slate-600 leading-relaxed">
                                Access the official Fingpay CMS system to process instant cash collections, corporate drops (CDC), and loan repayments for leading financial institutions. Authenticated directly with your Rupiksha retailer BC credentials.
                            </p>

                            {/* Merchant Identity Badges (Height & text increased by 30%) */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block">BC Merchant ID</span>
                                    <span className="text-sm sm:text-base font-black text-slate-800 tracking-tight block mt-1 truncate">{merchantIdDisplay}</span>
                                </div>
                                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block">Registered Mobile</span>
                                    <span className="text-sm sm:text-base font-black text-slate-800 tracking-tight block mt-1">{mobileDisplay}</span>
                                </div>
                                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block">GPS Coordinates</span>
                                    <span className="text-sm sm:text-base font-black text-slate-800 tracking-tight block mt-1 flex items-center gap-1.5">
                                        <MapPin size={13} className={coords.acquired ? "text-emerald-500" : "text-amber-500"} />
                                        {coords.latitude}, {coords.longitude}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Panel (Height & content increased by 30%) */}
                        <div className="lg:col-span-5 flex flex-col justify-center items-stretch space-y-4 sm:space-y-4.5 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-6 sm:p-7 rounded-3xl border border-slate-200/80">
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
                                <span className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-slate-500">Terminal Status</span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ready To Launch
                                </span>
                            </div>

                            {errorMsg && (
                                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold flex items-start gap-2">
                                    <AlertTriangle size={17} className="shrink-0 mt-0.5 text-rose-600" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            {popupBlocked && (
                                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-bold space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <Info size={17} className="shrink-0 text-amber-600" />
                                        <span>Browser blocked the popup window.</span>
                                    </div>
                                    <a
                                        href={launchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-amber-600 text-white text-xs sm:text-sm font-black uppercase tracking-wider hover:bg-amber-700 transition-colors"
                                    >
                                        Click To Open Fingpay CMS <ExternalLink size={13} />
                                    </a>
                                </div>
                            )}

                            {/* Main Launch Button (Height increased ~30%) */}
                            <motion.button
                                onClick={handleLaunchCms}
                                disabled={loading}
                                whileHover={{ scale: 1.01, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-4 sm:py-4.5 rounded-2xl text-white font-black text-sm sm:text-base uppercase tracking-widest relative overflow-hidden shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2.5"
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
                                            <RefreshCw className="animate-spin" size={20} />
                                            OPENING FINGPAY CMS...
                                        </>
                                    ) : (
                                        <>
                                            <ExternalLink size={20} />
                                            Open Fingpay CMS
                                        </>
                                    )}
                                </span>
                            </motion.button>

                            {/* Secondary Link to History (Height increased ~30%) */}
                            <button
                                onClick={() => navigate('/reports?report=fingpay_cms')}
                                className="w-full py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm uppercase tracking-wider hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                                <History size={17} className="text-purple-600" />
                                View CMS Transactions History
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CMS;
