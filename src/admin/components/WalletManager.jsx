import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import dataService from '../../services/dataService';
import {
    Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2,
    Lock, Unlock, Snowflake, RotateCcw, BookOpen, IndianRupee,
    FileSpreadsheet, History, AlertTriangle
} from 'lucide-react';

import { Toast, fetchAPI, fmtINR } from './wallet/walletShared';
import WalletOverviewTab from './wallet/WalletOverviewTab';
import CreditFundTab from './wallet/CreditFundTab';
import DebitFundTab from './wallet/DebitFundTab';
import PendingFundRequestsTab from './wallet/PendingFundRequestsTab';
import FundRequestHistoryTab from './wallet/FundRequestHistoryTab';
import LockAmountTab from './wallet/LockAmountTab';
import ReleaseLockTab from './wallet/ReleaseLockTab';
import FreezeWalletTab from './wallet/FreezeWalletTab';
import CmsRefundTab from './wallet/CmsRefundTab';
import RupikshaLedgerTab from './wallet/RupikshaLedgerTab';
import RupikshaCommissionLedgerTab from './wallet/RupikshaCommissionLedgerTab';
import TDSReportTab from './wallet/TDSReportTab';
import WalletHistoryTab from './wallet/WalletHistoryTab';

export const WALLET_TABS = [
    { id: 'overview', sectionId: 'Wallet-Overview', label: 'Wallet Overview', icon: Wallet, color: '#6366f1' },
    { id: 'credit', sectionId: 'Wallet-Credit', label: 'Credit Fund', icon: ArrowDownCircle, color: '#10b981' },
    { id: 'debit', sectionId: 'Wallet-Debit', label: 'Debit Fund', icon: ArrowUpCircle, color: '#ef4444' },
    { id: 'pending-requests', sectionId: 'Wallet-Pending-Requests', label: 'Pending Fund Requests', icon: Clock, color: '#f59e0b' },
    { id: 'fund-requests', sectionId: 'Wallet-Fund-Requests', label: 'Fund Request', icon: CheckCircle2, color: '#0ea5e9' },
    { id: 'lock', sectionId: 'Wallet-Lock', label: 'Lock Amount', icon: Lock, color: '#8b5cf6' },
    { id: 'release', sectionId: 'Wallet-Release', label: 'Release Lock Amount', icon: Unlock, color: '#06b6d4' },
    { id: 'freeze', sectionId: 'Wallet-Freeze', label: 'Freeze Wallet', icon: Snowflake, color: '#3b82f6' },
    { id: 'cms-refund', sectionId: 'Wallet-Cms-Refund', label: 'Cms Refund', icon: RotateCcw, color: '#f97316' },
    { id: 'ledger', sectionId: 'Wallet-Ledger', label: 'Rupiksha Ledger', icon: BookOpen, color: '#4f46e5' },
    { id: 'commission-ledger', sectionId: 'Wallet-Commission-Ledger', label: 'Rupiksha Commission Ledger', icon: IndianRupee, color: '#ec4899' },
    { id: 'tds-report', sectionId: 'Wallet-TDS-Report', label: 'TDS REport', icon: FileSpreadsheet, color: '#14b8a6' },
    { id: 'history', sectionId: 'Wallet-History', label: 'Wallet History', icon: History, color: '#64748b' },
];

const mapSectionToTabId = (section) => {
    if (!section) return 'overview';
    const found = WALLET_TABS.find(t => t.sectionId.toLowerCase() === section.toLowerCase() || t.id.toLowerCase() === section.toLowerCase());
    if (found) return found.id;

    // Backward compatibility mappings
    if (section === 'Wallet-Requests') return 'pending-requests';
    if (section === 'Wallet-Lock') return 'lock';
    if (section === 'Wallet-Release') return 'release';
    if (section === 'requests') return 'pending-requests';
    return 'overview';
};

