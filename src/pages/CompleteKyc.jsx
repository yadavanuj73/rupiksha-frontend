import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BadgeCheck, Camera, CreditCard, FileBadge2, Home, Loader2, ShieldCheck, UploadCloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/apiService';

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

// Downscale any uploaded image to <=1280px on its longest edge and re-encode
// as JPEG (quality 0.8). Keeps base64 payload comfortably under ~1MB so the
// backend's max-http-form-post-size and DTO validation both accept it.
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
    const MAX_EDGE = 1280;
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return raw;
  }
};

const CompleteKyc = () => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    aadhaarNumber: '',
    panNumber: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [files, setFiles] = useState({
    selfie: null,
    aadhaarPhoto: null,
    panPhoto: null,
  });

  const normalizedPan = form.panNumber.trim().toUpperCase();
  const isAadhaarValid = /^\d{12}$/.test(form.aadhaarNumber.trim());
  const isPanValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(normalizedPan);
  const isPincodeValid = /^\d{6}$/.test(form.pincode.trim());

  const roleHome = useMemo(() => {
    const role = String(user?.role || user?.roles?.[0] || '').toUpperCase();
    if (role === 'DISTRIBUTOR') return '/distributor';
    if (role === 'SUPER_DISTRIBUTOR' || role === 'SUPER_DISTRIBUTOR') return '/super-distributor';
    if (['ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].includes(role)) return '/admin';
    return '/dashboard';
  }, [user]);

  const canSubmit = useMemo(() => {
    return (
      isAadhaarValid &&
      isPanValid &&
      isPincodeValid &&
      form.addressLine1.trim() &&
      form.city.trim() &&
      form.state.trim() &&
      files.selfie &&
      files.aadhaarPhoto &&
      files.panPhoto
    );
  }, [files, form.addressLine1, form.city, form.state, isAadhaarValid, isPanValid, isPincodeValid]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!canSubmit) {
      setError('Please complete all mandatory KYC fields and upload all required photos.');
      return;
    }
    try {
      setIsSubmitting(true);
      const [photoUrl, aadhaarPhotoUrl, panPhotoUrl] = await Promise.all([
        toCompressedDataUrl(files.selfie),
        toCompressedDataUrl(files.aadhaarPhoto),
        toCompressedDataUrl(files.panPhoto),
      ]);
      const payload = {
        aadhaarNumber: form.aadhaarNumber.trim(),
        panNumber: normalizedPan,
        photoUrl,
        aadhaarPhotoUrl,
        panPhotoUrl,
        addressLine1: form.addressLine1.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
      };

      const res = await userService.submitKyc(payload);
      const nextUser = { ...(user || {}), kycStatus: res?.kycStatus || 'PENDING' };
      localStorage.setItem('rupiksha_user', JSON.stringify(nextUser));
      setUser(nextUser);
      setSuccess('KYC submitted successfully. Your account is now under admin review.');
    } catch (err) {
      setError(err?.message || 'KYC submission failed. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checklistItems = [
    { label: 'Aadhaar Number (12 digits)', done: isAadhaarValid, Icon: CreditCard },
    { label: 'PAN Number (Valid format)', done: isPanValid, Icon: FileBadge2 },
    { label: 'Selfie Photo', done: Boolean(files.selfie), Icon: Camera },
    { label: 'Aadhaar Card Photo', done: Boolean(files.aadhaarPhoto), Icon: UploadCloud },
    { label: 'PAN Card Photo', done: Boolean(files.panPhoto), Icon: UploadCloud },
    { label: 'Address With Pincode', done: Boolean(form.addressLine1.trim() && form.city.trim() && form.state.trim() && isPincodeValid), Icon: Home },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-[#f0f7ff] to-[#ecf8f3] px-4 py-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <motion.nav
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border border-blue-100/80 bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(30,64,175,0.08)] backdrop-blur md:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Rupiksha | Account Verification Required</p>
              <h1 className="truncate text-base font-black text-slate-900 md:text-lg">Complete KYC To Unlock All Services</h1>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
            Access Restricted
          </span>
        </motion.nav>

        <div className="grid gap-5 md:grid-cols-[1.1fr_1.9fr]">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          className="rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_20px_50px_rgba(37,99,235,0.08)]"
          >
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500">Mandatory Checklist</h2>
            <ul className="space-y-3">
              {checklistItems.map(({ label, done, Icon }) => (
                <li key={label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${done ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <Icon className={`h-4 w-4 ${done ? 'text-emerald-600' : 'text-blue-600'}`} />
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-2xl bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-800">
                After successful admin approval, your dashboard, transactions, recharge and transfer services will be enabled automatically.
              </p>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleSubmit}
            className="rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_20px_50px_rgba(14,116,144,0.08)]"
          >
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-900">KYC Submission Form</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Aadhaar Number</label>
                <input
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold leading-5 tracking-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 ${form.aadhaarNumber && !isAadhaarValid ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white'}`}
                  placeholder="12 digit Aadhaar"
                  value={form.aadhaarNumber}
                  onChange={(e) => update('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
                />
                {form.aadhaarNumber && !isAadhaarValid ? <p className="text-xs font-semibold text-rose-600">Aadhaar must be exactly 12 digits.</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">PAN Number</label>
                <input
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold uppercase leading-5 tracking-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 ${form.panNumber && !isPanValid ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white'}`}
                  placeholder="ABCDE1234F"
                  value={form.panNumber}
                  onChange={(e) => update('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                />
                {form.panNumber && !isPanValid ? <p className="text-xs font-semibold text-rose-600">PAN format should be like ABCDE1234F.</p> : null}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Address Line</label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold leading-5 tracking-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="House number, street, locality"
                  value={form.addressLine1}
                  onChange={(e) => update('addressLine1', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">City</label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold leading-5 tracking-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">State</label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold leading-5 tracking-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="State"
                  value={form.state}
                  onChange={(e) => update('state', e.target.value)}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Pincode</label>
                <input
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold leading-5 tracking-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 ${form.pincode && !isPincodeValid ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white'}`}
                  placeholder="6 digit pincode"
                  value={form.pincode}
                  onChange={(e) => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {form.pincode && !isPincodeValid ? <p className="text-xs font-semibold text-rose-600">Pincode must be exactly 6 digits.</p> : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ['selfie', 'Upload Selfie'],
                ['aadhaarPhoto', 'Upload Aadhaar Photo'],
                ['panPhoto', 'Upload PAN Photo'],
              ].map(([key, label]) => (
                <label key={key} className="cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
                  <p className="text-xs font-black uppercase tracking-[0.13em] text-slate-600">{label}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{files[key] ? files[key].name : 'No file selected'}</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFiles((prev) => ({ ...prev, [key]: e.target.files?.[0] || null }))}
                  />
                </label>
              ))}
            </div>

            {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
            {success ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <BadgeCheck className="h-4 w-4" /> {success}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black uppercase tracking-[0.13em] text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit KYC
              </button>
              <button
                type="button"
                onClick={() => navigate(roleHome)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Retry Later
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100"
              >
                Logout
              </button>
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  );
};

export default CompleteKyc;

