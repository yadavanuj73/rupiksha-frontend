import React from 'react';
import { Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-blue-950 to-emerald-900 opacity-90" />
      <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-[760px] max-w-7xl items-center justify-center px-5 pb-20 pt-36 md:px-8 lg:min-h-[820px] lg:pt-40">
        <div className="animate-[fadeIn_600ms_ease-out] mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 shadow-lg shadow-emerald-950/10">
            <Sparkles size={14} />
            Fintech infrastructure for growth
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
            Modern Payments
            <br />
            <span className="bg-gradient-to-r from-blue-300 to-emerald-300 bg-clip-text text-transparent">
              Built for Retail Scale
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
            Run transactions, settlement, and partner operations from a single premium dashboard experience.
          </p>

          <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
            {[
              { label: 'Retail touchpoints', value: '50K+' },
              { label: 'Monthly processing', value: 'Rs. 200Cr+' },
              { label: 'Service uptime', value: '99.9%' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm"
              >
                <p className="text-xl font-bold leading-none text-white">{item.value}</p>
                <p className="mt-2 text-sm leading-5 text-slate-300">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </section>
  );
}
