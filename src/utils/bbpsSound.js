/**
 * bbpsSound.js
 * Official Sonic Brand (MOGO) player for Bharat Connect (BBPS) transactions.
 * Plays '/BharatConnect MOGO 270824.wav' strictly on payment success across all Bharat Connect services.
 */

const MOGO_PATH = '/BharatConnect%20MOGO%20270824.wav';
const MOGO_PATH_FALLBACK = '/BharatConnect MOGO 270824.wav';

let cachedAudio = null;

/**
 * Prime / pre-warm the audio buffer on direct user interaction (e.g. clicking 'Pay Now').
 * This unlocks audio playback in strict browser environments (mobile/desktop).
 */
export const primeBharatConnectSound = () => {
    try {
        if (!cachedAudio) {
            cachedAudio = new Audio(MOGO_PATH);
            cachedAudio.preload = 'auto';
        }
        cachedAudio.load();
    } catch {
        // Silently ignore if audio is unavailable
    }
};

/**
 * Plays the official Bharat Connect MOGO sound instantly on transaction success.
 * Only intended for Bharat Connect / BBPS transactions.
 */
export const playBharatConnectSuccessSound = () => {
    try {
        const audio = cachedAudio || new Audio(MOGO_PATH);
        audio.currentTime = 0;
        audio.volume = 1.0;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                console.warn('[Bharat Connect Sound] Primary play note:', err);
                try {
                    const fallback = new Audio(MOGO_PATH_FALLBACK);
                    fallback.volume = 1.0;
                    fallback.play().catch((fbErr) => {
                        console.warn('[Bharat Connect Sound] Fallback play note:', fbErr);
                    });
                } catch {
                    // Ignore fallback error
                }
            });
        }
    } catch (err) {
        console.warn('[Bharat Connect Sound] Execution error:', err);
    }
};

export default playBharatConnectSuccessSound;
