import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, Download, UserPlus, ShieldCheck,
    CheckCircle2, AlertCircle, Clock, X, Eye, Wallet,
    Smartphone, Mail, MapPin, Zap, Package, Edit3, Trash2,
    Lock, Save, Loader2, Image as ImageIcon, TrendingUp,
    BarChart3, RefreshCw, IndianRupee, Layers, Check,
    Building2, Landmark, Coins, ArrowUpRight, Award, Shield,
    FileSpreadsheet, Activity, ChevronRight, Copy, CheckCheck, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
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
    { key: 'AEPS_1', label: 'Aeps 1', icon: '🏦', bgIcon: 'bg-[#DCFCE7]', color: 'bg-blue-500', bgLight: 'bg-blue-50', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-800' },
    { key: 'AEPS_2', label: 'Aeps 2', icon: '🏧', bgIcon: 'bg-[#FFE4E6]', color: 'bg-indigo-500', bgLight: 'bg-indigo-50', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-800' },
    { key: 'DMT', label: 'Dmt (Money Transfer)', icon: '💸', bgIcon: 'bg-[#FEF3C7]', color: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-800' },
    { key: 'BBPS', label: 'Bbps & Utilities', icon: '💡', bgIcon: 'bg-[#E0F2FE]', color: 'bg-amber-500', bgLight: 'bg-amber-50', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-800' },
    { key: 'RECHARGE', label: 'Mobile & Dth Recharge', icon: '📱', bgIcon: 'bg-[#CFFAFE]', color: 'bg-cyan-500', bgLight: 'bg-cyan-50', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-800' },
    { key: 'MATM', label: 'Micro Atm (Matm)', icon: '💳', bgIcon: 'bg-[#F3E8FF]', color: 'bg-purple-500', bgLight: 'bg-purple-50', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-800' },
    { key: 'PAYOUT', label: 'Payout / Settlement', icon: '🏛️', bgIcon: 'bg-[#FCE7F3]', color: 'bg-rose-500', bgLight: 'bg-rose-50', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-800' },
    { key: 'CMS', label: 'Cms (Cash Collection)', icon: '📦', bgIcon: 'bg-[#CCFBF1]', color: 'bg-teal-500', bgLight: 'bg-teal-50', text: 'text-teal-600', badge: 'bg-teal-100 text-teal-800' },
    { key: 'OTHER', label: 'Other Services', icon: '✨', bgIcon: 'bg-[#F1F5F9]', color: 'bg-slate-500', bgLight: 'bg-slate-100', text: 'text-slate-600', badge: 'bg-slate-200 text-slate-800' }
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

            // 1. Fetch network transactions from backend API
            try {
                const userTxns = await dataService.getUserTransactions(member.id || member.userId);
                if (Array.isArray(userTxns)) txns.push(...userTxns);
            } catch (_) { }

            // 2. Incorporate local and shared transactions
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

    // Export Category-wise Business Matrix to PDF
    const handleExportBusinessPDF = () => {
        if (!businessModalRetailer) return;
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const fmtPDF = (v) => {
                const n = parseFloat(String(v || 0).replace(/,/g, ''));
                return isNaN(n) ? 'Rs. 0.00' : 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };

            // 1. Top Brand Header (Deep Slate Navy)
            doc.setFillColor(15, 23, 42); // #0F172A
            doc.rect(0, 0, pageWidth, 24, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.text('Rupiksha Services Private Limited', 14, 10.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(203, 213, 225);
            doc.text('RETAILER BUSINESS PERFORMANCE & TURNOVER REPORT', 14, 16);
            doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 21);

            // 2. Partner Info Card Box
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.roundedRect(12, 28, pageWidth - 24, 20, 2.5, 2.5, 'FD');

            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11.5);
            doc.text(businessModalRetailer.fullName || 'Retailer Partner', 16, 34.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            doc.text(`Party Code: ${businessModalRetailer.partyCode || '—'}    |    Mobile: ${businessModalRetailer.mobile || '—'}    |    Float: ${fmtPDF(businessModalRetailer.walletBalance)}`, 16, 40);
            doc.text(`Location: ${businessModalRetailer.city || 'Siwan'}, ${businessModalRetailer.stateName || 'BIHAR'}    |    Status: Active Network Partner`, 16, 45);

            // 3. KPI Turnover Boxes (3 Columns)
            const kpiWidth = (pageWidth - 24 - 8) / 3;

            // KPI 1: Today
            doc.setFillColor(239, 246, 255);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.roundedRect(12, 52, kpiWidth, 20, 2, 2, 'FD');
            doc.setTextColor(29, 78, 216);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text("TODAY'S TURNOVER", 16, 57.5);
            doc.setFontSize(12);
            doc.text(fmtPDF(businessStats.totals.todayAmt), 16, 64);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text(`${businessStats.totals.todayCount} Txns (24h Window)`, 16, 69);

            // KPI 2: Yesterday
            doc.setFillColor(236, 253, 245);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.roundedRect(12 + kpiWidth + 4, 52, kpiWidth, 20, 2, 2, 'FD');
            doc.setTextColor(4, 120, 87);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text("YESTERDAY'S TURNOVER", 16 + kpiWidth + 4, 57.5);
            doc.setFontSize(12);
            doc.text(fmtPDF(businessStats.totals.yesterdayAmt), 16 + kpiWidth + 4, 64);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text(`${businessStats.totals.yesterdayCount} Txns (Completed)`, 16 + kpiWidth + 4, 69);

            // KPI 3: Lifetime
            doc.setFillColor(245, 243, 255);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.roundedRect(12 + (kpiWidth + 4) * 2, 52, kpiWidth, 20, 2, 2, 'FD');
            doc.setTextColor(91, 33, 182);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text("LIFETIME NETWORK GMV", 16 + (kpiWidth + 4) * 2, 57.5);
            doc.setFontSize(12);
            doc.text(fmtPDF(businessStats.totals.lifetimeAmt), 16 + (kpiWidth + 4) * 2, 64);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text(`${businessStats.totals.lifetimeCount} Total All-Time Txns`, 16 + (kpiWidth + 4) * 2, 69);

            // 4. Matrix Table with Full Dark Black Grid Lines & Balanced Columns
            const tableX = 12;
            const tableWidth = pageWidth - 24; // 186mm
            const col1X = tableX;              // 12mm
            const col2X = tableX + 54;         // 66mm (col 1 width = 54mm)
            const col3X = col2X + 44;          // 110mm (col 2 width = 44mm)
            const col4X = col3X + 44;          // 154mm (col 3 width = 44mm)
            const tableEndX = tableX + tableWidth; // 198mm (col 4 width = 44mm)

            const col2Center = col2X + 22;     // 88mm
            const col3Center = col3X + 22;     // 132mm
            const col4Center = col4X + 22;     // 176mm

            const tableTopY = 76;
            const headerHeight = 8;
            const rowHeight = 9.2;
            let currentY = tableTopY;

            // Table Header Row
            doc.setFillColor(241, 245, 249);
            doc.rect(tableX, currentY, tableWidth, headerHeight, 'F');

            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('Services', col1X + 3, currentY + 5.2);
            doc.text("Today's Transaction", col2Center, currentY + 5.2, { align: 'center' });
            doc.text("Yesterday Transaction", col3Center, currentY + 5.2, { align: 'center' });
            doc.text("Lifetime Transaction", col4Center, currentY + 5.2, { align: 'center' });

            // Header bottom line
            currentY += headerHeight;

            // Table Service Rows
            BUSINESS_SERVICES.forEach((srv, idx) => {
                const stat = businessStats.byService[srv.key] || { todayAmt: 0, todayCount: 0, yesterdayAmt: 0, yesterdayCount: 0, lifetimeAmt: 0, lifetimeCount: 0 };
                const rowBg = idx % 2 === 0 ? 255 : 249;
                doc.setFillColor(rowBg, rowBg, rowBg);
                doc.rect(tableX, currentY, tableWidth, rowHeight, 'F');

                // Service Name (No subLabel)
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(srv.label, col1X + 3, currentY + 5.5);

                // Today (Center Aligned)
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(fmtPDF(stat.todayAmt), col2Center, currentY + 3.8, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(37, 99, 235);
                doc.text(`${stat.todayCount} Txns`, col2Center, currentY + 7.4, { align: 'center' });

                // Yesterday (Center Aligned)
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(fmtPDF(stat.yesterdayAmt), col3Center, currentY + 3.8, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(5, 150, 105);
                doc.text(`${stat.yesterdayCount} Txns`, col3Center, currentY + 7.4, { align: 'center' });

                // Lifetime (Center Aligned)
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(fmtPDF(stat.lifetimeAmt), col4Center, currentY + 3.8, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(124, 58, 237);
                doc.text(`${stat.lifetimeCount} Txns`, col4Center, currentY + 7.4, { align: 'center' });

                currentY += rowHeight;
            });

            // Grand Total Row
            const totalRowHeight = 9.5;
            doc.setFillColor(241, 245, 249);
            doc.rect(tableX, currentY, tableWidth, totalRowHeight, 'F');

            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('Grand Total Business', col1X + 3, currentY + 5.5);

            doc.setTextColor(29, 78, 216);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text(fmtPDF(businessStats.totals.todayAmt), col2Center, currentY + 4.8, { align: 'center' });
            doc.setFontSize(6.5);
            doc.text(`${businessStats.totals.todayCount} Total Txns`, col2Center, currentY + 8.8, { align: 'center' });

            doc.setTextColor(4, 120, 87);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text(fmtPDF(businessStats.totals.yesterdayAmt), col3Center, currentY + 4.8, { align: 'center' });
            doc.setFontSize(6.5);
            doc.text(`${businessStats.totals.yesterdayCount} Total Txns`, col3Center, currentY + 8.8, { align: 'center' });

            doc.setTextColor(91, 33, 182);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text(fmtPDF(businessStats.totals.lifetimeAmt), col4Center, currentY + 4.8, { align: 'center' });
            doc.setFontSize(6.5);
            doc.text(`${businessStats.totals.lifetimeCount} Total Txns`, col4Center, currentY + 8.8, { align: 'center' });

            const tableBottomY = currentY + totalRowHeight;

            // 5. Draw Solid Dark Black Grid Lines (Horizontal & Vertical)
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.35);

            // Outer border
            doc.rect(tableX, tableTopY, tableWidth, tableBottomY - tableTopY);

            // Horizontal lines
            let lineY = tableTopY + headerHeight;
            doc.line(tableX, lineY, tableEndX, lineY); // Below header

            BUSINESS_SERVICES.forEach(() => {
                lineY += rowHeight;
                doc.line(tableX, lineY, tableEndX, lineY); // Below each service row
            });

            // Vertical column grid lines
            doc.line(col2X, tableTopY, col2X, tableBottomY);
            doc.line(col3X, tableTopY, col3X, tableBottomY);
            doc.line(col4X, tableTopY, col4X, tableBottomY);

            // 6. Footer Security & Confidentiality Stamp
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text('Official Confidential Report generated from Rupiksha Enterprise Financial Network · 256-Bit Encrypted Ledger', 12, pageHeight - 10);

            const cleanName = (businessModalRetailer.fullName || 'Retailer').replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Rupiksha_Business_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`);
            showToast('Business report PDF generated successfully!');
        } catch (err) {
            console.error('Failed to export PDF:', err);
            showToast('Failed to export PDF report', 'error');
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

            {/* ── SEE BUSINESS MODAL (PREMIUM FINTECH DASHBOARD UI) ── */}
            <AnimatePresence>
                {businessModalRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-[#0F172A]/45 backdrop-blur-[6px] flex items-center justify-center p-3 sm:p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
                            className="bg-white w-[95vw] max-w-[1520px] rounded-[20px] overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.18)] max-h-[90vh] flex flex-col border border-[#E5EAF2] text-[#0F172A]"
                        >
                            {/* Modal Header Bar */}
                            <div className="px-6 sm:px-8 py-5 border-b border-[#E8EDF3] flex items-center justify-between bg-white text-[#0F172A] shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-[14px] bg-[#0F172A] text-white font-bold text-2xl flex items-center justify-center shrink-0 shadow-xs">
                                        {(businessModalRetailer.fullName || 'T').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h3 className="text-[20px] sm:text-[22px] font-bold text-[#0F172A] tracking-tight">
                                                {businessModalRetailer.fullName}
                                            </h3>
                                            <button
                                                onClick={() => handleCopyPartyCode(businessModalRetailer.partyCode)}
                                                className="p-1 text-[#64748B] hover:text-[#0F172A] rounded-md transition-colors cursor-pointer"
                                                title="Copy Party Code"
                                            >
                                                {copiedPartyCode ? <CheckCheck size={16} className="text-[#059669]" /> : <Copy size={16} />}
                                            </button>
                                            <span className="inline-flex items-center font-mono text-[12px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-2.5 py-0.5 rounded-[8px]">
                                                {businessModalRetailer.partyCode}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-[#ECFDF3] text-[#047857] border border-[#A7F3D0] px-3 py-0.5 rounded-full">
                                                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                                                Active Network Partner
                                            </span>
                                        </div>
                                        <p className="text-[13px] sm:text-[14px] text-[#475569] font-medium mt-1.5 flex items-center gap-3.5 flex-wrap">
                                            <span className="flex items-center gap-1.5">
                                                <Smartphone size={15} className="text-[#2563EB]" />
                                                <span>{businessModalRetailer.mobile}</span>
                                            </span>
                                            <span className="text-[#CBD5E1]">|</span>
                                            <span className="flex items-center gap-1.5">
                                                <Wallet size={15} className="text-[#2563EB]" />
                                                <span>Float: <strong className="text-[#0F172A] font-bold">{fmtWallet(businessModalRetailer.walletBalance)}</strong></span>
                                            </span>
                                            <span className="text-[#CBD5E1]">|</span>
                                            <span className="flex items-center gap-1.5">
                                                <MapPin size={15} className="text-[#2563EB]" />
                                                <span>{businessModalRetailer.city || 'Siwan'}, {businessModalRetailer.stateName || 'BIHAR'}</span>
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <button
                                        onClick={handleExportBusinessExcel}
                                        className="h-[44px] px-4 bg-white hover:bg-[#F8FAFC] text-[#0F172A] font-medium text-[13px] rounded-[10px] border border-[#CBD5E1] shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                                        title="Export Category Breakdown to Excel"
                                    >
                                        <Download size={16} className="text-[#0F172A]" />
                                        <span className="hidden md:inline">Export Excel</span>
                                    </button>
                                    <button
                                        onClick={handleExportBusinessPDF}
                                        className="h-[44px] px-4 bg-white hover:bg-[#F8FAFC] text-[#0F172A] font-medium text-[13px] rounded-[10px] border border-[#CBD5E1] shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                                        title="Export Category Breakdown to PDF"
                                    >
                                        <FileText size={16} className="text-[#DC2626]" />
                                        <span className="hidden md:inline">Export PDF</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenBusinessModal(businessModalRetailer)}
                                        disabled={loadingBusiness}
                                        className="h-[44px] px-4 bg-white hover:bg-[#F8FAFC] text-[#0F172A] font-medium text-[13px] rounded-[10px] border border-[#CBD5E1] shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                                        title="Refresh live transactions"
                                    >
                                        <RefreshCw size={16} className={loadingBusiness ? 'animate-spin text-[#2563EB]' : 'text-[#0F172A]'} />
                                        <span className="hidden sm:inline">Sync</span>
                                    </button>
                                    <button
                                        onClick={() => setBusinessModalRetailer(null)}
                                        className="w-[44px] h-[44px] bg-white hover:bg-[#F8FAFC] text-[#0F172A] rounded-[10px] border border-[#CBD5E1] shadow-xs flex items-center justify-center transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body Content */}
                            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-xs bg-white text-[#0F172A]">

                                {/* ── TOP 3 KPI / TURNOVER CARDS (PASTEL FINTECH GRADE) ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                                    {/* CARD 1 — BLUE: TODAY'S TURNOVER */}
                                    <div className="bg-gradient-to-br from-[#F8FBFF] to-[#EFF6FF] border border-[#BFDBFE] rounded-[16px] p-5 relative overflow-hidden shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] transition-all duration-200">
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-[12px] bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center shadow-xs shrink-0">
                                                    <Wallet size={20} />
                                                </div>
                                                <span className="text-[13px] font-bold uppercase tracking-[0.4px] text-[#1D4ED8]">
                                                    TODAY'S TURNOVER
                                                </span>
                                            </div>
                                            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                                                {businessStats.totals.todayCount} {businessStats.totals.todayCount === 1 ? 'Txn' : 'Txns'}
                                            </span>
                                        </div>

                                        <div className="flex items-end justify-between mt-3 relative z-10">
                                            <div>
                                                <p className="text-3xl sm:text-[36px] font-[800] text-[#1D4ED8] tracking-tight leading-tight">
                                                    {fmtWallet(businessStats.totals.todayAmt)}
                                                </p>
                                                <p className="text-[13px] text-[#475569] font-medium mt-1 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-[#2563EB]" />
                                                    <span>Current Day 24-Hr Settlement Window</span>
                                                </p>
                                            </div>

                                            {/* Decorative subtle mini bar chart graphic */}
                                            <div className="flex items-end gap-1 pointer-events-none opacity-40 mb-1">
                                                <div className="w-2.5 h-6 bg-[#93C5FD] rounded-t-[3px]" />
                                                <div className="w-2.5 h-10 bg-[#60A5FA] rounded-t-[3px]" />
                                                <div className="w-2.5 h-8 bg-[#3B82F6] rounded-t-[3px]" />
                                                <div className="w-2.5 h-14 bg-[#1D4ED8] rounded-t-[3px]" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* CARD 2 — GREEN: YESTERDAY'S TURNOVER */}
                                    <div className="bg-gradient-to-br from-[#F7FFFB] to-[#ECFDF5] border border-[#A7F3D0] rounded-[16px] p-5 relative overflow-hidden shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] transition-all duration-200">
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-[12px] bg-[#D1FAE5] text-[#047857] flex items-center justify-center shadow-xs shrink-0">
                                                    <TrendingUp size={20} />
                                                </div>
                                                <span className="text-[13px] font-bold uppercase tracking-[0.4px] text-[#047857]">
                                                    YESTERDAY'S TURNOVER
                                                </span>
                                            </div>
                                            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                                                {businessStats.totals.yesterdayCount} {businessStats.totals.yesterdayCount === 1 ? 'Txn' : 'Txns'}
                                            </span>
                                        </div>

                                        <div className="flex items-end justify-between mt-3 relative z-10">
                                            <div>
                                                <p className="text-3xl sm:text-[36px] font-[800] text-[#047857] tracking-tight leading-tight">
                                                    {fmtWallet(businessStats.totals.yesterdayAmt)}
                                                </p>
                                                <p className="text-[13px] text-[#475569] font-medium mt-1 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-[#059669]" />
                                                    <span>Previous Day Completed Business Volume</span>
                                                </p>
                                            </div>

                                            {/* Decorative subtle mini bar chart graphic */}
                                            <div className="flex items-end gap-1 pointer-events-none opacity-40 mb-1">
                                                <div className="w-2.5 h-6 bg-[#A7F3D0] rounded-t-[3px]" />
                                                <div className="w-2.5 h-11 bg-[#6EE7B7] rounded-t-[3px]" />
                                                <div className="w-2.5 h-7 bg-[#34D399] rounded-t-[3px]" />
                                                <div className="w-2.5 h-13 bg-[#047857] rounded-t-[3px]" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* CARD 3 — PURPLE: LIFETIME NETWORK GMV */}
                                    <div className="bg-gradient-to-br from-[#FCFAFF] to-[#F5F3FF] border border-[#DDD6FE] rounded-[16px] p-5 relative overflow-hidden shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] transition-all duration-200">
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-[12px] bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center shadow-xs shrink-0">
                                                    <Award size={20} />
                                                </div>
                                                <span className="text-[13px] font-bold uppercase tracking-[0.4px] text-[#5B21B6]">
                                                    LIFETIME NETWORK GMV
                                                </span>
                                            </div>
                                            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE]">
                                                {businessStats.totals.lifetimeCount} {businessStats.totals.lifetimeCount === 1 ? 'Txn' : 'Txns'}
                                            </span>
                                        </div>

                                        <div className="flex items-end justify-between mt-3 relative z-10">
                                            <div>
                                                <p className="text-3xl sm:text-[36px] font-[800] text-[#5B21B6] tracking-tight leading-tight">
                                                    {fmtWallet(businessStats.totals.lifetimeAmt)}
                                                </p>
                                                <p className="text-[13px] text-[#475569] font-medium mt-1 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-[#7C3AED]" />
                                                    <span>All-Time Processed Transactional Volume</span>
                                                </p>
                                            </div>

                                            {/* Decorative subtle mini bar chart graphic */}
                                            <div className="flex items-end gap-1 pointer-events-none opacity-40 mb-1">
                                                <div className="w-2.5 h-6 bg-[#DDD6FE] rounded-t-[3px]" />
                                                <div className="w-2.5 h-10 bg-[#C4B5FD] rounded-t-[3px]" />
                                                <div className="w-2.5 h-8 bg-[#A78BFA] rounded-t-[3px]" />
                                                <div className="w-2.5 h-14 bg-[#5B21B6] rounded-t-[3px]" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── SECTION TABS & SEARCH BAR ── */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setBusinessActiveTab('matrix')}
                                            className={`px-5 py-2.5 rounded-[10px] text-[13px] font-bold transition-all flex items-center gap-2 cursor-pointer ${businessActiveTab === 'matrix'
                                                    ? 'bg-[#1557D6] text-white shadow-xs'
                                                    : 'bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#334155]'
                                                }`}
                                        >
                                            <Layers size={16} />
                                            <span>Service Matrix ({BUSINESS_SERVICES.length})</span>
                                        </button>
                                        <button
                                            onClick={() => setBusinessActiveTab('logs')}
                                            className={`px-5 py-2.5 rounded-[10px] text-[13px] font-bold transition-all flex items-center gap-2 cursor-pointer ${businessActiveTab === 'logs'
                                                    ? 'bg-[#1557D6] text-white shadow-xs'
                                                    : 'bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#334155]'
                                                }`}
                                        >
                                            <Activity size={16} />
                                            <span>Live Audit Stream ({retailerBusinessTxns.length})</span>
                                        </button>
                                    </div>

                                    {businessActiveTab === 'matrix' && (
                                        <div className="relative flex-1 max-w-sm">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#475569]" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Filter services (e.g. AEPS, DMT, BBPS)..."
                                                value={businessServiceSearch}
                                                onChange={(e) => setBusinessServiceSearch(e.target.value)}
                                                className="h-[46px] w-full bg-white border border-[#CBD5E1] focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 rounded-[10px] pl-10 pr-4 text-[13px] text-[#0F172A] placeholder:text-[#64748B] outline-none transition-all"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* ── TAB 1: EXACT 4-COLUMN SERVICES TABLE ── */}
                                {businessActiveTab === 'matrix' && (
                                    <div className="bg-white rounded-[14px] border border-black overflow-hidden shadow-xs">
                                        <div className="w-full overflow-x-auto">
                                            <table className="w-full border-collapse text-left min-w-[760px] border border-black">
                                                <thead>
                                                    <tr className="bg-[#F8FAFC] border-b border-black text-[13px] font-bold text-black">
                                                        <th className="px-6 py-4 text-left border-r border-black">Services</th>
                                                        <th className="px-6 py-4 text-center border-r border-black">Today's Transaction</th>
                                                        <th className="px-6 py-4 text-center border-r border-black">Yesterday Transaction</th>
                                                        <th className="px-6 py-4 text-center">Lifetime Transaction</th>
                                                    </tr>
                                                </thead>

                                                <tbody className="text-xs">
                                                    {loadingBusiness ? (
                                                        <tr>
                                                            <td colSpan={4} className="py-16 text-center border-b border-black">
                                                                <Loader2 className="animate-spin mx-auto text-[#2563EB]" size={30} />
                                                                <p className="text-[13px] text-[#64748B] mt-2.5 font-semibold">Aggregating live category transactions…</p>
                                                            </td>
                                                        </tr>
                                                    ) : filteredBusinessServices.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="py-14 text-center text-[#64748B] border-b border-black">
                                                                <p className="font-semibold text-sm">No services matching "{businessServiceSearch}"</p>
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
                                                                <tr key={srv.key} className="h-[64px] hover:bg-[#F8FAFC] transition-colors duration-150 border-b border-black">
                                                                    {/* Column 1: Services */}
                                                                    <td className="px-6 py-3 border-r border-black">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-xl shrink-0 shadow-xs ${srv.bgIcon || 'bg-slate-100'}`}>
                                                                                <span>{srv.icon}</span>
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-bold text-black text-[14px] leading-snug">
                                                                                    {srv.label}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </td>

                                                                    {/* Column 2: Today's Transaction */}
                                                                    <td className="px-6 py-3 text-center font-mono border-r border-black">
                                                                        <div className="flex items-center justify-center gap-2.5">
                                                                            <span className="font-bold text-[15px] text-black">
                                                                                {fmtWallet(stat.todayAmt)}
                                                                            </span>
                                                                            <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-[8px] bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                                                                                {stat.todayCount} {stat.todayCount === 1 ? 'Txn' : 'Txns'}
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    {/* Column 3: Yesterday Transaction */}
                                                                    <td className="px-6 py-3 text-center font-mono border-r border-black">
                                                                        <div className="flex items-center justify-center gap-2.5">
                                                                            <span className="font-bold text-[15px] text-black">
                                                                                {fmtWallet(stat.yesterdayAmt)}
                                                                            </span>
                                                                            <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-[8px] bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                                                                                {stat.yesterdayCount} {stat.yesterdayCount === 1 ? 'Txn' : 'Txns'}
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    {/* Column 4: Lifetime Transaction */}
                                                                    <td className="px-6 py-3 text-center font-mono">
                                                                        <div className="flex items-center justify-center gap-2.5">
                                                                            <span className="font-bold text-[15px] text-black">
                                                                                {fmtWallet(stat.lifetimeAmt)}
                                                                            </span>
                                                                            <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-[8px] bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]">
                                                                                {stat.lifetimeCount} {stat.lifetimeCount === 1 ? 'Txn' : 'Txns'}
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
                                                    <tr className="bg-[#F8FAFC] border-t-2 border-black font-bold text-black">
                                                        <td className="px-6 py-4 border-r border-black">
                                                            <div className="flex items-center gap-2.5">
                                                                <Award size={20} className="text-[#2563EB]" />
                                                                <div>
                                                                    <span className="text-[14px] block text-black font-bold">Grand Total Business</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-mono border-r border-black">
                                                            <div className="flex items-center justify-center gap-2.5">
                                                                <span className="text-[16px] font-[800] text-[#1D4ED8]">
                                                                    {fmtWallet(businessStats.totals.todayAmt)}
                                                                </span>
                                                                <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-[8px] bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                                                                    {businessStats.totals.todayCount} Total
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-mono border-r border-black">
                                                            <div className="flex items-center justify-center gap-2.5">
                                                                <span className="text-[16px] font-[800] text-[#047857]">
                                                                    {fmtWallet(businessStats.totals.yesterdayAmt)}
                                                                </span>
                                                                <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-[8px] bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                                                                    {businessStats.totals.yesterdayCount} Total
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-mono">
                                                            <div className="flex items-center justify-center gap-2.5">
                                                                <span className="text-[16px] font-[800] text-[#5B21B6]">
                                                                    {fmtWallet(businessStats.totals.lifetimeAmt)}
                                                                </span>
                                                                <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-[8px] bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE]">
                                                                    {businessStats.totals.lifetimeCount} Total
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ── TAB 2: LIVE AUDIT STREAM ── */}
                                {businessActiveTab === 'logs' && (
                                    <div className="bg-white rounded-[14px] border border-[#E2E8F0] overflow-hidden shadow-xs">
                                        <div className="w-full overflow-x-auto">
                                            <table className="w-full border-collapse text-left min-w-[700px]">
                                                <thead>
                                                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[12px] sm:text-[13px] font-bold text-[#1E3A5F] uppercase tracking-[0.3px]">
                                                        <th className="px-5 py-3.5">#</th>
                                                        <th className="px-5 py-3.5">Date & Time</th>
                                                        <th className="px-5 py-3.5">Service Domain</th>
                                                        <th className="px-5 py-3.5">Ref / Txn ID</th>
                                                        <th className="px-5 py-3.5 text-right">Amount (₹)</th>
                                                        <th className="px-5 py-3.5 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#F1F5F9] text-xs">
                                                    {retailerBusinessTxns.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="py-14 text-center text-[#64748B]">
                                                                <Activity size={28} className="mx-auto text-[#94A3B8] mb-2" />
                                                                <p className="font-semibold text-[13px]">No Individual Transaction Records Logged Yet For This Retailer.</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        retailerBusinessTxns.map((t, idx) => {
                                                            const sKey = categorizeTxn(t);
                                                            const srv = BUSINESS_SERVICES.find(s => s.key === sKey) || { label: 'Service', icon: '⚡', bgIcon: 'bg-slate-100' };
                                                            const rawAmt = t.amount ?? t.txnAmount ?? t.transactionAmount ?? 0;
                                                            const amt = parseFloat(String(rawAmt).replace(/,/g, '')) || 0;

                                                            return (
                                                                <tr key={t.id || idx} className="h-[60px] hover:bg-[#F8FAFC] transition-colors">
                                                                    <td className="px-5 py-3 text-[#64748B] font-medium">{idx + 1}</td>
                                                                    <td className="px-5 py-3 font-mono text-[12px] text-[#475569]">
                                                                        {fmtDateOnly(t.created_at || t.createdAt || t.date)} {fmtTime(t.created_at || t.createdAt || t.date)}
                                                                    </td>
                                                                    <td className="px-5 py-3 font-semibold text-[#0F172A]">
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#F1F5F9] text-[#0F172A] text-[12px]">
                                                                            <span>{srv.icon}</span> {srv.label}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-5 py-3 font-mono text-[12px] text-[#64748B]">
                                                                        {t.id || t.order_id || t.txnid || '—'}
                                                                    </td>
                                                                    <td className="px-5 py-3 text-right font-bold font-mono text-[14px] text-[#0F172A]">
                                                                        {fmtWallet(amt)}
                                                                    </td>
                                                                    <td className="px-5 py-3 text-center">
                                                                        <span className="inline-block text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#ECFDF3] text-[#047857] border border-[#A7F3D0]">
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
                                <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#E8EDF3] text-[#0F172A]">
                                    <div className="text-[13px] text-[#64748B] font-medium flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-[#059669]" />
                                        <span>256-Bit Encrypted Financial Ledger · Real-Time Network Sync</span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <button
                                            onClick={() => {
                                                const retailer = businessModalRetailer;
                                                setBusinessModalRetailer(null);
                                                setSelectedRetailer(retailer);
                                            }}
                                            className="px-4 py-2 rounded-[10px] border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#0F172A] text-[13px] font-medium transition-colors cursor-pointer"
                                        >
                                            View Full Profile
                                        </button>
                                        <button
                                            onClick={() => {
                                                const retailer = businessModalRetailer;
                                                setBusinessModalRetailer(null);
                                                handleEditRetailer(retailer);
                                            }}
                                            className="px-4 py-2 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold shadow-xs transition-colors cursor-pointer"
                                        >
                                            Edit Partner Details
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


