import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, Download, UserPlus, ShieldCheck,
    CheckCircle2, AlertCircle, Clock, X, Eye, Wallet,
    Smartphone, Mail, MapPin, Zap, Package, Edit3, Trash2,
    Lock, Save, Loader2, Image as ImageIcon, TrendingUp,
    BarChart3, RefreshCw, IndianRupee, Layers, Check,
    Building2, Landmark, Coins, ArrowUpRight, Award, Shield,
    FileSpreadsheet, Activity, ChevronRight, Copy, CheckCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dataService, BACKEND_URL } from '../../services/dataService';
import { transactionService } from '../../services/apiService';
import { sharedDataService } from '../../services/sharedDataService';
import NetworkRegistrationForm from '../../components/shared/NetworkRegistrationForm';

const getToken = () => localStorage.getItem('rupiksha_token') || localStorage.getItem('rupiksha_distributor_token') || localStorage.getItem('rupiksha_admin_token');

const fmtWallet = (v) => {
    const n = parseFloat(String(v || 0).replace(/,/g, ''));
    return isNaN(n) ? '₹0.00' : '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDateOnly = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const DEFAULT_SERVICES = [
    { serviceType: 'AEPS', label: 'AEPS Banking', enabled: true },
    { serviceType: 'BBPS', label: 'Bill Payment (BBPS)', enabled: true },
    { serviceType: 'RECHARGE', label: 'Mobile & DTH Recharge', enabled: true },
    { serviceType: 'PAYOUT', label: 'Payout / Money Transfer', enabled: true },
    { serviceType: 'WALLET_TRANSFER', label: 'Wallet Transfer', enabled: true },
    { serviceType: 'TICKET_SUPPORT', label: 'Ticket Support', enabled: true }
];

