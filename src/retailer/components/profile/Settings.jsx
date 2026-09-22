import React from 'react';
import { motion } from 'framer-motion';
import { Sliders, Check } from 'lucide-react';
import { SelectField } from './ProfileShared';

const Settings = ({ formData, handleInputChange, handleSave, isSaving }) => {
    return (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="p-5 sm:p-7 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2 bg-sky-50 text-[#0ea5e9] rounded-xl">
                    <Sliders size={20} />
                </div>
                <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">System Settings</h2>
                    <p className="text-xs text-slate-400 font-medium">Customize your dashboard and notification preferences</p>
                </div>
            </div>

            <div className="p-5 sm:p-7 lg:p-8 space-y-4">
                {[
                    { id: 'emailNotifications', label: 'Email Notifications', desc: 'Receive transaction receipts & alerts via email' },
                    { id: 'whatsappUpdates', label: 'WhatsApp Updates', desc: 'Get instant ledger & settlement updates on WhatsApp' },
                    { id: 'twoStepAuth', label: 'Two-Step Authentication', desc: 'Require OTP verification on login for enhanced security' }
                ].map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                        <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-800">{setting.label}</h4>
                            <p className="text-[11px] text-slate-400 font-medium">{setting.desc}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleInputChange(setting.id, !formData[setting.id])}
                            className={`w-12 h-6 rounded-full p-0.5 cursor-pointer transition-colors relative shrink-0 ${formData[setting.id] ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                            <motion.div
                                animate={{ x: formData[setting.id] ? 24 : 0 }}
                                className="w-5 h-5 bg-white rounded-full shadow-sm"
                            />
                        </button>
                    </div>
                ))}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4">
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

            <div className="p-5 sm:p-7 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
                >
                    Save Preferences
                </button>
            </div>
        </div>
    );
};

export default Settings;
