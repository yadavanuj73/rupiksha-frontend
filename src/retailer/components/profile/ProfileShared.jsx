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
    <div className="flex flex-col space-y-1.5 w-full">
        {label && (
            <label className="text-[11px] font-bold text-[#526987] uppercase tracking-[0.6px] block select-none">
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
                className={`w-full h-[42px] sm:h-[44px] px-3.5 bg-white border border-[#D7E3F2] rounded-[11px] font-bold text-[14px] text-[#0B0F14] placeholder-[#64748B] placeholder:font-medium shadow-[0_1px_3px_rgba(30,65,110,0.03)] outline-none transition-all duration-150 focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/10 focus:bg-white hover:border-[#B8CCEA] disabled:opacity-60 disabled:bg-[#F8FAFC] ${
                    icon ? 'pr-11' : ''
                } ${readOnly ? 'bg-[#F8FAFD] cursor-default' : ''}`}
            />
            {icon && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2563EB] flex items-center">
                    {icon}
                </div>
            )}
        </div>
        {subLabel && (
            <p className="text-[10px] font-semibold text-[#64748B] mt-0.5 leading-tight">
                {subLabel}
            </p>
        )}
    </div>
);

export const SelectField = ({ label, value, options, onChange }) => (
    <div className="flex flex-col space-y-1.5 w-full">
        {label && (
            <label className="text-[11px] font-bold text-[#526987] uppercase tracking-[0.6px] block select-none">
                {label}
            </label>
        )}
        <div className="relative w-full">
            <select
                value={value ?? ''}
                onChange={onChange}
                className="w-full h-[42px] sm:h-[44px] pl-3.5 pr-10 bg-white border border-[#D7E3F2] rounded-[11px] font-bold text-[14px] text-[#0B0F14] shadow-[0_1px_3px_rgba(30,65,110,0.03)] outline-none transition-all duration-150 focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/10 focus:bg-white hover:border-[#B8CCEA] appearance-none cursor-pointer"
            >
                {options.map((opt) => (
                    <option key={opt} value={opt} className="font-semibold text-[#0B0F14] py-1.5 bg-white">
                        {opt}
                    </option>
                ))}
            </select>
            <ChevronDown
                size={16}
                strokeWidth={2}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1D3557] pointer-events-none"
            />
        </div>
    </div>
);

