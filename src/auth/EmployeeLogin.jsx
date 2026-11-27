import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck, Lock, User, Eye, EyeOff, ArrowRight,
  AlertCircle, Building2, MapPin, BarChart3, CheckCircle2
} from 'lucide-react';
import { employeeAuthService } from '../services/employeeApiService';

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = employeeAuthService.getToken();
    const cached = employeeAuthService.getSessionUser();
    if (token && cached?.id) {
      navigate('/employee/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your Employee ID / Username and password.');
      return;
    }
    setSubmitting(true);
    try {
      await employeeAuthService.login(identifier.trim(), password);
      navigate('/employee/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row font-['Inter',sans-serif]">
      {/* Left Brand / Info Column */}
      <div className="lg:w-[46%] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 px-6 py-10 sm:px-10 lg:px-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-extrabold tracking-tight text-slate-900">Rupiksha</div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600">Employee Command Portal</div>
              </div>
            </Link>
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 transition"
            >
              Partner Login
            </Link>
          </div>

          <div className="mt-10 lg:mt-16 max-w-md space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              National Head · State Head · Zonal Head
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Hierarchical Operations & Network Visibility
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Sign in with the official Employee ID or username provisioned by your Rupiksha Administrator to monitor regional networks, transactions, and permitted onboarding.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5 max-w-md">
            {[
              {
                icon: MapPin,
                title: 'Server-Enforced Scope',
                desc: 'Data is strictly scoped to your assigned National, State, or Zonal hierarchy.',
              },
              {
                icon: BarChart3,
                title: 'Live Performance Telemetry',
                desc: 'Real-time transaction metrics and subordinate network tracking.',
              },
              {
                icon: CheckCircle2,
                title: 'Permission-Gated Onboarding',
                desc: 'Role-bound member onboarding when authorized by Administration.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-indigo-600">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500">
          Restricted Corporate Access · Employee accounts cannot be self-registered.
        </div>
      </div>

      {/* Right Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900">Employee Sign In</h2>
            <p className="text-sm text-slate-600 mt-1">
              Enter your Admin-issued Employee ID or username and password.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="emp-identifier" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Employee ID or Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="emp-identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. EMP-NH-001 or rahul.sharma"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="emp-password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="emp-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-bold shadow-sm transition cursor-pointer"
            >
              {submitting ? 'Verifying Credentials...' : 'Sign In to Employee Portal'}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 space-y-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Need an account or password reset?</p>
            <p>
              Employee credentials, role scopes, and permissions are managed strictly by Rupiksha Admin in Employee Manager. There is no public employee registration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
