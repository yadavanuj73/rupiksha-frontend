import React from 'react';
import { useRD } from '../hooks/useRD';
import { RD_STATES } from '../services/rd/constants';
import { CheckCircle2, AlertCircle, RefreshCw, Cpu, Usb, Info } from 'lucide-react';

export default function DeviceStatus() {
    const { captureState, status, device, error, health } = useRD();
    
    const isError = captureState === RD_STATES.ERROR;
    const isReady = captureState === RD_STATES.READY || captureState === RD_STATES.SUCCESS;
    const isScanning = captureState === RD_STATES.DISCOVERING || captureState === RD_STATES.CAPTURING || captureState === RD_STATES.VALIDATING;

    return (
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Cpu size={14} />
                    Biometric Scanner Status
                </h3>
                <button
                    type="button"
                    onClick={health}
                    disabled={isScanning}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    title="Refresh diagnostics"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">RD Service Status</span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full ${
                        isReady 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : isError 
                            ? 'bg-rose-50 text-rose-700' 
                            : 'bg-blue-50 text-blue-700'
                    }`}>
                        {isReady ? <CheckCircle2 size={12} /> : <Info size={12} />}
                        {status}
                    </span>
                </div>

                {device && (
                    <div className="border-t border-slate-200/60 pt-4 mt-2 space-y-2.5 text-xs text-slate-500 font-semibold">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-slate-400"><Usb size={12} /> Model Type</span>
                            <span className="text-slate-700 font-bold">{device.mi || 'Mantra MFS110'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-slate-400"><Info size={12} /> Serial Number</span>
                            <span className="text-slate-700 font-bold font-mono">{device.serialNumber || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-slate-400"><Info size={12} /> Driver Version</span>
                            <span className="text-slate-700 font-bold">{device.rdsVer || 'N/A'}</span>
                        </div>
                    </div>
                )}

                {isError && error && (
                    <div className="bg-rose-50 border border-rose-100/60 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-start gap-2.5 mt-2 font-semibold">
                        <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={14} />
                        <div>{error}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
