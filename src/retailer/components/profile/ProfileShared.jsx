import React from 'react';
import { ChevronDown } from 'lucide-react';

export const InputField = ({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    readOnly = false,
    icon,
    subLabel
}) => (
    <div className="flex flex-col space-y-2 w-full">
        {label && (
            <label className="text-[12px] font-bold text-[#526987] uppercase tracking-[0.8px] block select-none">
                {label}
            </label>
        )}
        <div className="relative w-full group">
            <input
                type={type}
                value={value ?? ''}
                onChange={onChange}
                placeholder={placeholder}
                readOnly={readOnly}
                className={`w-full h-[52px] sm:h-[56px] px-4.5 bg-white border border-[#D7E3F2] rounded-[12px] font-bold text-[16px] sm:text-[17px] text-[#0B0F14] placeholder-[#64748B] placeholder:font-semibold shadow-[0_2px_6px_rgba(30,65,110,0.03)] outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 focus:bg-white hover:border-[#B8CCEA] disabled:opacity-60 disabled:bg-[#F8FAFC] ${
                    icon ? 'pr-12' : ''
                } ${readOnly ? 'bg-[#F8FAFD] cursor-default' : ''}`}
            />
            {icon && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2563EB] flex items-center">
                    {icon}
                </div>
            )}
        </div>
        {subLabel && (
            <p className="text-[11px] font-semibold text-[#64748B] mt-0.5">
                {subLabel}
            </p>
        )}
    </div>
);

export const SelectField = ({ label, value, options, onChange }) => (
    <div className="flex flex-col space-y-2 w-full">
        {label && (
            <label className="text-[12px] font-bold text-[#526987] uppercase tracking-[0.8px] block select-none">
                {label}
            </label>
        )}
        <div className="relative w-full">
            <select
                value={value ?? ''}
                onChange={onChange}
                className="w-full h-[52px] sm:h-[56px] pl-4.5 pr-11 bg-white border border-[#D7E3F2] rounded-[12px] font-bold text-[16px] sm:text-[17px] text-[#0B0F14] shadow-[0_2px_6px_rgba(30,65,110,0.03)] outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 focus:bg-white hover:border-[#B8CCEA] appearance-none cursor-pointer"
            >
                {options.map((opt) => (
                    <option key={opt} value={opt} className="font-semibold text-[#0B0F14] py-2 bg-white">
                        {opt}
                    </option>
                ))}
            </select>
            <ChevronDown
                size={18}
                strokeWidth={2}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1D3557] pointer-events-none"
            />
        </div>
    </div>
);

