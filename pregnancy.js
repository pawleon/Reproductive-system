// ═══════════════════════════════════════════
// PREGNANCY — conception, complications, birth
// ═══════════════════════════════════════════

import { saveSettingsDebounced } from '../../../../script.js';
import { CHANCES } from './config.js';
import { getSettings, getPregnancyData, getPartnerData, getCycleDay, setCycleDay, isManualCycleProtected, carrierName, L, getContraception, syncBabyLegacyFields } from './state.js';
import { canCarry, hasMenstrualCycle } from './omegaverse.js';
import { rollTest, isObvious, postpartumState, fertileWindow, inheritLooks, conceptionStruggle, missedDays } from './fertility.js';
import { roll, getCycleModifier, formatSexIcons, formatFetusCount, calculateWeeksFromDates, getHealthInfo, rollPlannedComplications } from './helpers.js';
import { calculateConceptionDate } from './date-parser.js';
import { showNotification, showBirthDialog } from './notifications.js';
import { reportError } from './diagnostics.js';

// Forward declarations
let _syncUI = () => {};
let _updatePromptInjection = () => {};
let _renderInfoblock = () => {};
export function setSyncUI(fn) { _syncUI = fn; }
export function setUpdatePromptInjection(fn) { _updatePromptInjection = fn; }
export function setRenderInfoblock(fn) { _renderInfoblock = fn; }

// Internal implementation note.
// Internal implementation note.
function refreshSnap() {
    try {
        import('./message-handler.js').then(m => m.refreshRegenSnapshot && m.refreshRegenSnapshot());
    } catch (e) { reportError('[Reproductive] refresh snapshot error:', e); }
}


function configuredDuration(s) {
    return Math.max(4, parseInt(s?.pregnancyDuration) || 40);
}

function minimumBirthWeeks(s) {
    return Math.ceil(configuredDuration(s) * 0.85);
}

// One gate for every birth path. Automatic births require the full configured term;
// explicit scene births use the 85% plausibility floor, while manual births bypass the gate.
export function canTriggerBirth(carrier, s = getSettings(), source = 'tag') {
    if (!carrier?.isPregnant) return false;
    if (source === 'manual') return true;
    // A date reaching the due date is not a delivery event.
    if (source === 'auto') return false;
    const { weeks } = calculateWeeksFromDates(carrier.conceptionDate, getPregnancyData().rpDate, carrier.pregnancyWeeks);
    return weeks >= minimumBirthWeeks(s);
}

// When RP time jumps past the due date, auto-birth is anchored to the due date,
// not the end of the time-skip. Explicit births use the current RP date.
export function resolveBirthRpDate(carrier, root, s = getSettings(), source = 'tag') {
    const current = root?.rpDate ? new Date(root.rpDate) : null;
    if (source === 'auto' && carrier?.conceptionDate) {
        const conception = new Date(carrier.conceptionDate);
        if (!isNaN(conception.getTime())) {
            const due = new Date(conception.getTime() + configuredDuration(s) * 7 * 86400000);
            if (!current || isNaN(current.getTime()) || current.getTime() >= due.getTime()) return due.toISOString();
        }
    }
    return current && !isNaN(current.getTime()) ? current.toISOString() : new Date().toISOString();
}

export function createUndoCheckpoint(label = 'Change') {
    const p = getPregnancyData();
    const { _history, _undoSnapshot, _turnBaseline, ...current } = p;
    const snapshot = structuredClone(current);
    p._undoSnapshot = { label, createdAt: Date.now(), state: snapshot };
    return p._undoSnapshot;
}

export function undoLastDestructiveChange() {
    const p = getPregnancyData();
    const backup = p?._undoSnapshot;
    if (!backup?.state) return false;
    const restored = structuredClone(backup.state);
    Object.keys(p).forEach(k => delete p[k]);
    Object.assign(p, restored);
    syncBabyLegacyFields(p);
    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    _renderInfoblock();
    return backup.label || true;
}

