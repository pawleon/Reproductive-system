import { reportError } from './diagnostics.js';
// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

import { carrierMode, canCarry } from './omegaverse.js';
import { extension_settings } from '../../../extensions.js';
import { extensionName, defaultPregnancyData, defaultPartnerData, LANG } from './config.js';

export function getSettings() {
    const s = extension_settings[extensionName];
    if (s) { s.carrierMode = carrierMode(s); if (!['user', 'char', 'both', 'none'].includes(s.trackFor)) s.trackFor = s.carrierMode; s.debugKeepTags = false; }
    return s;
}


function cloneDefault(value) {
    return (value && typeof value === 'object') ? structuredClone(value) : value;
}

function fillMissing(target, defaults) {
    if (!target || typeof target !== 'object') return;
    for (const key in defaults) {
        if (target[key] === undefined) target[key] = cloneDefault(defaults[key]);
    }
}

function legacyBabyFromRoot(p, index, count) {
    const sexList = Array.isArray(p.babySex) ? p.babySex : [];
    return {
        name: index === 0 ? (p.babyName || '') : '',
        sex: sexList[index] || sexList[0] || 'M',
        health: p.babyHealth || 'normal',
        mood: p.babyMood || 'calm',
        sleep: p.babySleep || 'Sleeping',
        diaperClean: p.babyDiaperClean !== false,
        teething: !!p.babyTeething,
        colicky: !!p.babyColicky,
        feedingType: p.babyFeedingType || '',
        milestones: index === 0 && Array.isArray(p.babyMilestones) ? structuredClone(p.babyMilestones) : [],
        personality: [],
        appearance: [],
        birthRpDate: p.babyBirthRpDate || p.rpDate || null,
        age: p.babyAge || 'newborn',
    };
}

// babies[] is the canonical active-child state. Legacy singular fields remain as
// compatibility mirrors for old UI/prompts/saves and are rebuilt from babies[].
export function syncBabyLegacyFields(p = getPregnancyData()) {
    if (!p || typeof p !== 'object') return p;
    if (!Array.isArray(p.babies)) p.babies = [];
    if (!Array.isArray(p.grownChildren)) p.grownChildren = [];

    // Upgrade old saves that only had babyName/babyCount/etc.
    if (p.babies.length === 0 && p.hasBaby) {
        const legacyCount = Math.max(1, parseInt(p.babyCount) || (Array.isArray(p.babySex) ? p.babySex.length : 0) || 1);
        for (let i = 0; i < legacyCount; i++) p.babies.push(legacyBabyFromRoot(p, i, legacyCount));
    }

    p.babies = p.babies.filter(b => b && typeof b === 'object');
    if (p.babies.length === 0) {
        p.hasBaby = false;
        p.babyCount = 0;
        p.babyName = '';
        p.babySex = [];
        p.babyBirthRpDate = null;
        return p;
    }

    p.hasBaby = true;
    p.babyCount = p.babies.length;
    p.babySex = p.babies.map(b => b.sex || '?');
    const primary = p.babies[0];
    p.babyName = primary.name || '';
    p.babyHealth = primary.health || 'normal';
    p.babyMood = primary.mood || '';
    p.babySleep = primary.sleep || '';
    p.babyDiaperClean = primary.diaperClean !== false;
    p.babyTeething = !!primary.teething;
    p.babyColicky = !!primary.colicky;
    p.babyFeedingType = primary.feedingType || '';
    p.babyMilestones = Array.isArray(primary.milestones) ? primary.milestones : [];
    p.babyAge = primary.age || p.babyAge || '';
    p.babyBirthRpDate = primary.birthRpDate || null;
    return p;
}

export function migratePregnancyData(p, s = getSettings()) {
    if (!p || typeof p !== 'object') return p;
    fillMissing(p, defaultPregnancyData);
    if (!p.partner || typeof p.partner !== 'object') p.partner = structuredClone(defaultPartnerData);
    fillMissing(p.partner, defaultPartnerData);
    syncBabyLegacyFields(p);
    return p;
}

