import React from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, RefreshCw, ArrowRight } from 'lucide-react';

const Settings = ({ formData, handleInputChange, handleSave, isSaving }) => {
    return (
        <div className="w-full">
            <div className="bg-white rounded-[20px] border border-[#DCE6F2] shadow-[0_4px_20px_rgba(30,65,110,0.06)] p-4 sm:p-6 lg:p-7 relative overflow-hidden w-full">
                {/* Subtle Ambient Blue Accent */}
                <div className="absolute top-0 right-0 w-80 sm:w-96 h-40 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[20px]" />

                {/* Header Area */}
                <div className="flex items-center gap-3 relative z-10 mb-4 sm:mb-5">
                    <div className="w-10 h-10 rounded-[10px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                        <SettingsIcon size={20} strokeWidth={2} className="text-[#2563EB]" />
                    </div>
                    <div>
                        <h2 className="text-[17px] sm:text-[18px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                            System Settings
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-[500] text-[#64748B] mt-0.5">
                            Customize your dashboard and notification preferences
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] mb-4 sm:mb-5 relative z-10" />

                {/* Notification Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
                    {[
                        { id: 'emailNotifications', label: 'Email Notifications', desc: 'Receive transaction receipts & alerts via email' },
                        { id: 'whatsappUpdates', label: 'WhatsApp Updates', desc: 'Get instant ledger & settlement updates on WhatsApp' }
                    ].map((setting) => (
                        <div key={setting.id} className="flex items-center justify-between p-3.5 sm:p-4 bg-[#F8FAFD] hover:bg-[#F0F5FC] transition-colors rounded-[12px] border border-[#D7E3F2]">
                            <div className="pr-3">
                                <h4 className="text-[13px] sm:text-[14px] font-bold text-[#0B0F14]">{setting.label}</h4>
                                <p className="text-[11px] text-[#64748B] font-medium mt-0.5">{setting.desc}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleInputChange(setting.id, !formData[setting.id])}
                                className={`w-11 h-6 rounded-full p-0.5 cursor-pointer transition-colors relative shrink-0 ${
                                    formData[setting.id] ? 'bg-[#16C784]' : 'bg-[#CBD5E1]'
                                }`}
                            >
                                <motion.div
                                    animate={{ x: formData[setting.id] ? 20 : 0 }}
                                    className="w-5 h-5 bg-white rounded-full shadow-sm"
                                />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer Section */}
                <div className="w-full h-px bg-[#E3EAF3] mt-5 mb-4 relative z-10" />

                <div className="flex justify-end relative z-10">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#2146A3] hover:bg-[#1B3A88] text-white px-6 py-2.5 sm:py-3 rounded-[11px] font-bold uppercase text-[12px] tracking-wider shadow-[0_4px_12px_rgba(33,70,163,0.20)] flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                    >
                        <span>{isSaving ? 'Saving Changes...' : 'Save Preferences'}</span>
                        {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;

