import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
    const navigate = useNavigate();

    return (
        <footer className="bg-slate-950 text-slate-300" id="contact">
            <div className="mx-auto max-w-7xl px-5 py-14 md:px-8">
                <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <h3 className="text-2xl font-extrabold text-white">Rupiksha</h3>
                        <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
                            Modern fintech tools to help retailers scale payments, banking, and customer services from one platform.
                        </p>
                        <div className="mt-5 flex gap-3">
                            {['FB', 'X', 'IN', 'YT'].map((s, i) => (
                                <a key={i} href="#!" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:scale-105 hover:border-blue-400">
                                    {s}
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h5 className="text-sm font-semibold uppercase tracking-wider text-white">Quick Links</h5>
                        <div className="mt-4 space-y-2 text-sm">
                            <button className="block transition hover:text-white" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button>
                            <button className="block transition hover:text-white" onClick={() => navigate('/about')}>About Us</button>
                            <button className="block transition hover:text-white" onClick={() => navigate('/leadership')}>Leadership</button>
                            <button className="block transition hover:text-white" onClick={() => navigate('/contact')}>Contact</button>
                        </div>
                    </div>

                    <div>
                        <h5 className="text-sm font-semibold uppercase tracking-wider text-white">Solutions</h5>
                        <div className="mt-4 space-y-2 text-sm">
                            {['Money Transfer', 'Bill Payment', 'AEPS', 'Insurance', 'Travel'].map((l) => (
                                <a key={l} href="#services" className="block transition hover:text-white">{l}</a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h5 className="text-sm font-semibold uppercase tracking-wider text-white">Contact</h5>
                        <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-400">
                            <p>Muzaffarpur, Bihar, India</p>
                            <p>+91 7004128310</p>
                            <p>support@rupiksha.com</p>
                        </div>
                    </div>
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-6 text-xs text-slate-500">
                    <span>© 2026 Rupiksha. All rights reserved.</span>
                    <div className="flex gap-4">
                        <a href="#!" className="transition hover:text-slate-200">Terms</a>
                        <a href="#!" className="transition hover:text-slate-200">Privacy</a>
                        <a href="#!" className="transition hover:text-slate-200">Refunds</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
