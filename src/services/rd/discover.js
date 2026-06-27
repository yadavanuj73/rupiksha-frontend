import { MANTRA_PORTS } from './constants';
import { parseDiscoveryXml } from './parser';
import { RDServiceNotFoundError } from './errors';

/**
 * Discovers the local running Registered Device (RD) Service
 * by scanning standard localhost ports (11100 to 11120).
 * Attempts dynamic path resolution as defined by Mantra specs.
 */
export async function discoverRdService() {
    // Port scanner loop
    for (const port of MANTRA_PORTS) {
        const url = `http://127.0.0.1:${port}/`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600);
            
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const xmlText = await response.text();
                // Validate if it contains valid RD Service XML root elements
                if (xmlText.includes('RDService')) {
                    const serviceInfo = parseDiscoveryXml(xmlText);
                    return {
                        port,
                        baseUrl: `http://127.0.0.1:${port}`,
                        ...serviceInfo
                    };
                }
            }
        } catch (e) {
            // Port not running or refused, continue scan
        }
    }
    
    // Controlled fallback attempt: port 11100 directly without fast abort
    try {
        const response = await fetch('http://127.0.0.1:11100/', { method: 'GET' });
        if (response.ok) {
            const xmlText = await response.text();
            if (xmlText.includes('RDService')) {
                const serviceInfo = parseDiscoveryXml(xmlText);
                return {
                    port: 11100,
                    baseUrl: 'http://127.0.0.1:11100',
                    ...serviceInfo
                };
            }
        }
    } catch (e) {
        // Fallback failed
    }
    
    throw new RDServiceNotFoundError();
}
