import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Building2, MapPin, CreditCard, ShieldCheck, UploadCloud, Camera,
  Navigation, CheckCircle2, Clock, XCircle, ArrowRight, ArrowLeft, LogOut,
  AlertCircle, Loader2, Sparkles, FileText, Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { kycService } from '../services/apiService';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
  'Puducherry','Chandigarh','Andaman & Nicobar Islands','Lakshadweep'
];

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export default function CompleteKyc() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();

  const [activeSection, setActiveSection] = useState(1); // 1..10
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedStatus, setSubmittedStatus] = useState(user?.kycStatus || 'NOT_SUBMITTED');
  const [rejectionReason, setRejectionReason] = useState(user?.kycRejectionReason || '');

  // 10 Onboarding Sections State
  const [formData, setFormData] = useState({
    // Section 1: Personal Details
    fullName: user?.fullName || '',
    fatherName: user?.fatherName || '',
    email: user?.email || '',
    dob: user?.dob || '',
    gender: user?.gender || 'Male',

    // Section 2: Business Details
    shopName: user?.businessName || '',
    businessType: user?.businessType || 'Retail Shop',
    gstNumber: user?.gstNumber || '',

    // Section 3: Shop Address
    shopAddress: user?.shopAddress || user?.addressLine1 || '',
    shopLandmark: user?.shopLandmark || '',
    shopState: user?.shopState || user?.stateName || '',
    shopDistrict: user?.shopDistrict || user?.city || '',
    shopCity: user?.shopCity || user?.city || '',
    shopPincode: user?.shopPincode || user?.pincode || '',

    // Section 4: Permanent Address
    sameAsShopAddress: false,
    permanentAddress: user?.permanentAddress || '',
    permState: user?.permState || '',
    permDistrict: user?.permDistrict || '',
    permCity: user?.permCity || '',
    permPincode: user?.permPincode || '',

    // Section 5: Identity Details
    aadhaarNumber: user?.aadhaarNumber || '',
    panNumber: user?.panNumber || '',

    // Section 6: Bank Details
    bankAccountHolder: user?.bankAccountHolder || user?.fullName || '',
    bankName: user?.bankName || '',
    bankAccountNumber: user?.bankAccountNumber || '',
    bankIfsc: user?.bankIfsc || '',
    bankBranch: user?.bankBranch || '',

    // Section 7 & 9: Documents (Base64 or URLs)
    photoUrl: user?.photoUrl || '',
    aadhaarPhotoUrl: user?.aadhaarPhotoUrl || '',
    aadhaarBackPhotoUrl: user?.aadhaarBackPhotoUrl || '',
    panPhotoUrl: user?.panPhotoUrl || '',
    bankPassbookUrl: user?.bankPassbookUrl || '',
    shopPhotoUrl: user?.shopPhotoUrl || '',
    drivingLicenceUrl: user?.drivingLicenceUrl || '',
    voterIdUrl: user?.voterIdUrl || '',
    passportUrl: user?.passportUrl || '',

    // Section 8: Live Verification & GPS
    liveSelfieUrl: user?.liveSelfieUrl || '',
    gpsLat: user?.gpsLat || '',
    gpsLong: user?.gpsLong || '',
    gpsTimestamp: user?.gpsTimestamp || '',
    deviceInfo: user?.deviceInfo || navigator.userAgent || ''
  });

  useEffect(() => {
    // Refresh KYC status from server
    kycService.getKycStatus()
      .then(res => {
        if (res && res.kycStatus) {
          setSubmittedStatus(res.kycStatus);
          setRejectionReason(res.rejectionReason || '');
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'sameAsShopAddress') {
      setFormData(prev => ({
        ...prev,
        sameAsShopAddress: checked,
        permanentAddress: checked ? prev.shopAddress : prev.permanentAddress,
        permState: checked ? prev.shopState : prev.permState,
        permDistrict: checked ? prev.shopDistrict : prev.permDistrict,
        permCity: checked ? prev.shopCity : prev.permCity,
        permPincode: checked ? prev.shopPincode : prev.permPincode,
      }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      setFormData(prev => ({ ...prev, [fieldName]: base64 }));
    } catch (err) {
      setError('Failed to upload file');
    }
  };

  const captureGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          gpsLat: String(pos.coords.latitude),
          gpsLong: String(pos.coords.longitude),
          gpsTimestamp: new Date().toISOString(),
          deviceInfo: `${navigator.platform} | ${navigator.userAgent}`
        }));
        setGpsLoading(false);
      },
      (err) => {
        setError('GPS capture failed. Please grant location permissions in your browser.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleNextSection = () => {
    setError('');
    // Validations per section
    if (activeSection === 1) {
      if (!formData.fullName.trim()) return setError('Full Name is required');
      if (!formData.email.trim()) return setError('Email is required');
    }
    if (activeSection === 3) {
      if (!formData.shopAddress.trim()) return setError('Shop Address is required');
      if (!formData.shopState.trim()) return setError('Shop State is required');
    }
    if (activeSection === 5) {
      if (!/^\d{12}$/.test(formData.aadhaarNumber.trim())) return setError('Aadhaar Number must be 12 digits');
      if (!/[A-Z]{5}[0-9]{4}[A-Z]{1}/i.test(formData.panNumber.trim())) return setError('PAN format invalid');
    }
    if (activeSection < 10) {
      setActiveSection(prev => prev + 1);
    }
  };

  const handlePrevSection = () => {
    if (activeSection > 1) setActiveSection(prev => prev - 1);
  };

  const handleSubmitKyc = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.aadhaarPhotoUrl || !formData.panPhotoUrl || !formData.shopPhotoUrl || !formData.bankPassbookUrl) {
      setError('Mandatory documents (Aadhaar Front, PAN, Passbook, Shop Photo) must be uploaded');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        addressLine1: formData.shopAddress,
        city: formData.shopCity,
        state: formData.shopState,
        pincode: formData.shopPincode
      };
      const res = await kycService.submitKyc(payload);
      setSubmittedStatus('PENDING');
      if (setUser) {
        setUser(prev => ({ ...prev, kycStatus: 'PENDING' }));
      }
    } catch (err) {
      setError(err.message || 'KYC Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── APPROVED / VERIFIED SCREEN ──
  if (submittedStatus === 'APPROVED' || submittedStatus === 'KYC_VERIFIED') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5">
          <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              KYC Status: VERIFIED
            </span>
            <h2 className="text-2xl font-black text-white mt-3">Account Fully Onboarded!</h2>
            <p className="text-sm text-slate-400 mt-1">
              All high-value services (AEPS, DMT, Payout, BBPS) are active for your account.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition-all"
          >
            Go to Retailer Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── PENDING APPROVAL SCREEN ──
  if (submittedStatus === 'PENDING' || submittedStatus === 'PENDING_ADMIN_APPROVAL') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5">
          <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-500 rounded-full flex items-center justify-center mx-auto text-amber-400 animate-pulse">
            <Clock className="w-12 h-12" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              Status: PENDING ADMIN APPROVAL
            </span>
            <h2 className="text-2xl font-black text-white mt-3">Onboarding Under Review</h2>
            <p className="text-sm text-slate-400 mt-1">
              Your 10-section KYC details and documents have been submitted to platform administrators for verification.
            </p>
          </div>
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-400 text-left space-y-2">
            <p className="text-slate-300 font-semibold">Enabled Services Right Now:</p>
            <p className="text-emerald-400">✓ Wallet, Recharge, BBPS, Reports, Profile, Settings</p>
            <p className="text-slate-300 font-semibold mt-2">Services Unlocking Upon Approval:</p>
            <p className="text-amber-400 font-mono">🔒 AEPS, DMT, Payout, Micro ATM</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all text-xs"
            >
              Dashboard
            </button>
            <button
              onClick={() => setSubmittedStatus('REJECTED')}
              className="flex-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold py-3 rounded-xl hover:bg-amber-500/30 transition-all text-xs"
            >
              Edit Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ONBOARDING FORM WIZARD (SECTIONS 1-10) ──
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Navbar */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950">
              RK
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Complete Retailer KYC Onboarding</h1>
              <p className="text-xs text-slate-400">10-Section Verification Module</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        {/* Rejection Alert */}
        {submittedStatus === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
            <XCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-rose-400">Onboarding Request Rejected / Resubmission Requested</h4>
              <p className="text-xs mt-0.5">{rejectionReason || 'Please review your uploaded documents and correct details.'}</p>
            </div>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
          {[
            { num: 1, label: '1. Personal' },
            { num: 2, label: '2. Business' },
            { num: 3, label: '3. Shop Address' },
            { num: 4, label: '4. Permanent' },
            { num: 5, label: '5. Identity' },
            { num: 6, label: '6. Bank' },
            { num: 7, label: '7. Documents' },
            { num: 8, label: '8. Live Selfie' },
            { num: 9, label: '9. GPS Location' },
            { num: 10, label: '10. Review & Submit' }
          ].map(s => (
            <button
              key={s.num}
              onClick={() => setActiveSection(s.num)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeSection === s.num
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION CONTENT */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">

          {/* SECTION 1: PERSONAL DETAILS */}
          {activeSection === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 1: Personal Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name *</label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Father Name *</label>
                  <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Date of Birth * (DD/MM/YYYY)</label>
                  <input type="text" name="dob" placeholder="15/08/1995" value={formData.dob} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: BUSINESS DETAILS */}
          {activeSection === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 2: Business Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Shop / Business Name *</label>
                  <input type="text" name="shopName" value={formData.shopName} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Business Type</label>
                  <select name="businessType" value={formData.businessType} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500">
                    <option value="Retail Shop">Retail Shop</option>
                    <option value="Mobile Store">Mobile Store</option>
                    <option value="Cyber Cafe">Cyber Cafe</option>
                    <option value="Kirana Store">Kirana Store</option>
                    <option value="General Store">General Store</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">GST Number (Optional)</label>
                  <input type="text" name="gstNumber" placeholder="22AAAAA0000A1Z5" value={formData.gstNumber} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: SHOP ADDRESS */}
          {activeSection === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 3: Shop Address</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Shop Address Line *</label>
                  <input type="text" name="shopAddress" value={formData.shopAddress} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Landmark</label>
                  <input type="text" name="shopLandmark" value={formData.shopLandmark} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">State *</label>
                  <select name="shopState" value={formData.shopState} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500">
                    <option value="">-- Select State --</option>
                    {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">District / City *</label>
                  <input type="text" name="shopCity" value={formData.shopCity} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Pincode *</label>
                  <input type="text" maxLength={6} name="shopPincode" value={formData.shopPincode} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: PERMANENT ADDRESS */}
          {activeSection === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-lg font-bold text-white">Section 4: Permanent Address</h3>
                <label className="flex items-center gap-2 text-xs text-emerald-400 cursor-pointer">
                  <input type="checkbox" name="sameAsShopAddress" checked={formData.sameAsShopAddress} onChange={handleChange} className="w-4 h-4 rounded" />
                  Same as Shop Address
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Permanent Address Line</label>
                  <input type="text" name="permanentAddress" value={formData.permanentAddress} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">State</label>
                  <select name="permState" value={formData.permState} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500">
                    <option value="">-- Select State --</option>
                    {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">City / District</label>
                  <input type="text" name="permCity" value={formData.permCity} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Pincode</label>
                  <input type="text" maxLength={6} name="permPincode" value={formData.permPincode} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: IDENTITY DETAILS */}
          {activeSection === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 5: Identity Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Aadhaar Number * (12 Digits)</label>
                  <input type="text" maxLength={12} name="aadhaarNumber" placeholder="123456789012" value={formData.aadhaarNumber} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-mono focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">PAN Number * (10 Digits)</label>
                  <input type="text" maxLength={10} name="panNumber" placeholder="ABCDE1234F" value={formData.panNumber} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-mono uppercase focus:border-emerald-500" />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: BANK DETAILS */}
          {activeSection === 6 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 6: Bank Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Account Holder Name *</label>
                  <input type="text" name="bankAccountHolder" value={formData.bankAccountHolder} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Bank Name *</label>
                  <input type="text" name="bankName" placeholder="e.g. State Bank of India" value={formData.bankName} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Account Number *</label>
                  <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-mono focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">IFSC Code *</label>
                  <input type="text" name="bankIfsc" placeholder="SBIN0001234" value={formData.bankIfsc} onChange={handleChange} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-mono uppercase focus:border-emerald-500" />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: DOCUMENT UPLOADS */}
          {activeSection === 7 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 7: Document Uploads</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Aadhaar Front Image *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'aadhaarPhotoUrl')} className="w-full text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-2" />
                  {formData.aadhaarPhotoUrl && <p className="text-emerald-400 mt-1 font-bold">✓ Aadhaar Front Uploaded</p>}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Aadhaar Back Image *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'aadhaarBackPhotoUrl')} className="w-full text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-2" />
                  {formData.aadhaarBackPhotoUrl && <p className="text-emerald-400 mt-1 font-bold">✓ Aadhaar Back Uploaded</p>}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">PAN Card Image *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'panPhotoUrl')} className="w-full text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-2" />
                  {formData.panPhotoUrl && <p className="text-emerald-400 mt-1 font-bold">✓ PAN Card Uploaded</p>}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Passbook / Cancelled Cheque *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'bankPassbookUrl')} className="w-full text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-2" />
                  {formData.bankPassbookUrl && <p className="text-emerald-400 mt-1 font-bold">✓ Passbook Uploaded</p>}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 8: LIVE VERIFICATION (SELFIE) */}
          {activeSection === 8 && (
            <div className="space-y-4 text-center">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 8: Live Verification (Selfie)</h3>
              <p className="text-xs text-slate-400">Capture or upload a clear live selfie of the shop owner.</p>
              
              <div className="w-32 h-32 rounded-full border-2 border-dashed border-slate-700 bg-slate-950 mx-auto flex items-center justify-center overflow-hidden">
                {formData.liveSelfieUrl || formData.photoUrl ? (
                  <img src={formData.liveSelfieUrl || formData.photoUrl} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-10 h-10 text-slate-500" />
                )}
              </div>

              <div className="flex justify-center gap-4">
                <label className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl cursor-pointer text-xs transition-all">
                  Upload Live Selfie
                  <input type="file" accept="image/*" capture="user" onChange={e => handleFileUpload(e, 'liveSelfieUrl')} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* SECTION 9: SHOP VERIFICATION & GPS */}
          {activeSection === 9 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 9: Shop Photo & GPS Coordinates</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Shop Photo *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'shopPhotoUrl')} className="w-full text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-2" />
                  {formData.shopPhotoUrl && <p className="text-emerald-400 mt-1 font-bold">✓ Shop Photo Uploaded</p>}
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 font-semibold block">Capture Shop GPS Location</span>
                  <button
                    type="button"
                    onClick={captureGps}
                    disabled={gpsLoading}
                    className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs"
                  >
                    {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4 text-emerald-400" />}
                    Capture GPS Coordinates
                  </button>
                  {formData.gpsLat && (
                    <p className="text-emerald-400 text-[11px] font-mono">
                      Lat: {formData.gpsLat}, Long: {formData.gpsLong}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 10: REVIEW & SUBMIT */}
          {activeSection === 10 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Section 10: Review & Submit KYC</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div><span className="text-slate-500">Name:</span> <strong className="text-white">{formData.fullName}</strong></div>
                <div><span className="text-slate-500">Shop Name:</span> <strong className="text-white">{formData.shopName}</strong></div>
                <div><span className="text-slate-500">Aadhaar:</span> <strong className="text-white">{formData.aadhaarNumber}</strong></div>
                <div><span className="text-slate-500">PAN:</span> <strong className="text-white">{formData.panNumber}</strong></div>
                <div><span className="text-slate-500">Bank:</span> <strong className="text-white">{formData.bankName} ({formData.bankIfsc})</strong></div>
                <div><span className="text-slate-500">GPS Captured:</span> <strong className="text-emerald-400">{formData.gpsLat ? 'Yes' : 'No'}</strong></div>
              </div>

              <button
                onClick={handleSubmitKyc}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold py-4 rounded-2xl shadow-xl shadow-emerald-500/20 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Submit Onboarding Request for Admin Approval <Sparkles className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* Footer Prev / Next Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={handlePrevSection}
              disabled={activeSection === 1}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 disabled:opacity-40 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>

            {activeSection < 10 && (
              <button
                onClick={handleNextSection}
                className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20"
              >
                Next Section <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
