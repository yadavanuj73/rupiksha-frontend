// Landing Page Content Service
// Stores all editable content in localStorage with backend sync capability

const STORAGE_KEY = 'rupiksha_landing_content';

export const DEFAULT_CONTENT = {
    // ─── HERO SECTION ────────────────────────────────────────────────────
    hero: {
        badge: '🇮🇳 India\'s Most Trusted Fintech Platform',
        headline: 'डिजिटल इंडिया का <span style="color:#22d3ee">सबसे बड़ा</span> Retail Fintech Network',
        subheadline: 'Turn your shop into a digital bank. Earn daily commissions on AEPS, Money Transfer, Bill Payments, Recharge, Insurance & more.',
        cta_primary: 'Start Earning Today',
        cta_secondary: 'Watch Demo',
        announcement: '🎉 New: Insurance & Loan services now live!',
    },

    // ─── STATS ───────────────────────────────────────────────────────────
    stats: [
        { num: '100', label: 'Cities Covered', suffix: '+', prefix: '' },
        { num: '50K', label: 'Active Retailers', suffix: '+', prefix: '' },
        { num: '200', label: 'Monthly Volume', suffix: 'Cr+', prefix: '₹' },
        { num: '99.9', label: 'Uptime SLA', suffix: '%', prefix: '' },
    ],

    // ─── HOW IT WORKS ────────────────────────────────────────────────────
    how: [
        { step: '01', color: '#2563eb', title: 'Register Now', desc: 'Sign up in under 2 minutes with your mobile number. No paperwork needed.' },
        { step: '02', color: '#16a34a', title: 'Get Approved', desc: 'Our team verifies your account and activates all financial services.' },
        { step: '03', color: '#ca8a04', title: 'Start Earning', desc: 'Offer digital payments to customers and earn commissions every day.' },
    ],

    // ─── WHY CHOOSE US (ADVANTAGE) ───────────────────────────────────────
    advantages: [
        { icon: '🔐', title: 'Secure Transactions', desc: 'Bank-grade security with end-to-end encryption and multi-factor authentication.', color: '#4f46e5' },
        { icon: '⚡', title: 'Real-time Processing', desc: 'Instant transaction processing with immediate confirmations and minimal wait times.', color: '#10b981' },
        { icon: '💰', title: 'High Commission', desc: 'Earn attractive commissions on every transaction with timely settlements.', color: '#f59e0b' },
        { icon: '📊', title: 'Live Analytics', desc: 'Comprehensive reporting and analytics to track your business growth.', color: '#8b5cf6' },
        { icon: '🛎️', title: '24/7 Support', desc: 'Dedicated customer support available round-the-clock for any queries.', color: '#f43f5e' },
        { icon: '🏦', title: 'RBI Compliant', desc: 'Fully compliant with all RBI regulations for digital payment services.', color: '#334155' },
    ],

    // ─── FEATURES ────────────────────────────────────────────────────────
    features: [
        { icon: '🔒', title: 'Bank-grade Security', desc: '256-bit SSL, RBI compliant & ISO certified.' },
        { icon: '⚡', title: 'Instant Settlement', desc: 'T+0 settlement for high-volume partners.' },
        { icon: '📊', title: 'Live Analytics', desc: 'Real-time dashboards & downloadable reports.' },
        { icon: '🤝', title: 'Dedicated Support', desc: '24×7 helpdesk via call, chat & WhatsApp.' },
        { icon: '🌐', title: 'Pan-India Network', desc: 'Operate from any state with our GST invoice.' },
        { icon: '💡', title: 'Training Videos', desc: 'Step-by-step tutorials inside your portal.' },
    ],

    // ─── CONTACT / FOOTER ────────────────────────────────────────────────
    contact: {
        phone: '+91 98765 43210',
        email: 'support@rupiksha.in',
        address: 'Rupiksha Services Private Limited, India',
        whatsapp: '+91 98765 43210',
    },

    // ─── COMPANY INFO ────────────────────────────────────────────────────
    company: {
        name: 'RuPiKsha',
        tagline: 'Har Dukan, Digital Seva',
        founded: '2022',
        cin: 'U65999MH2022PTC123456',
        gstin: '27AAACP1234Q1Z5',
    },

    // ─── NAVBAR ──────────────────────────────────────────────────────────
    navbar: {
        logo_text: 'RuPiKsha',
        links: ['Services', 'How It Works', 'Stats', 'Why Us', 'Contact'],
        cta: 'Login / Register',
    },

    // ─── SERVICES VISIBILITY ─────────────────────────────────────────────
    services_visibility: {
        'AEPS': true, 'Micro Banking': true, 'Micro Loan': true, 'Neo Bank': true,
        'CSP Point': true, 'BC': true, 'Money Transfer': true, 'Bill Payment': true,
        'Recharge': true, 'Tours & Travel': true, 'Insurance': true, 'Utility Services': true,
    },

    // ─── SECTION VISIBILITY ──────────────────────────────────────────────
    sections: {
        hero: true, stats: true, services: true, how_it_works: true,
        advantages: true, features: true, contact: true,
    }
};

export const landingContentService = {
    get() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Deep merge with defaults to ensure new fields always exist
                return deepMerge(DEFAULT_CONTENT, parsed);
            }
        } catch (e) { }
        return { ...DEFAULT_CONTENT };
    },

    save(content) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
        // Dispatch event so landing page updates live
        window.dispatchEvent(new CustomEvent('landingContentUpdated', { detail: content }));
    },

    reset() {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('landingContentUpdated', { detail: DEFAULT_CONTENT }));
    }
};

function deepMerge(defaults, override) {
    const result = { ...defaults };
    for (const key in override) {
        if (Array.isArray(override[key])) {
            result[key] = override[key];
        } else if (typeof override[key] === 'object' && override[key] !== null && typeof defaults[key] === 'object') {
            result[key] = deepMerge(defaults[key], override[key]);
        } else {
            result[key] = override[key];
        }
    }
    return result;
}
