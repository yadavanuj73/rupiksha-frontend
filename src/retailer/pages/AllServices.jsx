import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight, Banknote, Bus, Building2, Cable, Car, CreditCard, Droplets,
    FileText, Fuel, Globe, HeartPulse, Hotel, Landmark, Search, ShieldCheck,
    Smartphone, Tv, Wallet, Wifi, Zap
} from 'lucide-react';
import irctcLogo from '../../assets/service-logos/irctc.svg';

const routeMap = {
    aeps_services: '/aeps',
    cms: '/cms',
    travel: '/travel',
    utility: '/utility',
    quick_mr: '/matm',
    pw_money_ekyc: '/aeps-kyc',
    matm: '/matm',
    matm_cash: '/matm',
    matm_mp63: '/matm',
    fino_suvidha: '/cms',
    smart_pos: '/matm',
    qpos_mini: '/matm',
    ybl_mr: '/travel',
};

const dedupeServices = (services) => {
    const seen = new Set();
    return services.filter((service) => {
        const key = service.title.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const SERVICE_SECTIONS = [
    {
        key: 'banking',
        title: 'Banking & Finance',
        color: 'from-indigo-500 to-blue-500',
        services: dedupeServices([
            { id: 'quick_mr', title: 'Quick MR Plus', icon: Wallet },
            { id: 'pw_money_ekyc', title: 'PW Money eKYC', icon: ShieldCheck },
            { id: 'aeps_services', title: 'AEPS Services', icon: Landmark },
            { id: 'matm', title: '2-in-1 mPOS', icon: CreditCard },
            { id: 'fino_suvidha', title: 'Fino Suvidha', icon: Building2 },
            { id: 'smart_pos', title: 'Smart POS', icon: Smartphone },
            { id: 'matm_cash', title: 'm-ATM Cash', icon: Banknote },
            { id: 'matm_mp63', title: 'mATM MP63', icon: Smartphone },
            { id: 'qpos_mini', title: '2-in-1 QPOS Mini', icon: CreditCard },
            { id: 'ybl_mr', title: 'Indo Nepal MR', icon: Globe },
            { id: 'cms', title: 'CMS Banking', icon: Building2 },
        ]),
    },
    {
        key: 'travel',
        title: 'Travel Services',
        color: 'from-emerald-500 to-cyan-500',
        services: dedupeServices([
            { id: 'travel', title: 'Rail E-Ticketing (IRCTC)', logo: irctcLogo },
            { id: 'travel', title: 'Hotel Booking', icon: Hotel },
            { id: 'travel', title: 'Bus Ticketing', icon: Bus },
            { id: 'travel', title: 'Air Ticketing', icon: Globe },
        ]),
    },
    {
        key: 'bbps',
        title: 'Bharat Connect (BBPS)',
        color: 'from-violet-500 to-fuchsia-500',
        services: dedupeServices([
            { id: 'utility', title: 'Bill Pay', icon: FileText },
            { id: 'utility', title: 'Loan Payments', icon: Landmark },
            { id: 'utility', title: 'Electricity Bill', icon: Zap },
            { id: 'utility', title: 'Gas Bill', icon: Fuel },
            { id: 'utility', title: 'Water Bill', icon: Droplets },
            { id: 'utility', title: 'FASTag Payments', icon: Car },
            { id: 'utility', title: 'DTH', icon: Tv },
            { id: 'utility', title: 'Broadband', icon: Wifi },
            { id: 'utility', title: 'Landline Postpaid', icon: PhoneIcon },
            { id: 'utility', title: 'Mobile Postpaid', icon: Smartphone },
            { id: 'utility', title: 'Insurance Premium', icon: ShieldCheck },
            { id: 'utility', title: 'Credit Card Bill', icon: CreditCard },
            { id: 'utility', title: 'Municipal Taxes', icon: Building2 },
            { id: 'utility', title: 'Hospital Bill', icon: HeartPulse },
            { id: 'utility', title: 'Education Bill', icon: FileText },
        ]),
    },
    {
        key: 'utility',
        title: 'Utility & Value Services',
        color: 'from-orange-500 to-amber-500',
        services: dedupeServices([
            { id: 'utility', title: 'Mobile Recharge', icon: Smartphone },
            { id: 'utility', title: 'DTH Recharge', icon: Tv },
            { id: 'utility', title: 'Collection', icon: Wallet },
            { id: 'utility', title: 'PAN Card', icon: FileText },
            { id: 'utility', title: 'Ayushpay Subscription', icon: HeartPulse },
            { id: 'utility', title: 'Digital Wallet Top-up', icon: Wallet },
            { id: 'utility', title: 'Vouchers', icon: Cable },
            { id: 'utility', title: 'HDFC BF', icon: Building2 },
            { id: 'utility', title: 'Recharge OTT', icon: Tv },
            { id: 'utility', title: 'Digi Gold', icon: Banknote },
            { id: 'utility', title: 'ITR Filing', icon: FileText },
        ]),
    },
];

function PhoneIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.8.62 2.66a2 2 0 0 1-.45 2.11L8 9.77a16 16 0 0 0 6.23 6.23l1.28-1.28a2 2 0 0 1 2.11-.45c.86.29 1.76.5 2.66.62A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

const ServiceIcon = ({ service }) => {
    if (service.logo) {
        return (
            <div className="h-14 w-14 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-center">
                <img src={service.logo} alt={service.title} className="h-10 w-10 object-contain" />
            </div>
        );
    }

    const Icon = service.icon || Wallet;
    return (
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm flex items-center justify-center text-slate-700">
            <Icon className="h-7 w-7" />
        </div>
    );
};

const ServiceCard = ({ service, readOnly, onClick, index }) => (
    <motion.button
        type="button"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.02 }}
        whileHover={!readOnly ? { y: -4 } : undefined}
        onClick={onClick}
        className={`group relative text-left rounded-3xl border p-5 bg-white/80 backdrop-blur-sm shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all ${readOnly ? 'cursor-default border-slate-200' : 'cursor-pointer hover:border-indigo-200 hover:shadow-[0_16px_34px_rgba(79,70,229,0.14)] border-slate-200'
            }`}
    >
        <div className="flex items-start justify-between gap-3">
            <ServiceIcon service={service} />
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${readOnly ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                {readOnly ? 'View only' : 'Active'}
            </span>
        </div>
        <h3 className="mt-4 text-[13px] font-extrabold text-slate-800 leading-snug min-h-[40px]">
            {service.title}
        </h3>
        <div className={`mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${readOnly ? 'text-slate-400' : 'text-indigo-600'}`}>
            {readOnly ? 'Visible in this panel' : 'Open service'}
            {!readOnly && <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />}
        </div>
    </motion.button>
);

const AllServices = ({ readOnly = false }) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSections = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return SERVICE_SECTIONS.map((section) => ({
            ...section,
            services: section.services.filter((service) => service.title.toLowerCase().includes(query)),
        })).filter((section) => section.services.length > 0);
    }, [searchQuery]);

    const totalServices = useMemo(
        () => filteredSections.reduce((total, section) => total + section.services.length, 0),
        [filteredSections]
    );

    const openService = (id) => {
        if (readOnly) return;
        const route = routeMap[id];
        if (route) navigate(route);
    };

    return (
        <div className="p-4 md:p-7 lg:p-10 max-w-[1600px] mx-auto min-h-screen">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white px-5 md:px-8 py-6 md:py-7 shadow-[0_22px_45px_rgba(15,23,42,0.35)]">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-indigo-200">Service Hub</p>
                        <h1 className="text-2xl md:text-3xl font-black mt-1">All Services</h1>
                        <p className="text-sm text-indigo-100 mt-1">Unified service catalog with a cleaner and faster experience.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl bg-white/10 border border-white/20">
                            {totalServices} listed
                        </span>
                        <span className={`text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl border ${readOnly ? 'bg-amber-300/20 text-amber-100 border-amber-200/30' : 'bg-emerald-400/20 text-emerald-100 border-emerald-200/30'}`}>
                            {readOnly ? 'View only access' : 'Action enabled'}
                        </span>
                    </div>
                </div>
                <div className="mt-5 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-200" />
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search services..."
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white placeholder:text-indigo-200 outline-none focus:ring-2 focus:ring-indigo-300/60"
                    />
                </div>
            </div>

            <div className="space-y-10 mt-8">
                {filteredSections.map((section) => (
                    <section key={section.key}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className={`h-8 w-1.5 rounded-full bg-gradient-to-b ${section.color}`} />
                                <h2 className="text-xl md:text-2xl font-black text-slate-800">{section.title}</h2>
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500">
                                {section.services.length} services
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-5">
                            {section.services.map((service, index) => (
                                <ServiceCard
                                    key={`${section.key}-${service.title}`}
                                    service={service}
                                    index={index}
                                    readOnly={readOnly}
                                    onClick={() => openService(service.id)}
                                />
                            ))}
                        </div>
                    </section>
                ))}

                {totalServices === 0 && (
                    <div className="text-center py-16 rounded-3xl bg-white border border-slate-200">
                        <p className="text-lg font-extrabold text-slate-700">No matching services found</p>
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                        >
                            Clear search
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllServices;
