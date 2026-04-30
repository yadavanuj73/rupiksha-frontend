import React from 'react';

export default function FeatureCard({ icon, title, description }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-30px_rgba(37,99,235,0.28)]">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-100 to-emerald-100 text-xl shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold leading-snug text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </article>
  );
}
