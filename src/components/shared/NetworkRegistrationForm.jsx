import React, { useState } from 'react';
import {
    User, Smartphone, Mail, Building2, MapPin, Lock,
    Eye, EyeOff, Users, Globe, ChevronDown
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { sharedDataService } from '../../services/sharedDataService';

/**
 * Unified registration form used by:
 *   - Distributor portal → "Add New Retailer"
 *   - Super Distributor portal → "Add Retailer" / "Add Distributor"
 *
 * The field set mirrors the retailer self-registration form on the public
 * portal (see RetailerLogin.jsx), so onboarding is consistent regardless of
 * whether the applicant registers themselves or is registered by their upline.
 *
 * Submissions always hit /api/v1/auth/register via dataService.requestRegistration,
 * so the new user lands in PENDING status and must be approved by the admin.
 * The admin's approval modal auto-generates the party code (using
 * generateUniquePartyCode) just like for portal self-registrations — giving
 * every path the same ingredients in the admin approval screen (third photo).
 *
 * Parent linkage (distributor/SD network) is tracked client-side via
 * sharedDataService so the upline's own list shows the pending applicant.
 *
 * This same code path runs in local dev and in production; there are no
 * environment-specific branches.
 */

const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Delhi', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh',
    'Andaman and Nicobar Islands', 'Lakshadweep', 'Puducherry'
];

const DEFAULT_STATE = {
    name: '', mobile: '', email: '', businessName: '',
    city: '', pincode: '', address: '',
    password: '', confirmPassword: '',
    role: 'RETAILER', state: '', agreement: false
};

/**
 * Props:
 *   roleLock        — 'RETAILER' | 'DISTRIBUTOR' | null.
 *                     When non-null the role is locked and the dropdown is
 *                     rendered read-only. When null, user may choose.
 *   roleChoices     — list of role strings to show in the dropdown when
 *                     roleLock is null. Defaults to ['RETAILER'].
 *   onSuccess       — callback(applicant, result) after successful submission.
 *   onCancel        — callback() when user clicks the Back/Cancel link.
 *   uplineId        — the id of the distributor/SD adding this member, used
 *                     to track assignment locally via sharedDataService.
 *   uplineRole      — 'DISTRIBUTOR' | 'SUPER_DISTRIBUTOR' — controls which
 *                     local-assignment method is called.
 *   submitLabel     — CTA label (default: "Submit for Admin Approval").
 */