// Internal implementation note.
export function applyScanResult(result) {
    const s = getSettings();
    const p = getPregnancyData();
    let updated = false;

    // Internal implementation note.
    if (result.rp_date) {
        const newDate = new Date(result.rp_date);
        if (!isNaN(newDate.getTime())) {
            const oldDate = p.rpDate;
            p.rpDate = newDate.toISOString();
            if (oldDate !== p.rpDate) {
                updated = true;

                // Auto-advance cycle day based on RP date difference
                if (oldDate) {
                    const oldTime = new Date(oldDate).getTime();
                    const newTime = newDate.getTime();
                    const daysPassed = Math.floor((newTime - oldTime) / 86400000);
                    if (daysPassed > 0 && !p.isPregnant) {
                        const oldCycleDay = getCycleDay();
                        const newCycleDay = ((oldCycleDay - 1 + daysPassed) % 28) + 1;
                        setCycleDay(newCycleDay);
                    }
                }

                // Pregnancy weeks are calculated strictly from conceptionDate + rpDate
                if (p.isPregnant) {
                    // Backfill conceptionDate if missing — anchor to current rpDate
                    if (!p.conceptionDate) {
                        if (p.pregnancyWeeks > 0) {
                            const cd = calculateConceptionDate(newDate, p.pregnancyWeeks);
                            if (cd) p.conceptionDate = cd.toISOString();
                        } else {
                            p.conceptionDate = newDate.toISOString();
                        }
                    }
                    // Clamp: if rpDate < conceptionDate (RP went backwards) — shift conception back
                    // Internal implementation note.
                    if (p.conceptionDate && new Date(p.conceptionDate).getTime() > newDate.getTime()) {
                        const userSetMs = p._userSetWeeksAt || 0;
                        const recentlyUserSet = userSetMs > 0 && (Date.now() - userSetMs) / 60000 < 30;
                        if (recentlyUserSet) {
                        } else {
                            p.conceptionDate = newDate.toISOString();
                        }
                    }
                    // Sync pregnancyWeeks state from authoritative date math
                    const calc = calculateWeeksFromDates(p.conceptionDate, p.rpDate, p.pregnancyWeeks);
                    if (calc.weeks !== p.pregnancyWeeks) {
                        p.pregnancyWeeks = calc.weeks;
                    }
                }
            }
        }
    }

    // Internal implementation note.
    if (result.cycle_day !== null && result.cycle_day !== undefined && (result._source === 'manual' || !isManualCycleProtected('user'))) {
        const day = parseInt(result.cycle_day);
        const current = getCycleDay();
        if (day >= 1 && day <= 28 && day !== current) {
            setCycleDay(day);
            updated = true;
        }
    }

    // Internal implementation note.
    if (result.miscarriage_occurred || result.abortion_occurred) {
        if (!p.isPregnant) {
            return updated;
        }
        // Internal implementation note.
        try {
            const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : window;
            const chatLen = ctx?.chat?.length || 0;
            if (!s._historyScanInProgress && s._birthBlockedUntilUser && chatLen < s._birthBlockedUntilUser) {
                return updated;
            }
        } catch (e) { reportError('[Reproductive] handled exception:', e); }
        terminatePregnancy(result.abortion_occurred ? 'abortion' : 'miscarriage');
        return true; // Internal implementation note.
    }

    // Internal implementation note.
    if (result.birth_occurred) {
        // Internal implementation note.
        // Internal implementation note.
        if (!p.isPregnant) {
            return updated;
        }
        // Internal implementation note.
        const birthSource = result._birthSource || result._source || 'tag';
        if (!canTriggerBirth(p, s, birthSource)) return updated;
        // Internal implementation note.
        try {
            const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : window;
            const chatLen = ctx?.chat?.length || 0;
            if (!s._historyScanInProgress && s._birthBlockedUntilUser && chatLen < s._birthBlockedUntilUser) {
                return updated;
            }
        } catch (e) { reportError('[Reproductive] handled exception:', e); }

        // Save pregnancy data before resetting
        const babySex = p.fetusSex.length > 0 ? [...p.fetusSex] : ['M'];
        const newBabyCount = p.fetusCount || 1;
        const birthRpDate = resolveBirthRpDate(p, p, s, birthSource);

        // Internal implementation note.
        const existingBabies = Array.isArray(p.babies) ? [...p.babies] : [];
        const newbornStartIdx = existingBabies.length;
        const prevMomState = p.momState;

        // Internal implementation note.
        // Internal implementation note.
        // Internal implementation note.
        p.isPregnant = false;
        p.conceptionDate = null;
        p.pregnancyWeeks = 0;
        p._conceptionAnchored = false;
        p.fetusCount = 1;
        p.fetusSex = [];
        p.fetusSexRevealed = false;
        p.complications = [];
        p._plannedComplications = [];
        p.healthStatus = 'normal';
        p.lastComplicationCheck = null;
        p.lastComplicationCheckRpDate = null;
        p.lastDoctorVisitRpDate = null;
        p.pregnancyKnown = false;
        p.testTakenAt = null;
        p.lastTestResult = null;
        p.missedPeriodDays = 0;
        p.mood = '';
        p.libido = '';
        p.weightGain = '';
        p.babyActivity = '';
        p._dynamic = {};

        // Internal implementation note.
        // Internal implementation note.
        try {
            if (!s._historyScanInProgress) {
                const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : window;
                const chatLen = ctx?.chat?.length || 0;
                s._conceptionBlockedUntilUser = chatLen + 12;
                s._birthBlockedUntilUser = chatLen + 12;
                p._userSetWeeksAt = Date.now(); // Internal implementation note.
            }
        } catch (e) { reportError('[Reproductive] handled exception:', e); }

        // Internal implementation note.
        p.postpartum = { startRpDate: birthRpDate, lactating: true };
        p.pregnancyKnown = false;
        p.lastTestResult = null;
        p.babyHealth = 'normal';
        p.babyMood = 'calm';
        p.babyDiaperClean = true;
        p.babySleep = 'Sleeping';
        // Internal implementation note.
        p.babyAge = 'newborn';
        // Internal implementation note.
        if (prevMomState) p.momState = prevMomState;

        // Internal implementation note.
        const newbornLooks = Array.from({ length: newBabyCount }, () => inheritedLooks(p));
        const birthParentName = carrierName('user');
        p.babies = [...existingBabies];

        // Internal implementation note.
        for (let i = 0; i < newBabyCount; i++) {
            p.babies.push({
                name: '',
                sex: babySex[i] || 'M',
                health: 'normal',
                mood: 'calm',
                sleep: 'Sleeping',
                diaperClean: true,
                teething: false,
                colicky: false,
                feedingType: '',
                milestones: [],
                personality: [],
                // Internal implementation note.
                appearance: newbornLooks[i],
                fatherName: p.fatherName || '',
                motherName: birthParentName,
                bornBy: 'user',
                birthRpDate: birthRpDate,  // Internal implementation note.
                age: 'newborn',
            });
        }
        syncBabyLegacyFields(p);
        saveSettingsDebounced();
        _syncUI();
        _updatePromptInjection();

        // Build baby stubs for dialog — pre-fill from model's BABY_TRAITS if scanner extracted it
        const modelTraits = result.baby_traits && Array.isArray(result.baby_traits.babies)
            ? result.baby_traits.babies : [];
        const dialogBabies = [];
        for (let i = 0; i < newBabyCount; i++) {
            const mt = modelTraits[i] || {};
            dialogBabies.push({
                sex: babySex[i] || 'M',
                name: mt.name || mt.\u0438\u043c\u044f || '',
                fatherName: p._secondParentManual ? p.fatherName : p.fatherName || mt.fatherName || mt.father || mt.\u043e\u0442\u0435\u0446 || '',
                personality: Array.isArray(mt.personality) ? mt.personality
                          : Array.isArray(mt.\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440) ? mt.\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440 : null,
                appearance: mergeBabyAppearance(p.babies[newbornStartIdx + i].appearance, mt.appearance || mt.\u0432\u043d\u0435\u0448\u043d\u043e\u0441\u0442\u044c),
                special: mt.special !== undefined ? mt.special : undefined,
            });
        }

        // Internal implementation note.

        // Show birth dialog for naming + traits (state already transitioned).
        // Full-history recovery runs silent to avoid popping historical birth dialogs.
        const applyNewbornTraits = (names, traitsData) => {
            // Internal implementation note.
            for (let i = 0; i < newBabyCount; i++) {
                const targetIdx = newbornStartIdx + i;
                const baby = p.babies[targetIdx];
                if (!baby) continue;
                if (names[i]) baby.name = names[i];
                const traits = traitsData[i] || {};
                if (Array.isArray(traits.personality) && traits.personality.length) baby.personality = traits.personality;
                if (Array.isArray(traits.appearance) && traits.appearance.length) baby.appearance = traits.appearance;
                if (traits.special) baby.special = traits.special;
                if (traits.fatherName) baby.fatherName = traits.fatherName;
            }
            // Internal implementation note.
            if (p.babies[0]?.name) p.babyName = p.babies[0].name;
            saveSettingsDebounced();
            _syncUI();
            _updatePromptInjection();
            syncBabyLegacyFields(p);
            _renderInfoblock();
        };
        if (result._silent) {
            const names = dialogBabies.map(b => b.name || '');
            const traits = dialogBabies.map(b => ({
                personality: Array.isArray(b.personality) ? b.personality : [],
                appearance: Array.isArray(b.appearance) ? b.appearance : [],
                special: b.special,
                fatherName: b.fatherName,
            }));
            applyNewbornTraits(names, traits);
        } else {
            showBirthDialog(dialogBabies, applyNewbornTraits);
        }
        return true;
    }

    // Internal implementation note.
    if (result.vaginal_ejaculation_occurred && !p.isPregnant) {
        const conceptionResult = checkConception();
        if (conceptionResult) {
            updated = true;
        }
    }

    // Internal implementation note.
    // If we have weeks from API but no conceptionDate, backfill conceptionDate.
    if (result.pregnancy_weeks !== null && result.pregnancy_weeks !== undefined && p.isPregnant) {
        const weeks = parseInt(result.pregnancy_weeks);
        if (weeks > 0 && !p.conceptionDate && p.rpDate) {
            const cd = calculateConceptionDate(new Date(p.rpDate), weeks);
            if (cd) {
                p.conceptionDate = cd.toISOString();
                updated = true;
            }
        }
    }

    // Internal implementation note.
    if (result.fetus_count !== null && result.fetus_count !== undefined && p.isPregnant) {
        const count = parseInt(result.fetus_count);
        if (count >= 1 && count <= 3 && count !== p.fetusCount) {
            p.fetusCount = count;
            while (p.fetusSex.length < count) {
                p.fetusSex.push(roll(2) === 1 ? 'M' : 'F');
            }
            p.fetusSex = p.fetusSex.slice(0, count);
            updated = true;
        }
    }

    // Internal implementation note.
    if (result.health_status && p.isPregnant) {
        const valid = ['normal', 'warning', 'critical'];
        if (valid.includes(result.health_status) && result.health_status !== p.healthStatus) {
            p.healthStatus = result.health_status;
            updated = true;
        }
    }

    // Internal implementation note.
    if (result.complications_detected && result.complications_detected.length > 0 && p.isPregnant) {
        const { weeks } = calculateWeeksFromDates(p.conceptionDate, p.rpDate, p.pregnancyWeeks);
        for (const compType of result.complications_detected) {
            const exists = p.complications.some(c => c.type === compType && !c.resolved);
            if (!exists) {
                p.complications.push({
                    week: weeks,
                    type: compType,
                    severity: 'warning',
                    description: compType,
                    rpDate: p.rpDate,
                    date: new Date().toISOString(),
                    resolved: false,
                });
                updated = true;
                if (s.showNotifications) {
                    showNotification(`<i class="fa-solid fa-triangle-exclamation"></i> Complication: ${compType}`, 'warning');
                }
            }
        }
    }

    // Mood/libido/weight/activity (works for both pregnancy and general)
    if (result.mood && result.mood !== p.mood) { p.mood = result.mood; updated = true; }
    if (result.libido && result.libido !== p.libido) { p.libido = result.libido; updated = true; }
    if (p.isPregnant) {
        if (result.weight_gain && result.weight_gain !== p.weightGain) { p.weightGain = result.weight_gain; updated = true; }
        if (result.baby_activity && result.baby_activity !== p.babyActivity) { p.babyActivity = result.baby_activity; updated = true; }
    }

    // Baby state tracking. babies[] is authoritative; legacy root fields are mirrors.
    if (p.hasBaby && Array.isArray(p.babies) && p.babies.length > 0) {
        const baby = p.babies[0];
        if (result.baby_name && result.baby_name !== baby.name) {
            baby.name = result.baby_name;
            updated = true;
        }
        if (result.baby_age && result.baby_age !== baby.age) {
            baby.age = result.baby_age;
            updated = true;
        }
        if (result.baby_health) {
            const validHealth = ['normal', 'warning', 'critical'];
            if (validHealth.includes(result.baby_health) && result.baby_health !== baby.health) {
                baby.health = result.baby_health;
                updated = true;
            }
        }
        if (result.baby_teething !== null && result.baby_teething !== undefined) {
            const v = !!result.baby_teething;
            if (v !== !!baby.teething) { baby.teething = v; updated = true; }
        }
        if (result.baby_diaper_clean !== null && result.baby_diaper_clean !== undefined) {
            const v = !!result.baby_diaper_clean;
            if (v !== (baby.diaperClean !== false)) {
                baby.diaperClean = v;
                updated = true;
                if (!v && s.showNotifications) showNotification('<i class="fa-solid fa-baby-carriage"></i> Diaper needs changing!', 'info');
            }
        }
        if (result.baby_feeding && result.baby_feeding !== baby.feedingType) {
            baby.feedingType = result.baby_feeding;
            baby.lastFeedRpDate = p.rpDate;
            p.babyLastFeedRpDate = p.rpDate;
            updated = true;
        }
        if (result.baby_sleep && result.baby_sleep !== baby.sleep) { baby.sleep = result.baby_sleep; updated = true; }
        if (result.baby_mood && result.baby_mood !== baby.mood) { baby.mood = result.baby_mood; updated = true; }
        if (result.baby_colicky !== null && result.baby_colicky !== undefined) {
            const v = !!result.baby_colicky;
            if (v !== !!baby.colicky) { baby.colicky = v; updated = true; }
        }
        if (result.mom_state && result.mom_state !== p.momState) {
            p.momState = result.mom_state;
            updated = true;
        }
        if (result.baby_milestone) {
            if (!Array.isArray(baby.milestones)) baby.milestones = [];
            const exists = baby.milestones.some(m => m.text === result.baby_milestone);
            if (!exists) {
                baby.milestones.push({ text: result.baby_milestone, rpDate: p.rpDate, date: new Date().toISOString() });
                updated = true;
                if (s.showNotifications) showNotification(`<i class="fa-solid fa-star"></i> Development: ${result.baby_milestone}`, 'success');
            }
        }
        if (updated) syncBabyLegacyFields(p);
    }

    if (updated) {
        saveSettingsDebounced();
        _syncUI();
        _updatePromptInjection();
    }

    return updated;
}

