import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headset, Send, CheckCircle2, AlertCircle, Clock, Plus, HelpCircle, Phone, Mail, MessageSquare, Search } from 'lucide-react';

export default function Support() {
    const [activeSection, setActiveSection] = useState('new'); // 'new' or 'active'
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [tickets, setTickets] = useState([
        { id: 'TKT-8902', category: 'AEPS 1 Withdrawal', subject: 'Transaction pending but amount deducted', status: 'In Process', date: '21 July, 2026', priority: 'High' },
        { id: 'TKT-8794', category: 'Payout Hub', subject: 'Move to bank delay', status: 'Resolved', date: '19 July, 2026', priority: 'Medium' },
        { id: 'TKT-8542', category: 'KYC Onboarding', subject: 'Aadhaar validation failed', status: 'Resolved', date: '15 July, 2026', priority: 'High' }
    ]);

    const [formData, setFormData] = useState({
        category: 'AEPS 1 Withdrawal',
        subject: '',
        txnId: '',
        amount: '',
        description: ''
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);

        setTimeout(() => {
            const newTicket = {
                id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
                category: formData.category,
                subject: formData.subject || 'Support Request',
                status: 'In Process',
                date: 'Today',
                priority: formData.amount ? 'High' : 'Medium'
            };

            setTickets(prev => [newTicket, ...prev]);
            setSubmitting(false);
            setSuccess(true);
            
            // Reset form
            setFormData({
                category: 'AEPS 1 Withdrawal',
                subject: '',
                txnId: '',
                amount: '',
                description: ''
            });

            setTimeout(() => setSuccess(false), 4000);
        }, 1500);
    };

    const statusColors = {
        'In Process': 'bg-amber-50 text-amber-600 border border-amber-100',
        'Resolved': 'bg-emerald-50 text-emerald-600 border border-emerald-100',
        'Failed': 'bg-rose-50 text-rose-600 border border-rose-100'
    };

    const priorityColors = {
        'High': 'text-rose-500 bg-rose-50',
        'Medium': 'text-amber-500 bg-amber-50',
        'Low': 'text-slate-500 bg-slate-50'
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 font-['Inter',sans-serif]">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-blue-500/10">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                        <Headset size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight">Help & Support</h1>
                        <p className="text-xs text-blue-100 font-bold uppercase tracking-widest mt-1">Raise support tickets and track query progress</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveSection('new')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${activeSection === 'new' ? 'bg-white text-blue-700 shadow-md' : 'bg-white/10 hover:bg-white/20'}`}
                    >
                        New Ticket
                    </button>
                    <button
                        onClick={() => setActiveSection('active')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${activeSection === 'active' ? 'bg-white text-blue-700 shadow-md' : 'bg-white/10 hover:bg-white/20'}`}
                    >
                        Active Tickets ({tickets.length})
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form or Ticket Queue Column */}
                <div className="lg:col-span-2 space-y-6">
                    <AnimatePresence mode="wait">
                        {activeSection === 'new' ? (
                            <motion.div
                                key="new-ticket"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden"
                            >
                                <div className="mb-6">
                                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Raise a New Ticket</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Complete the details below to open a ticket</p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Issue Category</label>
                                            <select
                                                name="category"
                                                value={formData.category}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white text-sm"
                                                required
                                            >
                                                <option>AEPS 1 Withdrawal</option>
                                                <option>AEPS 2 Withdrawal</option>
                                                <option>Money Transfer</option>
                                                <option>Move To Bank</option>
                                                <option>CMS Payments</option>
                                                <option>Recharge & Utility</option>
                                                <option>KYC / Onboarding</option>
                                                <option>Other / General</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subject</label>
                                            <input
                                                type="text"
                                                name="subject"
                                                value={formData.subject}
                                                onChange={handleInputChange}
                                                placeholder="Brief subject of the issue"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white text-sm"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transaction ID (Optional)</label>
                                            <input
                                                type="text"
                                                name="txnId"
                                                value={formData.txnId}
                                                onChange={handleInputChange}
                                                placeholder="e.g. TXN10293847"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount (Optional)</label>
                                            <input
                                                type="number"
                                                name="amount"
                                                value={formData.amount}
                                                onChange={handleInputChange}
                                                placeholder="₹ Amount"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detailed Description</label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            placeholder="Please describe your issue in detail. Include any error messages if applicable..."
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white text-sm min-h-[120px]"
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full bg-slate-950 text-white font-black py-4 rounded-xl text-[11px] uppercase tracking-widest shadow-lg shadow-slate-950/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-slate-900 cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Submitting Request...' : <><Send size={13} /> Submit Support Request</>}
                                    </button>
                                </form>

                                <AnimatePresence>
                                    {success && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10"
                                        >
                                            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4">
                                                <CheckCircle2 size={32} />
                                            </div>
                                            <h3 className="text-lg font-black text-slate-800">Support Ticket Raised!</h3>
                                            <p className="text-xs text-slate-500 mt-2 max-w-sm">Your ticket has been logged successfully. The operations support team is reviewing it now.</p>
                                            <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest mt-4">
                                                Status: In Process
                                            </span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="active-tickets"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4"
                            >
                                <div>
                                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Active Tickets Queue</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Live status of your submitted support logs</p>
                                </div>

                                {tickets.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                                        <Clock size={36} className="text-slate-300 mx-auto mb-3" />
                                        <p className="text-xs font-black text-slate-600">No active support tickets found</p>
                                        <p className="text-[10px] text-slate-400 mt-1">If you have any issues, raise a new ticket to track progress.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {tickets.map((t, idx) => (
                                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-3 hover:border-slate-200 transition-colors">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-blue-600 font-mono">{t.id}</span>
                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityColors[t.priority] || 'bg-slate-100 text-slate-600'}`}>{t.priority} Priority</span>
                                                    </div>
                                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">{t.category}</h4>
                                                    <p className="text-xs text-slate-500">{t.subject}</p>
                                                    <p className="text-[9px] font-bold text-slate-400">{t.date}</p>
                                                </div>
                                                <div className="flex items-center justify-start md:justify-end">
                                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${statusColors[t.status] || 'bg-slate-100 text-slate-600'}`}>
                                                        {t.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right Column: FAQs / Quick Support */}
                <div className="space-y-6">
                    {/* Direct Contact Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-3xl p-6 text-white shadow-xl shadow-slate-950/20">
                        <h3 className="text-sm font-black uppercase tracking-wider mb-4 text-slate-200">Quick Support Channels</h3>
                        <p className="text-[10px] text-slate-400 leading-relaxed mb-6 font-medium">Reach out directly via phone or email for critical transactions failures or urgent lock issues.</p>
                        
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                                    <Phone size={14} className="text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Customer Care Hotline</p>
                                    <p className="text-xs font-black text-slate-100 mt-0.5">0621-4008548 / 7004128310</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                                    <Mail size={14} className="text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
                                    <p className="text-xs font-black text-slate-100 mt-0.5">support@rupiksha.in</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick FAQs */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <HelpCircle size={16} className="text-indigo-500" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Frequently Asked Questions</h3>
                        </div>

                        <div className="space-y-4 divide-y divide-slate-100">
                            {[
                                { q: 'What is the refund TAT for failed transactions?', a: 'Bank transfers usually auto-refund within 24 to 72 hours depending on bank nodal reconciliation.' },
                                { q: 'How do I resolve biometric capture errors?', a: 'Ensure Mantra MFS110 drivers are installed. Allow popups on Chrome browser to ensure communication is not blocked.' },
                                { q: 'How can I do daily 2FA?', a: 'Redirects happen automatically on your first AEPS launch of the calendar day. Simply scan your finger to unlock daily sessions.' }
                            ].map((f, i) => (
                                <div key={i} className={`pt-3 ${i === 0 ? 'pt-0' : ''}`}>
                                    <h4 className="text-xs font-black text-slate-800 leading-snug">{f.q}</h4>
                                    <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{f.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
