import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const BbpsCategoryCard = ({ category, onClick, index = 0 }) => {
    const Icon = category.icon;
    const gradient = category.gradient || 'from-indigo-500 to-blue-600';
    const shadowColor = gradient.split(' ')[0].replace('from-', '');

    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.35) }}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onClick && onClick(category)}
            className="group relative overflow-hidden text-left rounded-3xl border border-slate-200/80 p-5 bg-white/95 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:border-indigo-300 hover:shadow-[0_20px_40px_rgba(79,70,229,0.16)] transition-all duration-300 cursor-pointer flex flex-col justify-between w-full"
            aria-label={`Open ${category.name} category`}
        >
            {/* Animated Liquid Background Bubble on Hover */}
            <div
                className={`pointer-events-none absolute -bottom-12 -right-12 w-44 h-44 rounded-full bg-gradient-to-tr ${gradient} opacity-0 group-hover:opacity-15 group-hover:scale-[3.2] transition-all duration-700 ease-out blur-xl`}
            />

            {/* Subtle Floating Bubble Particles */}
            <motion.div
                animate={{ y: [0, -6, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: (index % 5) * 0.3 }}
                className={`pointer-events-none absolute top-3 right-8 w-6 h-6 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-[1px] group-hover:scale-150 group-hover:opacity-35 transition-all duration-500`}
            />

            {/* Interactive Ring Highlight */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-indigo-500/0 group-hover:ring-indigo-500/30 transition-all duration-500" />

            <div>
                {/* Header: Icon + Badge */}
                <div className="relative z-10 flex items-start justify-between gap-3">
                    <div
                        className={`relative z-10 h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg shadow-${shadowColor}/25 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shrink-0`}
                    >
                        <Icon className="h-7 w-7 drop-shadow-sm" strokeWidth={2.2} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-sm shadow-xs border bg-blue-50/90 text-blue-700 border-blue-200/60">
                        BBPS
                    </span>
                </div>

                {/* Category Title */}
                <h3 className="relative z-10 mt-4 text-[14px] font-extrabold text-slate-800 group-hover:text-indigo-950 transition-colors leading-snug">
                    {category.name}
                </h3>

                {/* Short Category Description */}
                <p className="relative z-10 mt-1 text-[11.5px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
                    {category.description}
                </p>
            </div>

            {/* Footer Action */}
            <div className="relative z-10 mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-indigo-600 group-hover:text-indigo-700 transition-colors">
                <span>Select biller</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
            </div>
        </motion.button>
    );
};

export default BbpsCategoryCard;
