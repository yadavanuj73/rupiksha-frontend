import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    X,
    ShieldCheck,
    Layers,
    Sparkles,
    CheckCircle2,
    RefreshCw
} from 'lucide-react';
import { BBPS_CATEGORIES, getCategoryById, searchCategories } from '../data/bbpsCategories';
import BbpsCategoryCard from '../components/bbps/BbpsCategoryCard';
import BbpsCategoryDetail from '../components/bbps/BbpsCategoryDetail';

const BharatConnect = () => {
    const { categoryId: paramCategoryId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');

    // Determine active category from route param or query param
    const activeCategoryId = paramCategoryId || searchParams.get('category');
    const selectedCategory = useMemo(() => {
        if (!activeCategoryId) return null;
        return getCategoryById(activeCategoryId);
    }, [activeCategoryId]);

    // Filter categories locally by search query
    const filteredCategories = useMemo(() => {
        return searchCategories(searchQuery);
    }, [searchQuery]);

    const handleSelectCategory = (category) => {
        navigate(`/bharat-connect/${category.id}`);
    };

    const handleBackToGrid = () => {
        navigate('/bharat-connect');
    };

    return (
        <div className="min-h-screen bg-[#f7f9fc] p-3 md:p-6 lg:px-8 pb-20 overflow-x-hidden font-['Inter',sans-serif]">
            <div className="max-w-[1440px] mx-auto space-y-6">
                <AnimatePresence mode="wait">
                    {selectedCategory ? (
                        <motion.div
                            key={`detail-${selectedCategory.id}`}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                        >
                            <BbpsCategoryDetail
                                category={selectedCategory}
                                onBack={handleBackToGrid}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="grid"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-6"
                        >
                            {/* Hero Banner Header */}
                            <div className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm backdrop-blur-md">
                                <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 blur-3xl" />
                                <div className="pointer-events-none absolute -left-12 -bottom-12 h-56 w-56 rounded-full bg-blue-100/40 blur-2xl" />

                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200/80 shadow-2xs">
                                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                                NPCI Bharat Connect
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                                35 Categories
                                            </span>
                                        </div>

                                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                            Bharat Connect (BBPS)
                                        </h1>
                                        <p className="text-xs md:text-sm font-medium text-slate-500 max-w-2xl leading-relaxed">
                                            Pay and manage utility bills, FASTag, loan installments, insurance premiums, municipal taxes, and recurring payments across India's unified payment ecosystem.
                                        </p>
                                    </div>

                                    {/* Quick Stats Pill */}
                                    <div className="shrink-0 flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 self-start md:self-auto">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                                            35
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Registry</div>
                                            <div className="text-xs font-black text-slate-800">All BBPS Categories</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Search Bar & Filter Controls */}
                                <div className="relative z-10 mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                                    <div className="relative flex-1 max-w-md">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search categories (e.g. Electricity, Fastag, Gas)..."
                                            className="w-full pl-11 pr-10 py-2.5 text-xs md:text-sm rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800 placeholder-slate-400 transition-all shadow-2xs"
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                                                title="Clear search"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-bold text-slate-500">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                                            Showing {filteredCategories.length} of {BBPS_CATEGORIES.length} Categories
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Category Grid Section */}
                            {filteredCategories.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                                    {filteredCategories.map((category, index) => (
                                        <BbpsCategoryCard
                                            key={category.id}
                                            category={category}
                                            index={index}
                                            onClick={handleSelectCategory}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="rounded-[32px] border border-slate-200/80 bg-white p-12 text-center shadow-sm space-y-4"
                                >
                                    <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                                        <Search className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-extrabold text-slate-800">
                                            No categories matching &ldquo;{searchQuery}&rdquo;
                                        </h3>
                                        <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
                                            Try searching with a different term such as &ldquo;Fastag&rdquo;, &ldquo;Electricity&rdquo;, &ldquo;Water&rdquo;, or &ldquo;Insurance&rdquo;.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                        Clear Search Query
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default BharatConnect;
