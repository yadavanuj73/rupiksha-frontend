/**
 * Sends a reset signal to the local RD service connection if supported.
 */
export async function resetDevice(serviceConfig) {
    if (!serviceConfig || !serviceConfig.baseUrl) {
        throw new Error('Service config is required for device reset');
    }

    const relativePath = serviceConfig.paths?.RESET;
    if (!relativePath) {
        // Reset not supported/defined by driver interfaces
        return false;
    }

    const endpoint = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    const url = `${serviceConfig.baseUrl}${endpoint}`;

    try {
        const response = await fetch(url, {
            method: 'POST'
        });
        return response.ok;
    } catch (e) {
        console.error("Failed to send device reset signal", e);
        return false;
    }
}
