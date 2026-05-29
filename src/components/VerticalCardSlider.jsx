import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PinnedCarouselSection from './PinnedCarouselSection';
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

    const nextSlide = () => setCurrentIndex((prev) => Math.min(prev + 1, ITEMS.length - 1));
    const prevSlide = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));

    return (
        <PinnedCarouselSection
            totalSlides={ITEMS.length}
            index={currentIndex}
            setIndex={setCurrentIndex}
            stickyClassName="hiw-scroll-pin"
        >
            <div className="section-header-slider">
                <span className="slider-tag">Simple Process</span>
                <h2 className="slider-main-title">How It Works</h2>
                <p className="slider-main-desc">Follow these 5 simple steps to launch your digital banking point with Rupiksha.</p>
            </div>

            <div className="hiw-carousel-wrap">
                <button type="button" onClick={prevSlide} className="hiw-arrow hiw-arrow--left" aria-label="Previous step">←</button>
                <button type="button" onClick={nextSlide} className="hiw-arrow hiw-arrow--right" aria-label="Next step">→</button>
                <div className="hiw-carousel-track">
                    {ITEMS.map((item, i) => {
                        const offset = i - currentIndex;
                        const isActive = offset === 0;
                        return (
                            <motion.div
                                key={i}
                                className="hiw-card"
                                animate={{
                                    x: offset * 380,
                                    scale: isActive ? 1 : 0.85,
                                    opacity: Math.abs(offset) > 2 ? 0 : isActive ? 1 : 0.6,
                                    zIndex: isActive ? 10 : 5 - Math.abs(offset),
                                }}
                                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                                style={{
                                    background: item.mediumColor,
                                    border: `2px solid ${item.color}40`,
                                    position: 'absolute',
                                    left: '50%',
                                    marginLeft: -180,
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
        </PinnedCarouselSection>
    );
};

export default VerticalCardSlider;
