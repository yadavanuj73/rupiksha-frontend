import React from 'react';
import { useRD } from '../hooks/useRD';
import { RD_STATES } from '../services/rd/constants';
import { AlertTriangle } from 'lucide-react';

export default function CaptureError() {
    const { captureState, error } = useRD();
    
    if (captureState !== RD_STATES.ERROR || !error) return null;

    return (
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 flex items-start gap-4 text-left">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
            </div>
            <div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Device/Capture Error</h4>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 leading-relaxed">{error}</p>
            </div>
        </div>
    );
}
