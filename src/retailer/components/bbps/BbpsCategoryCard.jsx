import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const BbpsCategoryCard = ({ category, onClick, index = 0 }) => {
    const Icon = category.icon;

    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.25) }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onClick && onClick(category)}
            className="group bbps-service-card relative overflow-hidden"
            aria-label={`Open ${category.name} biller selection`}
        >
            {/* Top: 3D Service Illustration (150px height, 20px radius) */}
            <div
                className="bbps-service-illustration-wrapper"
                style={{ backgroundColor: category.illustrationBg || '#F4F7FD' }}
            >
                {category.image ? (
                    <img
                        src={category.image}
                        alt={`${category.name} 3D illustration`}
                        className="bbps-service-illustration"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center">
                        <div
                            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${category.gradient || 'from-blue-600 to-indigo-700'} text-white shadow-md flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}
                        >
                            {Icon && <Icon className="w-8 h-8 drop-shadow-sm" strokeWidth={2.2} />}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Row: Service Title + Circular Arrow Action */}
            <div className="flex items-center justify-between gap-2.5 mt-3 pt-0.5">
                <h3 className="bbps-service-title m-0 truncate">
                    {category.name}
                </h3>

                <div
                    className="w-[42px] h-[42px] rounded-full bg-[#EAF1FF] text-[#2463EB] flex items-center justify-center shrink-0 group-hover:bg-[#2463EB] group-hover:text-white transition-all duration-200 shadow-xs"
                    aria-hidden="true"
                >
                    <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
            </div>
        </motion.button>
    );
};

export default BbpsCategoryCard;
