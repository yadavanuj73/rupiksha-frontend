import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, ArrowLeftRight, BarChart3,
  Network, ShieldCheck, LogOut, Menu, X, RefreshCcw, Search,
  Download, Eye, MapPin, CheckCircle2, XCircle, Clock, AlertTriangle, Lock
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';
import { employeeAuthService, employeePortalService } from '../services/employeeApiService';
import EmployeeOnboardTab from './EmployeeOnboardTab';

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
};

const formatDateTime = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(val);
  }
};

const STATUS_BADGES = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  INITIATED: 'bg-amber-50 text-amber-700 border-amber-200',
  INACTIVE: 'bg-slate-100 text-slate-700 border-slate-300',
  SUSPENDED: 'bg-rose-50 text-rose-700 border-rose-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  RESTRICTED: 'bg-slate-100 text-slate-600 border-slate-300',
};

export default function EmployeePortal({ initialEmployee = null }) {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(initialEmployee || employeeAuthService.getSessionUser());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [zoneCatalog, setZoneCatalog] = useState({ zoneToStates: {}, allStates: [] });
  const [permCatalog, setPermCatalog] = useState([]);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Tab states
  const [dashboard, setDashboard] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberFilters, setMemberFilters] = useState({ role: 'ALL', status: 'ALL', search: '' });
  const [selectedMemberDetail, setSelectedMemberDetail] = useState(null);

  const [txData, setTxData] = useState({ items: [], totalElements: 0, totalPages: 0, summary: {}, serviceBreakdown: [] });
  const [txFilters, setTxFilters] = useState({ category: 'ALL', status: 'ALL', search: '', page: 0 });
  const [selectedTxDetail, setSelectedTxDetail] = useState(null);

  const [reports, setReports] = useState(null);
  const [reportCategory, setReportCategory] = useState('ALL');
  const [subordinates, setSubordinates] = useState([]);

  const [loadingTab, setLoadingTab] = useState(false);
  const [bannerError, setBannerError] = useState('');

  const permissionsSet = useMemo(() => new Set(employee?.permissions || []), [employee]);

  const canViewDashboard = permissionsSet.has('VIEW_DASHBOARD');
  const canViewMembers =
    permissionsSet.has('VIEW_RETAILERS') ||
    permissionsSet.has('VIEW_DISTRIBUTORS') ||
    permissionsSet.has('VIEW_SUPER_DISTRIBUTORS');
  const canOnboard =
    permissionsSet.has('CREATE_RETAILER_ACCOUNT') ||
    permissionsSet.has('CREATE_DISTRIBUTOR_ACCOUNT') ||
    permissionsSet.has('CREATE_SUPER_DISTRIBUTOR_ACCOUNT');
  const canViewTransactions =
    permissionsSet.has('VIEW_TRANSACTIONS') ||
    permissionsSet.has('VIEW_AEPS_TRANSACTIONS') ||
    permissionsSet.has('VIEW_RECHARGE_TRANSACTIONS') ||
    permissionsSet.has('VIEW_BBPS_TRANSACTIONS') ||
    permissionsSet.has('VIEW_PAYOUT_TRANSACTIONS') ||
    permissionsSet.has('VIEW_WALLET_TRANSACTIONS');
  const canViewReports = permissionsSet.has('VIEW_TRANSACTION_REPORTS');
  const canViewHierarchy = permissionsSet.has('VIEW_EMPLOYEES_UNDER_HIERARCHY');

  const navItems = useMemo(() => {
    const items = [];
    if (canViewDashboard) items.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
    if (canViewMembers) items.push({ id: 'members', label: 'Scoped Users', icon: Users });
    if (canOnboard) items.push({ id: 'onboard', label: 'Onboard User', icon: UserPlus });
    if (canViewTransactions) items.push({ id: 'transactions', label: 'Transactions', icon: ArrowLeftRight });
    if (canViewReports) items.push({ id: 'reports', label: 'Reports', icon: BarChart3 });
    if (canViewHierarchy) items.push({ id: 'hierarchy', label: 'Team Hierarchy', icon: Network });
    items.push({ id: 'profile', label: 'Profile & Access', icon: ShieldCheck });
    return items;
  }, [canViewDashboard, canViewMembers, canOnboard, canViewTransactions, canViewReports, canViewHierarchy]);

  const [activeTab, setActiveTab] = useState(() => (canViewDashboard ? 'dashboard' : navItems[0]?.id || 'profile'));

  useEffect(() => {
    if (!navItems.some((item) => item.id === activeTab)) {
      setActiveTab(navItems[0]?.id || 'profile');
    }
  }, [navItems, activeTab]);

  const syncProfileAndCatalogs = useCallback(async () => {
    try {
      const [me, zones, cat] = await Promise.all([
        employeeAuthService.me(),
        employeePortalService.getZones(),
        employeePortalService.getPermissionCatalog(),
      ]);
      if (me) setEmployee(me);
      if (zones) setZoneCatalog(zones);
      if (Array.isArray(cat)) setPermCatalog(cat);
    } catch (err) {
      setBannerError(err?.message || 'Unable to sync employee profile.');
    }
  }, []);

  useEffect(() => {
    syncProfileAndCatalogs();
  }, [syncProfileAndCatalogs]);

  const loadActiveTabData = useCallback(async () => {
    if (!employee) return;
    setBannerError('');
    setLoadingTab(true);
    try {
      if (activeTab === 'dashboard' && canViewDashboard) {
        const res = await employeePortalService.getDashboard({ fromDate, toDate });
        setDashboard(res);
        if (res?.employee) setEmployee(res.employee);
      } else if (activeTab === 'members' && canViewMembers) {
        const res = await employeePortalService.listMembers(memberFilters);
        setMembers(Array.isArray(res) ? res : []);
      } else if (activeTab === 'transactions' && canViewTransactions) {
        const res = await employeePortalService.listTransactions({
          category: txFilters.category,
          status: txFilters.status === 'ALL' ? '' : txFilters.status,
          search: txFilters.search,
          fromDate,
          toDate,
          page: txFilters.page,
          size: 20,
        });
        setTxData(res || { items: [], totalElements: 0, totalPages: 0, summary: {}, serviceBreakdown: [] });
      } else if (activeTab === 'reports' && canViewReports) {
        const res = await employeePortalService.getReports({ category: reportCategory, fromDate, toDate });
        setReports(res);
      } else if (activeTab === 'hierarchy' && canViewHierarchy) {
        const res = await employeePortalService.listHierarchyEmployees({ fromDate, toDate });
        setSubordinates(Array.isArray(res) ? res : []);
      }
    } catch (err) {
      setBannerError(err?.message || 'Failed to load section data.');
    } finally {
      setLoadingTab(false);
    }
  }, [
    activeTab,
    employee,
    canViewDashboard,
    canViewMembers,
    canViewTransactions,
    canViewReports,
    canViewHierarchy,
    fromDate,
    toDate,
    memberFilters,
    txFilters,
    reportCategory,
  ]);

  useEffect(() => {
    if (activeTab !== 'onboard' && activeTab !== 'profile') {
      loadActiveTabData();
    }
  }, [activeTab, loadActiveTabData]);

  const handleOpenMemberDetail = async (memberId) => {
    if (!permissionsSet.has('VIEW_USER_DETAILS')) {
      setBannerError('You do not have permission (View User Details) to inspect member profiles.');
      return;
    }
    try {
      const detail = await employeePortalService.getMemberDetail(memberId);
      setSelectedMemberDetail(detail);
    } catch (err) {
      setBannerError(err?.message || 'Unable to load member details.');
    }
  };

  const handleOpenTxDetail = async (txnId) => {
    if (!permissionsSet.has('VIEW_TRANSACTION_DETAILS')) {
      setBannerError('You do not have permission (View Transaction Details) to inspect receipts.');
      return;
    }
    try {
      const detail = await employeePortalService.getTransactionDetail(txnId);
      setSelectedTxDetail(detail);
    } catch (err) {
      setBannerError(err?.message || 'Unable to load transaction details.');
    }
  };

  const handleExport = async (catOverride = null) => {
    if (!permissionsSet.has('DOWNLOAD_PERMITTED_REPORTS')) {
      setBannerError('Missing permission: Download Permitted Reports.');
      return;
    }
    try {
      const rows = await employeePortalService.exportTransactions({
        category: catOverride || txFilters.category || 'ALL',
        status: txFilters.status === 'ALL' ? '' : txFilters.status,
        search: txFilters.search,
        fromDate,
        toDate,
      });
      if (!Array.isArray(rows) || rows.length === 0) {
        setBannerError('No transactions found in your permitted scope for the selected filters.');
        return;
      }
      const formatted = rows.map((r) => ({
        'Transaction ID': r.id,
        'Reference No': r.referenceNo || '',
        Service: r.serviceType,
        Category: r.category,
        'Amount (INR)': Number(r.amount || 0),
        Status: r.status,
        'User Name': r.userName,
        'Party Code': r.userPartyCode || '',
        Role: r.userRole,
        State: r.userState || '',
        City: r.userCity || '',
        Target: r.targetAccountOrMobile || '',
        Timestamp: formatDateTime(r.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(formatted);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Report');
      XLSX.writeFile(wb, `rupiksha_employee_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      setBannerError(err?.message || 'Unable to export report.');
    }
  };

  const handleLogout = async () => {
    await employeeAuthService.logout();
    navigate('/employee-login', { replace: true });
  };

  const permittedTxnCategories = useMemo(() => {
    const cats = [{ value: 'ALL', label: 'All Permitted' }];
    if (permissionsSet.has('VIEW_AEPS_TRANSACTIONS') || permissionsSet.has('VIEW_TRANSACTIONS')) cats.push({ value: 'AEPS', label: 'AEPS' });
    if (permissionsSet.has('VIEW_RECHARGE_TRANSACTIONS') || permissionsSet.has('VIEW_TRANSACTIONS')) cats.push({ value: 'RECHARGE', label: 'Recharge' });
    if (permissionsSet.has('VIEW_BBPS_TRANSACTIONS') || permissionsSet.has('VIEW_TRANSACTIONS')) cats.push({ value: 'BBPS', label: 'BBPS' });
    if (permissionsSet.has('VIEW_PAYOUT_TRANSACTIONS') || permissionsSet.has('VIEW_TRANSACTIONS')) cats.push({ value: 'PAYOUT', label: 'Payout' });
    if (permissionsSet.has('VIEW_WALLET_TRANSACTIONS') || permissionsSet.has('VIEW_TRANSACTIONS')) cats.push({ value: 'WALLET', label: 'Wallet' });
    return cats;
  }, [permissionsSet]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-['Inter',sans-serif]">
      {/* Mobile Sidebar Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-68 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm">
              RK
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-base leading-tight">Rupiksha</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                {employee?.roleDisplayName || 'Employee Portal'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="text-sm font-bold text-slate-900 truncate">{employee?.fullName}</div>
          <div className="text-xs text-slate-600 font-mono mt-0.5">{employee?.employeeCode}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 max-w-full truncate">
            <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
            <span className="truncate">{employee?.territoryLabel || 'Assigned Scope'}</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-800 text-sm font-bold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
                {navItems.find((n) => n.id === activeTab)?.label || 'Employee Workspace'}
              </h1>
              <p className="text-xs text-slate-500">
                Server-verified read-only operations &amp; permitted onboarding
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
              aria-label="From date"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
              aria-label="To date"
            />
            <button
              onClick={() => {
                syncProfileAndCatalogs();
                loadActiveTabData();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loadingTab ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-7xl w-full mx-auto">
          {bannerError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{bannerError}</span>
              </div>
              <button onClick={() => setBannerError('')} className="text-rose-600 hover:text-rose-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && canViewDashboard && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total Scoped Users" value={dashboard?.totalUsers ?? 0} sub={`Direct Onboarded: ${dashboard?.directUsersOnboarded ?? 0}`} />
                <KpiCard
                  label="Partner Mix (R / D / SD)"
                  value={`${dashboard?.totalRetailers ?? 0} / ${dashboard?.totalDistributors ?? 0} / ${dashboard?.totalSuperDistributors ?? 0}`}
                  sub={`Subordinate Employees: ${dashboard?.totalSubordinateEmployees ?? 0}`}
                />
                <KpiCard
                  label="Total Transactions"
                  value={dashboard?.totalTransactions ?? 0}
                  sub={`Success: ${dashboard?.successTransactions ?? 0} · Pending: ${dashboard?.pendingTransactions ?? 0} · Failed: ${dashboard?.failedTransactions ?? 0}`}
                />
                <KpiCard
                  label="Total Transaction Volume"
                  value={formatCurrency(dashboard?.totalVolume ?? 0)}
                  sub="Calculated from live database records"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-4">Service-Wise Volume &amp; Counts</h3>
                  {dashboard?.serviceBreakdown?.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.serviceBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="service" tick={{ fontSize: 12, fill: '#334155' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#334155' }} />
                          <Tooltip />
                          <Bar dataKey="totalCount" name="Total Txns" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="successCount" name="Success" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState message="No service transactions recorded in your assigned scope yet." />
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-4">Date-Wise Performance Trend</h3>
                  {dashboard?.dailyTrend?.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboard.dailyTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#334155' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#334155' }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="totalVolume" name="Volume (INR)" stroke="#4f46e5" fill="#e0e7ff" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState message="No daily performance data available yet." />
                  )}
                </div>
              </div>

              {permissionsSet.has('VIEW_TRANSACTIONS') && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-slate-900">Recent Scoped Transactions</h3>
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      View Full Ledger
                    </button>
                  </div>
                  {dashboard?.recentTransactions?.length > 0 ? (
                    <TransactionTable
                      rows={dashboard.recentTransactions}
                      canViewDetails={permissionsSet.has('VIEW_TRANSACTION_DETAILS')}
                      onSelect={handleOpenTxDetail}
                    />
                  ) : (
                    <EmptyState message="No recent transactions found in your scope." />
                  )}
                </div>
              )}
            </div>
          )}

          {/* SCOPED MEMBERS (READ-ONLY) */}
          {activeTab === 'members' && canViewMembers && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Members Within Assigned Scope (Read-Only)</h2>
                  <p className="text-xs text-slate-600">
                    Showing only member roles authorized by your permission matrix in {employee?.territoryLabel || 'your scope'}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberFilters.search}
                      onChange={(e) => setMemberFilters((p) => ({ ...p, search: e.target.value }))}
                      placeholder="Search name, code, mobile..."
                      className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-900"
                    />
                  </div>
                  <select
                    value={memberFilters.role}
                    onChange={(e) => setMemberFilters((p) => ({ ...p, role: e.target.value }))}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-900"
                  >
                    <option value="ALL">All Permitted Roles</option>
                    {permissionsSet.has('VIEW_RETAILERS') && <option value="RETAILER">Retailers</option>}
                    {permissionsSet.has('VIEW_DISTRIBUTORS') && <option value="DISTRIBUTOR">Distributors</option>}
                    {permissionsSet.has('VIEW_SUPER_DISTRIBUTORS') && <option value="SUPER_DISTRIBUTOR">Super Distributors</option>}
                  </select>
                </div>
              </div>

              {members.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-600 bg-slate-50">
                        <th className="py-3 px-3">Partner</th>
                        <th className="py-3 px-3">Role / Code</th>
                        <th className="py-3 px-3">Scope Location</th>
                        <th className="py-3 px-3">Parent Upline</th>
                        <th className="py-3 px-3">Status &amp; KYC</th>
                        <th className="py-3 px-3 text-right">Wallet</th>
                        <th className="py-3 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{m.fullName}</div>
                            <div className="text-xs text-slate-500">{m.mobile} · {m.username}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-xs font-bold text-indigo-700">{m.role}</div>
                            <div className="text-xs font-mono text-slate-600">{m.partyCode || '—'}</div>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-700">
                            <div>{m.stateName || '—'}</div>
                            <div className="text-slate-500">{[m.city, m.zoneName].filter(Boolean).join(' · ') || '—'}</div>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-700">
                            <div>{m.parentName || 'Direct'}</div>
                            {m.onboardedByEmployeeCode && (
                              <div className="text-[11px] text-indigo-600">Onboarded: {m.onboardedByEmployeeCode}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge status={m.status} />
                              {permissionsSet.has('VIEW_USER_KYC_STATUS') && <StatusBadge status={m.kycStatus} prefix="KYC: " />}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">{formatCurrency(m.walletBalance)}</td>
                          <td className="py-3 px-3 text-right">
                            {permissionsSet.has('VIEW_USER_DETAILS') ? (
                              <button
                                onClick={() => handleOpenMemberDetail(m.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">Restricted</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No records found for your selected filters within scope." />
              )}
            </div>
          )}

          {/* ONBOARDING */}
          {activeTab === 'onboard' && canOnboard && (
            <EmployeeOnboardTab
              employee={employee}
              permissionsSet={permissionsSet}
              zoneCatalog={zoneCatalog}
              onOnboardSuccess={() => syncProfileAndCatalogs()}
            />
          )}

          {/* TRANSACTIONS */}
          {activeTab === 'transactions' && canViewTransactions && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Filtered Count" value={txData?.summary?.totalTransactions ?? 0} />
                <KpiCard label="Successful" value={txData?.summary?.successTransactions ?? 0} />
                <KpiCard label="Pending" value={txData?.summary?.pendingTransactions ?? 0} />
                <KpiCard label="Total Volume" value={formatCurrency(txData?.summary?.totalVolume ?? 0)} />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={txFilters.search}
                        onChange={(e) => setTxFilters((p) => ({ ...p, search: e.target.value, page: 0 }))}
                        placeholder="Search ID, ref, partner..."
                        className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-900"
                      />
                    </div>
                    <select
                      value={txFilters.category}
                      onChange={(e) => setTxFilters((p) => ({ ...p, category: e.target.value, page: 0 }))}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-900"
                    >
                      {permittedTxnCategories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={txFilters.status}
                      onChange={(e) => setTxFilters((p) => ({ ...p, status: e.target.value, page: 0 }))}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-900"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="SUCCESS">Success</option>
                      <option value="PENDING">Pending</option>
                      <option value="FAILED">Failed</option>
                    </select>
                  </div>

                  {permissionsSet.has('DOWNLOAD_PERMITTED_REPORTS') && (
                    <button
                      onClick={() => handleExport()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Export Excel
                    </button>
                  )}
                </div>

                {txData?.items?.length > 0 ? (
                  <>
                    <TransactionTable
                      rows={txData.items}
                      canViewDetails={permissionsSet.has('VIEW_TRANSACTION_DETAILS')}
                      onSelect={handleOpenTxDetail}
                    />
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs text-slate-600">
                      <span>
                        Page {(txData.page || 0) + 1} of {Math.max(1, txData.totalPages || 1)} ({txData.totalElements || 0} records)
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={(txFilters.page || 0) <= 0}
                          onClick={() => setTxFilters((p) => ({ ...p, page: Math.max(0, p.page - 1) }))}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 bg-white font-semibold"
                        >
                          Previous
                        </button>
                        <button
                          disabled={(txFilters.page || 0) + 1 >= (txData.totalPages || 1)}
                          onClick={() => setTxFilters((p) => ({ ...p, page: p.page + 1 }))}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 bg-white font-semibold"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState message="No transactions found matching your criteria." />
                )}
              </div>
            </div>
          )}

          {/* REPORTS */}
          {activeTab === 'reports' && canViewReports && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Scoped Transaction &amp; Sales Reports</h2>
                  <p className="text-xs text-slate-600">Aggregated directly from verified backend ledgers.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-900"
                  >
                    {permittedTxnCategories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {permissionsSet.has('DOWNLOAD_PERMITTED_REPORTS') && (
                    <button
                      onClick={() => handleExport(reportCategory)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Download Permitted Report
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3">Service Breakdown</h3>
                {reports?.serviceBreakdown?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-600 bg-slate-50">
                          <th className="py-3 px-3">Service</th>
                          <th className="py-3 px-3">Total</th>
                          <th className="py-3 px-3">Success</th>
                          <th className="py-3 px-3">Pending</th>
                          <th className="py-3 px-3">Failed</th>
                          <th className="py-3 px-3 text-right">Volume</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reports.serviceBreakdown.map((s) => (
                          <tr key={s.service}>
                            <td className="py-3 px-3 font-bold text-slate-900">{s.service}</td>
                            <td className="py-3 px-3">{s.totalCount}</td>
                            <td className="py-3 px-3 text-emerald-700 font-semibold">{s.successCount}</td>
                            <td className="py-3 px-3 text-amber-700 font-semibold">{s.pendingCount}</td>
                            <td className="py-3 px-3 text-rose-700 font-semibold">{s.failedCount}</td>
                            <td className="py-3 px-3 text-right font-bold">{formatCurrency(s.totalVolume)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message="No report data found for your permitted scope." />
                )}
              </div>
            </div>
          )}

          {/* TEAM HIERARCHY */}
          {activeTab === 'hierarchy' && canViewHierarchy && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Subordinate Employees in Your Hierarchy</h2>
                <p className="text-xs text-slate-600">
                  Strictly scoped to subordinate employees reporting beneath {employee?.employeeCode}. Sibling or higher-level staff are isolated.
                </p>
              </div>
              {subordinates.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-600 bg-slate-50">
                        <th className="py-3 px-3">Employee</th>
                        <th className="py-3 px-3">Role &amp; Scope</th>
                        <th className="py-3 px-3">Status</th>
                        {permissionsSet.has('VIEW_EMPLOYEE_PERFORMANCE') && (
                          <>
                            <th className="py-3 px-3">Onboarded Users</th>
                            <th className="py-3 px-3">Hierarchy Users</th>
                            <th className="py-3 px-3">Txns (Success/Total)</th>
                            <th className="py-3 px-3 text-right">Volume</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subordinates.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{sub.fullName}</div>
                            <div className="text-xs font-mono text-slate-500">{sub.employeeCode} · {sub.username}</div>
                          </td>
                          <td className="py-3 px-3 text-xs">
                            <div className="font-bold text-indigo-700">{sub.roleDisplayName}</div>
                            <div className="text-slate-600">{sub.territoryLabel || '—'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={sub.status} />
                          </td>
                          {permissionsSet.has('VIEW_EMPLOYEE_PERFORMANCE') && (
                            <>
                              <td className="py-3 px-3 font-semibold">{sub.directUsersOnboarded}</td>
                              <td className="py-3 px-3">{sub.hierarchyTotalUsers}</td>
                              <td className="py-3 px-3">
                                {sub.successTransactions} / {sub.totalTransactions}
                              </td>
                              <td className="py-3 px-3 text-right font-bold">{formatCurrency(sub.totalVolume)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No subordinate employees are assigned beneath your hierarchy yet." />
              )}
            </div>
          )}

          {/* PROFILE & PERMISSIONS (READ-ONLY) */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoField label="Full Name" value={employee?.fullName} />
                <InfoField label="Employee ID" value={employee?.employeeCode} />
                <InfoField label="Username" value={employee?.username} />
                <InfoField label="Role" value={employee?.roleDisplayName} />
                <InfoField label="Status" value={employee?.status} />
                <InfoField label="Reporting To" value={`${employee?.reportingManagerName || 'Admin'} (${employee?.reportingManagerCode || 'ADMIN'})`} />
                <InfoField label="Mobile" value={employee?.mobile} />
                <InfoField label="Email" value={employee?.email} />
                <InfoField label="Assigned Scope" value={employee?.territoryLabel} />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Active Permission Matrix (Read-Only)</h3>
                    <p className="text-xs text-slate-600">Permissions are enforced server-side and can only be updated by Rupiksha Admin.</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                    <Lock className="w-3.5 h-3.5" /> Read-Only
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {permCatalog.map((cat) => (
                    <div key={cat.category} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-3">
                        {cat.categoryLabel}
                      </div>
                      <div className="space-y-2">
                        {cat.items.map((item) => {
                          const granted = permissionsSet.has(item.code);
                          return (
                            <div key={item.code} className="flex items-center justify-between text-xs py-1">
                              <span className={granted ? 'font-semibold text-slate-900' : 'text-slate-400'}>{item.label}</span>
                              {granted ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400">
                                  <XCircle className="w-3.5 h-3.5" /> Denied
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Member Detail Modal (Read-Only) */}
      {selectedMemberDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">{selectedMemberDetail.summary.fullName}</h3>
                <p className="text-xs font-mono text-slate-600">
                  {selectedMemberDetail.summary.partyCode} · {selectedMemberDetail.summary.role} (Read-Only View)
                </p>
              </div>
              <button onClick={() => setSelectedMemberDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <InfoField label="Mobile" value={selectedMemberDetail.summary.mobile} />
              <InfoField label="Email" value={selectedMemberDetail.summary.email} />
              <InfoField label="State / City" value={`${selectedMemberDetail.summary.stateName || '—'} / ${selectedMemberDetail.summary.city || '—'}`} />
              <InfoField label="KYC Status" value={selectedMemberDetail.summary.kycStatus} />
              <InfoField label="Business Name" value={selectedMemberDetail.summary.businessName || '—'} />
              <InfoField label="Wallet Balance" value={formatCurrency(selectedMemberDetail.summary.walletBalance)} />
              <InfoField label="PAN (Masked)" value={selectedMemberDetail.panMasked || '—'} />
              <InfoField label="Aadhaar (Masked)" value={selectedMemberDetail.aadhaarMasked || '—'} />
              <InfoField label="Bank" value={selectedMemberDetail.bankName || '—'} />
              <InfoField label="Bank A/C (Masked)" value={selectedMemberDetail.bankAccountMasked || '—'} />
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal (Read-Only) */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Transaction Details</h3>
              <button onClick={() => setSelectedTxDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <InfoField label="Transaction ID" value={selectedTxDetail.id} />
              <InfoField label="Reference No" value={selectedTxDetail.referenceNo || '—'} />
              <InfoField label="Service" value={selectedTxDetail.serviceType} />
              <InfoField label="Amount" value={formatCurrency(selectedTxDetail.amount)} />
              <InfoField label="Status" value={selectedTxDetail.status} />
              <InfoField label="Partner" value={`${selectedTxDetail.userName} (${selectedTxDetail.userPartyCode || '—'})`} />
              <InfoField label="Location" value={`${selectedTxDetail.userState || '—'} / ${selectedTxDetail.userCity || '—'}`} />
              <InfoField label="Timestamp" value={formatDateTime(selectedTxDetail.createdAt)} />
              <InfoField label="Remarks" value={selectedTxDetail.remarks || '—'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 break-all">{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status, prefix = '' }) {
  const key = String(status || 'PENDING').toUpperCase();
  const cls = STATUS_BADGES[key] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${cls}`}>
      {prefix}{key}
    </span>
  );
}

function EmptyState({ message }) {
  return (
    <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
      <Clock className="w-7 h-7 text-slate-400 mx-auto mb-2" />
      <p className="font-semibold text-slate-700">No records found</p>
      <p className="text-xs text-slate-500 mt-0.5">{message}</p>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-bold text-slate-900 mt-0.5 break-words">{value || '—'}</div>
    </div>
  );
}

function TransactionTable({ rows, canViewDetails, onSelect }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-600 bg-slate-50">
            <th className="py-3 px-3">Ref / Service</th>
            <th className="py-3 px-3">Partner</th>
            <th className="py-3 px-3">Location</th>
            <th className="py-3 px-3">Status</th>
            <th className="py-3 px-3 text-right">Amount</th>
            <th className="py-3 px-3">Date</th>
            {canViewDetails && <th className="py-3 px-3 text-right">View</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t) => (
            <tr key={`${t.category}-${t.id}`} className="hover:bg-slate-50/70">
              <td className="py-3 px-3">
                <div className="font-mono text-xs font-bold text-slate-900">{t.id}</div>
                <div className="text-xs text-indigo-700 font-semibold">{t.serviceType}</div>
              </td>
              <td className="py-3 px-3 text-xs">
                <div className="font-bold text-slate-900">{t.userName}</div>
                <div className="text-slate-500">{t.userPartyCode || t.userRole}</div>
              </td>
              <td className="py-3 px-3 text-xs text-slate-600">
                {[t.userState, t.userCity].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="py-3 px-3">
                <StatusBadge status={t.status} />
              </td>
              <td className="py-3 px-3 text-right font-bold text-slate-900">{formatCurrency(t.amount)}</td>
              <td className="py-3 px-3 text-xs text-slate-600">{formatDateTime(t.createdAt)}</td>
              {canViewDetails && (
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => onSelect(t.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
