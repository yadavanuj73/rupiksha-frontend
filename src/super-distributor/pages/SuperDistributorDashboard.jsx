import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BACKEND_URL } from '../../services/dataService';
import { sharedDataService } from '../../services/sharedDataService';
import { dataService } from '../../services/dataService';
import { payoutService, transactionService } from '../../services/apiService';
import {
    CheckCircle2, XCircle, Clock, Search, RefreshCw, AlertTriangle,
    X, Building2, ShieldCheck, User, Mail, Phone, ExternalLink, Check, Copy,
    ChevronRight, Wallet, Users, Activity, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Number Formatters ────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtCur = (n) =>
    Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SERVICE_CONFIG = {
    AEPS: { label: 'AEPS Banking', icon: '🏦', accent: '#4f46e5', priority: true },
    PAYOUT: { label: 'Payout', icon: '💸', accent: '#059669' },
    CMS: { label: 'CMS Collections', icon: '⚡', accent: '#d97706' },
    DMT: { label: 'Money Transfer (DMT)', icon: '📲', accent: '#dc2626', priority: true },
    BHARAT_CONNECT: { label: 'Bharat Connect', icon: '🔗', accent: '#0284c7' },
    OTHER: { label: 'Other Services', icon: '🛠️', accent: '#7c3aed' },
};

const TXN_STATUS_ICON = { SUCCESS: '✅', PENDING: '⏳', FAILED: '❌', PROCESSING: '🔄' };
const TXN_STATUS_COLOR = { SUCCESS: '#16a34a', PENDING: '#d97706', FAILED: '#ef4444', PROCESSING: '#0284c7' };

// ─── Sub-components ───────────────────────────────────────────────────────────

function LivePulse({ connected }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: connected ? '#4ade80' : '#f87171',
                boxShadow: connected ? '0 0 10px #4ade80' : '0 0 8px #f87171',
                animation: 'pulse 1.4s ease-in-out infinite',
                display: 'inline-block'
            }} />
            <span style={{ color: connected ? '#4ade80' : '#f87171' }}>
                {connected ? 'LIVE' : 'OFFLINE'}
            </span>
        </span>
    );
}

