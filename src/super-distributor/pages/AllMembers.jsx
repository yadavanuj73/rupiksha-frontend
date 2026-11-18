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
    Calendar, Filter
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

    if (startDateStr && endDateStr) return dStr >= startDateStr && dStr <= endDateStr;
    if (startDateStr) return dStr >= startDateStr;
    if (endDateStr) return dStr <= endDateStr;
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
    if (raw.includes('AEPS 2') || raw.includes('AEPS_2') || raw.includes('AADHAAR_PAY') || raw.includes('AADHAAR PAY') || raw.includes('DEPOSIT')) return 'AEPS_2';
    if (raw.includes('AEPS') || raw.includes('CASH_WITHDRAWAL') || raw.includes('AEPS 1') || raw.includes('AEPS_1') || raw.includes('MINI_STATEMENT') || raw.includes('BALANCE')) return 'AEPS_1';
    if (raw.includes('DMT') || raw.includes('TRANSFER') || raw.includes('REMIT') || raw.includes('MONEY_TRANSFER')) return 'DMT';
    if (raw.includes('BBPS') || raw.includes('BILL') || raw.includes('ELECTRICITY') || raw.includes('GAS') || raw.includes('WATER') || raw.includes('FASTAG') || raw.includes('BHARAT')) return 'BBPS';
    if (raw.includes('RECHARGE') || raw.includes('MOBILE') || raw.includes('DTH') || raw.includes('TOPUP')) return 'RECHARGE';
    if (raw.includes('MATM') || raw.includes('MICRO_ATM') || raw.includes('MICRO ATM') || raw.includes('ATM')) return 'MATM';
    if (raw.includes('PAYOUT') || raw.includes('SETTLEMENT')) return 'PAYOUT';
    if (raw.includes('CMS') || raw.includes('CASH_MANAGEMENT') || raw.includes('COLLECTION')) return 'CMS';
    return 'OTHER';
};

