import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Smartphone, Mail, Building2, MapPin, Lock,
    Eye, EyeOff, Users, Globe, ChevronDown, CreditCard,
    Camera, Upload, Image as ImageIcon, KeyRound, Sparkles,
    ShieldCheck, CheckCircle2, AlertCircle, ArrowRight,
    ArrowLeft, RefreshCw, Building, Check
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { sharedDataService } from '../../services/sharedDataService';
import { adminService } from '../../services/apiService';

const INDIAN_STATES = [
    "BIHAR",
    "MAHARASHTRA",
    "UTTAR PRADESH",
    "DELHI",
    "WEST BENGAL",
    "RAJASTHAN",
    "PUNJAB",
    "HARYANA",
    "GUJARAT",
    "KARNATAKA",
    "TAMIL NADU",
    "TELANGANA",
    "ANDHRA PRADESH",
    "MADHYA PRADESH",
    "ODISHA",
    "JHARKHAND",
    "CHHATTISGARH",
    "ASSAM",
    "KERALA",
    "UTTARAKHAND",
    "HIMACHAL PRADESH",
    "JAMMU AND KASHMIR",
    "GOA",
    "MANIPUR",
    "MEGHALAYA",
    "MIZORAM",
    "NAGALAND",
    "SIKKIM",
    "TRIPURA",
    "ARUNACHAL PRADESH",
    "PUDUCHERRY",
    "CHANDIGARH",
    "LADAKH",
    "ANDAMAN AND NICOBAR ISLANDS",
    "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
    "LAKSHADWEEP"
];

const DEFAULT_FORM_STATE = {
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
    pin: '',
    confirmPin: '',
    role: 'RETAILER',
    state: 'BIHAR',
    city: '',
    pincode: '',
    address: '',
    shopAddress: '',
    permanentAddress: '',
    businessName: '',
    businessType: 'Retail Store',
    parentUserId: '',
    dob: '',
    fatherName: '',
    gender: 'Male',
    gstNumber: '',
    aadhaarNumber: '',
    panNumber: '',
    bankName: '',
    bankAccountHolder: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    upiId: '',
    photoUrl: '',
    aadhaarPhotoUrl: '',
    aadhaarBackPhotoUrl: '',
    panPhotoUrl: '',
    shopPhotoUrl: '',
    bankPassbookUrl: '',
    liveSelfieUrl: '',
    electricityBillUrl: '',
    agreement: true
};

/**
 * Unified Partner Registration Form for Distributor / Super Distributor Portals
 * Matches the fields and aesthetics of RegisterWizard (/register) while skipping OTP verification.
 */
