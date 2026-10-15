import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FOOTER_SERVICES, preloadServiceImages } from '../data/servicePages';

const SOCIAL_LINKS = [
    {
        href: 'https://www.facebook.com/share/18tBhkEve5/?mibextid=wwXIfr',
        label: 'Facebook',
        color: '#1877f2',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
        ),
    },
    {
        href: 'https://www.instagram.com/rupiksha_?igsh=MTJ5NnEyc25vODVycw%3D%3D&utm_source=qr',
        label: 'Instagram',
        color: '#e1306c',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
            </svg>
        ),
    },
    {
        href: 'https://www.youtube.com/@Rupiksha_Official',
        label: 'YouTube',
        color: '#ff0000',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#ff0000"/>
            </svg>
        ),
    },
    {
        href: 'https://www.linkedin.com/company/rupiksha-services-private-limited/?viewAsMember=true',
        label: 'LinkedIn',
        color: '#0a66c2',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
            </svg>
        ),
    },
    {
        href: 'https://play.google.com/store/apps/details?id=com.rupiksha.services',
        label: 'Play Store',
        color: '#01875f',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M3 20.5v-17c0-.83 1-.83 1.5-.5l14 8.5-14 8.5c-.5.33-1.5.33-1.5-.5z"/>
            </svg>
        ),
    },
];

export default function Footer() {
    const navigate = useNavigate();

    useEffect(() => {
        preloadServiceImages();
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer style={{ background: '#0a1120', color: '#94a3b8' }} id="contact" className="w-full border-t border-slate-800">
            {/* Main Footer Container — Reduced Height by 70% */}
            <div className="max-w-[1440px] w-full mx-auto px-6 sm:px-8 lg:px-12 pt-5 sm:pt-6 pb-3 sm:pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-7 lg:gap-7 xl:gap-8 items-start w-full">
                    
                    {/* Column 1: Brand & Description */}
                    <div className="flex flex-col items-start w-full">
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-1 font-serif">
                            Rupiksha
                        </h3>
                        <p className="text-xs leading-snug text-slate-400 mb-2.5 text-justify">
                            Transforming digital payments across India with innovative financial solutions for businesses and individuals.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                            {SOCIAL_LINKS.map((s, i) => (
                                <a 
                                    key={i} 
                                    href={s.href} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    aria-label={s.label}
                                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110 shadow-sm shrink-0"
                                    style={{ background: s.color }}
                                >
                                    {s.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Quick Links */}
                    <div className="flex flex-col items-start w-full">
                        <h5 className="text-[11px] font-bold tracking-wider uppercase text-white mb-1.5">
                            Quick Links
                        </h5>
                        <nav className="flex flex-col gap-1 w-full text-xs">
                            <button onClick={scrollToTop} className="text-left text-slate-400 hover:text-white transition-colors py-0">
                                Home
                            </button>
                            <button onClick={() => { navigate('/about'); scrollToTop(); }} className="text-left text-slate-400 hover:text-white transition-colors py-0">
                                About Us
                            </button>
                            <button onClick={() => { navigate('/leadership'); scrollToTop(); }} className="text-left text-slate-400 hover:text-white transition-colors py-0">
                                Our Leadership
                            </button>
                            <button onClick={() => { navigate('/contact'); scrollToTop(); }} className="text-left text-slate-400 hover:text-white transition-colors py-0">
                                Contact Us
                            </button>
                            <span className="text-left text-slate-600 cursor-default py-0">
                                Careers
                            </span>
                            <span className="text-left text-slate-600 cursor-default py-0">
                                Blog
                            </span>
                        </nav>
                    </div>

                    {/* Column 3: Our Services */}
                    <div className="flex flex-col items-start w-full">
                        <h5 className="text-[11px] font-bold tracking-wider uppercase text-white mb-1.5">
                            Our Services
                        </h5>
                        <nav className="flex flex-col gap-1 w-full text-xs">
                            {FOOTER_SERVICES.map((s) => (
                                <button
                                    key={s.slug}
                                    onMouseEnter={() => preloadServiceImages()}
                                    onFocus={() => preloadServiceImages()}
                                    onClick={() => { navigate(`/services/${s.slug}`); scrollToTop(); }}
                                    className="text-left text-slate-400 hover:text-white transition-colors py-0 truncate max-w-full"
                                >
                                    {s.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Column 4: Contact Us */}
                    <div className="flex flex-col items-start w-full">
                        <h5 className="text-[11px] font-bold tracking-wider uppercase text-white mb-1.5">
                            Contact Us
                        </h5>
                        <div className="flex flex-col gap-1.5 text-xs text-slate-400 w-full">
                            <div className="flex items-start gap-2">
                                <span className="text-xs shrink-0 mt-0.5">📍</span>
                                <p className="leading-snug text-slate-400 m-0">
                                    Rupiksha Service Pvt Ltd, Muzaffarpur, Bihar, 842001
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs shrink-0">📞</span>
                                <a 
                                    href="tel:+917004128310" 
                                    className="text-slate-400 hover:text-white transition-colors font-medium"
                                >
                                    +91 7004128310
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs shrink-0">✉️</span>
                                <a 
                                    href="mailto:support@rupiksha.com" 
                                    className="text-slate-400 hover:text-white transition-colors font-medium"
                                >
                                    support@rupiksha.com
                                </a>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Bottom Bar — Ultra-Compact & Slim */}
                <div className="mt-4 sm:mt-5 pt-3 border-t border-slate-800/90 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="text-slate-400">
                        © 2026 Rupiksha. All rights reserved.
                    </span>

                    <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-center font-medium">
                        <button
                            onClick={() => { navigate('/terms-and-conditions'); scrollToTop(); }}
                            className="text-slate-400 hover:text-white transition-colors hover:underline underline-offset-4"
                        >
                            Terms & Condition
                        </button>
                        <span className="text-slate-700">•</span>
                        <button
                            onClick={() => { navigate('/privacy-policy'); scrollToTop(); }}
                            className="text-slate-400 hover:text-white transition-colors hover:underline underline-offset-4"
                        >
                            Privacy Policy
                        </button>
                        <span className="text-slate-700">•</span>
                        <button
                            onClick={() => { navigate('/refund-policy'); scrollToTop(); }}
                            className="text-slate-400 hover:text-white transition-colors hover:underline underline-offset-4"
                        >
                            Refund Policy
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    );
}
