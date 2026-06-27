/**
 * XML Parsing Utilities for Registered Device (RD) response payloads
 */

export function parseDiscoveryXml(xmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    const rdServiceNode = doc.getElementsByTagName('RDService')[0];
    
    if (!rdServiceNode) {
        throw new Error('Invalid discovery XML: missing RDService tag');
    }
    
    const status = rdServiceNode.getAttribute('status');
    const info = rdServiceNode.getAttribute('info');
    
    const interfaces = doc.getElementsByTagName('Interface');
    const paths = {};
    for (let i = 0; i < interfaces.length; i++) {
        const item = interfaces[i];
        const id = item.getAttribute('id');
        const path = item.getAttribute('path');
        if (id && path) {
            paths[id] = path;
        }
    }
    
    return {
        status,
        info,
        paths
    };
}

export function parseDeviceInfoXml(xmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    const deviceInfoNode = doc.getElementsByTagName('DeviceInfo')[0];
    
    if (!deviceInfoNode) {
        throw new Error('Invalid DeviceInfo XML: missing DeviceInfo tag');
    }
    
    const dpId = deviceInfoNode.getAttribute('dpId');
    const rdsId = deviceInfoNode.getAttribute('rdsId');
    const rdsVer = deviceInfoNode.getAttribute('rdsVer');
    const dc = deviceInfoNode.getAttribute('dc');
    const mi = deviceInfoNode.getAttribute('mi');
    
    const additionalInfo = doc.getElementsByTagName('additional_info')[0];
    let serialNumber = '';
    
    if (additionalInfo) {
        const params = additionalInfo.getElementsByTagName('Param');
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            const name = p.getAttribute('name');
            const value = p.getAttribute('value');
            if (name && name.toLowerCase() === 'srno') {
                serialNumber = value;
            }
        }
    }
    
    return {
        dpId,
        rdsId,
        rdsVer,
        dc,
        mi,
        serialNumber,
        isConnected: true
    };
}

export function parsePidDataXml(xmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    const pidDataNode = doc.getElementsByTagName('PidData')[0];
    
    if (!pidDataNode) {
        throw new Error('Invalid PidData XML: missing PidData tag');
    }
    
    const respNode = doc.getElementsByTagName('Resp')[0];
    if (!respNode) {
        throw new Error('Invalid PidData XML: missing Resp tag');
    }
    
    const errCode = respNode.getAttribute('errCode');
    const errInfo = respNode.getAttribute('errInfo');
    const qScoreStr = respNode.getAttribute('qScore');
    const fNm = respNode.getAttribute('fNm');
    
    let quality = 0;
    if (qScoreStr) {
        quality = parseInt(qScoreStr, 10);
    }
    
    const skeyNode = doc.getElementsByTagName('Skey')[0];
    const hmacNode = doc.getElementsByTagName('Hmac')[0];
    const devInfoNode = doc.getElementsByTagName('DeviceInfo')[0];
    
    const hasSkey = skeyNode && skeyNode.textContent.trim().length > 0;
    const hasHmac = hmacNode && hmacNode.textContent.trim().length > 0;
    const hasDeviceInfo = !!devInfoNode;
    
    return {
        errCode,
        errInfo,
        quality,
        timestamp: fNm,
        hasSkey,
        hasHmac,
        hasDeviceInfo,
        pidXml: xmlStr
    };
}