const WalletManager = ({ initialTab, activeSection, onNavigate }) => {
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'ADMIN' || (Array.isArray(currentUser?.roles) && currentUser.roles.includes('ADMIN'));

    const initialResolved = mapSectionToTabId(activeSection || initialTab || 'overview');
    const [activeTab, setActiveTab] = useState(initialResolved);

    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // Sync when activeSection or initialTab changes from outside
    useEffect(() => {
        if (activeSection) {
            setActiveTab(mapSectionToTabId(activeSection));
        } else if (initialTab) {
            setActiveTab(mapSectionToTabId(initialTab));
        }
    }, [activeSection, initialTab]);

    const handleSelectTab = (tab) => {
        setActiveTab(tab.id);
        if (onNavigate) {
            onNavigate(tab.sectionId);
        }
    };

    const loadWallets = useCallback(async () => {
        setLoading(true);
        try {
            let list = [];
            try {
                const res = await fetchAPI('/wallet');
                if (res && res.success && Array.isArray(res.wallets) && res.wallets.length > 0) {
                    list = res.wallets;
                }
            } catch (_) {}

            if (!list || list.length === 0) {
                try {
                    const fallback = await dataService.getAllUsers();
                    if (Array.isArray(fallback) && fallback.length > 0) {
                        list = fallback;
                    }
                } catch (_) {}
            }

            const normalized = (list || []).map(u => ({
                ...u,
                id: u.id || u._id || u.userId || u.username || u.mobile,
                userId: u.userId || u.id || u._id || u.username,
                username: u.username || u.mobile || u.id,
                name: u.name || u.fullName || u.username || 'User',
                fullName: u.fullName || u.name || u.username || 'User',
                mobile: u.mobile || u.phone || u.username || '',
                partyCode: u.partyCode || u.userCode || u.id || '',
                role: u.role || (Array.isArray(u.roles) ? u.roles[0] : 'RETAILER'),
                balance: parseFloat(String(u.balance ?? u.walletBalance ?? u.availableBalance ?? 0).replace(/,/g, '')) || 0,
                lockedAmount: parseFloat(String(u.lockedAmount || 0).replace(/,/g, '')) || 0,
                isFrozen: Boolean(u.isFrozen || u.walletStatus === 'FROZEN')
            }));

            setWallets(normalized);
            try {
                localStorage.setItem('rupiksha_users_cache', JSON.stringify(normalized));
            } catch (_) {}
        } catch (e) {
            console.error('[WalletManager] loadWallets error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWallets();
        const handler = () => loadWallets();
        window.addEventListener('walletUpdated', handler);
        return () => window.removeEventListener('walletUpdated', handler);
    }, [loadWallets]);

    if (!isAdmin) {
        return (
            <div className="bg-white rounded-3xl border border-rose-100 shadow-xl p-8 max-w-lg mx-auto text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto text-rose-500">
                    <AlertTriangle size={28} />
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Access Restricted</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    You do not have administrative privileges to manage wallets, floats, and statutory ledgers.
                </p>
            </div>
        );
    }

    const totalSystemBalance = wallets.reduce((s, w) => s + (w.balance || 0), 0);

    return (
        <div className="wallet-manager-page space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <AnimatePresence>
                {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
            </AnimatePresence>

            {/* Tab Views */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                >
                    {activeTab === 'overview' && (
                        <WalletOverviewTab
                            wallets={wallets}
                            loading={loading}
                            onRefresh={loadWallets}
                            onNavigate={(sec) => onNavigate && onNavigate(sec)}
                        />
                    )}
                    {activeTab === 'credit' && (
                        <CreditFundTab
                            users={wallets}
                            onToast={setToast}
                            onRefresh={loadWallets}
                        />
                    )}
                    {activeTab === 'debit' && (
                        <DebitFundTab
                            users={wallets}
                            onToast={setToast}
                            onRefresh={loadWallets}
                        />
                    )}
                    {activeTab === 'pending-requests' && (
                        <PendingFundRequestsTab
                            users={wallets}
                            onToast={setToast}
                            onRefresh={loadWallets}
                        />
                    )}
                    {activeTab === 'fund-requests' && (
                        <FundRequestHistoryTab
                            onToast={setToast}
                        />
                    )}
                    {activeTab === 'lock' && (
                        <LockAmountTab
                            users={wallets}
                            onToast={setToast}
                            onRefresh={loadWallets}
                            onNavigate={(sec) => onNavigate && onNavigate(sec)}
                        />
                    )}
                    {activeTab === 'release' && (
                        <ReleaseLockTab
                            users={wallets}
                            onToast={setToast}
                            onRefresh={loadWallets}
                        />
                    )}
                    {activeTab === 'freeze' && (
                        <FreezeWalletTab
                            users={wallets}
                            onToast={setToast}
                            onRefresh={loadWallets}
                        />
                    )}
                    {activeTab === 'cms-refund' && (
                        <CmsRefundTab
                            users={wallets}
                            onToast={setToast}
                            onRefresh={loadWallets}
                        />
                    )}
                    {activeTab === 'ledger' && (
                        <RupikshaLedgerTab
                            onToast={setToast}
                        />
                    )}
                    {activeTab === 'commission-ledger' && (
                        <RupikshaCommissionLedgerTab
                            users={wallets}
                            onToast={setToast}
                            onRefresh={loadWallets}
                        />
                    )}
                    {activeTab === 'tds-report' && (
                        <TDSReportTab
                            onToast={setToast}
                        />
                    )}
                    {activeTab === 'history' && (
                        <WalletHistoryTab
                            onToast={setToast}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default WalletManager;
