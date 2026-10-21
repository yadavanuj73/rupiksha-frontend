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
    badgeText = 'Bharat Connect',
    badgeColor = 'blue'
}) => {
    const badgeStyle = badgeColor === 'amber'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-blue-50 text-blue-700 border-blue-200';

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

            {/* Center: Service Logo + Name + Bharat Connect Badge */}
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

                {badgeText && (
                    <span
                        className={`hidden md:inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}
                    >
                        {badgeText}
                    </span>
                )}
            </div>

            {/* Right: Official Bharat Connect Primary Logo (reduced by 90% with hard style limits) */}
            <div
                className="flex items-center justify-end shrink-0"
                style={{ height: '32px', maxWidth: '120px', overflow: 'hidden' }}
            >
                <img
                    src="/Bharat Connect Primary Logo_PNG.png"
                    alt="Bharat Connect Official Logo"
                    className="object-contain shrink-0"
                    style={{ height: '26px', maxHeight: '26px', width: 'auto', maxWidth: '110px' }}
                    loading="eager"
                />
            </div>
        </div>
    );
};

export default BbpsServiceNav;
