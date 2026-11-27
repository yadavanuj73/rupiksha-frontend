import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, CheckCircle2, AlertCircle, Building2, Shield, MapPin, CreditCard } from 'lucide-react';
import { employeePortalService } from '../services/employeeApiService';
import { indiaData } from '../data/indiaData';

const INDIAN_STATES = Object.keys(indiaData);

const EMPTY_FORM = {
  role: '',
  fullName: '',
  username: '',
  mobile: '',
  email: '',
  password: '',
  pin: '',
  businessName: '',
  businessType: 'Sole proprietorship',
  gstNumber: '',
  state: '',
  city: '',
  district: '',
  zoneName: '',
  pincode: '',
  address: '',
  shopAddress: '',
  shopLandmark: '',
  permanentAddress: '',
  fatherName: '',
  dob: '',
  gender: 'Male',
  aadhaarNumber: '',
  panNumber: '',
  bankAccountHolder: '',
  bankName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankBranch: '',
  parentUserId: '',
};

export default function EmployeeOnboardTab({ employee, permissionsSet, zoneCatalog, onOnboardSuccess }) {
  const allowedCreateRoles = useMemo(() => {
    const list = [];
    if (permissionsSet.has('CREATE_RETAILER_ACCOUNT')) list.push({ value: 'RETAILER', label: 'Retailer' });
    if (permissionsSet.has('CREATE_DISTRIBUTOR_ACCOUNT')) list.push({ value: 'DISTRIBUTOR', label: 'Distributor' });
    if (permissionsSet.has('CREATE_SUPER_DISTRIBUTOR_ACCOUNT')) list.push({ value: 'SUPER_DISTRIBUTOR', label: 'Super Distributor' });
    return list;
  }, [permissionsSet]);

  const permittedScopeOptions = useMemo(() => {
    const role = String(employee?.role || '').toUpperCase();
    const allStates = zoneCatalog?.allStates?.length ? zoneCatalog.allStates : INDIAN_STATES;
    const zoneToStates = zoneCatalog?.zoneToStates || {};

    if (role === 'NATIONAL_HEADER') {
      return {
        states: allStates,
        zones: Object.keys(zoneToStates),
        cities: [],
        fixedZone: false,
      };
    }

    const scopes = Array.isArray(employee?.scopes) ? employee.scopes : [];
    const stateSet = new Set();
    const zoneSet = new Set();
    const citySet = new Set();

    scopes.forEach((s) => {
      if (s.stateName) stateSet.add(s.stateName);
      if (s.zoneName) {
        zoneSet.add(s.zoneName);
        if (!s.stateName && Array.isArray(zoneToStates[s.zoneName])) {
          zoneToStates[s.zoneName].forEach((st) => stateSet.add(st));
        }
      }
      if (s.cityOrDistrict) citySet.add(s.cityOrDistrict);
    });

    return {
      states: stateSet.size ? Array.from(stateSet).sort() : [],
      zones: zoneSet.size ? Array.from(zoneSet).sort() : Object.keys(zoneToStates),
      cities: Array.from(citySet).sort(),
      fixedZone: role === 'REGIONAL_HEADER',
    };
  }, [employee, zoneCatalog]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [candidateParents, setCandidateParents] = useState([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdMember, setCreatedMember] = useState(null);

  useEffect(() => {
    if (allowedCreateRoles.length > 0 && !allowedCreateRoles.some((r) => r.value === form.role)) {
      setForm((prev) => ({
        ...prev,
        role: allowedCreateRoles[0].value,
        state: permittedScopeOptions.states[0] || prev.state,
        zoneName: permittedScopeOptions.zones[0] || prev.zoneName,
        city: permittedScopeOptions.cities[0] || prev.city,
      }));
    }
  }, [allowedCreateRoles, permittedScopeOptions]);

  useEffect(() => {
    let active = true;
    const loadParents = async () => {
      if (!form.role || form.role === 'SUPER_DISTRIBUTOR') {
        setCandidateParents([]);
        return;
      }
      setLoadingParents(true);
      try {
        const res = await employeePortalService.getCandidateParents(form.role);
        if (active) setCandidateParents(Array.isArray(res) ? res : []);
      } catch {
        if (active) setCandidateParents([]);
      } finally {
        if (active) setLoadingParents(false);
      }
    };
    loadParents();
    return () => {
      active = false;
    };
  }, [form.role]);

  if (allowedCreateRoles.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <Shield className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Onboarding Not Permitted</h3>
        <p className="text-sm text-slate-600 mt-1">
          Your Admin has not granted account creation permissions to your profile.
        </p>
      </div>
    );
  }

  const updateField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCreatedMember(null);

    if (!form.role) {
      setError('Please select a permitted account role.');
      return;
    }
    if (!form.fullName.trim() || !form.username.trim() || !form.mobile.trim() || !form.email.trim() || !form.password) {
      setError('Full name, username, mobile, email, and initial password are required.');
      return;
    }
    if (!form.state) {
      setError('Please select a permitted state within your hierarchy scope.');
      return;
    }
    if (permittedScopeOptions.cities.length > 0 && !form.city.trim()) {
      setError('Please select a city/district within your assigned Zonal Head scope.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        shopState: form.state,
        shopCity: form.city,
        shopDistrict: form.district || form.city,
        shopPincode: form.pincode,
        shopAddress: form.shopAddress || form.address,
        permState: form.state,
        permCity: form.city,
        permDistrict: form.district || form.city,
        permPincode: form.pincode,
        parentUserId: form.parentUserId || null,
      };
      const result = await employeePortalService.onboardMember(payload);
      setCreatedMember(result);
      setForm((prev) => ({
        ...EMPTY_FORM,
        role: prev.role,
        state: permittedScopeOptions.states[0] || '',
        zoneName: permittedScopeOptions.zones[0] || '',
        city: permittedScopeOptions.cities[0] || '',
      }));
      if (onOnboardSuccess) onOnboardSuccess(result);
    } catch (err) {
      setError(err?.message || 'Unable to onboard member.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Controlled Partner Onboarding
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Create new partner accounts strictly within your assigned geographical scope ({employee?.territoryLabel || employee?.roleDisplayName}). Accounts remain read-only after creation.
            </p>
          </div>
          <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
            Post-creation edits & KYC approval remain Admin-only
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {createdMember && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <div className="font-bold">Account Onboarded Successfully</div>
              <div className="text-xs text-emerald-800 mt-1">
                <span className="font-semibold">{createdMember.fullName}</span> ({createdMember.role}) · Party Code:{' '}
                <span className="font-mono font-bold">{createdMember.partyCode}</span> · State: {createdMember.stateName} · KYC: {createdMember.kycStatus}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Role & Hierarchy Parent */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Permitted Account Role *
              </label>
              <select
                value={form.role}
                onChange={(e) => updateField('role', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
                required
              >
                {allowedCreateRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {form.role !== 'SUPER_DISTRIBUTOR' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Parent Upline (In Scope)
                </label>
                <select
                  value={form.parentUserId}
                  onChange={(e) => updateField('parentUserId', e.target.value)}
                  disabled={loadingParents}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Direct / Unassigned Parent</option>
                  {candidateParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.partyCode || p.role}) - {p.stateName || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder="Partner full name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Username *
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                placeholder="Login username"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Mobile Number *
              </label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => updateField('mobile', e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="partner@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Initial Password *
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Security PIN (Optional)
              </label>
              <input
                type="password"
                value={form.pin}
                onChange={(e) => updateField('pin', e.target.value)}
                placeholder="4-6 digit TPIN"
                maxLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Business / Shop Name
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => updateField('businessName', e.target.value)}
                placeholder="Registered shop or firm name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
              />
            </div>
          </div>

          {/* Geographical Scope Section */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-indigo-600" />
              Permitted Geographical Scope & Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  State (In Scope) *
                </label>
                {permittedScopeOptions.states.length > 0 ? (
                  <select
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                    required
                  >
                    <option value="">Select state...</option>
                    {permittedScopeOptions.states.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    placeholder="Enter state in scope"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Zone
                </label>
                <select
                  value={form.zoneName}
                  onChange={(e) => updateField('zoneName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                >
                  <option value="">Auto-detect from State</option>
                  {permittedScopeOptions.zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  City / District {permittedScopeOptions.cities.length > 0 ? '*' : ''}
                </label>
                {permittedScopeOptions.cities.length > 0 ? (
                  <select
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                    required
                  >
                    <option value="">Select permitted city...</option>
                    {permittedScopeOptions.cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="City or district"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Pincode
                </label>
                <input
                  type="text"
                  value={form.pincode}
                  onChange={(e) => updateField('pincode', e.target.value)}
                  placeholder="6-digit pincode"
                  maxLength={6}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Shop / Business Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Full street address & landmark"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                />
              </div>
            </div>
          </div>

          {/* KYC & Banking Metadata (Read-only submission for Admin KYC Review) */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              KYC & Settlement Metadata (Optional — Admin Approves KYC)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  PAN Number
                </label>
                <input
                  type="text"
                  value={form.panNumber}
                  onChange={(e) => updateField('panNumber', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  value={form.aadhaarNumber}
                  onChange={(e) => updateField('aadhaarNumber', e.target.value)}
                  placeholder="12-digit Aadhaar"
                  maxLength={12}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(e) => updateField('bankName', e.target.value)}
                  placeholder="Bank name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={form.bankIfsc}
                  onChange={(e) => updateField('bankIfsc', e.target.value.toUpperCase())}
                  placeholder="SBIN0001234"
                  maxLength={11}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  value={form.bankAccountNumber}
                  onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                  placeholder="Account number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={form.bankAccountHolder}
                  onChange={(e) => updateField('bankAccountHolder', e.target.value)}
                  placeholder="Beneficiary name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Father&apos;s Name
                </label>
                <input
                  type="text"
                  value={form.fatherName}
                  onChange={(e) => updateField('fatherName', e.target.value)}
                  placeholder="Father's full name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  GST Number
                </label>
                <input
                  type="text"
                  value={form.gstNumber}
                  onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase())}
                  placeholder="Optional GSTIN"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm uppercase"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-bold shadow-sm transition cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              {submitting ? 'Creating Partner Account...' : 'Create Permitted Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
