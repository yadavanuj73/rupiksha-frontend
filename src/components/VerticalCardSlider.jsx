import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './VerticalCardSlider.css';

const ITEMS = [
    { title: "Register Now", desc: "Sign up in under 2 minutes with your mobile number. No paperwork needed.", step: "01", color: "#2563eb", mediumColor: "#bfdbfe", icon: "🚀" },
    { title: "Upload KYC", desc: "Submit your Aadhaar and PAN details securely for instant verification.", step: "02", color: "#4f46e5", mediumColor: "#ddd6fe", icon: "🔐" },
    { title: "Get Approved", desc: "Our team verifies your account and activates all financial services within hours.", step: "03", color: "#16a34a", mediumColor: "#bbf7d0", icon: "✅" },
    { title: "Add Wallet Balance", desc: "Add funds via UPI, Bank Transfer or Credit Card to start transacting.", step: "04", color: "#dc2626", mediumColor: "#fecaca", icon: "💳" },
    { title: "Start Earning", desc: "Offer digital payments to customers and earn commissions on every transaction.", step: "05", color: "#ca8a04", mediumColor: "#fef08a", icon: "💰" },
];

const VerticalCardSlider = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const sectionRef = useRef(null);
    const [locked, setLocked] = useState(false);
    const [completed, setCompleted] = useState(false);
    const indexRef = useRef(0);
    const wheelCooldown = useRef(false);

    useEffect(() => {
        if (!sectionRef.current || completed) return;
        const el = sectionRef.current;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5 && !completed) {
                setLocked(true);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, { threshold: 0.5 });
        observer.observe(el);
        return () => observer.disconnect();
    }, [completed]);

    useEffect(() => {
        if (!locked || completed) return;
        const handleWheel = (e) => {
            if (wheelCooldown.current) { e.preventDefault(); return; }
            if (e.deltaY > 0) {
                e.preventDefault();
                wheelCooldown.current = true;
                if (indexRef.current < ITEMS.length - 1) {
                    indexRef.current++;
                    setCurrentIndex(indexRef.current);
                } else { setLocked(false); setCompleted(true); }
                setTimeout(() => { wheelCooldown.current = false; }, 600);
            } else if (e.deltaY < 0) {
                e.preventDefault();
                wheelCooldown.current = true;
                if (indexRef.current > 0) {
                    indexRef.current--;
                    setCurrentIndex(indexRef.current);
                }
                setTimeout(() => { wheelCooldown.current = false; }, 600);
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [locked, completed]);

    useEffect(() => {
        if (locked && !completed) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [locked, completed]);

    const nextSlide = () => setCurrentIndex((prev) => { const n = Math.min(prev + 1, ITEMS.length - 1); indexRef.current = n; return n; });
    const prevSlide = () => setCurrentIndex((prev) => { const n = Math.max(prev - 1, 0); indexRef.current = n; return n; });

    return (
        <section ref={sectionRef} style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', position: 'relative', margin: 0, padding: '80px 0', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="section-header-slider">
                <span className="slider-tag">Simple Process</span>
                <h2 className="slider-main-title">How It Works</h2>
                <p className="slider-main-desc">Follow these 5 simple steps to launch your digital banking point with Rupiksha.</p>
            </div>

            <div className="hiw-carousel-wrap">
                <button onClick={prevSlide} className="hiw-arrow hiw-arrow--left">←</button>
                <button onClick={nextSlide} className="hiw-arrow hiw-arrow--right">→</button>
                <div className="hiw-carousel-track">
                    {ITEMS.map((item, i) => {
                        const offset = i - currentIndex;
                        const isActive = offset === 0;
                        return (
                            <motion.div
                                key={i}
                                className="hiw-card"
                                animate={{
                                    x: offset * 420,
                                    scale: isActive ? 1 : 0.82,
                                    opacity: Math.abs(offset) > 2 ? 0 : isActive ? 1 : 0.55,
                                    zIndex: isActive ? 10 : 5 - Math.abs(offset),
                                }}
                                transition={{ duration: 0.45, ease: 'easeInOut' }}
                                style={{
                                    background: item.mediumColor,
                                    border: `2px solid ${item.color}40`,
                                    position: 'absolute',
                                }}
                            >
                                <div style={{
                                    background: item.color,
                                    boxShadow: `0 10px 25px ${item.color}40`,
                                    width: 64, height: 64, borderRadius: 20,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginBottom: 20,
                                }}>
                                    {item.step}
                                </div>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.5px' }}>{item.title}</h3>
                                <p style={{ fontSize: '1.05rem', color: '#334155', lineHeight: 1.6, fontWeight: 500 }}>{item.desc}</p>
                                <div style={{ marginTop: 'auto', fontSize: 11, fontWeight: 900, opacity: 0.4, letterSpacing: 2, color: '#0f172a' }}>RUPIKSHA FINTECH PREMIUM</div>
                                <div style={{
                                    position: 'absolute', bottom: 20, right: 20,
                                    fontSize: '5rem', opacity: 0.1, lineHeight: 1,
                                    filter: 'grayscale(1)',
                                }}>{item.icon}</div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default VerticalCardSlider;
