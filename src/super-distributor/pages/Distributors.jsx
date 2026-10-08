import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, Download, UserPlus, ShieldCheck,
    CheckCircle2, AlertCircle, Clock, X, Eye, Wallet,
    Smartphone, Mail, MapPin, Zap, Package, Edit3, Trash2,
    Lock, Save, Loader2, Image as ImageIcon, TrendingUp,
    BarChart3, RefreshCw, IndianRupee, Layers, Check,
    Building2, Landmark, Coins, ArrowUpRight, Award, Shield,
    FileSpreadsheet, Activity, ChevronRight, Copy, CheckCheck, FileText,
    Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { dataService, BACKEND_URL } from '../../services/dataService';
import { transactionService } from '../../services/apiService';
import { sharedDataService } from '../../services/sharedDataService';
import NetworkRegistrationForm from '../../components/shared/NetworkRegistrationForm';

const getToken = () => localStorage.getItem('rupiksha_token') || localStorage.getItem('rupiksha_super_distributor_token') || localStorage.getItem('rupiksha_admin_token');

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

const getStartOfMonthStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
};

const getTodayDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const isWithinDateRange = (d, startDateStr, endDateStr) => {
    if (!d) return false;
    if (!startDateStr && !endDateStr) return false;
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return false;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dStr = `${year}-${month}-${day}`;

    if (startDateStr && endDateStr) {
        return dStr >= startDateStr && dStr <= endDateStr;
    }
    if (startDateStr) {
        return dStr >= startDateStr;
    }
    if (endDateStr) {
        return dStr <= endDateStr;
    }
    return false;
};

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