const AllMembers = () => {
    const [members, setMembers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [selectedMember, setSelectedMember] = useState(null);
    const [editingMember, setEditingMember] = useState(null);
    const [superDist, setSuperDist] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addRole, setAddRole] = useState('RETAILER');
    const [showSuccess, setShowSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // Business Modal State
    const [businessModalMember, setBusinessModalMember] = useState(null);
    const [memberBusinessTxns, setMemberBusinessTxns] = useState([]);
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
                setMembers([]);
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
                ...(freshSuperDist.assignedRetailers || []),
                ...(freshSuperDist.assignedMembers || [])
            ].map(x => String(x || '').trim());
            const assignedSet = new Set(assignedList.map(x => x.toLowerCase()));

            // Also check pending network cache
            try {
                const pending = JSON.parse(localStorage.getItem('sa_pending_network') || '[]');
                pending.forEach(p => {
                    if (p.saId === sdId || p.saId === sdPartyCode || p.saId === sdMobile) {
                        if (p.mobile) assignedSet.add(String(p.mobile).toLowerCase());
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
                    let rRole = 'RETAILER';
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
                    return rRole === 'DISTRIBUTOR' || rRole === 'RETAILER' || rRole === 'RETAILERS';
                })
                .filter((u) => {
                    const uId = String(u.id || u._id || u.userId || '').trim().toLowerCase();
                    const uUsername = String(u.username || '').trim().toLowerCase();
                    const uMobile = String(u.mobile || u.phone || '').trim();
                    const uPartyCode = String(u.partyCode || u.userCode || '').trim().toUpperCase();

                    const uParentId = String(u.parentUserId || u.ownerId || u.addedByUserRef || u.parent_id || u.parentId || (u.parentUser && (u.parentUser.id || u.parentUser.userId)) || '').trim().toLowerCase();
                    const uParentPartyCode = String(u.parentPartyCode || u.addedByPartyCode || u.ownerPartyCode || (u.parentUser && u.parentUser.partyCode) || '').trim().toUpperCase();

                    if (assignedSet.has(uUsername) || (uMobile && assignedSet.has(uMobile.toLowerCase())) || (uPartyCode && assignedSet.has(uPartyCode.toLowerCase())) || (uId && assignedSet.has(uId))) {
                        return true;
                    }

                    if (sdId && (uParentId === sdId || uParentId.includes(sdId))) return true;
                    if (sdPartyCode && uParentPartyCode && (uParentPartyCode === sdPartyCode || uParentPartyCode.includes(sdPartyCode))) return true;
                    if (sdUsername && uParentId === sdUsername) return true;

                    return false;
                })
                .map((u, idx) => {
                    let rRole = 'RETAILER';
                    if (typeof u?.role === 'string' && u.role.trim()) {
                        rRole = u.role.trim().replace(/^ROLE_/i, '').toUpperCase();
                    } else if (Array.isArray(u?.roles) && u.roles.length > 0) {
                        for (const r of u.roles) {
                            if (typeof r === 'string' && r.trim()) {
                                rRole = r.trim().replace(/^ROLE_/i, '').toUpperCase();
                                break;
                            }
                        }
                    }
                    if (rRole !== 'DISTRIBUTOR') rRole = 'RETAILER';

                    let localAepsMap = {};
                    try { localAepsMap = JSON.parse(localStorage.getItem('rupiksha_last_aeps_map') || '{}'); } catch {}
                    const directAepsDate = u.lastAepsTxnDate || u.lastAepsDate || u.last_aeps_date || u.lastAeps || u.last_aeps || null;
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
                        id: u.id || u._id || u.userId || u.username || u.mobile || `mem-${idx}`,
                        fullName: u.fullName || u.name || (u.firstName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : (u.username || 'Member')),
                        username: u.username || u.mobile || `user_${idx}`,
                        mobile: u.mobile || u.phone || '—',
                        email: u.email || '—',
                        partyCode: u.partyCode || u.userCode || (rRole === 'DISTRIBUTOR' ? `RPDMH${70000 + idx}` : `RPRBR${70000 + idx}`),
                        role: rRole,
                        roles: [rRole],
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

            setMembers(assigned);
        } catch (err) {
            console.error('SuperDistributor AllMembers loadData error:', err);
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

    const handleRegistrationSuccess = () => {
        setShowAddModal(false);
        setShowSuccess(true);
        loadData();
    };

    // Edit Member Save
    const handleSaveEdit = (e) => {
        e.preventDefault();
        setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...editingMember } : m));
        showToast('Member details updated successfully');
        setEditingMember(null);
    };

    // Open See Business Modal & load member transactions
    const handleOpenBusinessModal = async (member) => {
        setBusinessModalMember(member);
        setLoadingBusiness(true);
        setMemberBusinessTxns([]);

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

            try {
                const userTxns = await dataService.getUserTransactions(member.id || member.userId);
                if (Array.isArray(userTxns)) txns.push(...userTxns);
            } catch (_) { }

            const localTxns = dataService.getData().transactions || [];
            txns.push(...localTxns);

            const memberPartyCode = member.partyCode && member.partyCode !== '—' ? String(member.partyCode).trim().toUpperCase() : null;
            const txnMap = new Map();

            txns.forEach(t => {
                if (!t) return;
                const tUser = String(t.user_id || t.userId || t.userName || t.user_name || t.partyCode || t.mobile || '').trim().toLowerCase();
                const tPartyCode = t.partyCode ? String(t.partyCode).trim().toUpperCase() : '';

                const isThisMember = (tUser && memberIds.has(tUser)) || (memberPartyCode && tPartyCode && tPartyCode === memberPartyCode);

                if (isThisMember) {
                    const idKey = t.id || t.order_id || t.txnid || `${t.amount}_${t.created_at || t.date}_${tUser}`;
                    if (!txnMap.has(idKey)) txnMap.set(idKey, t);
                }
            });

            const memberTxnList = Array.from(txnMap.values()).sort((a, b) => {
                const dA = new Date(a.created_at || a.date || 0);
                const dB = new Date(b.created_at || b.date || 0);
                return dB - dA;
            });

            setMemberBusinessTxns(memberTxnList);
        } catch (err) {
            console.error('Error loading member business:', err);
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

        memberBusinessTxns.forEach(t => {
            const cat = categorizeTxn(t);
            const amt = Math.abs(parseFloat(t.amount || t.txn_amount || t.txnAmount || 0)) || 0;
            const txnDate = t.created_at || t.date || t.createdAt;

            if (stats[cat]) {
                stats[cat].lifetimeAmt += amt;
                stats[cat].lifetimeCount += 1;
            }
            totalLifetimeAmt += amt;
            totalLifetimeCount += 1;

            if (isTodayDate(txnDate)) {
                if (stats[cat]) {
                    stats[cat].todayAmt += amt;
                    stats[cat].todayCount += 1;
                }
                totalTodayAmt += amt;
                totalTodayCount += 1;
            }

            if (isYesterdayDate(txnDate)) {
                if (stats[cat]) {
                    stats[cat].yesterdayAmt += amt;
                    stats[cat].yesterdayCount += 1;
                }
                totalYesterdayAmt += amt;
                totalYesterdayCount += 1;
            }

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
    }, [memberBusinessTxns, customStartDate, customEndDate]);

    // Filtered members
    const filtered = members.filter(m => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q || [m.fullName, m.name, m.username, m.mobile, m.email, m.partyCode, m.businessName]
            .some(v => v && String(v).toLowerCase().includes(q));
        const matchesStatus = statusFilter === 'ALL'
            || (statusFilter === 'ACTIVE' && (m.status === 'APPROVED' || m.status === 'ACTIVE'))
            || (statusFilter === 'KYC_APPROVED' && (m.kycStatus === 'APPROVED' || m.status === 'APPROVED'));
        const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
        return matchesSearch && matchesStatus && matchesRole;
    });

    const activeCount = members.filter(m => m.status === 'APPROVED' || m.status === 'ACTIVE').length;
    const distCount = members.filter(m => m.role === 'DISTRIBUTOR').length;
    const retCount = members.filter(m => m.role === 'RETAILER').length;
    const totalBalance = members.reduce((acc, curr) => acc + (parseFloat(curr.walletBalance) || 0), 0);

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

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {[
                    { label: 'Total Network', value: members.length, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
                    { label: 'Distributors', value: distCount, color: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600' },
                    { label: 'Retailers', value: retCount, color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
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

                <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0 flex-wrap">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">All Roles</option>
                        <option value="DISTRIBUTOR">Distributors</option>
                        <option value="RETAILER">Retailers</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active Partners</option>
                        <option value="KYC_APPROVED">KYC Approved</option>
                    </select>

                    <button
                        onClick={() => { setAddRole('RETAILER'); setShowAddModal(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 shrink-0"
                    >
                        <UserPlus size={14} /> Add Partner
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                CLEAN ALL MEMBERS NETWORK TABLE
            ══════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse text-left min-w-[960px]" style={{ tableLayout: 'auto' }}>
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-2.5 py-3 text-center border-r border-slate-200 w-10">#</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Name</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200">Role</th>
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
                                    <td colSpan={11} className="py-14 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-500" size={28} />
                                        <p className="text-xs text-slate-400 mt-2 font-semibold">Loading network members…</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-14 text-center">
                                        <Users size={32} className="text-slate-300 mx-auto" />
                                        <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-wider">No members found in network</p>
                                    </td>
                                </tr>
                            ) : filtered.map((member, idx) => {
                                const addr = [member.addressLine1, member.city, member.stateName].filter(Boolean).join(', ');
                                const isDist = member.role === 'DISTRIBUTOR';
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

                                        {/* Role */}
                                        <td className="px-3 py-3 text-center border-r border-slate-100">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                isDist ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                                {member.role}
                                            </span>
                                        </td>

                                        {/* Party Code */}
                                        <td className="px-3 py-3 border-r border-slate-100 text-[12px] font-bold text-slate-700 font-mono">
                                            {member.partyCode || '—'}
                                        </td>

                                        {/* Address */}
                                        <td className="px-3 py-3 border-r border-slate-100 text-slate-600 text-[11px] max-w-[200px] truncate" title={addr}>
                                            {addr || '—'}
                                        </td>

                                        {/* Mobile */}
                                        <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700 border-r border-slate-100">
                                            {member.mobile || '—'}
                                        </td>

                                        {/* Email */}
                                        <td className="px-3 py-3 text-slate-600 text-[11px] border-r border-slate-100 max-w-[160px] truncate" title={member.email}>
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
                                                    onClick={() => setSelectedMember(member)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                                                    title="View Profile Details"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingMember(member)}
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

            {/* ── ADD PARTNER MODAL ── */}
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
                                        Register Network Partner
                                    </h3>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                        Direct partner registration · Auto-approved under Super Distributor
                                    </p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 overflow-y-auto">
                                <NetworkRegistrationForm
                                    roleChoices={['RETAILER', 'DISTRIBUTOR']}
                                    uplineId={superDist?.id || superDist?.userId || superDist?.partyCode}
                                    uplineRole="SUPER_DISTRIBUTOR"
                                    onCancel={() => setShowAddModal(false)}
                                    onSuccess={handleRegistrationSuccess}
                                    submitLabel="Register Partner (Auto-Approved)"
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
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Partner Registered!</h2>
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
                {selectedMember && (
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
                                        {(selectedMember.fullName || selectedMember.username || 'M').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-800">{selectedMember.fullName}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-mono font-bold text-blue-600">{selectedMember.partyCode}</span>
                                            <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase">{selectedMember.role}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedMember(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mobile</span>
                                        <span className="font-mono font-bold text-slate-800">{selectedMember.mobile}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email</span>
                                        <span className="font-medium text-slate-800 truncate block">{selectedMember.email}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Wallet Balance</span>
                                        <span className="font-mono font-black text-slate-900">{fmtWallet(selectedMember.walletBalance)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Business Name</span>
                                        <span className="font-semibold text-slate-800">{selectedMember.businessName || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">City / State</span>
                                        <span className="font-semibold text-slate-800">{selectedMember.city || 'Siwan'}, {selectedMember.stateName || 'BIHAR'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            <CheckCircle2 size={12} /> {selectedMember.status}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Shop & Full Address</h4>
                                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 font-medium">
                                        {[selectedMember.addressLine1, selectedMember.city, selectedMember.stateName, selectedMember.pincode].filter(Boolean).join(', ') || 'No address registered'}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── EDIT DETAILS MODAL ── */}
            <AnimatePresence>
                {editingMember && (
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
                                <h3 className="text-base font-black text-slate-800">Edit Member Details</h3>
                                <button onClick={() => setEditingMember(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={22} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4 text-xs">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={editingMember.fullName || ''}
                                        onChange={(e) => setEditingMember({ ...editingMember, fullName: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mobile</label>
                                        <input
                                            type="text"
                                            value={editingMember.mobile || ''}
                                            onChange={(e) => setEditingMember({ ...editingMember, mobile: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={editingMember.email || ''}
                                            onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Address</label>
                                    <input
                                        type="text"
                                        value={editingMember.addressLine1 || ''}
                                        onChange={(e) => setEditingMember({ ...editingMember, addressLine1: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setEditingMember(null)}
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

            {/* ── SEE BUSINESS MODAL ── */}
            <AnimatePresence>
                {businessModalMember && (
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
                            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
                                        <TrendingUp size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                            {businessModalMember.fullName}
                                            <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                                                {businessModalMember.partyCode}
                                            </span>
                                            <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md uppercase">
                                                {businessModalMember.role}
                                            </span>
                                        </h3>
                                        <p className="text-[10px] font-semibold text-slate-400">
                                            Category-wise Business Turnover & Analytics · Float: {fmtWallet(businessModalMember.walletBalance)}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setBusinessModalMember(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                {loadingBusiness ? (
                                    <div className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-500" size={32} />
                                        <p className="text-xs text-slate-400 mt-2 font-bold">Calculating business analytics…</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
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
                                                    {BUSINESS_SERVICES.map((srv) => {
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
                                                </tbody>
                                            </table>
                                        </div>
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

export default AllMembers;
