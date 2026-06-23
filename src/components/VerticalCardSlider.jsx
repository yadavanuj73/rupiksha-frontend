import React from 'react';
import { motion } from 'framer-motion';
import './VerticalCardSlider.css';

const ITEMS = [
    { title: "Register Now", desc: "Sign up in under 2 minutes with your mobile number. No paperwork needed.", step: "01", color: "#2563eb", mediumColor: "#bfdbfe", icon: "🚀" },
    { title: "Upload KYC", desc: "Submit your Aadhaar and PAN details securely for instant verification.", step: "02", color: "#4f46e5", mediumColor: "#ddd6fe", icon: "🔐" },
    { title: "Get Approved", desc: "Our team verifies your account and activates all financial services within hours.", step: "03", color: "#16a34a", mediumColor: "#bbf7d0", icon: "✅" },
    { title: "Add Wallet Balance", desc: "Add funds via UPI, Bank Transfer or Credit Card to start transacting.", step: "04", color: "#dc2626", mediumColor: "#fecaca", icon: "💳" },
    { title: "Start Earning", desc: "Offer digital payments to customers and earn commissions on every transaction.", step: "05", color: "#ca8a04", mediumColor: "#fef08a", icon: "💰" },
];

const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.96 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.5,
            delay: i * 0.1,
            ease: [0.22, 1, 0.36, 1],
        },
    }),
};

const VerticalCardSlider = () => {
    return (
        <section className="hiw-section">
            {/* Header — only "How It Works", center-aligned */}
            <div className="hiw-header">
                <h2 className="hiw-main-title">How It Works</h2>
            </div>

            {/* Responsive grid — 1 / 2 / 3 / 5 columns */}
            <div className="hiw-grid-wrap">
                <div className="hiw-grid">
                    {ITEMS.map((item, i) => (
                        <motion.div
                            key={i}
                            className="hiw-grid-card"
                            custom={i}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.15 }}
                            variants={cardVariants}
                            style={{
                                background: item.mediumColor,
                                border: `2px solid ${item.color}40`,
                            }}
                        >
                            {/* Step badge */}
                            <div
                                className="hiw-grid-step"
                                style={{
                                    background: item.color,
                                    boxShadow: `0 10px 25px ${item.color}40`,
                                }}
                            >
                                {item.step}
                            </div>

                            <h3 className="hiw-grid-title">{item.title}</h3>
                            <p className="hiw-grid-desc">{item.desc}</p>

                            {/* Watermark icon */}
                            <div className="hiw-grid-watermark">{item.icon}</div>

                            {/* Footer label */}
                            <div className="hiw-grid-footer">RUPIKSHA FINTECH PREMIUM</div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default VerticalCardSlider;
