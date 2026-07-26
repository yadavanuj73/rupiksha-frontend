import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, PhoneCall, ArrowLeft, ShieldAlert, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DisabledServiceBanner({ serviceName = "AEPS" }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] bg-slate-50 flex flex-col items-center justify-center p-4 font-['Inter',sans-serif]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full text-center relative overflow-hidden"
      >
        {/* Decorative background ambient accents */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-amber-50 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-rose-50 rounded-full blur-2xl pointer-events-none" />

        {/* Lock Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-600 shadow-md shadow-amber-500/10">
            <Lock className="w-10 h-10" />
          </div>
        </div>

        {/* Status Badge */}
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider mb-3">
          <ShieldAlert size={14} /> Service Disabled by Admin
        </span>

        {/* Title */}
        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-3">
          {serviceName} Service Inactive
        </h2>

        {/* Main Message */}
        <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">
          {serviceName} service has been disabled for your retailer account by the administrator. Please contact the service team to enable {serviceName} for your account.
        </p>

        {/* Help box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left mb-6 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
            <Headphones size={15} className="text-amber-600" />
            <span>Need Help to Activate {serviceName}?</span>
          </div>
          <p className="text-slate-500">
            Contact your direct parent distributor or system administrator to request activation for the {serviceName} service.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => navigate('/support')}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <PhoneCall size={16} /> Contact Service Team
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} /> Return to Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
