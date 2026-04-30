#!/usr/bin/env node
// fix-mojibake.mjs
// -----------------------------------------------------------------------------
// Rewrites files where UTF-8 emoji were previously saved as Latin-1 and then
// re-saved as UTF-8 (aka "double-encoded"/mojibake).
//
// We programmatically derive the mojibake form of each emoji by round-tripping
// its real UTF-8 bytes through Latin-1. That way we never have to type the
// garbled sequence ourselves (which is fragile — editors often re-encode it).
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// All emoji the codebase currently uses. Order doesn't matter: we replace
// longer (3+ codepoint) emoji first so that trailing joiner bytes can't be
// stolen by a shorter emoji's mojibake prefix.
const EMOJI = [
    // 3+ codepoint (joiners / variation selectors)
    '🛠️', '🛍️', '🏛️',
    // 4-byte UTF-8 (most common)
    '📧', '🚀', '🔒', '🏦', '💸', '📲', '🔗', '🔄', '📊', '📭',
    '👥', '🪪', '💰', '👑', '🏪', '🛒', '📡', '🟢', '🔴', '✅',
    '❌', '🔥'
];

// Three-byte UTF-8 emoji (fall into BMP) — treat separately so mojibake of
// the 4-byte ones doesn't accidentally swallow them.
const EMOJI_BMP = ['⚡', '⏳'];

const ALL = [...EMOJI, ...EMOJI_BMP];

// Windows-1252 supplement: maps of the bytes 0x80..0x9F that differ from
// ISO-8859-1 to their actual Unicode code points. Bytes outside this range
// map identically in both encodings, so we fall through to the raw byte.
const CP1252 = {
    0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
    0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
    0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
    0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
    0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
    0x9E: 0x017E, 0x9F: 0x0178
};

function bytesToCp1252String(bytes) {
    let out = '';
    for (const byte of bytes) {
        const mapped = CP1252[byte];
        out += String.fromCodePoint(mapped != null ? mapped : byte);
    }
    return out;
}

// Produce both possible mojibake forms (ISO-8859-1 and Windows-1252) so we can
// catch files that were corrupted by either decoder.
function mojibakeVariants(emoji) {
    const bytes = Buffer.from(emoji, 'utf8');
    const latin1 = bytes.toString('latin1');
    const cp1252 = bytesToCp1252String(bytes);
    return latin1 === cp1252 ? [latin1] : [latin1, cp1252];
}

// Sort so longer mojibake sequences are tried first — prevents short ones from
// consuming the start of a longer one.
const PAIRS = [];
for (const e of ALL) {
    for (const v of mojibakeVariants(e)) {
        PAIRS.push([v, e]);
    }
}
// Longest mojibake strings first so we don't let shorter prefixes steal chars.
PAIRS.sort((a, b) => b[0].length - a[0].length);

const targets = process.argv.slice(2);
if (targets.length === 0) {
    console.error('Usage: fix-mojibake.mjs <file> [...]');
    process.exit(2);
}

let totalReplaced = 0;
for (const rel of targets) {
    const path = resolve(process.cwd(), rel);
    if (!existsSync(path)) {
        console.log(`skip (missing): ${rel}`);
        continue;
    }
    let text = readFileSync(path, 'utf8');
    let fileCount = 0;
    for (const [bad, good] of PAIRS) {
        if (text.includes(bad)) {
            const before = text.length;
            const parts = text.split(bad);
            if (parts.length > 1) {
                text = parts.join(good);
                fileCount += parts.length - 1;
            }
            void before;
        }
    }
    if (fileCount > 0) {
        writeFileSync(path, text, 'utf8');
        console.log(`fixed ${fileCount} glyph(s): ${rel}`);
        totalReplaced += fileCount;
    } else {
        console.log(`clean: ${rel}`);
    }
}
console.log(`Done. Total glyph occurrences replaced: ${totalReplaced}`);
