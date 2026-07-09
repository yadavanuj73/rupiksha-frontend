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

    return (
        <footer style={{ background: '#0f172a', color: '#94a3b8' }} id="contact">
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 5% 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 48, alignItems: 'start' }} className="rp-footer-grid">
                    {/* Brand */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', fontFamily: "'DM Serif Display', serif", marginBottom: 16 }}>Rupiksha</h3>
                        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#94a3b8', margin: '0 0 20px 0', textAlign: 'justify', width: '100%' }}>
                            Transforming digital payments across India with innovative financial solutions for businesses and individuals.
                        </p>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap' }}>
                            {SOCIAL_LINKS.map((s, i) => (
                                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                                    style={{
                                        width: 38, height: 38, borderRadius: '50%',
                                        background: s.color, display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', textDecoration: 'none',
                                        transition: 'transform 0.2s, opacity 0.2s', flexShrink: 0,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >{s.icon}</a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <h5 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', marginBottom: 20, textAlign: 'left' }}>Quick Links</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={linkStyle}>Home</button>
                            <button onClick={() => navigate('/about')} style={linkStyle}>About Us</button>
                            <button onClick={() => navigate('/leadership')} style={linkStyle}>Our Leadership</button>
                            <button onClick={() => navigate('/contact')} style={linkStyle}>Contact Us</button>
                            <button onClick={() => {}} style={{ ...linkStyle, cursor: 'default', opacity: 0.5 }}>Careers</button>
                            <button onClick={() => {}} style={{ ...linkStyle, cursor: 'default', opacity: 0.5 }}>Blog</button>
                        </div>
                    </div>

                    {/* Our Services */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <h5 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', marginBottom: 20, textAlign: 'left' }}>Our Services</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                            {FOOTER_SERVICES.map((s) => (
                                <button
                                    key={s.slug}
                                    onMouseEnter={(e) => { preloadServiceImages(); e.currentTarget.style.color = '#fff'; }}
                                    onFocus={() => preloadServiceImages()}
                                    onClick={() => navigate(`/services/${s.slug}`)}
                                    style={linkStyle}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Contact Us */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <h5 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', marginBottom: 20, textAlign: 'left' }}>Contact Us</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 16, marginTop: 2 }}>📍</span>
                                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#94a3b8', margin: 0 }}>
                                    Rupiksha Service Pvt Ltd, Muzaffarpur, Bihar, 842001
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ fontSize: 16 }}>📞</span>
                                <a href="tel:+917004128310" style={{ fontSize: 14, color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                >+91 7004128310</a>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ fontSize: 16 }}>✉️</span>
                                <a href="mailto:support@rupiksha.com" style={{ fontSize: 14, color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                >support@rupiksha.com</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div style={{
                    marginTop: 40, paddingTop: 20, paddingBottom: 20,
                    borderTop: '1px solid #1e293b',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: 12, fontSize: 13, color: '#64748b',
                }}>
                    <span style={{ color: '#64748b' }}>© 2026 Rupiksha. All rights reserved.</span>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                        <a href="#!" style={bottomLinkStyle}>Terms of Service</a>
                        <a href="#!" style={bottomLinkStyle}>Privacy Policy</a>
                        <a href="#!" style={bottomLinkStyle}>Refund Policy</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

const linkStyle = {
    background: 'none', border: 'none', color: '#94a3b8',
    fontSize: 14, textAlign: 'left', cursor: 'pointer',
    padding: 0, fontFamily: 'inherit', transition: 'color 0.2s',
    width: '100%', display: 'block',
};

const bottomLinkStyle = {
    color: '#64748b', textDecoration: 'none', transition: 'color 0.2s',
};
