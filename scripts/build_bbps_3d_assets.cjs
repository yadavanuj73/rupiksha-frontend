const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '../public/bbps');
const assetsDir = path.resolve(__dirname, '../src/assets/bbps');

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Common SVG helpers
const defsPreamble = `
    <filter id="studioShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="12" />
        <feOffset dx="0" dy="16" />
        <feComponentTransfer><feFuncA type="linear" slope="0.14" /></feComponentTransfer>
        <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
        </feMerge>
    </filter>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
        </feMerge>
    </filter>
    <radialGradient id="floorShadow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#0F172A" stop-opacity="0.18" />
        <stop offset="60%" stop-color="#0F172A" stop-opacity="0.05" />
        <stop offset="100%" stop-color="#0F172A" stop-opacity="0" />
    </radialGradient>
`;

const ICONS = {
    'water': {
        bg: '#E0F7FA',
        content: `
            <ellipse cx="200" cy="255" rx="110" ry="24" fill="url(#floorShadow)" />
            <!-- Water Ripple -->
            <ellipse cx="200" cy="240" rx="80" ry="16" fill="none" stroke="#0284C7" stroke-width="2" opacity="0.4" />
            <ellipse cx="200" cy="240" rx="50" ry="10" fill="none" stroke="#38BDF8" stroke-width="2.5" opacity="0.6" />
            
            <!-- Chrome Faucet Tap -->
            <g filter="url(#studioShadow)">
                <!-- Pipe -->
                <path d="M90 140 H160 C185 140 205 160 205 185 V200" fill="none" stroke="url(#chromePipe)" stroke-width="32" stroke-linecap="round" />
                <path d="M90 140 H160 C185 140 205 160 205 185 V200" fill="none" stroke="url(#chromeHighlight)" stroke-width="8" stroke-linecap="round" opacity="0.75" />
                <!-- Faucet Spout Lip -->
                <ellipse cx="205" cy="202" rx="19" ry="8" fill="#475569" />
                <ellipse cx="205" cy="202" rx="16" ry="6" fill="#0284C7" />
                
                <!-- Valve Top Mount -->
                <rect x="145" y="105" width="20" height="25" rx="4" fill="url(#chromeMetal)" />
                <!-- Rotary Valve Wheel (Glossy Cobalt) -->
                <ellipse cx="155" cy="105" rx="36" ry="12" fill="url(#valveGradient)" />
                <ellipse cx="155" cy="103" rx="32" ry="10" fill="none" stroke="#60A5FA" stroke-width="2" />
                <circle cx="155" cy="104" r="7" fill="url(#chromeMetal)" />
            </g>

            <!-- 3D Crystal Water Drop Falling -->
            <g filter="url(#softGlow)">
                <path d="M205 210 C205 210 188 234 188 244 C188 253.5 195.5 261 205 261 C214.5 261 222 253.5 222 244 C222 234 205 210 205 210 Z" fill="url(#waterDropGrad)" />
                <!-- Water drop specular arc -->
                <path d="M193 240 C193 234 198 225 204 218" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" opacity="0.85" />
                <ellipse cx="202" cy="254" rx="4" ry="2" fill="#FFFFFF" opacity="0.8" />
            </g>

            <defs>
                <linearGradient id="chromePipe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#F8FAFC" />
                    <stop offset="30%" stop-color="#CBD5E1" />
                    <stop offset="70%" stop-color="#475569" />
                    <stop offset="100%" stop-color="#1E293B" />
                </linearGradient>
                <linearGradient id="chromeHighlight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#FFFFFF" />
                    <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="chromeMetal" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#94A3B8" />
                    <stop offset="50%" stop-color="#FFFFFF" />
                    <stop offset="100%" stop-color="#64748B" />
                </linearGradient>
                <linearGradient id="valveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#2563EB" />
                    <stop offset="60%" stop-color="#1D4ED8" />
                    <stop offset="100%" stop-color="#1E3A8A" />
                </linearGradient>
                <radialGradient id="waterDropGrad" cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stop-color="#BAE6FD" />
                    <stop offset="40%" stop-color="#38BDF8" />
                    <stop offset="85%" stop-color="#0284C7" />
                    <stop offset="100%" stop-color="#0369A1" />
                </radialGradient>
            </defs>
        `
    },
    'mobile-postpaid': {
        bg: '#EDE9FE',
        content: `
            <ellipse cx="200" cy="260" rx="105" ry="22" fill="url(#floorShadow)" />
            <!-- Smartphone Body -->
            <g filter="url(#studioShadow)">
                <!-- Phone Base -->
                <rect x="135" y="55" width="130" height="205" rx="26" fill="url(#phoneBodyGrad)" />
                <!-- Chrome Rim -->
                <rect x="135" y="55" width="130" height="205" rx="26" fill="none" stroke="url(#phoneRimGrad)" stroke-width="2.5" />
                <!-- Screen Glass -->
                <rect x="141" y="61" width="118" height="193" rx="22" fill="#0F172A" />
                <!-- Screen Inner Wallpaper -->
                <rect x="144" y="64" width="112" height="187" rx="19" fill="url(#screenGrad)" />
                <!-- Dynamic Island / Speaker -->
                <rect x="180" y="70" width="40" height="8" rx="4" fill="#000000" />
                <circle cx="214" cy="74" r="2" fill="#1E293B" />
                
                <!-- Floating Postpaid Bill Card on Screen -->
                <rect x="154" y="96" width="92" height="120" rx="12" fill="#FFFFFF" opacity="0.95" />
                <!-- Invoice Header Bar -->
                <rect x="162" y="106" width="42" height="6" rx="3" fill="#6366F1" />
                <rect x="162" y="118" width="76" height="3" rx="1.5" fill="#E2E8F0" />
                <rect x="162" y="126" width="60" height="3" rx="1.5" fill="#E2E8F0" />
                
                <!-- Bill Amount Pill -->
                <rect x="160" y="142" width="80" height="24" rx="8" fill="#EEF2FF" />
                <text x="170" y="158" font-family="Inter,sans-serif" font-weight="900" font-size="12" fill="#4F46E5">₹ 849.00</text>
                
                <!-- Verified Checkmark Badge -->
                <circle cx="200" cy="192" r="14" fill="#10B981" />
                <path d="M194 192 L198 196 L207 187" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            </g>
            <defs>
                <linearGradient id="phoneBodyGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4C1D95" />
                    <stop offset="100%" stop-color="#1E1B4B" />
                </linearGradient>
                <linearGradient id="phoneRimGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#C4B5FD" />
                    <stop offset="50%" stop-color="#6D28D9" />
                    <stop offset="100%" stop-color="#A78BFA" />
                </linearGradient>
                <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#312E81" />
                    <stop offset="100%" stop-color="#1E1B4B" />
                </linearGradient>
            </defs>
        `
    },
    'landline-postpaid': {
        bg: '#E0F2FE',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Modern Desktop Landline Base -->
            <g filter="url(#studioShadow)">
                <path d="M125 155 L145 105 H255 L275 155 L265 240 H135 Z" fill="url(#phoneBaseGrad)" />
                <path d="M145 105 H255 L275 155 H125 Z" fill="url(#phoneInclineGrad)" />
                
                <!-- LCD Screen -->
                <rect x="160" y="112" width="80" height="32" rx="6" fill="#0284C7" opacity="0.9" />
                <text x="168" y="128" font-family="Inter,monospace" font-size="9" font-weight="700" fill="#E0F2FE">011-23456789</text>
                <text x="168" y="139" font-family="Inter,monospace" font-size="8" font-weight="700" fill="#BAE6FD">CONNECTED</text>
                
                <!-- Keypad Buttons -->
                ${[0, 1, 2].map(r => [0, 1, 2].map(c => `
                    <rect x="${165 + c * 24}" y="${162 + r * 18}" width="16" height="12" rx="3" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1" />
                `).join('')).join('')}

                <!-- Handset -->
                <path d="M110 85 C110 75 125 75 130 90 L138 120 C138 135 128 140 128 150 L128 185 C128 195 138 200 138 215 L130 245 C125 260 110 260 110 250 Z" fill="url(#handsetGrad)" />
                
                <!-- Coiled Cord -->
                <path d="M125 245 Q 115 265 135 260 Q 155 255 140 270 Q 160 275 175 250" fill="none" stroke="#64748B" stroke-width="4" stroke-linecap="round" />
            </g>
            <defs>
                <linearGradient id="phoneBaseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#334155" />
                    <stop offset="100%" stop-color="#0F172A" />
                </linearGradient>
                <linearGradient id="phoneInclineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#475569" />
                    <stop offset="100%" stop-color="#334155" />
                </linearGradient>
                <linearGradient id="handsetGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#1E293B" />
                    <stop offset="50%" stop-color="#475569" />
                    <stop offset="100%" stop-color="#0F172A" />
                </linearGradient>
            </defs>
        `
    },
    'life-insurance': {
        bg: '#DCFCE7',
        content: `
            <ellipse cx="200" cy="260" rx="110" ry="22" fill="url(#floorShadow)" />
            <!-- Protective Umbrella -->
            <g filter="url(#studioShadow)">
                <!-- Umbrella Tip -->
                <rect x="197" y="65" width="6" height="16" rx="2" fill="#E2E8F0" />
                <!-- Umbrella Canopy -->
                <path d="M100 150 C110 95 160 80 200 80 C240 80 290 95 300 150 C270 145 245 152 235 150 C215 145 185 145 165 150 C155 152 130 145 100 150 Z" fill="url(#umbrellaGrad)" />
                <!-- Canopy Highlights -->
                <path d="M165 150 C185 100 200 80 200 80 C200 80 215 100 235 150" fill="url(#umbrellaCenter)" opacity="0.6" />
                
                <!-- Umbrella Shaft & Handle -->
                <rect x="198" y="145" width="5" height="100" fill="#94A3B8" />
                <path d="M200 245 C200 258 185 258 185 245" fill="none" stroke="#475569" stroke-width="5" stroke-linecap="round" />
            </g>

            <!-- Glowing Golden Heart of Life inside shelter -->
            <g filter="url(#softGlow)">
                <path d="M200 185 C200 175 190 165 178 165 C165 165 155 175 155 188 C155 205 185 225 200 235 C215 225 245 205 245 188 C245 175 235 165 222 165 C210 165 200 175 200 185 Z" fill="url(#heartGrad)" />
                <path d="M172 173 C166 178 165 188 170 196" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
            </g>
            <defs>
                <linearGradient id="umbrellaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10B981" />
                    <stop offset="60%" stop-color="#059669" />
                    <stop offset="100%" stop-color="#047857" />
                </linearGradient>
                <linearGradient id="umbrellaCenter" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#34D399" />
                    <stop offset="50%" stop-color="#6EE7B7" />
                    <stop offset="100%" stop-color="#34D399" />
                </linearGradient>
                <radialGradient id="heartGrad" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stop-color="#FEF08A" />
                    <stop offset="40%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#D97706" />
                </radialGradient>
            </defs>
        `
    },
    'loan-repayment': {
        bg: '#CCFBF1',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Bank Vault Door -->
            <g filter="url(#studioShadow)">
                <rect x="90" y="80" width="130" height="155" rx="20" fill="url(#vaultGrad)" stroke="#475569" stroke-width="4" />
                <circle cx="155" cy="155" r="45" fill="url(#vaultInner)" stroke="#94A3B8" stroke-width="3" />
                <circle cx="155" cy="155" r="16" fill="url(#goldGrad)" />
                <!-- Vault Wheel Handles -->
                <path d="M155 105 V205 M105 155 H205 M120 120 L190 190 M120 190 L190 120" stroke="#E2E8F0" stroke-width="4" stroke-linecap="round" />
            </g>

            <!-- Stack of 3D Gold Rupee Coins in Foreground -->
            <g filter="url(#studioShadow)">
                ${[0, 1, 2, 3].map(i => `
                    <g transform="translate(0, ${-i * 12})">
                        <ellipse cx="245" cy="230" rx="38" ry="14" fill="#B45309" />
                        <rect x="207" y="222" width="76" height="8" fill="url(#goldRim)" />
                        <ellipse cx="245" cy="222" rx="38" ry="14" fill="url(#goldGrad)" stroke="#FDE68A" stroke-width="1.5" />
                    </g>
                `).join('')}
                <text x="238" y="190" font-family="Inter,sans-serif" font-weight="900" font-size="20" fill="#78350F">₹</text>
            </g>
            <defs>
                <linearGradient id="vaultGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#64748B" />
                    <stop offset="100%" stop-color="#1E293B" />
                </linearGradient>
                <linearGradient id="vaultInner" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#334155" />
                    <stop offset="100%" stop-color="#0F172A" />
                </linearGradient>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#FDE047" />
                    <stop offset="50%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#D97706" />
                </linearGradient>
                <linearGradient id="goldRim" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#D97706" />
                    <stop offset="50%" stop-color="#FDE047" />
                    <stop offset="100%" stop-color="#B45309" />
                </linearGradient>
            </defs>
        `
    },
    'agent-collection': {
        bg: '#D1FAE5',
        content: `
            <ellipse cx="200" cy="255" rx="110" ry="22" fill="url(#floorShadow)" />
            <!-- POS Terminal Device -->
            <g filter="url(#studioShadow)">
                <rect x="135" y="70" width="130" height="175" rx="22" fill="url(#posGrad)" stroke="#334155" stroke-width="2" />
                <!-- Terminal Screen -->
                <rect x="148" y="105" width="104" height="65" rx="10" fill="#0F172A" />
                <rect x="152" y="109" width="96" height="57" rx="8" fill="#1E293B" />
                <text x="162" y="132" font-family="Inter,sans-serif" font-size="11" font-weight="900" fill="#34D399">COLLECT</text>
                <text x="162" y="148" font-family="Inter,sans-serif" font-size="14" font-weight="900" fill="#FFFFFF">₹ 2,500</text>
                
                <!-- Receipt Paper Coming out -->
                <path d="M152 70 L152 45 L158 50 L164 45 L170 50 L176 45 L182 50 L188 45 L194 50 L200 45 L206 50 L212 45 L218 50 L224 45 L230 50 L236 45 L242 50 L248 45 L248 70 Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1" />
                <line x1="162" y1="58" x2="238" y2="58" stroke="#94A3B8" stroke-width="2" stroke-dasharray="4,2" />

                <!-- Keypad Grid -->
                ${[0, 1].map(r => [0, 1, 2].map(c => `
                    <circle cx="${166 + c * 34}" cy="${188 + r * 18}" r="7" fill="#475569" />
                `).join('')).join('')}
                <!-- Green Enter Key -->
                <circle cx="234" cy="206" r="7" fill="#10B981" />
            </g>
            <defs>
                <linearGradient id="posGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#334155" />
                    <stop offset="100%" stop-color="#0F172A" />
                </linearGradient>
            </defs>
        `
    },
    'education-fees': {
        bg: '#E0E7FF',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Stack of Books -->
            <g filter="url(#studioShadow)">
                <!-- Bottom Book (Navy) -->
                <path d="M120 215 L280 215 L270 240 L130 240 Z" fill="#1E3A8A" />
                <rect x="135" y="222" width="130" height="15" fill="#F8FAFC" />
                
                <!-- Middle Book (Crimson) -->
                <path d="M130 190 L270 190 L260 215 L140 215 Z" fill="#991B1B" />
                <rect x="145" y="197" width="110" height="15" fill="#F8FAFC" />
            </g>

            <!-- Graduation Cap (Mortarboard) -->
            <g filter="url(#studioShadow)">
                <!-- Cap Skull Skullcap -->
                <path d="M160 155 Q 200 175 240 155 V 175 Q 200 195 160 175 Z" fill="#0F172A" />
                
                <!-- Top Rhombus Diamond -->
                <path d="M200 95 L295 135 L200 170 L105 135 Z" fill="url(#capGrad)" stroke="#38BDF8" stroke-width="1.5" />
                
                <!-- Center Button -->
                <circle cx="200" cy="133" r="6" fill="#F59E0B" />
                <!-- Gold Tassel -->
                <path d="M200 133 C230 135 245 155 250 185" fill="none" stroke="#F59E0B" stroke-width="3" stroke-linecap="round" />
                <rect x="246" y="185" width="8" height="20" rx="3" fill="#D97706" />
            </g>
            <defs>
                <linearGradient id="capGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#1E293B" />
                    <stop offset="50%" stop-color="#0F172A" />
                    <stop offset="100%" stop-color="#0284C7" />
                </linearGradient>
            </defs>
        `
    },
    'cable-tv': {
        bg: '#FCE7F3',
        content: `
            <ellipse cx="200" cy="255" rx="110" ry="22" fill="url(#floorShadow)" />
            <!-- TV Screen Frame -->
            <g filter="url(#studioShadow)">
                <rect x="110" y="70" width="180" height="120" rx="14" fill="#0F172A" stroke="#334155" stroke-width="3" />
                <rect x="116" y="76" width="168" height="108" rx="10" fill="url(#tvScreenGrad)" />
                <!-- Stand -->
                <path d="M185 190 H215 L225 220 H175 Z" fill="#475569" />
                <ellipse cx="200" cy="220" rx="35" ry="8" fill="#334155" />
            </g>

            <!-- 3D Gold Coaxial Cable in Foreground -->
            <g filter="url(#studioShadow)">
                <path d="M85 245 C120 220 150 250 180 230" fill="none" stroke="#1E293B" stroke-width="12" stroke-linecap="round" />
                <!-- Gold Coax Connector Plug -->
                <rect x="175" y="222" width="28" height="16" rx="3" fill="url(#goldCoax)" />
                <!-- Knurling ridges -->
                <line x1="182" y1="222" x2="182" y2="238" stroke="#78350F" stroke-width="1.5" />
                <line x1="188" y1="222" x2="188" y2="238" stroke="#78350F" stroke-width="1.5" />
                <line x1="194" y1="222" x2="194" y2="238" stroke="#78350F" stroke-width="1.5" />
                <!-- Pin -->
                <rect x="203" y="228" width="8" height="4" rx="1" fill="#FEF08A" />
            </g>
            <defs>
                <linearGradient id="tvScreenGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#EC4899" />
                    <stop offset="50%" stop-color="#8B5CF6" />
                    <stop offset="100%" stop-color="#3B82F6" />
                </linearGradient>
                <linearGradient id="goldCoax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#FEF08A" />
                    <stop offset="50%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#B45309" />
                </linearGradient>
            </defs>
        `
    },
    'insurance': {
        bg: '#E0E7FF',
        content: `
            <ellipse cx="200" cy="255" rx="110" ry="22" fill="url(#floorShadow)" />
            <!-- Security Vault Shield -->
            <g filter="url(#studioShadow)">
                <path d="M200 65 L275 95 C275 165 240 215 200 240 C160 215 125 165 125 95 Z" fill="url(#insurShieldGrad)" stroke="#4338CA" stroke-width="4" />
                <path d="M200 80 L260 105 C260 160 230 200 200 220 C170 200 140 160 140 105 Z" fill="url(#shieldInnerGrad)" />
                
                <!-- Gold Key in Center -->
                <circle cx="200" cy="130" r="16" fill="url(#insurKeyGrad)" />
                <circle cx="200" cy="130" r="8" fill="#312E81" />
                <rect x="196" y="146" width="8" height="38" rx="3" fill="url(#insurKeyGrad)" />
                <rect x="204" y="165" width="10" height="5" rx="1" fill="url(#insurKeyGrad)" />
                <rect x="204" y="176" width="12" height="5" rx="1" fill="url(#insurKeyGrad)" />
            </g>
            <defs>
                <linearGradient id="insurShieldGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#6366F1" />
                    <stop offset="100%" stop-color="#312E81" />
                </linearGradient>
                <linearGradient id="shieldInnerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#818CF8" />
                    <stop offset="100%" stop-color="#4F46E5" />
                </linearGradient>
                <linearGradient id="insurKeyGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#FDE047" />
                    <stop offset="50%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#B45309" />
                </linearGradient>
            </defs>
        `
    },
    'hospital': {
        bg: '#FFE4E6',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Modern Hospital Building -->
            <g filter="url(#studioShadow)">
                <!-- Main Block -->
                <rect x="130" y="80" width="140" height="160" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" />
                
                <!-- Windows Grid -->
                ${[0, 1, 2, 3].map(r => [0, 1, 2].map(c => `
                    <rect x="${148 + c * 38}" y="${105 + r * 28}" width="24" height="18" rx="4" fill="#38BDF8" opacity="0.8" />
                `).join('')).join('')}
                
                <!-- Entrance Doors -->
                <rect x="180" y="200" width="40" height="40" rx="4" fill="#0284C7" />
                <line x1="200" y1="200" x2="200" y2="240" stroke="#FFFFFF" stroke-width="2" />

                <!-- Red Cross Emblem on Top -->
                <circle cx="200" cy="70" r="22" fill="#E11D48" stroke="#FFFFFF" stroke-width="3" />
                <rect x="194" y="56" width="12" height="28" rx="3" fill="#FFFFFF" />
                <rect x="186" y="64" width="28" height="12" rx="3" fill="#FFFFFF" />
            </g>
        `
    },
    'municipal-services': {
        bg: '#F1F5F9',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Municipal City Hall Building -->
            <g filter="url(#studioShadow)">
                <!-- Classical Pediment Triangle -->
                <polygon points="200,60 110,105 290,105" fill="#334155" />
                <polygon points="200,68 125,103 275,103" fill="#64748B" />
                
                <!-- Entablature -->
                <rect x="115" y="105" width="170" height="14" fill="#475569" />
                
                <!-- Marble Pillars -->
                ${[0, 1, 2, 3].map(i => `
                    <rect x="${132 + i * 40}" y="119" width="18" height="95" rx="3" fill="url(#pillarGrad)" />
                `).join('')}

                <!-- Base Steps -->
                <rect x="110" y="214" width="180" height="12" rx="2" fill="#334155" />
                <rect x="95" y="226" width="210" height="14" rx="3" fill="#1E293B" />

                <!-- Official Gold Seal Stamp in Foreground -->
                <circle cx="200" cy="180" r="30" fill="url(#goldSealGrad)" stroke="#B45309" stroke-width="2" />
                <circle cx="200" cy="180" r="24" fill="none" stroke="#FEF08A" stroke-width="2" stroke-dasharray="3,2" />
                <text x="187" y="188" font-family="Inter,sans-serif" font-weight="900" font-size="22" fill="#78350F">GOV</text>
            </g>
            <defs>
                <linearGradient id="pillarGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#94A3B8" />
                    <stop offset="50%" stop-color="#F8FAFC" />
                    <stop offset="100%" stop-color="#64748B" />
                </linearGradient>
                <linearGradient id="goldSealGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#FDE047" />
                    <stop offset="50%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#B45309" />
                </linearGradient>
            </defs>
        `
    },
    'subscription': {
        bg: '#F3E8FF',
        content: `
            <ellipse cx="200" cy="255" rx="110" ry="22" fill="url(#floorShadow)" />
            <!-- Desk Calendar -->
            <g filter="url(#studioShadow)">
                <rect x="120" y="80" width="160" height="150" rx="18" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" />
                <!-- Calendar Top Header -->
                <rect x="120" y="80" width="160" height="42" rx="18" fill="url(#calHeadGrad)" />
                <rect x="120" y="105" width="160" height="17" fill="url(#calHeadGrad)" />
                
                <!-- Binder Rings -->
                <rect x="150" y="70" width="10" height="22" rx="5" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5" />
                <rect x="200" y="70" width="10" height="22" rx="5" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5" />
                <rect x="240" y="70" width="10" height="22" rx="5" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5" />

                <!-- Date -->
                <text x="175" y="175" font-family="Inter,sans-serif" font-weight="900" font-size="44" fill="#1E1B4B">30</text>
                <text x="172" y="205" font-family="Inter,sans-serif" font-weight="800" font-size="12" fill="#7C3AED">DAYS CYCLE</text>

                <!-- Recurring Arrows Circular Badge -->
                <circle cx="245" cy="195" r="24" fill="#9333EA" stroke="#FFFFFF" stroke-width="3" />
                <path d="M235 195 A 10 10 0 1 1 255 195" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" />
                <polygon points="255,190 260,197 252,197" fill="#FFFFFF" />
            </g>
            <defs>
                <linearGradient id="calHeadGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#9333EA" />
                    <stop offset="100%" stop-color="#6366F1" />
                </linearGradient>
            </defs>
        `
    },
    'hospital-pathology': {
        bg: '#FCE7F3',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Microscope -->
            <g filter="url(#studioShadow)">
                <!-- Base -->
                <ellipse cx="160" cy="235" rx="45" ry="14" fill="#334155" />
                <!-- Arm -->
                <path d="M160 230 C220 230 220 120 160 120" fill="none" stroke="#0284C7" stroke-width="20" stroke-linecap="round" />
                
                <!-- Eyepiece Tube -->
                <rect x="125" y="70" width="16" height="55" rx="3" fill="url(#chromeMetal)" transform="rotate(-25 135 90)" />
                <rect x="110" y="65" width="24" height="12" rx="3" fill="#0F172A" transform="rotate(-25 120 70)" />
                
                <!-- Objective Lens -->
                <rect x="145" y="150" width="12" height="28" rx="2" fill="url(#chromeMetal)" />
                <!-- Stage -->
                <rect x="120" y="180" width="60" height="8" rx="2" fill="#0F172A" />
            </g>

            <!-- Test Tubes with Serum in Foreground -->
            <g filter="url(#studioShadow)">
                <!-- Test Tube 1 (Red Serum) -->
                <rect x="230" y="130" width="18" height="95" rx="9" fill="url(#glassGrad)" stroke="#CBD5E1" stroke-width="1.5" />
                <rect x="232" y="170" width="14" height="52" rx="7" fill="#E11D48" opacity="0.85" />
                <line x1="230" y1="135" x2="248" y2="135" stroke="#E2E8F0" stroke-width="3" />

                <!-- Test Tube 2 (Blue Serum) -->
                <rect x="255" y="115" width="18" height="110" rx="9" fill="url(#glassGrad)" stroke="#CBD5E1" stroke-width="1.5" />
                <rect x="257" y="165" width="14" height="57" rx="7" fill="#0284C7" opacity="0.85" />
                <line x1="255" y1="120" x2="273" y2="120" stroke="#E2E8F0" stroke-width="3" />
            </g>
            <defs>
                <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.6" />
                    <stop offset="30%" stop-color="#BAE6FD" stop-opacity="0.2" />
                    <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.7" />
                </linearGradient>
            </defs>
        `
    },
    'clubs-associations': {
        bg: '#DBEAFE',
        content: `
            <ellipse cx="200" cy="255" rx="110" ry="22" fill="url(#floorShadow)" />
            <!-- Royal Club Crest & Medallion -->
            <g filter="url(#studioShadow)">
                <!-- Laurel Wreath -->
                <path d="M125 150 C125 210 160 230 200 230 C240 230 275 210 275 150" fill="none" stroke="#F59E0B" stroke-width="8" stroke-dasharray="14,8" stroke-linecap="round" />
                
                <!-- Central Golden Badge Shield -->
                <path d="M200 75 L255 105 C255 160 225 195 200 210 C175 195 145 160 145 105 Z" fill="url(#goldGrad)" stroke="#FEF08A" stroke-width="2" />
                <path d="M200 88 L243 112 C243 155 220 183 200 196 C180 183 157 155 157 112 Z" fill="#1E3A8A" />
                
                <!-- Crossed Golf Clubs / Swords in Crest -->
                <line x1="175" y1="120" x2="225" y2="170" stroke="#F59E0B" stroke-width="4" stroke-linecap="round" />
                <line x1="225" y1="120" x2="175" y2="170" stroke="#F59E0B" stroke-width="4" stroke-linecap="round" />
                <!-- Star in Center -->
                <polygon points="200,130 204,142 216,142 206,150 210,162 200,154 190,162 194,150 184,142 196,142" fill="#FEF08A" />

                <!-- VIP Club Ribbon -->
                <path d="M140 210 L200 200 L260 210 L250 230 L200 220 L150 230 Z" fill="#DC2626" />
                <text x="188" y="218" font-family="Inter,sans-serif" font-weight="900" font-size="10" fill="#FFFFFF">VIP</text>
            </g>
        `
    },
    'credit-card': {
        bg: '#FEF3C7',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Luxury Titanium Credit Card (Dynamic Angle) -->
            <g filter="url(#studioShadow)" transform="rotate(-8 200 155)">
                <rect x="95" y="80" width="210" height="135" rx="18" fill="url(#cardBodyGrad)" stroke="url(#goldBorder)" stroke-width="2" />
                
                <!-- EMV Gold Smart Chip -->
                <rect x="130" y="120" width="34" height="26" rx="6" fill="url(#goldChip)" stroke="#B45309" stroke-width="1" />
                <line x1="130" y1="133" x2="164" y2="133" stroke="#78350F" stroke-width="1" />
                <line x1="147" y1="120" x2="147" y2="146" stroke="#78350F" stroke-width="1" />

                <!-- Contactless Waves -->
                <path d="M180 125 A 10 10 0 0 1 180 141" fill="none" stroke="#E2E8F0" stroke-width="2" stroke-linecap="round" />
                <path d="M185 120 A 16 16 0 0 1 185 146" fill="none" stroke="#E2E8F0" stroke-width="2" stroke-linecap="round" />

                <!-- Card Numbers Embossed -->
                <text x="130" y="178" font-family="Inter,monospace" font-weight="800" font-size="14" fill="#F8FAFC" letter-spacing="3">•••• 8842</text>
                
                <!-- Cardholder & Hologram -->
                <text x="130" y="196" font-family="Inter,sans-serif" font-weight="700" font-size="9" fill="#94A3B8">PLATINUM MEMBER</text>
                <circle cx="270" cy="180" r="14" fill="#EF4444" opacity="0.85" />
                <circle cx="282" cy="180" r="14" fill="#F59E0B" opacity="0.85" />
            </g>
            <defs>
                <linearGradient id="cardBodyGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#1E293B" />
                    <stop offset="60%" stop-color="#0F172A" />
                    <stop offset="100%" stop-color="#020617" />
                </linearGradient>
                <linearGradient id="goldBorder" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#FDE047" />
                    <stop offset="50%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#78350F" />
                </linearGradient>
                <linearGradient id="goldChip" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#FEF08A" />
                    <stop offset="100%" stop-color="#D97706" />
                </linearGradient>
            </defs>
        `
    },
    'symmetric-deposit-plan': {
        bg: '#D1FAE5',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Ceramic Piggy Bank -->
            <g filter="url(#studioShadow)">
                <ellipse cx="190" cy="165" rx="65" ry="50" fill="url(#piggyGrad)" />
                <!-- Piggy Snout -->
                <ellipse cx="130" cy="170" rx="16" ry="22" fill="#34D399" />
                <ellipse cx="130" cy="170" rx="14" ry="19" fill="#059669" />
                <circle cx="127" cy="166" r="3" fill="#064E3B" />
                <circle cx="127" cy="176" r="3" fill="#064E3B" />

                <!-- Ears -->
                <polygon points="170,120 185,90 195,120" fill="#34D399" />
                
                <!-- Eye -->
                <circle cx="155" cy="145" r="4" fill="#0F172A" />
                <circle cx="154" cy="144" r="1.5" fill="#FFFFFF" />

                <!-- Coin Slot on Top -->
                <rect x="180" y="112" width="28" height="6" rx="3" fill="#064E3B" />
                
                <!-- Falling Gold Coin into Slot -->
                <g transform="translate(182, 85)">
                    <ellipse cx="12" cy="10" rx="14" ry="7" fill="#B45309" />
                    <rect x="0" y="4" width="24" height="6" fill="#F59E0B" />
                    <ellipse cx="12" cy="4" rx="14" ry="7" fill="#FDE047" stroke="#F59E0B" stroke-width="1" />
                </g>
            </g>

            <!-- Growth Bar Chart on side -->
            <g filter="url(#studioShadow)">
                <rect x="250" y="190" width="12" height="30" rx="3" fill="#10B981" />
                <rect x="266" y="170" width="12" height="50" rx="3" fill="#059669" />
                <rect x="282" y="145" width="12" height="75" rx="3" fill="#047857" />
            </g>
            <defs>
                <linearGradient id="piggyGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#6EE7B7" />
                    <stop offset="60%" stop-color="#10B981" />
                    <stop offset="100%" stop-color="#047857" />
                </linearGradient>
            </defs>
        `
    },
    'datacard': {
        bg: '#CFFAFE',
        content: `
            <ellipse cx="200" cy="255" rx="110" ry="22" fill="url(#floorShadow)" />
            <!-- 4G USB Dongle / Hotspot Device -->
            <g filter="url(#studioShadow)">
                <!-- USB Dongle Body -->
                <rect x="155" y="100" width="90" height="135" rx="20" fill="url(#dongleGrad)" stroke="#0284C7" stroke-width="2" />
                
                <!-- USB Connector Cap at bottom -->
                <rect x="185" y="235" width="30" height="15" rx="2" fill="url(#chromeMetal)" stroke="#64748B" stroke-width="1" />
                
                <!-- LED Indicator Lights -->
                <circle cx="200" cy="130" r="6" fill="#22C55E" filter="url(#softGlow)" />
                <circle cx="200" cy="148" r="4" fill="#38BDF8" />
                
                <!-- 4G LTE Label -->
                <text x="182" y="185" font-family="Inter,sans-serif" font-weight="900" font-size="18" fill="#FFFFFF">4G</text>
                <text x="187" y="198" font-family="Inter,sans-serif" font-weight="700" font-size="9" fill="#38BDF8">LTE</text>

                <!-- Radiating Wi-Fi Signals Above -->
                <path d="M175 80 A 30 30 0 0 1 225 80" fill="none" stroke="#0284C7" stroke-width="3" stroke-linecap="round" />
                <path d="M165 65 A 45 45 0 0 1 235 65" fill="none" stroke="#0284C7" stroke-width="3.5" stroke-linecap="round" />
                <path d="M155 50 A 60 60 0 0 1 245 50" fill="none" stroke="#38BDF8" stroke-width="4" stroke-linecap="round" filter="url(#softGlow)" />
            </g>
            <defs>
                <linearGradient id="dongleGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#0369A1" />
                    <stop offset="100%" stop-color="#082F49" />
                </linearGradient>
            </defs>
        `
    },
    'metro': {
        bg: '#E0F2FE',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Elevated Metro Rail Track -->
            <path d="M120 220 L280 220 L300 245 L100 245 Z" fill="#64748B" />
            <line x1="140" y1="232" x2="260" y2="232" stroke="#CBD5E1" stroke-width="4" />

            <!-- Aerodynamic Bullet Metro Train Front -->
            <g filter="url(#studioShadow)">
                <!-- Train Nose -->
                <path d="M140 130 C140 85 180 75 200 75 C220 75 260 85 260 130 L255 210 H145 Z" fill="url(#metroTrainGrad)" stroke="#0284C7" stroke-width="2.5" />
                
                <!-- Windshield Cockpit Glass -->
                <path d="M155 115 C155 95 180 88 200 88 C220 88 245 95 245 115 L240 145 H160 Z" fill="url(#metroWindshield)" stroke="#0369A1" stroke-width="2" />
                <!-- Glass Glare Reflection -->
                <path d="M165 105 L215 105 L195 140 L165 140 Z" fill="#FFFFFF" opacity="0.3" />

                <!-- Blue Racing Stripe -->
                <path d="M143 165 H257 V182 H143 Z" fill="#2563EB" />

                <!-- Headlights -->
                <ellipse cx="165" cy="195" rx="10" ry="7" fill="#FEF08A" filter="url(#softGlow)" />
                <ellipse cx="235" cy="195" rx="10" ry="7" fill="#FEF08A" filter="url(#softGlow)" />
                <!-- Metro Logo Badge -->
                <circle cx="200" cy="173" r="6" fill="#FFFFFF" />
            </g>
            <defs>
                <linearGradient id="metroTrainGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#E2E8F0" />
                    <stop offset="50%" stop-color="#FFFFFF" />
                    <stop offset="100%" stop-color="#CBD5E1" />
                </linearGradient>
                <linearGradient id="metroWindshield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#0F172A" />
                    <stop offset="100%" stop-color="#0284C7" />
                </linearGradient>
            </defs>
        `
    },
    'rental': {
        bg: '#EDE9FE',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Modern Architecture House -->
            <g filter="url(#studioShadow)">
                <!-- House Main Walls -->
                <polygon points="200,75 120,135 120,230 280,230 280,135" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" />
                <!-- Slanted Roof -->
                <polygon points="200,65 110,135 125,142 200,82 275,142 290,135" fill="url(#roofGrad)" />

                <!-- Front Door (Indigo) -->
                <rect x="180" y="165" width="40" height="65" rx="4" fill="#4F46E5" />
                <circle cx="212" cy="198" r="3" fill="#F59E0B" />

                <!-- Windows -->
                <rect x="135" y="150" width="30" height="30" rx="4" fill="#38BDF8" opacity="0.8" />
                <line x1="150" y1="150" x2="150" y2="180" stroke="#FFFFFF" stroke-width="2" />
                <line x1="135" y1="165" x2="165" y2="165" stroke="#FFFFFF" stroke-width="2" />
                
                <rect x="235" y="150" width="30" height="30" rx="4" fill="#38BDF8" opacity="0.8" />
                <line x1="250" y1="150" x2="250" y2="180" stroke="#FFFFFF" stroke-width="2" />
                <line x1="235" y1="165" x2="265" y2="165" stroke="#FFFFFF" stroke-width="2" />
            </g>

            <!-- House Keys in Foreground -->
            <g filter="url(#studioShadow)">
                <circle cx="250" cy="215" r="14" fill="none" stroke="#F59E0B" stroke-width="3" />
                <rect x="250" y="212" width="40" height="7" rx="2" fill="url(#goldGrad)" transform="rotate(30 250 215)" />
                <rect x="275" y="228" width="6" height="6" fill="#D97706" />
                <rect x="284" y="233" width="6" height="8" fill="#D97706" />
            </g>
            <defs>
                <linearGradient id="roofGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#7C3AED" />
                    <stop offset="100%" stop-color="#4C1D95" />
                </linearGradient>
            </defs>
        `
    },
    'recurring-deposit': {
        bg: '#E0E7FF',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Bank Building / Safe -->
            <g filter="url(#studioShadow)">
                <rect x="100" y="90" width="200" height="140" rx="16" fill="url(#rdBankGrad)" stroke="#4338CA" stroke-width="2" />
                <!-- Pillars -->
                ${[0, 1, 2, 3].map(i => `
                    <rect x="${120 + i * 45}" y="105" width="20" height="110" rx="3" fill="#E0E7FF" opacity="0.9" />
                `).join('')}

                <!-- Passbook / Deposit Ledger in Center -->
                <rect x="160" y="125" width="80" height="95" rx="8" fill="#1E3A8A" stroke="#F59E0B" stroke-width="2" />
                <text x="175" y="150" font-family="Inter,sans-serif" font-weight="900" font-size="12" fill="#FEF08A">RD</text>
                <text x="172" y="165" font-family="Inter,sans-serif" font-weight="700" font-size="9" fill="#93C5FD">PASSBOOK</text>
                <line x1="170" y1="175" x2="230" y2="175" stroke="#60A5FA" stroke-width="1.5" />
                <line x1="170" y1="185" x2="220" y2="185" stroke="#60A5FA" stroke-width="1.5" />
                <line x1="170" y1="195" x2="225" y2="195" stroke="#60A5FA" stroke-width="1.5" />
            </g>

            <!-- Ascending Rupee Coins on the right -->
            <g filter="url(#studioShadow)">
                ${[0, 1, 2].map(i => `
                    <ellipse cx="${240 + i * 16}" cy="${225 - i * 14}" rx="18" ry="7" fill="#B45309" />
                    <rect x="${222 + i * 16}" y="${220 - i * 14}" width="36" height="5" fill="#F59E0B" />
                    <ellipse cx="${240 + i * 16}" cy="${220 - i * 14}" rx="18" ry="7" fill="#FDE047" stroke="#F59E0B" stroke-width="1" />
                `).join('')}
            </g>
            <defs>
                <linearGradient id="rdBankGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4F46E5" />
                    <stop offset="100%" stop-color="#1E1B4B" />
                </linearGradient>
            </defs>
        `
    },
    'b2b': {
        bg: '#E2E8F0',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Executive Leather Briefcase -->
            <g filter="url(#studioShadow)">
                <!-- Briefcase Body -->
                <rect x="110" y="105" width="180" height="130" rx="16" fill="url(#leatherGrad)" stroke="#0F172A" stroke-width="3" />
                
                <!-- Front Flap Line -->
                <path d="M110 145 H290" stroke="#0F172A" stroke-width="3" />
                
                <!-- Brass Locks -->
                <rect x="145" y="140" width="16" height="18" rx="3" fill="url(#goldGrad)" />
                <rect x="239" y="140" width="16" height="18" rx="3" fill="url(#goldGrad)" />

                <!-- Handle on Top -->
                <path d="M175 105 V85 C175 80 180 75 185 75 H215 C220 75 225 80 225 85 V105" fill="none" stroke="#1E293B" stroke-width="8" stroke-linecap="round" />
            </g>

            <!-- Tax Invoice Document & Pen leaning out -->
            <g filter="url(#studioShadow)" transform="rotate(-6 200 130)">
                <rect x="180" y="60" width="70" height="95" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" />
                <rect x="190" y="72" width="30" height="5" rx="2" fill="#2563EB" />
                <line x1="190" y1="86" x2="240" y2="86" stroke="#94A3B8" stroke-width="2" />
                <line x1="190" y1="96" x2="235" y2="96" stroke="#94A3B8" stroke-width="2" />
                <line x1="190" y1="106" x2="225" y2="106" stroke="#94A3B8" stroke-width="2" />
                <!-- Gold Stamp -->
                <circle cx="230" cy="130" r="10" fill="#10B981" />
                <path d="M226 130 L229 133 L235 127" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
            </g>
            <defs>
                <linearGradient id="leatherGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#475569" />
                    <stop offset="60%" stop-color="#334155" />
                    <stop offset="100%" stop-color="#0F172A" />
                </linearGradient>
            </defs>
        `
    },
    'ncmc-recharge': {
        bg: '#CFFAFE',
        content: `
            <ellipse cx="200" cy="255" rx="110" ry="22" fill="url(#floorShadow)" />
            <!-- NCMC Contactless Card Tapping on Gate -->
            <g filter="url(#studioShadow)">
                <!-- Metro Gate Reader Surface -->
                <ellipse cx="200" cy="210" rx="75" ry="32" fill="#0F172A" stroke="#0284C7" stroke-width="3" />
                <!-- Glowing Scanner Target -->
                <ellipse cx="200" cy="210" rx="55" ry="22" fill="none" stroke="#38BDF8" stroke-width="3" filter="url(#softGlow)" />
                <circle cx="200" cy="210" r="10" fill="#38BDF8" />

                <!-- Floating Smart Transit Card -->
                <g transform="translate(130, 80) rotate(-14 65 45)">
                    <rect x="0" y="0" width="130" height="85" rx="12" fill="url(#ncmcCardGrad)" stroke="#38BDF8" stroke-width="2" />
                    <text x="14" y="24" font-family="Inter,sans-serif" font-weight="900" font-size="11" fill="#FFFFFF">NCMC</text>
                    <text x="14" y="36" font-family="Inter,sans-serif" font-weight="700" font-size="7" fill="#BAE6FD">ONE NATION ONE CARD</text>
                    
                    <!-- RuPay / Chip -->
                    <rect x="14" y="44" width="20" height="15" rx="3" fill="url(#goldChip)" />
                    <!-- NFC Wave -->
                    <path d="M105 20 A 8 8 0 0 1 105 32" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
                    <path d="M110 16 A 14 14 0 0 1 110 36" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
                </g>
            </g>
            <defs>
                <linearGradient id="ncmcCardGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#0284C7" />
                    <stop offset="100%" stop-color="#0369A1" />
                </linearGradient>
            </defs>
        `
    },
    'donation': {
        bg: '#FFEDD5',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Glowing Golden Giving Heart Supported by Hands -->
            <g filter="url(#softGlow)">
                <!-- Heart -->
                <path d="M200 135 C200 115 180 95 160 95 C135 95 115 118 115 142 C115 178 175 210 200 225 C225 210 285 178 285 142 C285 118 265 95 240 95 C220 95 200 115 200 135 Z" fill="url(#donationHeartGrad)" />
                <path d="M140 120 C130 130 130 148 140 160" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.75" />
            </g>

            <!-- Hands Caring Cradle Base -->
            <g filter="url(#studioShadow)">
                <path d="M110 220 C140 210 165 225 200 240 C235 225 260 210 290 220 C270 245 235 255 200 255 C165 255 130 245 110 220 Z" fill="url(#handsGrad)" />
            </g>
            <defs>
                <radialGradient id="donationHeartGrad" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="#FDE047" />
                    <stop offset="35%" stop-color="#F97316" />
                    <stop offset="80%" stop-color="#EA580C" />
                    <stop offset="100%" stop-color="#C2410C" />
                </radialGradient>
                <linearGradient id="handsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#FDBA74" />
                    <stop offset="100%" stop-color="#EA580C" />
                </linearGradient>
            </defs>
        `
    },
    'metro-recharge': {
        bg: '#E0F2FE',
        content: `
            <ellipse cx="200" cy="255" rx="115" ry="24" fill="url(#floorShadow)" />
            <!-- Commuter Metro Card & Turnstile -->
            <g filter="url(#studioShadow)">
                <rect x="110" y="80" width="180" height="115" rx="18" fill="url(#metroCardGrad)" stroke="#38BDF8" stroke-width="2.5" />
                <!-- Metro Train Silhouette on Card -->
                <path d="M140 145 H260 L245 115 H155 Z" fill="#FFFFFF" opacity="0.25" />
                
                <text x="135" y="112" font-family="Inter,sans-serif" font-weight="900" font-size="14" fill="#FFFFFF">METRO TRAVEL</text>
                <text x="135" y="126" font-family="Inter,sans-serif" font-weight="700" font-size="9" fill="#7DD3FC">SMART RECHARGE</text>

                <!-- Battery / Balance Top-Up Indicator -->
                <rect x="135" y="145" width="65" height="24" rx="6" fill="#0C4A6E" />
                <rect x="138" y="148" width="40" height="18" rx="4" fill="#22C55E" />
                <text x="208" y="162" font-family="Inter,sans-serif" font-weight="900" font-size="11" fill="#22C55E">100%</text>

                <!-- Lightning Fast Indicator -->
                <polygon points="260,135 250,150 258,150 252,165 268,148 260,148" fill="#FDE047" filter="url(#softGlow)" />
            </g>
            <defs>
                <linearGradient id="metroCardGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#0284C7" />
                    <stop offset="100%" stop-color="#0F172A" />
                </linearGradient>
            </defs>
        `
    }
};

let count = 0;
for (const [id, config] of Object.entries(ICONS)) {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 300" width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="300" rx="20" fill="${config.bg}" />
    <defs>
        ${defsPreamble}
    </defs>
    ${config.content}
</svg>`;

    const publicPath = path.join(publicDir, `${id}.svg`);
    const assetsPath = path.join(assetsDir, `${id}.svg`);

    fs.writeFileSync(publicPath, svg, 'utf8');
    fs.writeFileSync(assetsPath, svg, 'utf8');
    count++;
}

console.log(`Successfully generated ${count} realistic 3D SVG service illustrations.`);
