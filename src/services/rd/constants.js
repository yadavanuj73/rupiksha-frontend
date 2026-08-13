/**
 * RD Service Integration Constants
 */

export const MANTRA_PORTS = Array.from({ length: 21 }, (_, i) => 11100 + i); // 11100 to 11120

export const PID_OPTIONS_XML = `
<PidOptions ver="1.0">
  <Opts env="P" fCount="1" fType="0" iCount="0" format="0" pidVer="2.0" timeout="15000" posh="UNKNOWN" />
</PidOptions>
`.trim();

export const RD_STATES = {
    IDLE: 'IDLE',
    DISCOVERING: 'DISCOVERING',
    SERVICE_FOUND: 'SERVICE_FOUND',
    DEVICE_FOUND: 'DEVICE_FOUND',
    READY: 'READY',
    CAPTURING: 'CAPTURING',
    VALIDATING: 'VALIDATING',
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR'
};
