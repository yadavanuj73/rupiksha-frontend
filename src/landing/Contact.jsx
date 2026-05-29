import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Phone, MessageSquare, Send, CheckCircle, Loader2 } from 'lucide-react';
// Using logo from public folder
const logo = '/rupiksha logo.jpeg';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';

const Contact = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    // Form state
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: 'Feedback', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const BRANCHES = [
        {
            id: 'muzaffarpur',
            name: 'Muzaffarpur (HQ)',
            city: 'Muzaffarpur',
            address: 'Rupiksha Service Pvt Ltd, Muzaffarpur, Bihar, 842001',
            query: 'Rupiksha Service Pvt Ltd, Muzaffarpur, Bihar 842001'
        },
        {
            id: 'ranchi',
            name: 'Ranchi Office',
            city: 'Ranchi',
            address: 'Kanke Road, Ranchi, Jharkhand 834008',
            query: 'Kanke Road, Ranchi, Jharkhand 834008'
        },
        {
            id: 'bangalore',
            name: 'Bangalore Office',
            city: 'Bangalore',
            address: 'Sarjapur Road, Bangalore, Karnataka 562125',
            query: 'Sarjapur Road, Bangalore, Karnataka 562125'
        },
        {
            id: 'noida',
            name: 'Greater Noida Office',
            city: 'Noida',
            address: 'Gaur City, Greater Noida, Uttar Pradesh 201308',
            query: 'Gaur City, Greater Noida, Uttar Pradesh'
        }
    ];
    const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);

    useEffect(() => {
        window.scrollTo(0, 0);
        const h = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', h);
        return () => window.removeEventListener('scroll', h);
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulate API call to send to admin and email
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmitted(true);
            setFormData({ name: '', email: '', phone: '', subject: 'Feedback', message: '' });
            setTimeout(() => setSubmitted(false), 5000);
        }, 1500);
    };

    return (
        <div className="contact-root">
            <style>{CONTACT_CSS}</style>

            <Navbar />

            {/* Hero Section */}
            <header className="contact-hero">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="contact-hero-container"
                >
                    <span className="contact-tag">Support Center</span>
                    <h1 className="contact-h1 partners-title-glow">Let's build the future<br />of Bharat, together.</h1>
                    <p className="contact-sub">Have a question or looking to partner? Our dedicated support team is just a message away.</p>
                </motion.div>

                {/* Animated Atmosphere Blobs */}
                <div className="hero-atmosphere">
                    <div className="meshmesh mesh1"></div>
                    <div className="meshmesh mesh2"></div>
                    <div className="meshmesh mesh3"></div>
                </div>
            </header>

            <section className="contact-grid-section glassy-container">
                {/* Background Blobs for Glass Effect */}
                <div className="glass-bg-atmosphere">
                    <div className="glass-blob glass-blob--yellow"></div>
                    <div className="glass-blob glass-blob--green"></div>
                </div>

                <div className="contact-container" style={{ position: 'relative', zIndex: 5 }}>
                    <div className="contact-main-grid">



                        {/* Right: Contact Form */}
                        <div className="contact-form-panel">
                            <div className="form-card">
                                <div className="form-header">
                                    <div className="form-icon">
                                        <MessageSquare size={28} />
                                    </div>
                                    <h3>Get in Touch</h3>
                                    <p className="form-subtitle">We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>
                                </div>
                                
                                <AnimatePresence mode="wait">
                                    {submitted ? (
                                        <motion.div
                                            key="success"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="success-message"
                                        >
                                            <div className="success-icon-wrap">
                                                <CheckCircle size={64} />
                                            </div>
                                            <h4>Message Sent Successfully!</h4>
                                            <p>Thank you for reaching out. Your {formData.subject.toLowerCase()} has been received and our team will get back to you shortly.</p>
                                            <button 
                                                className="rp-btn rp-btn--secondary"
                                                onClick={() => setSubmitted(false)}
                                            >
                                                Send Another Message
                                            </button>
                                        </motion.div>
                                    ) : (
                                        <motion.form
                                            key="form"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            onSubmit={handleSubmit}
                                            className="contact-form"
                                        >
                                            {/* Name & Email Row */}
                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label className="field-label">
                                                        <User size={14} />
                                                        Full Name <span className="required">*</span>
                                                    </label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        name="name" 
                                                        value={formData.name} 
                                                        onChange={handleChange}
                                                        placeholder="Enter your full name"
                                                        className="field-input"
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">
                                                        <Mail size={14} />
                                                        Email Address <span className="required">*</span>
                                                    </label>
                                                    <input 
                                                        required 
                                                        type="email" 
                                                        name="email" 
                                                        value={formData.email} 
                                                        onChange={handleChange}
                                                        placeholder="your@email.com"
                                                        className="field-input"
                                                    />
                                                </div>
                                            </div>

                                            {/* Phone & Subject Row */}
                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label className="field-label">
                                                        <Phone size={14} />
                                                        Phone Number
                                                    </label>
                                                    <input 
                                                        type="tel" 
                                                        name="phone" 
                                                        value={formData.phone} 
                                                        onChange={handleChange}
                                                        placeholder="+91 98765 43210"
                                                        className="field-input"
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">
                                                        <MessageSquare size={14} />
                                                        Subject <span className="required">*</span>
                                                    </label>
                                                    <select 
                                                        required 
                                                        name="subject" 
                                                        value={formData.subject} 
                                                        onChange={handleChange}
                                                        className="field-input field-select"
                                                    >
                                                        <option value="">Select a subject</option>
                                                        <option value="Feedback">Give Feedback</option>
                                                        <option value="Suggestion">Give Suggestion</option>
                                                        <option value="Partnership">Partnership Inquiry</option>
                                                        <option value="Support">Technical Support</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Message Field */}
                                            <div className="form-field full-width">
                                                <label className="field-label">
                                                    <MessageSquare size={14} />
                                                    Your Message <span className="required">*</span>
                                                </label>
                                                <textarea 
                                                    required 
                                                    name="message" 
                                                    value={formData.message} 
                                                    onChange={handleChange}
                                                    placeholder="Tell us how we can help you..."
                                                    rows="5"
                                                    className="field-input field-textarea"
                                                ></textarea>
                                            </div>

                                            {/* Submit Button */}
                                            <div className="form-submit">
                                                <button 
                                                    type="submit" 
                                                    disabled={isSubmitting} 
                                                    className="submit-button"
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <Loader2 size={20} className="spin" />
                                                            Sending...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send size={20} />
                                                            Send Message
                                                        </>
                                                    )}
                                                </button>
                                                <p className="form-note">
                                                    By submitting this form, you agree to our privacy policy and terms of service.
                                                </p>
                                            </div>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="faq-section">
                <div className="contact-container">
                    <div className="section-center-head">
                        <h2>Common Questions</h2>
                        <p>Everything you need to know about our digital ecosystem.</p>
                    </div>

                    <div className="faq-grid">
                        <div className="faq-card">
                            <h4>How do I become a partner?</h4>
                            <p>Simply register via our portal or contact our sales team. We'll guide you through the digital onboarding process in minutes.</p>
                        </div>
                        <div className="faq-card">
                            <h4>What are the tech requirements?</h4>
                            <p>A basic smartphone or PC with an internet connection is all you need to start providing services to your local community.</p>
                        </div>
                        <div className="faq-card">
                            <h4>Is the platform secure?</h4>
                            <p>We use bank-grade 256-bit SSL encryption and are fully RBI compliant, ensuring every transaction is 100% protected.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Map Section Upgrade */}
            <section className="map-section">
                <div className="map-visual">
                    <AnimatePresence mode="wait">
                        <motion.iframe
                            key={selectedBranch.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            title="Office Location"
                            src={`https://www.google.com/maps?q=${encodeURIComponent(selectedBranch.query)}&output=embed`}
                            loading="lazy"
                        ></motion.iframe>
                    </AnimatePresence>
                </div>
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="map-overlay-card"
                >
                    <div className="location-tabs">
                        {BRANCHES.map(b => (
                            <button
                                key={b.id}
                                className={`loc-tab ${selectedBranch.id === b.id ? 'active' : ''}`}
                                onClick={() => setSelectedBranch(b)}
                            >
                                {b.city}
                            </button>
                        ))}
                    </div>

                    <h3>{selectedBranch.name}</h3>
                    <p>Our presence in {selectedBranch.city} ensures localized support and faster business integrations.</p>

                    <div className="contact-detail-card-v2" style={{ backgroundColor: '#f8fafc', border: 'none', padding: '15px', marginTop: '20px' }}>
                        <div className="detail-icon-v2" style={{ width: '44px', height: '44px', fontSize: '1.2rem', backgroundColor: '#fff' }}>📍</div>
                        <div className="detail-text-v2">
                            <small style={{ color: '#2563eb' }}>Official Branch Address</small>
                            <h4 style={{ fontSize: '0.85rem', color: '#1e293b' }}>{selectedBranch.address}</h4>
                        </div>
                    </div>
                </motion.div>
            </section>

            <Footer />
        </div >
    );
};

