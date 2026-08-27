import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, X, Building2, ShieldCheck,
    RefreshCcw, AlertTriangle, Megaphone, Mail,
    ArrowRight, Link2, Trash2, Eye, Users, Fingerprint, Landmark
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { sharedDataService } from '../../services/sharedDataService';
import { sendApprovalEmail } from '../../services/emailService';
import { generateUniquePartyCode } from '../../database/partyCode';

const Approvals = () => {
    const [data, setData] = useState(dataService.getData());
    const [distributors, setDistributors] = useState(sharedDataService.getAllDistributors());
    const [SuperDistributors, setSuperDistributors] = useState(sharedDataService.getAllSuperDistributors());
    const [status, setStatus] = useState(null);

    // KYC Pending Lists (from dedicated tables)
    const [pendingMainKyc, setPendingMainKyc] = useState([]);
    const [pendingAepsKyc, setPendingAepsKyc] = useState([]);
    const [pendingLoans, setPendingLoans] = useState([]);

    // Retailer Approval State
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [approvalForm, setApprovalForm] = useState({ password: '', partyCode: '', distributorId: '' });

    // Distributor Approval State
    const [showDistApprovalModal, setShowDistApprovalModal] = useState(false);
    const [selectedDist, setSelectedDist] = useState(null);
    const [distApprovalForm, setDistApprovalForm] = useState({ password: '', distribId: '' });

    // SUPER_DISTRIBUTOR Approval State
    const [showSAApprovalModal, setShowSAApprovalModal] = useState(false);
    const [selectedSA, setSelectedSA] = useState(null);
    const [saApprovalForm, setSAApprovalForm] = useState({ password: '' });

    // Share Modal State
    const [showCredentialCard, setShowCredentialCard] = useState(false);
    const [credentialData, setCredentialData] = useState(null);
    const [viewingKycDocs, setViewingKycDocs] = useState(null);

    const [loading, setLoading] = useState(false);
    const [approvalLoading, setApprovalLoading] = useState(false);
    const [viewingDetail, setViewingDetail] = useState(null);

    const showActionStatus = (type, message) => {
        setStatus({ type, message: message || 'Action completed.' });
        setTimeout(() => setStatus(null), 3500);
    };

    // Helper to send email notification
    const handleEmailNotification = async (type, user, status, extraData = {}) => {
        try {
            // Attempt to get the safest email
            const targetEmail = user.email || user.userEmail || '';
            const targetName = user.name || user.fullName || user.firstName || 'User';
            
            if (!targetEmail) {
                console.warn('Cannot send email: No email address found for', user.username || user.loginId);
                return;
            }

            if (status === 'APPROVED') {
                const emailRes = await sendApprovalEmail({
                    to: targetEmail,
                    name: targetName,
                    loginId: user.username || user.loginId || user.mobile,
                    password: extraData.password || 'As previously set',
                    idLabel: type === 'Loan' ? 'Tracking ID' : 'Account Role',
                    idValue: type === 'Loan' ? user.tracking_id : type,
                    portalType: type
                });
                if (!emailRes?.success) {
                    console.warn('Email relay failed, approval will continue manually:', emailRes?.message || 'RELAY_FAILED');
                    return { success: false, message: emailRes?.message || 'RELAY_FAILED' };
                }
                return { success: true };
            } else if (status === 'REJECTED') {
                // We could add a sendRejectionEmail if needed. 
                // Currently backend has send-approval and send-credentials
            }
        } catch (e) {
            console.error('Email notification failed:', e);
        }
    };

    const refreshData = async () => {
        setLoading(true);
        try {
            const [retailRes, distRes, superDistRes] = await Promise.all([
                dataService.getPendingApprovalsByRole('retailer'),
                dataService.getPendingApprovalsByRole('distributor'),
                dataService.getPendingApprovalsByRole('super_distributor')
            ]);
            const retailers = retailRes?.users || [];
            const dists = distRes?.users || [];
            const sas = superDistRes?.users || [];
            console.log("API RESPONSE:", {
                retailer: retailers.length,
                distributor: dists.length,
                super_distributor: sas.length
            });

            setData(prev => ({ ...prev, users: retailers }));
            setDistributors(dists);
            setSuperDistributors(sas);
            
            // Sync with sharedDataService for other components
            sharedDataService.saveDistributors(dists, true);
            sharedDataService.saveSuperDistributors(sas, true);
        } catch (e) {
            console.error('Error fetching users:', e);
        }

        // Fetch pending KYC from dedicated endpoints
        try {
            const resMain = await dataService.getPendingKycs('MAIN');
            if (resMain.success) setPendingMainKyc(resMain.kycs || []);

            const resAeps = await dataService.getPendingKycs('AEPS');
            if (resAeps.success) setPendingAepsKyc(resAeps.kycs || []);
        } catch (e) {
            console.error('Error fetching pending KYC:', e);
        }

        // Fetch pending loans
        try {
            const loans = await dataService.getLoans();
            setPendingLoans(Array.isArray(loans) ? loans.filter(l => l.status === 'INITIATED' || l.status === 'PROCESSING' || !l.status) : []);
        } catch (e) {
            console.error('Error fetching loans:', e);
        }

        setLoading(false);
    };

    useEffect(() => {
        refreshData();
        window.addEventListener('distributorDataUpdated', refreshData);
        window.addEventListener('SuperDistributorDataUpdated', refreshData);
        return () => {
            window.removeEventListener('distributorDataUpdated', refreshData);
            window.removeEventListener('SuperDistributorDataUpdated', refreshData);
        };
    }, []);

    // ─── Retailer Approval Logic ───────────────────────────────────────
    const handleApproveClick = (user) => {
        const approvedDists = sharedDataService.getAllDistributors().filter(d => d.status === 'Approved');
        setSelectedUser(user);
        const existingCodes = [
            ...(data.users || []).map(u => u.partyCode),
            ...(distributors || []).map(d => d.partyCode),
            ...(SuperDistributors || []).map(s => s.partyCode)
        ];
        setApprovalForm({
            password: 'RT' + Math.floor(1000 + Math.random() * 9000), // Generate new for security
            partyCode: (user.partyCode || generateUniquePartyCode(user.state, user.role || 'RETAILER', existingCodes)).toUpperCase(),
            distributorId: user.ownerId || approvedDists[0]?.id || ''
        });
        setShowApprovalModal(true);
    };

    const submitApproval = async () => {
        if (approvalLoading) return;
        if (!approvalForm.password || !approvalForm.partyCode) {
            alert('Please provide password and party code.');
            return;
        }

        setApprovalLoading(true);
        const targetUser = selectedUser;
        try {
            const targetIdentifier =
                targetUser?._id ||
                targetUser?.id ||
                targetUser?.username ||
                targetUser?.mobile ||
                targetUser?.loginId;
            if (!targetIdentifier) {
                throw new Error('Retailer identifier missing');
            }

            const approvalRes = await dataService.approveUser(
                targetIdentifier,
                approvalForm.password,
                approvalForm.partyCode,
                approvalForm.distributorId,
                targetUser.pin || '1122',
                targetUser.state || '',
                targetUser.role || 'RETAILER'
            );
            if (!approvalRes?.success) {
                throw new Error(approvalRes?.message || 'Retailer approval failed');
            }
            
            // refreshData is already called below
            refreshData();
            setShowApprovalModal(false);
            showActionStatus('success', approvalRes?.message || 'Retailer approved successfully.');

            const shareData = {
                name: targetUser.name || targetUser.mobile,
                mobile: targetUser.mobile,
                email: targetUser.email,
                password: approvalForm.password,
                idLabel: 'Party Code',
                idValue: approvalForm.partyCode,
                portalType: 'Retailer',
                url: window.location.origin,
                emailStatus: 'idle',
                notificationPayload: {
                    type: 'Retailer',
                    user: targetUser,
                    password: approvalForm.password,
                    idLabel: 'Party Code',
                    idValue: approvalForm.partyCode
                }
            };

            setCredentialData(shareData);
            setShowCredentialCard(true);
        } catch (err) {
            console.error('Approval failed:', err);
            showActionStatus('error', 'Approval failed: ' + err.message);
        } finally {
            setApprovalLoading(false);
        }
    };

    const handleRejectUser = async (userOrIdentifier) => {
        const identifier =
            (typeof userOrIdentifier === 'string' ? userOrIdentifier : null) ||
            userOrIdentifier?._id ||
            userOrIdentifier?.id ||
            userOrIdentifier?.username ||
            userOrIdentifier?.mobile ||
            userOrIdentifier?.loginId ||
            userOrIdentifier?.userMobile;
        const displayName =
            (typeof userOrIdentifier === 'string' ? userOrIdentifier : null) ||
            userOrIdentifier?.username ||
            userOrIdentifier?.name ||
            userOrIdentifier?.mobile ||
            identifier;

        if (!identifier) {
            setStatus({ type: 'error', message: 'Unable to reject: missing user id.' });
            setTimeout(() => setStatus(null), 3000);
            return;
        }

        if (window.confirm(`Are you sure you want to reject user ${displayName}?`)) {
            const res = await dataService.rejectUser(identifier);
            refreshData();
            showActionStatus(res?.success ? 'success' : 'error', res?.message || (res?.success ? 'User rejected.' : 'Reject failed.'));
        }
    };

    const handleLoanAction = async (trackingId, action) => {
        setLoading(true);
        const res = await dataService.updateLoanStatus(trackingId, action);
        if (res.success) {
                showActionStatus('success', `Loan ${action} successfully.`);
            refreshData();
        } else {
            showActionStatus('error', res.message || 'Update failed');
        }
        setLoading(false);
    };

    // ─── Distributor Approval Logic ────────────────────────────────────
    const handleDistApproveClick = (dist) => {
        setSelectedDist(dist);
        const existingCodes = [
            ...(data.users || []).map(u => u.partyCode),
            ...(distributors || []).map(d => d.partyCode),
            ...(SuperDistributors || []).map(s => s.partyCode)
        ];
        setDistApprovalForm({
            password: 'Dist@' + Math.floor(1000 + Math.random() * 9000),
            distribId: (dist.id || generateUniquePartyCode(dist.state, dist.role || 'DISTRIBUTOR', existingCodes)).toUpperCase()
        });
        setShowDistApprovalModal(true);
    };

    const submitDistApproval = async () => {
        if (approvalLoading) return;
        if (!distApprovalForm.password) {
            alert('Please set a login password.');
            return;
        }

        setApprovalLoading(true);
        const targetDist = selectedDist;
        try {
            const approvalRes = await dataService.approveUser(
                targetDist._id || targetDist.id || targetDist.username || targetDist.mobile,
                distApprovalForm.password,
                distApprovalForm.distribId,
                targetDist.parent_id || targetDist.ownerId || null,
                targetDist.pin || '1122',
                targetDist.state || '',
                targetDist.role || 'DISTRIBUTOR'
            );
            if (!approvalRes?.success) {
                throw new Error(approvalRes?.message || 'Distributor approval failed');
            }
            refreshData();
            setShowDistApprovalModal(false);
            showActionStatus('success', approvalRes?.message || 'Distributor approved successfully.');

            const shareData = {
                name: targetDist.name,
                mobile: targetDist.mobile,
                email: targetDist.email,
                password: distApprovalForm.password,
                idLabel: 'Distributor ID',
                idValue: distApprovalForm.distribId,
                portalType: 'Distributor',
                url: window.location.origin,
                emailStatus: 'idle',
                notificationPayload: {
                    type: 'Distributor',
                    user: targetDist,
                    password: distApprovalForm.password,
                    idLabel: 'Distributor ID',
                    idValue: distApprovalForm.distribId
                }
            };

            setCredentialData(shareData);
            setShowCredentialCard(true);
        } catch (err) {
            showActionStatus('error', err?.message || 'Distributor approval failed');
        } finally {
            setApprovalLoading(false);
        }
    };

    const handleRejectDist = async (id) => {
        if (window.confirm('Reject this distributor registration?')) {
            const res = await dataService.rejectUser(id);
            refreshData();
            showActionStatus(res?.success ? 'success' : 'error', res?.message || (res?.success ? 'Distributor rejected.' : 'Distributor reject failed.'));
        }
    };

    // ─── SUPER_DISTRIBUTOR Approval Logic ────────────────────────────────────
    const handleSAApproveClick = (sa) => {
        setSelectedSA(sa);
        setSAApprovalForm({
            password: 'SA@' + Math.floor(1000 + Math.random() * 9000)
        });
        setShowSAApprovalModal(true);
    };

    const submitSAApproval = async () => {
        if (approvalLoading) return;
        if (!saApprovalForm.password) {
            alert('Please set a password.');
            return;
        }

        setApprovalLoading(true);
        const targetSA = selectedSA;
        try {
            const approvalRes = await dataService.approveUser(
                targetSA._id || targetSA.id || targetSA.username || targetSA.mobile,
                saApprovalForm.password,
                (targetSA.partyCode || generateUniquePartyCode(targetSA.state, targetSA.role || 'SUPER_DISTRIBUTOR', [
                    ...(data.users || []).map(u => u.partyCode),
                    ...(distributors || []).map(d => d.partyCode),
                    ...(SuperDistributors || []).map(s => s.partyCode)
                ])).toUpperCase(),
                targetSA.parent_id || targetSA.ownerId || null,
                targetSA.pin || '1122',
                targetSA.state || '',
                targetSA.role || 'SUPER_DISTRIBUTOR'
            );
            if (!approvalRes?.success) {
                throw new Error(approvalRes?.message || 'SUPER_DISTRIBUTOR approval failed');
            }
            refreshData();
            setShowSAApprovalModal(false);
            showActionStatus('success', approvalRes?.message || 'Super distributor approved successfully.');

            const shareData = {
                name: targetSA.name,
                mobile: targetSA.mobile,
                email: targetSA.email,
                password: saApprovalForm.password,
                idLabel: 'SUPER_DISTRIBUTOR ID',
                idValue: targetSA.id,
                portalType: 'SUPER_DISTRIBUTOR',
                url: window.location.origin,
                emailStatus: 'idle',
                notificationPayload: {
                    type: 'SUPER_DISTRIBUTOR',
                    user: targetSA,
                    password: saApprovalForm.password,
                    idLabel: 'SUPER_DISTRIBUTOR ID',
                    idValue: targetSA.id
                }
            };

            setCredentialData(shareData);
            setShowCredentialCard(true);
        } catch (e) {
            showActionStatus('error', e?.message || 'Super distributor approval failed');
        } finally {
            setApprovalLoading(false);
        }
    };

    const handleRejectSA = async (id) => {
        if (window.confirm('Reject this SUPER_DISTRIBUTOR application?')) {
            const res = await dataService.rejectUser(id);
            refreshData();
            showActionStatus(res?.success ? 'success' : 'error', res?.message || (res?.success ? 'Super distributor rejected.' : 'Super distributor reject failed.'));
        }
    };

    // ─── KYC Approval Logic ───────────────────────────────────────────
    const handleApproveKyc = async (username, type) => {
        let merchantId = null;
        if (type === 'AEPS') {
            merchantId = prompt("Enter Merchant ID for AEPS (Optional):");
        }

        if (window.confirm(`Approve ${type} KYC for ${username}?${merchantId ? `\nMerchant ID: ${merchantId}` : ''}`)) {
            const res = await dataService.approveKyc(username, type, merchantId);
            if (res.success) {
                refreshData();
                showActionStatus('success', `${type} KYC Approved.`);
            } else {
                showActionStatus('error', res.message || 'Approval failed');
            }
        }
    };

    const handleRejectKyc = async (username, type) => {
        const reason = prompt(`Reason for rejecting ${type} KYC:`);
        if (reason === null) return;

        const res = await dataService.rejectKyc(username, type, reason);
        if (res.success) {
            refreshData();
            showActionStatus('success', `${type} KYC Rejected.`);
        } else {
            showActionStatus('error', res.message || 'Rejection failed');
        }
    };

    const handleDeleteUser = async (userOrIdentifier) => {
        const identifier =
            (typeof userOrIdentifier === 'string' ? userOrIdentifier : null) ||
            userOrIdentifier?._id ||
            userOrIdentifier?.id ||
            userOrIdentifier?.username ||
            userOrIdentifier?.mobile ||
            userOrIdentifier?.loginId ||
            userOrIdentifier?.userMobile;
        const displayName =
            (typeof userOrIdentifier === 'string' ? userOrIdentifier : null) ||
            userOrIdentifier?.username ||
            userOrIdentifier?.name ||
            userOrIdentifier?.mobile ||
            identifier;

        if (!identifier) {
            setStatus({ type: 'error', message: 'Unable to delete: missing user id.' });
            setTimeout(() => setStatus(null), 3000);
            return;
        }

        if (!window.confirm(`PERMANENTLY DELETE user ${displayName}?\n\nThis action cannot be undone and all their data will be lost.`)) return;
        
        setLoading(true);
        try {
            const res = await dataService.deleteUser(identifier);
            if (res.success) {
                showActionStatus('success', res?.message || 'User deleted successfully.');
                refreshData();
            } else {
                showActionStatus('error', res.message || 'Deletion failed');
            }
        } catch (e) {
            showActionStatus('error', 'Connection error');
        } finally {
            setLoading(false);
        }
    };

    const DetailModal = () => {
        if (!viewingDetail) return null;
        const { data: item, type } = viewingDetail;

        const renderField = (label, value) => {
            if (!value) return null;
            return (
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                    <p className="text-sm font-bold text-slate-800 break-words">{value}</p>
                </div>
            );
        };

        return (
            <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200"
                >
                    <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                <Eye size={24} className="text-indigo-600" /> 
                                {type.includes('KYC') ? 'KYC Details' : type + ' Application'}
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                Full details submitted by user
                            </p>
                        </div>
                        <button onClick={() => setViewingDetail(null)} className="p-3 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-2xl transition-all"><X size={28} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Personal Info */}
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] border-b pb-2">Profile Info</h4>
                                {renderField('Full Name', item.name || item.fullName || (item.firstName + ' ' + item.lastName))}
                                {renderField('Username / ID', item.username || item.loginId)}
                                {renderField('Mobile', item.mobile || item.phone || item.userMobile)}
                                {renderField('Email', item.email || item.userEmail)}
                                {renderField('Date of Birth', item.dob)}
                                {renderField('Aadhaar Number', item.aadhaar || item.aadhaarNumber || item.aadharNumber || item.aadhaar_number)}
                                {renderField('PAN Number', item.pan || item.panNumber || item.pan_number)}
                            </section>

                            {/* Business Info */}
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] border-b pb-2">Business Details</h4>
                                {renderField('Business Name', item.business_name || item.businessName || item.shopName)}
                                {renderField('GST Number', item.gstNumber || item.gst_number)}
                                {renderField('Role Applied', item.role)}
                                {renderField('Territory / State', item.state || item.territory)}
                                {renderField('City', item.city)}
                                {renderField('Pincode', item.pincode)}
                                {renderField('Address', item.address || item.residentAddress)}
                            </section>

                            {/* Loan Specific */}
                            {type === 'Loan' && (
                                <section className="space-y-4 md:col-span-2 bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 mt-4">
                                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] border-b border-indigo-200 pb-2">Financial Info</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderField('Requested Amount', `₹${parseFloat(item.requested_amount || 0).toLocaleString()}`)}
                                        {renderField('Monthly Income', `₹${parseFloat(item.monthly_income || item.income || 0).toLocaleString()}`)}
                                        {renderField('Employment Type', item.employment_type || item.employmentType)}
                                        {renderField('Tracking ID', item.tracking_id)}
                                    </div>
                                </section>
                            )}

                            {/* Bank Details (AEPS) */}
                            {type === 'AEPS KYC' && (
                                <section className="space-y-4 md:col-span-2 bg-teal-50/50 p-6 rounded-3xl border border-teal-100 mt-4">
                                    <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] border-b border-teal-200 pb-2">Settlement Bank Info</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderField('Bank Name', item.companyBankName)}
                                        {renderField('A/C Holder', item.bankAccountHolderName)}
                                        {renderField('Account Number', item.bankAccountNumber)}
                                        {renderField('IFSC Code', item.bankIfscCode)}
                                    </div>
                                </section>
                            )}

                            {/* Geo Location */}
                            {(item.latitude || item.lat) && (
                                <section className="space-y-2 md:col-span-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Security Data</h4>
                                    <div className="flex gap-4">
                                        <div className="flex-1 p-3 bg-slate-50 rounded-xl border flex items-center gap-3">
                                            <MapPin size={16} className="text-rose-500" />
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Latitude</p>
                                                <p className="text-xs font-mono font-bold">{item.latitude || item.lat}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 p-3 bg-slate-50 rounded-xl border flex items-center gap-3">
                                            <MapPin size={16} className="text-rose-500" />
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Longitude</p>
                                                <p className="text-xs font-mono font-bold">{item.longitude || item.long}</p>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>

                    <div className="p-8 border-t bg-white flex justify-end gap-3">
                        <button onClick={() => setViewingDetail(null)} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Close</button>
                    </div>
                </motion.div>
            </div>
        );
    };

    // ─── Components ───────────────────────────────────────────────────
    const CredentialSharerModal = () => {
        if (!credentialData) return null;

        const shareText = `*RUPIKSHA SERVICES PRIVATE LIMITED APPROVAL*\n\n` +
            `Hello *${credentialData.name}*,\n` +
            `Aapka *${credentialData.portalType}* account approve ho gaya hai.\n\n` +
            `*Login Details:*\n` +
            `• ID: ${credentialData.mobile}\n` +
            `• Password: ${credentialData.password}\n` +
            `• ${credentialData.idLabel}: ${credentialData.idValue}\n\n` +
            `Login here: ${credentialData.url}\n\n` +
            `_Team RUPIKSHA_`;

        const shareWA = () => {
            const url = `https://wa.me/91${credentialData.mobile}?text=${encodeURIComponent(shareText)}`;
            window.open(url, '_blank');
        };

        const sendMail = async () => {
            if (!credentialData?.notificationPayload) {
                showActionStatus('error', 'Email payload missing.');
                return;
            }

            setCredentialData(prev => ({ ...prev, emailStatus: 'sending', error: '' }));
            const payload = credentialData.notificationPayload;
            const emailResult = await handleEmailNotification(payload.type, payload.user, 'APPROVED', {
                password: payload.password,
                idLabel: payload.idLabel,
                idValue: payload.idValue
            });

            const emailFailed = emailResult?.success === false;
            setCredentialData(prev => ({
                ...prev,
                emailStatus: emailFailed ? 'failed' : 'sent',
                error: emailFailed ? 'Email failed. Please retry or share on WhatsApp.' : ''
            }));

            showActionStatus(emailFailed ? 'error' : 'success', emailFailed ? 'Email failed to send.' : 'Email sent successfully.');
        };

        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
                    className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm border border-slate-200 text-center space-y-6"
                >
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-100 relative">
                        {credentialData.emailStatus === 'sending' ? (
                            <RefreshCcw size={32} className="animate-spin text-amber-500" />
                        ) : credentialData.emailStatus === 'sent' ? (
                            <CheckCircle2 size={40} />
                        ) : (
                            <AlertTriangle size={40} className="text-red-500" />
                        )}
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                            {credentialData.emailStatus === 'sending' ? 'Sending Email...' :
                                credentialData.emailStatus === 'sent' ? 'Email Sent! ✅' :
                                credentialData.emailStatus === 'failed' ? 'Email Failed ❌' : 'Credentials Ready'}
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {credentialData.emailStatus === 'failed'
                                ? credentialData.error
                                : credentialData.emailStatus === 'idle'
                                    ? 'Choose mail or WhatsApp'
                                    : 'Sharing credentials with user'}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3">
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{credentialData.portalType} ID</span>
                            <span className="text-xs font-black text-slate-800">{credentialData.idValue}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400 uppercase tracking-tight">Mobile :</span>
                            <span className="font-black text-slate-700">{credentialData.mobile}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400 uppercase tracking-tight">Pass :</span>
                            <span className="font-black text-slate-700">{credentialData.password}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={sendMail}
                            disabled={credentialData.emailStatus === 'sending'}
                            className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[11px] disabled:opacity-60"
                        >
                            <Mail size={16} /> Send Mail
                        </button>
                        <button onClick={shareWA} className="w-full bg-[#25D366] text-white font-black py-4 rounded-xl shadow-lg shadow-green-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[11px]">
                            <Megaphone size={16} /> Send WhatsApp
                        </button>
                    </div>

                    <button onClick={() => setShowCredentialCard(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-slate-600">Close Window</button>
                </motion.div>
            </div>
        );
    };

    const pendingUsers = (data.users || []).filter(u => u.status?.toLowerCase() === 'pending');
    const pendingDists = (distributors || []).filter(d => d.status?.toLowerCase() === 'pending');
    const pendingSAs = (SuperDistributors || []).filter(s => s.status?.toLowerCase() === 'pending');

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {showApprovalModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Approve Retailer</h3>
                            <button onClick={() => setShowApprovalModal(false)} className="text-slate-400"><X size={24} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Retailer</label>
                                <p className="p-3 bg-slate-50 rounded-lg font-bold text-slate-700">{selectedUser?.name || selectedUser?.mobile}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Password</label>
                                <input type="text" className="w-full p-3 bg-slate-50 border rounded-lg font-mono font-bold" value={approvalForm.password} onChange={e => setApprovalForm({ ...approvalForm, password: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Party Code</label>
                                <input type="text" className="w-full p-3 bg-slate-50 border rounded-lg font-mono font-bold" value={approvalForm.partyCode} onChange={e => setApprovalForm({ ...approvalForm, partyCode: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Assign Distributor</label>
                                <select
                                    className="w-full p-3 bg-slate-50 border rounded-lg font-bold text-slate-700"
                                    value={approvalForm.distributorId}
                                    onChange={e => setApprovalForm({ ...approvalForm, distributorId: e.target.value })}
                                >
                                    <option value="">No Distributor (Direct)</option>
                                    {distributors.filter(d => d.status === 'Approved').map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                                    ))}
                                </select>
                            </div>
                            <button disabled={approvalLoading} onClick={submitApproval} className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs disabled:opacity-60">{approvalLoading ? 'Processing...' : 'Confirm Approval'}</button>
                        </div>
                    </motion.div>
                </div>
            )}

            {showDistApprovalModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Approve Distributor</h3>
                            <button onClick={() => setShowDistApprovalModal(false)} className="text-slate-400"><X size={24} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Business</label>
                                <p className="p-3 bg-slate-50 rounded-lg font-bold text-amber-800">{selectedDist?.businessName}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Distributor ID</label>
                                <input type="text" className="w-full p-3 bg-slate-50 border rounded-lg font-mono font-bold" value={distApprovalForm.distribId} onChange={e => setDistApprovalForm({ ...distApprovalForm, distribId: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Password</label>
                                <input type="text" className="w-full p-3 bg-slate-50 border rounded-lg font-mono font-bold" value={distApprovalForm.password} onChange={e => setDistApprovalForm({ ...distApprovalForm, password: e.target.value })} />
                            </div>
                            <button disabled={approvalLoading} onClick={submitDistApproval} className="w-full bg-amber-500 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs disabled:opacity-60">{approvalLoading ? 'Processing...' : 'Confirm Approval'}</button>
                        </div>
                    </motion.div>
                </div>
            )}

            {showSAApprovalModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Approve Super Distributor</h3>
                            <button onClick={() => setShowSAApprovalModal(false)} className="text-slate-400"><X size={24} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">User</label>
                                <p className="p-3 bg-slate-50 rounded-lg font-bold text-indigo-800">{selectedSA?.name || selectedSA?.mobile}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Password</label>
                                <input type="text" className="w-full p-3 bg-slate-50 border rounded-lg font-mono font-bold" value={saApprovalForm.password} onChange={e => setSAApprovalForm({ ...saApprovalForm, password: e.target.value })} />
                            </div>
                            <button disabled={approvalLoading} onClick={submitSAApproval} className="w-full bg-indigo-500 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs disabled:opacity-60">{approvalLoading ? 'Processing...' : 'Confirm Approval'}</button>
                        </div>
                    </motion.div>
                </div>
            )}

            {showCredentialCard && <CredentialSharerModal />}
            {viewingDetail && <DetailModal />}

            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Pending Approvals</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Review new registrations</p>
                    </div>
                    <button
                        onClick={refreshData}
                        className="p-3 bg-white border border-slate-200 text-indigo-600 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-95 shadow-sm"
                        title="Refresh Data"
                    >
                        <RefreshCcw size={20} />
                    </button>
                </div>
                {status && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`px-4 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-widest ${status.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                        {status.message}
                    </motion.div>
                )}
            </div>

            {/* Pending SuperDistributors */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-indigo-50/30">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <ShieldCheck size={18} className="text-indigo-500" />
                        Super Distributor Requests
                    </h3>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black">{pendingSAs.length} PENDING</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Business</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pendingSAs.map((sa, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-sm">{sa.name}</div>
                                        <div className="text-[10px] text-indigo-600 font-black uppercase tracking-tighter">{sa.id}</div>
                                    </td>
                                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400">
                                        {sa.mobile}<br />{sa.email}
                                    </td>
                                    <td className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">
                                        {sa.business_name || sa.businessName || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setViewingDetail({ data: sa, type: 'SUPER_DISTRIBUTOR' })} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-slate-900 hover:text-white transition-all" title="View Details"><Eye size={18} /></button>
                                            <button onClick={() => handleSAApproveClick(sa)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-500 hover:text-white transition-all"><CheckCircle2 size={18} /></button>
                                            <button onClick={() => handleRejectSA(sa.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"><X size={18} /></button>
                                            <button onClick={() => handleDeleteUser(sa)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all" title="Delete Permanent"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pendingSAs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-slate-300 font-bold italic">
                                        No pending super distributor requests.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pending Retailers */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-emerald-50/30">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Users size={18} className="text-emerald-500" />
                        Retailer Requests
                    </h3>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black">{pendingUsers.length} PENDING</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Retailer</th>
                                <th className="px-6 py-4">Business</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Location</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pendingUsers.map((user, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-nowrap">
                                        <div className="font-bold text-slate-800 text-sm">{user.name || 'UNNAMED'}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{user.mobile}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[10px] font-black uppercase text-indigo-600">{user.business_name || user.businessName || 'N/A'}</div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">{user.city || 'N/A City'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{user.email}</td>
                                    <td className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">{user.state}<br/>{user.pincode}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setViewingDetail({ data: user, type: 'Retailer' })} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-indigo-600 transition-all" title="View Full Details"><Eye size={18} /></button>
                                            <button onClick={() => handleApproveClick(user)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all" title="Approve"><CheckCircle2 size={18} /></button>
                                            <button onClick={() => handleRejectUser(user)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all" title="Reject"><X size={18} /></button>
                                            <button onClick={() => handleDeleteUser(user)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all" title="Delete Permanent"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pendingUsers.length === 0 && (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-300 font-bold italic">No pending retailer requests.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Loan Application Requests */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-indigo-50/40">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Landmark size={18} className="text-indigo-600" />
                        Loan Journey Requests
                    </h3>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black">{pendingLoans.length} PENDING</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Applicant</th>
                                <th className="px-6 py-4">Requested / Details</th>
                                <th className="px-6 py-4">Status & Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pendingLoans.map((loan, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-sm">{loan.name || 'Anonymous Applicant'}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{loan.phone}</div>
                                        <div className="text-[9px] font-black text-indigo-500 uppercase mt-1">Ref: {loan.tracking_id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-black text-slate-700">₹{parseFloat(loan.requested_amount || 0).toLocaleString('en-IN')}</div>
                                        <div className="text-[9px] text-indigo-500 font-black uppercase mt-1 px-2 py-0.5 bg-indigo-50 rounded-full w-fit">{loan.employment_type || 'Income: ' + (loan.monthly_income || loan.income)}</div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">{new Date(loan.updated_at).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[9px] font-black uppercase">
                                                    {loan.status || 'INITIATED'}
                                                </span>
                                            </div>
                                            <div className="flex gap-1.5 underline-offset-4 decoration-2">
                                                <button onClick={() => setViewingDetail({ data: loan, type: 'Loan' })} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-900 hover:text-white transition-all" title="View All Info"><Eye size={16} /></button>
                                                <button onClick={() => handleLoanAction(loan.tracking_id, 'approved')} disabled={loading} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-sm disabled:opacity-50"><CheckCircle2 size={16} /></button>
                                                <button onClick={() => handleLoanAction(loan.tracking_id, 'rejected')} disabled={loading} className="p-2 bg-white border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-50 transition-all disabled:opacity-50"><X size={16} /></button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pendingLoans.length === 0 && (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-300 font-bold italic">No pending loan requests.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pending Distributors */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-amber-50/30">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Building2 size={18} className="text-amber-500" />
                        Distributor Requests
                    </h3>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black">{pendingDists.length} PENDING</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Business</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Location</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pendingDists.map((d, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-sm">{d.business_name || d.businessName || 'N/A'}</div>
                                        <div className="text-[10px] text-amber-600 font-black uppercase">{d.name}</div>
                                    </td>
                                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400">
                                        {d.mobile}<br />{d.email}
                                    </td>
                                    <td className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">
                                        {d.city}, {d.state}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setViewingDetail({ data: d, type: 'Distributor' })} className="p-2 bg-white border text-slate-800 rounded-lg hover:bg-slate-900 hover:text-white transition-all" title="View Profile"><Eye size={18} /></button>
                                            <button onClick={() => handleDistApproveClick(d)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all"><ShieldCheck size={18} /></button>
                                            <button onClick={() => handleRejectDist(d.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"><X size={18} /></button>
                                            <button onClick={() => handleDeleteUser(d)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all" title="Delete Permanent"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pendingDists.length === 0 && (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-300 font-bold italic">No pending distributor requests.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pending Main KYC */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-blue-50/30">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-blue-500" />
                        Account KYC Approvals
                    </h3>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black">{pendingMainKyc.length} PENDING</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Retailer</th>
                                <th className="px-6 py-4">ID Details</th>
                                <th className="px-6 py-4">Address</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pendingMainKyc.map((kyc, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-sm">{kyc.fullName || kyc.full_name || 'UNNAMED'}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{kyc.userMobile || kyc.mobile}</div>
                                        <div className="text-[9px] font-black text-indigo-600 uppercase mt-1">Father: {kyc.fathers_name || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[10px] font-black text-slate-700 uppercase">PAN: {kyc.pan_number || 'N/A'}</div>
                                        <div className="text-[10px] font-black text-slate-700 uppercase mt-1">AADHAAR: {kyc.aadhaar_number || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[10px] font-black text-slate-500 uppercase leading-tight max-w-[150px]">{kyc.address || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setViewingKycDocs({ ...kyc, name: kyc.fullName || kyc.full_name, username: kyc.loginId || kyc.userMobile })} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-500 hover:text-white transition-all" title="View Documents"><Eye size={18} /></button>
                                            <button onClick={() => handleApproveKyc(kyc.loginId || kyc.userMobile, 'MAIN')} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all" title="Approve"><CheckCircle2 size={18} /></button>
                                            <button onClick={() => handleRejectKyc(kyc.loginId || kyc.userMobile, 'MAIN')} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all" title="Reject"><X size={18} /></button>
                                            <button onClick={() => handleDeleteUser(kyc.loginId || kyc.userMobile)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all" title="Delete User"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pendingMainKyc.length === 0 && (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-300 font-bold italic">No pending Main KYC requests.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pending AEPS KYC */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-teal-50/30">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Fingerprint size={18} className="text-teal-500" />
                        AEPS KYC Approvals
                    </h3>
                    <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-[10px] font-black">{pendingAepsKyc.length} PENDING</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Retailer / Shop</th>
                                <th className="px-6 py-4">Bank Details</th>
                                <th className="px-6 py-4">Identity Details</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pendingAepsKyc.map((kyc, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-sm">{kyc.fullName}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{kyc.userMobile}</div>
                                        <div className="text-[9px] font-black text-teal-600 uppercase mt-1">{kyc.shopName || 'N/A Shop'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[10px] font-black text-slate-700 uppercase">{kyc.companyBankName || 'N/A'}</div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase mt-1">A/C: {kyc.bankAccountNumber || 'N/A'}</div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase">IFSC: {kyc.bankIfscCode || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[10px] font-black text-slate-700 uppercase">PAN: {kyc.panNumber || 'N/A'}</div>
                                        <div className="text-[10px] font-black text-slate-700 uppercase mt-1">AADHAAR: {kyc.aadharNumber || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setViewingDetail({ data: kyc, type: 'AEPS KYC' })} className="p-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-500 hover:text-white transition-all" title="View Full Details"><Eye size={18} /></button>
                                            <button onClick={() => handleApproveKyc(kyc.loginId, 'AEPS')} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all" title="Approve"><CheckCircle2 size={18} /></button>
                                            <button onClick={() => handleRejectKyc(kyc.loginId, 'AEPS')} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all" title="Reject"><X size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pendingAepsKyc.length === 0 && (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-300 font-bold italic">No pending AEPS KYC requests.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>



            {/* KYC Document Viewer Modal */}
            <AnimatePresence>
                {viewingKycDocs && (
                    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
                        >
                            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                        <Eye size={24} className="text-indigo-600" /> Documents Verification
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Reviewing registry for {viewingKycDocs.name}</p>
                                </div>
                                <button onClick={() => setViewingKycDocs(null)} className="p-3 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-2xl transition-all"><X size={28} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 bg-slate-100/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {[
                                        { label: 'Aadhaar Front', img: viewingKycDocs.aadhaar_front || viewingKycDocs.aadhaarFront },
                                        { label: 'Aadhaar Back', img: viewingKycDocs.aadhaar_back || viewingKycDocs.aadhaarBack },
                                        { label: 'PAN Card / Image', img: viewingKycDocs.pan_number_img || viewingKycDocs.panCard },
                                        { label: 'Shop Selfie / Photo', img: viewingKycDocs.shop_photo || viewingKycDocs.shopPhoto },
                                    ].map((doc, i) => (
                                        <div key={i} className="space-y-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{doc.label}</p>
                                            <div className="aspect-[4/3] bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm flex items-center justify-center relative group">
                                                {doc.img ? (
                                                    <img src={doc.img} alt={doc.label} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center space-y-2 opacity-30">
                                                        <Landmark size={48} className="mx-auto" />
                                                        <p className="text-[10px] font-black uppercase">Not Provided</p>
                                                    </div>
                                                )}
                                                {doc.img && (
                                                    <a href={doc.img} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="bg-white text-slate-900 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-xl">Open Source File</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-8 border-t bg-white flex justify-end gap-4">
                                <button onClick={() => { handleRejectKyc(viewingKycDocs.username, viewingKycDocs.type || 'MAIN'); setViewingKycDocs(null); }} className="px-10 py-4 bg-rose-50 text-rose-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">Reject File</button>
                                <button onClick={() => { handleApproveKyc(viewingKycDocs.username, viewingKycDocs.type || 'MAIN', viewingKycDocs.merchant_id); setViewingKycDocs(null); }} className="px-10 py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-all">Approve Entry</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Approvals;