export default function NetworkRegistrationForm({
    roleLock = null,
    roleChoices = ['RETAILER'],
    onSuccess,
    onCancel,
    uplineId = null,
    uplineRole = null,
    submitLabel = 'Register Partner (Auto-Approved)'
}) {
    const [step, setStep] = useState(1); // 1: Account Details, 2: PIN, KYC, Business & Documents
    const [form, setForm] = useState({
        ...DEFAULT_FORM_STATE,
        role: roleLock || roleChoices[0] || 'RETAILER',
        parentUserId: uplineId || ''
    });

    const roleText = String(uplineRole || '').toUpperCase();
    const currentUpline = roleText === 'DISTRIBUTOR'
        ? (sharedDataService.getCurrentDistributor() || (uplineId ? sharedDataService.getDistributorById(uplineId) : null))
        : (roleText === 'SUPER_DISTRIBUTOR'
            ? (sharedDataService.getCurrentSuperDistributor() || (uplineId ? sharedDataService.getSuperDistributorById(uplineId) : null))
            : (sharedDataService.getCurrentDistributor() || sharedDataService.getCurrentSuperDistributor() || (uplineId ? sharedDataService.getDistributorById(uplineId) : null)));

    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [parents, setParents] = useState([]);

    const update = (patch) => {
        setForm((prev) => ({ ...prev, ...patch }));
        if (error) setError('');
    };

    // Load Candidate Parents
    useEffect(() => {
        adminService.getCandidateParents()
            .then(res => {
                if (res && res.parents) setParents(res.parents);
            })
            .catch(() => {});
    }, []);

    // Handle Input change
    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'aadhaarNumber') {
            const digitsOnly = value.replace(/\D/g, '').slice(0, 12);
            update({ aadhaarNumber: digitsOnly });
            return;
        }

        if (name === 'pincode') {
            const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
            update({ pincode: digitsOnly });
            if (digitsOnly.length === 6) {
                fetchPincodeDetails(digitsOnly);
            }
            return;
        }

        update({ [name]: value });
    };

    // Pincode auto-lookup for City and State
    const fetchPincodeDetails = async (pin) => {
        try {
            const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
            const data = await res.json();
            if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
                const po = data[0].PostOffice[0];
                const stateName = po.State ? po.State.toUpperCase() : '';
                const cityName = po.District || po.Block || po.Name || '';
                const matchedState = INDIAN_STATES.find(s => s === stateName || stateName.includes(s) || s.includes(stateName));

                update({
                    city: cityName || form.city,
                    state: matchedState || form.state
                });
            }
        } catch (err) {
            console.warn('Pincode fetch error:', err);
        }
    };

    // Handle File Upload (Data URL)
    const handleFileUpload = (field, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setError('Image file size should be less than 5MB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            update({ [field]: reader.result });
        };
        reader.readAsDataURL(file);
    };

    // Validate Step 1
    const handleStep1Continue = (e) => {
        e.preventDefault();
        setError('');

        if (!form.firstName.trim()) {
            setError('First Name is required');
            return;
        }
        if (!form.lastName.trim()) {
            setError('Last Name is required');
            return;
        }
        if (!form.mobile || !/^\d{10}$/.test(form.mobile.trim())) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }
        if (!form.password || form.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Proceed to Step 2 (Skipping OTP)
        setStep(2);
    };

    // Validate Step 2 & Submit
    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.pin || form.pin.length < 4) {
            setError('Security Login PIN must be at least 4 digits');
            return;
        }
        if (form.pin !== form.confirmPin) {
            setError('Login PINs do not match');
            return;
        }
        if (!form.businessName.trim()) {
            setError('Business / Shop Name is required');
            return;
        }
        if (!form.shopAddress.trim()) {
            setError('Shop Address is required');
            return;
        }
        if (!form.permanentAddress.trim()) {
            setError('Permanent Address is required');
            return;
        }
        if (!form.pincode || form.pincode.length !== 6) {
            setError('Valid 6-digit Pincode is required');
            return;
        }
        if (!form.state) {
            setError('State is required');
            return;
        }
        if (!form.city.trim()) {
            setError('City / District is required');
            return;
        }
        if (form.aadhaarNumber && form.aadhaarNumber.length !== 12) {
            setError('Aadhaar Number must be exactly 12 digits');
            return;
        }
        if (!form.aadhaarPhotoUrl) {
            setError('Aadhaar Front image is required');
            return;
        }
        if (!form.aadhaarBackPhotoUrl) {
            setError('Aadhaar Back image is required');
            return;
        }
        if (!form.panPhotoUrl) {
            setError('PAN Card image is required');
            return;
        }
        if (!form.shopPhotoUrl) {
            setError('Shop Photo is required');
            return;
        }
        if (!form.liveSelfieUrl) {
            setError('User Live Selfie image is required');
            return;
        }

        setSubmitting(true);
        try {
            const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
            const username = form.mobile.trim();
            const email = form.email.trim() || `${username}@rupiksha.local`;

            const roleText = String(uplineRole || '').toUpperCase();
            const currentUpline = roleText === 'DISTRIBUTOR'
                ? (sharedDataService.getCurrentDistributor() || (uplineId ? sharedDataService.getDistributorById(uplineId) : null))
                : (roleText === 'SUPER_DISTRIBUTOR' ? (sharedDataService.getCurrentSuperDistributor() || (uplineId ? sharedDataService.getSuperDistributorById(uplineId) : null)) : null);

            const payload = {
                username: username,
                mobile: form.mobile.trim(),
                email: email,
                fullName: fullName,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                password: form.password,
                pin: form.pin.trim(),
                role: form.role,
                state: form.state.trim(),
                city: form.city.trim(),
                pincode: form.pincode.trim(),
                address: form.shopAddress.trim() || form.permanentAddress.trim(),
                shopAddress: form.shopAddress.trim(),
                permanentAddress: form.permanentAddress.trim(),
                businessName: form.businessName.trim(),
                businessType: form.businessType?.trim() || 'Retail Store',
                parentUserId: String(uplineId || form.parentUserId || currentUpline?.id || '').trim() || null,
                addedByUserRef: String(uplineId || form.parentUserId || currentUpline?.id || '').trim() || null,
                addedByName: String(currentUpline?.fullName || currentUpline?.name || '').trim() || null,
                addedByRole: roleText || null,
                addedByPartyCode: String(currentUpline?.partyCode || '').trim() || null,
                addedByMobile: String(currentUpline?.mobile || '').trim() || null,
                ownerId: String(uplineId || form.parentUserId || currentUpline?.id || '').trim() || null,
                ownerName: String(currentUpline?.fullName || currentUpline?.name || '').trim() || null,
                ownerPartyCode: String(currentUpline?.partyCode || '').trim() || null,
                ownerMobile: String(currentUpline?.mobile || '').trim() || null,
                dob: form.dob?.trim() || '',
                fatherName: form.fatherName?.trim() || '',
                gender: form.gender || 'Male',
                gstNumber: form.gstNumber?.trim() || '',
                aadhaarNumber: form.aadhaarNumber?.trim() || '',
                panNumber: form.panNumber?.trim()?.toUpperCase() || '',
                bankName: form.bankName?.trim() || '',
                bankAccountHolder: form.bankAccountHolder?.trim() || fullName,
                bankAccountNumber: form.bankAccountNumber?.trim() || '',
                bankIfsc: form.bankIfsc?.trim()?.toUpperCase() || '',
                bankBranch: form.bankBranch?.trim() || '',
                upiId: form.upiId?.trim() || '',
                photoUrl: form.liveSelfieUrl || form.photoUrl,
                aadhaarPhotoUrl: form.aadhaarPhotoUrl,
                aadhaarBackPhotoUrl: form.aadhaarBackPhotoUrl,
                panPhotoUrl: form.panPhotoUrl,
                shopPhotoUrl: form.shopPhotoUrl,
                bankPassbookUrl: form.bankPassbookUrl,
                liveSelfieUrl: form.liveSelfieUrl,
                voterIdUrl: form.electricityBillUrl || form.voterIdUrl,
                electricityBillUrl: form.electricityBillUrl
            };

            const result = await dataService.requestRegistration(payload);
            if (!result || !result.success) {
                setError(result?.message || 'Registration failed. Please verify details.');
                return;
            }

            // Link member locally so upline dashboard immediately reflects the addition
            try {
                if (uplineId && uplineRole === 'DISTRIBUTOR' && form.role === 'RETAILER') {
                    sharedDataService.assignRetailerToDistributor(uplineId, form.mobile);
                }
                if (uplineId && uplineRole === 'SUPER_DISTRIBUTOR' && form.role === 'DISTRIBUTOR') {
                    try {
                        const pending = JSON.parse(localStorage.getItem('sa_pending_network') || '[]');
                        pending.push({
                            saId: uplineId,
                            mobile: form.mobile,
                            name: fullName,
                            role: form.role,
                            submittedAt: new Date().toISOString()
                        });
                        localStorage.setItem('sa_pending_network', JSON.stringify(pending));
                    } catch {}
                }
            } catch {}

            if (onSuccess) onSuccess({ ...form, fullName }, result);
        } catch (err) {
            setError('Error: ' + (err?.message || 'Registration failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const roleLocked = !!roleLock;
    const showRoleDropdown = !roleLocked && roleChoices.length > 1;

    return (
        <div className="w-full flex flex-col">
            {/* Blue Header Pill Banner */}
            <div className="bg-blue-600 py-2.5 px-4 text-center shadow-sm -mt-2 -mx-2 sm:-mx-4 rounded-xl mb-3">
                <span className="text-white text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
                    {step === 1 ? '1. ACCOUNT DETAILS & CREDENTIALS' : '2. ONBOARDING, KYC & DOCUMENTS'}
                </span>
            </div>

            {/* Stepper Indicator */}
            <div className="flex items-center justify-between mb-4 px-4 sm:px-10 relative shrink-0">
                <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
                <div 
                    className="absolute top-1/2 left-10 h-0.5 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-300"
                    style={{ width: step === 1 ? '0%' : '100%' }}
                />

                {[
                    { num: 1, label: 'Account Details' },
                    { num: 2, label: 'PIN & Documents' }
                ].map((s) => (
                    <div key={s.num} className="relative z-10 flex flex-col items-center">
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                            step > s.num
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                : step === s.num
                                ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                            {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                        </div>
                        <span className={`text-[10px] sm:text-[11px] font-bold mt-1 ${step >= s.num ? 'text-blue-600' : 'text-slate-400'}`}>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Error Alert */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-2.5 mb-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-600 text-xs font-semibold shrink-0"
                    >
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                        <span>{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── STEP 1: ACCOUNT DETAILS ── */}
            {step === 1 && (
                <form onSubmit={handleStep1Continue} className="space-y-3.5 text-left max-h-[60vh] overflow-y-auto pr-1">
                    {/* First Name & Last Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                First Name *
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    name="firstName"
                                    value={form.firstName}
                                    onChange={handleChange}
                                    placeholder="First Name"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Last Name *
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    name="lastName"
                                    value={form.lastName}
                                    onChange={handleChange}
                                    placeholder="Last Name"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Mobile & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Mobile Number * (10 Digits)
                            </label>
                            <div className="relative">
                                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="tel"
                                    name="mobile"
                                    maxLength={10}
                                    value={form.mobile}
                                    onChange={(e) => update({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                    placeholder="e.g. 9876543210"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 text-xs sm:text-sm text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="partner@rupiksha.com"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Password & Confirm Password */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Password * (Min 6 Chars)
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="••••••••••••"
                                    required
                                    minLength={6}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-9 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Confirm Password *
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type={showConfirmPass ? 'text' : 'password'}
                                    name="confirmPassword"
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••••••"
                                    required
                                    minLength={6}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-9 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showConfirmPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Role & Parent Assignment */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Partner Role
                            </label>
                            {showRoleDropdown ? (
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                                    <select
                                        value={form.role}
                                        onChange={(e) => update({ role: e.target.value })}
                                        className="w-full bg-blue-50/70 border border-blue-200 rounded-xl pl-9.5 pr-8 py-2 text-xs sm:text-sm font-bold text-blue-700 uppercase focus:outline-none focus:border-blue-600 appearance-none shadow-sm"
                                    >
                                        {roleChoices.map((r) => (
                                            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600" />
                                </div>
                            ) : (
                                <div className="w-full bg-blue-50/80 border border-blue-200 rounded-xl px-3 py-2 flex items-center justify-between shadow-sm">
                                    <span className="text-xs sm:text-sm font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 text-blue-600" /> {form.role}
                                    </span>
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full uppercase tracking-widest">Default</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Assigned Parent / Upline
                            </label>
                            {currentUpline || uplineId ? (
                                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between shadow-sm">
                                    <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5 truncate">
                                        <User className="w-4 h-4 text-blue-600 shrink-0" />
                                        <span className="truncate">
                                            {currentUpline?.fullName || currentUpline?.name || 'Distributor'} {currentUpline?.partyCode ? `(${currentUpline.partyCode})` : (currentUpline?.username ? `(${currentUpline.username})` : '')}
                                        </span>
                                    </span>
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0 ml-1">
                                        {uplineRole ? uplineRole.replace(/_/g, ' ') : (currentUpline?.role || 'DISTRIBUTOR')}
                                    </span>
                                </div>
                            ) : (
                                <select
                                    name="parentUserId"
                                    value={form.parentUserId}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                                >
                                    <option value="">-- Direct Parent / Upline --</option>
                                    {parents.filter(p => p.role !== 'RETAILER').map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.fullName} ({p.partyCode || p.username}) - {p.role}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Step 1 Actions */}
                    <div className="pt-2 flex gap-3">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-slate-200 transition-all"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all active:scale-[0.99]"
                        >
                            Continue to KYC & Documents <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            )}

            {/* ── STEP 2: PIN, BUSINESS, KYC & DOCUMENTS ── */}
            {step === 2 && (
                <form onSubmit={handleFinalSubmit} className="space-y-3.5 text-left max-h-[60vh] overflow-y-auto pr-1">
                    {/* 1. Create Security Login PIN */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                            <KeyRound className="w-4 h-4 text-blue-600" />
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">1. Security Login PIN</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                                    4-Digit Login PIN *
                                </label>
                                <input
                                    type="password"
                                    name="pin"
                                    maxLength={4}
                                    value={form.pin}
                                    onChange={handleChange}
                                    placeholder="••••"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                                    Confirm Login PIN *
                                </label>
                                <input
                                    type="password"
                                    name="confirmPin"
                                    maxLength={4}
                                    value={form.confirmPin}
                                    onChange={handleChange}
                                    placeholder="••••"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Business & Address Details */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                            <Building className="w-4 h-4 text-blue-600" />
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Business & Address Details</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Shop / Business Name *</label>
                                <input 
                                    type="text" 
                                    name="businessName" 
                                    value={form.businessName} 
                                    onChange={handleChange} 
                                    placeholder="e.g. Rupiksha Digital Hub"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Shop Address *</label>
                                <input 
                                    type="text" 
                                    name="shopAddress" 
                                    value={form.shopAddress} 
                                    onChange={handleChange} 
                                    placeholder="e.g. Main Market, Station Road"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Permanent Address *</label>
                                <input 
                                    type="text" 
                                    name="permanentAddress" 
                                    value={form.permanentAddress} 
                                    onChange={handleChange} 
                                    placeholder="e.g. Village/Town, Post Office"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                    Pincode * <span className="text-[9px] text-blue-600 font-semibold">(Auto-fills City & State)</span>
                                </label>
                                <input 
                                    type="text" 
                                    name="pincode" 
                                    maxLength={6} 
                                    value={form.pincode} 
                                    onChange={handleChange} 
                                    placeholder="6 Digit Pincode (e.g. 842001)"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm font-mono" 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">State *</label>
                                <select 
                                    name="state" 
                                    value={form.state} 
                                    onChange={handleChange} 
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm"
                                >
                                    {INDIAN_STATES.map(st => (
                                        <option key={st} value={st}>{st}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">City / District *</label>
                                <input 
                                    type="text" 
                                    name="city" 
                                    value={form.city} 
                                    onChange={handleChange} 
                                    placeholder="e.g. Muzaffarpur"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. KYC & Finance Details */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">3. KYC & Finance Details</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                    Aadhaar Number * <span className="text-[9px] text-slate-400">(12 Digits)</span>
                                </label>
                                <input 
                                    type="text" 
                                    name="aadhaarNumber" 
                                    maxLength={12} 
                                    value={form.aadhaarNumber} 
                                    onChange={handleChange} 
                                    placeholder="12 Digit Aadhaar Number"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono tracking-wider focus:border-blue-600 focus:outline-none shadow-sm" 
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">PAN Card Number *</label>
                                <input 
                                    type="text" 
                                    name="panNumber" 
                                    maxLength={10} 
                                    value={form.panNumber} 
                                    onChange={handleChange} 
                                    placeholder="10 Digit PAN (e.g. ABCDE1234F)"
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 uppercase font-mono tracking-wider focus:border-blue-600 focus:outline-none shadow-sm" 
                                />
                            </div>
                        </div>

                        <div className="pt-1.5 border-t border-slate-200">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5">Bank Account & Settlement Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Account Holder *</label>
                                    <input 
                                        type="text" 
                                        name="bankAccountHolder" 
                                        value={form.bankAccountHolder} 
                                        onChange={handleChange} 
                                        placeholder="Holder Name"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Account Number *</label>
                                    <input 
                                        type="text" 
                                        name="bankAccountNumber" 
                                        value={form.bankAccountNumber} 
                                        onChange={handleChange} 
                                        placeholder="Account Number"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-600 focus:outline-none shadow-sm" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Bank Name *</label>
                                    <input 
                                        type="text" 
                                        name="bankName" 
                                        value={form.bankName} 
                                        onChange={handleChange} 
                                        placeholder="e.g. State Bank of India"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">IFSC Code *</label>
                                    <input 
                                        type="text" 
                                        name="bankIfsc" 
                                        value={form.bankIfsc} 
                                        onChange={handleChange} 
                                        placeholder="e.g. SBIN0001234"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 uppercase font-mono focus:border-blue-600 focus:outline-none shadow-sm" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">UPI ID (Optional)</label>
                                    <input 
                                        type="text" 
                                        name="upiId" 
                                        value={form.upiId} 
                                        onChange={handleChange} 
                                        placeholder="e.g. name@upi"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shadow-sm" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Document & Photo Uploads */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                            <Camera className="w-4 h-4 text-blue-600" />
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">4. Document & Photo Uploads</h3>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[
                                { key: 'aadhaarPhotoUrl', label: 'Aadhaar Front', required: true },
                                { key: 'aadhaarBackPhotoUrl', label: 'Aadhaar Back', required: true },
                                { key: 'panPhotoUrl', label: 'PAN Card', required: true },
                                { key: 'bankPassbookUrl', label: 'Bank Passbook', required: false },
                                { key: 'shopPhotoUrl', label: 'Shop Photo', required: true },
                                { key: 'liveSelfieUrl', label: 'User Live Selfie', required: true },
                                { key: 'electricityBillUrl', label: 'Electricity Bill', required: false },
                            ].map((doc) => (
                                <div key={doc.key} className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wide truncate mb-1">
                                            {doc.label} {doc.required && <span className="text-rose-500">*</span>}
                                        </p>
                                        {form[doc.key] ? (
                                            <div className="relative w-full h-14 rounded-lg overflow-hidden border border-blue-500 mb-1.5">
                                                <img src={form[doc.key]} alt={doc.label} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-full h-14 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 mb-1.5">
                                                <ImageIcon className="w-4 h-4 mb-0.5" />
                                                <span className="text-[8px]">No file</span>
                                            </div>
                                        )}
                                    </div>
                                    <label className="cursor-pointer w-full py-1 px-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[9px] font-bold text-blue-600 flex items-center justify-center gap-1 transition-colors">
                                        <Upload className="w-3 h-3" /> Upload
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(doc.key, e)} />
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Agreement */}
                    <label className="flex items-start gap-2.5 cursor-pointer mt-1 px-1">
                        <input
                            type="checkbox"
                            checked={form.agreement}
                            onChange={(e) => update({ agreement: e.target.checked })}
                            required
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600"
                        />
                        <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">
                            I verify that all partner KYC documents and identity information provided are genuine & verified.
                        </span>
                    </label>

                    {/* Step 2 Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-xs uppercase tracking-wider hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Step 1
                        </button>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50 active:scale-[0.99]"
                        >
                            {submitting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    {submitLabel} <Sparkles className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
