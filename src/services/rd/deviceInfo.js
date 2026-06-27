import { parseDeviceInfoXml } from './parser';
import { DeviceDisconnectedError } from './errors';

/**
 * Fetches information about the connected Mantra device.
 * Queries the dynamically discovered DEVICEINFO relative path.
 */
export async function getDeviceInfo(serviceConfig) {
    if (!serviceConfig || !serviceConfig.baseUrl) {
        throw new Error('Service config is required for device info queries');
    }
    
    const relativePath = serviceConfig.paths?.DEVICEINFO || '/rd/info';
    const endpoint = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    const url = `${serviceConfig.baseUrl}${endpoint}`;
    
    try {
        // Mantra spec accepts standard GET requests
        const response = await fetch(url, {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error(`Device info HTTP error: ${response.status}`);
        }
        
        const xmlText = await response.text();
        const info = parseDeviceInfoXml(xmlText);
        return info;
    } catch (e) {
        console.error("Failed to query device information", e);
        throw new DeviceDisconnectedError();
    }
}
