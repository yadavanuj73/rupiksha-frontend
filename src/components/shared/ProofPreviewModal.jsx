import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ZoomIn, ZoomOut, RotateCw, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';

const ProofPreviewModal = ({ isOpen, onClose, proofUrl, title = 'Transaction Proof Preview', originalFilename = 'proof.jpg' }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [blobUrl, setBlobUrl] = useState(null);
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        if (!isOpen || !proofUrl) {
            setBlobUrl(null);
            setScale(1);
            setRotation(0);
            setError(false);
            setLoading(true);
            return;
        }

        // If proofUrl is already a data/blob url (e.g. from file picker preview)
        if (proofUrl.startsWith('data:') || proofUrl.startsWith('blob:')) {
            setBlobUrl(proofUrl);
            setLoading(false);
            return;
        }

        // Fetch securely with auth token
        let active = true;
        setLoading(true);
        setError(false);

        const isAdminTab = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
        const token = isAdminTab
            ? (localStorage.getItem('rupiksha_admin_token') || localStorage.getItem('rupiksha_token'))
            : (localStorage.getItem('rupiksha_imp_token') || localStorage.getItem('rupiksha_token'));

        fetch(proofUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                return res.blob();
            })
            .then(blob => {
                if (active) {
                    const url = URL.createObjectURL(blob);
                    setBlobUrl(url);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (active) {
                    setError(true);
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [isOpen, proofUrl]);

    if (!isOpen) return null;

    const handleDownload = () => {
        if (!blobUrl) return;
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = originalFilename || 'transaction_proof.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                <ImageIcon size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 tracking-tight">{title}</h3>
                                <p className="text-[11px] text-slate-500 font-medium truncate max-w-sm">{originalFilename}</p>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setScale(s => Math.min(s + 0.25, 2.5))}
                                title="Zoom In"
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                            >
                                <ZoomIn size={16} />
                            </button>
                            <button
                                onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
                                title="Zoom Out"
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                            >
                                <ZoomOut size={16} />
                            </button>
                            <button
                                onClick={() => setRotation(r => (r + 90) % 360)}
                                title="Rotate"
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                            >
                                <RotateCw size={16} />
                            </button>
                            {blobUrl && (
                                <button
                                    onClick={handleDownload}
                                    title="Download"
                                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                                >
                                    <Download size={16} />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                title="Close"
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Image Viewer Area */}
                    <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-900/5 min-h-[350px]">
                        {loading && (
                            <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                                <Loader2 size={32} className="animate-spin text-blue-600" />
                                <p className="text-xs font-bold">Loading proof preview...</p>
                            </div>
                        )}

                        {error && !loading && (
                            <div className="flex flex-col items-center gap-3 py-12 text-rose-500 max-w-sm text-center">
                                <AlertCircle size={32} />
                                <p className="text-sm font-black">Unable to load proof</p>
                                <p className="text-xs text-slate-500">The file could not be retrieved from private storage or you are not authorized to view it.</p>
                            </div>
                        )}

                        {blobUrl && !loading && (
                            <div className="overflow-hidden flex items-center justify-center transition-all duration-200">
                                <img
                                    src={blobUrl}
                                    alt="Transaction Proof"
                                    style={{
                                        transform: `scale(${scale}) rotate(${rotation}deg)`,
                                        transformOrigin: 'center center',
                                        transition: 'transform 0.15s ease-out',
                                        maxHeight: '65vh',
                                        maxWidth: '100%',
                                        objectFit: 'contain',
                                    }}
                                    className="rounded-xl shadow-md border border-slate-200 bg-white"
                                />
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ProofPreviewModal;
