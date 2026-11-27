import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Shield, Plus, X, Save, CheckCircle2, MapPin, Activity,
  RefreshCcw, Users, TrendingUp, Eye, Search, Mail, Phone,
  Lock, KeyRound, UserCheck, AlertCircle, BarChart3, History,
  Check, Ban, Power, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area
} from 'recharts';
import { adminEmployeeService } from '../../services/employeeApiService';

const ROLE_META = {
  NATIONAL_HEADER: {
    label: 'National Head',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    desc: 'All-India hierarchy & national business visibility',
  },
  STATE_HEADER: {
    label: 'State Head',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    desc: 'Scoped strictly to assigned Indian states',
  },
  REGIONAL_HEADER: {
    label: 'Zonal Head',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    desc: 'Scoped strictly to assigned zones or city/district clusters',
  },
};

const STATUS_BADGE = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-700 border-slate-300',
  SUSPENDED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(val || 0));

const formatDateTime = (val) => {
  if (!val) return 'Never';
  try {
    return new Date(val).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(val);
  }
};

export default function EmployeeManager() {
  const [activeTab, setActiveTab] = useState('directory');
  const [employees, setEmployees] = useState([]);
  const [performanceList, setPerformanceList] = useState([]);
  const [permCatalog, setPermCatalog] = useState([]);
  const [zoneCatalog, setZoneCatalog] = useState({ zoneToStates: {}, allStates: [] });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [banner, setBanner] = useState(null);

  // Create / Edit Modal State
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [eligibleManagers, setEligibleManagers] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [cityClusters, setCityClusters] = useState([]);
  const [clusterDraft, setClusterDraft] = useState({ stateName: '', cityOrDistrict: '' });
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [stateSearch, setStateSearch] = useState('');
  const [savingForm, setSavingForm] = useState(false);

  const [formData, setFormData] = useState({
    employeeCode: '',
    username: '',
    fullName: '',
    mobile: '',
    email: '',
    address: '',
    initialPassword: '',
    role: 'STATE_HEADER',
    reportingManagerId: '',
    status: 'ACTIVE',
  });

  // Modals: Performance Inspector, Permission Preview, Password Reset
  const [selectedPerf, setSelectedPerf] = useState(null);
  const [permPreview, setPermPreview] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        adminEmployeeService.listEmployees(),
        adminEmployeeService.listPerformance({ fromDate, toDate }),
        adminEmployeeService.getPermissionCatalog(),
        adminEmployeeService.getZoneCatalog(),
        adminEmployeeService.getAuditLogs(),
      ]);
      const [empRes, perfRes, catRes, zoneRes, logsRes] = results;
      const errors = [];

      if (empRes.status === 'fulfilled') setEmployees(Array.isArray(empRes.value) ? empRes.value : []);
      else errors.push(empRes.reason?.message || 'Employees load failed');

      if (perfRes.status === 'fulfilled') setPerformanceList(Array.isArray(perfRes.value) ? perfRes.value : []);
      else errors.push(perfRes.reason?.message || 'Performance load failed');

      if (catRes.status === 'fulfilled') setPermCatalog(Array.isArray(catRes.value) ? catRes.value : []);
      else errors.push(catRes.reason?.message || 'Permissions catalog load failed');

      if (zoneRes.status === 'fulfilled' && zoneRes.value) setZoneCatalog(zoneRes.value);
      else if (zoneRes.status === 'rejected') errors.push(zoneRes.reason?.message || 'Zones load failed');

      if (logsRes.status === 'fulfilled') setAuditLogs(Array.isArray(logsRes.value) ? logsRes.value : []);
      else errors.push(logsRes.reason?.message || 'Audit logs load failed');

      if (errors.length > 0) {
        setBanner({ type: 'error', text: errors[0] });
      }
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Failed to load employee module data.' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!showFormModal) return;
    let active = true;
    const loadManagers = async () => {
      if (formData.role === 'NATIONAL_HEADER') {
        setEligibleManagers([]);
        return;
      }
      try {
        const res = await adminEmployeeService.listEligibleManagers(formData.role);
        if (active) setEligibleManagers(Array.isArray(res) ? res : []);
      } catch {
        if (active) setEligibleManagers([]);
      }
    };
    loadManagers();
    return () => {
      active = false;
    };
  }, [showFormModal, formData.role]);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setFormData({
      employeeCode: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      username: '',
      fullName: '',
      mobile: '',
      email: '',
      address: '',
      initialPassword: '',
      role: 'STATE_HEADER',
      reportingManagerId: '',
      status: 'ACTIVE',
    });
    setSelectedStates([]);
    setSelectedZones([]);
    setCityClusters([]);
    setSelectedPermissions(new Set(['VIEW_DASHBOARD', 'VIEW_TRANSACTION_METRICS', 'VIEW_USER_STATISTICS']));
    setShowFormModal(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      employeeCode: emp.employeeCode || '',
      username: emp.username || '',
      fullName: emp.fullName || '',
      mobile: emp.mobile || '',
      email: emp.email || '',
      address: emp.address || '',
      initialPassword: '',
      role: emp.role || 'STATE_HEADER',
      reportingManagerId: emp.reportingManagerId || '',
      status: emp.status || 'ACTIVE',
    });

    const states = [];
    const zones = [];
    const clusters = [];
    (emp.scopes || []).forEach((s) => {
      if (s.cityOrDistrict) {
        clusters.push({ stateName: s.stateName || '', cityOrDistrict: s.cityOrDistrict });
      } else if (s.scopeType === 'STATE' && s.stateName) {
        states.push(s.stateName);
      } else if (s.scopeType === 'ZONE') {
        if (s.zoneName) zones.push(s.zoneName);
        if (s.stateName) states.push(s.stateName);
      }
    });
    setSelectedStates(Array.from(new Set(states)));
    setSelectedZones(Array.from(new Set(zones)));
    setCityClusters(clusters);
    setSelectedPermissions(new Set(emp.permissions || []));
    setShowFormModal(true);
  };

  const togglePermission = (code) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleCategory = (cat) => {
    const codes = cat.items.map((i) => i.code);
    const allSelected = codes.every((c) => selectedPermissions.has(c));
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => {
        if (allSelected) next.delete(c);
        else next.add(c);
      });
      return next;
    });
  };

  const buildScopesPayload = () => {
    if (formData.role === 'NATIONAL_HEADER') {
      return [{ scopeType: 'NATIONAL', stateName: null, zoneName: 'All India', cityOrDistrict: null }];
    }
    if (formData.role === 'STATE_HEADER') {
      return selectedStates.map((st) => ({
        scopeType: 'STATE',
        stateName: st,
        zoneName: null,
        cityOrDistrict: null,
      }));
    }
    const items = [];
    selectedZones.forEach((z) => {
      items.push({ scopeType: 'ZONE', stateName: null, zoneName: z, cityOrDistrict: null });
    });
    selectedStates.forEach((st) => {
      items.push({ scopeType: 'ZONE', stateName: st, zoneName: null, cityOrDistrict: null });
    });
    cityClusters.forEach((c) => {
      items.push({
        scopeType: 'ZONE',
        stateName: c.stateName || null,
        zoneName: null,
        cityOrDistrict: c.cityOrDistrict,
      });
    });
    return items;
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setBanner(null);

    const scopesPayload = buildScopesPayload();
    if (formData.role === 'STATE_HEADER' && scopesPayload.length === 0) {
      setBanner({ type: 'error', text: 'Please select at least one assigned state for this State Head.' });
      return;
    }
    if (formData.role === 'REGIONAL_HEADER' && scopesPayload.length === 0) {
      setBanner({ type: 'error', text: 'Please assign at least one zone, state, or district/city cluster for this Zonal Head.' });
      return;
    }

    setSavingForm(true);
    try {
      const permissionsArray = Array.from(selectedPermissions);
      if (editingEmployee) {
        await adminEmployeeService.updateEmployee(editingEmployee.id, {
          fullName: formData.fullName,
          mobile: formData.mobile,
          email: formData.email,
          address: formData.address,
          reportingManagerId: formData.reportingManagerId || 'ADMIN',
          scopes: scopesPayload,
          permissions: permissionsArray,
        });
        setBanner({ type: 'success', text: `Updated ${formData.fullName} (${editingEmployee.employeeCode}) and synced permissions.` });
      } else {
        if (!formData.initialPassword || formData.initialPassword.length < 6) {
          setBanner({ type: 'error', text: 'Initial password must be at least 6 characters.' });
          setSavingForm(false);
          return;
        }
        await adminEmployeeService.createEmployee({
          employeeCode: formData.employeeCode,
          username: formData.username,
          fullName: formData.fullName,
          mobile: formData.mobile,
          email: formData.email,
          address: formData.address,
          role: formData.role,
          initialPassword: formData.initialPassword,
          reportingManagerId: formData.reportingManagerId || null,
          scopes: scopesPayload,
          permissions: permissionsArray,
          status: formData.status,
        });
        setBanner({ type: 'success', text: `Provisioned employee ${formData.fullName} (${formData.employeeCode}).` });
      }
      setShowFormModal(false);
      await loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Unable to save employee.' });
    } finally {
      setSavingForm(false);
    }
  };

  const handleStatusChange = async (emp, nextStatus) => {
    try {
      await adminEmployeeService.updateStatus(emp.id, nextStatus, `Changed by Admin to ${nextStatus}`);
      setBanner({ type: 'success', text: `${emp.fullName} (${emp.employeeCode}) marked ${nextStatus}.` });
      await loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Failed to update status.' });
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTarget || newPasswordInput.length < 6) {
      setBanner({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    try {
      await adminEmployeeService.resetPassword(resetTarget.id, newPasswordInput);
      setBanner({ type: 'success', text: `Password updated for ${resetTarget.fullName}; active sessions invalidated.` });
      setResetTarget(null);
      setNewPasswordInput('');
      await loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Unable to reset password.' });
    }
  };

  const openPerformanceDetail = async (empId) => {
    try {
      const perf = await adminEmployeeService.getEmployeePerformance(empId, { fromDate, toDate });
      setSelectedPerf(perf);
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Unable to load performance metrics.' });
    }
  };

  const openPermissionPreview = async (empId) => {
    try {
      const preview = await adminEmployeeService.getPermissionPreview(empId);
      setPermPreview(preview);
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Unable to load permission preview.' });
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (roleFilter !== 'ALL' && e.role !== roleFilter) return false;
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(e.fullName || '').toLowerCase().includes(q) ||
        String(e.employeeCode || '').toLowerCase().includes(q) ||
        String(e.username || '').toLowerCase().includes(q) ||
        String(e.mobile || '').toLowerCase().includes(q) ||
        String(e.territoryLabel || '').toLowerCase().includes(q)
      );
    });
  }, [employees, search, roleFilter, statusFilter]);

  const filteredPerf = useMemo(() => {
    const q = search.trim().toLowerCase();
    return performanceList.filter((e) => {
      if (roleFilter !== 'ALL' && e.role !== roleFilter) return false;
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(e.fullName || '').toLowerCase().includes(q) ||
        String(e.employeeCode || '').toLowerCase().includes(q) ||
        String(e.territoryLabel || '').toLowerCase().includes(q)
      );
    });
  }, [performanceList, search, roleFilter, statusFilter]);

  const summaryKpis = useMemo(() => {
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    const nh = employees.filter((e) => e.role === 'NATIONAL_HEADER').length;
    const sh = employees.filter((e) => e.role === 'STATE_HEADER').length;
    const zh = employees.filter((e) => e.role === 'REGIONAL_HEADER').length;
    const totalOnboarded = performanceList.reduce((acc, p) => acc + Number(p.directUsersOnboarded || 0), 0);
    return { total: employees.length, active, nh, sh, zh, totalOnboarded };
  }, [employees, performanceList]);

  const filteredStateChoices = useMemo(() => {
    const q = stateSearch.trim().toLowerCase();
    return (zoneCatalog.allStates || []).filter((s) => !q || s.toLowerCase().includes(q));
  }, [zoneCatalog.allStates, stateSearch]);

  return (
    <div className="space-y-6 text-slate-900 font-['Inter',sans-serif]">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-indigo-600" />
            Employee Management, Hierarchy &amp; Performance
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Provision National Head, State Head, and Zonal Head credentials, enforce role-bound geographical scopes, configure permissions, and monitor live DB performance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Employee
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            banner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Real DB Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Employees</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{summaryKpis.total}</div>
          <div className="text-xs text-slate-600 mt-1">
            {summaryKpis.nh} National · {summaryKpis.sh} State · {summaryKpis.zh} Zonal
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Accounts</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{summaryKpis.active}</div>
          <div className="text-xs text-slate-600 mt-1">Verified &amp; permitted to sign in</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Users Onboarded</div>
          <div className="text-2xl font-extrabold text-indigo-700 mt-1">{summaryKpis.totalOnboarded}</div>
          <div className="text-xs text-slate-600 mt-1">Direct partner accounts created</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Audit Events Recorded</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{auditLogs.length}</div>
          <div className="text-xs text-slate-600 mt-1">Logins, permission updates &amp; onboarding</div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'directory', label: 'Employee Directory', icon: Users },
            { id: 'performance', label: 'Employee Performance', icon: BarChart3 },
            { id: 'audit', label: 'Activity Audit Logs', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, scope..."
              className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
          >
            <option value="ALL">All Roles</option>
            <option value="NATIONAL_HEADER">National Head</option>
            <option value="STATE_HEADER">State Head</option>
            <option value="REGIONAL_HEADER">Zonal Head</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          {activeTab === 'performance' && (
            <>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
              />
            </>
          )}
        </div>
      </div>

      {/* DIRECTORY TAB */}
      {activeTab === 'directory' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {filteredEmployees.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No employees found. Click <strong>Create Employee</strong> to provision National, State, or Zonal Head credentials.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Role &amp; Manager</th>
                    <th className="py-3.5 px-4">Geographical Scope</th>
                    <th className="py-3.5 px-4">Permissions</th>
                    <th className="py-3.5 px-4">Status &amp; Login</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const roleMeta = ROLE_META[emp.role] || { label: emp.role, badge: 'bg-slate-100 text-slate-800 border-slate-200' };
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{emp.fullName}</div>
                          <div className="text-xs font-mono text-indigo-700 font-semibold">{emp.employeeCode} · @{emp.username}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {emp.mobile}</span>
                            <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {emp.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleMeta.badge}`}>
                            {roleMeta.label}
                          </span>
                          <div className="text-xs text-slate-600 mt-1">
                            Reports to: <span className="font-semibold">{emp.reportingManagerName || 'Admin'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 max-w-xs">
                          <div className="inline-flex items-start gap-1 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                            <span>{emp.territoryLabel || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <span className="font-bold text-slate-800">{(emp.permissions || []).length}</span> granted
                          <div>
                            <button
                              onClick={() => openPermissionPreview(emp.id)}
                              className="text-[11px] font-bold text-indigo-600 hover:underline mt-0.5 cursor-pointer"
                            >
                              Preview Access
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_BADGE[emp.status] || STATUS_BADGE.INACTIVE}`}>
                            {emp.status}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">Last login: {formatDateTime(emp.lastLoginAt)}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                            >
                              Edit / Perms
                            </button>
                            <button
                              onClick={() => openPerformanceDetail(emp.id)}
                              className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold cursor-pointer"
                            >
                              Performance
                            </button>
                            <button
                              onClick={() => { setResetTarget(emp); setNewPasswordInput(''); }}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5 inline" />
                            </button>
                            {emp.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleStatusChange(emp, 'SUSPENDED')}
                                className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(emp, 'ACTIVE')}
                                className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold cursor-pointer"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PERFORMANCE MONITORING TAB */}
      {activeTab === 'performance' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {filteredPerf.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No employee performance records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Role &amp; Scope</th>
                    <th className="py-3.5 px-4">Onboarded (R / D / SD)</th>
                    <th className="py-3.5 px-4">Hierarchy Users</th>
                    <th className="py-3.5 px-4">Transactions (S / P / F)</th>
                    <th className="py-3.5 px-4 text-right">Volume</th>
                    <th className="py-3.5 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPerf.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.fullName}</div>
                        <div className="text-xs font-mono text-indigo-700">{p.employeeCode}</div>
                        <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-slate-900">{p.roleDisplayName}</div>
                        <div className="text-slate-600 max-w-xs truncate">{p.territoryLabel}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-extrabold text-slate-900">{p.directUsersOnboarded} total</div>
                        <div className="text-slate-600">
                          {p.retailersOnboarded}R · {p.distributorsOnboarded}D · {p.superDistributorsOnboarded}SD
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-slate-900">{p.hierarchyTotalUsers} users</div>
                        <div className="text-slate-500">{p.subordinateEmployeesCount} subordinate staff</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-slate-900">{p.totalTransactions} txns</div>
                        <div className="text-slate-600">
                          <span className="text-emerald-700 font-semibold">{p.successTransactions}</span> /{' '}
                          <span className="text-amber-700 font-semibold">{p.pendingTransactions}</span> /{' '}
                          <span className="text-rose-700 font-semibold">{p.failedTransactions}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">{formatINR(p.totalVolume)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openPerformanceDetail(p.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No audit logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Outcome</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{log.eventType}</td>
                      <td className="py-2.5 px-4 font-mono text-indigo-700">{log.employeeUsername || '—'}</td>
                      <td className="py-2.5 px-4">{log.actorType}: {log.actorUsername || '—'}</td>
                      <td className="py-2.5 px-4 font-bold">{log.outcome}</td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-md">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT EMPLOYEE & PERMISSION MATRIX MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingEmployee ? `Edit Employee · ${editingEmployee.employeeCode}` : 'Create Employee Account'}
                </h3>
                <p className="text-xs text-slate-600">
                  Admin-only provisioning. Passwords are BCrypt hashed and never returned.
                </p>
              </div>
              <button onClick={() => setShowFormModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Employee ID *</label>
                  <input
                    type="text"
                    value={formData.employeeCode}
                    disabled={!!editingEmployee}
                    onChange={(e) => setFormData((p) => ({ ...p, employeeCode: e.target.value.toUpperCase() }))}
                    placeholder="EMP-NH-001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    disabled={!!editingEmployee}
                    onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                    placeholder="Login username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Employee full name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Mobile *</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData((p) => ({ ...p, mobile: e.target.value }))}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="employee@rupiksha.in"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    required
                  />
                </div>
                {!editingEmployee && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Initial Password *</label>
                    <input
                      type="password"
                      value={formData.initialPassword}
                      onChange={(e) => setFormData((p) => ({ ...p, initialPassword: e.target.value }))}
                      placeholder="Min 6 characters"
                      minLength={6}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Employee Role *</label>
                  <select
                    value={formData.role}
                    disabled={!!editingEmployee}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, role: e.target.value, reportingManagerId: '' }));
                      setSelectedStates([]);
                      setSelectedZones([]);
                      setCityClusters([]);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 text-sm font-semibold"
                  >
                    <option value="NATIONAL_HEADER">National Head</option>
                    <option value="STATE_HEADER">State Head</option>
                    <option value="REGIONAL_HEADER">Zonal Head</option>
                  </select>
                </div>

                {formData.role !== 'NATIONAL_HEADER' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Reporting Manager</label>
                    <select
                      value={formData.reportingManagerId}
                      onChange={(e) => setFormData((p) => ({ ...p, reportingManagerId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    >
                      <option value="">Direct to Admin</option>
                      {eligibleManagers
                        .filter((m) => !editingEmployee || m.id !== editingEmployee.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({m.employeeCode} · {m.roleDisplayName})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Office Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                    placeholder="City / office address"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>

              {/* GEOGRAPHICAL SCOPE CONFIGURATION */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Assigned Geographical Scope</h4>
                    <p className="text-xs text-slate-600">{ROLE_META[formData.role]?.desc}</p>
                  </div>
                </div>

                {formData.role === 'NATIONAL_HEADER' && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                    All India (National Scope across all states &amp; zones)
                  </div>
                )}

                {formData.role === 'REGIONAL_HEADER' && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-slate-700">1. Assign Standard Zones</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(zoneCatalog.zoneToStates || {}).map((zone) => {
                        const checked = selectedZones.includes(zone);
                        return (
                          <button
                            type="button"
                            key={zone}
                            onClick={() =>
                              setSelectedZones((prev) =>
                                checked ? prev.filter((z) => z !== zone) : [...prev, zone]
                              )
                            }
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
                              checked
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {zone}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="text-xs font-bold uppercase text-slate-700">2. Or Add Specific City / District Cluster (Optional)</div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={clusterDraft.stateName}
                          onChange={(e) => setClusterDraft((p) => ({ ...p, stateName: e.target.value }))}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                        >
                          <option value="">Any State</option>
                          {(zoneCatalog.allStates || []).map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={clusterDraft.cityOrDistrict}
                          onChange={(e) => setClusterDraft((p) => ({ ...p, cityOrDistrict: e.target.value }))}
                          placeholder="City or District name (e.g. Patna)"
                          className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs min-w-[210px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!clusterDraft.cityOrDistrict.trim()) return;
                            setCityClusters((prev) => [...prev, { ...clusterDraft, cityOrDistrict: clusterDraft.cityOrDistrict.trim() }]);
                            setClusterDraft({ stateName: '', cityOrDistrict: '' });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                        >
                          + Add Cluster
                        </button>
                      </div>
                      {cityClusters.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {cityClusters.map((c, idx) => (
                            <span
                              key={`${c.cityOrDistrict}-${idx}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold"
                            >
                              {c.cityOrDistrict}{c.stateName ? `, ${c.stateName}` : ''}
                              <button
                                type="button"
                                onClick={() => setCityClusters((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-rose-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(formData.role === 'STATE_HEADER' || formData.role === 'REGIONAL_HEADER') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-slate-700">
                        {formData.role === 'STATE_HEADER' ? 'Select Assigned States *' : 'Additional Specific States (Optional)'}
                      </span>
                      <input
                        type="text"
                        value={stateSearch}
                        onChange={(e) => setStateSearch(e.target.value)}
                        placeholder="Filter states..."
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 bg-white border border-slate-200 rounded-xl">
                      {filteredStateChoices.map((st) => {
                        const checked = selectedStates.includes(st);
                        return (
                          <label key={st} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedStates((prev) =>
                                  checked ? prev.filter((x) => x !== st) : [...prev, st]
                                )
                              }
                            />
                            <span className="truncate">{st}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* PERMISSION MATRIX */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Employee Permission Matrix</h4>
                    <p className="text-xs text-slate-600">
                      Read-only operational visibility plus optional controlled onboarding. Wallet, commission, settings, KYC approvals &amp; user modification remain locked.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                    {selectedPermissions.size} GRANTED
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {permCatalog.map((cat) => {
                    const allChecked = cat.items.every((i) => selectedPermissions.has(i.code));
                    return (
                      <div key={cat.category} className="border border-slate-200 rounded-2xl p-4 bg-white">
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                            {cat.categoryLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            {allChecked ? 'Clear All' : 'Enable All'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {cat.items.map((item) => {
                            const checked = selectedPermissions.has(item.code);
                            return (
                              <label key={item.code} className="flex items-start gap-2.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={checked}
                                  onChange={() => togglePermission(item.code)}
                                />
                                <div>
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    <span>{item.label}</span>
                                    {item.onboardingWrite && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                                        Onboarding Write
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{item.description}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {savingForm ? 'Saving...' : editingEmployee ? 'Save Employee Changes' : 'Provision Employee Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMPLOYEE PERFORMANCE INSPECTOR MODAL */}
      {selectedPerf && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">{selectedPerf.fullName}</h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">{selectedPerf.employeeCode}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_BADGE[selectedPerf.status]}`}>
                    {selectedPerf.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedPerf.roleDisplayName} · Scope: {selectedPerf.territoryLabel} · Reports to: {selectedPerf.reportingManagerName || 'Admin'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openPermissionPreview(selectedPerf.id)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Permission Preview
                </button>
                <button onClick={() => setSelectedPerf(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-xs font-bold text-slate-500 uppercase">Direct Onboarded Users</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{selectedPerf.directUsersOnboarded}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {selectedPerf.retailersOnboarded} R · {selectedPerf.distributorsOnboarded} D · {selectedPerf.superDistributorsOnboarded} SD
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-xs font-bold text-slate-500 uppercase">Hierarchy Total Users</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{selectedPerf.hierarchyTotalUsers}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {selectedPerf.hierarchyRetailers} R · {selectedPerf.hierarchyDistributors} D · {selectedPerf.hierarchySuperDistributors} SD
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-xs font-bold text-slate-500 uppercase">Hierarchy Transactions</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{selectedPerf.totalTransactions}</div>
                <div className="text-xs text-slate-600 mt-1">
                  Success: {selectedPerf.successTransactions} · Pending: {selectedPerf.pendingTransactions} · Failed: {selectedPerf.failedTransactions}
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-xs font-bold text-slate-500 uppercase">Total Transaction Volume</div>
                <div className="text-2xl font-extrabold text-indigo-700 mt-1">{formatINR(selectedPerf.totalVolume)}</div>
                <div className="text-xs text-slate-600 mt-1">Subordinate employees: {selectedPerf.subordinateEmployeesCount}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-2xl p-4">
                <h4 className="text-sm font-extrabold text-slate-900 mb-3">Service-Wise Breakdown</h4>
                {selectedPerf.serviceBreakdown?.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedPerf.serviceBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="totalCount" name="Txns" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-8 text-center">No transactions recorded in this employee&apos;s hierarchy.</p>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl p-4">
                <h4 className="text-sm font-extrabold text-slate-900 mb-3">Date-Wise Performance</h4>
                {selectedPerf.dailyPerformance?.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedPerf.dailyPerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="totalVolume" name="Volume" stroke="#4f46e5" fill="#e0e7ff" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-8 text-center">No date-wise metrics recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* READ-ONLY PERMISSION PREVIEW MODAL */}
      {permPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Read-Only Permission Preview · {permPreview.employee?.fullName}
                </h3>
                <p className="text-xs text-slate-600">
                  {permPreview.employee?.employeeCode} ({permPreview.employee?.roleDisplayName}) — Preview only; Admin does not impersonate employee sessions.
                </p>
              </div>
              <button onClick={() => setPermPreview(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(permPreview.matrix || []).map((cat) => (
                <div key={cat.category} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <div className="text-xs font-extrabold uppercase text-slate-800 mb-2">{cat.categoryLabel}</div>
                  <div className="space-y-1.5">
                    {(cat.items || []).map((it) => (
                      <div key={it.code} className="flex items-center justify-between text-xs">
                        <span className={it.allowed ? 'font-semibold text-slate-900' : 'text-slate-400'}>{it.label}</span>
                        <span className={`font-bold ${it.allowed ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {it.allowed ? 'ALLOWED' : 'DENIED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Reset Employee Password</h3>
              <button onClick={() => setResetTarget(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Setting a new password for <strong>{resetTarget.fullName}</strong> ({resetTarget.employeeCode}) immediately invalidates active sessions.
            </p>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