const BUSINESS_SERVICES = [
    { key: 'AEPS_1', label: 'AEPS 1', subLabel: 'Cash Withdrawal & Mini Statement', icon: '🏦', color: 'bg-blue-500', bgLight: 'bg-blue-50', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-800' },
    { key: 'AEPS_2', label: 'AEPS 2', subLabel: 'Aadhaar Pay & Cash Deposit', icon: '🏧', color: 'bg-indigo-500', bgLight: 'bg-indigo-50', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-800' },
    { key: 'DMT', label: 'DMT (Money Transfer)', subLabel: 'Domestic Money Transfer & Remittance', icon: '💸', color: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-800' },
    { key: 'BBPS', label: 'BBPS & Utilities', subLabel: 'Electricity, Water, Gas & Bill Pay', icon: '💡', color: 'bg-amber-500', bgLight: 'bg-amber-50', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-800' },
    { key: 'RECHARGE', label: 'Mobile & DTH Recharge', subLabel: 'Prepaid, Postpaid & DTH Services', icon: '📱', color: 'bg-cyan-500', bgLight: 'bg-cyan-50', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-800' },
    { key: 'MATM', label: 'Micro ATM (MATM)', subLabel: 'Card Withdrawal & Balance Inquiry', icon: '💳', color: 'bg-purple-500', bgLight: 'bg-purple-50', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-800' },
    { key: 'PAYOUT', label: 'Payout / Settlement', subLabel: 'Instant Bank Payout & Settlement', icon: '🏛️', color: 'bg-rose-500', bgLight: 'bg-rose-50', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-800' },
    { key: 'CMS', label: 'CMS (Cash Collection)', subLabel: 'Cash Management Services', icon: '📦', color: 'bg-teal-500', bgLight: 'bg-teal-50', text: 'text-teal-600', badge: 'bg-teal-100 text-teal-800' },
    { key: 'OTHER', label: 'Other Services', subLabel: 'Wallet, QR & Miscellaneous', icon: '✨', color: 'bg-slate-500', bgLight: 'bg-slate-100', text: 'text-slate-600', badge: 'bg-slate-200 text-slate-800' }
];

const isTodayDate = (d) => {
    if (!d) return false;
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return false;
    const now = new Date();
    return dateObj.getDate() === now.getDate() &&
        dateObj.getMonth() === now.getMonth() &&
        dateObj.getFullYear() === now.getFullYear();
};

const isYesterdayDate = (d) => {
    if (!d) return false;
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return false;
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    return dateObj.getDate() === yest.getDate() &&
        dateObj.getMonth() === yest.getMonth() &&
        dateObj.getFullYear() === yest.getFullYear();
};

const categorizeTxn = (t) => {
    const raw = String(t.service_type || t.serviceType || t.type || t.service || t.particulars || '').toUpperCase();
    if (raw.includes('AEPS 2') || raw.includes('AEPS_2') || raw.includes('AADHAAR_PAY') || raw.includes('AADHAAR PAY') || raw.includes('DEPOSIT')) {
        return 'AEPS_2';
    }
    if (raw.includes('AEPS') || raw.includes('CASH_WITHDRAWAL') || raw.includes('AEPS 1') || raw.includes('AEPS_1') || raw.includes('MINI_STATEMENT') || raw.includes('BALANCE')) {
        return 'AEPS_1';
    }
    if (raw.includes('DMT') || raw.includes('TRANSFER') || raw.includes('REMIT') || raw.includes('MONEY_TRANSFER')) {
        return 'DMT';
    }
    if (raw.includes('BBPS') || raw.includes('BILL') || raw.includes('ELECTRICITY') || raw.includes('GAS') || raw.includes('WATER') || raw.includes('FASTAG') || raw.includes('BHARAT')) {
        return 'BBPS';
    }
    if (raw.includes('RECHARGE') || raw.includes('MOBILE') || raw.includes('DTH') || raw.includes('TOPUP')) {
        return 'RECHARGE';
    }
    if (raw.includes('MATM') || raw.includes('MICRO_ATM') || raw.includes('MICRO ATM') || raw.includes('ATM')) {
        return 'MATM';
    }
    if (raw.includes('PAYOUT') || raw.includes('SETTLEMENT')) {
        return 'PAYOUT';
    }
    if (raw.includes('CMS') || raw.includes('CASH_MANAGEMENT') || raw.includes('COLLECTION')) {
        return 'CMS';
    }
    return 'OTHER';
};

const Retailers = () => {
    const [retailers, setRetailers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedRetailer, setSelectedRetailer] = useState(null);
    const [editingRetailer, setEditingRetailer] = useState(null);
    const [servicesModalRetailer, setServicesModalRetailer] = useState(null);
    const [memberServices, setMemberServices] = useState(DEFAULT_SERVICES);
    const [dist, setDist] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // Business Modal State
    const [businessModalRetailer, setBusinessModalRetailer] = useState(null);
    const [retailerBusinessTxns, setRetailerBusinessTxns] = useState([]);
    const [loadingBusiness, setLoadingBusiness] = useState(false);
    const [businessActiveTab, setBusinessActiveTab] = useState('matrix'); // 'matrix' | 'logs'
    const [businessServiceSearch, setBusinessServiceSearch] = useState('');
    const [copiedPartyCode, setCopiedPartyCode] = useState(false);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const normalizeStatus = (status) => {
        const s = String(status || '').trim().toUpperCase();
        if (s === 'APPROVED' || s === 'ACTIVE') return 'APPROVED';
        if (s === 'PENDING') return 'PENDING';
        if (s === 'REJECTED') return 'REJECTED';
        return s || 'APPROVED';
    };

    const loadData = async () => {
        setLoading(true);
        const session = sharedDataService.getCurrentDistributor();
        if (!session) {
            setLoading(false);
            return;
        }
        const freshDist = sharedDataService.getDistributorById(session.id) || session;
        setDist(freshDist);

        const distId = String(freshDist.id || freshDist._id || freshDist.userId || '').trim().toLowerCase();
        const distPartyCode = String(freshDist.partyCode || freshDist.userCode || '').trim().toUpperCase();
        const distMobile = String(freshDist.mobile || freshDist.phone || '').trim();
        const distUsername = String(freshDist.username || '').trim().toLowerCase();
        const distName = String(freshDist.name || freshDist.fullName || '').trim().toLowerCase();
        const assignedList = (freshDist.assignedRetailers || []).map(x => String(x || '').trim());
        const assignedSet = new Set(assignedList.map(x => x.toLowerCase()));

        let allUsers = [];
        try {
            allUsers = await dataService.getAllUsers();
            if (!Array.isArray(allUsers)) allUsers = [];
        } catch {
            const fallback = dataService.getData().users || [];
            allUsers = fallback;
        }

        // Also incorporate local data and user cache
        const localUsers = dataService.getData().users || [];
        const cachedUsersRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('rupiksha_users_cache') : null;
        let cachedUsers = [];
        try {
            if (cachedUsersRaw) cachedUsers = JSON.parse(cachedUsersRaw);
        } catch { }

        const userMap = new Map();
        [...allUsers, ...localUsers, ...cachedUsers].forEach((u) => {
            if (!u) return;
            const key = String(u.id || u._id || u.username || u.mobile || u.partyCode || '');
            if (key && !userMap.has(key)) {
                userMap.set(key, u);
            }
        });

        const combinedList = Array.from(userMap.values());

        const assigned = combinedList
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

                // Owner Name link check
                if (distName && rParentName && (rParentName.includes(distName) || distName.includes(rParentName))) {
                    return true;
                }

                return false;
            })
            .map((u, idx) => {
                let localAepsMap = {};
                try { localAepsMap = JSON.parse(localStorage.getItem('rupiksha_last_aeps_map') || '{}'); } catch {}
                const directAepsDate = u.lastAepsTxnDate || u.lastAepsDate || u.last_aeps_date || u.lastAeps || u.last_aeps || u.lastAepsTime || u.last_aeps_time || u.lastAepsTransaction || u.last_aeps_transaction || u.lastAepsAt || u.last_aeps_at || u.lastAeps1Date || u.lastAeps2Date || u.lastAeps1 || u.lastAeps2 || null;
                const uKeys = [u.id, u._id, u.userId, u.username, u.mobile, u.phone, u.partyCode, u.userCode].filter(Boolean).map(k => String(k).trim().toLowerCase());
                let resolvedAepsDate = directAepsDate;
                uKeys.forEach(k => {
                    if (localAepsMap[k]) {
                        if (!resolvedAepsDate || new Date(localAepsMap[k]) > new Date(resolvedAepsDate)) {
                            resolvedAepsDate = localAepsMap[k];
                        }
                    }
                });

                return {
                    ...u,
                    id: u.id || u._id || u.userId || u.username || u.mobile || `ret-${idx}`,
                    fullName: u.fullName || u.name || (u.firstName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : (u.username || 'Retailer')),
                    username: u.username || u.mobile || `user_${idx}`,
                    mobile: u.mobile || u.phone || '—',
                    email: u.email || '—',
                    partyCode: u.partyCode || u.userCode || `RPRBR${70000 + idx}`,
                    role: 'RETAILER',
                    roles: ['RETAILER'],
                    status: normalizeStatus(u.status),
                    kycStatus: String(u.kycStatus || 'APPROVED').toUpperCase(),
                    walletBalance: parseFloat(String(u.walletBalance ?? u.balance ?? u.wallet?.balance ?? 0).replace(/,/g, '')) || 0,
                    addressLine1: u.shopAddress || u.address || u.permanentAddress || '—',
                    city: u.city || u.shopCity || '—',
                    stateName: u.state || u.shopState || 'BIHAR',
                    lastAepsTxnDate: resolvedAepsDate,
                    createdAt: u.createdAt || u.created_at || new Date().toISOString()
                };
            });

        setRetailers(assigned);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        const handleUpdate = () => { loadData(); };
        window.addEventListener('distributorDataUpdated', handleUpdate);
        window.addEventListener('dataUpdated', handleUpdate);
        window.addEventListener('membersUpdated', handleUpdate);
        return () => {
            window.removeEventListener('distributorDataUpdated', handleUpdate);
            window.removeEventListener('dataUpdated', handleUpdate);
            window.removeEventListener('membersUpdated', handleUpdate);
        };
    }, []);

    useEffect(() => {
        if (showSuccess) {
            import('canvas-confetti').then(module => {
                const confetti = module.default;
                const fire = (particleRatio, opts) => {
                    confetti({
                        ...opts,
                        particleCount: Math.floor(250 * particleRatio),
                        colors: ['#3B82F6', '#60A5FA', '#93C5FD', '#10B981', '#F59E0B'],
                        gravity: 1.2,
                        scalar: 1.2,
                        ticks: 200
                    });
                };
                setTimeout(() => {
                    fire(0.25, { spread: 26, startVelocity: 55, origin: { y: 0.6 } });
                    fire(0.2, { spread: 60, origin: { y: 0.6 } });
                    fire(0.35, { spread: 100, decay: 0.91, origin: { y: 0.6 } });
                }, 400);
            });
        }
    }, [showSuccess]);

    const handleRegistrationSuccess = () => {
        setShowAddModal(false);
        setShowSuccess(true);
        loadData();
    };

    // Impersonate / Login as Retailer
    const handleLoginAsMember = async (member) => {
        const token = getToken() || `imp_token_${Date.now()}`;
        const impersonatedUser = {
            id: member.id,
            username: member.username || member.mobile,
            mobile: member.mobile,
            fullName: member.fullName || member.name,
            name: member.fullName || member.name,
            roles: ['RETAILER'],
            role: 'RETAILER',
            kycStatus: 'APPROVED',
            status: 'APPROVED',
            impersonated: true
        };

        const key = `_imp_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify({ token, user: impersonatedUser }));
        await new Promise(r => setTimeout(r, 200));
        window.open(`${window.location.origin}/dashboard?_imp=${encodeURIComponent(key)}`, '_blank');
        showToast(`Opened Retailer Portal as ${member.fullName}`);
    };

    // Open Services Modal
    const handleViewServices = (member) => {
        setServicesModalRetailer(member);
        setMemberServices(DEFAULT_SERVICES);
    };

    // Toggle a Service
    const handleToggleService = (serviceType) => {
        setMemberServices(prev =>
            prev.map(s => s.serviceType === serviceType ? { ...s, enabled: !s.enabled } : s)
        );
        showToast('Service permission updated');
    };

    // Edit Member Save
    const handleSaveEdit = (e) => {
        e.preventDefault();
        setRetailers(prev => prev.map(r => r.id === editingRetailer.id ? { ...r, ...editingRetailer } : r));
        showToast('Retailer details updated successfully');
        setEditingRetailer(null);
    };

    // Open See Business Modal & load retailer transactions
    const handleOpenBusinessModal = async (member) => {
        setBusinessModalRetailer(member);
        setLoadingBusiness(true);
        setRetailerBusinessTxns([]);

        try {
            const memberIds = new Set([
                String(member.id || '').toLowerCase(),
                String(member._id || '').toLowerCase(),
                String(member.userId || '').toLowerCase(),
                String(member.username || '').toLowerCase(),
                String(member.mobile || '').trim(),
                String(member.partyCode || '').toLowerCase()
            ].filter(Boolean));

            let txns = [];

            // 1. Fetch user transactions from backend API
            try {
                const userTxns = await dataService.getUserTransactions(member.id || member.userId);
                if (Array.isArray(userTxns)) txns.push(...userTxns);
            } catch (_) { }

            // 2. Fetch from transaction history
            try {
                const historyRes = await transactionService.getHistory({
                    reportType: 'ALL',
                    search: member.partyCode || member.username || member.mobile || '',
                    size: 100
                });
                const histList = historyRes?.data || historyRes?.transactions || (Array.isArray(historyRes) ? historyRes : []);
                if (Array.isArray(histList)) txns.push(...histList);
            } catch (_) { }

            // 4. Incorporate local storage transactions
            const localTxns = dataService.getData().transactions || [];
            txns.push(...localTxns);

            // Deduplicate & filter strictly to this retailer
            const memberPartyCode = member.partyCode && member.partyCode !== '—' ? String(member.partyCode).trim().toUpperCase() : null;
            const txnMap = new Map();

            txns.forEach(t => {
                if (!t) return;
                const tUser = String(t.user_id || t.userId || t.userName || t.user_name || t.partyCode || t.mobile || '').trim().toLowerCase();
                const tPartyCode = t.partyCode ? String(t.partyCode).trim().toUpperCase() : '';

                const isThisRetailer = (tUser && memberIds.has(tUser)) || (memberPartyCode && tPartyCode && tPartyCode === memberPartyCode);

                if (isThisRetailer) {
                    const idKey = t.id || t.order_id || t.txnid || `${t.amount}_${t.created_at || t.date}_${tUser}`;
                    if (!txnMap.has(idKey)) txnMap.set(idKey, t);
                }
            });

            const memberTxnList = Array.from(txnMap.values()).sort((a, b) => {
                const dA = new Date(a.created_at || a.date || 0);
                const dB = new Date(b.created_at || b.date || 0);
                return dB - dA;
            });

            setRetailerBusinessTxns(memberTxnList);
        } catch (err) {
            console.error('Error loading retailer business:', err);
        } finally {
            setLoadingBusiness(false);
        }
    };

    // Calculate category-wise business statistics
    const businessStats = useMemo(() => {
        const stats = {};
        BUSINESS_SERVICES.forEach(s => {
            stats[s.key] = {
                todayAmt: 0,
                todayCount: 0,
                yesterdayAmt: 0,
                yesterdayCount: 0,
                lifetimeAmt: 0,
                lifetimeCount: 0
            };
        });

        let totalTodayAmt = 0;
        let totalTodayCount = 0;
        let totalYesterdayAmt = 0;
        let totalYesterdayCount = 0;
        let totalLifetimeAmt = 0;
        let totalLifetimeCount = 0;

        retailerBusinessTxns.forEach(t => {
            // Exclude explicitly failed or rejected transactions from business volume
            const status = String(t.status || t.txnStatus || 'SUCCESS').trim().toUpperCase();
            if (status === 'FAILED' || status === 'REJECTED' || status === 'CANCELLED' || status === 'DECLINED') {
                return;
            }

            const sKey = categorizeTxn(t);
            const rawAmt = t.amount ?? t.txnAmount ?? t.transactionAmount ?? 0;
            const amt = Math.abs(parseFloat(String(rawAmt).replace(/,/g, '')) || 0);
            const txnDate = t.created_at || t.createdAt || t.date;

            // Lifetime
            if (stats[sKey]) {
                stats[sKey].lifetimeAmt += amt;
                stats[sKey].lifetimeCount += 1;
            }
            totalLifetimeAmt += amt;
            totalLifetimeCount += 1;

            // Today
            if (isTodayDate(txnDate)) {
                if (stats[sKey]) {
                    stats[sKey].todayAmt += amt;
                    stats[sKey].todayCount += 1;
                }
                totalTodayAmt += amt;
                totalTodayCount += 1;
            }

            // Yesterday
            if (isYesterdayDate(txnDate)) {
                if (stats[sKey]) {
                    stats[sKey].yesterdayAmt += amt;
                    stats[sKey].yesterdayCount += 1;
                }
                totalYesterdayAmt += amt;
                totalYesterdayCount += 1;
            }
        });

        return {
            byService: stats,
            totals: {
                todayAmt: totalTodayAmt,
                todayCount: totalTodayCount,
                yesterdayAmt: totalYesterdayAmt,
                yesterdayCount: totalYesterdayCount,
                lifetimeAmt: totalLifetimeAmt,
                lifetimeCount: totalLifetimeCount
            }
        };
    }, [retailerBusinessTxns]);

    // Export Category-wise Business Matrix to Excel
    const handleExportBusinessExcel = () => {
        if (!businessModalRetailer) return;
        try {
            const rows = BUSINESS_SERVICES.map(srv => {
                const stat = businessStats.byService[srv.key] || { todayAmt: 0, todayCount: 0, yesterdayAmt: 0, yesterdayCount: 0, lifetimeAmt: 0, lifetimeCount: 0 };
                return {
                    "Service Name": srv.label,
                    "Service Category": srv.subLabel,
                    "Today's Volume (₹)": stat.todayAmt,
                    "Today Txn Count": stat.todayCount,
                    "Yesterday's Volume (₹)": stat.yesterdayAmt,
                    "Yesterday Txn Count": stat.yesterdayCount,
                    "Lifetime Volume (₹)": stat.lifetimeAmt,
                    "Lifetime Txn Count": stat.lifetimeCount
                };
            });

            // Summary row
            rows.push({
                "Service Name": "GRAND TOTAL BUSINESS",
                "Service Category": "All Monitored Services Aggregated",
                "Today's Volume (₹)": businessStats.totals.todayAmt,
                "Today Txn Count": businessStats.totals.todayCount,
                "Yesterday's Volume (₹)": businessStats.totals.yesterdayAmt,
                "Yesterday Txn Count": businessStats.totals.yesterdayCount,
                "Lifetime Volume (₹)": businessStats.totals.lifetimeAmt,
                "Lifetime Txn Count": businessStats.totals.lifetimeCount
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Business_Analytics");
            const fileName = `Rupiksha_Business_${businessModalRetailer.partyCode || businessModalRetailer.username}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            showToast('Business report downloaded successfully');
        } catch (err) {
            console.error('Failed to export Excel:', err);
            showToast('Failed to export report', 'error');
        }
    };

    // Copy Party Code Helper
    const handleCopyPartyCode = (code) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        setCopiedPartyCode(true);
        setTimeout(() => setCopiedPartyCode(false), 2000);
        showToast('Party Code copied to clipboard');
    };

    // Filtered services for the matrix search
    const filteredBusinessServices = useMemo(() => {
        const q = businessServiceSearch.trim().toLowerCase();
        if (!q) return BUSINESS_SERVICES;
        return BUSINESS_SERVICES.filter(s =>
            s.label.toLowerCase().includes(q) ||
            s.subLabel.toLowerCase().includes(q) ||
            s.key.toLowerCase().includes(q)
        );
    }, [businessServiceSearch]);

    // Delete Member
    const handleDeleteRetailer = (member) => {
        if (!window.confirm(`Are you sure you want to remove retailer ${member.fullName} from your network?`)) return;
        setRetailers(prev => prev.filter(r => r.id !== member.id));
        showToast(`Retailer ${member.fullName} removed successfully`);
    };

    // Filtered members
    const filtered = retailers.filter(r => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q || [r.fullName, r.name, r.username, r.mobile, r.email, r.partyCode, r.businessName]
            .some(v => v && String(v).toLowerCase().includes(q));
        const matchesStatus = statusFilter === 'ALL'
            || (statusFilter === 'ACTIVE' && (r.status === 'APPROVED' || r.status === 'ACTIVE'))
            || (statusFilter === 'KYC_APPROVED' && (r.kycStatus === 'APPROVED' || r.status === 'APPROVED'));
        return matchesSearch && matchesStatus;
    });

    const activeCount = retailers.filter(r => r.status === 'APPROVED' || r.status === 'ACTIVE').length;
    const kycCount = retailers.filter(r => r.kycStatus === 'APPROVED' || r.status === 'APPROVED').length;
    const totalBalance = retailers.reduce((acc, curr) => acc + (parseFloat(curr.walletBalance) || 0), 0);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5 font-['Inter',sans-serif]">

            {/* Toast alert */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-20 right-6 z-[200] px-4 py-2.5 rounded-xl shadow-xl text-xs font-black text-white flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
                            }`}
                    >
                        <CheckCircle2 size={14} />
                        <span>{toast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Summary Cards (Matching Admin Style) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {[
                    { label: 'Total Retailers', value: retailers.length, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
                    { label: 'Active Partners', value: activeCount, color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
                    { label: 'KYC Approved', value: kycCount, color: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600' },
                    { label: 'Network Balance', value: fmtWallet(totalBalance), color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className={`w-11 h-11 ${s.light} rounded-xl flex items-center justify-center shrink-0`}>
                            <div className={`w-3 h-3 ${s.color} rounded-full`} />
                        </div>
                        <div>
                            <p className={`text-xl sm:text-2xl font-black leading-none ${s.text}`}>{s.value}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Search + Filter + Action Bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100 justify-between">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, mobile, email or party code…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 font-medium"
                    />
                </div>

                <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">All Retailers</option>
                        <option value="ACTIVE">Active Partners</option>
                        <option value="KYC_APPROVED">KYC Approved</option>
                    </select>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 shrink-0"
                    >
                        <UserPlus size={14} /> Add New Retailer
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                CLEAN RETAILER NETWORK TABLE
            ══════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse text-left min-w-[960px]" style={{ tableLayout: 'auto' }}>
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-2.5 py-3 text-center border-r border-slate-200 w-10">#</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Name</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Party Code</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Address</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200">Mobile</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Email</th>
                                <th className="px-3 py-3 text-right border-r border-slate-200">Wallet</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200">Activity</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200">Joined</th>
                                <th className="px-3 py-3 text-center">Action</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="py-14 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-500" size={28} />
                                        <p className="text-xs text-slate-400 mt-2 font-semibold">Loading retailers…</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-14 text-center">
                                        <Users size={32} className="text-slate-300 mx-auto" />
                                        <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-wider">No retailers found in network</p>
                                    </td>
                                </tr>
                            ) : filtered.map((member, idx) => {
                                const addr = [member.addressLine1, member.city, member.stateName].filter(Boolean).join(', ');
                                return (
                                    <tr key={member.id || idx} className="hover:bg-blue-50/20 transition-colors">
                                        {/* Sr No */}
                                        <td className="px-2.5 py-3 text-center text-[12px] text-slate-400 font-semibold border-r border-slate-100">
                                            {idx + 1}
                                        </td>

                                        {/* Name */}
                                        <td className="px-3 py-3 border-r border-slate-100 font-bold text-[13px] text-slate-800 leading-snug">
                                            <div>{member.fullName}</div>
                                            {member.businessName && member.businessName !== member.fullName && (
                                                <div className="text-[10px] text-slate-400 font-medium">{member.businessName}</div>
                                            )}
                                        </td>

                                        {/* Party Code */}
                                        <td className="px-3 py-3 border-r border-slate-100 text-[12px] font-bold text-slate-700 font-mono">
                                            {member.partyCode || '—'}
                                        </td>

                                        {/* Address */}
                                        <td className="px-3 py-3 border-r border-slate-100 text-slate-600 text-[11px] max-w-[220px] truncate" title={addr}>
                                            {addr || '—'}
                                        </td>

                                        {/* Mobile */}
                                        <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700 border-r border-slate-100">
                                            {member.mobile || '—'}
                                        </td>

                                        {/* Email */}
                                        <td className="px-3 py-3 text-slate-600 text-[11px] border-r border-slate-100 max-w-[180px] truncate" title={member.email}>
                                            {member.email || '—'}
                                        </td>

                                        {/* Wallet Balance */}
                                        <td className="px-3 py-3 text-right font-black text-slate-900 border-r border-slate-100 font-mono text-[13px]">
                                            {fmtWallet(member.walletBalance)}
                                        </td>

                                        {/* Activity / Last AEPS */}
                                        <td className="px-3 py-3 text-center border-r border-slate-100 text-[11px]">
                                            {member.lastAepsTxnDate ? (
                                                <div className="flex flex-col gap-0.5 items-center">
                                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                        {fmtDateOnly(member.lastAepsTxnDate)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {fmtTime(member.lastAepsTxnDate)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-medium">Never</span>
                                            )}
                                        </td>

                                        {/* Joined Date & Time */}
                                        <td className="px-3 py-3 text-center text-[11px] leading-tight border-r border-slate-100">
                                            <div className="font-bold text-slate-700">{fmtDateOnly(member.createdAt)}</div>
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{fmtTime(member.createdAt)}</div>
                                        </td>

                                        {/* Action Column with See Business Button */}
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => handleOpenBusinessModal(member)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                                    title={`View ${member.fullName}'s Category-wise Business Transactions`}
                                                >
                                                    <TrendingUp size={13} />
                                                    <span>See Business</span>
                                                </button>
                                                <button
                                                    onClick={() => setSelectedRetailer(member)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                                                    title="View Profile Details"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingRetailer(member)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="Edit Details"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── ADD RETAILER MODAL ── */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 40 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 40 }}
                            className="bg-white w-full max-w-2xl sm:max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col"
                        >
                            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
                                <div>
                                    <h3 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight">
                                        Register Partner
                                    </h3>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                        Direct partner registration · Instant auto-approval
                                    </p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 overflow-y-auto">
                                <NetworkRegistrationForm
                                    roleLock="RETAILER"
                                    uplineId={dist?.id}
                                    uplineRole="DISTRIBUTOR"
                                    onCancel={() => setShowAddModal(false)}
                                    onSuccess={handleRegistrationSuccess}
                                    submitLabel="Register Retailer (Auto-Approved)"
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SUCCESS CELEBRATION MODAL ── */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white px-8 py-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center relative overflow-hidden"
                        >
                            <div className="relative z-10 space-y-4">
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50 text-3xl">
                                    🏆
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Congratulations!</p>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Retailer Registered!</h2>
                                    <p className="text-xs font-semibold text-slate-400">Partner auto-approved & mapped to your network.</p>
                                </div>

                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs font-bold text-emerald-800">
                                    <p className="flex items-center justify-center gap-1.5 text-emerald-700">
                                        <CheckCircle2 size={14} /> STATUS: APPROVED & ACTIVE
                                    </p>
                                </div>

                                <button
                                    onClick={() => setShowSuccess(false)}
                                    className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                >
                                    Done & Refresh
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── VIEW DETAILS MODAL ── */}
            <AnimatePresence>
                {selectedRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-blue-600/20">
                                        {(selectedRetailer.fullName || selectedRetailer.username || 'R').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-800">{selectedRetailer.fullName}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-mono font-bold text-blue-600">{selectedRetailer.partyCode}</span>
                                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Active Retailer</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedRetailer(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Mobile</p>
                                        <p className="font-bold text-slate-900 mt-0.5">{selectedRetailer.mobile}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                                        <p className="font-bold text-slate-900 mt-0.5 truncate">{selectedRetailer.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Wallet Balance</p>
                                        <p className="font-black text-emerald-600 font-mono text-sm mt-0.5">{fmtWallet(selectedRetailer.walletBalance)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Shop / Business</p>
                                        <p className="font-bold text-slate-900 mt-0.5">{selectedRetailer.businessName || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">City & State</p>
                                        <p className="font-bold text-slate-900 mt-0.5">{selectedRetailer.city}, {selectedRetailer.stateName}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">KYC Status</p>
                                        <p className="font-bold text-emerald-600 mt-0.5 uppercase">{selectedRetailer.kycStatus || 'APPROVED'}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">KYC & Document Preview</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {[
                                            { label: 'Aadhaar Front', url: selectedRetailer.aadhaarPhotoUrl },
                                            { label: 'Aadhaar Back', url: selectedRetailer.aadhaarBackPhotoUrl },
                                            { label: 'PAN Card', url: selectedRetailer.panPhotoUrl },
                                            { label: 'Shop Photo', url: selectedRetailer.shopPhotoUrl },
                                        ].map((doc, i) => (
                                            <div key={i} className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center min-h-[90px]">
                                                {doc.url ? (
                                                    <img src={doc.url} alt={doc.label} className="w-full h-16 object-cover rounded-lg mb-1" />
                                                ) : (
                                                    <div className="h-16 flex flex-col items-center justify-center text-slate-400">
                                                        <ImageIcon size={18} />
                                                        <span className="text-[8px] mt-1">Verified on file</span>
                                                    </div>
                                                )}
                                                <span className="text-[9px] font-bold text-slate-600">{doc.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => { setSelectedRetailer(null); handleLoginAsMember(selectedRetailer); }}
                                        className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                                    >
                                        <Zap size={14} /> Open Retailer Portal
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── EDIT RETAILER MODAL ── */}
            <AnimatePresence>
                {editingRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Edit Retailer Details</h3>
                                <button onClick={() => setEditingRetailer(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEdit} className="p-6 space-y-3.5 text-xs">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={editingRetailer.fullName || ''}
                                        onChange={(e) => setEditingRetailer({ ...editingRetailer, fullName: e.target.value })}
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:border-blue-600"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mobile</label>
                                        <input
                                            type="text"
                                            value={editingRetailer.mobile || ''}
                                            onChange={(e) => setEditingRetailer({ ...editingRetailer, mobile: e.target.value })}
                                            required
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono font-bold focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={editingRetailer.email || ''}
                                            onChange={(e) => setEditingRetailer({ ...editingRetailer, email: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Shop / Business Name</label>
                                    <input
                                        type="text"
                                        value={editingRetailer.businessName || ''}
                                        onChange={(e) => setEditingRetailer({ ...editingRetailer, businessName: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City</label>
                                        <input
                                            type="text"
                                            value={editingRetailer.city || ''}
                                            onChange={(e) => setEditingRetailer({ ...editingRetailer, city: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">State</label>
                                        <input
                                            type="text"
                                            value={editingRetailer.stateName || ''}
                                            onChange={(e) => setEditingRetailer({ ...editingRetailer, stateName: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingRetailer(null)}
                                        className="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl text-xs uppercase hover:bg-slate-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-1"
                                    >
                                        <Save size={14} /> Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SERVICES MODAL ── */}
            <AnimatePresence>
                {servicesModalRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Partner Services</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{servicesModalRetailer.fullName}</p>
                                </div>
                                <button onClick={() => setServicesModalRetailer(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-2.5">
                                {memberServices.map((s) => (
                                    <div key={s.serviceType} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-bold text-slate-800">{s.label}</span>
                                        </div>
                                        <button
                                            onClick={() => handleToggleService(s.serviceType)}
                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${s.enabled
                                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                    : 'bg-slate-200 text-slate-500'
                                                }`}
                                        >
                                            {s.enabled ? 'ACTIVE' : 'DISABLED'}
                                        </button>
                                    </div>
                                ))}

                                <button
                                    onClick={() => setServicesModalRetailer(null)}
                                    className="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SEE BUSINESS MODAL (INDUSTRY FINTECH GRADE) ── */}
            <AnimatePresence>
                {businessModalRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.94, opacity: 0, y: 25 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.94, opacity: 0, y: 25 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[94vh] flex flex-col border border-slate-100/80"
                        >
                            {/* Modal Header Bar */}
                            <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shrink-0 relative overflow-hidden">
                                <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-blue-600/15 via-indigo-600/10 to-transparent pointer-events-none" />

                                <div className="flex items-center gap-3.5 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0 ring-2 ring-white/10">
                                        {(businessModalRetailer.fullName || 'R').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                                                {businessModalRetailer.fullName}
                                            </h3>
                                            <button
                                                onClick={() => handleCopyPartyCode(businessModalRetailer.partyCode)}
                                                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-white/15 hover:bg-white/25 text-blue-200 px-2.5 py-0.5 rounded-lg border border-white/10 transition-all cursor-pointer"
                                                title="Click to copy Party Code"
                                            >
                                                <span>{businessModalRetailer.partyCode}</span>
                                                {copiedPartyCode ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                            </button>
                                            <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                                <ShieldCheck size={10} /> Active Network Partner
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-300 font-medium mt-1 flex items-center gap-3 flex-wrap">
                                            <span>📱 {businessModalRetailer.mobile}</span>
                                            <span className="text-white/30">•</span>
                                            <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                                                <Wallet size={12} /> Float: <strong className="text-white font-mono font-bold">{fmtWallet(businessModalRetailer.walletBalance)}</strong>
                                            </span>
                                            <span className="text-white/30">•</span>
                                            <span>📍 {businessModalRetailer.city || 'BIHAR'}, {businessModalRetailer.stateName || 'INDIA'}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 relative z-10">
                                    <button
                                        onClick={handleExportBusinessExcel}
                                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 shadow-sm transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95"
                                        title="Export Category Breakdown to Excel"
                                    >
                                        <FileSpreadsheet size={14} className="text-emerald-400" />
                                        <span className="hidden md:inline">Export Excel</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenBusinessModal(businessModalRetailer)}
                                        disabled={loadingBusiness}
                                        className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 shadow-sm transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95"
                                        title="Refresh live transactions"
                                    >
                                        <RefreshCw size={14} className={loadingBusiness ? 'animate-spin text-blue-400' : 'text-blue-300'} />
                                        <span className="hidden sm:inline">Sync</span>
                                    </button>
                                    <button
                                        onClick={() => setBusinessModalRetailer(null)}
                                        className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body Content */}
                            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs bg-slate-50/40">

                                {/* Top 3 Fintech KPI Pillars */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                    {/* Today Card */}
                                    <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                        <div className="absolute -right-3 -bottom-3 text-emerald-50 text-6xl font-black select-none pointer-events-none">₹</div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                Today's Turnover
                                            </span>
                                            <span className="text-[10px] font-black font-mono bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                                {businessStats.totals.todayCount} {businessStats.totals.todayCount === 1 ? 'Txn' : 'Txns'}
                                            </span>
                                        </div>
                                        <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 mt-2.5 tracking-tight relative z-10">
                                            {fmtWallet(businessStats.totals.todayAmt)}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1 relative z-10 flex items-center gap-1">
                                            <Clock size={11} className="text-emerald-500" />
                                            <span>Current day 24-hr settlement window</span>
                                        </p>
                                    </div>

                                    {/* Yesterday Card */}
                                    <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                        <div className="absolute -right-3 -bottom-3 text-amber-50 text-6xl font-black select-none pointer-events-none">₹</div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                                                <TrendingUp size={12} className="text-amber-500" />
                                                Yesterday's Turnover
                                            </span>
                                            <span className="text-[10px] font-black font-mono bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200">
                                                {businessStats.totals.yesterdayCount} {businessStats.totals.yesterdayCount === 1 ? 'Txn' : 'Txns'}
                                            </span>
                                        </div>
                                        <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 mt-2.5 tracking-tight relative z-10">
                                            {fmtWallet(businessStats.totals.yesterdayAmt)}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1 relative z-10 flex items-center gap-1">
                                            <Clock size={11} className="text-amber-500" />
                                            <span>Previous day completed business volume</span>
                                        </p>
                                    </div>

                                    {/* Lifetime Card */}
                                    <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                        <div className="absolute -right-3 -bottom-3 text-indigo-50 text-6xl font-black select-none pointer-events-none">₹</div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                                                <Award size={12} className="text-indigo-500" />
                                                Lifetime Network GMV
                                            </span>
                                            <span className="text-[10px] font-black font-mono bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                                                {businessStats.totals.lifetimeCount} {businessStats.totals.lifetimeCount === 1 ? 'Txn' : 'Txns'}
                                            </span>
                                        </div>
                                        <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 mt-2.5 tracking-tight relative z-10">
                                            {fmtWallet(businessStats.totals.lifetimeAmt)}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1 relative z-10 flex items-center gap-1">
                                            <ShieldCheck size={11} className="text-indigo-500" />
                                            <span>All-time processed transactional volume</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Tab Controls + Table Header Bar */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setBusinessActiveTab('matrix')}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${businessActiveTab === 'matrix'
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                        >
                                            <Layers size={13} />
                                            <span>Service Matrix ({BUSINESS_SERVICES.length})</span>
                                        </button>
                                        <button
                                            onClick={() => setBusinessActiveTab('logs')}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${businessActiveTab === 'logs'
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                        >
                                            <Activity size={13} />
                                            <span>Live Audit Stream ({retailerBusinessTxns.length})</span>
                                        </button>
                                    </div>

                                    {businessActiveTab === 'matrix' && (
                                        <div className="relative flex-1 max-w-xs">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                            <input
                                                type="text"
                                                placeholder="Filter services (e.g. AEPS, DMT, BBPS)..."
                                                value={businessServiceSearch}
                                                onChange={(e) => setBusinessServiceSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 font-medium"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* TAB 1: CATEGORY MATRIX TABLE */}
                                {businessActiveTab === 'matrix' && (
                                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="w-full overflow-x-auto">
                                            <table className="w-full border-collapse text-left min-w-[760px]">
                                                <thead>
                                                    <tr className="bg-gradient-to-r from-slate-100 to-slate-100 border-b-2 border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                                                        <th className="px-4 py-3 text-left border-r border-slate-200">Services</th>
                                                        <th className="px-4 py-3 text-right border-r border-slate-200">Today's Transaction</th>
                                                        <th className="px-4 py-3 text-right border-r border-slate-200">Yesterday Transaction</th>
                                                        <th className="px-4 py-3 text-right">Lifetime Transaction</th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-slate-100 text-xs">
                                                    {loadingBusiness ? (
                                                        <tr>
                                                            <td colSpan={4} className="py-14 text-center">
                                                                <Loader2 className="animate-spin mx-auto text-blue-500" size={28} />
                                                                <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-wider">Aggregating live category transactions…</p>
                                                            </td>
                                                        </tr>
                                                    ) : filteredBusinessServices.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="py-12 text-center text-slate-400">
                                                                <p className="font-semibold">No services matching "{businessServiceSearch}"</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredBusinessServices.map((srv) => {
                                                            const stat = businessStats.byService[srv.key] || {
                                                                todayAmt: 0, todayCount: 0,
                                                                yesterdayAmt: 0, yesterdayCount: 0,
                                                                lifetimeAmt: 0, lifetimeCount: 0
                                                            };

                                                            return (
                                                                <tr key={srv.key} className="hover:bg-blue-50/20 transition-colors">
                                                                    {/* Service Column */}
                                                                    <td className="px-4 py-3.5 border-r border-slate-100">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-2xl shrink-0">{srv.icon}</span>
                                                                            <div>
                                                                                <p className="font-black text-slate-800 text-[13px] leading-tight">
                                                                                    {srv.label}
                                                                                </p>
                                                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                                                    {srv.subLabel}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </td>

                                                                    {/* Today's Transaction Column */}
                                                                    <td className="px-4 py-3.5 text-right border-r border-slate-100 font-mono">
                                                                        <div className={`font-black text-[13px] ${stat.todayAmt > 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                                                                            {fmtWallet(stat.todayAmt)}
                                                                        </div>
                                                                        <div className="mt-1">
                                                                            <span className={`inline-block text-[9px] font-black px-2.5 py-0.5 rounded-full ${stat.todayCount > 0
                                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs'
                                                                                    : 'bg-slate-100 text-slate-400'
                                                                                }`}>
                                                                                {stat.todayCount} {stat.todayCount === 1 ? 'txn' : 'txns'}
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    {/* Yesterday Transaction Column */}
                                                                    <td className="px-4 py-3.5 text-right border-r border-slate-100 font-mono">
                                                                        <div className={`font-black text-[13px] ${stat.yesterdayAmt > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                                                                            {fmtWallet(stat.yesterdayAmt)}
                                                                        </div>
                                                                        <div className="mt-1">
                                                                            <span className={`inline-block text-[9px] font-black px-2.5 py-0.5 rounded-full ${stat.yesterdayCount > 0
                                                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200 shadow-xs'
                                                                                    : 'bg-slate-100 text-slate-400'
                                                                                }`}>
                                                                                {stat.yesterdayCount} {stat.yesterdayCount === 1 ? 'txn' : 'txns'}
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    {/* Lifetime Transaction Column */}
                                                                    <td className="px-4 py-3.5 text-right font-mono">
                                                                        <div className={`font-black text-[13px] ${stat.lifetimeAmt > 0 ? 'text-indigo-700' : 'text-slate-900'}`}>
                                                                            {fmtWallet(stat.lifetimeAmt)}
                                                                        </div>
                                                                        <div className="mt-1">
                                                                            <span className={`inline-block text-[9px] font-black px-2.5 py-0.5 rounded-full ${stat.lifetimeCount > 0
                                                                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-xs'
                                                                                    : 'bg-slate-100 text-slate-400'
                                                                                }`}>
                                                                                {stat.lifetimeCount} {stat.lifetimeCount === 1 ? 'txn' : 'txns'}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>

                                                {/* Grand Total Footer */}
                                                <tfoot>
                                                    <tr className="bg-gradient-to-r from-slate-100 via-slate-100 to-slate-200 border-t-2 border-slate-300 font-black text-slate-800">
                                                        <td className="px-4 py-4 border-r border-slate-300">
                                                            <div className="flex items-center gap-2">
                                                                <Award size={18} className="text-blue-600" />
                                                                <div>
                                                                    <span className="text-xs uppercase tracking-wider block">Grand Total Business</span>
                                                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">Consolidated Category Volume</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right border-r border-slate-300 font-mono">
                                                            <div className="text-sm sm:text-base font-black text-emerald-800">
                                                                {fmtWallet(businessStats.totals.todayAmt)}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-emerald-600">
                                                                {businessStats.totals.todayCount} total txns
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-right border-r border-slate-300 font-mono">
                                                            <div className="text-sm sm:text-base font-black text-amber-800">
                                                                {fmtWallet(businessStats.totals.yesterdayAmt)}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-amber-600">
                                                                {businessStats.totals.yesterdayCount} total txns
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-right font-mono">
                                                            <div className="text-sm sm:text-base font-black text-blue-900">
                                                                {fmtWallet(businessStats.totals.lifetimeAmt)}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-blue-700">
                                                                {businessStats.totals.lifetimeCount} total txns
                                                            </span>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: LIVE AUDIT STREAM */}
                                {businessActiveTab === 'logs' && (
                                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="w-full overflow-x-auto">
                                            <table className="w-full border-collapse text-left min-w-[700px]">
                                                <thead>
                                                    <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                                                        <th className="px-4 py-3 border-r border-slate-200">#</th>
                                                        <th className="px-4 py-3 border-r border-slate-200">Date & Time</th>
                                                        <th className="px-4 py-3 border-r border-slate-200">Service Domain</th>
                                                        <th className="px-4 py-3 border-r border-slate-200">Ref / Txn ID</th>
                                                        <th className="px-4 py-3 text-right border-r border-slate-200">Amount (₹)</th>
                                                        <th className="px-4 py-3 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs">
                                                    {retailerBusinessTxns.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="py-12 text-center text-slate-400">
                                                                <Activity size={28} className="mx-auto text-slate-300 mb-2" />
                                                                <p className="font-bold uppercase tracking-wider">No individual transaction records logged yet for this retailer.</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        retailerBusinessTxns.map((t, idx) => {
                                                            const sKey = categorizeTxn(t);
                                                            const srv = BUSINESS_SERVICES.find(s => s.key === sKey) || { label: 'Service', icon: '⚡' };
                                                            const rawAmt = t.amount ?? t.txnAmount ?? t.transactionAmount ?? 0;
                                                            const amt = parseFloat(String(rawAmt).replace(/,/g, '')) || 0;

                                                            return (
                                                                <tr key={t.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                                                    <td className="px-4 py-3 text-slate-400 font-semibold border-r border-slate-100">{idx + 1}</td>
                                                                    <td className="px-4 py-3 border-r border-slate-100 font-mono text-[11px] text-slate-600">
                                                                        {fmtDateOnly(t.created_at || t.createdAt || t.date)} {fmtTime(t.created_at || t.createdAt || t.date)}
                                                                    </td>
                                                                    <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-800">
                                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                                                                            <span>{srv.icon}</span> {srv.label}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">
                                                                        {t.id || t.order_id || t.txnid || '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-black font-mono text-[12px] text-slate-900 border-r border-slate-100">
                                                                        {fmtWallet(amt)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                                            {t.status || 'SUCCESS'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Modal Footer Quick Actions */}
                                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-200/80">
                                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-emerald-500" />
                                        <span>256-Bit Encrypted Financial Ledger · Real-Time Network Sync</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const retailer = businessModalRetailer;
                                                setBusinessModalRetailer(null);
                                                setSelectedRetailer(retailer);
                                            }}
                                            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                                        >
                                            View Full Profile
                                        </button>
                                        <button
                                            onClick={() => {
                                                const retailer = businessModalRetailer;
                                                setBusinessModalRetailer(null);
                                                handleLoginAsMember(retailer);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Zap size={13} /> Open Retailer Portal
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default Retailers;


