import { useContext } from 'react';
import { RDContext } from '../context/RDProvider';

/**
 * Reusable hook to consume Mantra RD biometric scanner context.
 */
export function useRD() {
    const context = useContext(RDContext);
    if (!context) {
        throw new Error('useRD must be used within an RDProvider wrapper');
    }
    return context;
}
