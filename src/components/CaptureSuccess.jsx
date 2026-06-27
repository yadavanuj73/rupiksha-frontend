import React from 'react';
import { useRD } from '../hooks/useRD';
import { RD_STATES } from '../services/rd/constants';
import { CheckCircle2, Award } from 'lucide-react';

export default function CaptureSuccess() {
    const { captureState, captureResult } = useRD();
    
    if (captureState !== RD_STATES.SUCCESS || !captureResult) return null;

    return (
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 flex items-start gap-4 text-left">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
            </div>
            <div className="flex-1">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Fingerprint Captured</h4>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 leading-relaxed">
                    Successfully generated cryptographically signed PID XML envelope.
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                        <Award size={10} /> Quality: {captureResult.quality}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold">
                        Code: {captureResult.errCode} (Success)
                    </span>
                </div>
            </div>
        </div>
    );
}
