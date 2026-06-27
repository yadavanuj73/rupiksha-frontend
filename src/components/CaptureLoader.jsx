import React from 'react';
import { useRD } from '../hooks/useRD';
import { RD_STATES } from '../services/rd/constants';
import { Loader } from 'lucide-react';

export default function CaptureLoader() {
    const { captureState } = useRD();
    
    const isScanning = captureState === RD_STATES.CAPTURING || captureState === RD_STATES.VALIDATING;
    if (!isScanning) return null;

    return (
        <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-5 flex items-center gap-4">
            <Loader className="text-blue-600 animate-spin shrink-0" size={24} />
            <div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    {captureState === RD_STATES.CAPTURING ? 'Biometric capture active' : 'XML schema validator active'}
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    {captureState === RD_STATES.CAPTURING 
                        ? 'Place your finger flat on the scanner glass and wait for confirmation' 
                        : 'Analyzing SessionKeys and validating certificate structures'}
                </p>
            </div>
        </div>
    );
}
