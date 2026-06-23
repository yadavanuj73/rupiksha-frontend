import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import PhotoSlider from '../components/PhotoSlider';
import PinnedCarouselSection from '../components/PinnedCarouselSection';
const aadhaar_3d_logo = "https://upload.wikimedia.org/wikipedia/en/thumb/c/cf/Aadhaar_Logo.svg/1200px-Aadhaar_Logo.svg.png";
import { useLanguage } from '../context/LanguageContext';
import { Phone, Mail, RefreshCcw } from 'lucide-react';

/* ─────────────────────────────────────────────
   Tiny hook: trigger in-view class once element
   crosses the viewport
───────────────────────────────────────────── */
function useInView(threshold = 0.15) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
            { threshold }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, visible];
}

/* ─────────────── Stagger grid wrapper ─────────────── */
// One IntersectionObserver watches the *parent* wrapper.
// When it enters view every .stagger-item gets its own
// CSS transition-delay so cards pop in one by one.
function StaggerGrid({ children, className = '', itemClassName = '', baseDelay = 0, step = 120 }) {
    const wrapRef = useRef(null);
    const [triggered, setTriggered] = useState(false);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTriggered(true);
                    obs.disconnect();
                }
            },
            { threshold: 0.12 }
        );
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    return (
        <div ref={wrapRef} className={className}>
            {React.Children.map(children, (child, i) => (
                <div
                    className={`stagger-item ${triggered ? 'stagger-item--visible' : ''} ${itemClassName}`}
                    style={{ animationDelay: `${baseDelay + i * step}ms` }}
                >
                    {child}
                </div>
            ))}
        </div>
    );
}