export default function NetworkRegistrationForm({
    roleLock = null,
    roleChoices = ['RETAILER'],
    onSuccess,
    onCancel,
    uplineId = null,
    uplineRole = null,
    submitLabel = 'Submit for Admin Approval'
}) {
    const [form, setForm] = useState({
        ...DEFAULT_STATE,
        role: roleLock || roleChoices[0] || 'RETAILER'
    });
    const [showPass, setShowPass] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const update = (patch) => setForm((f) => ({ ...f, ...patch }));

    const validate = () => {
        if (!form.name.trim()) return 'Full name is required';
        if (!/^\d{10}$/.test(form.mobile)) return 'Enter a valid 10-digit mobile number';
        if (!form.email.trim() || !/.+@.+\..+/.test(form.email)) return 'Enter a valid email';
        if (!form.businessName.trim()) return 'Business / shop name is required';
        if (!form.city.trim()) return 'City is required';
        if (!/^\d{6}$/.test(form.pincode)) return 'Enter a valid 6-digit pincode';
        if (!form.address.trim()) return 'Full address is required';
        if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters';
        if (form.password !== form.confirmPassword) return 'Passwords do not match';
        if (!form.state) return 'Please select a state';
        if (!form.agreement) return 'Please accept the communication agreement';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const msg = validate();
        if (msg) { setError(msg); return; }

        setSubmitting(true);
        try {
            const payload = {
                name: form.name,
                fullName: form.name,
                mobile: form.mobile,
                email: form.email,
                password: form.password,
                businessName: form.businessName,
                state: form.state,
                city: form.city,
                pincode: form.pincode,
                address: form.address,
                role: form.role
            };
            const roleText = String(uplineRole || '').toUpperCase();
            const currentUpline = roleText === 'DISTRIBUTOR'
                ? sharedDataService.getCurrentDistributor()
                : (roleText === 'SUPER_DISTRIBUTOR' ? sharedDataService.getCurrentSuperDistributor() : null);
            payload.addedByUserRef = String(uplineId || currentUpline?.id || '').trim() || null;
            payload.addedByName = String(currentUpline?.name || currentUpline?.fullName || '').trim() || null;
            payload.addedByRole = roleText || null;
            payload.addedByPartyCode = String(currentUpline?.partyCode || '').trim() || null;
            const result = await dataService.requestRegistration(payload);
            if (!result || !result.success) {
                setError(result?.message || 'Registration failed. Please try again.');
                return;
            }

            // Track the upline linkage locally so the distributor / SD sees
            // this pending applicant in their own network list. The
            // authoritative state of truth is the backend; this is a
            // convenience mirror while admin approval is pending.
            try {
                if (uplineId && uplineRole === 'DISTRIBUTOR' && form.role === 'RETAILER') {
                    sharedDataService.assignRetailerToDistributor(uplineId, form.mobile);
                }
                // Super Distributor upline linkage: sharedDataService doesn't
                // expose a dedicated "assignToSuperDistributor" helper, so we
                // fall back to recording the applicant against the SA via the
                // distributor helper only for added distributors. For SA-added
                // retailers, admin's "Assign Distributor" dropdown is the
                // source of truth after approval.
                if (uplineId && uplineRole === 'SUPER_DISTRIBUTOR' && form.role === 'DISTRIBUTOR') {
                    // No direct helper — we rely on the admin's approval flow
                    // to tag ownerId via the Assign Distributor picker.
                    // Leaving a breadcrumb via localStorage so SA can see it.
                    try {
                        const pending = JSON.parse(localStorage.getItem('sa_pending_network') || '[]');
                        pending.push({
                            saId: uplineId,
                            mobile: form.mobile,
                            name: form.name,
                            role: form.role,
                            submittedAt: new Date().toISOString()
                        });
                        localStorage.setItem('sa_pending_network', JSON.stringify(pending));
                    } catch { /* non-fatal */ }
                }
            } catch { /* non-fatal */ }

            if (onSuccess) onSuccess({ ...form }, result);
        } catch (err) {
            setError('Network error: ' + (err?.message || 'unknown'));
        } finally {
            setSubmitting(false);
        }
    };

    const roleLocked = !!roleLock;
    const showRoleDropdown = !roleLocked && roleChoices.length > 1;

    return (
        <form
            onSubmit={handleSubmit}
            autoComplete="off"
            className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar"
        >
            {/* Honeypots to absorb any pre-filled admin credentials from the browser */}
            <input type="text" name="fake_username_nrf" autoComplete="username" tabIndex={-1} className="hidden" />
            <input type="password" name="fake_password_nrf" autoComplete="current-password" tabIndex={-1} className="hidden" />

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold px-3 py-2 rounded-xl">
                    {error}
                </div>
            )}

            <Field icon={User}>
                <input
                    type="text" placeholder="Full Name" value={form.name}
                    name="nrf_fullname" autoComplete="off"
                    onChange={(e) => update({ name: e.target.value })} required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                />
            </Field>

            <Field icon={Smartphone}>
                <input
                    type="tel" placeholder="Mobile Number" value={form.mobile}
                    name="nrf_mobile" autoComplete="off"
                    onChange={(e) => update({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                />
            </Field>

            <Field icon={Mail}>
                <input
                    type="email" placeholder="Email" value={form.email}
                    name="nrf_email" autoComplete="off"
                    onChange={(e) => update({ email: e.target.value })} required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                />
            </Field>

            <Field icon={Building2}>
                <input
                    type="text" placeholder="Business / Shop Name" value={form.businessName}
                    name="nrf_business" autoComplete="off"
                    onChange={(e) => update({ businessName: e.target.value })} required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field icon={MapPin}>
                    <input
                        type="text" placeholder="City" value={form.city}
                        onChange={(e) => update({ city: e.target.value })} required
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                    />
                </Field>
                <Field icon={MapPin}>
                    <input
                        type="text" placeholder="Pincode" value={form.pincode}
                        onChange={(e) => update({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                    />
                </Field>
            </div>

            <div className="relative">
                <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
                <textarea
                    placeholder="Full Address" value={form.address}
                    onChange={(e) => update({ address: e.target.value })} required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 min-h-[60px] resize-none"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type={showPass ? 'text' : 'password'}
                        placeholder="Password (min 8 chars)"
                        value={form.password}
                        onChange={(e) => update({ password: e.target.value })}
                        required minLength={8} maxLength={100}
                        autoComplete="new-password" name="nrf_password"
                        className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type={showPass ? 'text' : 'password'}
                        placeholder="Confirm Password"
                        value={form.confirmPassword}
                        onChange={(e) => update({ confirmPassword: e.target.value })}
                        required minLength={8} maxLength={100}
                        autoComplete="new-password" name="nrf_confirm"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    {showRoleDropdown ? (
                        <>
                            <select
                                value={form.role}
                                onChange={(e) => update({ role: e.target.value })}
                                required
                                className="w-full pl-10 pr-8 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-[11px] font-black uppercase appearance-none text-slate-900"
                            >
                                {roleChoices.map((r) => (
                                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        </>
                    ) : (
                        <input
                            type="text" readOnly
                            value={(roleLock || form.role).replace(/_/g, ' ')}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none text-[11px] font-black uppercase text-slate-700 cursor-not-allowed"
                            title="Role is fixed for this registration flow"
                        />
                    )}
                </div>
                <div className="relative">
                    <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                        value={form.state}
                        onChange={(e) => update({ state: e.target.value })}
                        required
                        className="w-full pl-10 pr-8 py-3 bg-white border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-[11px] font-black uppercase appearance-none text-slate-900"
                    >
                        <option value="">State</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer mt-1">
                <input
                    type="checkbox" checked={form.agreement}
                    onChange={(e) => update({ agreement: e.target.checked })} required
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600"
                />
                <span className="text-[9px] font-bold text-slate-500 uppercase leading-tight">
                    I agree to receive communication over WhatsApp, RCS service, mobile & email.
                </span>
            </label>

            <div className="pt-1 flex gap-3">
                {onCancel && (
                    <button
                        type="button" onClick={onCancel}
                        className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit" disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-black py-3 rounded-xl text-[11px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                >
                    {submitting ? 'Submitting...' : submitLabel}
                </button>
            </div>

            <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-2">
                Admin will review and approve. Party code is generated at approval.
            </p>
        </form>
    );
}

function Field({ icon: Icon, children }) {
    return (
        <div className="relative">
            {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
            {children}
        </div>
    );
}
