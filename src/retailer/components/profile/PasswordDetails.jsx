import React from 'react';
import { Eye, EyeOff, ArrowRight, RefreshCw, KeyRound, ShieldCheck } from 'lucide-react';

const PasswordDetails = ({ formData, handleInputChange, handleSave, isSaving, showPasswords, setShowPasswords }) => {
    return (
        <div className="flex flex-col xl:flex-row gap-6">
            <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-7 lg:p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-sky-50 text-[#0ea5e9] rounded-xl">
                        <KeyRound size={20} />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Change Password</h2>
                        <p className="text-xs text-slate-400 font-medium">Update account login credentials and security password</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pb-1">New Password</label>
                        <div className="relative border-b border-slate-200">
                            <input
                                type={showPasswords ? "text" : "password"}
                                className="w-full py-2 bg-transparent outline-none text-slate-800 font-bold pr-8 text-sm focus:border-sky-500 transition-colors"
                                value={formData.newPassword || ''}
                                onChange={(e) => handleInputChange('newPassword', e.target.value)}
                                placeholder="Enter strong new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswords(!showPasswords)}
                                className="absolute right-0 bottom-2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                            >
                                {showPasswords ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pb-1">Confirm New Password</label>
                        <div className="relative border-b border-slate-200">
                            <input
                                type={showPasswords ? "text" : "password"}
                                className="w-full py-2 bg-transparent outline-none text-slate-800 font-bold pr-8 text-sm focus:border-sky-500 transition-colors"
                                value={formData.confirmPassword || ''}
                                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                                placeholder="Re-enter new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswords(!showPasswords)}
                                className="absolute right-0 bottom-2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                            >
                                {showPasswords ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !formData.newPassword}
                        className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-8 py-3 rounded-xl font-bold uppercase text-xs flex items-center space-x-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
                    >
                        <span>{isSaving ? 'Updating Password...' : 'Update Password'}</span>
                        {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    </button>
                </div>
            </div>

            {/* Helper Guide Card */}
            <div className="w-full xl:w-[340px] shrink-0 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 lg:p-7 self-start">
                <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-sky-500" />
                    <span>Password Rules</span>
                </h3>
                <div className="space-y-3 text-xs text-slate-500 font-medium leading-relaxed">
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-2 text-[11px]">
                        <p>✓ 8 to 15 characters long</p>
                        <p>✓ At least 1 numeric digit (0-9)</p>
                        <p>✓ At least 1 uppercase letter (A-Z)</p>
                        <p>✓ At least 1 lowercase letter (a-z)</p>
                        <p>✓ At least 1 special character (@, #, $, etc.)</p>
                        <p>✓ No spaces allowed</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PasswordDetails;