/* ─────────────── Reusable animated card (kept for non-grid use) ─────────────── */
function AnimCard({ children, delay = 0, className = '' }) {
    const [ref, visible] = useInView();
    return (
        <div
            ref={ref}
            className={`stagger-item ${visible ? 'stagger-item--visible' : ''} ${className}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

/* ─────────────── Section heading ─────────────── */
function SectionHead({ tag, title, sub, center = true }) {
    const [ref, visible] = useInView();
    return (
        <div ref={ref} className={`section-head ${visible ? 'section-head--visible' : ''} ${center ? 'text-center' : ''}`}>
            <span className="section-tag">{tag}</span>
            <h2 className="section-title" dangerouslySetInnerHTML={{ __html: title }} />
            {sub && <p className="section-sub">{sub}</p>}
        </div>
    );
}

/* ══════════════════════════════════════════════
   DATA
══════════════════════════════════════════════ */
const SERVICES = [
    {
        label: 'AEPS',
        subtitle: 'Aadhaar Enabled Payment System',
        desc: 'Aadhaar Enabled Payment System allows customers to perform banking transactions using their Aadhaar number and biometric authentication.',
        features: ['Cash withdrawals using Aadhaar authentication', 'Cash deposits to any bank account', 'Balance enquiry', 'Mini statements', 'Aadhaar Pay for merchant payments', 'Interoperable across all banks'],
        grad: 'linear-gradient(160deg,#14532d 0%,#15803d 60%,#16a34a 100%)',
        glow: 'rgba(22,163,74,0.6)', tag: 'RBI Certified',
        img: aadhaar_3d_logo,
    },
    {
        emoji: '🏦', label: 'Banking Services',
        subtitle: 'Comprehensive Banking Solutions',
        desc: 'Extend banking services to your customers as a Business Correspondent. Provide account opening, cash deposits, withdrawals, and more.',
        features: ['Account opening for multiple banks', 'Cash deposits and withdrawals', 'Balance enquiry and mini statements', 'Fixed and recurring deposit creation', 'Micro-ATM services'],
        grad: 'linear-gradient(160deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%)',
        glow: 'rgba(37,99,235,0.6)', tag: 'Pan India',
    },
    {
        emoji: '🤝', label: 'Micro Loans',
        subtitle: '₹5,000 – ₹50,000 Quick Loans',
        desc: "Facilitate small loans for your customers' immediate needs. Our platform connects borrowers with lenders for quick and hassle-free loan disbursals.",
        features: ['Small ticket loans from ₹5,000 to ₹50,000', 'Quick approval process', 'Minimal documentation', 'Flexible repayment options', 'No collateral required'],
        grad: 'linear-gradient(160deg,#164e63 0%,#0891b2 60%,#06b6d4 100%)',
        glow: 'rgba(8,145,178,0.6)', tag: 'Fast Approval',
    },
    {
        emoji: '💳', label: 'Neo Banking',
        subtitle: 'Digital Banking Platform',
        desc: 'Offer digital banking services with enhanced features and user experience. Our neo-banking platform provides a modern alternative to traditional banking.',
        features: ['Digital savings accounts', 'Virtual debit cards', 'Real-time transaction notifications', 'Goal-based savings', 'Integrated investment options'],
        grad: 'linear-gradient(160deg,#1c1917 0%,#292524 60%,#44403c 100%)',
        glow: 'rgba(68,64,60,0.7)', tag: 'New',
    },
    {
        emoji: '🏠', label: 'CSP',
        subtitle: 'Customer Service Point',
        desc: 'Transform your shop into a Customer Service Point. Provide essential banking and government services to your local community.',
        features: ['Dedicated banking outlet', 'Agent registration', 'Multiple bank connectivity', 'Local area service provider'],
        grad: 'linear-gradient(160deg,#713f12 0%,#a16207 60%,#ca8a04 100%)',
        glow: 'rgba(202,138,4,0.6)', tag: 'Business Opportunity',
    },
    {
        emoji: '💼', label: 'Business Correspondent',
        subtitle: 'Business Correspondent',
        desc: 'Act as a Business Correspondent for leading banks. Facilitate secure transactions and financial inclusion in underserved areas.',
        features: ['Bank-authorized agent', 'Secure cash management', 'Customer enrollment', 'Financial literacy support'],
        grad: 'linear-gradient(160deg,#581c87 0%,#7c3aed 60%,#8b5cf6 100%)',
        glow: 'rgba(124,58,237,0.6)', tag: 'Certified Agent',
    },
    {
        emoji: '💸', label: 'Money Transfer',
        subtitle: 'DMT / IMPS / NEFT / RTGS',
        desc: 'Secure and instant domestic money transfers to any bank account in India. Our IMPS, NEFT, and UPI enabled services ensure your customers can send money anywhere, anytime.',
        features: ['Instant transfers through IMPS/UPI', 'Scheduled transfers through NEFT', 'Real-time transaction status updates', 'Transaction history and digital receipts', 'Secure authentication for every transaction', 'Competitive transfer fees'],
        grad: 'linear-gradient(160deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%)',
        glow: 'rgba(37,99,235,0.6)', tag: 'Most Popular',
    },
    {
        emoji: '🧾', label: 'Bill Payment',
        subtitle: 'BBPS Powered • 100+ Billers',
        desc: 'Comprehensive bill payment services for utilities, subscriptions, and more. Our platform supports 100+ billers across multiple categories.',
        features: ['Electricity, water, and gas bill payments', 'Mobile, broadband, and DTH recharges', 'Credit card bill payments', 'Insurance premium payments', 'Educational fee payments', 'Automatic bill payment reminders'],
        grad: 'linear-gradient(160deg,#713f12 0%,#a16207 60%,#ca8a04 100%)',
        glow: 'rgba(202,138,4,0.6)', tag: 'BBPS Certified',
    },
    {
        emoji: '📱', label: 'Recharge',
        subtitle: 'All Operators • Instant',
        desc: 'Offer prepaid recharges for mobile, DTH, data cards, and more. Our platform supports all major operators and provides instant processing.',
        features: ['Mobile prepaid recharges', 'DTH recharges', 'Data card recharges', 'Postpaid bill payments', 'Special recharge offers and cashbacks', 'Scheduled recharges'],
        grad: 'linear-gradient(160deg,#581c87 0%,#7c3aed 60%,#8b5cf6 100%)',
        glow: 'rgba(124,58,237,0.6)', tag: 'Instant Credit',
    },
    {
        emoji: '✈️', label: 'Tours & Travel',
        subtitle: 'IRCTC Certified Agent',
        desc: 'Complete travel booking solutions including flights, hotels, buses, trains, and holiday packages. Provide end-to-end travel services to your customers.',
        features: ['Domestic & international flight bookings', 'Hotel reservations across India', 'Bus and train ticket bookings', 'Customized holiday packages', 'Travel insurance', '24/7 travel support'],
        grad: 'linear-gradient(160deg,#0c4a6e 0%,#0369a1 60%,#0ea5e9 100%)',
        glow: 'rgba(14,165,233,0.6)', tag: 'IRCTC Partner',
    },
    {
        emoji: '🛡️', label: 'Insurance',
        subtitle: 'Life & General Insurance',
        desc: 'Offer a range of insurance products to provide financial security to your customers. Our platform enables quick policy issuance and claims support.',
        features: ['Life insurance policies', 'Health insurance for individuals & families', 'Two-wheeler and four-wheeler insurance', 'Travel insurance', 'Shop and business insurance', 'Digital policy documents'],
        grad: 'linear-gradient(160deg,#14532d 0%,#166534 60%,#15803d 100%)',
        glow: 'rgba(21,128,61,0.6)', tag: 'IRDAI Approved',
    },
    {
        emoji: '📋', label: 'Utility Services',
        subtitle: 'PAN • Aadhaar • Documents',
        desc: 'Provide essential document services like PAN card, Voter ID, Aadhaar updates, and more. Be a one-stop solution for all documentation needs.',
        features: ['PAN card applications', 'Voter ID applications and corrections', 'Aadhaar enrollment and updates', 'Passport application assistance', 'Certificate attestations', 'Government scheme registrations'],
        grad: 'linear-gradient(160deg,#422006 0%,#b45309 60%,#d97706 100%)',
        glow: 'rgba(180,83,9,0.6)', tag: 'Govt. Approved',
    },
];

const HOW = [
    { step: '01', color: '#2563eb', title: 'Register Now', desc: 'Sign up in under 2 minutes with your mobile number. No paperwork needed.' },
    { step: '02', color: '#16a34a', title: 'Get Approved', desc: 'Our team verifies your account and activates all financial services.' },
    { step: '03', color: '#ca8a04', title: 'Start Earning', desc: 'Offer digital payments to customers and earn commissions every day.' },
];

const ADVANTAGE = [
    { icon: '🔐', title: 'Secure Transactions', desc: 'Bank-grade security with end-to-end encryption and multi-factor authentication for all transactions.', color: '#4f46e5', grad: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' },
    { icon: '⚡', title: 'Real-time Processing', desc: 'Instant transaction processing with immediate confirmations and minimal wait times.', color: '#10b981', grad: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' },
    { icon: '💰', title: 'High Commission', desc: 'Earn attractive commissions on every transaction with timely settlements to your account.', color: '#f59e0b', grad: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' },
    { icon: '📊', title: 'Live Analytics', desc: 'Comprehensive reporting and analytics to track your transactions and business growth.', color: '#8b5cf6', grad: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)' },
    { icon: '🛎️', title: '24/7 Support', desc: 'Dedicated customer support available round-the-clock to assist with any queries or issues.', color: '#f43f5e', grad: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' },
    { icon: '🏦', title: 'RBI Compliant', desc: 'Fully compliant with all RBI regulations and guidelines for digital payment services.', color: '#334155', grad: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' },
];

/* ══════════════════════════════════════════════
   NAVBAR
══════════════════════════════════════════════ */
/* ══════════════════════════════════════════════
   NAVBAR
   • Premium glass design
   • Improved mobile menu
══════════════════════════════════════════════ */

const HERO_SLIDES = [
    {
        tag: 'EASY PAYMENT',
        title: 'Pay\nfast and smarter\nfrom anywhere',
        desc: "Experience the future of payments: fast, secure, and tailored for the next generation's convenience and trust.",
        badge: { icon: '⚡', label: '99.9% Success', sub: 'Reliable & Instant' },
        stat: { label: 'Retailers', value: '1000+' },
    },
    {
        tag: 'SECURE TRANSACTIONS',
        title: 'Banking\nreimagined\nfor your life',
        desc: 'Your security is our priority. We use world-class encryption to keep your money and data safe at all times.',
        badge: { icon: '🛡️', label: 'RBI Compliant', sub: 'Bank-grade Security' },
        stat: { label: 'Monthly Volume', value: '₹200Cr+' },
    },
    {
        tag: 'NEXT-GEN FINTECH',
        title: 'One app Infinite\npossibilities',
        desc: 'Manage your finances, pay bills, and send money instantly. Everything you need is just a tap away.',
        badge: { icon: '🔔', label: '24/7 Support', sub: 'Dedicated Helpdesk' },
        stat: { label: 'Agents', value: '15,000+' },
    },
];

function Hero() {
    const [slideIndex, setSlideIndex] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => {
            setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [slideIndex]);

    const slide = HERO_SLIDES[slideIndex];

    return (
        <section className="rp-hero-section">
            <div className="rp-hero-inner">
                <motion.div
                    className="rp-hero-left"
                    key={slideIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <span className="rp-hero-tag">{slide.tag}</span>
                    <h1 className="rp-hero-heading">
                        {slide.title.split('\n').map((line, i) => (
                            <span key={i}>{line}<br /></span>
                        ))}
                    </h1>
                    <p className="rp-hero-desc">{slide.desc}</p>
                    <div className="rp-hero-buttons">
                        <button className="rp-hero-btn-primary" onClick={() => navigate('/portal')}>
                            join now →
                        </button>
                        <a href="https://play.google.com/store/apps/details?id=com.rupiksha.services" target="_blank" rel="noopener noreferrer" className="rp-hero-btn-store">
                            <span style={{ fontSize: 20 }}>▶</span>
                            <div>
                                <small style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>GET IT ON</small>
                                <div style={{ fontWeight: 800, fontSize: 14 }}>Google Play</div>
                            </div>
                        </a>
                    </div>
                </motion.div>

                <div className="rp-hero-right">
                    <img src="/character without bg.png" alt="Rupiksha" className="rp-hero-character" />
                    <motion.div
                        className="rp-hero-float-badge"
                        key={slideIndex + '-badge'}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <span style={{ fontSize: 24 }}>{slide.badge.icon}</span>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{slide.badge.label}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{slide.badge.sub}</div>
                        </div>
                    </motion.div>
                    <motion.div
                        className="rp-hero-stat-card"
                        key={slideIndex + '-stat'}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                    >
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{slide.stat.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{slide.stat.value}</div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

const STATS = [
    { end: 100, suffix: '+', label: 'Cities Covered' },
    { end: 50, suffix: 'K+', label: 'Active Retailers' },
    { prefix: '₹', end: 200, suffix: 'Cr+', label: 'Monthly Volume' },
    { end: 99.9, suffix: '%', label: 'Uptime SLA', decimals: 1 },
];

function AnimatedNumber({ end, decimals = 0, duration = 2000 }) {
    const [count, setCount] = useState(0);
    const [started, setStarted] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [started]);

    useEffect(() => {
        if (!started) return;
        let startTime = null;
        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(parseFloat((eased * end).toFixed(decimals)));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [started, end, duration, decimals]);

    return <span ref={ref}>{decimals > 0 ? count.toFixed(decimals) : Math.floor(count)}</span>;
}

function StatsCounter() {
    return (
        <section className="rp-stats-bar">
            <div className="rp-stats-inner">
                {STATS.map((s, i) => (
                    <div key={i} className="rp-stat-item">
                        <div className="rp-stat-value">
                            {s.prefix || ''}<AnimatedNumber end={s.end} decimals={s.decimals || 0} />{s.suffix}
                        </div>
                        <div className="rp-stat-label">{s.label}</div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function Services() {
    const [activeIndex, setActiveIndex] = useState(0);
    const s = SERVICES[activeIndex];

    return (
        <PinnedCarouselSection
            id="services"
            totalSlides={SERVICES.length}
            index={activeIndex}
            setIndex={setActiveIndex}
            outerStyle={{ background: '#ffffff' }}
        >
            <div className="svc-pin-inner">
                {/* Scroll progress indicator */}
                <div className="svc-progress-bar">
                    <div
                        className="svc-progress-fill"
                        style={{ width: `${((activeIndex + 1) / SERVICES.length) * 100}%` }}
                    />
                </div>

                <div className="svc-slider" style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: '0 5%' }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            className="svc-slider__left"
                            key={activeIndex + '-left'}
                            initial={{ opacity: 0, x: -40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <span className="svc-slider__badge" style={{ background: '#1e3a8a', color: '#fff' }}>
                                ✦ {s.tag}
                            </span>
                            <p className="svc-slider__subtitle">{s.subtitle}</p>
                            <h2 className="svc-slider__title">{s.label}</h2>
                            <p className="svc-slider__desc">{s.desc}</p>
                            <div className="svc-slider__features">
                                {(s.features || []).map((f, fi) => (
                                    <div key={fi} className="svc-slider__feat-item">
                                        <span style={{ color: '#16a34a', fontWeight: 900, fontSize: 18 }}>✓</span>
                                        <span>{f}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Dot nav only — scroll drives the slide */}
                            <div className="svc-slider__nav">
                                <div className="svc-slider__dots">
                                    {SERVICES.map((_, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setActiveIndex(i)}
                                            className={`svc-slider__dot ${i === activeIndex ? 'svc-slider__dot--active' : ''}`}
                                            aria-label={`Slide ${i + 1}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                        <motion.div
                            className="svc-slider__right"
                            key={activeIndex + '-right'}
                            initial={{ opacity: 0, x: 60, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 60, scale: 0.95 }}
                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div
                                className="svc-slider__card"
                                style={{ background: s.grad, boxShadow: `0 30px 60px -15px ${s.glow}` }}
                            >
                                <h3 className="svc-slider__card-title">{s.label}</h3>
                                <p className="svc-slider__card-desc">{s.desc}</p>
                                <div className="svc-slider__card-icon">
                                    {s.img ? (
                                        <img src={s.img} alt={s.label} style={{ width: 80, height: 80, objectFit: 'contain' }} />
                                    ) : (
                                        <span style={{ fontSize: '3.5rem' }}>{s.emoji || '✦'}</span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Scroll hint — only on first slide */}
                {activeIndex === 0 && (
                    <motion.div
                        className="svc-scroll-hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        <span>Scroll to explore services</span>
                        <div className="svc-scroll-arrow">↓</div>
                    </motion.div>
                )}
            </div>
        </PinnedCarouselSection>
    );
}

function Advantage() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const item = ADVANTAGE[currentIndex];

    return (
        <PinnedCarouselSection
            id="advantage"
            totalSlides={ADVANTAGE.length}
            index={currentIndex}
            setIndex={setCurrentIndex}
            outerStyle={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)'
            }}
        >
            <div className="rp-adv-pin-inner">
                {/* Header */}
                <div className="rp-adv-pin-header">
                    <span className="rp-adv-pin-tag">Why Choose Us</span>
                    <h2 className="rp-adv-pin-title">The Rupiksha Advantage</h2>
                </div>

                {/* Full-width card — slides left to right */}
                <div className="rp-adv-pin-viewport">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            className="rp-adv-pin-card"
                            initial={{ opacity: 0, x: -100, rotateY: -8 }}
                            animate={{ opacity: 1, x: 0, rotateY: 0 }}
                            exit={{ opacity: 0, x: 100, rotateY: 8 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                background: 'rgba(255,255,255,0.97)',
                                boxShadow: `0 32px 80px -10px ${item.color}55`
                            }}
                        >
                            {/* Left accent bar */}
                            <div className="rp-adv-pin-accent" style={{ background: item.grad }} />

                            <div className="rp-adv-pin-card-body">
                                {/* Icon */}
                                <div
                                    className="rp-adv-pin-icon"
                                    style={{ background: `${item.color}18`, boxShadow: `0 0 0 8px ${item.color}10` }}
                                >
                                    <span style={{ fontSize: '2.8rem' }}>{item.icon}</span>
                                </div>

                                {/* Content */}
                                <div className="rp-adv-pin-content">
                                    <div className="rp-adv-pin-counter">
                                        {String(currentIndex + 1).padStart(2, '0')} / {String(ADVANTAGE.length).padStart(2, '0')}
                                    </div>
                                    <h3 className="rp-adv-pin-card-title" style={{ color: item.color }}>
                                        {item.title}
                                    </h3>
                                    <p className="rp-adv-pin-card-desc">{item.desc}</p>

                                    {/* Progress bar */}
                                    <div className="rp-adv-pin-progress">
                                        <div
                                            className="rp-adv-pin-progress-fill"
                                            style={{
                                                width: `${((currentIndex + 1) / ADVANTAGE.length) * 100}%`,
                                                background: item.grad
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Large decorative icon */}
                                <div className="rp-adv-pin-deco">{item.icon}</div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Dot navigation */}
                <div className="rp-adv-pin-dots">
                    {ADVANTAGE.map((adv, i) => (
                        <button
                            key={i}
                            className={`rp-adv-pin-dot ${i === currentIndex ? 'rp-adv-pin-dot--active' : ''}`}
                            onClick={() => setCurrentIndex(i)}
                            aria-label={`Advantage ${i + 1}`}
                            style={i === currentIndex ? { background: '#fff', width: 28 } : {}}
                        />
                    ))}
                </div>

                {/* Scroll hint */}
                {currentIndex === 0 && (
                    <motion.div
                        className="svc-scroll-hint" style={{ color: 'rgba(255,255,255,0.7)' }}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                    >
                        <span>Scroll to explore</span>
                        <div className="svc-scroll-arrow">↓</div>
                    </motion.div>
                )}
            </div>
        </PinnedCarouselSection>
    );
}

