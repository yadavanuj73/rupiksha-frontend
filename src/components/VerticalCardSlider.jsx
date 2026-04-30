import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './VerticalCardSlider.css';

const SliderItem = ({ item }) => {
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <motion.div
            className="item"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            style={{
                width: isMobile ? '88vw' : 'min(520px, 92vw)',   
                height: isMobile ? '45vh' : 'min(540px, 60vh)',  
                background: item.mediumColor,
                borderRadius: isMobile ? 24 : 40,
                border: `2px solid ${item.color}50`,
                boxShadow: `0 40px 100px -20px ${item.color}20`,
                color: '#0f172a',
                padding: isMobile ? '24px' : '50px',
                willChange: 'transform, opacity',
            }}
        >
            <div className="item-step" style={{
                background: item.color,
                boxShadow: `0 15px 30px ${item.color}40`,
                width: isMobile ? '44px' : '84px',
                height: isMobile ? '44px' : '84px',
                fontSize: isMobile ? '1.2rem' : '2.4rem',
                borderRadius: isMobile ? '12px' : '28px',
                position: 'relative',
                zIndex: 10,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900
            }}>
                {item.step}
            </div>

            <div style={{ position: 'relative', zIndex: 10 }}>
                <h1 style={{ 
                    fontSize: isMobile ? '1.8rem' : '3.2rem', 
                    color: '#0f172a', 
                    fontWeight: 950, 
                    marginTop: isMobile ? '15px' : '30px', 
                    letterSpacing: '-1px', 
                    lineHeight: 1.1 
                }}>{item.title}</h1>
                <p style={{ 
                    fontSize: isMobile ? '0.95rem' : '1.45rem', 
                    color: '#1e293b', 
                    marginTop: isMobile ? '10px' : '20px', 
                    lineHeight: 1.6, 
                    fontWeight: 600 
                }}>{item.desc}</p>
            </div>

            <div className="item-footer" style={{ 
                color: '#0f172a', 
                marginTop: 'auto', 
                fontSize: isMobile ? '9px' : '14px', 
                fontWeight: 900, 
                opacity: 0.6, 
                letterSpacing: '2px', 
                position: 'relative', 
                zIndex: 10 
            }}>
                RUPIKSHA FINTECH PREMIUM
            </div>

            <div className="hover-light-icon" style={{
                position: 'absolute',
                bottom: isMobile ? '15px' : '30px',
                right: isMobile ? '15px' : '30px',
                fontSize: isMobile ? '4rem' : '12rem',
                lineHeight: 1,
                zIndex: 1,
                filter: 'grayscale(1) contrast(1.2)',
                opacity: 0.12
            }}>
                {item.icon}
            </div>
        </motion.div>
    );
};

const VerticalCardSlider = () => {
    const items = [
        { title: "Register Now", desc: "Sign up in under 2 minutes with your mobile number. No paperwork needed.", step: "01", color: "#2563eb", mediumColor: "#bfdbfe", icon: "🚀" },
        { title: "Upload KYC", desc: "Submit your Aadhaar and PAN details securely for instant verification.", step: "02", color: "#4f46e5", mediumColor: "#ddd6fe", icon: "🔐" },
        { title: "Get Approved", desc: "Our team verifies your account and activates all financial services within hours.", step: "03", color: "#16a34a", mediumColor: "#bbf7d0", icon: "✅" },
        { title: "Add Wallet Balance", desc: "Add funds via UPI, Bank Transfer or Credit Card to start transacting.", step: "04", color: "#dc2626", mediumColor: "#fecaca", icon: "💳" },
        { title: "Start Earning", desc: "Offer digital payments to customers and earn commissions on every transaction.", step: "05", color: "#ca8a04", mediumColor: "#fef08a", icon: "💰" },
    ];
    const [currentIndex, setCurrentIndex] = useState(0);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
    };

    return (
        <section style={{ background: '#f8fafc', position: 'relative', margin: 0, padding: '80px 0' }}>
            <div className="slider-section-wrapper" style={{
                minHeight: '100vh',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            }}>
                <div className="section-header-slider">
                    <span className="slider-tag">Simple Process</span>
                    <h2 className="slider-main-title">How It Works</h2>
                    <p className="slider-main-desc">Follow these 5 simple steps to launch your digital banking point with Rupiksha.</p>
                </div>

                <div className="relative overflow-hidden" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
                    <button
                        onClick={prevSlide}
                        style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 20,
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontWeight: 700
                        }}
                    >
                        Prev
                    </button>
                    <button
                        onClick={nextSlide}
                        style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 20,
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontWeight: 700
                        }}
                    >
                        Next
                    </button>
                    <div
                        className="flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {items.map((item, index) => (
                            <div key={index} className="w-full flex-shrink-0" style={{ display: 'flex', justifyContent: 'center' }}>
                                <SliderItem item={item} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default VerticalCardSlider;
