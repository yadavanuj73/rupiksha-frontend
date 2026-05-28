import React from 'react';
import { useNavigate } from 'react-router-dom';

const SOCIAL_ICONS = [
    { label: '📘', color: '#3b82f6', href: '#!' },
    { label: '📞', color: '#ef4444', href: '#!' },
    { label: '🏪', color: '#a16207', href: '#!' },
    { label: '▶️', color: '#16a34a', href: '#!' },
    { label: '✉️', color: '#8b5cf6', href: '#!' },
];

export default function Footer() {
    const navigate = useNavigate();

    const scrollToServices = () => {
        const el = document.getElementById('services');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <footer style={{ background: '#0f172a', color: '#94a3b8' }} id="contact">
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 5% 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40 }} className="rp-footer-grid">
                    {/* Brand */}
                    <div>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', fontFamily: "'DM Serif Display', serif", marginBottom: 16 }}>Rupiksha</h3>
                        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#94a3b8', maxWidth: 280 }}>
                            Transforming digital payments across India with innovative financial solutions for businesses and individuals.
                        </p>
                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                            {SOCIAL_ICONS.map((s, i) => (
                                <a key={i} href={s.href}
                                    style={{
                                        width: 38, height: 38, borderRadius: '50%',
                                        background: s.color, display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: 16, textDecoration: 'none',
                                        transition: 'transform 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >{s.label}</a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h5 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', marginBottom: 20 }}>Quick Links</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={linkStyle}>Home</button>
                            <button onClick={() => navigate('/about')} style={linkStyle}>About Us</button>
                            <button onClick={() => navigate('/leadership')} style={linkStyle}>Our Leadership</button>
                            <button onClick={() => navigate('/contact')} style={linkStyle}>Contact Us</button>
                            <button onClick={() => {}} style={{ ...linkStyle, cursor: 'default', opacity: 0.5 }}>Careers</button>
                            <button onClick={() => {}} style={{ ...linkStyle, cursor: 'default', opacity: 0.5 }}>Blog</button>
                        </div>
                    </div>

                    {/* Our Services */}
                    <div>
                        <h5 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', marginBottom: 20 }}>Our Services</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <button onClick={scrollToServices} style={linkStyle}>Money Transfer</button>
                            <button onClick={scrollToServices} style={linkStyle}>Bill Payment</button>
                            <button onClick={scrollToServices} style={linkStyle}>Banking Services</button>
                            <button onClick={scrollToServices} style={linkStyle}>Insurance</button>
                            <button onClick={scrollToServices} style={linkStyle}>Aadhaar Enabled Payment</button>
                            <button onClick={scrollToServices} style={linkStyle}>Mobile Recharge</button>
                        </div>
                    </div>

                    {/* Contact Us */}
                    <div>
                        <h5 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', marginBottom: 20 }}>Contact Us</h5>
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
};

const bottomLinkStyle = {
    color: '#64748b', textDecoration: 'none', transition: 'color 0.2s',
};