/* ══════════════════════════════════════════════
   CTA BANNER
══════════════════════════════════════════════ */
function Partners() {
    const navigate = useNavigate();
    const { t, language: lang } = useLanguage();
    const [activeTab, setActiveTab] = useState('retailer');
    const [ref, visible] = useInView();

    const data = {
        retailer: {
            title: t('PARTNER_RETAILER'),
            desc: t('PARTNER_RETAILER_DESC'),
            highlights: [
                { icon: '👥', text: t('PARTNER_RETAILER_H1') },
                { icon: '💰', text: t('PARTNER_RETAILER_H2') },
                { icon: '🛡️', text: t('PARTNER_RETAILER_H3') }
            ],
            categories: t('PARTNER_RETAILER_CATS').split(','),
            color: '#2563eb',
            image: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?q=80&w=1000&auto=format&fit=crop"
        },
        distributor: {
            title: t('PARTNER_DISTRIBUTOR'),
            desc: t('PARTNER_DISTRIBUTOR_DESC'),
            highlights: [
                { icon: '🏢', text: t('PARTNER_DISTRIBUTOR_H1') },
                { icon: '📈', text: t('PARTNER_DISTRIBUTOR_H2') },
                { icon: '🔄', text: t('PARTNER_DISTRIBUTOR_H3') }
            ],
            categories: t('PARTNER_DISTRIBUTOR_CATS').split(','),
            color: '#10b981',
            image: "/photo/distributor_main.jpg"
        },
        superDistributor: {
            title: t('PARTNER_INDIVIDUAL'),
            desc: t('PARTNER_INDIVIDUAL_DESC'),
            highlights: [
                { icon: '🌐', text: t('PARTNER_INDIVIDUAL_H1') },
                { icon: '💰', text: t('PARTNER_INDIVIDUAL_H2') },
                { icon: '🛡️', text: t('PARTNER_INDIVIDUAL_H3') }
            ],
            categories: t('PARTNER_INDIVIDUAL_CATS').split(','),
            color: '#f59e0b',
            image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1000&auto=format&fit=crop"
        }
    };

    const current = data[activeTab];

    return (
        <section className="rp-partners" id="partners" ref={ref}>
            <div className="section-container">
                <div className="partners-header">
                    <span className="partners-tag">{t('PARTNER_TAG')}</span>
                    <h2 className="partners-title-glow">{t('PARTNER_TITLE')}</h2>
                    <p className="partners-sub">{t('PARTNER_SUB')}</p>
                </div>

                <div className="partners-tabs">
                    {[
                        { id: 'retailer', label: t('PARTNER_RETAILER'), emoji: '🏪' },
                        { id: 'distributor', label: t('PARTNER_DISTRIBUTOR'), emoji: '🏗️' },
                        { id: 'superDistributor', label: t('PARTNER_INDIVIDUAL'), emoji: '🚀' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`partner-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            style={{ '--color': data[tab.id].color }}
                        >
                            {tab.emoji} {tab.label}
                        </button>
                    ))}
                </div>

                <div className={`partner-content-card ${visible ? 'visible' : ''}`} style={{ minHeight: activeTab === 'distributor' ? '360px' : '420px' }}>
                    <div className="partner-visual">
                        {activeTab === 'distributor' ? (
                            <img src={current.image} alt={current.title} className="partner-img" />
                        ) : (
                            <PhotoSlider />
                        )}
                        <div className="partner-visual-overlay" style={{ background: `linear-gradient(to top, ${current.color}cc, transparent)` }} />
                    </div>
                    <div className="partner-info">
                        <h3 style={{ color: current.color }}>{current.title}</h3>
                        <p className="partner-desc">{current.desc}</p>

                        <div className="partner-highlights">
                            {current.highlights.map((h, i) => (
                                <div key={i} className="highlight-item" style={{ background: `${current.color}08` }}>
                                    <span className="highlight-icon">{h.icon}</span>
                                    <span className="highlight-text">{h.text}</span>
                                </div>
                            ))}
                        </div>

                        <div className="partner-actions">
                            <button className="rp-btn rp-btn--lg" style={{ background: current.color, color: '#fff' }} onClick={() => navigate('/portal')}>Join Rupiksha</button>
                            <button className="rp-btn rp-btn--outline rp-btn--lg" style={{ borderColor: current.color, color: current.color }}>Income Calculator</button>
                        </div>

                        <div className="partner-categories-compact">
                            <h4>{current.title} Categories:</h4>
                            <div className="cat-grid-compact">
                                {current.categories.map((cat, idx) => (
                                    <span key={idx} className="cat-pill-compact">
                                        <span className="cat-dot" style={{ background: current.color }} />
                                        {cat}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════
   HOW IT WORKS — SCROLL PINNED (curve bottom → up)
══════════════════════════════════════════════ */
const HIW_ITEMS = [
    { title: "Register Now", desc: "Sign up in under 2 minutes with your mobile number. No paperwork needed.", step: "01", color: "#2563eb", grad: "linear-gradient(135deg,#1e3a8a,#2563eb)", icon: "🚀" },
    { title: "Upload KYC", desc: "Submit your Aadhaar and PAN details securely for instant verification.", step: "02", color: "#4f46e5", grad: "linear-gradient(135deg,#3730a3,#4f46e5)", icon: "🔐" },
    { title: "Get Approved", desc: "Our team verifies your account and activates all financial services within hours.", step: "03", color: "#16a34a", grad: "linear-gradient(135deg,#14532d,#16a34a)", icon: "✅" },
    { title: "Add Wallet Balance", desc: "Add funds via UPI, Bank Transfer or Credit Card to start transacting.", step: "04", color: "#dc2626", grad: "linear-gradient(135deg,#991b1b,#dc2626)", icon: "💳" },
    { title: "Start Earning", desc: "Offer digital payments to customers and earn commissions on every transaction.", step: "05", color: "#ca8a04", grad: "linear-gradient(135deg,#713f12,#ca8a04)", icon: "💰" },
];

function HowItWorksPinned() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const item = HIW_ITEMS[currentIndex];

    return (
        <PinnedCarouselSection
            id="how-it-works"
            totalSlides={HIW_ITEMS.length}
            index={currentIndex}
            setIndex={setCurrentIndex}
            outerStyle={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)' }}
        >
            <div className="hiw-pin-inner">
                {/* Header */}
                <div className="hiw-pin-header">
                    <h2 className="hiw-pin-title">How It Works</h2>
                    <p className="hiw-pin-sub">Your journey to financial freedom in 5 simple steps</p>
                </div>

                {/* Step indicators */}
                <div className="hiw-pin-steps">
                    {HIW_ITEMS.map((s, i) => (
                        <button
                            key={i}
                            className={`hiw-pin-step-btn ${i === currentIndex ? 'hiw-pin-step-btn--active' : ''} ${i < currentIndex ? 'hiw-pin-step-btn--done' : ''}`}
                            onClick={() => setCurrentIndex(i)}
                            style={i <= currentIndex ? { borderColor: s.color, background: i === currentIndex ? s.color : `${s.color}22`, color: i === currentIndex ? '#fff' : s.color } : {}}
                        >
                            {i < currentIndex ? '✓' : s.step}
                        </button>
                    ))}
                </div>

                {/* Main card — curve bottom to up */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        className="hiw-pin-card"
                        initial={{
                            opacity: 0,
                            y: 120,
                            rotate: 6,
                            scale: 0.88,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            rotate: 0,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            y: -80,
                            rotate: -4,
                            scale: 0.9,
                        }}
                        transition={{
                            duration: 0.6,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                    >
                        {/* Top gradient band */}
                        <div className="hiw-pin-card-top" style={{ background: item.grad }} />

                        {/* Step badge */}
                        <div className="hiw-pin-badge" style={{ background: item.grad }}>
                            {item.step}
                        </div>

                        {/* Card body */}
                        <div className="hiw-pin-card-body">
                            <div className="hiw-pin-icon">{item.icon}</div>
                            <h3 className="hiw-pin-card-title">{item.title}</h3>
                            <p className="hiw-pin-card-desc">{item.desc}</p>

                            {/* Connector dots */}
                            <div className="hiw-pin-connector">
                                {HIW_ITEMS.map((_, i) => (
                                    <div
                                        key={i}
                                        className="hiw-pin-dot"
                                        style={{ background: i <= currentIndex ? item.color : '#cbd5e1' }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Background watermark */}
                        <div className="hiw-pin-watermark">{item.icon}</div>
                    </motion.div>
                </AnimatePresence>

                {/* Scroll hint */}
                {currentIndex === 0 && (
                    <motion.div
                        className="svc-scroll-hint"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                    >
                        <span>Scroll through steps</span>
                        <div className="svc-scroll-arrow">↓</div>
                    </motion.div>
                )}
            </div>
        </PinnedCarouselSection>
    );
}

/* ══════════════════════════════════════════════
   APP
══════════════════════════════════════════════ */
export default function Home() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const scrollTo = params.get('scrollTo');
        if (scrollTo) {
            // Remove the query param from URL
            window.history.replaceState({}, '', '/');
            // Wait for DOM to render then scroll instantly (no animation = no flash)
            requestAnimationFrame(() => {
                const el = document.getElementById(scrollTo);
                if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 100;
                    window.scrollTo({ top, behavior: 'auto' });
                }
            });
        }
    }, []);

    return (
        <>
            <style>{CSS}</style>
            <div className="rp-root">
                <Navbar />
                <Hero />
                <StatsCounter />
                <Services />
                <Advantage />
                <HowItWorksPinned />
                <Partners />
                <Footer />
            </div>
        </>
    );
}

/* ══════════════════════════════════════════════
   STYLES (injected – no separate CSS file needed)
══════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@700;800&family=DM+Serif+Display:ital@0;1&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { overflow-x: hidden; max-width: 100%; }


:root {
  --blue: #2563eb;
  --blue-lt: #eff6ff;
  --green: #16a34a;
  --green-lt: #f0fdf4;
  --yellow: #ca8a04;
  --yellow-lt: #fefce8;
  --dark: #0f172a;
  --body: #334155;
  --muted: #64748b;
  --border: #e2e8f0;
  --white: #ffffff;
  --bg-light: #f8fafc;
  --radius: 20px;
  --shadow: 0 4px 24px rgba(0,0,0,0.07);
  --shadow-md: 0 8px 40px rgba(0,0,0,0.12);
}

.rp-root {
  font-family: 'Inter', sans-serif;
  color: var(--body);
  background: var(--white);
  display: flex;
  flex-direction: column;
  padding-top: 92px;
  overflow-x: hidden;
  max-width: 100vw;
}

/* ── Hero Section ── */
.rp-hero-section {
  background: linear-gradient(135deg, #fefce8 0%, #faf5ff 40%, #eff6ff 70%, #ffffff 100%);
  padding: 0 5% 0;
  position: relative;
  overflow: hidden;
  min-height: calc(100vh - 92px);
  display: flex;
  align-items: stretch;
}
.rp-hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: stretch;
  gap: 40px;
  width: 100%;
}
.rp-hero-left {
  flex: 1.2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  justify-content: center;
  padding: 40px 0;
}
.rp-hero-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #2563eb;
  margin-bottom: 20px;
}
.rp-hero-heading {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(3rem, 6vw, 5rem);
  font-weight: 400;
  color: #0f172a;
  line-height: 1.05;
  letter-spacing: -1px;
  margin-bottom: 28px;
}
.rp-hero-desc {
  font-size: 1.08rem;
  color: #334155;
  line-height: 1.75;
  max-width: 440px;
  margin-bottom: 40px;
  font-weight: 500;
}
.rp-hero-buttons {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.rp-hero-btn-primary {
  padding: 16px 36px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.25s;
  font-family: inherit;
}
.rp-hero-btn-primary:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(37,99,235,0.35);
}
.rp-hero-btn-store {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.25s;
}
.rp-hero-btn-store:hover {
  background: #1e293b;
  transform: translateY(-2px);
}
.rp-hero-right {
  flex: 1;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.rp-hero-right::before {
  content: '';
  position: absolute;
  width: 90%;
  height: 80%;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(253,230,138,0.25) 0%, rgba(196,181,253,0.2) 40%, transparent 70%);
  border-radius: 50%;
  z-index: 0;
  filter: blur(30px);
}
.rp-hero-character {
  width: 100%;
  max-width: 560px;
  max-height: calc(100vh - 80px);
  height: auto;
  object-fit: contain;
  object-position: bottom;
  position: relative;
  z-index: 1;
  margin-top: -40px;
}
.rp-hero-float-badge {
  position: absolute;
  top: 60px;
  right: 0;
  background: #fff;
  border-radius: 16px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
  border: 1px solid #f1f5f9;
  z-index: 2;
}
.rp-hero-stat-card {
  position: absolute;
  bottom: 100px;
  left: 30px;
  background: #fff;
  border-radius: 16px;
  padding: 18px 28px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
  border: 1px solid #f1f5f9;
  z-index: 2;
  text-align: center;
}
@media(max-width: 900px) {
  .rp-hero-inner { flex-direction: column; text-align: center; }
  .rp-hero-left { align-items: center; text-align: center; }
  .rp-hero-heading { font-size: clamp(2rem, 8vw, 3rem); }
  .rp-hero-desc { max-width: 100%; }
  .rp-hero-right { min-height: 350px; }
  .rp-hero-character { max-width: 280px; }
  .rp-hero-float-badge { top: 0; right: 0; }
  .rp-hero-stat-card { bottom: 40px; left: 0; }
  .rp-hero-buttons { justify-content: center; }
}

/* ── Stats Counter Bar ── */
.rp-stats-bar {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
  padding: 48px 5%;
}
.rp-stats-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  gap: 32px;
}
.rp-stat-item {
  text-align: center;
}
.rp-stat-value {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 400;
  color: #fff;
  line-height: 1.1;
  margin-bottom: 6px;
}
.rp-stat-label {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.7);
  font-weight: 500;
  letter-spacing: 0.5px;
}
@media(max-width: 600px) {
  .rp-stats-inner { gap: 24px; }
  .rp-stat-item { flex: 1 1 40%; }
}

/* ── Services Section (scroll-pinned) ── */
.svc-scroll-pin {
  background: #ffffff;
  width: 100%;
}
.svc-pin-inner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 40px 0 20px;
  position: relative;
}
.svc-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #e2e8f0;
  z-index: 10;
}
.svc-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1e3a8a, #2563eb);
  transition: width 0.4s ease;
  border-radius: 0 999px 999px 0;
}
.svc-scroll-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #64748b;
  margin-top: 24px;
  text-transform: uppercase;
}
.svc-scroll-arrow {
  animation: scrollBounce 1.5s infinite;
  font-size: 18px;
}
@keyframes scrollBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(6px); }
}

/* ── Advantage Section (scroll-pinned, redesigned cards) ── */
.rp-adv-pin-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 48px 5% 32px;
  box-sizing: border-box;
}
.rp-adv-pin-header {
  text-align: center;
  margin-bottom: 32px;
}
.rp-adv-pin-tag {
  display: inline-block;
  padding: 6px 18px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 14px;
}
.rp-adv-pin-title {
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 900;
  color: #fff;
  letter-spacing: -1px;
  line-height: 1.1;
}
.rp-adv-pin-viewport {
  width: 100%;
  max-width: 900px;
  perspective: 1200px;
}
.rp-adv-pin-card {
  width: 100%;
  border-radius: 32px;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  min-height: 260px;
}
.rp-adv-pin-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  border-radius: 32px 0 0 32px;
}
.rp-adv-pin-card-body {
  display: flex;
  align-items: center;
  gap: 40px;
  padding: 48px 52px 48px 48px;
  position: relative;
  z-index: 2;
}
.rp-adv-pin-icon {
  width: 96px;
  height: 96px;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.rp-adv-pin-content {
  flex: 1;
}
.rp-adv-pin-counter {
  font-size: 12px;
  font-weight: 800;
  color: #94a3b8;
  letter-spacing: 2px;
  margin-bottom: 10px;
  text-transform: uppercase;
}
.rp-adv-pin-card-title {
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  font-weight: 900;
  margin-bottom: 14px;
  letter-spacing: -1px;
  line-height: 1.15;
}
.rp-adv-pin-card-desc {
  font-size: 1.05rem;
  color: #475569;
  line-height: 1.75;
  font-weight: 500;
  max-width: 520px;
  margin-bottom: 24px;
}
.rp-adv-pin-progress {
  height: 4px;
  background: #e2e8f0;
  border-radius: 999px;
  max-width: 280px;
}
.rp-adv-pin-progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}
.rp-adv-pin-deco {
  font-size: 7rem;
  opacity: 0.06;
  position: absolute;
  right: 40px;
  top: 50%;
  transform: translateY(-50%);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
.rp-adv-pin-dots {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  justify-content: center;
}
.rp-adv-pin-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.35);
  cursor: pointer;
  padding: 0;
  transition: all 0.3s;
}
.rp-adv-pin-dot--active {
  width: 28px;
  border-radius: 999px;
  background: #fff;
}
@media(max-width: 768px) {
  .rp-adv-pin-card-body { flex-direction: column; gap: 24px; padding: 36px 28px; align-items: flex-start; }
  .rp-adv-pin-deco { display: none; }
  .rp-adv-pin-card-title { font-size: 1.6rem; }
  .rp-adv-pin-card { min-height: 320px; }
}

/* ── Gradient text ── */
.rp-gradient-text {
  background: linear-gradient(135deg, var(--blue) 0%, var(--green) 50%, var(--yellow) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}

/* ── Stagger items: each child fires independently via delay ── */
@keyframes cardReveal {
  from { opacity: 0; transform: translateY(40px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}

/* Cards sit invisibly in their normal layout position — NO transform so they don't overlap */
.stagger-item {
  opacity: 0;
}

/* When triggered: play reveal animation with fill-mode so from/to handle the translate */
.stagger-item--visible {
  animation: cardReveal 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* ── Horizontal scroll track ── */
.hs-track::-webkit-scrollbar { display: none; }
.hs-track { -ms-overflow-style: none; scrollbar-width: none; }

/* Emoji floating animations for the service cards */
@keyframes emojiFloat0 { 0%,100% { transform: translateY(0)    rotate(0deg);   } 50% { transform: translateY(-12px) rotate(2deg);  } }
@keyframes emojiFloat1 { 0%,100% { transform: translateY(0)    rotate(0deg);   } 50% { transform: translateY(-8px)  rotate(-2deg); } }
@keyframes emojiFloat2 { 0%,100% { transform: translateY(0)    rotate(0deg);   } 50% { transform: translateY(-14px) rotate(1deg);  } }

/* ── Section heading ── */
.section-head { margin-bottom: 56px; opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
.section-head--visible { opacity: 1; transform: translateY(0); }
.section-tag { display: inline-block; background: linear-gradient(90deg,var(--blue-lt),var(--green-lt)); color: var(--blue); font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border-radius: 999px; margin-bottom: 18px; border: 1px solid #c7d2fe; }
.section-title { 
  font-size: clamp(2rem, 4vw, 3rem); font-weight: 900; line-height: 1.15; 
  background: linear-gradient(135deg, #0f172a, #1e3a8a, #3b82f6, #0f172a);
  background-size: 300% 300%; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  animation: partnersDissolve 8s ease infinite;
}
.section-sub { 
  margin-top: 16px; font-size: 1.05rem; color: var(--muted); max-width: 580px; 
  margin-left: auto; margin-right: auto; line-height: 1.7; 
  background: linear-gradient(135deg, #475569, #1e3a8a, #475569);
  background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  animation: partnersDissolve 10s ease infinite;
}

/* ── Buttons ── */
.rp-btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; font-weight: 800; cursor: pointer; border: none; transition: all 0.25s; font-family: inherit; }
.rp-btn--primary { background: linear-gradient(135deg, var(--blue), #1d4ed8); color: #fff; box-shadow: 0 4px 20px rgba(37,99,235,0.4); }
.rp-btn--primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(37,99,235,0.5); }
.rp-btn--outline { background: transparent; color: var(--dark); border: 2px solid var(--border); }
.rp-btn--outline:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-lt); }
.rp-btn--white { background: #fff; color: var(--blue); font-weight: 900; }
.rp-btn--white:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.2); }
.rp-btn--ghost { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.25); }
.rp-btn--ghost:hover { background: rgba(255,255,255,0.22); }
.rp-btn--lg { padding: 16px 32px; font-size: 1rem; }
.rp-btn--sm { padding: 10px 24px; font-size: 0.8rem; }

/* ── Pill ── */
.rp-pill { background: var(--white); border: 1px solid var(--border); color: var(--body); border-radius: 999px; font-size: 11px; font-weight: 700; padding: 6px 14px; white-space: nowrap; }


/* ═══════════════════════════════════════════
   HERO
═══════════════════════════════════════════ */
.rp-hero { 
  min-height: 100vh; display: flex; align-items: stretch; justify-content: space-between; 
  padding: 40px 10% 0; position: relative; overflow: hidden; background: #fff; 
}
.rp-hero-bg { position: absolute; inset: 0; pointer-events: none; }
.rp-hero-bg__blob { 
  position: absolute; width: 60vw; height: 60vw; 
  filter: blur(100px); opacity: 0.15; border-radius: 50%; 
}
.rp-hero-bg__blob--1 { top: -20%; right: -45%; background: #a855f7; }
.rp-hero-bg__blob--2 { top: 20%; right: -25%; background: #fde047; }
.rp-hero-bg__blob--3 { top: 40%; right: 0; background: #f97316; opacity: 0.1; }
.rp-hero-bg__blob--4 { top: 10%; right: 15%; background: #3b82f6; opacity: 0.12; width: 40vw; height: 40vw; }

.rp-hero__content { 
  flex: 1.2; max-width: 650px; position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: flex-start; text-align: left;
  margin-top: auto; margin-bottom: auto;
}
.rp-hero__badge { 
  color: #a855f7; font-weight: 800; font-size: 13px; text-transform: uppercase; 
  letter-spacing: 2px; margin-bottom: 20px; text-align: left; width: 100%;
}
.rp-hero__h1 { 
  font-size: clamp(3rem, 6vw, 4.8rem); font-weight: 850; line-height: 1.1; 
  color: #0f172a; letter-spacing: -2px; margin-bottom: 24px; 
}
.rp-hero__h1 span { position: relative; display: inline-block; }
/* Blue underline removed as requested */
.rp-hero__sub { 
  font-size: 1.15rem; color: #475569; line-height: 1.6; max-width: 480px; 
  margin-bottom: 40px; text-align: left;
}
.rp-hero__stores { display: flex; gap: 15px; margin-bottom: 25px; }
.rp-store-btn { 
  height: 48px; background: #000; border-radius: 8px; display: flex; 
  align-items: center; padding: 0 16px; gap: 10px; color: #fff; cursor: pointer;
  transition: transform 0.3s ease;
}
.rp-store-btn:hover { transform: translateY(-3px); }
.rp-store-btn svg { width: 24px; height: 24px; }
.rp-store-text { text-align: left; }
.rp-store-text small { display: block; font-size: 10px; opacity: 0.8; }
.rp-store-text b { font-size: 14px; }

.rp-hero__trust { display: flex; gap: 20px; color: #475569; font-size: 13px; font-weight: 600; }
.rp-hero__trust span { display: flex; align-items: center; gap: 6px; }

/* Character Visuals */
.rp-hero__visuals { 
  flex: 1; position: relative; display: flex; justify-content: flex-end; align-items: flex-end; 
  min-height: 650px; overflow: visible;
}
.rp-hero__char { 
  width: 170%; height: auto; max-width: 1400px; z-index: 1; object-fit: contain; 
  transform-origin: bottom right;
  margin-right: -38%;
  margin-bottom: -5px; /* Ensure no gap at bottom */
  transform: translateY(0);
}

/* Floating Cards for Monks Pay Style */
.rp-float-widget { 
  position: absolute; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); 
  padding: 18px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.06); 
  z-index: 10; border: 1px solid rgba(255, 255, 255, 0.2); 
  animation: floatAnim 4s ease-in-out infinite; 
}
.rp-float-widget--payment { bottom: 12%; left: 5%; perspective: 1000px; }
.rp-float-widget--users { top: 35%; right: 0; }

@keyframes floatAnim { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }

.rp-payment-card { width: 220px; }
.rp-payment-card h6 { font-size: 12px; color: #64748b; margin-bottom: 5px; font-weight: 700; }
.rp-payment-card h4 { font-size: 18px; color: #1e3a8a; margin-bottom: 10px; font-weight: 800; }
.rp-payment-card .meta { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; }
.rp-payment-card .status { color: #10b981; }

.rp-users-card { display: flex; align-items: center; gap: 12px; padding: 12px 20px; }
.rp-users-avatar { display: flex; margin-left: -10px; }
.rp-users-avatar img { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; }
.rp-users-card b { font-size: 14px; color: #0f172a; }
.rp-users-card p { font-size: 10px; color: #64748b; margin: 0; }
.rp-mockup-phone:hover { transform: rotateY(-5deg) rotateX(5deg); }
.rp-phone-screen { padding: 25px 20px; color: #fff; }
.rp-phone-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }

/* Floating Glass Cards */
.rp-glass-card { 
  position: absolute; width: 200px; height: 130px; 
  background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(15, 23, 42, 0.1); border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.1); z-index: 10;
  display: flex; flex-direction: column; justify-content: space-between; padding: 18px;
  transition: all 0.4s ease;
}
.rp-glass-card--1 { top: 15%; right: -60px; transform: rotate(-8deg); border-left: 4px solid #1e3a8a; }
.rp-glass-card--2 { bottom: 15%; left: -60px; transform: rotate(10deg); border-right: 4px solid #2563eb; }

.rp-hero__actions { display: flex; gap: 12px; margin-top: 40px; align-items: center; flex-wrap: nowrap; }
.rp-hero__actions .rp-btn { height: 48px; padding: 0 24px; font-size: 15px; white-space: nowrap; }
.rp-stat-mini { margin-top: 60px; display: flex; align-items: center; gap: 20px; color: #0f172a; }
.rp-stat-mini b { font-size: 3rem; color: #1e3a8a; font-weight: 950; }
.rp-stat-mini p { font-size: 13px; color: #64748b; line-height: 1.4; max-width: 140px; font-weight: 500; }
.rp-float-card span { font-size: 22px; }
.rp-float-card b { display: block; font-size: 14px; font-weight: 800; color: var(--dark); }
.rp-float-card small { color: var(--muted); font-size: 11px; }
.rp-float-card--1 { top: 10px; left: 0; animation-delay: 0s; }
.rp-float-card--2 { bottom: 120px; right: -10px; animation-delay: 1.5s; }
.rp-float-card--3 { top: 60%; left: -20px; animation-delay: 3s; }
@keyframes floatPulse { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

/* Mockup Screen */
.rp-hero__mockup { width: 100%; max-width: 320px; margin: 0 auto; }
.rp-mockup-screen { background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%); border-radius: 28px; padding: 24px 20px; box-shadow: 0 30px 80px rgba(15,23,42,0.5); border: 1px solid #334155; }
.rp-mockup-bar { width: 60px; height: 5px; background: #334155; border-radius: 999px; margin: 0 auto 20px; }
.rp-mockup-bal { text-align: center; margin-bottom: 20px; }
.rp-mockup-bal small { color: #94a3b8; font-size: 11px; font-weight: 600; letter-spacing: 1px; display: block; }
.rp-mockup-bal b { color: #fff; font-size: 1.9rem; font-weight: 900; letter-spacing: -1px; }
.rp-mockup-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 20px; }
.rp-mockup-btn { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 10px 4px; text-align: center; cursor: pointer; transition: background 0.2s; animation: mockupPop 0.4s ease calc(var(--i)*0.1s) both; }
@keyframes mockupPop { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
.rp-mockup-btn:hover { background: #334155; }
.rp-mockup-btn span { display: block; font-size: 18px; }
.rp-mockup-btn small { color: #94a3b8; font-size: 9px; font-weight: 700; }
.rp-mockup-tx { background: #1e293b; border-radius: 14px; padding: 14px; border: 1px solid #334155; }
.rp-mockup-tx > span { color: #94a3b8; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 10px; }
.rp-mockup-tx-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #334155; }
.rp-mockup-tx-row:last-child { border-bottom: none; }
.rp-mockup-tx-row span { color: #cbd5e1; font-size: 12px; }
.rp-mockup-tx-row b { font-size: 12px; font-weight: 800; }

@media(max-width:900px){
  .rp-hero { 
    flex-direction:column; 
    padding: 160px 5% 60px !important; 
    text-align:center; 
    min-height: auto;
    justify-content: flex-start;
  }
  .rp-hero__content { 
    margin-top: 0 !important; 
    align-items: center !important; 
    text-align: center !important;
    max-width: 100% !important;
  }
  .rp-hero__badge { 
    text-align: center !important;
    margin-bottom: 24px !important;
  }
  .rp-hero__h1 {
    font-size: clamp(2rem, 9vw, 2.6rem) !important;
    margin-bottom: 18px !important;
    line-height: 1.2;
  }
  .rp-hero__sub {
    text-align: center !important;
    margin: 0 auto 36px !important;
    font-size: 0.95rem !important;
  }
  .rp-hero__actions { justify-content:center; }
  .rp-hero__pills { justify-content:center; }
  .rp-hero__visuals { max-width: 520px; min-height: 550px; margin-top: 40px; margin-bottom: 0; }
  .rp-float-card--1 { top:-10px; left:10px; }
  .rp-float-card--2 { right:0; bottom:80px; }
  .rp-float-card--3 { display:none; }
}

/* ═══════════════════════════════════════════
   STATS
═══════════════════════════════════════════ */
.rp-stats { background: linear-gradient(135deg, var(--blue) 0%, #1d4ed8 50%, var(--green) 100%); padding: 60px 5%; margin: 0; }
.rp-stats__inner { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(4,1fr); gap: 24px; }
.rp-stat-card { text-align: center; color: #fff; }
.rp-stat-num { display: block; font-size: clamp(2rem, 4vw, 2.8rem); font-weight: 900; color: #fff; letter-spacing: -1px; }
.rp-stat-label { font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.75); margin-top: 4px; display: block; }
@media(max-width:700px){ .rp-stats__inner { grid-template-columns: repeat(2,1fr); } }

/* ═══════════════════════════════════════════
   SECTIONS / GRID
═══════════════════════════════════════════ */
.rp-section { padding: 100px 5%; max-width: 1200px; margin: 0 auto; }
.rp-section--light { background: var(--bg-light); max-width: 100%; padding: 100px 5%; }
.rp-section--light > * { max-width: 1200px; margin-left: auto; margin-right: auto; }
.rp-grid { display: grid; gap: 24px; }
.rp-grid--3 { grid-template-columns: repeat(3,1fr); }
@media(max-width:900px){ .rp-grid--3 { grid-template-columns: repeat(2,1fr); } }
@media(max-width:600px){ .rp-grid--3 { grid-template-columns: 1fr; } }

/* ── Services Slider ── */
.svc-slider {
  display: flex;
  align-items: stretch;
  gap: 60px;
  min-height: 520px;
}
.svc-slider__left {
  flex: 1.3;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: left;
  align-items: flex-start;
}
.svc-slider__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  width: fit-content;
  margin-bottom: 18px;
}
.svc-slider__subtitle {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 8px;
}
.svc-slider__title {
  font-size: clamp(2.2rem, 4.5vw, 3.5rem);
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -1.5px;
  margin-bottom: 20px;
}
.svc-slider__desc {
  font-size: 1.05rem;
  color: #475569;
  line-height: 1.8;
  max-width: 480px;
  margin-bottom: 32px;
}
.svc-slider__features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 24px;
  margin-bottom: 32px;
}
.svc-slider__feat-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.92rem;
  color: #334155;
  line-height: 1.5;
}
.svc-slider__nav {
  display: flex;
  align-items: center;
  gap: 16px;
}
.svc-slider__arrow {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  color: #334155;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s;
  flex-shrink: 0;
  font-family: inherit;
}
.svc-slider__arrow:hover {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
  transform: scale(1.08);
}
.svc-slider__dots {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.svc-slider__dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: none;
  background: #cbd5e1;
  cursor: pointer;
  padding: 0;
  transition: all 0.3s;
}
.svc-slider__dot--active {
  width: 32px;
  background: #2563eb;
}
.svc-slider__right {
  flex: 0.7;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
}
.svc-slider__card {
  width: 100%;
  border-radius: 32px;
  padding: 56px 40px;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-height: 100%;
  position: relative;
  overflow: hidden;
}
.svc-slider__card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.1), transparent 50%);
  pointer-events: none;
}
.svc-slider__card-title {
  font-size: 1.8rem;
  font-weight: 900;
  margin-bottom: 16px;
  position: relative;
}
.svc-slider__card-desc {
  font-size: 0.95rem;
  line-height: 1.7;
  color: rgba(255,255,255,0.88);
  margin-bottom: 32px;
  position: relative;
}
.svc-slider__card-icon {
  margin-top: auto;
  position: relative;
}
@media(max-width: 900px) {
  .svc-slider {
    flex-direction: column;
    gap: 32px;
  }
  .svc-slider__features {
    grid-template-columns: 1fr;
  }
  .svc-slider__card {
    max-width: 100%;
    min-height: 280px;
  }
}

/* ═══════════════════════════════════════════
   SERVICE CARDS
═══════════════════════════════════════════ */
.rp-service-card {
  background: var(--card-bg, #f8fafc);
  border: 1.5px solid color-mix(in srgb, var(--card-color) 15%, transparent);
  border-radius: var(--radius);
  padding: 32px 28px;
  height: 100%;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
}
.rp-service-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 60%, color-mix(in srgb, var(--card-color) 8%, transparent) 100%);
  pointer-events: none;
}
.rp-service-card:hover { transform: translateY(-6px); box-shadow: 0 16px 40px color-mix(in srgb, var(--card-color) 20%, transparent); border-color: color-mix(in srgb, var(--card-color) 40%, transparent); }
.rp-service-icon { font-size: 2.5rem; margin-bottom: 16px; display: block; }
.rp-service-label { 
  font-size: 1.1rem; font-weight: 800; margin-bottom: 10px;
  background: linear-gradient(135deg, #0f172a, #1e3a8a, #3b82f6, #0f172a);
  background-size: 300% 300%; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  animation: partnersDissolve 8s ease infinite;
}
.rp-service-desc { font-size: 0.9rem; color: var(--muted); line-height: 1.7; }
.rp-service-arrow { position: absolute; bottom: 24px; right: 24px; font-size: 1.2rem; color: var(--card-color); font-weight: 900; opacity: 0; transition: opacity 0.2s, transform 0.2s; }
.rp-service-card:hover .rp-service-arrow { opacity: 1; transform: translateX(4px); }

/* ═══════════════════════════════════════════
   HOW IT WORKS V3 - PARABOLA
═══════════════════════════════════════════ */
.rp-how-parabola-container { position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; }

.how-step-node-v3 {
  background: transparent;
  width: 100%;
  display: flex;
  align-items: center;
}

@media(max-width: 900px) {
  .how-step-node-v3 {
    flex-direction: column !important;
    text-align: center;
    gap: 20px !important;
  }
}

.how-node-circle {
  width: 100px; height: 100px; background: #0033ffff; border: 4px solid #fff;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.1); transition: all 0.4s;
  z-index: 5;
}
.node-num { font-size: 2.2rem; font-weight: 950; color: var(--accent); position: relative; z-index: 5; }
.node-glow {
  position: absolute; inset: -4px; border-radius: 50%; filter: blur(15px);
  opacity: 0.15; transition: opacity 0.4s;
}

.how-node-card {
  background: #fff; padding: 30px 40px; border-radius: 32px;
  border: 1px solid #f1f5f9; box-shadow: 0 15px 40px rgba(0,0,0,0.05);
  position: relative; overflow: hidden; transition: all 0.4s;
}
.how-step-node-v3:hover .how-node-card { transform: scale(1.02); box-shadow: 0 25px 60px rgba(0,0,0,0.1); border-color: var(--blue); }

.how-node-title {
  font-size: 1.4rem; font-weight: 800; margin-bottom: 8px;
  background: linear-gradient(135deg, #0f172a, #1e3a8a, #3b82f6), #0f172a;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.how-node-desc { font-size: 0.95rem; color: var(--muted); line-height: 1.6; }

.how-node-icon-bg {
  position: absolute; bottom: -10px; right: -5px; font-size: 5rem;
  opacity: 0.04; transform: rotate(-15deg);
}

@media(max-width: 900px) {
  .how-connector-svg { display: none; }
}

@media(max-width:900px){
  .how-flow-line { display: none; }
  .rp-how-grid-v2 { grid-template-columns: 1fr; gap: 60px; }
  .how-node-card { padding: 30px 24px; }
}

/* ═══════════════════════════════════════════
   FEATURES
═══════════════════════════════════════════ */
.rp-feature-card { background: var(--white); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 32px 28px; height: 100%; transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s; }
.rp-feature-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--blue); }
.rp-feature-icon { display: block; font-size: 2rem; margin-bottom: 16px; }
.rp-feature-title { 
  font-size: 1rem; font-weight: 800; margin-bottom: 8px;
  background: linear-gradient(135deg, #0f172a, #1e3a8a, #3b82f6, #0f172a);
  background-size: 300% 300%; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  animation: partnersDissolve 8s ease infinite;
}
.rp-feature-desc { font-size: 0.88rem; color: var(--muted); line-height: 1.7; }

/* ═══════════════════════════════════════════
   TESTIMONIALS
═══════════════════════════════════════════ */
.rp-testi-card { background: var(--white); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 32px 28px; height: 100%; transition: transform 0.3s, box-shadow 0.3s; }
.rp-testi-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
.rp-testi-stars { color: var(--yellow); font-size: 1rem; margin-bottom: 14px; letter-spacing: 2px; }
.rp-testi-text { font-size: 0.95rem; color: var(--body); line-height: 1.75; margin-bottom: 24px; font-style: italic; }
.rp-testi-author { display: flex; align-items: center; gap: 14px; }
.rp-testi-avatar { font-size: 2.2rem; width: 48px; height: 48px; background: var(--bg-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid var(--border); flex-shrink: 0; }
.rp-testi-author b { display: block; font-size: 0.95rem; color: var(--dark); font-weight: 800; }
.rp-testi-author small { color: var(--muted); font-size: 0.8rem; }

/* ═══════════════════════════════════════════
   PARTNERS SECTION
 ═══════════════════════════════════════════ */
.rp-partners { padding: 60px 5%; background: #fff; position: relative; }
.partners-header { text-align: center; margin-bottom: 60px; display: flex; flex-direction: column; align-items: center; }
.partners-tag { 
  display: inline-block; padding: 6px 16px; background: #f0f7ff; border: 1.5px solid #dbeafe; 
  color: #1e3a8a; font-size: 11px; font-weight: 800; border-radius: 99px; text-transform: uppercase; 
  letter-spacing: 2px; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(30,58,138,0.1); 
}
.partners-title-glow {
  font-size: clamp(2.4rem, 6vw, 3.8rem); font-weight: 950; 
  background: linear-gradient(135deg, #0f172a, #1e3a8a, #3b82f6, #0f172a);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: partnersDissolve 8s ease infinite;
  margin-bottom: 16px; letter-spacing: -2px; line-height: 1.1;
}
@keyframes partnersDissolve {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.partners-sub { font-size: 1.15rem; color: #64748b; max-width: 600px; margin: 0 auto; line-height: 1.6; font-weight: 500; }

.partners-tabs { display: flex; justify-content: center; gap: 12px; margin-bottom: 48px; flex-wrap: wrap; }
.partner-tab-btn {
  padding: 14px 28px; border-radius: 16px; border: 1.5px solid #e2e8f0; background: #fff;
  font-family: inherit; font-size: 1rem; font-weight: 700; color: #64748b; cursor: pointer;
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.4s, color 0.4s, border-color 0.4s, box-shadow 0.4s; position: relative; overflow: hidden;
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
}
.partner-tab-btn.active { 
  border-color: var(--color); background: var(--color); color: #fff; 
  transform: translateY(-5px) scale(1.02); 
  box-shadow: 0 15px 30px -8px color-mix(in srgb, var(--color) 40%, transparent); 
}
.partner-tab-btn.active::before {
  content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(120deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: btnShine 3s infinite;
}
@keyframes btnShine {
  0% { left: -100%; } 20% { left: 100%; } 100% { left: 100%; }
}
.partner-tab-btn:hover:not(.active) { 
  border-color: var(--color); color: var(--color); 
  transform: translateY(-3px); box-shadow: 0 8px 20px -6px rgba(0,0,0,0.08); 
  background: #fff;
}
.partner-tab-btn::after {
  content: ''; position: absolute; bottom: 0; left: 50%; width: 0; height: 3px;
  background: #fff; transition: width 0.3s ease, transform 0.3s ease; transform: translateX(-50%);
  border-top-left-radius: 4px; border-top-right-radius: 4px;
}
.partner-tab-btn.active::after { width: 40%; }

.partner-content-card {
  max-width: 1200px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0;
  border-radius: 40px; display: grid; grid-template-columns: 42% 58%; gap: 0;
  box-shadow: 0 40px 80px -20px rgba(0,0,0,0.1); opacity: 0;
  min-height: 540px; /* Slightly reduced height as requested */
  transform: translateY(30px); transition: opacity 0.8s ease, transform 0.8s ease; overflow: hidden;
}
.partner-content-card.visible { opacity: 1; transform: translateY(0); }

.partner-visual { position: relative; width: 100%; height: 100%; overflow: hidden; }
.partner-img { width: 100%; height: 100%; object-fit: cover; object-position: center 15%; transition: transform 0.6s ease; }
.partner-visual:hover .partner-img { transform: scale(1.05); }
.partner-visual-overlay { position: absolute; inset: 0; mix-blend-mode: multiply; opacity: 0.3; }

.partner-info { padding: 24px 40px; display: flex; flex-direction: column; justify-content: center; }
.partner-info h3 { font-size: 1.8rem; font-weight: 800; margin-bottom: 8px; font-family: 'Plus Jakarta Sans', sans-serif; }
.partner-desc { font-size: 0.95rem; color: #475569; line-height: 1.6; margin-bottom: 12px; }

.partner-highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 16px; }
.highlight-item { 
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; 
  border-radius: 16px; border: 1px solid rgba(0,0,0,0.03);
  transition: transform 0.3s;
}
.highlight-item:hover { transform: translateX(5px); }
.highlight-icon { font-size: 1.4rem; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1)); }
.highlight-text { font-size: 0.9rem; font-weight: 700; color: #1e293b; line-height: 1.3; }

.partner-actions { display: flex; gap: 12px; margin-bottom: 16px; }

.partner-categories-compact h4 { font-size: 0.85rem; font-weight: 800; color: #94a3b8; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px; }
.cat-grid-compact { display: flex; flex-wrap: wrap; gap: 10px; }
.cat-pill-compact {
  padding: 8px 14px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 99px;
  font-size: 0.8rem; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 8px;
}
.cat-dot { width: 6px; height: 6px; border-radius: 50%; }

@media(max-width: 1000px) {
  .partner-content-card { grid-template-columns: 1fr; border-radius: 24px; padding: 0; }
  .partner-visual { height: 220px; }
  .partner-info { padding: 30px 20px; text-align: center; align-items: center; }
  .partner-info h3 { font-size: 1.8rem; }
  .partner-desc { font-size: 0.95rem; }
  .partner-actions { flex-direction: column; width: 100%; gap: 10px; }
  .partner-actions button { width: 100%; justify-content: center; }
  .partner-highlights { grid-template-columns: 1fr; width: 100%; }
}

/* ═══════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════ */
.rp-footer { background: var(--dark); color: rgba(255,255,255,0.75); }
.rp-footer__top { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 48px; max-width: 1200px; margin: 0 auto; padding: 72px 5% 48px; }
.rp-footer__logo { height: 36px; object-fit: contain; filter: brightness(0) invert(1); margin-bottom: 16px; display: block; }
.rp-footer__brand p { font-size: 0.88rem; line-height: 1.7; }
.rp-footer__socials { display: flex; gap: 12px; margin-top: 20px; }
.rp-social { width: 38px; height: 38px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1rem; text-decoration: none; transition: background 0.2s; cursor: pointer; }
.rp-social:hover { background: rgba(255,255,255,0.15); }
.rp-footer__links h5, .rp-footer__contact h5 { color: #fff; font-size: 0.85rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 18px; }
.rp-footer__links a, .rp-footer-link-btn { 
    display: block; font-size: 0.88rem; color: rgba(255,255,255,0.6); text-decoration: none; 
    margin-bottom: 10px; transition: color 0.2s; background: none; border: none; 
    padding: 0; cursor: pointer; text-align: left; font-family: inherit;
}
.rp-footer__links a:hover, .rp-footer-link-btn:hover { color: #fff; }
.rp-footer__contact p { font-size: 0.88rem; margin-bottom: 10px; line-height: 1.6; }
.rp-footer__bottom { border-top: 1px solid rgba(255,255,255,0.07); padding: 24px 5%; max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; flex-wrap: wrap; gap: 8px; }
@media(max-width:900px){ .rp-footer__top { grid-template-columns: 1fr 1fr; } .rp-footer-grid { grid-template-columns: repeat(2, 1fr) !important; } }
@media(max-width:600px){ .rp-footer__top { grid-template-columns: 1fr; } .rp-footer-grid { grid-template-columns: 1fr !important; } }

/* ─────────────────────────────────────────────
   WRITING ANIMATION (ADVANTAGE HEADER)
   — animations only fire when .--visible class is added
───────────────────────────────────────────── */
.writing-header { 
  display: flex; flex-direction: column; align-items: center; 
  opacity: 0; transform: scale(0.9); transition: none;
}
.writing-header--visible { 
  animation: headerHeroScale 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes headerHeroScale { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

.tag-reveal { 
  display: inline-block; padding: 4px 14px; background: #eef2ff; 
  border: 1px solid #c7d2fe; color: #2563eb; font-size: 11px; font-weight: 800; border-radius: 99px; 
  text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; 
  opacity: 0; transform: translateY(-20px);
}
.tag-reveal--visible {
  animation: tagDown 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards;
}

.typewriter-title {
  font-size: clamp(1.6rem, 4.5vw, 3rem); font-weight: 900; color: #0f172a; 
  margin-bottom: 24px; white-space: nowrap; overflow: hidden;
  width: 0; display: inline-block; letter-spacing: -1px;
  border-right: 3px solid transparent;
  max-width: 90vw;
}
.typewriter-title--visible {
  animation: typing 2.2s steps(40, end) 0.5s forwards;
}
@media(max-width: 600px) {
  .typewriter-title { white-space: normal; overflow: visible; width: auto !important; max-width: 100%; font-size: clamp(1.4rem, 6vw, 2rem); }
  .typewriter-title--visible { animation: none; }
}

.sub-reveal {
  font-size: 1.2rem; color: #64748b; max-width: 650px; margin: 0 auto; line-height: 1.7;
  font-weight: 500; animation: subUp 1s ease 1.5s both;
}

@keyframes tagDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes typing { from { width: 0; } to { width: 100%; } }
@keyframes blink { from, to { border-right: 3px solid transparent; } 50% { border-right: 3px solid #2563eb; } }
@keyframes subUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

/* ══════════════════════════════════════════════
   HOW IT WORKS — PINNED (hiw-pin-*)
══════════════════════════════════════════════ */
.hiw-pin-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 40px 5% 32px;
  box-sizing: border-box;
}
.hiw-pin-header {
  text-align: center;
  margin-bottom: 28px;
}
.hiw-pin-title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -1.5px;
  line-height: 1.1;
  margin-bottom: 10px;
}
.hiw-pin-sub {
  font-size: 1rem;
  color: #64748b;
  font-weight: 500;
}
/* ── Step indicator row ── */
.hiw-pin-steps {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  flex-wrap: wrap;
  justify-content: center;
}
.hiw-pin-step-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  background: #fff;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.3s ease;
  flex-shrink: 0;
}
.hiw-pin-step-btn--active {
  transform: scale(1.15);
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);
}
.hiw-pin-step-btn--done {
  opacity: 0.8;
}
/* ── Main card ── */
.hiw-pin-card {
  width: 100%;
  max-width: 560px;
  background: #fff;
  border-radius: 36px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.12);
  overflow: hidden;
  position: relative;
  will-change: transform;
}
.hiw-pin-card-top {
  height: 6px;
  width: 100%;
}
.hiw-pin-badge {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 900;
  color: #fff;
  margin: 28px 0 0 32px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
}
.hiw-pin-card-body {
  padding: 20px 36px 36px;
}
.hiw-pin-icon {
  font-size: 3.2rem;
  margin-bottom: 16px;
  line-height: 1;
}
.hiw-pin-card-title {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -0.5px;
  margin-bottom: 14px;
  line-height: 1.2;
}
.hiw-pin-card-desc {
  font-size: 1rem;
  color: #475569;
  line-height: 1.75;
  font-weight: 500;
  margin-bottom: 28px;
}
/* ── Progress dots inside card ── */
.hiw-pin-connector {
  display: flex;
  gap: 8px;
  align-items: center;
}
.hiw-pin-dot {
  height: 8px;
  border-radius: 999px;
  flex: 1;
  transition: background 0.4s ease;
}
/* ── Background watermark ── */
.hiw-pin-watermark {
  position: absolute;
  bottom: -10px;
  right: 20px;
  font-size: 8rem;
  opacity: 0.05;
  line-height: 1;
  pointer-events: none;
  user-select: none;
}

@media(max-width: 600px) {
  .hiw-pin-steps { gap: 8px; }
  .hiw-pin-step-btn { width: 44px; height: 44px; font-size: 0.8rem; }
  .hiw-pin-card { border-radius: 28px; }
  .hiw-pin-card-body { padding: 16px 24px 28px; }
  .hiw-pin-badge { margin: 20px 0 0 20px; width: 52px; height: 52px; }
  .hiw-pin-icon { font-size: 2.6rem; }
}

`;


