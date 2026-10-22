import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { BBPS_CATEGORIES, getCategoryById, searchCategories } from '../data/bbpsCategories';
import BbpsCategoryCard from '../components/bbps/BbpsCategoryCard';
import BbpsCategoryDetail from '../components/bbps/BbpsCategoryDetail';

const BharatConnect = () => {
    const { categoryId: paramCategoryId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');

    // Determine active category from route param or query param
    const activeCategoryId = paramCategoryId || searchParams.get('category');
    const selectedCategory = useMemo(() => {
        if (!activeCategoryId) return null;
        return getCategoryById(activeCategoryId);
    }, [activeCategoryId]);

    // Filter categories locally by search query as user types
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
        <div className={`min-h-screen bg-[#f7f9fc] p-3 md:p-5 overflow-x-hidden font-['Inter',sans-serif] ${selectedCategory ? 'pb-3' : 'pb-20'}`}>
            <div className={`max-w-[1440px] mx-auto ${selectedCategory ? 'space-y-3' : 'space-y-6'}`}>
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
                            {/* Compact Top Header Box */}
                            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs">
                                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-500/5 blur-3xl" />

                                {/* Single Straight Line: Title and 35 Registry Pill */}
                                <div className="relative z-10 flex items-center justify-between gap-4">
                                    <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-black tracking-tight">
                                        Bharat Connect (BBPS)
                                    </h1>

                                    {/* 35 Registry Pill */}
                                    <div className="shrink-0 flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
                                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                                            35
                                        </div>
                                        <div className="text-left leading-tight">
                                            <div className="text-[9px] font-black uppercase tracking-wider text-slate-700">
                                                Registry
                                            </div>
                                            <div className="text-xs font-black text-black">
                                                All BBPS Categories
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Search Bar Directly Below */}
                                <div className="relative z-10 mt-3.5">
                                    <div className="relative w-full">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-700" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search categories (e.g. Electricity, Fastag, Gas)..."
                                            className="w-full pl-11 pr-10 py-2.5 text-xs md:text-sm rounded-2xl border border-slate-300 bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-bold text-black placeholder-slate-500 transition-all shadow-2xs"
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-600 hover:text-black hover:bg-slate-200 transition-colors"
                                                title="Clear search"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
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
                                    className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xs space-y-3"
                                >
                                    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
                                        <Search className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-black text-black">
                                            No categories matching &ldquo;{searchQuery}&rdquo;
                                        </h3>
                                        <p className="text-xs font-bold text-slate-700 max-w-sm mx-auto">
                                            Try searching with another keyword such as &ldquo;Fastag&rdquo;, &ldquo;Electricity&rdquo;, &ldquo;Water&rdquo;, or &ldquo;Insurance&rdquo;.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="px-4 py-2 rounded-xl bg-black text-white font-black text-xs hover:bg-slate-800 transition-colors cursor-pointer"
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
