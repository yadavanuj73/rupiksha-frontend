import React from 'react';
import { ArrowLeft, Zap } from 'lucide-react';

/**
 * Standard Navigation Header for all 35 BBPS / Bharat Connect Services
 * Features:
 *  - Left: Back to categories navigation button
 *  - Center: Category Icon, Title, and Certified Badge
 *  - Right: Official Bharat Connect Primary Logo (reduced by 90% to sleek 26px height, strictly bounded)
 *  - Fully responsive with zero overflow and fixed sleek height across all devices
 */
const BbpsServiceNav = ({
    onBack,
    title = 'Bharat Connect',
    icon: IconComponent = Zap,
    gradient = 'from-blue-500 to-indigo-600',
    badgeText = null,
    badgeColor = 'blue'
}) => {
    return (
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4 w-full max-w-full overflow-hidden">
            {/* Left: Back Button */}
            <div className="flex items-center justify-start shrink-0">
                <button
                    type="button"
                    onClick={onBack}
                    className="group inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-black font-black text-xs hover:border-blue-600 hover:text-blue-700 hover:shadow-xs transition-all cursor-pointer shrink-0"
                >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-1" />
                    <span className="hidden sm:inline">Back to all BBPS categories</span>
                    <span className="sm:hidden">Back</span>
                </button>
            </div>

            {/* Center: Service Logo + Name */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 min-w-0 px-1 text-center">
                <div
                    className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shrink-0 shadow-2xs`}
                >
                    {IconComponent && (
                        <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.3} />
                    )}
                </div>

                <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight truncate leading-none">
                    {title}
                </h1>
            </div>

            {/* Right: Official Bharat Connect Primary Logo (prominently sized to fill the designated area) */}
            <div className="flex items-center justify-end shrink-0">
                <img
                    src="/Bharat Connect Primary Logo_PNG.png"
                    alt="Bharat Connect Official Logo"
                    className="h-9 sm:h-11 md:h-12 w-auto max-h-12 max-w-[120px] sm:max-w-[150px] object-contain shrink-0"
                    loading="eager"
                />
            </div>
        </div>
    );
};

export default BbpsServiceNav;
