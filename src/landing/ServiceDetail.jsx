import React, { useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { getServiceBySlug } from '../data/servicePages';

export default function ServiceDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const service = getServiceBySlug(slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!service) {
    return <Navigate to="/" replace />;
  }

  const goBack = () => {
    navigate('/?scrollTo=services');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white font-['Outfit',sans-serif]">
      <Navbar />

      <main className="pt-24 pb-0">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors mb-8"
          >
            <ArrowLeft size={18} />
            Back to Services
          </button>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="space-y-6">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white"
                style={{ background: service.accent }}
              >
                {service.badge}
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {service.title}
              </h1>
              <p className="text-xl font-bold" style={{ color: service.accent }}>
                {service.subtitle}
              </p>
              <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-lg">
                {service.description}
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                {service.stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-blue-100 bg-white/80 backdrop-blur px-3 py-4 text-center shadow-sm"
                  >
                    <div className="text-lg md:text-xl font-black text-slate-900">{s.value}</div>
                    <div className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-200/40 to-transparent rounded-[2.5rem] blur-3xl scale-90" />
              <img
                src={service.image}
                alt={service.title}
                className="relative w-full max-w-md lg:max-w-lg rounded-2xl shadow-2xl shadow-blue-900/10 object-contain"
              />
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">Key Features</h2>
            <p className="text-slate-500 font-medium mt-3">
              Everything you need in one powerful service
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {service.features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-blue-100 transition-all"
              >
                <span className="text-3xl mb-4 block">{f.icon}</span>
                <h3 className="text-lg font-black text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">How It Works</h2>
            <p className="text-slate-500 font-medium mt-3">Simple steps to get started</p>
          </div>

          <div className="space-y-4">
            {service.steps.map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-5 bg-white rounded-2xl border border-slate-100 px-5 py-4 shadow-sm"
              >
                <div
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-black text-sm"
                  style={{ background: service.accent }}
                >
                  {i + 1}
                </div>
                <p className="text-slate-700 font-semibold text-sm md:text-base">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0f172a] py-16 md:py-20 mt-4">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
              Ready to get started with {service.title}?
            </h2>
            <p className="text-slate-400 font-medium mb-8">
              Join thousands of retailers already using Rupiksha to serve their customers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={() => navigate('/portal')}
                className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: service.accent }}
              >
                Get Started Now
              </button>
              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white border-2 border-white/30 hover:bg-white/10 transition-colors"
              >
                Contact Us
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
