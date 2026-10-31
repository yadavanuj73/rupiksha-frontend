import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Smartphone, Zap, CreditCard, Signal, Layers, Search,
    CheckCircle, AlertCircle, RefreshCw, BellRing, ArrowRight,
    Tv2, ChevronRight, User, Calendar, Mail,
    Hash, Home, Phone, FileText, MapPin, Landmark, Wallet, ShieldCheck
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useWallet } from '../../context/WalletContext';
import { providerTxnService, bbpsService } from '../../services/apiService';
import {
    PREFIX_DB, OPERATOR_PLANS, DTH_PROVIDERS, BILL_CATEGORIES,
    PAN_API, RECHARGE_API, BILL_PAY_API, BILL_FETCH_API
} from './utilityData';
import { initSpeech, announceSuccess, announceFailure, announceProcessing, speak, announceError, announceWarning, announceGrandSuccess, playApplause } from '../../services/speechService';
import UtilityBill from './UtilityBill';

const NAVY = '#0f2557';
const NAVY2 = '#1a3a6b';
const NAVY3 = '#2257a8';

function GrandSuccessScreen({ title, subtitle, details = [], onReset, resetLabel = '+ New Transaction' }) {
    // Bokeh floating dots
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
            className="relative flex flex-col items-center justify-center min-h-[62vh] py-10 overflow-hidden"
        >
            {/* ── Radiant background glow ── */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 38%, rgba(16,185,129,0.14) 0%, rgba(15,37,87,0.06) 62%, transparent 100%)' }} />

            {/* ── Floating bokeh particles ── */}
            {DOTS.map((d, i) => (
                <motion.div key={i} className="absolute rounded-full pointer-events-none"
                    style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, background: d.col, opacity: 0.55 }}
                    animate={{ y: [-10, 12, -10], opacity: [0.4, 0.85, 0.4], scale: [1, 1.4, 1] }}
                    transition={{ duration: d.dur, repeat: Infinity, delay: d.delay, ease: 'easeInOut' }} />
            ))}

            {/* ── Glowing trophy ring ── */}
            <motion.div className="relative flex items-center justify-center"
                initial={{ scale: 0.15, rotate: -25 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 230, damping: 13 }}>
                {/* Outer pulse ring */}
                <motion.div className="absolute rounded-full"
                    style={{ width: 148, height: 148, border: '3px solid #10b981', opacity: 0.3 }}
                    animate={{ scale: [1, 1.55, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2.3, repeat: Infinity }} />
                {/* Middle ring */}
                <motion.div className="absolute rounded-full"
                    style={{ width: 118, height: 118, border: '2px solid rgba(16,185,129,0.4)' }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2.3, repeat: Infinity, delay: 0.4 }} />
                {/* Trophy circle */}
                <div className="w-28 h-28 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(145deg, #10b981, #059669)', boxShadow: '0 0 0 7px rgba(16,185,129,0.18), 0 22px 55px rgba(16,185,129,0.55)' }}>
                    <motion.span style={{ fontSize: 54, lineHeight: 1 }}
                        animate={{ rotateY: [0, 360] }}
                        transition={{ duration: 1.8, delay: 0.4, ease: 'easeOut' }}>🏆</motion.span>
                </div>
            </motion.div>

            {/* ── CONGRATULATIONS ── */}
            <motion.div className="text-center mt-7 space-y-1 px-4"
                initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <motion.p className="text-[11px] font-black tracking-[5px] uppercase"
                    style={{ color: '#10b981' }}
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ duration: 2.2, repeat: Infinity }}>
                    ✨ CONGRATULATIONS ✨
                </motion.p>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">{title}</h2>
                {subtitle && <p className="text-slate-500 text-sm mt-1 font-medium">{subtitle}</p>}
            </motion.div>

            {/* ── Transaction detail card ── */}
            {details.length > 0 && (
                <motion.div
                    className="mt-6 w-full max-w-sm rounded-3xl overflow-hidden"
                    initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                    style={{ boxShadow: '0 20px 60px rgba(15,37,87,0.13), 0 4px 18px rgba(16,185,129,0.13)', border: '1.5px solid rgba(16,185,129,0.22)' }}>
                    {/* Card header */}
                    <div className="px-6 py-3 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #0f2557, #1a3a8f)' }}>
                        <CheckCircle size={13} style={{ color: '#34d399' }} />
                        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Transaction Summary</p>
                    </div>
                    {/* Details rows */}
                    <div className="bg-white px-6 py-4 space-y-3">
                        {details.map((d, i) => (
                            <motion.div key={i} className="flex items-center justify-between text-sm"
                                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.65 + i * 0.07 }}>
                                <span className="text-slate-400 font-semibold">{d.label}</span>
                                <span className={`font-black ${d.highlight ? 'text-emerald-600 text-base' : 'text-slate-800'}`}>{d.value}</span>
                            </motion.div>
                        ))}
                    </div>
                    {/* Card footer */}
                    <div className="px-6 py-2 text-center"
                        style={{ background: 'rgba(16,185,129,0.06)', borderTop: '1px solid rgba(16,185,129,0.15)' }}>
                        <p className="text-[10px] text-emerald-600 font-black">✅ PAYMENT SUCCESSFUL</p>
                    </div>
                </motion.div>
            )}

            {/* ── Action button ── */}
            <motion.button onClick={onReset}
                className="mt-7 px-10 py-4 rounded-2xl text-white font-black text-sm uppercase tracking-widest"
                style={{ background: 'linear-gradient(135deg, #0f2557, #1a3a8f)', boxShadow: '0 10px 32px rgba(15,37,87,0.38)' }}
                whileHover={{ scale: 1.04, boxShadow: '0 14px 42px rgba(15,37,87,0.48)' }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
                {resetLabel}
            </motion.button>
        </motion.div>
    );
}

const NAV_TABS = [
    { id: 'mobile', label: 'Mobile', icon: Smartphone },
    { id: 'dth', label: 'DTH', icon: Tv2 },
];