const CONTACT_CSS = `
.contact-root { background: #fff; font-family: 'Plus Jakarta Sans', sans-serif; color: #1e293b; overflow-x: hidden; }
.contact-container { max-width: 1200px; margin: 0 auto; padding: 0 5%; }


/* Hero Updated */
.contact-hero { min-height: 80vh; background: #0f172a; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; text-align: center; padding: 120px 20px 80px; }
.contact-tag { display: inline-block; padding: 8px 18px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 99px; font-weight: 800; color: #10b981; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 2px; margin-bottom: 30px; }
.contact-h1 { font-size: clamp(2.5rem, 8vw, 5.5rem); font-weight: 950; color: #fff; line-height: 1; letter-spacing: -0.04em; margin-bottom: 30px; width: 100%; max-width: 1000px; margin-inline: auto; }
.contact-sub { font-size: clamp(1rem, 2vw, 1.25rem); color: #94a3b8; max-width: 700px; margin: 0 auto; line-height: 1.6; font-weight: 500; padding: 0 10px; }

.hero-atmosphere { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.meshmesh { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.4; animation: meshFloat 15s infinite alternate ease-in-out; }
.mesh1 { width: 600px; height: 600px; background: #1d4ed8; top: -100px; right: -100px; }
.mesh2 { width: 500px; height: 500px; background: #065f46; bottom: -100px; left: -100px; animation-delay: -5s; }
.mesh3 { width: 400px; height: 400px; background: #1e3a8a; top: 40%; left: 30%; animation-delay: -10s; }

@keyframes meshFloat {
    from { transform: translate(0,0) scale(1); }
    to { transform: translate(50px, 40px) scale(1.1); }
}

/* Main Grid */
.contact-grid-section { padding: clamp(60px, 10vw, 160px) 0; background: #fff; position: relative; z-index: 10; margin-top: -100px; border-radius: clamp(40px, 8vw, 80px) clamp(40px, 8vw, 80px) 0 0; }
.contact-main-grid { display: flex; justify-content: center; padding: 0 20px; }
.contact-form-panel { width: 100%; max-width: 900px; }

.info-label { color: #2563eb; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; font-size: 0.8rem; margin-bottom: 12px; display: block; }
.contact-info-panel h2 { font-size: 3.2rem; font-weight: 900; margin-bottom: 24px; line-height: 1.1; letter-spacing: -1px; }
.contact-info-panel p { font-size: 1.1rem; color: #64748b; line-height: 1.8; margin-bottom: 40px; }

.contact-cards-stack { display: flex; flex-direction: column; gap: 20px; }
.contact-detail-card-v2 { display: flex; gap: 20px; padding: 24px; background: #fff; border: 1px solid #f1f5f9; border-radius: 24px; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
.contact-detail-card-v2:hover { transform: translateY(-5px); border-color: #2563eb; background: #f0f9ff; box-shadow: 0 15px 35px rgba(37, 99, 235, 0.1); }
.detail-icon-v2 { font-size: 2rem; width: 64px; height: 64px; background: #fff; border-radius: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08); flex-shrink: 0; }
.detail-text-v2 { display: flex; flex-direction: column; justify-content: center; }
.detail-text-v2 small { color: #2563eb; font-weight: 800; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1.5px; display: block; margin-bottom: 6px; }
.detail-text-v2 h4 { font-size: 1.15rem; font-weight: 900; margin: 0; color: #0f172a; line-height: 1.3; }

/* Cyber-Luxe Glassy Theme */
.contact-grid-section.glassy-container { 
    overflow: hidden; 
    position: relative; 
    padding: 160px 0;
    background: #fff;
    margin-top: -100px;
    border-radius: 80px 80px 0 0;
}
.glass-bg-atmosphere { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.glass-blob { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.3; animation: blobFloat 20s infinite alternate cubic-bezier(0.45, 0, 0.55, 1); }
.glass-blob--yellow { width: 800px; height: 800px; background: #fef08a; top: -200px; right: -150px; }
.glass-blob--green { width: 700px; height: 700px; background: #bbf7d0; bottom: -100px; left: -100px; animation-delay: -5s; }

@keyframes blobFloat {
    0% { transform: translate(0,0) scale(1); }
    100% { transform: translate(50px, 50px) scale(1.1); }
}

/* Enhanced Form Card */
.form-card { 
    background: rgba(255, 255, 255, 0.6); 
    backdrop-filter: blur(40px) saturate(180%); 
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    padding: clamp(30px, 4vw, 50px); 
    border-radius: clamp(24px, 4vw, 40px); 
    border: 1px solid rgba(255, 255, 255, 0.7); 
    box-shadow: 
        0 4px 6px -1px rgba(0,0,0,0.01),
        0 60px 120px -20px rgba(0,0,0,0.08),
        0 40px 80px -30px rgba(0,0,0,0.12),
        inset 0 0 0 1px rgba(255,255,255,0.5); 
    position: relative; 
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
}
.form-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 2px;
    background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(255,255,255,0.1), rgba(37,99,235,0.1));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
}

/* Form Header */
.form-header {
    text-align: center;
    margin-bottom: 35px;
}
.form-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    color: #fff;
    box-shadow: 0 10px 30px rgba(37,99,235,0.3);
}
.form-header h3 { 
    font-size: 2rem; 
    font-weight: 900; 
    margin-bottom: 10px; 
    letter-spacing: -1px; 
    line-height: 1.2;
    color: #0f172a;
}
.form-subtitle {
    font-size: 0.95rem;
    color: #64748b;
    line-height: 1.6;
    max-width: 400px;
    margin: 0 auto;
}

/* Form Structure */
.contact-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
}
.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}
.form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.form-field.full-width {
    grid-column: 1 / -1;
}

/* Field Labels */
.field-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.field-label svg {
    color: #2563eb;
}
.field-label .required {
    color: #ef4444;
    font-weight: 700;
}

/* Field Inputs */
.field-input {
    padding: 14px 16px;
    border-radius: 14px;
    border: 1.5px solid rgba(15, 23, 42, 0.1);
    background: #fff;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    color: #0f172a;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    outline: none;
    width: 100%;
    box-shadow: 
        0 2px 4px rgba(15, 23, 42, 0.02),
        inset 0 1px 2px rgba(255,255,255,0.8);
}
.field-input::placeholder {
    color: #94a3b8;
    font-weight: 400;
}
.field-input:hover {
    border-color: rgba(37, 99, 235, 0.3);
}
.field-input:focus {
    border-color: #2563eb;
    background: #fff;
    box-shadow: 
        0 0 0 4px rgba(37,99,235,0.08),
        0 8px 16px rgba(0,0,0,0.04);
    transform: translateY(-2px);
}
.field-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 40px;
}
.field-select option {
    font-size: 0.95rem;
    padding: 10px;
}
.field-textarea {
    resize: vertical;
    min-height: 120px;
    line-height: 1.6;
}

/* Submit Section */
.form-submit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    margin-top: 10px;
    padding-top: 20px;
    border-top: 1px solid rgba(15, 23, 42, 0.06);
}
.submit-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: linear-gradient(135deg, #0f172a, #1e293b);
    color: #fff;
    padding: 16px 40px;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    border: none;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
    width: 100%;
    max-width: 300px;
}
.submit-button:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 15px 40px rgba(15, 23, 42, 0.35);
}
.submit-button:active:not(:disabled) {
    transform: translateY(-1px) scale(0.98);
}
.submit-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}
.submit-button .spin {
    animation: spin 1s linear infinite;
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.form-note {
    font-size: 0.75rem;
    color: #94a3b8;
    text-align: center;
    margin: 0;
}

/* Success Message */
.success-message {
    text-align: center;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
}
.success-icon-wrap {
    width: 100px;
    height: 100px;
    background: linear-gradient(135deg, #10b981, #059669);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    margin-bottom: 10px;
    box-shadow: 0 15px 40px rgba(16, 185, 129, 0.3);
}
.success-message h4 {
    font-size: 1.6rem;
    font-weight: 900;
    color: #0f172a;
    margin: 0;
}
.success-message p {
    font-size: 0.95rem;
    color: #64748b;
    line-height: 1.6;
    max-width: 350px;
    margin: 0 0 15px;
}

/* Secondary Button */
.rp-btn--secondary {
    background: transparent;
    border: 2px solid #e2e8f0;
    color: #475569;
    padding: 12px 28px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 10px;
}
.rp-btn--secondary:hover {
    border-color: #2563eb;
    color: #2563eb;
    background: rgba(37,99,235,0.05);
}

/* FAQ Atmos */
.faq-section { padding: 120px 0; background: #0f172a; color: #fff; }
.section-center-head h2 { font-size: 3.5rem; font-weight: 950; margin-bottom: 12px; letter-spacing: -2px; }
.section-center-head p { color: #94a3b8; font-size: 1.15rem; }
.faq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 30px; }
.faq-card { background: rgba(255,255,255,0.03); padding: 40px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.06); transition: 0.3s; }
.faq-card:hover { background: rgba(255,255,255,0.06); transform: translateY(-5px); border-color: #10b981; }
.faq-card h4 { font-size: 1.3rem; font-weight: 800; margin-bottom: 16px; color: #fff; line-height: 1.3; }
.faq-card p { font-size: 1rem; color: #94a3b8; line-height: 1.7; margin: 0; }

/* Map Section Upgrade */
.map-section { padding: 0; position: relative; min-height: 700px; display: flex; align-items: center; }
.map-visual { position: absolute; inset: 0; z-index: 1; filter: grayscale(1) invert(0.9) contrast(1.2); }
.map-visual iframe { width: 100%; height: 100%; border:0; }

.map-overlay-card { position: relative; z-index: 10; margin-left: 5%; width: 450px; background: #fff; padding: 40px; border-radius: 40px; box-shadow: 0 40px 100px rgba(0,0,0,0.15); border: 1px solid #f1f5f9; }
.map-overlay-card h3 { font-size: 2.2rem; font-weight: 900; margin: 20px 0 12px; letter-spacing: -1.5px; color: #0f172a; }
.map-overlay-card p { font-size: 1rem; color: #64748b; line-height: 1.6; margin-bottom: 0; }

.location-tabs { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 16px; margin-bottom: 24px; }
.loc-tab { flex: 1; border: none; background: transparent; padding: 10px 4px; border-radius: 12px; font-weight: 800; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; cursor: pointer; transition: all 0.3s; white-space: nowrap; text-align: center; }
.loc-tab:hover { color: #2563eb; }
.loc-tab.active { background: #fff; color: #2563eb; box-shadow: 0 4px 12px rgba(37,99,235,0.1); }

/* Reused Buttons */
.rp-btn { border: none; border-radius: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; padding: 14px 30px; font-size: 0.9rem; }
.rp-btn--primary { background: #2563eb; color: #fff; box-shadow: 0 10px 20px rgba(37,99,235,0.2); }
.rp-btn--primary:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 20px 40px rgba(37,99,235,0.3); }
.rp-btn--lg { padding: 20px 44px; font-size: 1rem; }
.rp-btn--sm { padding: 10px 24px; font-size: 0.8rem; }

.submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.success-message { text-align: center; padding: 40px 20px; }
.success-icon { font-size: 5rem; margin-bottom: 20px; }
.success-message h4 { font-size: 2.2rem; font-weight: 900; color: #10b981; margin-bottom: 12px; }

.partners-title-glow {
  background: linear-gradient(135deg, #ffffff, #1e3a8a, #ffffff, #1e3a8a);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: partnersGlowShine 8s ease-in-out infinite;
  text-shadow: 0 10px 30px rgba(255,255,255,0.05);
}
@keyframes partnersGlowShine { 0% { background-position: 0% center; } 50% { background-position: 100% center; } 100% { background-position: 0% center; } }

@media(max-width: 1000px) {
    .rp-nav__links { display: none; }
    .contact-hero { padding-top: 100px; }
    .map-section { flex-direction: column; min-height: auto; }
    .map-visual { position: relative; height: 400px; width: 100%; order: 2; }
    .map-overlay-card { 
        position: relative; 
        margin: -60px 20px 40px; 
        width: calc(100% - 40px); 
        padding: 30px; 
        border-radius: 30px; 
        box-shadow: 0 20px 50px rgba(0,0,0,0.1); 
        order: 1;
        z-index: 20;
    }
    .map-overlay-card h3 { font-size: 1.8rem; }
    .faq-grid { grid-template-columns: 1fr; gap: 20px; }
    .section-center-head h2 { font-size: 2.2rem; }
}

@media(max-width: 768px) {
    .form-card { padding: 30px 20px; }
    .form-header h3 { font-size: 1.6rem; }
    .form-subtitle { font-size: 0.9rem; }
    .form-icon { width: 56px; height: 56px; }
    .form-row { grid-template-columns: 1fr; gap: 18px; }
    .field-input { padding: 12px 14px; font-size: 0.9rem; }
    .submit-button { max-width: 100%; padding: 14px 30px; }
    .success-icon-wrap { width: 80px; height: 80px; }
    .success-message h4 { font-size: 1.4rem; }
}

@media(max-width: 600px) {
    .form-card { padding: 25px 18px; }
    .form-header { margin-bottom: 25px; }
    .form-header h3 { font-size: 1.4rem; }
    .field-label { font-size: 0.7rem; }
    .location-tabs { overflow-x: auto; padding: 4px; gap: 4px; justify-content: flex-start; scrollbar-width: none; }
    .location-tabs::-webkit-scrollbar { display: none; }
    .loc-tab { padding: 8px 16px; font-size: 0.65rem; }
}
`;


export default Contact;