const Distributors = () => {
    const [distributors, setDistributors] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedDistributor, setSelectedDistributor] = useState(null);
    const [editingDistributor, setEditingDistributor] = useState(null);
    const [superDist, setSuperDist] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // Business Modal State
    const [businessModalDistributor, setBusinessModalDistributor] = useState(null);
    const [distributorBusinessTxns, setDistributorBusinessTxns] = useState([]);
    const [loadingBusiness, setLoadingBusiness] = useState(false);
    const [businessActiveTab, setBusinessActiveTab] = useState('matrix');
    const [businessServiceSearch, setBusinessServiceSearch] = useState('');
    const [customStartDate, setCustomStartDate] = useState(getStartOfMonthStr);
    const [customEndDate, setCustomEndDate] = useState(getTodayDateStr);

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
        try {
            const session = sharedDataService.getCurrentSuperDistributor() || dataService.getCurrentUser();
            if (!session) {
                setDistributors([]);
                return;
            }
            const freshSuperDist = (session.id && sharedDataService.getSuperDistributorById(session.id)) || session;
            setSuperDist(freshSuperDist);

            const sdId = String(freshSuperDist.id || freshSuperDist._id || freshSuperDist.userId || '').trim().toLowerCase();
            const sdPartyCode = String(freshSuperDist.partyCode || freshSuperDist.userCode || '').trim().toUpperCase();
            const sdMobile = String(freshSuperDist.mobile || freshSuperDist.phone || '').trim();
            const sdUsername = String(freshSuperDist.username || '').trim().toLowerCase();

            const assignedList = [
                ...(freshSuperDist.assignedDistributors || []),
                ...(freshSuperDist.assignedMembers || [])
            ].map(x => String(x || '').trim());
            const assignedSet = new Set(assignedList.map(x => x.toLowerCase()));

            // Also check pending network cache
            try {
                const pending = JSON.parse(localStorage.getItem('sa_pending_network') || '[]');
                pending.forEach(p => {
                    if (p.saId === sdId || p.saId === sdPartyCode || p.saId === sdMobile) {
                        if (p.role === 'DISTRIBUTOR' && p.mobile) assignedSet.add(String(p.mobile).toLowerCase());
                    }
                });
            } catch {}

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
            try {
                if (cachedUsersRaw) cachedUsers = JSON.parse(cachedUsersRaw);
            } catch { }

            const userMap = new Map();
            [...allUsers, ...localUsers, ...cachedUsers].forEach((u) => {
                if (!u) return;
                const key = String(u.id || u._id || u.userId || u.username || u.mobile || u.partyCode || '');
                if (key && !userMap.has(key)) {
                    userMap.set(key, u);
                }
            });

            const combinedList = Array.from(userMap.values());

            const assigned = combinedList
                .filter((u) => {
                    let rRole = 'DISTRIBUTOR';
                    if (typeof u?.role === 'string' && u.role.trim()) {
                        rRole = u.role.trim().replace(/^ROLE_/i, '').toUpperCase();
                    } else if (Array.isArray(u?.roles) && u.roles.length > 0) {
                        for (const r of u.roles) {
                            if (typeof r === 'string' && r.trim()) {
                                rRole = r.trim().replace(/^ROLE_/i, '').toUpperCase();
                                break;
                            }
                            if (r && typeof r === 'object' && r.name) {
                                rRole = String(r.name).trim().replace(/^ROLE_/i, '').toUpperCase();
                                break;
                            }
                        }
                    }
                    return rRole === 'DISTRIBUTOR' || rRole === 'DISTRIBUTORS';
                })
                .filter((d) => {
                    const dId = String(d.id || d._id || d.userId || '').trim().toLowerCase();
                    const dUsername = String(d.username || '').trim().toLowerCase();
                    const dMobile = String(d.mobile || d.phone || '').trim();
                    const dPartyCode = String(d.partyCode || d.userCode || '').trim().toUpperCase();

                    const dParentId = String(d.parentUserId || d.ownerId || d.addedByUserRef || d.parent_id || d.parentId || (d.parentUser && (d.parentUser.id || d.parentUser.userId)) || '').trim().toLowerCase();
                    const dParentPartyCode = String(d.parentPartyCode || d.addedByPartyCode || d.ownerPartyCode || (d.parentUser && d.parentUser.partyCode) || '').trim().toUpperCase();

                    // Direct assignment list check
                    if (assignedSet.has(dUsername) || (dMobile && assignedSet.has(dMobile.toLowerCase())) || (dPartyCode && assignedSet.has(dPartyCode.toLowerCase())) || (dId && assignedSet.has(dId))) {
                        return true;
                    }

                    // Strict ID link check
                    if (sdId && (dParentId === sdId || dParentId.includes(sdId))) {
                        return true;
                    }

                    // Strict Party Code link check
                    if (sdPartyCode && dParentPartyCode && (dParentPartyCode === sdPartyCode || dParentPartyCode.includes(sdPartyCode))) {
                        return true;
                    }

                    // Strict Username link check
                    if (sdUsername && dParentId === sdUsername) {
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
                        id: u.id || u._id || u.userId || u.username || u.mobile || `dist-${idx}`,
                        fullName: u.fullName || u.name || (u.firstName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : (u.username || 'Distributor')),
                        username: u.username || u.mobile || `user_${idx}`,
                        mobile: u.mobile || u.phone || '—',
                        email: u.email || '—',
                        partyCode: u.partyCode || u.userCode || `RPDMH${70000 + idx}`,
                        role: 'DISTRIBUTOR',
                        roles: ['DISTRIBUTOR'],
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

            setDistributors(assigned);
        } catch (err) {
            console.error('SuperDistributor Distributors loadData error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const handleUpdate = () => { loadData(); };
        window.addEventListener('SuperDistributorDataUpdated', handleUpdate);
        window.addEventListener('distributorDataUpdated', handleUpdate);
        window.addEventListener('dataUpdated', handleUpdate);
        window.addEventListener('membersUpdated', handleUpdate);
        return () => {
            window.removeEventListener('SuperDistributorDataUpdated', handleUpdate);
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

    // Edit Member Save
    const handleSaveEdit = (e) => {
        e.preventDefault();
        setDistributors(prev => prev.map(d => d.id === editingDistributor.id ? { ...d, ...editingDistributor } : d));
        showToast('Distributor details updated successfully');
        setEditingDistributor(null);
    };

    // Open See Business Modal & load distributor transactions
    const handleOpenBusinessModal = async (member) => {
        setBusinessModalDistributor(member);
        setLoadingBusiness(true);
        setDistributorBusinessTxns([]);

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

            // Deduplicate & filter strictly to this distributor
            const memberPartyCode = member.partyCode && member.partyCode !== '—' ? String(member.partyCode).trim().toUpperCase() : null;
            const txnMap = new Map();

            txns.forEach(t => {
                if (!t) return;
                const tUser = String(t.user_id || t.userId || t.userName || t.user_name || t.partyCode || t.mobile || '').trim().toLowerCase();
                const tPartyCode = t.partyCode ? String(t.partyCode).trim().toUpperCase() : '';

                const isThisDistributor = (tUser && memberIds.has(tUser)) || (memberPartyCode && tPartyCode && tPartyCode === memberPartyCode);

                if (isThisDistributor) {
                    const idKey = t.id || t.order_id || t.txnid || `${t.amount}_${t.created_at || t.date}_${tUser}`;
                    if (!txnMap.has(idKey)) txnMap.set(idKey, t);
                }
            });

            const memberTxnList = Array.from(txnMap.values()).sort((a, b) => {
                const dA = new Date(a.created_at || a.date || 0);
                const dB = new Date(b.created_at || b.date || 0);
                return dB - dA;
            });

            setDistributorBusinessTxns(memberTxnList);
        } catch (err) {
            console.error('Error loading distributor business:', err);
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
                lifetimeCount: 0,
                customAmt: 0,
                customCount: 0
            };
        });

        let totalTodayAmt = 0;
        let totalTodayCount = 0;
        let totalYesterdayAmt = 0;
        let totalYesterdayCount = 0;
        let totalLifetimeAmt = 0;
        let totalLifetimeCount = 0;
        let totalCustomAmt = 0;
        let totalCustomCount = 0;

        distributorBusinessTxns.forEach(t => {
            const cat = categorizeTxn(t);
            const amt = Math.abs(parseFloat(t.amount || t.txn_amount || t.txnAmount || 0)) || 0;
            const txnDate = t.created_at || t.date || t.createdAt;

            // Lifetime
            if (stats[cat]) {
                stats[cat].lifetimeAmt += amt;
                stats[cat].lifetimeCount += 1;
            }
            totalLifetimeAmt += amt;
            totalLifetimeCount += 1;

            // Today
            if (isTodayDate(txnDate)) {
                if (stats[cat]) {
                    stats[cat].todayAmt += amt;
                    stats[cat].todayCount += 1;
                }
                totalTodayAmt += amt;
                totalTodayCount += 1;
            }

            // Yesterday
            if (isYesterdayDate(txnDate)) {
                if (stats[cat]) {
                    stats[cat].yesterdayAmt += amt;
                    stats[cat].yesterdayCount += 1;
                }
                totalYesterdayAmt += amt;
                totalYesterdayCount += 1;
            }

            // Custom Range Filter
            if (isWithinDateRange(txnDate, customStartDate, customEndDate)) {
                if (stats[cat]) {
                    stats[cat].customAmt += amt;
                    stats[cat].customCount += 1;
                }
                totalCustomAmt += amt;
                totalCustomCount += 1;
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
                lifetimeCount: totalLifetimeCount,
                customAmt: totalCustomAmt,
                customCount: totalCustomCount
            }
        };
    }, [distributorBusinessTxns, customStartDate, customEndDate]);

    // Export Category-wise Business Matrix to Excel
    const handleExportBusinessExcel = () => {
        if (!businessModalDistributor) return;
        try {
            const dateRangeLabel = (customStartDate || customEndDate)
                ? `${customStartDate || 'Start'} to ${customEndDate || 'End'}`
                : 'Selected Date';

            const rows = BUSINESS_SERVICES.map(srv => {
                const stat = businessStats.byService[srv.key] || { todayAmt: 0, todayCount: 0, yesterdayAmt: 0, yesterdayCount: 0, lifetimeAmt: 0, lifetimeCount: 0, customAmt: 0, customCount: 0 };
                return {
                    "Service Name": srv.label,
                    "Today's Volume (₹)": stat.todayAmt,
                    "Today Txn Count": stat.todayCount,
                    "Yesterday's Volume (₹)": stat.yesterdayAmt,
                    "Yesterday Txn Count": stat.yesterdayCount,
                    "Lifetime Volume (₹)": stat.lifetimeAmt,
                    "Lifetime Txn Count": stat.lifetimeCount,
                    [`Selected Date (${dateRangeLabel}) Volume (₹)`]: stat.customAmt,
                    [`Selected Date (${dateRangeLabel}) Txn Count`]: stat.customCount
                };
            });

            // Summary row
            rows.push({
                "Service Name": "GRAND TOTAL BUSINESS",
                "Today's Volume (₹)": businessStats.totals.todayAmt,
                "Today Txn Count": businessStats.totals.todayCount,
                "Yesterday's Volume (₹)": businessStats.totals.yesterdayAmt,
                "Yesterday Txn Count": businessStats.totals.yesterdayCount,
                "Lifetime Volume (₹)": businessStats.totals.lifetimeAmt,
                "Lifetime Txn Count": businessStats.totals.lifetimeCount,
                [`Selected Date (${dateRangeLabel}) Volume (₹)`]: businessStats.totals.customAmt,
                [`Selected Date (${dateRangeLabel}) Txn Count`]: businessStats.totals.customCount
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Business_Analytics");
            const fileName = `Rupiksha_Business_${businessModalDistributor.partyCode || businessModalDistributor.username}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            showToast('Business report downloaded successfully');
        } catch (err) {
            console.error('Failed to export Excel:', err);
            showToast('Failed to export report', 'error');
        }
    };

    // Export Category-wise Business Matrix to PDF
    const handleExportBusinessPDF = () => {
        if (!businessModalDistributor) return;
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const fmtPDF = (v) => {
                const n = parseFloat(String(v || 0).replace(/,/g, ''));
                return isNaN(n) ? 'Rs. 0.00' : 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };

            // 1. Top Brand Header
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 24, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.text('Rupiksha Services Private Limited', 14, 10.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(203, 213, 225);
            doc.text('DISTRIBUTOR BUSINESS PERFORMANCE & TURNOVER REPORT (SUPER DISTRIBUTOR PORTAL)', 14, 16);
            doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 21);

            // 2. Partner Info Card Box
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.roundedRect(12, 28, pageWidth - 24, 20, 2.5, 2.5, 'FD');

            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11.5);
            doc.text(businessModalDistributor.fullName || 'Distributor Partner', 16, 34.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            doc.text(`Party Code: ${businessModalDistributor.partyCode || '—'}    |    Mobile: ${businessModalDistributor.mobile || '—'}    |    Float: ${fmtPDF(businessModalDistributor.walletBalance)}`, 16, 40);
            doc.text(`Location: ${businessModalDistributor.city || 'Siwan'}, ${businessModalDistributor.stateName || 'BIHAR'}    |    Status: Active Network Partner`, 16, 45);

            // 3. KPI Turnover Boxes
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

            // 4. Matrix Table
            const tableX = 12;
            const tableWidth = pageWidth - 24;
            const col1X = tableX;
            const col2X = tableX + 46;
            const col3X = col2X + 35;
            const col4X = col3X + 35;
            const col5X = col4X + 35;

            const col2Center = col2X + 17.5;
            const col3Center = col3X + 17.5;
            const col4Center = col4X + 17.5;
            const col5Center = col5X + 17.5;

            const tableTopY = 76;
            const headerHeight = 8;
            const rowHeight = 9.2;
            let currentY = tableTopY;

            doc.setFillColor(241, 245, 249);
            doc.rect(tableX, currentY, tableWidth, headerHeight, 'F');

            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('Services', col1X + 3, currentY + 5.2);
            doc.text("Today's Txn", col2Center, currentY + 5.2, { align: 'center' });
            doc.text("Yesterday Txn", col3Center, currentY + 5.2, { align: 'center' });
            doc.text("Lifetime Txn", col4Center, currentY + 5.2, { align: 'center' });
            doc.text("Select Date", col5Center, currentY + 5.2, { align: 'center' });

            currentY += headerHeight;

            BUSINESS_SERVICES.forEach((srv, idx) => {
                const stat = businessStats.byService[srv.key] || { todayAmt: 0, todayCount: 0, yesterdayAmt: 0, yesterdayCount: 0, lifetimeAmt: 0, lifetimeCount: 0, customAmt: 0, customCount: 0 };
                if (idx % 2 === 1) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(tableX, currentY, tableWidth, rowHeight, 'F');
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(15, 23, 42);
                doc.text(srv.label, col1X + 3, currentY + 5.2);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(30, 41, 59);

                doc.text(`${fmtPDF(stat.todayAmt)} (${stat.todayCount})`, col2Center, currentY + 5.2, { align: 'center' });
                doc.text(`${fmtPDF(stat.yesterdayAmt)} (${stat.yesterdayCount})`, col3Center, currentY + 5.2, { align: 'center' });
                doc.text(`${fmtPDF(stat.lifetimeAmt)} (${stat.lifetimeCount})`, col4Center, currentY + 5.2, { align: 'center' });
                doc.text(`${fmtPDF(stat.customAmt)} (${stat.customCount})`, col5Center, currentY + 5.2, { align: 'center' });

                currentY += rowHeight;
            });

            // Grand Total Row
            doc.setFillColor(224, 231, 255);
            doc.rect(tableX, currentY, tableWidth, rowHeight + 1, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text('GRAND TOTAL', col1X + 3, currentY + 6);

            doc.text(`${fmtPDF(businessStats.totals.todayAmt)} (${businessStats.totals.todayCount})`, col2Center, currentY + 6, { align: 'center' });
            doc.text(`${fmtPDF(businessStats.totals.yesterdayAmt)} (${businessStats.totals.yesterdayCount})`, col3Center, currentY + 6, { align: 'center' });
            doc.text(`${fmtPDF(businessStats.totals.lifetimeAmt)} (${businessStats.totals.lifetimeCount})`, col4Center, currentY + 6, { align: 'center' });
            doc.text(`${fmtPDF(businessStats.totals.customAmt)} (${businessStats.totals.customCount})`, col5Center, currentY + 6, { align: 'center' });

            const fileName = `Rupiksha_Business_${businessModalDistributor.partyCode || businessModalDistributor.username}_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(fileName);
            showToast('PDF summary downloaded successfully');
        } catch (err) {
            console.error('Failed to export PDF:', err);
            showToast('Failed to export PDF', 'error');
        }
    };

    // Filtered business services
    const filteredBusinessServices = useMemo(() => {
        const q = businessServiceSearch.trim().toLowerCase();
        if (!q) return BUSINESS_SERVICES;
        return BUSINESS_SERVICES.filter(s =>
            s.label.toLowerCase().includes(q) ||
            s.key.toLowerCase().includes(q)
        );
    }, [businessServiceSearch]);

    // Delete Member
    const handleDeleteDistributor = (member) => {
        if (!window.confirm(`Are you sure you want to remove distributor ${member.fullName} from your network?`)) return;
        setDistributors(prev => prev.filter(d => d.id !== member.id));
        showToast(`Distributor ${member.fullName} removed successfully`);
    };

    // Filtered members
    const filtered = distributors.filter(d => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q || [d.fullName, d.name, d.username, d.mobile, d.email, d.partyCode, d.businessName]
            .some(v => v && String(v).toLowerCase().includes(q));
        const matchesStatus = statusFilter === 'ALL'
            || (statusFilter === 'ACTIVE' && (d.status === 'APPROVED' || d.status === 'ACTIVE'))
            || (statusFilter === 'KYC_APPROVED' && (d.kycStatus === 'APPROVED' || d.status === 'APPROVED'));
        return matchesSearch && matchesStatus;
    });

    const activeCount = distributors.filter(d => d.status === 'APPROVED' || d.status === 'ACTIVE').length;
    const kycCount = distributors.filter(d => d.kycStatus === 'APPROVED' || d.status === 'APPROVED').length;
    const totalBalance = distributors.reduce((acc, curr) => acc + (parseFloat(curr.walletBalance) || 0), 0);

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

            {/* ── Summary Cards (Matching Screenshot 1 Style) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {[
                    { label: 'Total Distributors', value: distributors.length, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
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
                        <option value="ALL">All Distributors</option>
                        <option value="ACTIVE">Active Partners</option>
                        <option value="KYC_APPROVED">KYC Approved</option>
                    </select>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 shrink-0"
                    >
                        <UserPlus size={14} /> Add New Distributor
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                CLEAN DISTRIBUTOR NETWORK TABLE
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
                                        <p className="text-xs text-slate-400 mt-2 font-semibold">Loading distributors…</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-14 text-center">
                                        <Users size={32} className="text-slate-300 mx-auto" />
                                        <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-wider">No distributors found in network</p>
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
                                                    onClick={() => setSelectedDistributor(member)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                                                    title="View Profile Details"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingDistributor(member)}
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

            {/* ── ADD DISTRIBUTOR MODAL ── */}
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
                                        Register Distributor Partner
                                    </h3>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                        Direct distributor registration · Auto-approved under Super Distributor
                                    </p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 overflow-y-auto">
                                <NetworkRegistrationForm
                                    roleLock="DISTRIBUTOR"
                                    uplineId={superDist?.id || superDist?.userId || superDist?.partyCode}
                                    uplineRole="SUPER_DISTRIBUTOR"
                                    onCancel={() => setShowAddModal(false)}
                                    onSuccess={handleRegistrationSuccess}
                                    submitLabel="Register Distributor (Auto-Approved)"
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
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Distributor Registered!</h2>
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
                {selectedDistributor && (
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
                                        {(selectedDistributor.fullName || selectedDistributor.username || 'D').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-800">{selectedDistributor.fullName}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-mono font-bold text-blue-600">{selectedDistributor.partyCode}</span>
                                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Active Distributor</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedDistributor(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mobile</span>
                                        <span className="font-mono font-bold text-slate-800">{selectedDistributor.mobile}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email</span>
                                        <span className="font-medium text-slate-800 truncate block">{selectedDistributor.email}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Wallet Balance</span>
                                        <span className="font-mono font-black text-slate-900">{fmtWallet(selectedDistributor.walletBalance)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Business Name</span>
                                        <span className="font-semibold text-slate-800">{selectedDistributor.businessName || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">City / State</span>
                                        <span className="font-semibold text-slate-800">{selectedDistributor.city || 'Siwan'}, {selectedDistributor.stateName || 'BIHAR'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            <CheckCircle2 size={12} /> {selectedDistributor.status}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Shop & Full Address</h4>
                                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 font-medium">
                                        {[selectedDistributor.addressLine1, selectedDistributor.city, selectedDistributor.stateName, selectedDistributor.pincode].filter(Boolean).join(', ') || 'No address registered'}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── EDIT DETAILS MODAL ── */}
            <AnimatePresence>
                {editingDistributor && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-base font-black text-slate-800">Edit Distributor Details</h3>
                                <button onClick={() => setEditingDistributor(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={22} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4 text-xs">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={editingDistributor.fullName || ''}
                                        onChange={(e) => setEditingDistributor({ ...editingDistributor, fullName: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mobile</label>
                                        <input
                                            type="text"
                                            value={editingDistributor.mobile || ''}
                                            onChange={(e) => setEditingDistributor({ ...editingDistributor, mobile: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={editingDistributor.email || ''}
                                            onChange={(e) => setEditingDistributor({ ...editingDistributor, email: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Address</label>
                                    <input
                                        type="text"
                                        value={editingDistributor.addressLine1 || ''}
                                        onChange={(e) => setEditingDistributor({ ...editingDistributor, addressLine1: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setEditingDistributor(null)}
                                        className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══════════════════════════════════════════
                SEE BUSINESS MODAL (FULL RICH TURNOVER)
            ══════════════════════════════════════════ */}
            <AnimatePresence>
                {businessModalDistributor && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col font-['Inter',sans-serif]"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
                                        <TrendingUp size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                            {businessModalDistributor.fullName}
                                            <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                                                {businessModalDistributor.partyCode}
                                            </span>
                                        </h3>
                                        <p className="text-[10px] font-semibold text-slate-400">
                                            Category-wise Business Turnover & Analytics · Float: {fmtWallet(businessModalDistributor.walletBalance)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleExportBusinessExcel}
                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200"
                                        title="Export Matrix to Excel"
                                    >
                                        <FileSpreadsheet size={13} /> Excel
                                    </button>
                                    <button
                                        onClick={handleExportBusinessPDF}
                                        className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-200"
                                        title="Export Matrix to PDF"
                                    >
                                        <Download size={13} /> PDF
                                    </button>
                                    <button
                                        onClick={() => setBusinessModalDistributor(null)}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Date Filter & Tabs */}
                            <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setBusinessActiveTab('matrix')}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            businessActiveTab === 'matrix'
                                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Service Business Matrix
                                    </button>
                                    <button
                                        onClick={() => setBusinessActiveTab('logs')}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            businessActiveTab === 'logs'
                                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Live Transaction Logs ({distributorBusinessTxns.length})
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-400">Date Range:</span>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                                    />
                                    <span className="text-slate-400 text-xs">to</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto flex-1">
                                {loadingBusiness ? (
                                    <div className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-500" size={32} />
                                        <p className="text-xs text-slate-400 mt-2 font-bold">Calculating business analytics…</p>
                                    </div>
                                ) : businessActiveTab === 'matrix' ? (
                                    <div className="space-y-4">
                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 text-center">
                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Today Turnover</p>
                                                <p className="text-lg font-black text-blue-900 mt-0.5">{fmtWallet(businessStats.totals.todayAmt)}</p>
                                                <p className="text-[10px] font-semibold text-blue-500 mt-0.5">{businessStats.totals.todayCount} Txns</p>
                                            </div>
                                            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 text-center">
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Yesterday Turnover</p>
                                                <p className="text-lg font-black text-emerald-900 mt-0.5">{fmtWallet(businessStats.totals.yesterdayAmt)}</p>
                                                <p className="text-[10px] font-semibold text-emerald-500 mt-0.5">{businessStats.totals.yesterdayCount} Txns</p>
                                            </div>
                                            <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-3 text-center">
                                                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Selected Range</p>
                                                <p className="text-lg font-black text-purple-900 mt-0.5">{fmtWallet(businessStats.totals.customAmt)}</p>
                                                <p className="text-[10px] font-semibold text-purple-500 mt-0.5">{businessStats.totals.customCount} Txns</p>
                                            </div>
                                            <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3 text-center">
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Lifetime Volume</p>
                                                <p className="text-lg font-black text-amber-900 mt-0.5">{fmtWallet(businessStats.totals.lifetimeAmt)}</p>
                                                <p className="text-[10px] font-semibold text-amber-500 mt-0.5">{businessStats.totals.lifetimeCount} Txns</p>
                                            </div>
                                        </div>

                                        {/* Matrix Table */}
                                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                                        <th className="px-4 py-3 border-r border-slate-200">Services</th>
                                                        <th className="px-3 py-3 text-center border-r border-slate-200">Today's Txn</th>
                                                        <th className="px-3 py-3 text-center border-r border-slate-200">Yesterday Txn</th>
                                                        <th className="px-3 py-3 text-center border-r border-slate-200">Lifetime Txn</th>
                                                        <th className="px-3 py-3 text-center">Select Date Range</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-medium">
                                                    {filteredBusinessServices.map((srv) => {
                                                        const stat = businessStats.byService[srv.key] || { todayAmt: 0, todayCount: 0, yesterdayAmt: 0, yesterdayCount: 0, lifetimeAmt: 0, lifetimeCount: 0, customAmt: 0, customCount: 0 };
                                                        return (
                                                            <tr key={srv.key} className="hover:bg-slate-50/60">
                                                                <td className="px-4 py-2.5 font-bold text-slate-800 border-r border-slate-100 flex items-center gap-2">
                                                                    <span className="text-base">{srv.icon}</span>
                                                                    <span>{srv.label}</span>
                                                                </td>
                                                                <td className="px-3 py-2.5 text-center border-r border-slate-100 font-mono">
                                                                    <div className="font-bold text-slate-800">{fmtWallet(stat.todayAmt)}</div>
                                                                    <div className="text-[10px] text-slate-400">({stat.todayCount} txns)</div>
                                                                </td>
                                                                <td className="px-3 py-2.5 text-center border-r border-slate-100 font-mono">
                                                                    <div className="font-bold text-slate-800">{fmtWallet(stat.yesterdayAmt)}</div>
                                                                    <div className="text-[10px] text-slate-400">({stat.yesterdayCount} txns)</div>
                                                                </td>
                                                                <td className="px-3 py-2.5 text-center border-r border-slate-100 font-mono">
                                                                    <div className="font-bold text-slate-800">{fmtWallet(stat.lifetimeAmt)}</div>
                                                                    <div className="text-[10px] text-slate-400">({stat.lifetimeCount} txns)</div>
                                                                </td>
                                                                <td className="px-3 py-2.5 text-center font-mono">
                                                                    <div className="font-bold text-slate-800">{fmtWallet(stat.customAmt)}</div>
                                                                    <div className="text-[10px] text-slate-400">({stat.customCount} txns)</div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Grand Total */}
                                                    <tr className="bg-slate-100/70 font-black border-t-2 border-slate-200">
                                                        <td className="px-4 py-3 text-slate-900 uppercase border-r border-slate-200">Grand Total</td>
                                                        <td className="px-3 py-3 text-center border-r border-slate-200 font-mono text-blue-700">
                                                            <div>{fmtWallet(businessStats.totals.todayAmt)}</div>
                                                            <div className="text-[10px] text-slate-500">({businessStats.totals.todayCount} txns)</div>
                                                        </td>
                                                        <td className="px-3 py-3 text-center border-r border-slate-200 font-mono text-emerald-700">
                                                            <div>{fmtWallet(businessStats.totals.yesterdayAmt)}</div>
                                                            <div className="text-[10px] text-slate-500">({businessStats.totals.yesterdayCount} txns)</div>
                                                        </td>
                                                        <td className="px-3 py-3 text-center border-r border-slate-200 font-mono text-amber-700">
                                                            <div>{fmtWallet(businessStats.totals.lifetimeAmt)}</div>
                                                            <div className="text-[10px] text-slate-500">({businessStats.totals.lifetimeCount} txns)</div>
                                                        </td>
                                                        <td className="px-3 py-3 text-center font-mono text-purple-700">
                                                            <div>{fmtWallet(businessStats.totals.customAmt)}</div>
                                                            <div className="text-[10px] text-slate-500">({businessStats.totals.customCount} txns)</div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {distributorBusinessTxns.length === 0 ? (
                                            <div className="py-16 text-center text-slate-400 font-semibold">
                                                No live transactions found for this distributor yet.
                                            </div>
                                        ) : (
                                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                                            <th className="px-3 py-3 border-r border-slate-200">#</th>
                                                            <th className="px-3 py-3 border-r border-slate-200">Txn / Order ID</th>
                                                            <th className="px-3 py-3 border-r border-slate-200">Service</th>
                                                            <th className="px-3 py-3 text-right border-r border-slate-200">Amount</th>
                                                            <th className="px-3 py-3 text-center border-r border-slate-200">Status</th>
                                                            <th className="px-3 py-3 text-center">Date & Time</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-medium">
                                                        {distributorBusinessTxns.map((t, i) => (
                                                            <tr key={t.id || i} className="hover:bg-slate-50">
                                                                <td className="px-3 py-2 text-slate-400 font-semibold border-r border-slate-100">{i + 1}</td>
                                                                <td className="px-3 py-2 font-mono font-bold text-slate-700 border-r border-slate-100">{t.order_id || t.id || t.txnid || '—'}</td>
                                                                <td className="px-3 py-2 font-bold text-slate-800 border-r border-slate-100">{t.service_type || t.type || 'AEPS'}</td>
                                                                <td className="px-3 py-2 text-right font-mono font-black text-slate-900 border-r border-slate-100">{fmtWallet(t.amount)}</td>
                                                                <td className="px-3 py-2 text-center border-r border-slate-100">
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                                                        {t.status || 'SUCCESS'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center text-slate-500 font-mono text-[11px]">
                                                                    {fmtDateOnly(t.created_at || t.date)} {fmtTime(t.created_at || t.date)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Distributors;
