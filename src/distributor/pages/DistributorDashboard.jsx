import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BACKEND_URL } from '../../services/dataService';
import { sharedDataService } from '../../services/sharedDataService';
import { dataService } from '../../services/dataService';
import { payoutService } from '../../services/apiService';
import { getDistributorPlan } from '../config/planConfig';
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
                <div style={{ fontSize: 11, marginTop: 4 }}>Transactions will appear here in real-time as your mapped retailers perform operations.</div>
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
                            {txn.userName || txn.user_name || txn.user_id || 'Retailer'}
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

// ─── Main Distributor Dashboard ───────────────────────────────────────────────
const DistributorDashboard = () => {
    const navigate = useNavigate();
    const [dist, setDist] = useState(null);
    const [retailers, setRetailers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [connected, setConnected] = useState(false);
    const [lastFetch, setLastFetch] = useState(null);
    const [time, setTime] = useState(new Date());

    // Beneficiary Approval State for Mapped Retailers (View-Only)
    const [beneStats, setBeneStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
    const [beneList, setBeneList] = useState([]);
    const [beneLoading, setBeneLoading] = useState(false);
    const [showBeneModal, setShowBeneModal] = useState(false);
    const [beneFilter, setBeneFilter] = useState('ALL');
    const [beneSearch, setBeneSearch] = useState('');
    const [copiedField, setCopiedField] = useState('');

    const distRef = useRef(null);
    const retailersRef = useRef([]);

    const handleCopy = (text, key) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(key);
        setTimeout(() => setCopiedField(''), 2000);
    };

    // Load Distributor, Mapped Retailers, Transactions, and Beneficiaries
    const loadDashboardData = useCallback(async () => {
        try {
            const session = sharedDataService.getCurrentDistributor();
            if (!session) return;

            const freshDist = sharedDataService.getDistributorById(session.id) || session;
            distRef.current = freshDist;
            
            // Get live wallet balance
            let distBal = freshDist?.wallet?.balance || 0;
            try {
                distBal = await dataService.getWalletBalance(freshDist.id || freshDist.userId);
            } catch (_) {}

            setDist({ ...freshDist, wallet: { balance: distBal } });

            const distId = String(freshDist.id || freshDist._id || freshDist.userId || '').trim().toLowerCase();
            const distPartyCode = String(freshDist.partyCode || freshDist.userCode || '').trim().toUpperCase();
            const distMobile = String(freshDist.mobile || freshDist.phone || '').trim();
            const distUsername = String(freshDist.username || '').trim().toLowerCase();
            const distName = String(freshDist.name || freshDist.fullName || '').trim().toLowerCase();
            const assignedList = (freshDist.assignedRetailers || []).map(x => String(x || '').trim());
            const assignedSet = new Set(assignedList.map(x => x.toLowerCase()));

            // Fetch all users using getAllUsers() identical to Retailers.jsx
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

            // Multi-factor mapping filter (exact match with Retailers.jsx)
            const mapped = combinedList
                .filter((u) => {
                    const rRole = String(u?.role || (u?.roles && u.roles[0]) || '').replace(/^ROLE_/i, '').toUpperCase();
                    return rRole === 'RETAILER' || rRole === 'RETAILERS';
                })
                .filter((r) => {
                    const rId = String(r.id || r._id || r.userId || '').trim().toLowerCase();
                    const rUsername = String(r.username || '').trim().toLowerCase();
                    const rMobile = String(r.mobile || r.phone || '').trim();
                    const rPartyCode = String(r.partyCode || r.userCode || '').trim().toUpperCase();

                    const rParentId = String(r.parentUserId || r.ownerId || r.addedByUserRef || r.parent_id || r.parentId || '').trim().toLowerCase();
                    const rParentPartyCode = String(r.parentPartyCode || r.addedByPartyCode || r.ownerPartyCode || '').trim().toUpperCase();
                    const rParentName = String(r.parentName || r.addedByName || r.ownerName || '').trim().toLowerCase();
                    const rParentMobile = String(r.parentMobile || r.ownerMobile || r.addedByMobile || '').trim();

                    // Direct assignment list check
                    if (assignedSet.has(rUsername) || (rMobile && assignedSet.has(rMobile)) || (rPartyCode && assignedSet.has(rPartyCode.toLowerCase())) || (rId && assignedSet.has(rId))) {
                        return true;
                    }

                    // ID link check
                    if (distId && (rParentId === distId || rParentId.includes(distId))) {
                        return true;
                    }

                    // Party Code link check (e.g. RPDMH78914)
                    if (distPartyCode && rParentPartyCode && rParentPartyCode === distPartyCode) {
                        return true;
                    }

                    // Mobile link check
                    if (distMobile && (rParentMobile === distMobile || rParentId === distMobile.toLowerCase())) {
                        return true;
                    }

                    // Username link check
                    if (distUsername && (rParentId === distUsername || rParentName === distUsername)) {
                        return true;
                    }

                    // Name link check
                    if (distName && rParentName && (rParentName.includes(distName) || distName.includes(rParentName))) {
                        return true;
                    }

                    return false;
                });

            setRetailers(mapped);
            retailersRef.current = mapped;

            // Build set of mapped identifier keys for transaction & beneficiary filtering
            const mappedKeySet = new Set();
            mapped.forEach(r => {
                if (r.id) mappedKeySet.add(String(r.id).toLowerCase());
                if (r._id) mappedKeySet.add(String(r._id).toLowerCase());
                if (r.userId) mappedKeySet.add(String(r.userId).toLowerCase());
                if (r.username) mappedKeySet.add(String(r.username).toLowerCase());
                if (r.partyCode) mappedKeySet.add(String(r.partyCode).toLowerCase());
                if (r.mobile) mappedKeySet.add(String(r.mobile));
                if (r.email) mappedKeySet.add(String(r.email).toLowerCase());
            });
            if (distId) mappedKeySet.add(distId);
            if (distPartyCode) mappedKeySet.add(distPartyCode.toLowerCase());
            if (distUsername) mappedKeySet.add(distUsername);

            // Fetch transactions & filter to mapped network
            let allTxns = [];
            try {
                const userTxns = await dataService.getUserTransactions(freshDist.id || freshDist.userId);
                if (Array.isArray(userTxns)) allTxns.push(...userTxns);
            } catch (_) {}

            try {
                const liveRes = await fetch(`${BACKEND_URL}/dashboard/live`);
                if (liveRes.ok) {
                    const liveJson = await liveRes.json();
                    if (Array.isArray(liveJson.recentTransactions)) {
                        allTxns.push(...liveJson.recentTransactions);
                    }
                }
            } catch (_) {}

            const localTxns = dataService.getData().transactions || [];
            allTxns.push(...localTxns);

            // Deduplicate and filter to mapped network
            const txnMap = new Map();
            allTxns.forEach(t => {
                if (!t) return;
                const tUser = String(t.user_id || t.userId || t.userName || t.user_name || t.partyCode || '').toLowerCase();
                const tParent = String(t.parent_id || t.parentUserId || t.distributorId || '').toLowerCase();
                const isMapped = mappedKeySet.has(tUser) || (distId && tParent === distId) || (distPartyCode && tParent === distPartyCode.toLowerCase());

                if (isMapped) {
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

            // Fetch Beneficiaries and filter to mapped network
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

            // Also include profile bank accounts of mapped retailers if not in beneItems
            mapped.forEach(r => {
                if (r.bankAccountNumber && !beneItems.some(b => b.accountNumber === r.bankAccountNumber)) {
                    beneItems.push({
                        id: `prof_${r.id || r.username}`,
                        userPartyCode: r.partyCode || 'RETAILER',
                        userFullName: r.name || r.fullName || r.username,
                        userEmail: r.email,
                        userMobile: r.mobile,
                        beneficiaryName: r.bankAccountHolder || r.name || r.username,
                        bankName: r.bankName || 'Bank Account',
                        accountNumber: r.bankAccountNumber,
                        ifsc: r.bankIfsc || 'N/A',
                        status: r.status === 'Approved' ? 'APPROVED' : 'PENDING'
                    });
                }
            });

            setBeneList(beneItems);
            const pending = beneItems.filter(b => b.status === 'PENDING').length;
            const approved = beneItems.filter(b => b.status === 'APPROVED').length;
            const rejected = beneItems.filter(b => b.status === 'REJECTED').length;
            setBeneStats({ pending, approved, rejected, total: beneItems.length });

            setConnected(true);
            setLastFetch(new Date());
        } catch (err) {
            setConnected(false);
        }
    }, []);

    const filteredBeneList = useMemo(() => {
        let list = beneList;
        if (beneFilter !== 'ALL') {
            list = list.filter(b => b.status === beneFilter);
        }
        if (beneSearch.trim()) {
            const q = beneSearch.toLowerCase();
            list = list.filter(b =>
                (b.userPartyCode && b.userPartyCode.toLowerCase().includes(q)) ||
                (b.userFullName && b.userFullName.toLowerCase().includes(q)) ||
                (b.userEmail && b.userEmail.toLowerCase().includes(q)) ||
                (b.userMobile && b.userMobile.includes(q)) ||
                (b.beneficiaryName && b.beneficiaryName.toLowerCase().includes(q)) ||
                (b.accountNumber && b.accountNumber.includes(q)) ||
                (b.ifsc && b.ifsc.toLowerCase().includes(q)) ||
                (b.bankName && b.bankName.toLowerCase().includes(q))
            );
        }
        return list;
    }, [beneList, beneFilter, beneSearch]);

    // Initial load & listeners
    useEffect(() => {
        loadDashboardData();
        window.addEventListener('distributorDataUpdated', loadDashboardData);
        return () => window.removeEventListener('distributorDataUpdated', loadDashboardData);
    }, [loadDashboardData]);

    // Background polling: every 30s when tab is active
    useEffect(() => {
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            loadDashboardData();
        }, 30000);
        return () => clearInterval(interval);
    }, [loadDashboardData]);

    // Live clock timer
    useEffect(() => {
        const clockInterval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(clockInterval);
    }, []);

    const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = time.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    // Computed Scoped Metrics
    const distBal = parseFloat(dist?.wallet?.balance || 0);

    // Mapped Retailers Status
    const activeRetailers = retailers.filter(r => r.status === 'Approved' || r.status === 'ACTIVE').length;
    const pendingRetailers = retailers.filter(r => r.status !== 'Approved' && r.status !== 'ACTIVE').length;

    // Profile KYC of Mapped Retailers
    const kycDone = retailers.filter(r => r.kycStatus === 'Approved' || r.kycStatus === 'DONE' || r.isKycDone).length;
    const kycPending = retailers.filter(r => r.kycStatus === 'Pending' || r.kycStatus === 'PENDING').length;
    const kycNotDone = retailers.filter(r => !r.kycStatus || r.kycStatus === 'REJECTED' || r.kycStatus === 'NOT_DONE').length;

    // Wallet Overview of Mapped Retailers
    const totalMappedFloat = retailers.reduce((sum, r) => {
        const b = parseFloat((r?.wallet?.balance || '0').toString().replace(/,/g, ''));
        return sum + (isNaN(b) ? 0 : b);
    }, 0);

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

            {/* ── Topbar ── */}
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
                            RUPIKSHA DISTRIBUTOR
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
                        { label: 'Retailers Network', value: `${retailers.length} (${activeRetailers} Approved)`, color: '#10b981', bg: '#f0fdf4' },
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
                    <StatRow label="Total Registered" value={fmt(retailers.length)} accent="#0ea5e9" />
                    <StatRow label="Active / Approved" value={fmt(activeRetailers)} accent="#10b981" />
                    <StatRow label="Inactive / Pending" value={fmt(pendingRetailers)} accent="#ef4444" />
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



            {/* ── Service Transaction Grid ── */}
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

            {/* ─── Payout Beneficiary Status Modal (View-Only for Distributor) ─── */}
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
                                        View mapped retailer bank beneficiaries and their approval status (Approvals managed by Admin)
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
                                        background: '#f1f5f9', border: 'none', borderRadius: '50%',
                                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', color: '#64748b'
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Filter Tabs & Search Bar */}
                        <div style={{
                            padding: '12px 24px', borderBottom: '1px solid #f1f5f9',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {[
                                    { key: 'ALL', label: 'All', count: beneList.length, color: '#6366f1' },
                                    { key: 'PENDING', label: 'Pending Review', count: beneStats.pending, color: '#f59e0b' },
                                    { key: 'APPROVED', label: 'Approved', count: beneStats.approved, color: '#10b981' },
                                    { key: 'REJECTED', label: 'Rejected', count: beneStats.rejected, color: '#ef4444' },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setBeneFilter(tab.key)}
                                        style={{
                                            padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                                            border: beneFilter === tab.key ? `2px solid ${tab.color}` : '1px solid #e2e8f0',
                                            background: beneFilter === tab.key ? `${tab.color}15` : '#ffffff',
                                            color: beneFilter === tab.key ? tab.color : '#64748b',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                                        }}
                                    >
                                        <span>{tab.label}</span>
                                        <span style={{
                                            padding: '1px 6px', borderRadius: 20, fontSize: 10,
                                            background: beneFilter === tab.key ? tab.color : '#f1f5f9',
                                            color: beneFilter === tab.key ? '#ffffff' : '#475569'
                                        }}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div style={{ position: 'relative', width: 240 }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Search party code, email, A/C..."
                                    value={beneSearch}
                                    onChange={(e) => setBeneSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '6px 12px 6px 30px', borderRadius: 10,
                                        border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 700,
                                        outline: 'none', background: '#f8fafc'
                                    }}
                                />
                            </div>
                        </div>

                        {/* List Content */}
                        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {filteredBeneList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                                    <Building2 size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#475569' }}>No Beneficiary Records Found</div>
                                    <p style={{ fontSize: 11, marginTop: 4 }}>No beneficiary records found for mapped retailers under the selected filter</p>
                                </div>
                            ) : (
                                filteredBeneList.map((bene) => {
                                    const isPending = bene.status === 'PENDING';
                                    const isApproved = bene.status === 'APPROVED';
                                    const isRejected = bene.status === 'REJECTED';

                                    return (
                                        <div
                                            key={bene.id}
                                            style={{
                                                background: isPending ? '#fffbeb' : '#ffffff',
                                                border: isPending ? '1.5px solid #fcd34d' : '1px solid #e2e8f0',
                                                borderRadius: 16, padding: '16px 18px',
                                                display: 'flex', flexDirection: 'column', gap: 12,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                                            }}
                                        >
                                            {/* Top Row: User Meta + Status Badge */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        padding: '4px 10px', borderRadius: 8, background: '#eff6ff',
                                                        border: '1px solid #bfdbfe', color: '#1d4ed8',
                                                        fontSize: 11, fontWeight: 900, fontFamily: 'monospace'
                                                    }}>
                                                        {bene.userPartyCode || 'RETAILER'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                                                            {bene.userFullName || bene.beneficiaryName}
                                                        </div>
                                                        <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600, display: 'flex', gap: 10, marginTop: 1 }}>
                                                            {bene.userEmail && <span>✉ {bene.userEmail}</span>}
                                                            {bene.userMobile && <span>📞 {bene.userMobile}</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {isPending && (
                                                        <span style={{
                                                            background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a',
                                                            fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                                                            display: 'inline-flex', alignItems: 'center', gap: 4
                                                        }}>
                                                            <Clock size={12} /> Pending Approval
                                                        </span>
                                                    )}
                                                    {isApproved && (
                                                        <span style={{
                                                            background: '#d1fae5', color: '#047857', border: '1px solid #a7f3d0',
                                                            fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                                                            display: 'inline-flex', alignItems: 'center', gap: 4
                                                        }}>
                                                            <CheckCircle2 size={12} /> Approved
                                                        </span>
                                                    )}
                                                    {isRejected && (
                                                        <span style={{
                                                            background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5',
                                                            fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                                                            display: 'inline-flex', alignItems: 'center', gap: 4
                                                        }}>
                                                            <XCircle size={12} /> Rejected
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bank Account Details Grid */}
                                            <div style={{
                                                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12,
                                                padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10,
                                                fontSize: 11
                                            }}>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', fontSize: 9.5 }}>Beneficiary Legal Name</div>
                                                    <div style={{ color: '#0f172a', fontWeight: 800, marginTop: 2 }}>{bene.beneficiaryName}</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', fontSize: 9.5 }}>Bank Name</div>
                                                    <div style={{ color: '#0f172a', fontWeight: 800, marginTop: 2 }}>{bene.bankName || 'Bank Transfer'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', fontSize: 9.5 }}>Account Number</div>
                                                    <div style={{ color: '#0f172a', fontWeight: 900, fontFamily: 'monospace', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span>{bene.accountNumber}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(bene.accountNumber, `acc_${bene.id}`)}
                                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                                                        >
                                                            {copiedField === `acc_${bene.id}` ? <Check size={12} style={{ color: '#16a34a' }} /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', fontSize: 9.5 }}>IFSC Code</div>
                                                    <div style={{ color: '#0f172a', fontWeight: 900, fontFamily: 'monospace', textTransform: 'uppercase', marginTop: 2 }}>
                                                        {bene.ifsc}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Rejection Note if Rejected */}
                                            {isRejected && bene.rejectionReason && (
                                                <div style={{
                                                    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                                                    padding: '6px 12px', fontSize: 11, color: '#991b1b', fontWeight: 700
                                                }}>
                                                    <strong>Rejection Note:</strong> {bene.rejectionReason}
                                                </div>
                                            )}

                                            {/* View-only Status Footer Notice */}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                                                {isPending && (
                                                    <span style={{ fontSize: 10.5, color: '#b45309', background: '#fef3c7', padding: '4px 10px', borderRadius: 8, fontWeight: 700 }}>
                                                        ⏳ Under Review by Admin
                                                    </span>
                                                )}
                                                {isApproved && (
                                                    <span style={{ fontSize: 10.5, color: '#047857', background: '#d1fae5', padding: '4px 10px', borderRadius: 8, fontWeight: 700 }}>
                                                        ✓ Verified & Approved by Admin
                                                    </span>
                                                )}
                                                {isRejected && (
                                                    <span style={{ fontSize: 10.5, color: '#b91c1c', background: '#fee2e2', padding: '4px 10px', borderRadius: 8, fontWeight: 700 }}>
                                                        ✕ Rejected by Admin
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DistributorDashboard;
