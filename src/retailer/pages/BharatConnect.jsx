import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Sparkles, Layers } from 'lucide-react';
import { BBPS_CATEGORIES, getCategoryById, searchCategories } from '../data/bbpsCategories';
import BbpsCategoryCard from '../components/bbps/BbpsCategoryCard';
import BbpsCategoryDetail from '../components/bbps/BbpsCategoryDetail';

const BharatConnect = () => {
    const { categoryId: paramCategoryId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('popular'); // 'popular' | 'all'

    // Determine active category from route param or query param
    const activeCategoryId = paramCategoryId || searchParams.get('category');
    const selectedCategory = useMemo(() => {
        if (!activeCategoryId) return null;
        return getCategoryById(activeCategoryId);
    }, [activeCategoryId]);

    // Categories filtered by search query or active tab
    const displayedCategories = useMemo(() => {
        if (searchQuery.trim()) {
            return searchCategories(searchQuery);
        }
        if (activeTab === 'popular') {
            return BBPS_CATEGORIES.slice(0, 10);
        }
        return BBPS_CATEGORIES;
    }, [searchQuery, activeTab]);

    const handleSelectCategory = (category) => {
        navigate(`/bharat-connect/${category.id}`);
    };

    const handleBackToGrid = () => {
        navigate('/bharat-connect');
    };

    return (
        <div className="bbps-page min-h-screen overflow-x-hidden font-['Inter',sans-serif]">
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
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Premium Top Context Banner */}
                            <div className="relative overflow-hidden rounded-[26px] border border-[#DFE8F5] bg-white p-5 md:p-6 shadow-[0_5px_18px_rgba(32,72,140,0.055)]">
                                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />

                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF1FF] text-[#2463EB] text-[11px] font-extrabold uppercase tracking-wider">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>Bharat Connect • NPCI Certified</span>
                                        </div>
                                        <h1 className="text-xl md:text-2xl lg:text-[28px] font-black text-[#101828] tracking-tight">
                                            Bharat Connect (BBPS) Services
                                        </h1>
                                        <p className="text-xs md:text-sm text-[#475467] font-medium">
                                            Instant bill payment, recharges, and utility fee collections with real-time settlement
                                        </p>
                                    </div>

                                    {/* Tabs Filter: Popular (10) vs All (35) */}
                                    <div className="flex items-center gap-2 p-1 bg-[#F5F8FD] border border-[#DFE8F5] rounded-full shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => { setActiveTab('popular'); setSearchQuery(''); }}
                                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                                activeTab === 'popular' && !searchQuery
                                                    ? 'bg-[#2463EB] text-white shadow-sm'
                                                    : 'text-[#475467] hover:text-[#101828]'
                                            }`}
                                        >
                                            Popular Services (10)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
                                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                activeTab === 'all' && !searchQuery
                                                    ? 'bg-[#2463EB] text-white shadow-sm'
                                                    : 'text-[#475467] hover:text-[#101828]'
                                            }`}
                                        >
                                            <Layers className="w-3.5 h-3.5" />
                                            <span>All BBPS (35)</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Search Bar */}
                                <div className="relative z-10 mt-4 pt-3 border-t border-[#DFE8F5]/60">
                                    <div className="relative w-full">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search BBPS services & billers (e.g. Fastag, Electricity, Gas, Mobile Prepaid)..."
                                            className="w-full pl-11 pr-10 py-3 text-xs md:text-sm rounded-[18px] border border-[#DFE8F5] bg-[#F8FAFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2463EB]/25 focus:border-[#2463EB] font-semibold text-[#101828] placeholder-[#667085] transition-all"
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#667085] hover:text-[#101828] hover:bg-[#DFE8F5]/50 transition-colors"
                                                title="Clear search"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Service Cards Grid (5 columns on desktop, 20px gap) */}
                            {displayedCategories.length > 0 ? (
                                <div className="bbps-services-grid">
                                    {displayedCategories.map((category, index) => (
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
                                    className="rounded-[26px] border border-[#DFE8F5] bg-white p-12 text-center shadow-[0_5px_18px_rgba(32,72,140,0.055)] space-y-4"
                                >
                                    <div className="mx-auto w-14 h-14 rounded-2xl bg-[#EAF1FF] text-[#2463EB] flex items-center justify-center">
                                        <Search className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-extrabold text-[#101828]">
                                            No BBPS categories matching &ldquo;{searchQuery}&rdquo;
                                        </h3>
                                        <p className="text-xs md:text-sm text-[#475467] max-w-md mx-auto">
                                            Try searching with another keyword such as &ldquo;Fastag&rdquo;, &ldquo;Electricity&rdquo;, &ldquo;Water&rdquo;, or &ldquo;Insurance&rdquo;.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="px-5 py-2.5 rounded-full bg-[#2463EB] text-white font-bold text-xs hover:bg-[#1749C8] transition-colors cursor-pointer shadow-sm"
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