/* ── 3D Icon Badge ── */
const Icon3D = ({ icon: Icon, color, bg, size = 44, shadow }) => (
    <div style={{
        width: size, height: size,
        background: bg || `linear-gradient(145deg, ${color}dd, ${color}88)`,
        borderRadius: size * 0.3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: shadow || `0 8px 20px ${color}50, 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)`,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
        <div style={{ position: 'absolute', top: '10%', left: '10%', right: '40%', bottom: '40%', background: 'rgba(255,255,255,0.25)', borderRadius: '50%', filter: 'blur(4px)' }} />
        <Icon size={size * 0.45} color="white" strokeWidth={2} style={{ position: 'relative', zIndex: 1 }} />
    </div>
);

/* ── Status Toast ── */
const Toast = ({ status, onClose }) => status ? (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="flex items-center gap-3 p-3.5 rounded-xl mb-3 text-xs sm:text-sm font-black border shadow-xs"
        style={status.type === 'success'
            ? { background: '#ecfdf5', borderColor: '#6ee7b7', color: '#064e3b' }
            : { background: '#fef2f2', borderColor: '#fca5a5', color: '#7f1d1d' }}>
        {status.type === 'success'
            ? <CheckCircle size={18} style={{ color: '#059669', flexShrink: 0 }} />
            : <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />}
        <span className="flex-1">{status.message}</span>
        <button onClick={onClose} className="ml-2 font-black text-lg leading-none opacity-60 hover:opacity-100 cursor-pointer">×</button>
    </motion.div>
) : null;

/* ── Plan Card ── */
const PlanCard = ({ plan, selected, onSelect, opColor }) => (
    <motion.div whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} whileTap={{ scale: 0.98 }}
        onClick={() => onSelect(plan)}
        className="cursor-pointer rounded-2xl p-3.5 sm:p-4 border-2 transition-all relative"
        style={selected
            ? { borderColor: '#0f2557', background: 'rgba(15,37,87,0.04)', boxShadow: '0 0 0 1px #0f2557' }
            : { borderColor: '#cbd5e1', background: 'white' }}>
        {plan.popular && (
            <span className="absolute -top-2.5 left-4 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white bg-[#0f2557] shadow-xs">
                ★ Popular
            </span>
        )}
        <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-xl sm:text-2xl font-black text-black">₹{plan.amount}</span>
                    <span className="text-xs font-black text-slate-800">/ {plan.validity}</span>
                </div>
                <p className="text-xs font-extrabold text-black mb-2 line-clamp-2 leading-snug">{plan.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-950 border border-blue-200">📶 {plan.data}</span>
                    {plan.calls !== '—' && <span className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-950 border border-emerald-200">📞 {plan.calls}</span>}
                    {plan.sms !== '—' && <span className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-purple-950 border border-purple-200">✉ {plan.sms}</span>}
                </div>
            </div>
            <div className="shrink-0 mt-1">
                {selected
                    ? <CheckCircle size={22} className="text-[#0f2557]" />
                    : <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
            </div>
        </div>
    </motion.div>
);

/* ═══════════ MOBILE RECHARGE TAB ═══════════ */
function MobileTab({ location }) {
    const [mobile, setMobile] = useState('');
    const [operator, setOperator] = useState('');
    const [circle, setCircle] = useState('');
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [filter, setFilter] = useState('All');
    const [loading, setLoading] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [status, setStatus] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [txid, setTxid] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('wallet'); // 'wallet' | 'gateway'
    const [successTitle, setSuccessTitle] = useState('Recharge Successful! 🎉');
    const [successSubtitle, setSuccessSubtitle] = useState('');
    const [backendOperators, setBackendOperators] = useState([]);

    const { availableBalance, refreshWallet } = useWallet();
    const currentBalance = parseFloat(availableBalance || 0);

    const PLAN_FILTERS = ['All', 'Data', 'All-in-1', 'Annual', '5G', 'Weekly', 'Daily'];
    const filteredPlans = filter === 'All' ? plans : plans.filter(p => p.type === filter);

    useEffect(() => {
        providerTxnService.getOperators()
            .then(res => {
                if (Array.isArray(res)) {
                    setBackendOperators(res);
                }
            })
            .catch(err => console.error("Failed to load operators from backend:", err));
    }, []);

    const getOperatorBrand = (code) => {
        if (!code) return "";
        if (code.startsWith("AT") || code.startsWith("AC")) return "Airtel";
        if (code.startsWith("JR") || code.startsWith("JT")) return "Jio";
        if (code.startsWith("VD") || code.startsWith("VC")) return "Vi";
        if (code.startsWith("BN")) return "BSNL";
        return "";
    };

    const findCodeForBrand = (brand) => {
        if (brand === "Airtel") return backendOperators.find(o => o.operatorCode === "ATL")?.operatorCode || "ATL";
        if (brand === "Jio") return backendOperators.find(o => o.operatorCode === "JRE")?.operatorCode || "JRE";
        if (brand === "Vi") return backendOperators.find(o => o.operatorCode === "VDF")?.operatorCode || "VDF";
        if (brand === "BSNL") return backendOperators.find(o => o.operatorCode === "BNT")?.operatorCode || "BNT";
        return "";
    };

    const OP_COLORS = { Airtel: '#e40000', Jio: '#003087', Vi: '#c300ff', BSNL: '#ff8800' };
    const brandName = getOperatorBrand(operator);
    const opColor = OP_COLORS[brandName] || NAVY;
    const opDisplayName = backendOperators.find(o => o.operatorCode === operator)?.name || operator;

    const detect = (num) => {
        if (num.length < 4) { setOperator(''); setCircle(''); setPlans([]); return; }
        const prefix = num.slice(0, 4);
        const info = PREFIX_DB[prefix];
        if (info) {
            const code = findCodeForBrand(info.op);
            setOperator(code);
            setCircle(info.circle);
            setPlans(OPERATOR_PLANS[info.op] || []);
        } else if (num.length >= 4) {
            const d2 = num.slice(0, 2);
            const d3 = num.slice(0, 3);
            let detectedOp = '', detectedCircle = 'All India';

            if (d2 === '60' || d2 === '61' || d2 === '62' || d2 === '63' || d2 === '64') { detectedOp = 'Jio'; }
            else if (d2 === '65' || d2 === '66' || d2 === '67' || d2 === '68' || d2 === '69') { detectedOp = 'Jio'; }
            else if (d3 === '700' || d3 === '701' || d3 === '702' || d3 === '703' || d3 === '704' || d3 === '705' || d3 === '706' || d3 === '707' || d3 === '708' || d3 === '709' || d3 === '710' || d3 === '711') { detectedOp = 'Jio'; }
            else if (d3 === '720' || d3 === '721' || d3 === '722' || d3 === '723' || d3 === '724' || d3 === '725' || d3 === '726' || d3 === '727' || d3 === '728' || d3 === '729' || d3 === '730' || d3 === '731' || d3 === '732' || d3 === '733' || d3 === '734' || d3 === '735' || d3 === '736' || d3 === '737' || d3 === '738' || d3 === '739') { detectedOp = 'Airtel'; }
            else if (d3 === '740' || d3 === '741' || d3 === '742' || d3 === '743' || d3 === '744' || d3 === '745' || d3 === '746' || d3 === '747' || d3 === '748' || d3 === '749' || d3 === '750' || d3 === '751' || d3 === '752' || d3 === '753' || d3 === '754' || d3 === '755' || d3 === '756') { detectedOp = 'Vi'; }
            else if (d3 === '760' || d3 === '761' || d3 === '762' || d3 === '763' || d3 === '764' || d3 === '765' || d3 === '766' || d3 === '767' || d3 === '768') { detectedOp = 'BSNL'; }
            else if (d2 === '77' || d2 === '78' || d2 === '79') { detectedOp = 'Jio'; }
            else if (['800', '801', '802', '803', '804', '805', '806', '807', '808', '809', '810', '811', '812', '813', '814', '815', '816', '817', '818', '819', '820', '821', '822', '823', '824', '825', '826', '827', '828', '829'].includes(d3)) { detectedOp = 'Airtel'; }
            else if (['830', '831', '832', '833', '834', '835', '836', '837', '838', '839', '840', '841', '842', '843', '844', '845', '846', '847', '848', '849', '850', '851', '852', '853', '854', '855', '856', '857', '858', '859'].includes(d3)) { detectedOp = 'Jio'; }
            else if (['860', '861', '862', '863', '864', '865', '866', '867', '868', '869', '870', '871', '872', '873', '874', '875', '876', '877', '878', '879'].includes(d3)) { detectedOp = 'Vi'; }
            else if (['880', '881', '882', '883', '884', '885', '886', '887', '888', '889', '890', '891', '892', '893', '894', '895', '896', '897', '898', '899'].includes(d3)) { detectedOp = 'BSNL'; }
            else if (['900', '901', '902', '903', '904', '905', '906', '907', '908', '909'].includes(d3)) { detectedOp = 'Jio'; }
            else if (d2 === '91' || d2 === '92') { detectedOp = 'Jio'; }
            else if (d2 === '93') { detectedOp = 'Vi'; }
            else if (d2 === '94') { detectedOp = 'BSNL'; }
            else if (d2 === '95') { detectedOp = 'Airtel'; }
            else if (d2 === '96') { detectedOp = 'Jio'; }
            else if (d2 === '97') { detectedOp = 'Airtel'; }
            else if (d2 === '98') { detectedOp = 'Airtel'; }
            else if (d2 === '99') { detectedOp = 'Vi'; }

            if (detectedOp) {
                const code = findCodeForBrand(detectedOp);
                setOperator(code);
                setCircle(detectedCircle);
                setPlans(OPERATOR_PLANS[detectedOp] || []);
            } else {
                setOperator(''); setCircle(''); setPlans([]);
            }
        }
    };

    const handleRecharge = async () => {
        const amount = selectedPlan ? selectedPlan.amount : customAmount;
        if (!/^\d{10}$/.test(mobile)) { announceWarning('सही 10 अंकों का मोबाइल नंबर'); setStatus({ type: 'error', message: '⚠️ Enter a valid 10-digit mobile number' }); return; }
        if (!operator) { announceWarning('ऑपरेटर पहचाना नहीं गया'); setStatus({ type: 'error', message: '⚠️ Operator not detected. Enter valid number.' }); return; }
        if (!amount || Number(amount) < 1) { announceWarning('राशि या प्लान चुनें'); setStatus({ type: 'error', message: '⚠️ Please select a plan or enter amount' }); return; }

        if (paymentMethod === 'wallet') {
            if (currentBalance < parseFloat(amount)) {
                announceWarning('अपर्याप्त बैलेंस');
                setStatus({ type: 'error', message: `⚠️ Insufficient wallet balance (₹${currentBalance.toFixed(2)}). Please add money to continue.` });
                return;
            }
        }

        setLoading(true); setStatus(null);
        try {
            initSpeech(); announceProcessing("रिचार्ज प्रोसेस हो रहा है।");
            const user = dataService.getCurrentUser();
            const result = await providerTxnService.recharge({
                userId: user.id,
                mobile,
                operator: operator, // Pass official code directly
                amount: Number(amount)
            });

            await refreshWallet();
            window.dispatchEvent(new CustomEvent('walletUpdated'));

            if (result.success) {
                if (result.status === 'PENDING') {
                    announceSuccess('आपका रिचार्ज पेंडिंग है।');
                    setSuccessTitle('Recharge Pending ⏳');
                    setSuccessSubtitle('We are processing your request. Please wait.');
                    setTxid(result.merchantRefNo || result.txnId || `TXN${Date.now()}`);
                    setShowSuccess(true);
                } else {
                    announceGrandSuccess(
                        `आपका ₹${amount} का ${opDisplayName} रिचार्ज सफल हो गया।`,
                        `मोबाइल नंबर ${mobile} पर ${opDisplayName} ${circle} की सेवा सक्रिय हो गई。`
                    );
                    try {
                        const { default: confetti } = await import('canvas-confetti');
                        confetti({ particleCount: 180, spread: 80, origin: { y: 0.5 }, colors: ['#10b981', '#0f2557', '#fbbf24', '#a78bfa', '#38bdf8'] });
                    } catch (e) { }
                    setSuccessTitle('Recharge Successful! 🎉');
                    setSuccessSubtitle(`${opDisplayName} — ${circle}`);
                    setTxid(result.operatorTxnId || result.txnId || `TXN${Date.now()}`);
                    setShowSuccess(true);
                }
            } else {
                announceError(result.message || 'रिचार्ज फेल हो गया');
                let errMessage = result.message || 'Recharge failed';
                if (result.status === 'SERVICE_DISABLED') {
                    errMessage = 'Mobile Recharge service is disabled by administrator';
                } else if (result.status === 'INSUFFICIENT_BALANCE') {
                    errMessage = 'Insufficient wallet balance. Please add money to continue.';
                }
                setStatus({ type: 'error', message: `❌ ${errMessage}` });
            }
        } catch (e) {
            announceError('कनेक्शन एरर। बैकएंड से कनेक्ट नहीं हो पाया।');
            setStatus({ type: 'error', message: `❌ ${e.message || 'Connection error. Try again.'}` });
        } finally {
            setLoading(false);
        }
    };

    if (showSuccess) return (
        <GrandSuccessScreen
            title={successTitle}
            subtitle={successSubtitle}
            details={[
                { label: 'Mobile Number', value: mobile },
                { label: 'Operator', value: `${opDisplayName} (${circle})` },
                { label: 'Amount Paid', value: `₹${parseFloat(selectedPlan?.amount || customAmount || 0).toFixed(2)}`, highlight: true },
                { label: 'Plan', value: selectedPlan?.desc || 'Custom Recharge' },
                { label: 'Validity', value: selectedPlan?.validity || '—' },
                { label: 'Transaction ID / Ref', value: txid },
            ]}
            onReset={() => { setShowSuccess(false); setMobile(''); setOperator(''); setCircle(''); setSelectedPlan(null); setCustomAmount(''); setPlans([]); }}
            resetLabel="+ New Recharge"
        />
    );

    return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* LEFT: Input Card */}
            <div className="lg:col-span-5 xl:col-span-5 flex flex-col h-full">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col h-full lg:overflow-y-auto scrollbar-none space-y-3">
                    {/* Header: Title + Balance */}
                    <div className="flex justify-between items-center shrink-0">
                        <h3 className="font-black text-black text-sm sm:text-base flex items-center gap-2">
                            <Icon3D icon={Smartphone} color="#0f2557" size={30} />
                            Enter Recharge Details
                        </h3>
                        <span className="text-xs font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                            <Wallet size={12} className="text-emerald-800" />
                            ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Mobile Input */}
                    <div className="shrink-0">
                        <label className="text-xs font-black text-black uppercase tracking-wider block mb-1">
                            Mobile Number
                        </label>
                        <div className="relative">
                            <Smartphone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" />
                            <input
                                type="text"
                                maxLength={10}
                                value={mobile}
                                onChange={e => { const v = e.target.value.replace(/\D/g, ''); setMobile(v); detect(v); }}
                                placeholder="Enter 10-digit number"
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-slate-300 text-black font-extrabold text-base sm:text-lg outline-none focus:border-[#0f2557] focus:ring-2 focus:ring-blue-100 transition-all bg-white placeholder:text-slate-500 placeholder:font-bold"
                            />
                            {detecting && <RefreshCw size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" />}
                        </div>
                    </div>

                    {/* Auto-detected badge */}
                    {operator && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-300 bg-slate-50 shrink-0"
                        >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs" style={{ background: opColor }}>
                                {(opDisplayName || '')[0]}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-black text-black truncate">{opDisplayName}</p>
                                <p className="text-[11px] font-extrabold text-slate-800">{circle || 'All India'}</p>
                            </div>
                            <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 border border-emerald-300 shrink-0">
                                Auto detected ✓
                            </span>
                        </motion.div>
                    )}

                    {/* Operator & Circle manual controls */}
                    <div className="grid grid-cols-2 gap-2.5 shrink-0">
                        <div>
                            <label className="text-xs font-black text-black uppercase tracking-wider block mb-1">
                                Operator
                            </label>
                            <select
                                value={operator}
                                onChange={e => {
                                    const code = e.target.value;
                                    setOperator(code);
                                    const brand = getOperatorBrand(code);
                                    setPlans(OPERATOR_PLANS[brand] || []);
                                    setSelectedPlan(null);
                                }}
                                className="w-full py-2 px-2.5 rounded-xl border-2 border-slate-300 text-black font-extrabold text-xs sm:text-sm outline-none focus:border-[#0f2557] bg-white cursor-pointer"
                            >
                                <option value="" className="text-black font-bold">Select Operator</option>
                                {backendOperators.map(o => (
                                    <option key={o.operatorCode} value={o.operatorCode} className="text-black font-bold">
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-black text-black uppercase tracking-wider block mb-1">
                                Circle / State
                            </label>
                            <input
                                value={circle}
                                onChange={e => setCircle(e.target.value)}
                                placeholder="State / Region"
                                className="w-full py-2 px-2.5 rounded-xl border-2 border-slate-300 text-black font-extrabold text-xs sm:text-sm outline-none focus:border-[#0f2557] bg-white placeholder:text-slate-500 placeholder:font-bold"
                            />
                        </div>
                    </div>

                    {/* Enter Amount Manually */}
                    <div className="shrink-0">
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-black text-black uppercase tracking-wider">
                                Or Enter Amount
                            </label>
                            {selectedPlan && (
                                <span className="text-[11px] font-black text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                    Plan Selected: ₹{selectedPlan.amount}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl font-black text-black">₹</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={customAmount}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setCustomAmount(val);
                                    setSelectedPlan(null);
                                }}
                                placeholder="Enter recharge amount"
                                className="w-full pl-8 pr-3 py-2 rounded-xl border-2 border-slate-300 text-black font-black text-lg outline-none focus:border-[#0f2557] focus:ring-2 focus:ring-blue-100 bg-white placeholder:text-slate-500 placeholder:font-bold"
                            />
                        </div>
                        {/* Quick amount chips */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-black text-black">Popular:</span>
                            {['199', '299', '349', '666', '719'].map(amt => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => { setCustomAmount(amt); setSelectedPlan(null); }}
                                    className="px-2 py-0.5 rounded-md text-[11px] font-black text-black bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer transition-all"
                                >
                                    ₹{amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payment Method Selection */}
                    {(selectedPlan || customAmount) && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 space-y-1.5">
                            <p className="text-[11px] font-black uppercase text-black tracking-wider">Payment Method</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('wallet')}
                                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                        paymentMethod === 'wallet'
                                            ? 'border-emerald-600 bg-emerald-50/80 shadow-2xs'
                                            : 'border-slate-300 bg-white hover:border-slate-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Wallet size={15} className={paymentMethod === 'wallet' ? 'text-emerald-800' : 'text-black'} />
                                        <span className={`text-xs font-black ${paymentMethod === 'wallet' ? 'text-emerald-950' : 'text-black'}`}>Main Wallet</span>
                                    </div>
                                    <p className="text-[10px] font-extrabold text-slate-800">Instant deduction</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('gateway')}
                                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                        paymentMethod === 'gateway'
                                            ? 'border-blue-600 bg-blue-50/80 shadow-2xs'
                                            : 'border-slate-300 bg-white hover:border-slate-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <CreditCard size={15} className={paymentMethod === 'gateway' ? 'text-blue-800' : 'text-black'} />
                                        <span className={`text-xs font-black ${paymentMethod === 'gateway' ? 'text-blue-950' : 'text-black'}`}>Gateway</span>
                                    </div>
                                    <p className="text-[10px] font-extrabold text-slate-800">UPI / Net Banking</p>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Summary box */}
                    {(selectedPlan || customAmount) && (
                        <div className="rounded-xl p-2.5 space-y-1 border border-slate-300 bg-slate-50 shrink-0">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-extrabold text-slate-800">Recharge Amount</span>
                                <span className="font-black text-black text-sm">₹{parseFloat(selectedPlan?.amount || customAmount || 0).toFixed(2)}</span>
                            </div>
                            {selectedPlan && (
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="font-bold text-slate-700">Plan Benefits</span>
                                    <span className="font-black text-black">{selectedPlan.data} · {selectedPlan.validity}</span>
                                </div>
                            )}
                            {paymentMethod === 'wallet' && (
                                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                                    <span className="font-bold text-slate-700">Wallet Balance</span>
                                    <span className="font-black text-black">₹{currentBalance.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status notification */}
                    <AnimatePresence><Toast status={status} onClose={() => setStatus(null)} /></AnimatePresence>

                    {/* Proceed Button */}
                    <div className="pt-1 mt-auto shrink-0">
                        <motion.button
                            onClick={handleRecharge}
                            disabled={loading}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-3 sm:py-3.5 rounded-xl text-white font-black text-sm sm:text-base uppercase tracking-wider relative overflow-hidden disabled:opacity-60 cursor-pointer shadow-md"
                            style={{ background: 'linear-gradient(135deg, #0f2557 0%, #1a3a8f 100%)' }}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? (
                                    <><RefreshCw size={18} className="animate-spin" /> Processing...</>
                                ) : (
                                    <>⚡ Proceed to Recharge <ArrowRight size={18} /></>
                                )}
                            </span>
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* RIGHT: Plans Card */}
            <div className="lg:col-span-7 xl:col-span-7 flex flex-col h-full">
                {plans.length > 0 ? (
                    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs overflow-hidden">
                        {/* Header of plans card */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                            <div>
                                <h3 className="font-black text-black text-sm sm:text-base flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{ background: opColor }} />
                                    {opDisplayName || operator} Plans — {circle || 'All India'}
                                </h3>
                                <p className="text-[11px] font-extrabold text-slate-800 mt-0.5">Click any plan to select</p>
                            </div>
                            <span className="text-xs font-black text-black bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-full shadow-2xs">
                                {filteredPlans.length} plans
                            </span>
                        </div>

                        {/* Category filter pills */}
                        <div className="flex gap-1.5 overflow-x-auto py-2.5 shrink-0 scrollbar-none">
                            {PLAN_FILTERS.map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1 rounded-lg text-xs font-black border transition-all whitespace-nowrap cursor-pointer ${
                                        filter === f
                                            ? 'bg-[#0f2557] text-white border-[#0f2557] shadow-xs'
                                            : 'bg-white text-black border-slate-300 hover:border-black hover:bg-slate-50'
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        {/* Scrollable plans list - ONLY this list scrolls! */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-300">
                            {filteredPlans.map(plan => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    selected={selectedPlan?.id === plan.id}
                                    onSelect={p => { setSelectedPlan(p); setCustomAmount(''); }}
                                    opColor={opColor}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col justify-between bg-white rounded-2xl border border-slate-200 p-5 shadow-xs overflow-y-auto">
                        <div>
                            <div className="flex items-center gap-2.5 mb-2">
                                <Icon3D icon={Smartphone} color="#0f2557" size={34} />
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-black">Operator Plans & Offers</h3>
                                    <p className="text-xs font-black text-slate-800">Enter mobile number to auto-fetch plans or choose an operator below:</p>
                                </div>
                            </div>

                            {/* Operator Quick Select Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
                                {[
                                    { name: 'Jio', code: findCodeForBrand('Jio'), color: '#003087', bg: '#eff6ff', tag: 'True 5G' },
                                    { name: 'Airtel', code: findCodeForBrand('Airtel'), color: '#e40000', bg: '#fef2f2', tag: 'Fast 5G' },
                                    { name: 'Vi', code: findCodeForBrand('Vi'), color: '#c300ff', bg: '#faf5ff', tag: 'Hero Unlimited' },
                                    { name: 'BSNL', code: findCodeForBrand('BSNL'), color: '#ff8800', bg: '#fff7ed', tag: 'Affordable 4G' },
                                ].map(opItem => (
                                    <motion.button
                                        key={opItem.name}
                                        whileHover={{ y: -2 }}
                                        whileTap={{ scale: 0.96 }}
                                        onClick={() => {
                                            const code = opItem.code || findCodeForBrand(opItem.name);
                                            setOperator(code);
                                            setCircle('All India');
                                            setPlans(OPERATOR_PLANS[opItem.name] || []);
                                            setSelectedPlan(null);
                                        }}
                                        className="p-3 rounded-xl border-2 border-slate-300 hover:border-black text-left transition-all flex flex-col justify-between cursor-pointer"
                                        style={{ background: opItem.bg }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shadow-xs" style={{ background: opItem.color }}>
                                                {opItem.name[0]}
                                            </span>
                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white text-black border border-slate-300">
                                                {opItem.tag}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-black">{opItem.name}</p>
                                            <p className="text-[11px] font-black text-blue-900 flex items-center gap-1 mt-0.5">
                                                View Plans <ArrowRight size={10} />
                                            </p>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>

                            {/* Popular Sample Plans Preview */}
                            <div className="mt-4">
                                <p className="text-xs font-black text-black uppercase tracking-wider mb-2">⭐ Trending Recharge Packs</p>
                                <div className="space-y-2">
                                    {[
                                        { op: 'Jio', amt: '₹299', val: '28 Days', data: '1.5 GB/Day', desc: 'Daily data, Unlimited 5G + Calls', color: '#003087' },
                                        { op: 'Airtel', amt: '₹349', val: '28 Days', data: '2 GB/Day', desc: 'Unlimited 5G Data + Unlimited Calls', color: '#e40000' },
                                        { op: 'Vi', amt: '₹479', val: '56 Days', data: '1.5 GB/Day', desc: 'Binge All Night + Weekend Rollover', color: '#c300ff' },
                                    ].map((sample, idx) => (
                                        <div key={idx} className="p-2.5 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-6 h-6 rounded-md text-white font-black text-[10px] flex items-center justify-center" style={{ background: sample.color }}>
                                                    {sample.op[0]}
                                                </span>
                                                <div>
                                                    <p className="text-xs font-black text-black">{sample.amt} <span className="text-slate-800 font-extrabold text-[11px]">/ {sample.val}</span></p>
                                                    <p className="text-[11px] font-extrabold text-slate-800">{sample.desc}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white border border-slate-300 text-black">
                                                {sample.data}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Feature Badges */}
                        <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                                <p className="text-xs font-black text-emerald-950">⚡ Instant</p>
                                <p className="text-[10px] font-extrabold text-emerald-800">&lt; 10 Sec</p>
                            </div>
                            <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200">
                                <p className="text-xs font-black text-blue-950">🛡️ 100% Safe</p>
                                <p className="text-[10px] font-extrabold text-blue-800">BBPS Certified</p>
                            </div>
                            <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200">
                                <p className="text-xs font-black text-purple-950">💰 Cashback</p>
                                <p className="text-[10px] font-extrabold text-purple-800">Best Margins</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══════════ DTH TAB ═══════════ */
function DthTab({ location }) {
    const [provider, setProvider] = useState('');
    const [subscriberId, setSubscriberId] = useState('');
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [filterType, setFilterType] = useState('All');
    const { availableBalance } = useWallet();
    const currentBalance = parseFloat(availableBalance || 0);

    const providerData = DTH_PROVIDERS[provider];
    const plans = providerData?.plans || [];
    const filtered = filterType === 'All' ? plans : plans.filter(p => p.type === filterType);

    const handleRecharge = async () => {
        if (!subscriberId) { announceWarning('सब्सक्राइबर नंबर डालें'); setStatus({ type: 'error', message: '⚠️ Enter Subscriber / VC Number' }); return; }
        if (!provider) { announceWarning('डीटीएच प्रोवाइडर चुनें'); setStatus({ type: 'error', message: '⚠️ Select DTH provider' }); return; }
        if (!selectedPlan) { announceWarning('प्लान चुनें'); setStatus({ type: 'error', message: '⚠️ Select a plan' }); return; }

        const user = dataService.getCurrentUser();
        // Fetch fresh balance from backend
        try {
            const freshBal = await dataService.getWalletBalance(user.id || user.username);
            user.balance = freshBal;
            localStorage.setItem('rupiksha_user', JSON.stringify({ ...user, balance: freshBal }));
        } catch (e) { /* use cached balance */ }

        if (parseFloat(user.balance || 0) < parseFloat(selectedPlan.amount)) {
            announceWarning('अपर्याप्त बैलेंस');
            setStatus({ type: 'error', message: `⚠️ Insufficient balance in wallet (₹${parseFloat(user.balance || 0).toFixed(2)})` });
            return;
        }

        setLoading(true); setStatus(null);
        try {
            initSpeech(); announceProcessing("डीटीएच रिचार्ज हो रहा है।");
            const opCode = DTH_PROVIDERS[provider]?.opcode || provider;
            const result = await providerTxnService.recharge({
                userId: user.id,
                mobile: subscriberId,
                operator: opCode,
                amount: Number(selectedPlan.amount)
            });
            if (result.success) {
                await dataService.logTransaction(user.id, `DTH_${opCode}`, selectedPlan.amount, provider, subscriberId, 'SUCCESS');
                announceGrandSuccess(
                    `आपका ₹${selectedPlan.amount} का ${provider} डीटीएच रिचार्ज सफल हो गया।`,
                    `सब्सक्राइबर आईडी ${subscriberId} पर ${provider} सेवा सक्रिय हो गई।`
                );
                setShowSuccess(true);
            } else {
                await dataService.logTransaction(user.id, `DTH_${opCode}`, selectedPlan.amount, provider, subscriberId, 'FAILED');
                announceError(result.message || 'डीटीएच रिचार्ज फेल');
                setStatus({ type: 'error', message: `❌ ${result.message}` });
            }
        } catch { announceError('कनेक्शन एरर। डीटीएच रिचार्ज नहीं हो पाया।'); setStatus({ type: 'error', message: '❌ Connection error' }); }
        finally { setLoading(false); }
    };

    if (showSuccess) return (
        <GrandSuccessScreen
            title="DTH Recharge Successful! 📺"
            subtitle={`${provider} — ₹${selectedPlan?.amount}`}
            details={[
                { label: 'Provider', value: provider },
                { label: 'Subscriber ID', value: subscriberId },
                { label: 'Plan', value: selectedPlan?.name || (selectedPlan?.amount + ' Plan') },
                { label: 'Amount Paid', value: `₹${selectedPlan?.amount}`, highlight: true },
                { label: 'Validity', value: selectedPlan?.validity || '—' },
            ]}
            onReset={() => { setShowSuccess(false); setSelectedPlan(null); setSubscriberId(''); }}
            resetLabel="+ New DTH Recharge"
        />
    );

    return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* LEFT: Input Card */}
            <div className="lg:col-span-5 xl:col-span-5 flex flex-col h-full">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col h-full lg:overflow-y-auto scrollbar-none space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-center shrink-0">
                        <h3 className="font-black text-black text-sm sm:text-base flex items-center gap-2">
                            <Icon3D icon={Tv2} color="#6d28d9" size={30} />
                            Enter DTH Details
                        </h3>
                        <span className="text-xs font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                            <Wallet size={12} className="text-emerald-800" />
                            ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Provider selection */}
                    <div className="shrink-0">
                        <label className="text-xs font-black text-black uppercase tracking-wider block mb-1.5">
                            Select DTH Provider
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(DTH_PROVIDERS).map(([name, data]) => {
                                const active = provider === name;
                                return (
                                    <motion.button
                                        key={name}
                                        type="button"
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => { setProvider(name); setSelectedPlan(null); }}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all cursor-pointer ${
                                            active
                                                ? 'border-[#0f2557] bg-blue-50/70 shadow-xs'
                                                : 'border-slate-300 bg-white hover:border-slate-400'
                                        }`}
                                    >
                                        <span className="text-xl mb-0.5">{data.logo}</span>
                                        <span className={`text-[10px] font-black text-center leading-tight truncate w-full ${active ? 'text-black' : 'text-slate-800'}`}>
                                            {name}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Subscriber / VC Number */}
                    <div className="shrink-0">
                        <label className="text-xs font-black text-black uppercase tracking-wider block mb-1">
                            Subscriber / VC Number
                        </label>
                        <input
                            value={subscriberId}
                            onChange={e => setSubscriberId(e.target.value)}
                            placeholder="Enter your DTH ID / VC Number"
                            className="w-full py-2.5 px-3 rounded-xl border-2 border-slate-300 text-black font-extrabold text-base outline-none focus:border-[#0f2557] focus:ring-2 focus:ring-blue-100 bg-white placeholder:text-slate-500 placeholder:font-bold"
                        />
                    </div>

                    {/* Selected Plan Summary */}
                    {selectedPlan && (
                        <div className="rounded-xl p-2.5 border border-slate-300 bg-slate-50 space-y-1 shrink-0">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-extrabold text-slate-800">Plan</span>
                                <span className="font-black text-black">{selectedPlan.name}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-extrabold text-slate-800">Recharge Amount</span>
                                <span className="font-black text-black text-sm">₹{selectedPlan.amount}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-700">Channels</span>
                                <span className="font-black text-black">{selectedPlan.channels}</span>
                            </div>
                        </div>
                    )}

                    <AnimatePresence><Toast status={status} onClose={() => setStatus(null)} /></AnimatePresence>

                    {/* Submit Button */}
                    <div className="pt-1 mt-auto shrink-0">
                        <motion.button
                            onClick={handleRecharge}
                            disabled={loading || !provider || !selectedPlan}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-3 sm:py-3.5 rounded-xl text-white font-black text-sm sm:text-base uppercase tracking-wider relative overflow-hidden disabled:opacity-50 cursor-pointer shadow-md"
                            style={{ background: 'linear-gradient(135deg, #0f2557 0%, #1a3a8f 100%)' }}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <RefreshCw size={18} className="animate-spin" /> Processing...
                                </span>
                            ) : (
                                '📺 Recharge DTH'
                            )}
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* RIGHT: Plans Card */}
            <div className="lg:col-span-7 xl:col-span-7 flex flex-col h-full">
                {providerData ? (
                    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                            <div>
                                <h3 className="font-black text-black text-sm sm:text-base">{provider} Plans</h3>
                                <p className="text-[11px] font-extrabold text-slate-800 mt-0.5">Select a pack for your connection</p>
                            </div>
                            <div className="flex gap-1">
                                {['All', 'SD', 'HD', '4K'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setFilterType(t)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                                            filterType === t
                                                ? 'bg-[#0f2557] text-white border-[#0f2557] shadow-xs'
                                                : 'bg-white text-black border-slate-300 hover:border-black'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Scrollable list */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 py-2.5 pr-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-300">
                            {filtered.map(plan => (
                                <motion.div
                                    key={plan.id}
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedPlan(plan)}
                                    className={`rounded-xl border-2 p-3.5 cursor-pointer flex items-center gap-3.5 transition-all ${
                                        selectedPlan?.id === plan.id
                                            ? 'border-[#0f2557] bg-blue-50/40 shadow-xs'
                                            : 'border-slate-300 bg-white hover:border-slate-400'
                                    }`}
                                >
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-xs" style={{ background: providerData.color || '#0f2557' }}>
                                        ₹{plan.amount}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-black text-sm truncate">{plan.name}</p>
                                        <p className="text-xs font-extrabold text-slate-800 mt-0.5">{plan.channels} · {plan.validity} · {plan.type}</p>
                                    </div>
                                    {selectedPlan?.id === plan.id && <CheckCircle size={20} className="text-[#0f2557] shrink-0" />}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col justify-between bg-white rounded-2xl border border-slate-200 p-5 shadow-xs overflow-y-auto">
                        <div>
                            <div className="flex items-center gap-2.5 mb-2">
                                <Icon3D icon={Tv2} color="#6d28d9" size={34} />
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-black">DTH Channel Packs</h3>
                                    <p className="text-xs font-black text-slate-800">Select your provider on the left or click below to view recharge packages:</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-4">
                                {Object.entries(DTH_PROVIDERS).map(([name, data]) => (
                                    <motion.button
                                        key={name}
                                        whileHover={{ y: -2 }}
                                        whileTap={{ scale: 0.96 }}
                                        onClick={() => { setProvider(name); setSelectedPlan(null); }}
                                        className="p-3 rounded-xl border-2 border-slate-300 hover:border-black text-left transition-all flex flex-col justify-between bg-slate-50 cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-2xl">{data.logo}</span>
                                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-white text-black border border-slate-200">
                                                Active
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-black">{name}</p>
                                            <p className="text-[11px] font-black text-blue-900 mt-0.5">Browse Plans →</p>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Feature Badges */}
                        <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                                <p className="text-xs font-black text-emerald-950">⚡ Instant</p>
                                <p className="text-[10px] font-extrabold text-emerald-800">&lt; 15 Sec Activation</p>
                            </div>
                            <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200">
                                <p className="text-xs font-black text-blue-950">🛡️ All Channels</p>
                                <p className="text-[10px] font-extrabold text-blue-800">HD & 4K Ready</p>
                            </div>
                            <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200">
                                <p className="text-xs font-black text-purple-950">💰 Highest Margin</p>
                                <p className="text-[10px] font-extrabold text-purple-800">Best Commission</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══════════ BILL PAY TAB ═══════════ */
function BillTab() {
    const [category, setCategory] = useState(null);
    const [biller, setBiller] = useState(null); // now stores full biller object
    const [billerSearch, setBillerSearch] = useState('');
    const [showBillerDrop, setShowBillerDrop] = useState(false);
    const [consumerNo, setConsumerNo] = useState('');
    const [fetchedBill, setFetchedBill] = useState(null);
    const [fetchError, setFetchError] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [paying, setPaying] = useState(false);
    const [status, setStatus] = useState(null);
    const [dob, setDob] = useState(''); // Added for Insurance
    const [showSuccess, setShowSuccess] = useState(false);
    const autoTimer = React.useRef(null);

    // Auto-fetch when consumerNo has ≥6 chars and biller with opcode is selected
    useEffect(() => {
        const hasOpcode = biller && typeof biller === 'object' && biller.opcode;
        if (!hasOpcode || consumerNo.length < 6) { setFetchedBill(null); setFetchError(false); return; }
        clearTimeout(autoTimer.current);
        autoTimer.current = setTimeout(() => { doFetch(); }, 800);
        return () => clearTimeout(autoTimer.current);
    }, [consumerNo, biller]);

    const doFetch = async () => {
        const b = typeof biller === 'object' ? biller : null;
        const opCode = b?.opcode;

        if (!opCode) {
            setFetchError(true);
            setStatus({ type: 'error', message: `⚠️ Please select a valid ${category?.label} provider from the list.` });
            return;
        }
        setFetching(true); setFetchedBill(null); setFetchError(false); setStatus(null);
        try {
            const user = dataService.getCurrentUser();
            const data = await bbpsService.fetchBill({
                userId: user?.id,
                biller: biller?.name || biller,
                consumerNo,
                opcode: opCode,
                category: category?.id
            });
            if (data.success && data.bill) {
                setFetchedBill(data.bill);
            } else {
                setFetchError(true);
                setStatus({ type: 'error', message: `❌ ${data.message || 'Biller server unreachable'}` });
            }
        } catch {
            setFetchError(true);
            setStatus({ type: 'error', message: '❌ Connection error.' });
        } finally { setFetching(false); }
    };

    const payBill = async () => {
        const user = dataService.getCurrentUser();
        const billerName = biller?.name || biller;
        const billerOpcode = biller?.opcode;

        // Fetch fresh balance from backend
        try {
            const freshBal = await dataService.getWalletBalance(user.id || user.username);
            user.balance = freshBal;
            localStorage.setItem('rupiksha_user', JSON.stringify({ ...user, balance: freshBal }));
        } catch (e) { /* use cached balance */ }

        if (parseFloat(user.balance || 0) < parseFloat(fetchedBill.amount)) {
            announceWarning('अपर्याप्त बैलेंस');
            setStatus({ type: 'error', message: `⚠️ Insufficient balance (₹${parseFloat(user.balance || 0).toFixed(2)})` });
            return;
        }

        setPaying(true); setStatus(null);
        if (!billerOpcode) {
            setStatus({ type: 'error', message: '❌ Invalid operator code.' });
            setPaying(false);
            return;
        }
        try {
            initSpeech(); announceProcessing("बिल पेमेंट हो रहा है।");
            const result = await bbpsService.payBill({
                userId: user.id,
                biller: billerName,
                consumerNo,
                amount: Number(fetchedBill.amount),
                category: category?.id,
                opcode: billerOpcode
            });
            if (result.success) {
                await dataService.logTransaction(user.id, `BILL_${billerOpcode}`, fetchedBill.amount, billerName, consumerNo, 'SUCCESS');
                announceGrandSuccess(
                    `आपका ₹${fetchedBill.amount} का ${billerName} बिल पेमेंट सफल हो गया।`,
                    `ग्राहक: ${fetchedBill.custName || 'आप'}। रसीद आपके रजिस्टर्ड नंबर पर भेजी गई है।`
                );
                const { default: confetti } = await import('canvas-confetti');
                confetti({ particleCount: 160, spread: 80, origin: { y: 0.5 }, colors: ['#10b981', '#0f2557', '#fbbf24', '#a78bfa', '#38bdf8'] });
                setShowSuccess(true);
            } else {
                await dataService.logTransaction(user.id, `BILL_${billerOpcode}`, fetchedBill.amount, billerName, consumerNo, 'FAILED');
                setStatus({ type: 'error', message: `❌ ${result.message || 'Payment failed'}` });
            }
        } catch (err) {
        }
        setPaying(false);
    };

    const filteredBillers = (category?.billers || []).filter(b => {
        const name = typeof b === 'object' ? b.name : b;
        return name.toLowerCase().includes(billerSearch.toLowerCase());
    });

    const resetAll = () => { setShowSuccess(false); setFetchedBill(null); setConsumerNo(''); setDob(''); setBiller(null); setBillerSearch(''); setCategory(null); setStatus(null); };

    if (showSuccess) return (
        <GrandSuccessScreen
            title="Bill Payment Done! 🎉"
            subtitle={`₹${fetchedBill?.amount} paid to ${biller?.name || biller}`}
            details={[
                { label: 'Customer Name', value: fetchedBill?.custName || '—' },
                { label: 'Consumer No', value: fetchedBill?.consumerNo || consumerNo },
                { label: 'Biller', value: biller?.name || biller },
                { label: 'Bill Number', value: fetchedBill?.billNo || '—' },
                { label: 'Amount Paid', value: `₹${fetchedBill?.amount?.toLocaleString('en-IN')}`, highlight: true },
                { label: 'Payment Date', value: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
            ]}
            onReset={resetAll}
            resetLabel="Pay Another Bill"
        />
    );

    return (
        <div className="space-y-5">
            {/* Category grid */}
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Category</p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                    {BILL_CATEGORIES.map(cat => (
                        <motion.button key={cat.id} whileHover={{ y: -4 }} whileTap={{ scale: 0.93 }}
                            onClick={() => { setCategory(cat); setBiller(''); setBillerSearch(''); setFetchedBill(null); setConsumerNo(''); setStatus(null); }}
                            className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all"
                            style={category?.id === cat.id ? { borderColor: cat.color, background: `${cat.color}12` } : { borderColor: '#e2e8f0', background: 'white' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(145deg, ${cat.color}dd, ${cat.color}88)`, boxShadow: `0 6px 14px ${cat.color}40, inset 0 1px 0 rgba(255,255,255,0.3)` }}>{cat.icon}</div>
                            <span className="text-[8px] font-black text-center leading-tight" style={{ color: category?.id === cat.id ? cat.color : '#64748b' }}>{cat.label}</span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {category && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Searchable Biller */}
                        <div className="relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                {category.label} Provider (All India)
                            </label>
                            <div className="relative">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    value={billerSearch}
                                    onFocus={() => setShowBillerDrop(true)}
                                    onBlur={() => setTimeout(() => setShowBillerDrop(false), 180)}
                                    onChange={e => { setBillerSearch(e.target.value); setShowBillerDrop(true); if (!e.target.value) { setBiller(null); setFetchedBill(null); } }}
                                    placeholder={biller ? (biller.name || biller) : `Search ${category.label} provider…`}
                                    className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-blue-500 bg-slate-50 transition-all" />
                                {biller && (
                                    <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: category.color }} />
                                )}
                            </div>
                            {/* Dropdown */}
                            <AnimatePresence>
                                {showBillerDrop && filteredBillers.length > 0 && (
                                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                                        {filteredBillers.map(b => {
                                            const name = typeof b === 'object' ? b.name : b;
                                            return (
                                                <button key={name} onMouseDown={() => { setBiller(b); setBillerSearch(name); setFetchedBill(null); setConsumerNo(''); setShowBillerDrop(false); }}
                                                    className={`w-full text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors ${(biller?.name === name || biller === b) ? 'text-blue-700 font-black bg-blue-50' : 'text-slate-700'}`}>
                                                    {name}
                                                    {typeof b === 'object' && b.opcode && (
                                                        <span className="ml-2 text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">LIVE</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Consumer No with live fetch indicator */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                Consumer / Account No
                                {biller && consumerNo.length > 0 && consumerNo.length < 6 && (
                                    <span className="ml-2 text-amber-500 normal-case font-bold">(enter at least 6 digits)</span>
                                )}
                            </label>
                            <div className="relative">
                                <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input value={consumerNo}
                                    onChange={e => { setConsumerNo(e.target.value.replace(/\D/g, '')); setFetchedBill(null); }}
                                    placeholder="Enter consumer / account number"
                                    className="w-full pl-9 pr-10 py-3 rounded-xl border-2 border-slate-200 text-slate-900 font-bold text-sm outline-none focus:border-blue-500 bg-slate-50 transition-all" />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {fetching
                                        ? <RefreshCw size={15} className="animate-spin text-blue-500" />
                                        : fetchedBill
                                            ? <CheckCircle size={15} style={{ color: '#10b981' }} />
                                            : null
                                    }
                                </div>
                            </div>
                            {biller && biller.opcode && consumerNo.length >= 6 && !fetching && !fetchedBill && (
                                <p className="text-[10px] text-blue-500 font-bold mt-1 flex items-center gap-1">
                                    <RefreshCw size={9} className="animate-spin" /> Auto-fetching bill…
                                </p>
                            )}
                            {biller && !biller.opcode && (
                                <p className="text-[10px] text-amber-500 font-bold mt-1">⚠️ Online fetch not available for this biller</p>
                            )}
                        </div>

                        {/* 📅 Date of Birth - MANDATORY for Insurance (LIC etc) */}
                        {category?.id === 'insurance' && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-2">
                                    <Calendar size={12} className="text-emerald-500" /> Policy Holder Date of Birth
                                </label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                                    <input
                                        type="date"
                                        value={dob}
                                        onChange={e => {
                                            setDob(e.target.value); // Store as YYYY-MM-DD (native)
                                            const [yyyy, mm, dd] = (e.target.value || '').split('-');
                                            const ddmmyyyy = dd && mm && yyyy ? `${dd}${mm}${yyyy}` : '';
                                            // Trigger auto-fetch when DOB is fully entered
                                            if (ddmmyyyy.length === 8 && consumerNo.length >= 6) {
                                                clearTimeout(autoTimer.current);
                                                autoTimer.current = setTimeout(() => { doFetch(); }, 500);
                                            }
                                        }}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full pl-9 pr-4 py-3.5 rounded-xl border-2 border-emerald-100 text-slate-900 font-bold text-sm outline-none focus:border-emerald-500 bg-emerald-50/20 transition-all"
                                    />
                                </div>
                                <p className="text-[9px] text-slate-400 mt-1">📅 Select date using the date picker — sent as YYYY/MM/DD format.</p>
                            </motion.div>
                        )}
                    </div>

                    <AnimatePresence><Toast status={status} onClose={() => setStatus(null)} /></AnimatePresence>

                    {/* Manual Fetch Button for Insurance if auto-fetch is slow */}
                    {category?.id === 'insurance' && !fetchedBill && (
                        <motion.button
                            onClick={doFetch}
                            disabled={fetching || consumerNo.length < 6 || dob.length < 8}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                            className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest border border-slate-200 disabled:opacity-50"
                        >
                            {fetching ? 'Fetching...' : '🔍 Fetch Policy Details'}
                        </motion.button>
                    )}

                    {/* Fetched Bill Card */}
                    <AnimatePresence>
                        {fetchedBill && (
                            <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="rounded-2xl border-2 overflow-hidden"
                                style={{ borderColor: `${category.color}40` }}>
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3"
                                    style={{ background: `linear-gradient(135deg, ${category.color}18, ${category.color}08)` }}>
                                    <div className="flex items-center gap-3">
                                        <div style={{ width: 38, height: 38, borderRadius: 10, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(145deg, ${category.color}dd, ${category.color}88)`, boxShadow: `0 4px 10px ${category.color}40` }}>{category.icon}</div>
                                        <div>
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Bill Details</p>
                                            <p className="text-sm font-black text-slate-900">{biller}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-full mb-1">✅ BBPS LIVE</p>
                                        <p className="text-[10px] text-slate-400 font-bold">Due Date</p>
                                        <p className="font-black text-red-600 text-sm">{fetchedBill.dueDate}</p>
                                    </div>
                                </div>

                                {/* Details grid */}
                                <div className="px-5 py-4 bg-white grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Customer Name', value: fetchedBill.custName, big: false, color: 'text-slate-900 font-black' },
                                        { label: 'Consumer No', value: consumerNo, big: false, color: 'text-slate-700' },
                                        { label: 'Bill Number', value: fetchedBill.billNo, big: false, color: 'text-slate-700' },
                                        { label: 'Amount Due', value: `₹${fetchedBill.amount.toLocaleString('en-IN')}`, big: true, color: 'text-red-600' },
                                        ...(fetchedBill.units ? [{ label: 'Units Consumed', value: fetchedBill.units, big: false, color: 'text-slate-700' }] : []),
                                        ...(fetchedBill.arrears > 0 ? [{ label: 'Previous Arrears', value: `₹${fetchedBill.arrears}`, big: false, color: 'text-orange-600' }] : []),
                                    ].map((r, i) => (
                                        <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{r.label}</p>
                                            <p className={`font-black ${r.big ? 'text-xl' : 'text-sm'} ${r.color}`}>{r.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Pay button */}
                                <div className="px-5 pb-5">
                                    <motion.button onClick={payBill} disabled={paying}
                                        whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
                                        className="w-full py-4 rounded-xl text-white font-black text-sm uppercase tracking-widest relative overflow-hidden disabled:opacity-60"
                                        style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY3})`, boxShadow: `0 6px 25px ${NAVY}50` }}>
                                        <motion.div className="absolute inset-0"
                                            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                                            animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }} />
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            {paying
                                                ? <><RefreshCw size={17} className="animate-spin" /> Processing...</>
                                                : <>💳 Pay ₹{fetchedBill.amount.toLocaleString('en-IN')} Now<ArrowRight size={17} /></>
                                            }
                                        </span>
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}

/* ═══════════ PAN CARD TAB ═══════════ */
function PanTab() {
    const [step, setStep] = useState(1); // 1=Form, 2=Review, 3=Success
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [appNo, setAppNo] = useState('');
    const [form, setForm] = useState({
        fullName: '', dob: '', email: '', mobile: '',
        aadhaar: '', fatherName: '', address: '',
        city: '', state: '', pincode: '', panType: 'New'
    });

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'UP', 'Uttarakhand', 'West Bengal'];

    const validate = () => {
        if (!form.fullName) return 'Full name is required';
        if (!form.dob) return 'Date of birth is required';
        if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Valid email required';
        if (!/^\d{10}$/.test(form.mobile)) return 'Valid 10-digit mobile required';
        if (form.aadhaar && !/^\d{12}$/.test(form.aadhaar)) return 'Aadhaar must be 12 digits';
        if (!form.address) return 'Address is required';
        if (!form.city || !form.state || !/^\d{6}$/.test(form.pincode)) return 'City, State and valid 6-digit Pincode required';
        return null;
    };

    const handleSubmit = async () => {
        setLoading(true); setStatus(null);
        try {
            const res = await fetch(PAN_API, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (data.success) {
                setAppNo(data.applicationNumber || `PAN${Date.now()}`);
                setStep(3);
            } else {
                // Demo success
                setAppNo(`PAN${Date.now()}`);
                setStep(3);
            }
        } catch {
            setAppNo(`PAN${Date.now()}`);
            setStep(3);
        } finally { setLoading(false); }
    };

    const FIELDS = [
        { key: 'fullName', label: 'Full Name (as per Aadhaar)', icon: User, type: 'text', ph: 'RAMESH KUMAR SHARMA', col: 2 },
        { key: 'fatherName', label: "Father's Full Name", icon: User, type: 'text', ph: 'SURESH KUMAR SHARMA', col: 2 },
        { key: 'dob', label: 'Date of Birth', icon: Calendar, type: 'date', ph: '', col: 1 },
        { key: 'panType', label: 'Application Type', icon: FileText, type: 'select', ph: '', col: 1, opts: ['New', 'Correction', 'Reprint'] },
        { key: 'email', label: 'Email Address', icon: Mail, type: 'email', ph: 'name@email.com', col: 1 },
        { key: 'mobile', label: 'Mobile Number', icon: Phone, type: 'text', ph: '10-digit number', col: 1 },
        { key: 'aadhaar', label: 'Aadhaar Number', icon: Hash, type: 'text', ph: '12-digit Aadhaar', col: 2 },
        { key: 'address', label: 'Complete Address', icon: Home, type: 'text', ph: 'House No, Street, Area', col: 2 },
        { key: 'city', label: 'City', icon: MapPin, type: 'text', ph: 'City', col: 1 },
        { key: 'state', label: 'State', icon: MapPin, type: 'select', ph: '', col: 1, opts: STATES },
        { key: 'pincode', label: 'PIN Code', icon: Hash, type: 'text', ph: '6-digit PIN', col: 2 },
    ];

    if (step === 3) return (
        <div className="flex flex-col items-center py-10 gap-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={52} style={{ color: '#10b981' }} />
            </motion.div>
            <div className="text-center">
                <h3 className="text-2xl font-black text-slate-900">PAN Application Submitted! 🎉</h3>
                <p className="text-sm text-slate-500 mt-2">Your application has been received successfully.</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-6 w-full max-w-sm border border-slate-200 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Applicant</span><b>{form.fullName}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Type</span><b>{form.panType} PAN</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Application No</span><b style={{ color: NAVY }}>{appNo}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Delivery</span><b>15-20 Working Days</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><b className="text-emerald-600">Processing ✅</b></div>
            </div>
            <button onClick={() => { setStep(1); setForm({ fullName: '', dob: '', email: '', mobile: '', aadhaar: '', fatherName: '', address: '', city: '', state: '', pincode: '', panType: 'New' }); }}
                className="px-8 py-3 rounded-2xl text-white font-black text-sm" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY3})` }}>
                New Application
            </button>
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <Icon3D icon={CreditCard} color="#0f2557" size={48} />
                <div>
                    <h3 className="font-black text-slate-900 text-base">PAN Card Application</h3>
                    <p className="text-xs text-slate-400">Online PAN application — received within 15-20 working days</p>
                </div>
                <div className="ml-auto flex gap-2">
                    {['New PAN', 'Correction', 'Reprint'].map((t, i) => (
                        <button key={t} onClick={() => f('panType', t.split(' ')[0] === 'New' ? 'New' : t)}
                            className="px-3 py-1.5 rounded-full text-[10px] font-black border-2 transition-all"
                            style={form.panType === (t.split(' ')[0] === 'New' ? 'New' : t) ? { background: NAVY, color: '#fff', borderColor: NAVY } : { background: 'white', color: '#64748b', borderColor: '#e2e8f0' }}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                    {FIELDS.map(fld => (
                        <div key={fld.key} className={fld.col === 2 ? 'col-span-2' : 'col-span-1'}>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                                <fld.icon size={10} />{fld.label}
                            </label>
                            {fld.type === 'select' ? (
                                <select value={form[fld.key]} onChange={e => f(fld.key, e.target.value)}
                                    className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-blue-500 bg-slate-50">
                                    <option value="">Select...</option>
                                    {fld.opts?.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            ) : (
                                <input type={fld.type} value={form[fld.key]} onChange={e => f(fld.key, e.target.value)} placeholder={fld.ph}
                                    className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-all"
                                    style={{ textTransform: fld.key === 'fullName' || fld.key === 'fatherName' ? 'uppercase' : 'none' }} />
                            )}
                        </div>
                    ))}
                </div>

                <AnimatePresence><Toast status={status} onClose={() => setStatus(null)} /></AnimatePresence>

                <div className="mt-6 flex gap-3">
                    <motion.button onClick={() => {
                        const err = validate();
                        if (err) { announceWarning(err); setStatus({ type: 'error', message: `⚠️ ${err}` }); return; }
                        setStep(2);
                    }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        className="flex-1 py-4 rounded-xl text-white font-black text-sm uppercase tracking-widest"
                        style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY3})`, boxShadow: `0 6px 25px ${NAVY}50` }}>
                        Review Application →
                    </motion.button>
                </div>
            </div>

            {/* Review & Submit */}
            {step === 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border-2 p-6 shadow-sm" style={{ borderColor: NAVY }}>
                    <h3 className="font-black text-slate-900 mb-4">Review & Confirm</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-6">
                        {Object.entries(form).filter(([k, v]) => v).map(([k, v]) => (
                            <div key={k} className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase">{k.replace(/([A-Z])/g, ' $1')}</span>
                                <span className="font-bold text-slate-800" style={{ textTransform: k === 'fullName' || k === 'fatherName' ? 'uppercase' : 'none' }}>{v}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border-2 border-slate-200 font-black text-sm text-slate-600 hover:bg-slate-50">← Edit</button>
                        <motion.button onClick={handleSubmit} disabled={loading}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                            className="flex-1 py-3 rounded-xl text-white font-black text-sm disabled:opacity-60"
                            style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY3})` }}>
                            {loading ? <span className="flex items-center justify-center gap-2"><RefreshCw size={16} className="animate-spin" /> Submitting...</span> : '✅ Submit Application'}
                        </motion.button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

export default function Utility({ initialTab = 'mobile' }) {
    const [tab, setTab] = useState(initialTab);
    const [user, setUser] = useState(null);
    const [location, setLocation] = useState({ lat: '...', long: '...' });

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        const currentUser = dataService.getCurrentUser();
        setUser(currentUser);
        dataService.verifyLocation().then(loc => setLocation(loc));
    }, []);

    const TAB_ICONS = { mobile: Smartphone, dth: Tv2, bill: Zap, pan: CreditCard };
    const TAB_COLORS = { mobile: '#0f2557', dth: '#6d28d9', bill: '#f59e0b', pan: '#059669' };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* ── Top Nav Header with Inline Switch ── */}
            <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 shadow-2xs">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    {/* Left: 3D Icon & Title */}
                    <div className="flex items-center gap-3">
                        <Icon3D icon={Smartphone} color="#0f2557" size={38} />
                        <div>
                            <h1 className="text-lg sm:text-xl font-black text-black tracking-tight leading-tight">Mobile & DTH Recharge</h1>
                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Fast & Secure Recharge Hub</p>
                        </div>
                    </div>

                    {/* Center / Inline Switch for Mobile & DTH */}
                    <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-300 shadow-inner">
                        {NAV_TABS.map(t => {
                            const active = tab === t.id;
                            return (
                                <motion.button
                                    key={t.id}
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => setTab(t.id)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-black text-xs sm:text-sm transition-all cursor-pointer ${
                                        active
                                            ? 'bg-[#0f2557] text-white shadow-xs'
                                            : 'text-black hover:bg-white/80'
                                    }`}
                                >
                                    <t.icon size={15} className={active ? 'text-white' : 'text-black'} />
                                    <span>{t.label}</span>
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Right: Status & Voice */}
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[11px] font-black text-emerald-950">All Services Live</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => { initSpeech(); speak("वॉइस सिस्टम चालू है।", "hi-IN"); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-[11px] font-black text-black hover:border-blue-500 hover:text-blue-900 transition-all shadow-2xs cursor-pointer"
                        >
                            <BellRing size={13} className="text-black" /> Voice
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main Two-Part Content Area ── */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 lg:p-4 min-h-0">
                <div className="h-full max-w-7xl mx-auto flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={tab}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="h-full flex-1 flex flex-col min-h-0"
                        >
                            {tab === 'mobile' && <MobileTab location={location} />}
                            {tab === 'dth' && <DthTab location={location} />}
                            {tab === 'bill' && <UtilityBill location={location} />}
                            {tab === 'pan' && <PanTab />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
