import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight, Banknote, Bus, Building2, Cable, Car, CreditCard, Droplets,
    FileText, Fuel, Globe, HeartPulse, Hotel, Landmark, Search, ShieldCheck,
    Smartphone, Tv, Wallet, Wifi, Zap, Send
} from 'lucide-react';
import irctcLogo from '../../assets/service-logos/irctc.svg';
import { BBPS_CATEGORIES } from '../data/bbpsCategories';

const routeMap = {
    aeps_services_1: '/aeps-1',
    aeps_services_2: '/aeps-2',
    cms: '/cms',
    travel: '/travel',
    utility: '/utility',
    matm_cash: '/matm',
    payout_hub: '/payout-hub',
    dmt: '/dashboard',
    bharat_connect: '/bharat-connect',
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
            { id: 'aeps_services_1', title: 'AEPS 1', icon: Landmark },
            { id: 'aeps_services_2', title: 'AEPS 2', icon: Landmark },
            { id: 'matm_cash', title: 'm-ATM Cash', icon: Banknote },
            { id: 'cms', title: 'Fingpay Cms', icon: Building2 },
            { id: 'dmt', title: 'Money Transfer', icon: Send },
            { id: 'payout_hub', title: 'Payout Hub', icon: Zap },
        ]),
    },
    {
        key: 'bbps',
        title: 'Bharat Connect (BBPS)',
        color: 'from-violet-500 to-fuchsia-500',
        services: [
            {
                id: 'bharat_connect',
                title: 'Bharat Connect Hub',
                icon: ShieldCheck,
                gradient: 'from-blue-600 to-indigo-700',
                isBbpsHub: true,
                description: 'All-in-one Bharat Bill Payment System registry and payment portal',
            },
            ...BBPS_CATEGORIES.map((cat) => ({
                id: 'bbps_' + cat.id,
                title: cat.name,
                icon: cat.icon,
                gradient: cat.gradient,
                categoryId: cat.id,
                isBbps: true,
                description: cat.description,
            })),
        ],
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
];

const serviceColorMap = {
    'AEPS 1': 'from-blue-600 to-indigo-700',
    'AEPS 2': 'from-sky-500 to-blue-700',
    'm-ATM Cash': 'from-amber-500 to-orange-600',
    'Fingpay Cms': 'from-purple-600 to-violet-700',
    'CMS Banking': 'from-purple-600 to-violet-700',
    'Money Transfer': 'from-sky-500 to-blue-700',
    'Payout Hub': 'from-indigo-600 to-violet-700',
    'Rail E-Ticketing (IRCTC)': 'from-rose-600 to-red-700',
    'Hotel Booking': 'from-emerald-500 to-teal-700',
    'Bus Ticketing': 'from-cyan-500 to-blue-600',
    'Air Ticketing': 'from-indigo-500 to-purple-600',
    'Bharat Connect Hub': 'from-blue-600 to-indigo-700',
    'Mobile Recharge': 'from-blue-500 to-indigo-600',
    'DTH Recharge': 'from-fuchsia-500 to-pink-600',
    'Collection': 'from-emerald-600 to-teal-700',
    'PAN Card': 'from-amber-500 to-orange-600',
    'Ayushpay Subscription': 'from-rose-500 to-pink-600',
    'Digital Wallet Top-up': 'from-cyan-500 to-blue-600',
    'Vouchers': 'from-purple-500 to-indigo-600',
    'HDFC BF': 'from-blue-700 to-indigo-900',
    'Recharge OTT': 'from-red-500 to-rose-700',
    'Digi Gold': 'from-yellow-400 to-amber-600',
    'ITR Filing': 'from-teal-600 to-emerald-700',
};