export function getContraception(who = 'user') {
    const s = getSettings();
    if (!s) return 'none';
    const legacy = s.contraception || 'none';
    if (s.contraceptionUser === undefined || s.contraceptionUser === null) s.contraceptionUser = legacy;
    if (s.contraceptionChar === undefined || s.contraceptionChar === null) s.contraceptionChar = legacy;
    return who === 'char' ? (s.contraceptionChar || 'none') : (s.contraceptionUser || 'none');
}

// ──────────────────────────────────────────────────────────────────────
// Internal implementation note.
// ──────────────────────────────────────────────────────────────────────
let _cachedChatId = null;

export function resetChatIdCache() {
    _cachedChatId = null;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function computeChatIdForms() {
    const forms = [];
    try {
        const ctx = (typeof SillyTavern?.getContext === 'function')
            ? SillyTavern.getContext()
            : null;
        if (!ctx) return forms;

        const meta = ctx.chatMetadata || ctx.chat_metadata
                  || (typeof window !== 'undefined' ? window.chat_metadata : null);
        if (meta) {
            const integrity = meta.integrity;
            if ((typeof integrity === 'string' && integrity.length > 0) || typeof integrity === 'number') {
                forms.push(`uuid:${String(integrity)}`);
            }
            const fname = meta.file_name || meta.fileName;
            if (typeof fname === 'string' && fname.length > 0) {
                forms.push(`file:${fname}`);
            }
            let hash = meta.chat_id_hash;
            if (hash === undefined || hash === null) hash = meta.chatIdHash;
            if (hash !== undefined && hash !== null && hash !== '') {
                forms.push(`hash:${String(hash)}`);
            }
        }

        const directId = ctx.chatId;
        if ((typeof directId === 'string' && directId.trim().length > 0) || typeof directId === 'number') {
            // Normalize common human-readable form like "Name - 2026-05-28@11h08m17s150ms"
            // by trimming only the high-resolution millisecond suffix.
            let s = String(directId).trim();
            s = s.replace(/\s-\s(\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s)\d*ms$/, ' - $1');
            s = s.replace(/\s@(\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s)\d*ms$/, ' @$1');
            forms.push(s);
        }
    } catch (e) { reportError('[Reproductive] chat-id normalization error:', e); }
    return forms;
}

export function getCurrentChatId() {
    if (_cachedChatId) return _cachedChatId;

    try {
        const forms = computeChatIdForms();
        const resolved = forms.length > 0 ? forms[0] : null;

        if (resolved) {
            _cachedChatId = resolved;
            return resolved;
        }

        return null;
    } catch (e) {
        return null;
    }
}

export function getChat() {
    try {
        const context = typeof SillyTavern?.getContext === 'function'
            ? SillyTavern.getContext()
            : window;
        return context?.chat || [];
    } catch (e) {
        return [];
    }
}

// ──────────────────────────────────────────────────────────────────────
// Internal implementation note.
// Internal implementation note.
// ──────────────────────────────────────────────────────────────────────
let _fallback = null;

function getFallback() {
    if (!_fallback) _fallback = structuredClone(defaultPregnancyData);
    return _fallback;
}

export function resetFallback() {
    _fallback = null;
}

export function getPregnancyData() {
    const s = getSettings();
    const chatId = getCurrentChatId();

    if (!s.chatPregnancyData) {
        s.chatPregnancyData = {};
    }

    // Internal implementation note.
    // Internal implementation note.
    if (!chatId) {
        return getFallback();
    }

    // Internal implementation note.
    if (!s.chatPregnancyData[chatId]) {
        const aliases = computeChatIdForms();
        for (const alt of aliases) {
            if (alt !== chatId && s.chatPregnancyData[alt]) {
                s.chatPregnancyData[chatId] = s.chatPregnancyData[alt];
                delete s.chatPregnancyData[alt];
                break;
            }
        }
    }

    // Internal implementation note.
    if (!s.chatPregnancyData[chatId]) {
        const fresh = structuredClone(defaultPregnancyData);
        // Internal implementation note.
        fresh.cycleDay = 1 + Math.floor(Math.random() * 28);
        fresh.lastCycleUpdate = Date.now();
        fresh.partner = structuredClone(defaultPartnerData);
        fresh.partner.cycleDay = 1 + Math.floor(Math.random() * 28);
        s.chatPregnancyData[chatId] = fresh;
    }

    migratePregnancyData(s.chatPregnancyData[chatId], s);
    return s.chatPregnancyData[chatId];
}

// ──────────────────────────────────────────────────────────────────────
// Internal implementation note.
// Internal implementation note.
// ──────────────────────────────────────────────────────────────────────
export function getPartnerData() {
    const p = getPregnancyData();
    if (!p.partner || typeof p.partner !== 'object') p.partner = structuredClone(defaultPartnerData);
    fillMissing(p.partner, defaultPartnerData);
    return p.partner;
}

// Internal implementation note.
export function getCarrier(who) {
    return who === 'char' ? getPartnerData() : getPregnancyData();
}

// Internal implementation note.
export function getCarriers() {
    const s = getSettings();
    const mode = s?.trackFor || 'user';
    const list = [];
    if (mode === 'user' || mode === 'both') list.push({ who: 'user', data: getPregnancyData() });
    if (mode === 'char' || mode === 'both') list.push({ who: 'char', data: getPartnerData() });

    return list;
}

// Internal implementation note.
export function carrierName(who) {
    try {
        const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : null;
        if (who === 'char') return ctx?.name2 || 'Character';
        return ctx?.name1 || 'User';
    } catch (e) {
        return who === 'char' ? 'Character' : 'User';
    }
}

// Internal implementation note.
export function isTracked(who) { const mode = getSettings()?.trackFor || 'user'; return mode === 'both' || mode === who; }

export function L(key) {
    try {
        const s = getSettings();
        const lang = s?.language || 'en';
        const keys = key.split('.');
        let result = LANG[lang];
        for (const k of keys) {
            result = result?.[k];
        }
        return result || key;
    } catch (e) {
        reportError('[Reproductive] L() error:', key, e);
        return key;
    }
}

// ─── Cycle day accessors (per-chat) ───
export function getCycleDay() {
    const p = getPregnancyData();
    if (typeof p.cycleDay === 'number' && p.cycleDay >= 1 && p.cycleDay <= 28 + Math.max(0, parseInt(p._cycleShift) || 0)) {
        return p.cycleDay;
    }
    const s = getSettings();
    const globalCycle = (typeof s.cycleDay === 'number' && s.cycleDay >= 1 && s.cycleDay <= 28) ? s.cycleDay : 1;
    p.cycleDay = globalCycle;
    if (!p.lastCycleUpdate && s.lastCycleUpdate) p.lastCycleUpdate = s.lastCycleUpdate;
    return p.cycleDay;
}

export function setCycleDay(day, updateTimestamp = true, isUserAction = false) {
    const p = getPregnancyData();
    // Internal implementation note.
    // Internal implementation note.
    const maxDay = 28 + Math.max(0, parseInt(p._cycleShift) || 0);
    const d = Math.max(1, Math.min(maxDay, parseInt(day) || 1));
    p.cycleDay = d;
    if (updateTimestamp) p.lastCycleUpdate = Date.now();
    if (isUserAction) {
        p._dynamic = {};
        // Internal implementation note.
        // Internal implementation note.
        p._userSetCycleAt = Date.now();
    }
    return d;
}

// A stale CYCLE_DAY tag from the regenerated reply cannot override a manual edit.
export function isManualCycleProtected(who = 'user') {
    const c = who === 'char' ? getPartnerData() : getPregnancyData();
    const position = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext().chat?.length || 0 : 0;
    return Number.isInteger(c._manualCyclePosition) && position <= c._manualCyclePosition;
}