function KpiCard({ title, icon, accent = '#6366f1', children }) {
    const [hov, setHov] = useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${accent}30`,
                borderTop: `3px solid ${accent}`,
                borderRadius: 16,
                padding: '18px 20px',
                boxShadow: hov
                    ? `0 12px 40px ${accent}25`
                    : `0 4px 24px rgba(0,0,0,0.06)`,
                transform: hov ? 'translateY(-3px)' : 'translateY(0)',
                transition: 'all 0.25s ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: `${accent}15`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, border: `1px solid ${accent}30`
                }}>{icon}</div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: 0.3 }}>{title}</span>
            </div>
            {children}
        </div>
    );
}

function StatRow({ label, value, accent }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: accent || '#334155', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
    );
}

function ServiceCard({ serviceKey, data }) {
    const cfg = SERVICE_CONFIG[serviceKey] || { label: serviceKey, icon: '📊', accent: '#6366f1' };
    const { todayTxn = 0, todayAmt = 0, monthlyTxn = 0, monthlyAmt = 0, todayComm = 0, monthlyComm = 0 } = data || {};
    const [hov, setHov] = useState(false);

    const isPayout = serviceKey?.toLowerCase() === 'payout' || cfg.label?.toLowerCase() === 'payout';
    const commLabelToday = isPayout ? 'Today Charges' : 'Today Comm';
    const commLabelMonthly = isPayout ? 'Monthly Charges' : 'Monthly Comm';

    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${cfg.accent}25`,
                borderLeft: `4px solid ${cfg.accent}`,
                borderRadius: 14,
                padding: '16px 18px',
                boxShadow: hov ? `0 8px 30px ${cfg.accent}20` : '0 4px 16px rgba(0,0,0,0.04)',
                transform: hov ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{cfg.label}</span>
                </div>
                {cfg.priority && (
                    <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 8px',
                        borderRadius: 20, background: '#fee2e2', color: '#ef4444',
                        border: '1px solid #fca5a5', letterSpacing: 0.5
                    }}>⚡ PRIORITY</span>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                    ['Today Txn', fmt(todayTxn)],
                    ['Today Amt', `₹${fmt(todayAmt)}`],
                    [commLabelToday, `₹${fmtCur(todayComm)}`],
                    ['Monthly Txn', fmt(monthlyTxn)],
                    ['Monthly Amt', `₹${fmt(monthlyAmt)}`],
                    [commLabelMonthly, `₹${fmtCur(monthlyComm)}`],
                ].map(([label, val]) => (
                    <div key={label} style={{
                        background: `${cfg.accent}08`, borderRadius: 8,
                        padding: '8px 6px', textAlign: 'center',
                        border: `1px solid ${cfg.accent}15`
                    }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: cfg.accent, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ActivityFeed({ transactions }) {
    const allTxns = [...(transactions || [])];

    if (allTxns.length === 0) {
        return (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No transactions recorded yet.</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Transactions will appear here in real-time as your network members perform operations.</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {allTxns.map((txn, i) => {
                const status = (txn.status || 'PENDING').toUpperCase();
                const statusColor = TXN_STATUS_COLOR[status] || '#64748b';
                const statusIcon = TXN_STATUS_ICON[status] || '⏳';
                return (
                    <div key={txn.id || txn.order_id || i} style={{
                        minWidth: 190, flexShrink: 0,
                        background: 'rgba(255,255,255,0.9)',
                        border: `1px solid ${statusColor}25`,
                        borderTop: `3px solid ${statusColor}`,
                        borderRadius: 12, padding: '12px 14px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        animation: 'fadeSlideIn 0.3s ease'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>{txn.type || txn.service_type || 'TXN'}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: statusColor }}>{statusIcon} {status}</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>
                            {txn.userName || txn.user_name || txn.user_id || 'Network User'}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', marginBottom: 4 }}>
                            ₹{fmt(txn.amount)}
                        </div>
                        {txn.operator && (
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{txn.operator} {txn.number ? `· ${txn.number}` : ''}</div>
                        )}
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>
                            {txn.created_at || txn.date ? new Date(txn.created_at || txn.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Super Distributor Dashboard ─────────────────────────────────────────
const SuperDistributorDashboard = () => {
    const navigate = useNavigate();
    const [dist, setDist] = useState(null);
    const [networkUsers, setNetworkUsers] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [retailers, setRetailers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [connected, setConnected] = useState(false);
    const [lastFetch, setLastFetch] = useState(null);
    const [time, setTime] = useState(new Date());

    // Beneficiary Approval State for Mapped Network
    const [beneStats, setBeneStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
    const [beneList, setBeneList] = useState([]);
    const [beneLoading, setBeneLoading] = useState(false);
    const [showBeneModal, setShowBeneModal] = useState(false);
    const [beneFilter, setBeneFilter] = useState('ALL');
    const [beneSearch, setBeneSearch] = useState('');
    const [copiedField, setCopiedField] = useState('');

    const distRef = useRef(null);

    const handleCopy = (text, key) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(key);
        setTimeout(() => setCopiedField(''), 2000);
    };

    // Load Super Distributor, Downstream Network, Transactions, and Beneficiaries
    const loadDashboardData = useCallback(async () => {
        try {
            const session = sharedDataService.getCurrentSuperDistributor() || dataService.getCurrentUser();
            if (!session) return;

            const freshDist = (session.id && sharedDataService.getSuperDistributorById(session.id)) || session;
            distRef.current = freshDist;

            // Get live wallet balance
            let distBal = freshDist?.wallet?.balance || 0;
            try {
                distBal = await dataService.getWalletBalance(freshDist.id || freshDist.userId);
            } catch (_) {}

            setDist({ ...freshDist, wallet: { balance: distBal } });

            const sdId = String(freshDist.id || freshDist._id || freshDist.userId || '').trim().toLowerCase();
            const sdPartyCode = String(freshDist.partyCode || freshDist.userCode || '').trim().toUpperCase();

            // Fetch all users
            let allUsers = [];
            try {
                allUsers = await dataService.getAllUsers();
                if (!Array.isArray(allUsers)) allUsers = [];
            } catch {
                allUsers = dataService.getData().users || [];
            }

            const localUsers = dataService.getData().users || [];
            const cachedUsersRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('rupiksha_users_cache') : null;
            let cachedUsers = [];
            try { if (cachedUsersRaw) cachedUsers = JSON.parse(cachedUsersRaw); } catch {}

            const userMap = new Map();
            [...allUsers, ...localUsers, ...cachedUsers].forEach((u) => {
                if (!u) return;
                const key = String(u.id || u._id || u.username || u.mobile || u.partyCode || '');
                if (key && !userMap.has(key)) userMap.set(key, u);
            });

            const combinedList = Array.from(userMap.values());

            // 1. Mapped Distributors under this Super Distributor
            const myDists = combinedList.filter((u) => {
                const rRole = String(u?.role || (u?.roles && u.roles[0]) || '').replace(/^ROLE_/i, '').toUpperCase();
                if (rRole !== 'DISTRIBUTOR') return false;
                const parentRef = String(u?.addedByUserRef || u?.ownerId || u?.parentId || u?.parent_id || '').toLowerCase();
                const parentCode = String(u?.parentPartyCode || u?.addedByPartyCode || '').toUpperCase();
                return parentRef === sdId || (sdPartyCode && parentCode === sdPartyCode);
            });
            setDistributors(myDists);

            const myDistIds = new Set(myDists.map(d => String(d.id || d._id || d.userId || '').toLowerCase()));

            // 2. Mapped Retailers under this Super Distributor or under its Distributors
            const myRtls = combinedList.filter((u) => {
                const rRole = String(u?.role || (u?.roles && u.roles[0]) || '').replace(/^ROLE_/i, '').toUpperCase();
                if (rRole !== 'RETAILER' && rRole !== 'RETAILERS') return false;
                const parentRef = String(u?.addedByUserRef || u?.ownerId || u?.parentId || u?.parent_id || '').toLowerCase();
                const parentCode = String(u?.parentPartyCode || u?.addedByPartyCode || '').toUpperCase();
                return parentRef === sdId || (sdPartyCode && parentCode === sdPartyCode) || myDistIds.has(parentRef);
            });
            setRetailers(myRtls);

            const allDownstream = [...myDists, ...myRtls];
            setNetworkUsers(allDownstream);

            // Build key set for transaction & beneficiary filtering
            const mappedKeySet = new Set();
            allDownstream.forEach(r => {
                if (r.id) mappedKeySet.add(String(r.id).toLowerCase());
                if (r._id) mappedKeySet.add(String(r._id).toLowerCase());
                if (r.userId) mappedKeySet.add(String(r.userId).toLowerCase());
                if (r.username) mappedKeySet.add(String(r.username).toLowerCase());
                if (r.partyCode) mappedKeySet.add(String(r.partyCode).toLowerCase());
                if (r.mobile) mappedKeySet.add(String(r.mobile));
                if (r.email) mappedKeySet.add(String(r.email).toLowerCase());
            });
            if (sdId) mappedKeySet.add(sdId);
            if (sdPartyCode) mappedKeySet.add(sdPartyCode.toLowerCase());

            // Fetch transactions & filter to mapped network
            let allTxns = [];
            try {
                const userTxns = await dataService.getUserTransactions(freshDist.id || freshDist.userId);
                if (Array.isArray(userTxns)) allTxns.push(...userTxns);
            } catch (_) {}

            try {
                const historyRes = await transactionService.getHistory({ size: 100 });
                if (historyRes?.transactions && Array.isArray(historyRes.transactions)) {
                    allTxns.push(...historyRes.transactions);
                } else if (Array.isArray(historyRes)) {
                    allTxns.push(...historyRes);
                }
            } catch (_) {}

            const localTxns = dataService.getData().transactions || [];
            allTxns.push(...localTxns);

            // Deduplicate and filter to network
            const txnMap = new Map();
            allTxns.forEach(t => {
                if (!t) return;
                const tUser = String(t.user_id || t.userId || t.userName || t.user_name || t.partyCode || '').toLowerCase();
                const tParent = String(t.parent_id || t.parentUserId || t.distributorId || '').toLowerCase();
                const isMapped = mappedKeySet.has(tUser) || (sdId && tParent === sdId) || (sdPartyCode && tParent === sdPartyCode.toLowerCase());

                if (isMapped || allTxns.length < 5) {
                    const idKey = t.id || t.order_id || t.txnid || `${t.amount}_${t.created_at || t.date}_${tUser}`;
                    if (!txnMap.has(idKey)) txnMap.set(idKey, t);
                }
            });

            const filteredTxns = Array.from(txnMap.values()).sort((a, b) => {
                const dA = new Date(a.created_at || a.date || 0);
                const dB = new Date(b.created_at || b.date || 0);
                return dB - dA;
            });
            setTransactions(filteredTxns);

            // Fetch Beneficiaries and filter to network
            let beneItems = [];
            try {
                const allBene = await payoutService.getAdminBeneficiaries();
                if (Array.isArray(allBene)) {
                    beneItems = allBene.filter(b => {
                        const bCode = String(b.userPartyCode || '').toLowerCase();
                        const bMobile = String(b.userMobile || '');
                        const bEmail = String(b.userEmail || '').toLowerCase();
                        const bUser = String(b.userId || b.username || '').toLowerCase();

                        return mappedKeySet.has(bCode) || mappedKeySet.has(bMobile) || mappedKeySet.has(bEmail) || mappedKeySet.has(bUser);
                    });
                }
            } catch (_) {}

            // Fallback to local accounts if empty
            if (beneItems.length === 0) {
                const localAccounts = (dataService.getData()?.accounts || []).filter(a => {
                    const aUser = String(a.userId || a.username || a.partyCode || '').toLowerCase();
                    return mappedKeySet.has(aUser);
                });
                beneItems = localAccounts.map((a, idx) => ({
                    id: a.id || `acc_${idx}`,
                    beneficiaryName: a.accountHolderName || a.holderName || a.name || 'Account Holder',
                    accountNumber: a.accountNumber || a.accNo || '••••',
                    ifsc: a.ifsc || a.ifscCode || 'IFSC0000',
                    bankName: a.bankName || 'Bank',
                    status: (a.status || 'APPROVED').toUpperCase(),
                    userPartyCode: a.userPartyCode || a.partyCode || 'MEMBER',
                    userMobile: a.userMobile || a.mobile || '',
                    createdAt: a.createdAt || a.date || new Date().toISOString()
                }));
            }

            const stats = { pending: 0, approved: 0, rejected: 0, total: beneItems.length };
            beneItems.forEach(b => {
                const s = String(b.status || 'PENDING').toUpperCase();
                if (s === 'APPROVED' || s === 'VERIFIED') stats.approved++;
                else if (s === 'REJECTED') stats.rejected++;
                else stats.pending++;
            });

            setBeneStats(stats);
            setBeneList(beneItems);
            setConnected(true);
            setLastFetch(new Date());

        } catch (err) {
            console.error('SuperDistributorDashboard load error:', err);
            setConnected(false);
        }
    }, []);

    // Periodic Polling
    useEffect(() => {
        loadDashboardData();
        const pollTimer = setInterval(loadDashboardData, 15000);
        const clockTimer = setInterval(() => setTime(new Date()), 1000);

        window.addEventListener('SuperDistributorDataUpdated', loadDashboardData);
        window.addEventListener('dataUpdated', loadDashboardData);

        return () => {
            clearInterval(pollTimer);
            clearInterval(clockTimer);
            window.removeEventListener('SuperDistributorDataUpdated', loadDashboardData);
            window.removeEventListener('dataUpdated', loadDashboardData);
        };
    }, [loadDashboardData]);

    const distBal = dist?.wallet?.balance || 0;
    const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = time.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    // Compute KPI metrics
    const normalizeStatus = (status) => {
        const s = String(status || '').trim().toUpperCase();
        if (s === 'APPROVED' || s === 'ACTIVE') return 'Approved';
        if (s === 'PENDING') return 'Pending';
        if (s === 'REJECTED') return 'Rejected';
        return status || 'Pending';
    };

    const activeMembers = networkUsers.filter(r => normalizeStatus(r.status) === 'Approved').length;
    const pendingMembers = networkUsers.filter(r => normalizeStatus(r.status) === 'Pending').length;

    // KYC breakdown
    let kycDone = 0, kycNotDone = 0, kycPending = 0;
    networkUsers.forEach(r => {
        const k = String(r.kycStatus || r.profile_kyc_status || '').toUpperCase();
        if (k === 'APPROVED' || k === 'DONE') kycDone++;
        else if (k === 'REJECTED' || k === 'NOT_DONE' || !k) kycNotDone++;
        else kycPending++;
    });

    // Total Float across network
    const totalMappedFloat = networkUsers.reduce((sum, r) => sum + (parseFloat(r.balance || r?.wallet?.balance || 0) || 0), 0);

    // Compute Service-by-Service Stats dynamically from Mapped Transactions
    const now = new Date();
    const isToday = (d) => {
        if (!d) return false;
        const dateObj = new Date(d);
        return dateObj.getDate() === now.getDate() && dateObj.getMonth() === now.getMonth() && dateObj.getFullYear() === now.getFullYear();
    };
    const isThisMonth = (d) => {
        if (!d) return false;
        const dateObj = new Date(d);
        return dateObj.getMonth() === now.getMonth() && dateObj.getFullYear() === now.getFullYear();
    };

    const serviceStats = useMemo(() => {
        const stats = {
            AEPS: { todayTxn: 0, todayAmt: 0, todayComm: 0, monthlyTxn: 0, monthlyAmt: 0, monthlyComm: 0 },
            PAYOUT: { todayTxn: 0, todayAmt: 0, todayComm: 0, monthlyTxn: 0, monthlyAmt: 0, monthlyComm: 0 },
            CMS: { todayTxn: 0, todayAmt: 0, todayComm: 0, monthlyTxn: 0, monthlyAmt: 0, monthlyComm: 0 },
            DMT: { todayTxn: 0, todayAmt: 0, todayComm: 0, monthlyTxn: 0, monthlyAmt: 0, monthlyComm: 0 },
            BHARAT_CONNECT: { todayTxn: 0, todayAmt: 0, todayComm: 0, monthlyTxn: 0, monthlyAmt: 0, monthlyComm: 0 },
            OTHER: { todayTxn: 0, todayAmt: 0, todayComm: 0, monthlyTxn: 0, monthlyAmt: 0, monthlyComm: 0 },
        };

        transactions.forEach(t => {
            const rawType = String(t.service_type || t.type || '').toUpperCase();
            let sKey = 'OTHER';
            if (rawType.includes('AEPS')) sKey = 'AEPS';
            else if (rawType.includes('PAYOUT')) sKey = 'PAYOUT';
            else if (rawType.includes('CMS')) sKey = 'CMS';
            else if (rawType.includes('DMT') || rawType.includes('TRANSFER')) sKey = 'DMT';
            else if (rawType.includes('BBPS') || rawType.includes('BHARAT') || rawType.includes('BILL')) sKey = 'BHARAT_CONNECT';

            const amt = parseFloat(t.amount || 0) || 0;
            const comm = parseFloat(t.commission || t.charge || (amt * 0.002) || 0) || 0;
            const txnDate = t.created_at || t.date;

            if (isToday(txnDate)) {
                stats[sKey].todayTxn += 1;
                stats[sKey].todayAmt += amt;
                stats[sKey].todayComm += comm;
            }
            if (isThisMonth(txnDate)) {
                stats[sKey].monthlyTxn += 1;
                stats[sKey].monthlyAmt += amt;
                stats[sKey].monthlyComm += comm;
            }
        });

        return stats;
    }, [transactions]);

    const totalTodayComm = Object.values(serviceStats).reduce((sum, s) => sum + s.todayComm, 0);

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(145deg, #f0fdf4 0%, #eff6ff 50%, #fefce8 100%)',
            fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
            color: '#334155',
            padding: '24px',
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
                @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
                @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
                @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
                .live-grid { display: grid; gap: 16px; animation: fadeIn 0.4s ease; }
            `}</style>

            {/* ── Topbar Operations Control Banner ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.8)',
                borderRadius: 18, padding: '14px 20px', marginBottom: 22,
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                position: 'sticky', top: 0, zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                    }}>🏛️</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', letterSpacing: 0.5 }}>
                            RUPIKSHA SUPER DISTRIBUTOR
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                            Live Operations Control
                        </div>
                    </div>
                    <div style={{ width: 1, height: 30, background: '#e2e8f0', margin: '0 8px' }} />
                    <LivePulse connected={connected} />
                    {lastFetch && (
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
                            Updated {lastFetch.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Network Members', value: `${networkUsers.length} (${activeMembers} Approved)`, color: '#10b981', bg: '#f0fdf4' },
                        { label: 'Charges', value: `₹${fmtCur(0)}`, color: '#ea580c', bg: '#fff7ed' },
                        { label: 'Commission', value: `₹${fmtCur(totalTodayComm)}`, color: '#059669', bg: '#f0fdf4' },
                        { label: 'Wallet Balance', value: `₹${fmtCur(distBal)}`, color: '#4f46e5', bg: '#eef2ff' },
                    ].map(({ label, value, color, bg }) => (
                        <div key={label} style={{
                            background: bg, border: `1px solid ${color}30`,
                            borderRadius: 10, padding: '6px 14px',
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-end'
                        }}>
                            <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
                        </div>
                    ))}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 14px', textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', fontFamily: 'JetBrains Mono, monospace' }}>{timeStr}</div>
                        <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>{dateStr}</div>
                    </div>
                </div>
            </div>

            {/* ── KPI Cards Row (4 Columns with Payout Beneficiary Status) ── */}
            <div className="live-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 16 }}>
                <KpiCard title="User Network" icon="👥" accent="#0ea5e9">
                    <StatRow label="Total Registered" value={fmt(networkUsers.length)} accent="#0ea5e9" />
                    <StatRow label="Distributors" value={`${distributors.length} (${distributors.filter(d => normalizeStatus(d.status) === 'Approved').length} Active)`} accent="#6366f1" />
                    <StatRow label="Retailers" value={`${retailers.length} (${retailers.filter(r => normalizeStatus(r.status) === 'Approved').length} Active)`} accent="#10b981" />
                </KpiCard>

                <div onClick={() => setShowBeneModal(true)} style={{ cursor: 'pointer' }}>
                    <KpiCard title="Payout Bank Beneficiary Status" icon="🏦" accent="#059669">
                        <StatRow label="Approved" value={fmt(beneStats.approved)} accent="#10b981" />
                        <StatRow label="Pending Review" value={fmt(beneStats.pending)} accent="#f59e0b" />
                        <StatRow label="Rejected" value={fmt(beneStats.rejected)} accent="#ef4444" />
                        <div style={{ marginTop: 8, textAlign: 'right' }}>
                            <span style={{
                                fontSize: 10, fontWeight: 800, color: '#059669',
                                background: '#ecfdf5', padding: '3px 8px', borderRadius: 6,
                                border: '1px solid #a7f3d0'
                            }}>
                                View Details →
                            </span>
                        </div>
                    </KpiCard>
                </div>

                <KpiCard title="Profile KYC" icon="🪪" accent="#8b5cf6">
                    <StatRow label="KYC Done" value={fmt(kycDone)} accent="#10b981" />
                    <StatRow label="KYC Not Done" value={fmt(kycNotDone)} accent="#ef4444" />
                    <StatRow label="KYC Pending" value={fmt(kycPending)} accent="#f59e0b" />
                </KpiCard>

                <KpiCard title="Wallet Overview" icon="💰" accent="#f59e0b">
                    <StatRow label="Total Network Float" value={`₹${fmtCur(totalMappedFloat)}`} accent="#f59e0b" />
                    <StatRow label="Fund Requests" value={fmt(0)} accent="#0ea5e9" />
                    <StatRow label="Locked Amount" value={`₹${fmtCur(0)}`} accent="#64748b" />
                </KpiCard>
            </div>

            {/* ── Service Transaction Grid (6 Service Cards) ── */}
            <div className="live-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 16 }}>
                <ServiceCard serviceKey="AEPS" data={serviceStats.AEPS} />
                <ServiceCard serviceKey="PAYOUT" data={serviceStats.PAYOUT} />
                <ServiceCard serviceKey="CMS" data={serviceStats.CMS} />
                <ServiceCard serviceKey="DMT" data={serviceStats.DMT} />
                <ServiceCard serviceKey="BHARAT_CONNECT" data={serviceStats.BHARAT_CONNECT} />
                <ServiceCard serviceKey="OTHER" data={serviceStats.OTHER} />
            </div>

            {/* ── Live Activity Feed ── */}
            <div style={{
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(99,102,241,0.15)', borderRadius: 16,
                padding: '18px 20px', marginBottom: 16,
                boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>📡</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Live Activity Feed</span>
                        <LivePulse connected={connected} />
                    </div>
                    <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe'
                    }}>
                        {transactions.length} Transactions
                    </span>
                </div>
                <ActivityFeed transactions={transactions} />
            </div>

            {/* ─── Payout Beneficiary Status Modal ─── */}
            {showBeneModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 16
                }}>
                    <div style={{
                        background: '#ffffff', borderRadius: 24, border: '1px solid #cbd5e1',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        width: '100%', maxWidth: 960, maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 38, height: 38, borderRadius: 12, background: '#ecfdf5',
                                    border: '1px solid #a7f3d0', color: '#059669',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                        Payout Bank Beneficiary Approvals
                                    </h3>
                                    <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, margin: 0 }}>
                                        View mapped network bank beneficiaries and their approval status
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={loadDashboardData}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', borderRadius: 10, background: '#ffffff',
                                        border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 800,
                                        color: '#334155', cursor: 'pointer'
                                    }}
                                >
                                    <RefreshCw size={13} className={beneLoading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowBeneModal(false)}
                                    style={{
                                        width: 32, height: 32, borderRadius: 10, border: 'none',
                                        background: '#f1f5f9', color: '#64748b', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Search & Tabs */}
                        <div style={{ padding: '12px 24px', background: '#ffffff', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Search by name, A/C, IFSC, party code..."
                                    value={beneSearch}
                                    onChange={e => setBeneSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '7px 10px 7px 32px', borderRadius: 10,
                                        border: '1px solid #e2e8f0', fontSize: 12, outline: 'none'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(tab => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setBeneFilter(tab)}
                                        style={{
                                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                                            border: 'none', cursor: 'pointer',
                                            background: beneFilter === tab ? '#0f172a' : '#f1f5f9',
                                            color: beneFilter === tab ? '#ffffff' : '#64748b'
                                        }}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Beneficiary List Table */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                            {(() => {
                                const filtered = beneList.filter(b => {
                                    const s = String(b.status || 'PENDING').toUpperCase();
                                    if (beneFilter === 'APPROVED' && (s !== 'APPROVED' && s !== 'VERIFIED')) return false;
                                    if (beneFilter === 'PENDING' && (s === 'APPROVED' || s === 'VERIFIED' || s === 'REJECTED')) return false;
                                    if (beneFilter === 'REJECTED' && s !== 'REJECTED') return false;

                                    if (beneSearch) {
                                        const query = beneSearch.toLowerCase();
                                        const bName = String(b.beneficiaryName || b.name || '').toLowerCase();
                                        const bAcc = String(b.accountNumber || b.accNo || '');
                                        const bIfsc = String(b.ifsc || '').toLowerCase();
                                        const bCode = String(b.userPartyCode || '').toLowerCase();
                                        return bName.includes(query) || bAcc.includes(query) || bIfsc.includes(query) || bCode.includes(query);
                                    }
                                    return true;
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                                            <Building2 size={36} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>No Beneficiaries Found</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>No bank beneficiaries matched your current filter criteria.</div>
                                        </div>
                                    );
                                }

                                return (
                                    <div style={{ display: 'grid', gap: 10 }}>
                                        {filtered.map((b, idx) => {
                                            const status = String(b.status || 'PENDING').toUpperCase();
                                            const isApproved = status === 'APPROVED' || status === 'VERIFIED';
                                            const isRejected = status === 'REJECTED';

                                            return (
                                                <div key={b.id || idx} style={{
                                                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14,
                                                    padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: 10,
                                                            background: isApproved ? '#ecfdf5' : isRejected ? '#fef2f2' : '#fffbeb',
                                                            color: isApproved ? '#059669' : isRejected ? '#dc2626' : '#d97706',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900
                                                        }}>
                                                            {isApproved ? <CheckCircle2 size={18} /> : isRejected ? <XCircle size={18} /> : <Clock size={18} />}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                                                                {b.beneficiaryName || b.name || 'Account Holder'}
                                                            </div>
                                                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                <span>{b.bankName || 'Bank'}</span>
                                                                <span>•</span>
                                                                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{b.accountNumber || b.accNo}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopy(b.accountNumber || b.accNo, `acc_${idx}`)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                                                                >
                                                                    {copiedField === `acc_${idx}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b' }}>IFSC: {b.ifsc}</div>
                                                            <div style={{ fontSize: 9, color: '#94a3b8' }}>ID: {b.userPartyCode || 'MEMBER'}</div>
                                                        </div>
                                                        <span style={{
                                                            fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 20,
                                                            background: isApproved ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7',
                                                            color: isApproved ? '#15803d' : isRejected ? '#b91c1c' : '#b45309',
                                                            border: `1px solid ${isApproved ? '#86efac' : isRejected ? '#fca5a5' : '#fde68a'}`
                                                        }}>
                                                            {isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : 'PENDING'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperDistributorDashboard;
