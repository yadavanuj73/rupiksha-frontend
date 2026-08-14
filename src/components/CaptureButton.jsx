import React from 'react';
import { useRD } from '../hooks/useRD';
import { RD_STATES } from '../services/rd/constants';
import { Fingerprint } from 'lucide-react';

export default function CaptureButton({ onCaptureSuccess, onCaptureError, customPidOptions = null }) {
    const { captureState, capture, device } = useRD();
    
    const isScanning = captureState === RD_STATES.DISCOVERING || 
                       captureState === RD_STATES.CAPTURING || 
                       captureState === RD_STATES.VALIDATING;
                       
    const isDisabled = isScanning || !device;

    const handleCapture = async () => {
        try {
            const result = await capture(customPidOptions);
            if (result && onCaptureSuccess) {
                onCaptureSuccess(result);
            }
        } catch (err) {
            if (onCaptureError) {
                onCaptureError(err);
            }
        }
    };

    return (
        <button
            type="button"
            onClick={handleCapture}
            disabled={isDisabled}
            className={`w-full py-4 px-6 rounded-2xl font-bold uppercase tracking-wider text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                isScanning
                    ? 'bg-blue-100 text-blue-500 cursor-not-allowed shadow-none'
                    : !device
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
            }`}
        >
            <Fingerprint size={20} className={captureState === RD_STATES.CAPTURING ? 'animate-pulse' : ''} />
            {captureState === RD_STATES.CAPTURING
                ? 'Awaiting fingerprint scan...'
                : captureState === RD_STATES.VALIDATING
                ? 'Verifying PID structure...'
                : 'Capture Fingerprint'}
        </button>
    );
}