const ServiceIcon = ({ service }) => {
    if (service.logo) {
        return (
            <div className="relative z-10 h-14 w-14 rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/60 flex items-center justify-center group-hover:scale-110 group-hover:rotate-2 transition-all duration-300">
                <img src={service.logo} alt={service.title} className="h-9 w-9 object-contain" />
            </div>
        );
    }

    const Icon = service.icon || Wallet;
    const gradient = service.gradient || serviceColorMap[service.title] || 'from-indigo-500 to-blue-600';
    const shadowColor = gradient.split(' ')[0].replace('from-', '');
    return (
        <div className={`relative z-10 h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg shadow-${shadowColor}/25 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
            <Icon className="h-7 w-7 drop-shadow-sm" />
        </div>
    );
};

const ServiceCard = ({ service, readOnly, onClick, index }) => {
    const gradient = service.gradient || serviceColorMap[service.title] || 'from-indigo-500 to-blue-600';
    
    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.02, 0.35) }}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={!readOnly ? { scale: 0.96 } : { scale: 0.99 }}
            onClick={onClick}
            className="group relative overflow-hidden text-left rounded-3xl border border-slate-200/80 p-5 bg-white/95 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:border-indigo-300 hover:shadow-[0_20px_40px_rgba(79,70,229,0.16)] transition-all duration-300 cursor-pointer flex flex-col justify-between"
        >
            {/* BUTTON BUBBLE EFFECT - Animated background circles & hover liquid fill */}
            <div className={`pointer-events-none absolute -bottom-12 -right-12 w-44 h-44 rounded-full bg-gradient-to-tr ${gradient} opacity-0 group-hover:opacity-15 group-hover:scale-[3.2] transition-all duration-700 ease-out blur-xl`} />

            {/* Floating Bubble Particles */}
            <motion.div
                animate={{ y: [0, -6, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: (index % 5) * 0.3 }}
                className={`pointer-events-none absolute top-3 right-8 w-6 h-6 rounded-full bg-gradient-to-br ${gradient} opacity-25 blur-[1px] group-hover:scale-150 group-hover:opacity-40 transition-all duration-500`}
            />
            <motion.div
                animate={{ y: [0, -8, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: (index % 4) * 0.4 }}
                className={`pointer-events-none absolute bottom-4 left-6 w-8 h-8 rounded-full bg-gradient-to-tr ${gradient} opacity-20 blur-[2px] group-hover:scale-125 group-hover:opacity-35 transition-all duration-500`}
            />
            <motion.div
                animate={{ y: [0, -5, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: (index % 3) * 0.5 }}
                className="pointer-events-none absolute top-12 left-10 w-4 h-4 rounded-full bg-white/60 blur-[1px] opacity-40 group-hover:opacity-70 transition-opacity"
            />

            {/* Interactive Bubble Ring Glow */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-indigo-500/0 group-hover:ring-indigo-500/30 transition-all duration-500" />

            <div>
                <div className="relative z-10 flex items-start justify-between gap-3">
                    <ServiceIcon service={service} />
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-sm shadow-sm border ${
                        readOnly
                            ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                            : (service.isBbps || service.isBbpsHub)
                                ? 'bg-blue-50/90 text-blue-700 border-blue-200/60'
                                : 'bg-emerald-50/90 text-emerald-700 border-emerald-200/50'
                    }`}>
                        {readOnly ? 'View only' : (service.isBbps || service.isBbpsHub) ? 'BBPS' : 'Active'}
                    </span>
                </div>

                <h3 className="relative z-10 mt-4 text-[13.5px] font-extrabold text-slate-800 group-hover:text-indigo-950 transition-colors leading-snug min-h-[40px]">
                    {service.title}
                </h3>
            </div>

            <div className={`relative z-10 mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                readOnly
                    ? 'text-blue-600 group-hover:text-blue-700'
                    : 'text-indigo-600 group-hover:text-indigo-700'
            }`}>
                {readOnly ? 'View only' : service.isBbps ? 'Pay bill' : 'Open service'}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
            </div>
        </motion.button>
    );
};

const AllServices = ({ readOnly = false, embedded = false }) => {
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

    const openService = (service) => {
        if (readOnly) return;
        if (service.isBbpsHub) {
            navigate('/bharat-connect');
            return;
        }
        if (service.isBbps && service.categoryId) {
            navigate(`/bharat-connect/${service.categoryId}`);
            return;
        }
        const route = routeMap[service.id];
        if (route) navigate(route);
    };

    return (
        <div className={embedded ? "" : "p-4 md:p-7 lg:p-10 max-w-[1600px] mx-auto min-h-screen"}>
            <div className="space-y-8">
                {filteredSections.map((section) => (
                    <section key={section.key}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="h-8 w-2 rounded-full bg-blue-600" />
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
                                    onClick={() => openService(service)}
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
