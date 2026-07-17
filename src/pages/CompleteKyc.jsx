import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck, Camera, CreditCard, FileBadge2, Home, Loader2, ShieldCheck,
  UploadCloud, User, Phone, MapPin, Calendar, Building2, FileText,
  CheckCircle2, Clock, ChevronRight, LogOut, AlertCircle, Image
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/apiService';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
  'Puducherry','Chandigarh','Andaman & Nicobar Islands','Lakshadweep',
  'Dadra & Nagar Haveli and Daman & Diu',
];

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const toCompressedDataUrl = async (file) => {
  if (!file) return '';
  const raw = await readFileAsDataUrl(file);
  if (!raw) return '';
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Invalid image file'));
      image.src = raw;
    });
    const MAX_EDGE = 900;
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.65);
  } catch { return raw; }
};

const InputField = ({ label, required, error, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
      {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs font-semibold text-rose-600 flex items-center gap-1"><AlertCircle size={11}/>{error}</p>}
  </div>
);

const FileUploadBox = ({ label, subtitle, file, onChange, icon: Icon = UploadCloud }) => (
  <label className="cursor-pointer group block">
    <div className={`rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-200 ${file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40'}`}>
      <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${file ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-blue-100'}`}>
        {file ? <CheckCircle2 size={20} className="text-emerald-600" /> : <Icon size={20} className="text-slate-400 group-hover:text-blue-500" />}
      </div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">{label}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p>
      {file && <p className="mt-1 truncate text-[10px] font-semibold text-emerald-600">{file.name}</p>}
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} />
    </div>
  </label>
);

const StepIndicator = ({ step, currentStep }) => {
  const done = currentStep > step;
  const active = currentStep === step;
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all
      ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>
      {done ? <CheckCircle2 size={14}/> : step}
    </div>
  );
};

const CompleteKyc = () => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    mobile: '',
    aadhaarNumber: '',
    panNumber: '',
    shopAddress: '',
    permanentAddress: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [files, setFiles] = useState({
    aadhaarPhoto: null,
    panPhoto: null,
    selfieWithEmployee: null,
    shopPhoto: null,
    bankPassbook: null,
  });

  const setFile = (key) => (e) => setFiles(prev => ({ ...prev, [key]: e.target.files?.[0] || null }));
  const update = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const isAadhaarValid = /^\d{12}$/.test(form.aadhaarNumber.trim());
  const isPanValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber.trim().toUpperCase());
  const isPincodeValid = /^\d{6}$/.test(form.pincode.trim());
  const isMobileValid = /^\d{10}$/.test(form.mobile.trim());
  const isDobValid = !!form.dob;

  const step1Complete = form.firstName.trim() && form.lastName.trim() && isDobValid &&
    isMobileValid && form.aadhaarNumber.trim() && isAadhaarValid &&
    form.panNumber.trim() && isPanValid && form.shopAddress.trim() &&
    form.permanentAddress.trim() && form.city.trim() && form.state && isPincodeValid;

  const step2Complete = files.aadhaarPhoto && files.panPhoto && files.selfieWithEmployee &&
    files.shopPhoto && files.bankPassbook;

  const roleHome = useMemo(() => {
    const role = String(user?.role || user?.roles?.[0] || '').toUpperCase();
    if (role === 'DISTRIBUTOR') return '/distributor';
    if (role === 'SUPER_DISTRIBUTOR') return '/super-distributor';
    if (['ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].includes(role)) return '/admin';
    return '/dashboard';
  }, [user]);

  const handleSubmit = async () => {
    setError('');
    if (!step1Complete || !step2Complete) {
      setError('Please complete all required fields and upload all documents.');
      return;
    }
    try {
      setIsSubmitting(true);
      const [aadhaarPhotoUrl, panPhotoUrl, selfieUrl, shopPhotoUrl, bankPassbookUrl] = await Promise.all([
        toCompressedDataUrl(files.aadhaarPhoto),
        toCompressedDataUrl(files.panPhoto),
        toCompressedDataUrl(files.selfieWithEmployee),
        toCompressedDataUrl(files.shopPhoto),
        toCompressedDataUrl(files.bankPassbook),
      ]);
      const payload = {
        aadhaarNumber: form.aadhaarNumber.trim(),
        panNumber: form.panNumber.trim().toUpperCase(),
        photoUrl: selfieUrl,
        aadhaarPhotoUrl,
        panPhotoUrl,
        addressLine1: form.shopAddress.trim(),
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob,
        mobile: form.mobile.trim(),
        shopAddress: form.shopAddress.trim(),
        permanentAddress: form.permanentAddress.trim(),
        shopPhotoUrl,
        bankPassbookUrl,
      };
      const res = await userService.submitKyc(payload);
      const nextUser = { ...(user || {}), kycStatus: res?.kycStatus || 'PENDING' };
      const userKey = localStorage.getItem('rupiksha_imp_token') ? 'rupiksha_imp_user' : 'rupiksha_user';
      localStorage.setItem(userKey, JSON.stringify(nextUser));
      setUser(nextUser);
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || 'KYC submission failed. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (valid, touched) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100
    ${touched && !valid ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 bg-white'}`;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-slate-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl border border-emerald-100 p-8 shadow-[0_30px_60px_rgba(16,185,129,0.12)] text-center"
        >
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <Clock size={36} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">KYC Under Review</h2>
          <p className="text-sm text-slate-500 font-medium mb-6">
            Your KYC documents have been submitted successfully. Our team will review and approve your account within 24–48 hours. You'll be notified once approved.
          </p>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-6">
            <div className="flex items-center gap-2 justify-center">
              <Clock size={14} className="text-amber-600" />
              <span className="text-xs font-black uppercase tracking-widest text-amber-700">Status: Under Review</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-slate-700 transition"
          >
            <LogOut size={14} /> Logout & Login Again After Approval
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f7ff] via-[#f8fafc] to-[#f0fff8] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(37,99,235,0.08)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Rupiksha Fintech · Onboarding KYC</p>
              <h1 className="text-base font-black text-slate-900">Identity & Business Verification</h1>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition">
            <LogOut size={12}/> Logout
          </button>
        </motion.div>

        {/* Step Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm"
        >
          <StepIndicator step={1} currentStep={step} />
          <div className="flex flex-col">
            <span className={`text-xs font-black uppercase tracking-widest ${step === 1 ? 'text-blue-600' : step > 1 ? 'text-emerald-600' : 'text-slate-400'}`}>Step 1</span>
            <span className="text-sm font-bold text-slate-700">Personal & Business Details</span>
          </div>
          <div className={`flex-1 h-0.5 rounded-full mx-2 transition-all ${step > 1 ? 'bg-emerald-400' : 'bg-slate-100'}`} />
          <StepIndicator step={2} currentStep={step} />
          <div className="flex flex-col">
            <span className={`text-xs font-black uppercase tracking-widest ${step === 2 ? 'text-blue-600' : step > 2 ? 'text-emerald-600' : 'text-slate-400'}`}>Step 2</span>
            <span className="text-sm font-bold text-slate-700">Document Uploads</span>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="rounded-3xl border border-blue-100 bg-white p-6 shadow-[0_20px_50px_rgba(37,99,235,0.07)]"
            >
              <div className="mb-5 flex items-center gap-2">
                <User size={18} className="text-blue-600" />
                <h2 className="text-base font-black text-slate-900">Personal & Business Information</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InputField label="First Name" required error={form.firstName && !form.firstName.trim() ? 'Required' : ''}>
                  <input className={inputCls(!!form.firstName.trim(), !!form.firstName)} placeholder="First name" value={form.firstName} onChange={update('firstName')} />
                </InputField>

                <InputField label="Last Name" required>
                  <input className={inputCls(!!form.lastName.trim(), !!form.lastName)} placeholder="Last name" value={form.lastName} onChange={update('lastName')} />
                </InputField>

                <InputField label="Date of Birth" required error={form.dob && !isDobValid ? 'Required' : ''}>
                  <input type="date" className={inputCls(isDobValid, !!form.dob)} value={form.dob} onChange={update('dob')} max={new Date(Date.now() - 18*365*24*3600*1000).toISOString().split('T')[0]} />
                </InputField>

                <InputField label="Mobile Number" required error={form.mobile && !isMobileValid ? '10-digit mobile number' : ''}>
                  <input className={inputCls(isMobileValid, !!form.mobile)} placeholder="10-digit mobile" value={form.mobile} onChange={(e) => setForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                </InputField>

                <InputField label="Aadhaar Number" required error={form.aadhaarNumber && !isAadhaarValid ? 'Must be 12 digits' : ''}>
                  <input className={inputCls(isAadhaarValid, !!form.aadhaarNumber)} placeholder="12-digit Aadhaar" value={form.aadhaarNumber} onChange={(e) => setForm(p => ({ ...p, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) }))} />
                </InputField>

                <InputField label="PAN Number" required error={form.panNumber && !isPanValid ? 'Format: ABCDE1234F' : ''}>
                  <input className={inputCls(isPanValid, !!form.panNumber)} placeholder="ABCDE1234F" value={form.panNumber} onChange={(e) => setForm(p => ({ ...p, panNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))} />
                </InputField>

                <InputField label="Shop / Business Address" required className="sm:col-span-2">
                  <input className={`${inputCls(!!form.shopAddress.trim(), !!form.shopAddress)} sm:col-span-2`} placeholder="Shop name, building, street, locality" value={form.shopAddress} onChange={update('shopAddress')} />
                </InputField>

                <InputField label="Permanent Address" required>
                  <input className={inputCls(!!form.permanentAddress.trim(), !!form.permanentAddress)} placeholder="House no., street, locality" value={form.permanentAddress} onChange={update('permanentAddress')} />
                </InputField>

                <InputField label="City" required>
                  <input className={inputCls(!!form.city.trim(), !!form.city)} placeholder="City" value={form.city} onChange={update('city')} />
                </InputField>

                <InputField label="State" required>
                  <select className={inputCls(!!form.state, !!form.state)} value={form.state} onChange={update('state')}>
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </InputField>

                <InputField label="Pincode" required error={form.pincode && !isPincodeValid ? 'Must be 6 digits' : ''}>
                  <input className={inputCls(isPincodeValid, !!form.pincode)} placeholder="6-digit pincode" value={form.pincode} onChange={(e) => setForm(p => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                </InputField>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => step1Complete ? setStep(2) : setError('Please fill all required fields correctly.')}
                  className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition
                    ${step1Complete ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-slate-300 cursor-not-allowed'}`}
                >
                  Next: Upload Documents <ChevronRight size={16} />
                </button>
              </div>
              {error && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertCircle size={12}/>{error}</p>}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="rounded-3xl border border-blue-100 bg-white p-6 shadow-[0_20px_50px_rgba(37,99,235,0.07)]"
            >
              <div className="mb-5 flex items-center gap-2">
                <Image size={18} className="text-blue-600" />
                <h2 className="text-base font-black text-slate-900">Upload KYC Documents</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FileUploadBox
                  label="Aadhaar Card Photo"
                  subtitle="Front side of your Aadhaar card"
                  file={files.aadhaarPhoto}
                  onChange={setFile('aadhaarPhoto')}
                  icon={CreditCard}
                />
                <FileUploadBox
                  label="PAN Card Photo"
                  subtitle="Clear photo of your PAN card"
                  file={files.panPhoto}
                  onChange={setFile('panPhoto')}
                  icon={FileBadge2}
                />
                <FileUploadBox
                  label="Selfie with Employee"
                  subtitle="GPS-enabled camera selfie with ID"
                  file={files.selfieWithEmployee}
                  onChange={setFile('selfieWithEmployee')}
                  icon={Camera}
                />
                <FileUploadBox
                  label="Shop / Outlet Photo"
                  subtitle="Clear exterior photo of your shop"
                  file={files.shopPhoto}
                  onChange={setFile('shopPhoto')}
                  icon={Building2}
                />
                <div className="sm:col-span-2">
                  <FileUploadBox
                    label="Bank Passbook / Cheque"
                    subtitle="First page showing account details"
                    file={files.bankPassbook}
                    onChange={setFile('bankPassbook')}
                    icon={FileText}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs font-semibold text-blue-800">
                  📸 For selfie, please enable GPS/location on your camera. All documents should be clearly visible. Max size: 5MB each.
                </p>
              </div>

              {error && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertCircle size={12}/>{error}</p>}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={() => { setStep(1); setError(''); }}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !step2Complete}
                  className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition
                    ${step2Complete && !isSubmitting ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200' : 'bg-slate-300 cursor-not-allowed'}`}
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                  {isSubmitting ? 'Submitting...' : 'Submit KYC for Review'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-4 text-center text-xs text-slate-400">
          All information is encrypted and securely stored. Your data is used only for verification purposes.
        </p>
      </div>
    </div>
  );
};

export default CompleteKyc;
