import { MANTRA_PORTS } from './constants';
import { parseDiscoveryXml } from './parser';
import { RDServiceNotFoundError } from './errors';

/**
 * Discovers the local running Registered Device (RD) Service
 * by scanning standard localhost ports (11100 to 11120).
 *
 * Mantra MFS110 AVDM uses custom HTTP verbs, NOT standard GET/POST.
 * Verified directly on the device:
 *
 *   RDSERVICE /        → HTTP 200 + RDService XML  (service discovery)
 *   DEVICEINFO /rd/info → HTTP 200 + DeviceInfo XML (device info)
 *   CAPTURE /rd/capture → HTTP 200 + PidData XML   (biometric capture)
 *
 * GET and POST to any path return HTTP 405 Method Not Allowed — by design.
 * OPTIONS preflight returns: ACCESS-CONTROL-ALLOW-METHODS: RDSERVICE,DEVICEINFO,CAPTURE
 */
export async function discoverRdService() {

    for (const port of MANTRA_PORTS) {
        const url = `http://127.0.0.1:${port}/`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 700);

            // RDSERVICE is the correct Mantra AVDM custom HTTP method for discovery.
            // Standard GET returns 405 — this is the documented MFS110 behaviour.
            const response = await fetch(url, {
                method: 'RDSERVICE',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const xmlText = await response.text();
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
            // Port not reachable or timed out — continue scan
        }
    }

    throw new RDServiceNotFoundError();
}
