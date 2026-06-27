import React, { createContext, useState, useEffect, useCallback } from 'react';
import { RD_STATES } from '../services/rd/constants';
import { discoverRdService } from '../services/rd/discover';
import { getDeviceInfo } from '../services/rd/deviceInfo';
import { captureBiometric } from '../services/rd/capture';
import { resetDevice } from '../services/rd/reset';

export const RDContext = createContext(null);

export function RDProvider({ children }) {
    const [captureState, setCaptureState] = useState(RD_STATES.IDLE);
    const [status, setStatus] = useState('Checking RD Service status...');
    const [device, setDevice] = useState(null);
    const [serviceConfig, setServiceConfig] = useState(null);
    const [error, setError] = useState(null);
    const [captureResult, setCaptureResult] = useState(null);

    const health = useCallback(async () => {
        setCaptureState(RD_STATES.DISCOVERING);
        setStatus('Discovering RD Service...');
        setError(null);
        
        try {
            const config = await discoverRdService();
            setServiceConfig(config);
            setCaptureState(RD_STATES.SERVICE_FOUND);
            setStatus('RD Service Running');

            setStatus('Checking connected biometric devices...');
            const info = await getDeviceInfo(config);
            setDevice(info);
            setCaptureState(RD_STATES.READY);
            setStatus('Capture Ready');
        } catch (err) {
            console.error("RD health diagnostics failed", err);
            setDevice(null);
            setServiceConfig(null);
            setCaptureState(RD_STATES.ERROR);
            
            if (err.code === 'RD_SERVICE_NOT_FOUND') {
                setStatus('RD Service Not Installed');
                setError('Mantra RD Service is not running. Please install/start the driver.');
            } else if (err.code === 'DEVICE_DISCONNECTED') {
                setStatus('Device Disconnected');
                setError('RD Service is running, but no biometric device was found.');
            } else {
                setStatus('Device Diagnostics Failed');
                setError(err.message || 'Verification diagnostics failed.');
            }
        }
    }, []);

    useEffect(() => {
        health();
    }, [health]);

    const discover = async () => {
        return health();
    };

    const deviceInfo = async () => {
        if (!serviceConfig) {
            throw new Error('RD Service not discovered yet');
        }
        const info = await getDeviceInfo(serviceConfig);
        setDevice(info);
        return info;
    };

    const reset = async () => {
        if (!serviceConfig) return false;
        return resetDevice(serviceConfig);
    };

    const capture = async (customPidOptions = null) => {
        if (captureState === RD_STATES.CAPTURING) {
            console.warn("Biometric capture currently in execution. Blocking duplicate trigger.");
            return;
        }

        if (!serviceConfig || !device) {
            setError('Device is not ready for capture. Check connection.');
            setCaptureState(RD_STATES.ERROR);
            return;
        }

        setCaptureState(RD_STATES.CAPTURING);
        setStatus('Waiting for fingerprint biometric scan...');
        setCaptureResult(null);
        setError(null);

        try {
            const result = await captureBiometric(serviceConfig, customPidOptions);
            setCaptureState(RD_STATES.VALIDATING);
            setStatus('Validating scan structure...');
            
            setCaptureResult(result);
            setCaptureState(RD_STATES.SUCCESS);
            setStatus('Fingerprint Captured Successfully');
            return result;
        } catch (err) {
            console.error("Biometric capture operation failed", err);
            setCaptureState(RD_STATES.ERROR);
            
            if (err.code === 'CAPTURE_TIMEOUT') {
                setStatus('Capture Timeout');
                setError('Scan timed out. Please click capture and try placing your finger again.');
            } else if (err.code === 'CAPTURE_CANCELLED') {
                setStatus('Capture Cancelled');
                setError('Capture cancelled. Ready to retry.');
            } else if (err.code === 'VALIDATION_FAILED') {
                setStatus('Validation Failed');
                setError(err.message);
            } else {
                setStatus('Capture Failed');
                setError(err.message || 'Capture failed.');
            }
            throw err;
        }
    };

    return (
        <RDContext.Provider value={{
            captureState,
            status,
            device,
            serviceConfig,
            error,
            captureResult,
            discover,
            capture,
            deviceInfo,
            reset,
            health
        }}>
            {children}
        </RDContext.Provider>
    );
}