export function checkConception() {
    const s = getSettings();
    const p = getPregnancyData();

    if (!s.isEnabled) return null;
    if (p.isPregnant) return null;
    if (!canCarry(s, 'user')) return null;

    s.totalChecks++;

    const currentCycleDay = getCycleDay();
    // Fertility comes from the same cycle day used by UI and prompts.
    let cycleModifier = hasMenstrualCycle(s, 'user') ? getCycleModifier(currentCycleDay) : 1;

    let chance = Math.max(0, Math.min(100, Math.round(CHANCES.base * cycleModifier)));

    // Internal implementation note.
    const pp = getPostpartum(p, p);
    if (pp) chance = Math.max(0, Math.min(100, Math.round(chance * pp.fertilityMul)));

    const contraception = getContraception('user');
    const contraceptionEff = CHANCES.contraception[contraception] || 0;
    let contraceptionFailed = false;

    // Internal implementation note.
    // Internal implementation note.
    if (contraception !== 'none') {
        const protectionRoll = roll(100);
        if (protectionRoll <= contraceptionEff) {
            chance = 0;
        } else {
            contraceptionFailed = true;
            if (s.showNotifications) showNotification(L('contraceptionFailed'), 'warning');
        }
    }

    const conceptionRoll = roll(100);
    const success = conceptionRoll <= chance;

    const result = {
        roll: conceptionRoll,
        chance,
        contraception,
        contraceptionFailed,
        cycleDay: currentCycleDay,
        success,
    };

    if (success) {
        p.isPregnant = true;
        s._birthBlockedUntilUser = null;
        // Internal implementation note.
        // Internal implementation note.
        // Internal implementation note.
        // Internal implementation note.
        const freshConception = p.rpDate || null;
        p.conceptionDate = freshConception;
        p._conceptionAnchored = !!p.rpDate;
        p.pregnancyWeeks = 0;
        p._plannedComplications = rollPlannedComplications();
        s.totalConceptions++;

        const twinsChance = s.twinsChance || 3;
        const tripletsChance = s.tripletsChance || 0.1;
        const multiplesRoll = roll(1000) / 10;

        if (multiplesRoll <= tripletsChance) {
            p.fetusCount = 3;
        } else if (multiplesRoll <= twinsChance) {
            p.fetusCount = 2;
        } else {
            p.fetusCount = 1;
        }

        p.fetusSex = [];
        for (let i = 0; i < p.fetusCount; i++) {
            p.fetusSex.push(roll(2) === 1 ? 'M' : 'F');
        }

        // Internal implementation note.
        p.pregnancyKnown = !s.hiddenPregnancy;
        p.lastTestResult = null;
        p.testTakenAt = null;

        if (s.showNotifications) {
            if (p.pregnancyKnown) {
                showNotification(`<i class="fa-solid fa-check"></i> Pregnancy! Day ${currentCycleDay}, ${conceptionRoll}/${chance}<br>${formatFetusCount(p.fetusCount)} | Sex: ?`, 'success');
            } else {
                showNotification(`<i class="fa-solid fa-user-secret"></i> Conception occurred, but she does not know yet. Wait for a missed period and take a test.`, 'success');
            }
        }
    } else {
        if (s.showNotifications) {
            showNotification(`<i class="fa-solid fa-xmark"></i> Not pregnant. Day ${currentCycleDay}, ${conceptionRoll}/${chance}`, 'info');
        }
    }

    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();

    return result;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function terminatePregnancy(reason) {
    const s = getSettings();
    const p = getPregnancyData();
    if (!p.isPregnant) return false;
    p.isPregnant = false;
    p.conceptionDate = null;
    p.pregnancyWeeks = 0;
    p.fetusCount = 1;
    p.fetusSex = [];
    p.fetusSexRevealed = false;
    p.complications = [];
    p._plannedComplications = [];
    p.healthStatus = 'normal';
    p._conceptionAnchored = false;
    p.mood = '';
    p.libido = '';
    p.weightGain = '';
    p.babyActivity = '';
    p._dynamic = {};
    // Internal implementation note.
    // Internal implementation note.
    p._userSetWeeksAt = Date.now();
    try {
        if (!s._historyScanInProgress) {
            const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : window;
            const chatLen = ctx?.chat?.length || 0;
            s._birthBlockedUntilUser = chatLen + 10;
            // Internal implementation note.
            s._conceptionBlockedUntilUser = chatLen + 6;
            s._lastConceptionRollAt = null;
        }
    } catch (e) { reportError('[Reproductive] handled exception:', e); }
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    return true;
}

export function resetPregnancy() {
    const s = getSettings();
    const p = getPregnancyData();

    // Internal implementation note.
    // Internal implementation note.
    if (p.isPregnant) {
        createUndoCheckpoint('Reset pregnancy');
        terminatePregnancy('manual');
        return;
    }

    p._userSetWeeksAt = Date.now();
    try {
        const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : window;
        const chatLen = ctx?.chat?.length || 0;
        s._conceptionBlockedUntilUser = chatLen + 10;
        s._birthBlockedUntilUser = chatLen + 10;
        s._lastScannedPosition = chatLen;
    } catch (e) { reportError('[Reproductive] handled exception:', e); }
    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
}

export function resetBaby() {
    const s = getSettings();
    const p = getPregnancyData();
    if (p.hasBaby || (Array.isArray(p.babies) && p.babies.length > 0)) createUndoCheckpoint('Reset baby');
    // Block re-detection from stale context (conception, birth, AND text-week parsing)
    try {
        const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : window;
        const chatLen = ctx?.chat?.length || 0;
        // Internal implementation note.
        s._conceptionBlockedUntilUser = chatLen + 10;
        s._conceptionBlockedUntilChar = chatLen + 10;
        s._birthBlockedUntilUser = chatLen + 10;
        s._birthBlockedUntilChar = chatLen + 10;
        s._lastScannedPosition = chatLen;
    } catch (e) { reportError('[Reproductive] handled exception:', e); }
    p.hasBaby = false;
    p.babyName = '';
    p.babySex = [];
    p.babyCount = 0;
    p.babyAge = '';
    p.babyHealth = 'normal';
    p.babyTeething = false;
    p.babyColicky = false;
    p.babyDiaperClean = true;
    p.babyFeedingType = '';
    p.babySleep = '';
    p.babyMood = '';
    p.babyMilestones = [];
    p.babyBirthRpDate = null;
    p.babyLastFeedRpDate = null;
    p.babyLastChangeRpDate = null;
    p.momState = '';
    p.babies = [];
    // Internal implementation note.
    p._userSetWeeksAt = Date.now();
    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
}

export function visitDoctor() {
    const s = getSettings();
    const p = getPregnancyData();

    if (!p.isPregnant) return;

    if (p.lastDoctorVisitRpDate && p.rpDate) {
        const lastVisit = new Date(p.lastDoctorVisitRpDate);
        const currentRpDate = new Date(p.rpDate);
        const daysSinceVisit = Math.floor((currentRpDate - lastVisit) / 86400000);

        if (daysSinceVisit < 3) {
            if (s.showNotifications) {
                showNotification(`<i class="fa-solid fa-hospital"></i> Next visit in ${3 - daysSinceVisit} RP days.`, 'info');
            }
            return;
        }
    }

    p.lastDoctorVisitRpDate = p.rpDate || new Date().toISOString();

    const unresolvedComplications = p.complications.filter(c => !c.resolved);

    if (unresolvedComplications.length === 0) {
        if (s.showNotifications) {
            showNotification('<i class="fa-solid fa-hospital"></i> Doctor: Everything is fine!', 'success');
        }
        saveSettingsDebounced();
        return;
    }

    let healed = 0;
    let failed = 0;

    for (const complication of unresolvedComplications) {
        const healChance = complication.severity === 'critical' ? 50 : 75;
        if (roll(100) <= healChance) {
            complication.resolved = true;
            healed++;
        } else {
            failed++;
        }
    }

    const hasUnresolvedCritical = p.complications.some(c => c.severity === 'critical' && !c.resolved);
    const hasUnresolvedWarning = p.complications.some(c => c.severity === 'warning' && !c.resolved);
    p.healthStatus = hasUnresolvedCritical ? 'critical' : hasUnresolvedWarning ? 'warning' : 'normal';

    saveSettingsDebounced();
    _syncUI();

    if (s.showNotifications) {
        if (healed > 0 && failed === 0) {
            showNotification(`<i class="fa-solid fa-hospital"></i> Treated: ${healed} complications`, 'success');
        } else if (healed > 0) {
            showNotification(`<i class="fa-solid fa-hospital"></i> Treated: ${healed}; remaining: ${failed}`, 'info');
        } else {
            showNotification('<i class="fa-solid fa-hospital"></i> Treatment did not resolve it; another visit is needed', 'warning');
        }
    }
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function createPregnancyFromWeeks(weeks, { notify = true } = {}) {
    const s = getSettings();
    const p = getPregnancyData();
    // Internal implementation note.
    if (p.isPregnant || p.hasBaby) return false;
    const w = parseInt(weeks);
    if (!(w >= 1 && w <= 42)) return false;

    const anchor = p.rpDate ? new Date(p.rpDate) : new Date();
    p.isPregnant = true;
    p.conceptionDate = new Date(anchor.getTime() - w * 7 * 86400000).toISOString();
    p._conceptionAnchored = true;
    p.pregnancyWeeks = w;
    p.fetusCount = p.fetusCount || 1;
    if (!p.fetusSex || p.fetusSex.length === 0) {
        p.fetusSex = [];
        for (let i = 0; i < p.fetusCount; i++) {
            p.fetusSex.push(roll(2) === 1 ? 'M' : 'F');
        }
    }
    p.healthStatus = p.healthStatus || 'normal';

    saveSettingsDebounced();
    if (notify && s.showNotifications) {
        showNotification(`<i class="fa-solid fa-baby"></i> Pregnancy detected from text: ${w} weeks`, 'success');
    }
    return true;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function createPregnancyFromStateTag(pregState, { notify = true } = {}) {
    const s = getSettings();
    const p = getPregnancyData();
    if (p.isPregnant || p.hasBaby || !pregState || !pregState.conceptionDate) return false;

    const conceptionMs = new Date(pregState.conceptionDate).getTime();
    if (isNaN(conceptionMs)) return false;

    p.isPregnant = true;
    p.conceptionDate = pregState.conceptionDate;
    p._conceptionAnchored = true;
    p.fetusCount = pregState.fetusCount || 1;
    p.fetusSex = (pregState.fetusSex && pregState.fetusSex.length > 0)
        ? [...pregState.fetusSex]
        : Array.from({ length: p.fetusCount }, () => (roll(2) === 1 ? 'M' : 'F'));
    p.fetusSexRevealed = pregState.fetusSex?.length > 0 && pregState.fetusSex.every(x => x === 'M' || x === 'F');
    if (pregState.fatherName) p.fatherName = pregState.fatherName;
    p.healthStatus = p.healthStatus || 'normal';

    // Internal implementation note.
    if (p.rpDate) {
        const rpMs = new Date(p.rpDate).getTime();
        p.pregnancyWeeks = rpMs >= conceptionMs ? Math.floor((rpMs - conceptionMs) / (7 * 86400000)) : 0;
    } else {
        p.pregnancyWeeks = 0;
    }

    saveSettingsDebounced();
    if (notify && s.showNotifications) {
        showNotification(`<i class="fa-solid fa-baby"></i> Pregnancy restored from context: ${p.pregnancyWeeks} weeks`, 'success');
    }
    return true;
}

// Internal implementation note.
// Internal implementation note.
// fetusCount: 1-4
// Internal implementation note.
export function startManualPregnancy(conceptionDateISO, fetusCount, fetusSex = null, secondParent = undefined) {
    const s = getSettings();
    const p = getPregnancyData();
    s._conceptionBlockedUntilUser = null;
    s._birthBlockedUntilUser = null;
    const count = Math.max(1, Math.min(4, parseInt(fetusCount) || 1));

    if (secondParent !== undefined) {
        p.fatherName = String(secondParent).trim().slice(0, 80);
        p._secondParentManual = true;
    }
    p.isPregnant = true;
    p.conceptionDate = conceptionDateISO;
    // Internal implementation note.
    // Internal implementation note.
    p._conceptionAnchored = true;
    // Internal implementation note.
    p._userSetWeeksAt = Date.now();
    p.fetusCount = count;
    p.healthStatus = 'normal';
    p.complications = [];
    p._plannedComplications = [];

    // Internal implementation note.
    if (Array.isArray(fetusSex) && fetusSex.length === count) {
        p.fetusSex = [...fetusSex];
    } else {
        p.fetusSex = [];
        for (let i = 0; i < count; i++) {
            p.fetusSex.push(roll(2) === 1 ? 'M' : 'F');
        }
    }
    p.fetusSexRevealed = false;

    // Internal implementation note.
    if (p.rpDate) {
        const calc = calculateWeeksFromDates(p.conceptionDate, p.rpDate, 0);
        p.pregnancyWeeks = calc.weeks;
    } else {
        p.pregnancyWeeks = 0;
    }

    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();

    if (getSettings().showNotifications) {
        const dateStr = new Date(conceptionDateISO).toLocaleDateString('en-US');
        showNotification(`<i class="fa-solid fa-check"></i> Pregnancy: conception ${dateStr}, ${count} fetus(es), ${p.pregnancyWeeks} weeks`, 'success');
    }

    return p;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
function fmtAgeShort(days) {
    days = Math.max(0, parseInt(days) || 0);
    if (days === 0) return 'newborn';
    if (days < 30) return `${days} days`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months`;
    const years = Math.floor(days / 365);
    const remM = Math.floor((days % 365) / 30);
    return remM > 0 ? `${years} years ${remM} months` : `${years} ${years === 1 ? 'year' : 'years'}`;
}

export function startManualBaby(babiesData) {
    if (!Array.isArray(babiesData) || babiesData.length === 0) return null;
    const p = getPregnancyData();

    // Internal implementation note.
    const existingBabies = Array.isArray(p.babies) ? [...p.babies] : [];

    // Internal implementation note.
    const nowRp = p.rpDate ? new Date(p.rpDate) : new Date();

    p.isPregnant = false;
    p.conceptionDate = null;
    p.pregnancyWeeks = 0;
    p.fetusCount = 0;
    p.fetusSex = [];
    p.fetusSexRevealed = false;
    p.hasBaby = true;
    p.babyCount = existingBabies.length + babiesData.length;
    p.babyHealth = 'normal';
    p.babyMood = 'calm';
    p.babyDiaperClean = true;
    p.babySleep = 'Sleeping';
    p.babyAge = fmtAgeShort(babiesData[0].ageDays || 0);

    p.babies = [...existingBabies];
    babiesData.forEach((b, i) => {
        const ageDays = parseInt(b.ageDays) || 0;
        const birthMs = nowRp.getTime() - ageDays * 86400000;
        p.babies.push({
            name: b.name || '',
            sex: b.sex === 'F' ? 'F' : 'M',
            health: 'normal',
            mood: 'calm',
            sleep: 'Sleeping',
            diaperClean: true,
            teething: false,
            colicky: false,
            feedingType: '',
            milestones: [],
            personality: Array.isArray(b.personality) ? b.personality : [],
            appearance: Array.isArray(b.appearance) ? b.appearance : [],
            fatherName: b.fatherName || '',
            birthRpDate: new Date(birthMs).toISOString(),
            age: fmtAgeShort(ageDays),
        });
    });

    syncBabyLegacyFields(p);

    // Internal implementation note.
    // Internal implementation note.
    try {
        import('./baby-care.js').then(m => {
            m.updateBabyCare();
            refreshSnap();
            saveSettingsDebounced();
            _syncUI();
            _updatePromptInjection();
            _renderInfoblock();
        }).catch(e => reportError('[Reproductive] manual baby refresh error:', e));
    } catch (e) { reportError('[Reproductive] manual baby refresh error:', e); }

    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    _renderInfoblock();

    if (getSettings().showNotifications) {
        showNotification(`<i class="fa-solid fa-baby"></i> Baby added: ${p.babies[p.babies.length-1].name || 'unnamed'}`, 'success');
    }
    return p;
}

// Internal implementation note.
// Internal implementation note.
export function graduateBabies(graduatedBabies) {
    if (!Array.isArray(graduatedBabies) || graduatedBabies.length === 0) return;
    const p = getPregnancyData();
    if (!Array.isArray(p.grownChildren)) p.grownChildren = [];

    const ids = new Set(graduatedBabies.map(b => `${b.name || ''}|${b.birthRpDate || ''}|${b.sex || ''}`));

    // Internal implementation note.
    for (const baby of graduatedBabies) {
        p.grownChildren.push({
            name: baby.name || '',
            sex: baby.sex || '?',
            personality: baby.personality || [],
            appearance: baby.appearance || [],
            fatherName: baby.fatherName || '',
            birthRpDate: baby.birthRpDate || null,
            graduatedRpDate: p.rpDate || null,
            special: baby.special || null,
            milestones: Array.isArray(baby.milestones) ? [...baby.milestones] : [],
        });
    }

    // Internal implementation note.
    p.babies = (p.babies || []).filter(b => !ids.has(`${b.name || ''}|${b.birthRpDate || ''}|${b.sex || ''}`));
    syncBabyLegacyFields(p);

    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    _renderInfoblock();
}

// Internal implementation note.
// Internal implementation note.
export function checkBabyGraduation() {
    const s = getSettings();
    const p = getPregnancyData();
    if (!p.hasBaby || !Array.isArray(p.babies) || p.babies.length === 0) return [];
    if (!p.rpDate) return [];

    const maxDays = s.babyMaxAgeDays || 730;
    const nowMs = new Date(p.rpDate).getTime();
    const graduates = [];

    for (const baby of p.babies) {
        if (!baby.birthRpDate) continue;
        const birthMs = new Date(baby.birthRpDate).getTime();
        if (isNaN(birthMs)) continue;
        const ageDays = (nowMs - birthMs) / 86400000;
        if (ageDays >= maxDays) {
            graduates.push(baby);
        }
    }
    return graduates;
}

// ═══════════════════════════════════════════
// Internal implementation note.
// Internal implementation note.
// ═══════════════════════════════════════════

// Internal implementation note.
export function partnerCheckConception() {
    const s = getSettings();
    const c = getPartnerData();
    if (!s.isEnabled || c.isPregnant) return null;
    if (!canCarry(s, 'char')) {
        return null;
    }
    const p = getPregnancyData();

    s.totalChecks++;
    let cycleModifier = hasMenstrualCycle(s, 'char') ? getCycleModifier(c.cycleDay || 1) : 1;

    let chance = Math.max(0, Math.min(100, Math.round(CHANCES.base * cycleModifier)));

    const contraception = getContraception('char');
    const contraEff = CHANCES.contraception[contraception] || 0;
    if (contraception !== 'none') {
        const protectionRoll = roll(100);
        if (protectionRoll <= contraEff) chance = 0;
        else if (s.showNotifications) showNotification(L('contraceptionFailed'), 'warning');
    }

    const r = roll(100);
    const success = r <= chance;

    if (success) {
        c.isPregnant = true;
        c.pregnancyKnown = !s.hiddenPregnancy;
        c.lastTestResult = null;
        s._birthBlockedUntilChar = null;
        c.conceptionDate = p.rpDate || null;
        c._conceptionAnchored = !!p.rpDate;
        c.pregnancyWeeks = 0;
        c._plannedComplications = rollPlannedComplications();
        c.healthStatus = 'normal';
        s.totalConceptions++;
        const mult = roll(1000) / 10;
        c.fetusCount = mult <= (s.tripletsChance || 0.1) ? 3 : mult <= (s.twinsChance || 3) ? 2 : 1;
        c.fetusSex = [];
        for (let i = 0; i < c.fetusCount; i++) c.fetusSex.push(roll(2) === 1 ? 'M' : 'F');
        c.fetusSexRevealed = false;
        if (!c._secondParentManual && !c.fatherName) c.fatherName = carrierName('user');
        if (s.showNotifications) {
            showNotification(`<i class="fa-solid fa-check"></i> ${carrierName('char')} is pregnant! ${formatFetusCount(c.fetusCount)}`, 'success');
        }
    } else if (s.showNotifications) {
        showNotification(`<i class="fa-solid fa-xmark"></i> ${carrierName('char')} — no conception (${r}/${chance})`, 'info');
    }

    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    return { success, roll: r, chance };
}

// Internal implementation note.
export function partnerBirth(babyTraits, options = {}) {
    const s = getSettings();
    const p = getPregnancyData();
    const c = getPartnerData();
    const birthSource = options.source || 'tag';
    if (!canTriggerBirth(c, s, birthSource)) return false;

    const count = c.fetusCount || 1;
    const sexes = c.fetusSex?.length ? [...c.fetusSex] : ['M'];
    const birthRpDate = resolveBirthRpDate(c, p, s, birthSource);
    const motherName = carrierName('char');
    const fatherName = c._secondParentManual ? c.fatherName : c.fatherName || carrierName('user');

    // Internal implementation note.
    c.isPregnant = false;
    c.conceptionDate = null;
    c.pregnancyWeeks = 0;
    c.fetusCount = 1;
    c.fetusSex = [];
    c.fetusSexRevealed = false;
    c.complications = [];
    c._plannedComplications = [];
    c._dynamic = {};

    // Internal implementation note.
    if (!Array.isArray(p.babies)) p.babies = [];
    const newbornLooks = Array.from({ length: count }, () => inheritedLooks(c));
    const startIdx = p.babies.length;
    for (let i = 0; i < count; i++) {
        p.babies.push({
            name: '', sex: sexes[i] || 'M', health: 'normal', mood: 'calm', sleep: 'Sleeping',
            diaperClean: true, teething: false, colicky: false, feedingType: '',
            milestones: [], personality: [], appearance: newbornLooks[i],
            fatherName, motherName, bornBy: 'char',
            birthRpDate, age: 'newborn',
        });
    }
    syncBabyLegacyFields(p);
    c.postpartum = { startRpDate: birthRpDate, lactating: true };
    c.pregnancyKnown = false;
    c.lastTestResult = null;

    // Internal implementation note.
    try {
        if (!s._historyScanInProgress) {
            const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : window;
            const chatLen = ctx?.chat?.length || 0;
            s._conceptionBlockedUntilChar = chatLen + 12;
            s._birthBlockedUntilChar = chatLen + 12;
        }
    } catch (e) { reportError('[Reproductive] handled exception:', e); }

    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();

    // Internal implementation note.
    const modelTraits = babyTraits?.babies && Array.isArray(babyTraits.babies) ? babyTraits.babies : [];
    const dialogBabies = [];
    for (let i = 0; i < count; i++) {
        const mt = modelTraits[i] || {};
        dialogBabies.push({
            sex: sexes[i] || 'M',
            name: mt.name || mt.\u0438\u043c\u044f || '',
            fatherName: c._secondParentManual ? fatherName : fatherName || mt.fatherName || mt.father || '',
            personality: Array.isArray(mt.personality) ? mt.personality : null,
            appearance: mergeBabyAppearance(p.babies[startIdx + i].appearance, mt.appearance),
            special: mt.special !== undefined ? mt.special : undefined,
        });
    }
    const applyPartnerNewbornTraits = (names, traitsData) => {
        for (let i = 0; i < count; i++) {
            const baby = p.babies[startIdx + i];
            if (!baby) continue;
            if (names[i]) baby.name = names[i];
            const tr = traitsData[i] || {};
            if (Array.isArray(tr.personality) && tr.personality.length) baby.personality = tr.personality;
            if (Array.isArray(tr.appearance) && tr.appearance.length) baby.appearance = tr.appearance;
            if (tr.special) baby.special = tr.special;
            if (tr.fatherName) baby.fatherName = tr.fatherName;
        }
        if (p.babies[0]?.name) p.babyName = p.babies[0].name;
        saveSettingsDebounced();
        _syncUI();
        _updatePromptInjection();
        syncBabyLegacyFields(p);
        _renderInfoblock();
    };
    if (options.silent) {
        const names = dialogBabies.map(b => b.name || '');
        const traits = dialogBabies.map(b => ({
            personality: Array.isArray(b.personality) ? b.personality : [],
            appearance: Array.isArray(b.appearance) ? b.appearance : [],
            special: b.special,
            fatherName: b.fatherName,
        }));
        applyPartnerNewbornTraits(names, traits);
    } else {
        showBirthDialog(dialogBabies, applyPartnerNewbornTraits);
    }

    if (!options.silent && s.showNotifications) showNotification(`<i class="fa-solid fa-baby"></i> ${motherName} gave birth!`, 'success');
    return true;
}

// Internal implementation note.
export function startPartnerPregnancy(conceptionDateISO, fetusCount, fetusSex = null, secondParent = undefined) {
    const s = getSettings();
    const c = getPartnerData();
    const p = getPregnancyData();
    s._conceptionBlockedUntilChar = null;
    s._birthBlockedUntilChar = null;
    const count = Math.max(1, Math.min(4, parseInt(fetusCount) || 1));
    if (secondParent !== undefined) {
        c.fatherName = String(secondParent).trim().slice(0, 80);
        c._secondParentManual = true;
    }
    c.isPregnant = true;
    c.conceptionDate = conceptionDateISO;
    c._conceptionAnchored = true;
    c._userSetWeeksAt = Date.now();
    c.fetusCount = count;
    c.healthStatus = 'normal';
    c.complications = [];
    c._plannedComplications = [];
    c.fetusSex = (Array.isArray(fetusSex) && fetusSex.length === count)
        ? [...fetusSex]
        : Array.from({ length: count }, () => (roll(2) === 1 ? 'M' : 'F'));
    c.fetusSexRevealed = false;
    if (!c._secondParentManual && !c.fatherName) c.fatherName = carrierName('user');
    c.pregnancyWeeks = p.rpDate ? calculateWeeksFromDates(c.conceptionDate, p.rpDate, 0).weeks : 0;

    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    if (getSettings().showNotifications) {
        showNotification(`<i class="fa-solid fa-check"></i> ${carrierName('char')}: pregnancy at ${c.pregnancyWeeks} weeks`, 'success');
    }
    return c;
}

// Internal implementation note.
export function resetPartnerPregnancy() {
    const c = getPartnerData();
    if (c.isPregnant) createUndoCheckpoint('Reset character pregnancy');
    c.isPregnant = false;
    c.conceptionDate = null;
    c.pregnancyWeeks = 0;
    c.fetusCount = 1;
    c.fetusSex = [];
    c.fetusSexRevealed = false;
    c.complications = [];
    c._plannedComplications = [];
    c.healthStatus = 'normal';
    c._dynamic = {};
    c._userSetWeeksAt = Date.now();
    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
}

// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

// Internal implementation note.
export function daysSinceConception(carrier, root) {
    if (!carrier?.conceptionDate || !root?.rpDate) return 0;
    const ms = new Date(root.rpDate).getTime() - new Date(carrier.conceptionDate).getTime();
    return isNaN(ms) ? 0 : Math.max(0, Math.floor(ms / 86400000));
}

// Internal implementation note.
export function pregnancyIsKnown(carrier, s) {
    if (!carrier?.isPregnant) return false;
    if (s?.hiddenPregnancy === false) return true;
    if (carrier.pregnancyKnown || ['positive', 'faint'].includes(carrier.lastTestResult)) return true;
    return isObvious(carrier.pregnancyWeeks || 0, s?.obviousAtWeek || 12);
}

// Internal implementation note.
export function takePregnancyTest(who = 'user') {
    const s = getSettings();
    const p = getPregnancyData();
    const c = who === 'char' ? getPartnerData() : p;

    const days = daysSinceConception(c, p);
    const result = rollTest(!!c.isPregnant, days);

    c.lastTestResult = result;
    c.testTakenAt = p.rpDate || null;
    if (result !== 'negative') c.pregnancyKnown = true;

    if (s.showNotifications) {
        const nm = who === 'char' ? carrierName('char') + ': ' : '';
        if (result === 'positive') {
            showNotification(`<i class="fa-solid fa-vial-circle-check"></i> ${nm}positive test — two clear lines`, 'success');
        } else if (result === 'faint') {
            showNotification(`<i class="fa-solid fa-vial"></i> ${nm}faint second line — positive`, 'success');
        } else {
            showNotification(`<i class="fa-solid fa-vial"></i> ${nm}negative test${c.isPregnant ? ' — possibly too early' : ''}`, 'info');
        }
    }

    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    return result;
}

// Internal implementation note.
export function revealPregnancy(who = 'user') {
    const c = who === 'char' ? getPartnerData() : getPregnancyData();
    if (!c.isPregnant) return false;
    c.pregnancyKnown = true;
    c.lastTestResult = 'positive';
    refreshSnap();
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    return true;
}

// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

// Internal implementation note.
export function getPostpartum(carrier, root) {
    const pp = carrier?.postpartum;
    if (!pp?.startRpDate || !root?.rpDate) return null;
    const ms = new Date(root.rpDate).getTime() - new Date(pp.startRpDate).getTime();
    if (isNaN(ms) || ms < 0) return null;
    const days = Math.floor(ms / 86400000);
    const st = postpartumState(days, pp.lactating !== false);
    if (days > 730) return null;
    return { ...st, lactating: pp.lactating !== false && st.lactating };
}

// Internal implementation note.
export function setLactating(who, value) {
    const c = who === 'char' ? getPartnerData() : getPregnancyData();
    if (!c.postpartum) return false;
    c.postpartum.lactating = !!value;
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
    return true;
}

// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

// Internal implementation note.
export function monthsTrying(p) {
    if (!p?._tryingSince || !p?.rpDate) return 0;
    const ms = new Date(p.rpDate).getTime() - new Date(p._tryingSince).getTime();
    return isNaN(ms) ? 0 : Math.max(0, Math.floor(ms / (30 * 86400000)));
}

// Internal implementation note.
export function setTrying(value) {
    const s = getSettings();
    const p = getPregnancyData();
    s.tryingToConceive = !!value;
    if (value && !p._tryingSince) p._tryingSince = p.rpDate || new Date().toISOString();
    if (!value) p._tryingSince = null;
    saveSettingsDebounced();
    _syncUI();
    _updatePromptInjection();
}

// Internal implementation note.
// Internal implementation note.
export function inheritedLooks(p) {
    try {
        const root = getPregnancyData();
        const other = p === root ? getPartnerData() : root;
        const expectedName = carrierName(p === root ? 'char' : 'user');
        const otherLooks = p?.fatherLooks || (p?.fatherName === expectedName ? other?.motherLooks : null);
        const res = inheritLooks(p?.motherLooks, otherLooks);
        const out = [];
        if (res.eyes) out.push(`${res.eyes} eyes`);
        if (res.hair) out.push(`${res.hair} hair`);
        return out;
    } catch (e) {
        return [];
    }
}

// Internal implementation note.
export function setParentLooks(which, looks) {
    const p = getPregnancyData();
    const key = which === 'father' ? 'fatherLooks' : 'motherLooks';
    p[key] = { eyes: looks?.eyes || '', hair: looks?.hair || '' };
    saveSettingsDebounced();
    _syncUI();
    return p[key];
}

// Keep already inherited colours; model details may add other established traits.
export function mergeBabyAppearance(inherited, proposed) {
    const base = Array.isArray(inherited) ? inherited : [];
    const details = Array.isArray(proposed) ? proposed.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 160)).filter(Boolean) : [];
    const hair = base.some(x => /\u0432\u043e\u043b\u043e\u0441|hair/i.test(x));
    const eyes = base.some(x => /\u0433\u043b\u0430\u0437|eyes?/i.test(x));
    return [...new Set([...base, ...details.filter(x => !(hair && /\u0432\u043e\u043b\u043e\u0441|\u0440\u044b\u0436|\u0431\u043b\u043e\u043d|\u0431\u0440\u044e\u043d\u0435\u0442|hair|redhead|blond|brunet/i.test(x)) && !(eyes && /\u0433\u043b\u0430\u0437|eyes?/i.test(x)))])].slice(0, 8);
}
