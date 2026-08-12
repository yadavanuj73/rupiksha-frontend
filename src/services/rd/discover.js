import { MANTRA_PORTS } from './constants';
import { parseDiscoveryXml } from './parser';
import { RDServiceNotFoundError } from './errors';

/**
 * Discovers the local running Registered Device (RD) Service
 * by scanning standard localhost ports (11100 to 11120).
 *
 * Strategy (Mantra MFS110 protocol-correct):
 *  1. Probe GET /rd/info on each port with a short timeout.
 *     This is the real Mantra device-info API — NOT GET /.
 *     GET / on MFS110 legitimately returns HTTP 405 (Method Not Allowed)
 *     and must NOT be used as the discovery endpoint.
 *  2. If /rd/info responds with HTTP 200 + DeviceInfo/RDService XML → confirmed.
 *  3. Fallback: if GET / returns HTTP 405 (service listening, refuses GET /),
 *     attempt /rd/info with a longer timeout to confirm RD identity.
 */
export async function discoverRdService() {

    // ─── Phase 1: probe GET /rd/info on every port in range ─────────────────
    for (const port of MANTRA_PORTS) {
        const infoUrl = `http://127.0.0.1:${port}/rd/info`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 700);

            const response = await fetch(infoUrl, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const xmlText = await response.text();
                if (xmlText.includes('DeviceInfo') || xmlText.includes('RDService')) {
                    // Determine interface paths — use MFS110 defaults if not defined in XML
                    let paths = { DEVICEINFO: '/rd/info', CAPTURE: '/rd/capture' };
                    if (xmlText.includes('RDService')) {
                        try {
                            const serviceInfo = parseDiscoveryXml(xmlText);
                            if (serviceInfo.paths && Object.keys(serviceInfo.paths).length > 0) {
                                paths = serviceInfo.paths;
                            }
                        } catch (_) { /* use defaults */ }
                    }
                    return {
                        port,
                        baseUrl: `http://127.0.0.1:${port}`,
                        paths
                    };
                }
            }
        } catch (e) {
            // Port not reachable or timed out — continue scan
        }
    }

    // ─── Phase 2: fallback — detect listening port via GET / returning 405 ───
    // The Mantra MFS110 RD Service returns HTTP 405 for GET /.
    // This is NOT an error — it proves the service is running.
    // Confirm RD identity by calling /rd/info with a longer timeout.
    for (const port of MANTRA_PORTS) {
        const rootUrl = `http://127.0.0.1:${port}/`;
        const infoUrl = `http://127.0.0.1:${port}/rd/info`;

        try {
            const ctrlRoot = new AbortController();
            const tid1 = setTimeout(() => ctrlRoot.abort(), 700);

            const rootResp = await fetch(rootUrl, {
                method: 'GET',
                signal: ctrlRoot.signal
            });
            clearTimeout(tid1);

            // HTTP 405 on GET / = MFS110 is listening and correctly refusing GET /
            // HTTP 200 on GET / = some RD service version that accepts the root path
            if (rootResp.status === 405 || rootResp.ok) {
                try {
                    const ctrlInfo = new AbortController();
                    const tid2 = setTimeout(() => ctrlInfo.abort(), 2000);

                    const infoResp = await fetch(infoUrl, {
                        method: 'GET',
                        signal: ctrlInfo.signal
                    });
                    clearTimeout(tid2);

                    if (infoResp.ok) {
                        const xmlText = await infoResp.text();
                        if (xmlText.includes('DeviceInfo') || xmlText.includes('RDService')) {
                            return {
                                port,
                                baseUrl: `http://127.0.0.1:${port}`,
                                paths: { DEVICEINFO: '/rd/info', CAPTURE: '/rd/capture' }
                            };
                        }
                    }
                } catch (_) {
                    // /rd/info also failed on this port — continue
                }
            }
        } catch (e) {
            // Port not reachable — continue
        }
    }

    throw new RDServiceNotFoundError();
}
