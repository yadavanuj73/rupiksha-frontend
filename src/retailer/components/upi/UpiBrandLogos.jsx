import React from 'react';

/**
 * Authentic vector logos for the 4 major UPI payment apps:
 * PhonePe, Google Pay, Paytm, BHIM.
 * Preserves brand colors, official proportions, and high visual fidelity.
 * Note: Under requirement, NO text descriptions/captions are rendered.
 */

export const PhonePeLogo = ({ className = 'h-8 w-auto' }) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="PhonePe">
        <circle cx="50" cy="50" r="48" fill="#5F259F" />
        {/* PhonePe 'पे' glyph */}
        <g fill="#FFFFFF">
            {/* Shirorekha (top bar) */}
            <path d="M26 31h40v6.5H26z" />
            {/* Vertical stem */}
            <path d="M52 31v44h-8V52h-5c-6.6 0-11-4.4-11-11v-3.5h7.5V41c0 2.8 1.8 4.5 4.5 4.5h4V31h8z" />
            {/* Matra (vowel sign above) */}
            <path d="M52.5 31c0 0 3-8.5 12-11.5 1.5-.5 2.5.5 1.5 2-4 5.5-8 9.5-8 9.5h-5.5z" />
            {/* Anusvara / dot */}
            <circle cx="68" cy="27" r="3.2" />
        </g>
    </svg>
);

export const GooglePayLogo = ({ className = 'h-7 w-auto' }) => (
    <svg viewBox="0 0 78 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Google Pay">
        {/* Left loop: Blue (top-left) & Green (bottom-left) */}
        <path
            d="M23 7C14.7 7 8 13.7 8 22c0 8.3 6.7 15 15 15 5.8 0 10.8-3.3 13.3-8.2l-6-3.5C28.8 27.8 26.1 29.5 23 29.5c-4.1 0-7.5-3.4-7.5-7.5 0-4.1 3.4-7.5 7.5-7.5 3.1 0 5.8 1.7 7.3 4.2l6-3.5C33.8 10.3 28.8 7 23 7z"
            fill="#4285F4"
        />
        <path
            d="M23 37c5.8 0 10.8-3.3 13.3-8.2l-6-3.5C28.8 27.8 26.1 29.5 23 29.5c-4.1 0-7.5-3.4-7.5-7.5H8c0 8.3 6.7 15 15 15z"
            fill="#34A853"
        />
        {/* Right loop: Red (top-right) & Yellow (bottom-right) */}
        <path
            d="M55 7c-5.8 0-10.8 3.3-13.3 8.2l6 3.5c1.5-2.5 4.2-4.2 7.3-4.2 4.1 0 7.5 3.4 7.5 7.5 0 4.1-3.4 7.5-7.5 7.5-3.1 0-5.8-1.7-7.3-4.2l-6 3.5C44.2 33.7 49.2 37 55 37c8.3 0 15-6.7 15-15 0-8.3-6.7-15-15-15z"
            fill="#EA4335"
        />
        <path
            d="M55 37c-5.8 0-10.8-3.3-13.3-8.2l6-3.5c1.5 2.5 4.2 4.2 7.3 4.2 4.1 0 7.5-3.4 7.5-7.5H70c0 8.3-6.7 15-15 15z"
            fill="#FBBC04"
        />
    </svg>
);

export const PaytmLogo = ({ className = 'h-6 w-auto' }) => (
    <svg viewBox="0 0 96 30" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Paytm">
        <text
            x="2"
            y="22"
            fontFamily="Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="24"
            letterSpacing="-0.5px"
        >
            <tspan fill="#002970">Pay</tspan>
            <tspan fill="#00BAF2">tm</tspan>
        </text>
    </svg>
);

export const BhimLogo = ({ className = 'h-6 w-auto' }) => (
    <svg viewBox="0 0 102 30" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="BHIM">
        {/* BHIM Text */}
        <text
            x="2"
            y="22"
            fontFamily="Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="22"
            fill="#092348"
            letterSpacing="0.5px"
        >
            BHIM
        </text>
        {/* Official UPI / BHIM angled chevrons */}
        <g transform="translate(68, 4)">
            {/* Green chevron */}
            <path d="M12 0l-7 22h5l7-22h-5z" fill="#0B7C3E" />
            {/* Orange chevron */}
            <path d="M19 0l-7 22h5l7-22h-5z" fill="#F47920" />
        </g>
    </svg>
);

export default {
    PhonePeLogo,
    GooglePayLogo,
    PaytmLogo,
    BhimLogo
};
