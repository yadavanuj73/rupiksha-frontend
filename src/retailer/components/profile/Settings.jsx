import React from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, RefreshCw, ArrowRight } from 'lucide-react';
import { SelectField } from './ProfileShared';

const Settings = ({ formData, handleInputChange, handleSave, isSaving }) => {
    return (
        <div className="w-full">
            <div className="bg-white rounded-[22px] border border-[#DCE6F2] shadow-[0_8px_30px_rgba(30,65,110,0.07)] p-6 sm:p-8 lg:p-9 relative overflow-hidden w-full">
                {/* Subtle Ambient Blue Accent */}
                <div className="absolute top-0 right-0 w-80 sm:w-96 h-44 sm:h-52 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[22px]" />

                {/* Header Area */}
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-11 h-11 rounded-[12px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                        <SettingsIcon size={22} strokeWidth={2} className="text-[#2563EB]" />
                    </div>
                    <div>
                        <h2 className="text-[19px] sm:text-[20px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                            System Settings
                        </h2>
                        <p className="text-[13px] sm:text-[14px] font-[500] text-[#64748B] mt-0.5">
                            Customize your dashboard and notification preferences
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] my-6 sm:my-7 relative z-10" />

                {/* Toggle Preferences */}
                <div className="space-y-4 relative z-10">
                    {[
                        { id: 'emailNotifications', label: 'Email Notifications', desc: 'Receive transaction receipts & alerts via email' },
                        { id: 'whatsappUpdates', label: 'WhatsApp Updates', desc: 'Get instant ledger & settlement updates on WhatsApp' },
                        { id: 'twoStepAuth', label: 'Two-Step Authentication', desc: 'Require OTP verification on login for enhanced security' }
                    ].map((setting) => (
                        <div key={setting.id} className="flex items-center justify-between p-4 sm:p-5 bg-[#F8FAFD] hover:bg-[#F0F5FC] transition-colors rounded-[14px] border border-[#D7E3F2]">
                            <div>
                                <h4 className="text-[14px] sm:text-[15px] font-bold text-[#0B0F14]">{setting.label}</h4>
                                <p className="text-[12px] text-[#64748B] font-medium mt-0.5">{setting.desc}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleInputChange(setting.id, !formData[setting.id])}
                                className={`w-13 h-7 rounded-full p-1 cursor-pointer transition-colors relative shrink-0 ${
                                    formData[setting.id] ? 'bg-[#16C784]' : 'bg-[#CBD5E1]'
                                }`}
                            >
                                <motion.div
                                    animate={{ x: formData[setting.id] ? 24 : 0 }}
                                    className="w-5 h-5 bg-white rounded-full shadow-sm"
                                />
                            </button>
                        </div>
                    ))}

                    {/* Theme & Language Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-7 pt-4">
                        <SelectField
                            label="Interface Theme"
                            value={formData.theme || 'light'}
                            options={['light', 'dark', 'system']}
                            onChange={(e) => handleInputChange('theme', e.target.value)}
                        />
                        <SelectField
                            label="Preferred Language"
                            value={formData.language || 'English'}
                            options={['English', 'Hindi', 'Bengali', 'Marathi', 'Gujarati']}
                            onChange={(e) => handleInputChange('language', e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer Section */}
                <div className="w-full h-px bg-[#E3EAF3] my-6 sm:my-7 relative z-10" />

                <div className="flex justify-end relative z-10">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#2146A3] hover:bg-[#1B3A88] text-white px-8 py-3.5 rounded-[12px] font-bold uppercase text-[12px] sm:text-[13px] tracking-wider shadow-[0_4px_12px_rgba(33,70,163,0.25)] flex items-center space-x-2.5 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                    >
                        <span>{isSaving ? 'Saving Changes...' : 'Save Preferences'}</span>
                        {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;

