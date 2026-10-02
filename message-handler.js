// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

import { getSettings, getPregnancyData, getCycleDay, setCycleDay, getCurrentChatId } from './state.js';
import { scanMessage, scanDateTag, scanStatusTag, scanWeeksFromText, scanPregnancyStateTag, stripHiddenTags, stripThink, stripReproTags, hasReproTags, messageRaw, confirmedFetusCount } from './scanner.js';
import { applyScanResult, createPregnancyFromWeeks, createPregnancyFromStateTag, partnerCheckConception, partnerBirth, getPostpartum, canTriggerBirth } from './pregnancy.js';
import { getPartnerData, carrierName, isTracked } from './state.js';
import { hasMenstrualCycle, hasCycle, cyclePhase } from './omegaverse.js';
import { updateBabyCare } from './baby-care.js';
import { DISRUPTIONS, disruptionShift } from './cycle-realism.js';
import { updatePromptInjection } from './prompts.js';
import { syncUI, buildInfoblockHtml } from './ui.js';
import { showNotification } from './notifications.js';
import { saveSettingsDebounced } from '../../../../script.js';
import { reportError } from './diagnostics.js';

// ─── Get last N messages as context for AI ───

function getRecentMessages(count = 3) {
    const chat = typeof SillyTavern?.getContext === 'function'
        ? SillyTavern.getContext().chat
        : window.chat;
    if (!chat || chat.length === 0) return [];

    const msgs = [];
    for (let i = chat.length - 1; i >= 0 && msgs.length < count; i--) {
        const msg = chat[i];
        if (msg && msg.mes && !msg.is_system) {
            msgs.unshift(msg);
        }
    }
    return msgs;
}


// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.

// Internal implementation note.
export function rawTextOf(msg) {
    return messageRaw(msg);
}

// Internal implementation note.
export function detachTags(msg) {
    if (!msg || !msg.mes || !hasReproTags(msg.mes)) return false;
    const raw = msg.mes;
    const clean = stripReproTags(raw);
    if (!clean || clean === raw) return false;
    msg.extra = msg.extra || {};
    msg.extra.reproRaw = raw;
    msg.extra.reproRawSwipe = msg.swipe_id ?? null;
    delete msg.extra.reproRawInvalid;
    msg.mes = clean;
    // Internal implementation note.
    if (Array.isArray(msg.swipes) && typeof msg.swipe_id === 'number' && msg.swipes[msg.swipe_id] === raw) {
        msg.swipes[msg.swipe_id] = clean;
    }
    return true;
}

// Internal implementation note.
export function chatHasTags() {
    const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : null;
    const chat = ctx?.chat || window.chat;
    if (!Array.isArray(chat)) return false;
    return chat.some(m => m && hasReproTags(m.mes));
}

// Internal implementation note.
export function purgeChatTags() {
    const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : null;
    const chat = ctx?.chat || window.chat;
    if (!Array.isArray(chat)) return 0;
    let n = 0;
    for (const msg of chat) if (detachTags(msg)) n++;
    if (n && ctx?.saveChat) { try { ctx.saveChat(); } catch (e) { reportError('[Reproductive] saveChat failed after tag purge:', e); } }
    return n;
}

// ─── Main scan logic ───

// Track whether this is a regeneration/swipe (skip time analysis)
let _isRegeneration = false;
// Snapshot of pregnancy data before last scan (for restoring on regen)
let _preRegenSnapshot = null;
// Internal implementation note.
let _snapshotChatId = null;

// Internal implementation note.
function snapshotOf(p) {
    const { _history, _undoSnapshot, _turnBaseline, ...state } = p;
    return structuredClone(state);
}

// Internal implementation note.
function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
}

export function clearRegenState() {
    _isRegeneration = false;
    _preRegenSnapshot = null;
    _snapshotChatId = null;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
const HISTORY_CAP = 25;

export function pushStateHistory(pos) {
    try {
        const p = getPregnancyData();
        if (!Array.isArray(p._history)) p._history = [];
        const snap = snapshotOf(p);
        const existing = p._history.find(h => h.pos === pos);
        if (existing) {
            existing.state = snap;
        } else {
            p._history.push({ pos, state: snap });
            p._history.sort((a, b) => a.pos - b.pos);
        }
        if (p._history.length > HISTORY_CAP) {
            p._history.splice(0, p._history.length - HISTORY_CAP);
        }
    } catch (e) { reportError('[Reproductive] message-handler operation failed:', e); }
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function rollbackToPosition(newLen) {
    // Regenerate temporarily deletes the last answer. runScan handles that rollback;
    // treating it as a user deletion here would discard the newly committed manual days.
    if (_isRegeneration) return false;
    try {
        const p = getPregnancyData();
        if (!Array.isArray(p._history) || p._history.length === 0) return false;

        // Internal implementation note.
        const kept = p._history.filter(h => h.pos <= newLen);
        const target = kept.length > 0 ? kept[kept.length - 1] : null;
        if (!target) {
            p._history = kept;
            return false;
        }

        // Internal implementation note.
        for (const k of Object.keys(p)) delete p[k];
        Object.assign(p, structuredClone(target.state));
        p._history = kept;

        // Internal implementation note.
        _preRegenSnapshot = snapshotOf(p);
        _snapshotChatId = getCurrentChatId();

        saveSettingsDebounced();
        return true;
    } catch (e) {
        return false;
    }
}

function runScan() {
    const s = getSettings();
    if (!s.isEnabled) return;

    const chat = typeof SillyTavern?.getContext === 'function'
        ? SillyTavern.getContext().chat
        : window.chat;
    if (!chat || chat.length === 0) return;

    const lastMessage = chat[chat.length - 1];
    if (!lastMessage) return;

    // Use chat length as position ID — regeneration replaces at same index
    const positionId = chat.length;
    // Internal implementation note.
    const isRegen = _isRegeneration && !lastMessage.is_user;
    _isRegeneration = false; // reset flag

    // Internal implementation note.
    // Internal implementation note.
    const text = stripThink(rawTextOf(lastMessage));
    const textHash = simpleHash(text);

    // Internal implementation note.
    // Internal implementation note.
    if (!isRegen && s._lastScannedPosition === positionId &&
        (textHash === s._lastScannedHash || textHash === s._lastScannedHashStripped)) {
        return;
    }

    // On regeneration: restore state snapshot from before the original message was processed.
    // Internal implementation note.
    const p = getPregnancyData();
    const chatIdNow = getCurrentChatId();
    if (isRegen) restoreTurnBaseline(positionId);
    // A render/final callback for the same answer must not replace its BEFORE state.
    if (!p._turnBaseline || p._turnBaseline.pos !== positionId) {
        captureTurnBaseline(positionId);
    }


    // Internal implementation note.
    s._lastScannedPosition = positionId;
    s._lastScannedHash = textHash;
    s._lastScannedHashStripped = simpleHash(stripHiddenTags(text));

    // 0) RP_DATE tag: always extract date and advance time
    let dateAdvanced = processDateTag(text);

    // 1) Try tag-based detection (if model added tags)
    const freshStatus = scanStatusTag(text);
    if (freshStatus) applyStatusData(s, p, freshStatus);
    const tagResult = scanMessage(text);
    if (tagResult?.birth_occurred && !canTriggerBirth(p, s, 'tag')) tagResult.birth_occurred = false;
    if (tagResult) {
        // Ignore conception tag when already pregnant
        if (p.isPregnant) {
            tagResult.vaginal_ejaculation_occurred = false;
        }
        // Internal implementation note.
        // Internal implementation note.
        if (tagResult.vaginal_ejaculation_occurred && s._lastConceptionRollAt === positionId) {
            tagResult.vaginal_ejaculation_occurred = false;
        }
        // Block keyword/API-based conception after manual reset (only explicit tags bypass)
        if (tagResult.vaginal_ejaculation_occurred && tagResult._source !== 'tag' && s._conceptionBlockedUntilUser && positionId <= s._conceptionBlockedUntilUser) {
            tagResult.vaginal_ejaculation_occurred = false;
        }
        // Block keyword-based birth on USER messages (only AI narration or explicit tag may trigger birth)
        if (tagResult.birth_occurred && tagResult._source === 'keyword' && lastMessage.is_user) {
            tagResult.birth_occurred = false;
        }
        // Block keyword-based birth when pregnancy is too early (require >= 85% of duration)
        if (tagResult.birth_occurred && tagResult._source === 'keyword' && p.isPregnant) {
            const minWeek = Math.ceil((s.pregnancyDuration || 40) * 0.85);
            if ((p.pregnancyWeeks || 0) < minWeek) {
                tagResult.birth_occurred = false;
            }
        }

        // Sex reveal detected (tag or keyword) — set the flag immediately
        if (tagResult.sex_revealed && p.isPregnant && !p.fetusSexRevealed) {
            // Override prerolled fetusSex with what the model ACTUALLY announced.
            // Internal implementation note.
            if (tagResult.revealed_sexes && tagResult.revealed_sexes.length > 0) {
                const need = p.fetusCount || 1;
                const newSex = [];
                for (let i = 0; i < need; i++) {
                    newSex.push(tagResult.revealed_sexes[i] || tagResult.revealed_sexes[tagResult.revealed_sexes.length - 1]);
                }
                if (JSON.stringify(newSex) !== JSON.stringify(p.fetusSex)) {
                    p.fetusSex = newSex;
                }
            }
            p.fetusSexRevealed = true;
            saveSettingsDebounced();
            if (s.showNotifications) {
                const icons = p.fetusSex.map(sx => sx === 'M' ? '♂ boy' : '♀ girl').join(', ');
                showNotification(`<i class="fa-solid fa-baby"></i> Sex determined: ${icons}`, 'success');
            }
            syncUI();
            updatePromptInjection();
            setTimeout(renderInfoblock, 500);
            // If no conception/birth to process — still continue to Extra API for dynamic data
        }

        // Internal implementation note.
        // Internal implementation note.
        if (isTracked('char') && (tagResult.char_conception || tagResult.char_birth || tagResult.char_sex_revealed)) {
            const c = getPartnerData();
            let charChanged = false;
            if (tagResult.char_conception && !c.isPregnant) {
                const blocked = s._conceptionBlockedUntilChar && positionId <= s._conceptionBlockedUntilChar;
                if (blocked) {
                } else if (s._lastCharConceptionRollAt === positionId) {
                } else {
                    s._lastCharConceptionRollAt = positionId;
                    partnerCheckConception();
                    charChanged = true;
                }
            }
            if (tagResult.char_sex_revealed && c.isPregnant && !c.fetusSexRevealed) {
                if (tagResult.revealed_sexes?.length) {
                    const need = c.fetusCount || 1;
                    const ns = [];
                    for (let i = 0; i < need; i++) ns.push(tagResult.revealed_sexes[i] || tagResult.revealed_sexes[tagResult.revealed_sexes.length - 1]);
                    c.fetusSex = ns;
                }
                c.fetusSexRevealed = true;
                charChanged = true;
                if (s.showNotifications) {
                    const icons = c.fetusSex.map(sx => sx === 'M' ? '♂ boy' : '♀ girl').join(', ');
                    showNotification(`<i class="fa-solid fa-baby"></i> ${carrierName('char')}: sex determined — ${icons}`, 'success');
                }
            }
            if (tagResult.char_birth) {
                const blocked = s._birthBlockedUntilChar && positionId <= s._birthBlockedUntilChar;
                if (!blocked && partnerBirth(tagResult.baby_traits)) charChanged = true;
            }
            if (charChanged) {
                saveSettingsDebounced();
                syncUI();
                updatePromptInjection();
                setTimeout(renderInfoblock, 500);
                pushStateHistory(positionId);
            }
        }

        // Only proceed if there's actually something to process
        if (tagResult.vaginal_ejaculation_occurred || tagResult.birth_occurred || tagResult.miscarriage_occurred || tagResult.abortion_occurred) {
            if (tagResult.vaginal_ejaculation_occurred) s._lastConceptionRollAt = positionId;
            applyScanResult(tagResult);
            if (s.showNotifications) {
                const parts = [];
                if (tagResult.vaginal_ejaculation_occurred) parts.push('<i class="fa-solid fa-droplet"></i> Conception checked!');
                if (tagResult.birth_occurred) parts.push('<i class="fa-solid fa-baby"></i> Birth!');
                if (tagResult.miscarriage_occurred) parts.push('<i class="fa-solid fa-heart-crack"></i> Miscarriage — pregnancy ended');
                if (tagResult.abortion_occurred) parts.push('<i class="fa-solid fa-heart-crack"></i> Abortion — pregnancy ended');
                const nType = (tagResult.miscarriage_occurred || tagResult.abortion_occurred) ? 'warning' : 'success';
                showNotification(`${parts.join(' | ')}`, nType);
            }
            syncUI();
            updatePromptInjection();
            setTimeout(renderInfoblock, 500);
            pushStateHistory(positionId);
            saveSettingsDebounced();
            return;
        } else {
        }
    }

    // 1.5) RP_STATUS tag: parse dynamic scene data from main model
    const statusData = scanStatusTag(text);
    if (statusData) {
        applyStatusData(s, p, statusData);
        saveSettingsDebounced();
    }

    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    const pregState = scanPregnancyStateTag(text);
    if (pregState && !p.isPregnant) {
        // Internal implementation note.
        // Internal implementation note.
        // Internal implementation note.
        // Internal implementation note.
        const userSetMs = p._userSetWeeksAt || 0;
        const recentlyUserSet = userSetMs > 0 && (Date.now() - userSetMs) / 60000 < 30;
        const blocked = s._conceptionBlockedUntilUser && positionId <= s._conceptionBlockedUntilUser;
        if (recentlyUserSet || blocked) {
        } else {
            createPregnancyFromStateTag(pregState);
        }
    }
    if (pregState && p.isPregnant) {
        let stateChanged = false;
        // Established conception date is tracker state. A model echo cannot redate it.
        if (pregState.fetusCountConfirmed && pregState.fetusCount !== null && p.fetusCount !== pregState.fetusCount) {
            p.fetusCount = pregState.fetusCount;
            stateChanged = true;
        }
        // Internal implementation note.
        const tagSex = pregState.fetusSex.filter(x => x === 'M' || x === 'F');
        if (tagSex.length > 0 && JSON.stringify(p.fetusSex) !== JSON.stringify(pregState.fetusSex)) {
            p.fetusSex = pregState.fetusSex;
            const allKnown = pregState.fetusSex.every(x => x === 'M' || x === 'F');
            if (allKnown && !p.fetusSexRevealed) {
                p.fetusSexRevealed = true;
            }
            stateChanged = true;
        }
        if (!p._secondParentManual && pregState.fatherName && p.fatherName !== pregState.fatherName) {
            p.fatherName = pregState.fatherName;
            stateChanged = true;
        }
        // Internal implementation note.
        if (p.rpDate && p.conceptionDate) {
            const conceptionMs = new Date(p.conceptionDate).getTime();
            const rpMs = new Date(p.rpDate).getTime();
            if (rpMs >= conceptionMs) {
                const newWeeks = Math.floor((rpMs - conceptionMs) / (7 * 86400000));
                if (newWeeks !== p.pregnancyWeeks) {
                    p.pregnancyWeeks = newWeeks;
                    stateChanged = true;
                }
            }
        }
        if (stateChanged) saveSettingsDebounced();
    }

    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    //
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    if (!p.isPregnant) {
        const weeksData = scanWeeksFromText(text);
        if (weeksData && weeksData.weeks >= 1 && weeksData.weeks <= 42) {
            const manualSetMs = p._userSetWeeksAt || 0;
            const minutesSinceManual = (Date.now() - manualSetMs) / 60000;
            const recentlyManual = manualSetMs > 0 && minutesSinceManual < 30;
            const blocked = s._conceptionBlockedUntilUser && positionId <= s._conceptionBlockedUntilUser;

            if (recentlyManual) {
            } else if (blocked) {
            } else {
                createPregnancyFromWeeks(weeksData.weeks);
            }
        }
    }

    // Internal implementation note.
    if (p.hasBaby) {
        try { updateBabyCare(); } catch (e) { reportError('[Reproductive] baby-care update failed:', e); }
    }

    // Internal implementation note.
    pushStateHistory(positionId);
    saveSettingsDebounced();
    syncUI();
    updatePromptInjection();
    setTimeout(renderInfoblock, 500);
}

// ─── Force re-scan with full message text (called from CHARACTER_MESSAGE_RENDERED).
//     MESSAGE_RECEIVED may fire before streaming completes the trailing tags,
//     so the first scan misses them. This re-processes them on full text.
export function rescanMessage(fullText, messageIndex) {
    const chat = SillyTavern.getContext().chat || [];
    const idx = typeof messageIndex === 'number' ? messageIndex : chat.length - 1;
    // The legacy entry point uses the same deduplication and rollback path.
    // Never apply an arbitrary old answer to the current chat state.
    if (idx !== chat.length - 1 || rawTextOf(chat[idx]) !== fullText) return;
    runScan();
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function rescanStatusOnly(fullText) {
    if (!fullText) return false;
    const s = getSettings();
    if (!s.isEnabled) return false;

    const statusData = scanStatusTag(stripThink(fullText));
    if (!statusData) return false;

    applyStatusData(s, getPregnancyData(), statusData);
    saveSettingsDebounced();
    syncUI();
    setTimeout(renderInfoblock, 300);
    return true;
}

// ─── Apply RP_STATUS JSON data to pregnancy state ───
function applyStatusData(s, p, data) {
    if (!data || typeof data !== 'object') return;

    // New schema keeps {{user}} and {{char}} in explicit containers.
    // Legacy root-level status remains accepted for old chat messages.
    const userData = data.user && typeof data.user === 'object' ? data.user : data;
    let partnerData = data.partner && typeof data.partner === 'object'
        ? data.partner
        : data.char && typeof data.char === 'object'
            ? data.char
            : null;

    if (userData.subject && userData.subject !== 'user') return;
    if (partnerData?.subject && partnerData.subject !== 'char') partnerData = null;

    const applyLooks = (carrier, looks) => {
        if (!looks || typeof looks !== 'object') return;
        carrier.motherLooks ||= {};
        for (const key of ['hair','eyes']) {
            if (typeof looks[key] === 'string' && looks[key].trim()) carrier.motherLooks[key] = looks[key].trim().slice(0,80);
        }
    };
    if (isTracked('user')) applyLooks(p, userData.looks);
    if (isTracked('char')) applyLooks(getPartnerData(), partnerData?.looks);
    const applyKnowledge = (c, fact) => {
        if (!c.isPregnant || !fact || typeof fact !== 'object') return;
        if (fact.pregnancy_known === true) c.pregnancyKnown = true;
        const count = confirmedFetusCount(fact);
        if (count !== null) {
            c.fetusCount = count;
            c.fetusSex = Array.from({ length: count }, (_, i) => c.fetusSex?.[i] || '?');
            c.pregnancyKnown = true;
        }
        if (['positive', 'faint', 'negative'].includes(fact.test_result)) {
            c.lastTestResult = fact.test_result;
            if (fact.test_result !== 'negative') c.pregnancyKnown = true;
        }
    };
    if (isTracked('user')) applyKnowledge(p, userData);
    if (isTracked('char')) applyKnowledge(getPartnerData(), partnerData);

    // Internal implementation note.
    // Internal implementation note.
    if (s.realism && typeof userData.cycle_event === 'string' && !p.isPregnant) {
        const kind = userData.cycle_event.trim().toLowerCase();
        if (DISRUPTIONS[kind] && !p._cycleShift) {
            const days = disruptionShift(kind);
            if (days > 0) {
                p._cycleShift = days;
                if (s.showNotifications) {
                    showNotification(`<i class="fa-solid fa-calendar-xmark"></i> Cycle disrupted (${DISRUPTIONS[kind].label}) — delay of about ${days} days`, 'warning');
                }
            }
        }
    }


    if (p.hasBaby) {
        // Baby mode
        if (data.babies && Array.isArray(data.babies) && p.babies?.length > 0) {
            data.babies.forEach((apiB, i) => {
                if (!apiB || typeof apiB !== 'object') return;

                // Internal implementation note.
                // Internal implementation note.
                // Internal implementation note.
                const label = typeof apiB.label === 'string' ? apiB.label.trim() : '';
                const statusName = typeof apiB.name === 'string' ? apiB.name.trim() : '';
                const identity = label || statusName;
                let baby = identity
                    ? p.babies.find(b => b.name && b.name.localeCompare(identity, undefined, { sensitivity: 'base' }) === 0)
                    : null;
                const numberedLabel = label.match(/^Baby\s*(\d+)$/i);
                if (!baby && numberedLabel) baby = p.babies[Number(numberedLabel[1]) - 1];
                if (!baby) baby = p.babies[i];

                if (baby) {
                    // Internal implementation note.
                    // Internal implementation note.
                    // Internal implementation note.
                    // Internal implementation note.
                    if (apiB.name && typeof apiB.name === 'string') {
                        const cleanName = apiB.name.trim();
                        const isJunk = !cleanName
                                    || cleanName === '...'
                                    || cleanName === '…'
                                    || /^baby\s*\d*$/i.test(cleanName)
                                    || /^child\s*\d*$/i.test(cleanName)
                                    || /^\u043c\u0430\u043b\u044b\u0448\s*\d*$/i.test(cleanName)
                                    || /^unnamed$/i.test(cleanName)
                                    || /^<.*>$/.test(cleanName)
                                    || cleanName.length > 60;
                        if (!isJunk && !baby.name) {
                            // Internal implementation note.
                            baby.name = cleanName;
                        } else if (!isJunk && baby.name && baby.name !== cleanName) {
                            // Internal implementation note.
                        }
                    }
                    // Internal implementation note.
                    // Internal implementation note.
                    if (Object.hasOwn(apiB, 'mood')) baby.mood = apiB.mood || '';
                    if (Object.hasOwn(apiB, 'sleep')) baby.sleep = apiB.sleep || '';
                    if (Object.hasOwn(apiB, 'health')) baby.health = apiB.health || 'normal';
                    // Internal implementation note.
                    if (Object.hasOwn(apiB, 'feeding')) {
                        baby.feeding = apiB.feeding || '';
                        baby.feedingType = apiB.feeding || '';
                    }
                    // Internal implementation note.
                    if (Object.hasOwn(apiB, 'diaper')) {
                        baby.diaperStatus = apiB.diaper || '';
                        const cleanPatterns = /^(?:\u0447\u0438\u0441\u0442|clean|dry|\u0441\u0443\u0445)/i;
                        if (apiB.diaper) baby.diaperClean = cleanPatterns.test(apiB.diaper);
                    }
                    // Internal implementation note.
                    // Internal implementation note.
                    if (apiB.care_note) {
                        const careNote = String(apiB.care_note).trim();
                        const isGenericCareNorm =
                            /\u043a\u043e\u0440\u043c\u043b\u0435\u043d\w*\s+(?:\u043f\u043e\s+\u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044e\s+)?\u043a\u0430\u0436\u0434\u044b\u0435\s*2\s*[–—-]\s*3\s*(?:\u0447|\u0447\u0430\u0441)/i.test(careNote) ||
                            /\u0441\u043e\u043d\s*16\s*[–—-]\s*18\s*(?:\u0447|\u0447\u0430\u0441)/i.test(careNote) ||
                            /\u043a\u043e\u043b\u0438\u043a\w*.*(?:\u043f\u0438\u043a|6\s*\u043d\u0435\u0434)/i.test(careNote) ||
                            /(?:\u043f\u0430\u043c\u043f\u0435\u0440\u0441|\u043f\u043e\u0434\u0433\u0443\u0437\u043d\u0438\u043a)\w*\s*8\s*[–—-]\s*10\s*\u0440\u0430\u0437/i.test(careNote);
                        baby.careNote = isGenericCareNorm ? null : careNote;
                    }
                    if (apiB.father_name && apiB.father_name !== baby.fatherName) {
                        baby.fatherName = String(apiB.father_name).slice(0, 80);
                    }
                    // Internal implementation note.
                    // Internal implementation note.
                    // Internal implementation note.
                    if (Object.hasOwn(apiB, 'milestone') && apiB.milestone && typeof apiB.milestone === 'string') {
                        const txt = apiB.milestone.trim().slice(0, 80);
                        const junk = !txt || txt === '...' || txt === '…' || /^(?:null|none|-)$/i.test(txt);
                        if (!junk) {
                            if (!Array.isArray(baby.milestones)) baby.milestones = [];
                            const norm = txt.toLowerCase();
                            const dup = baby.milestones.some(x => (x.text || '').toLowerCase() === norm);
                            if (!dup) {
                                baby.milestones.push({
                                    text: txt,
                                    source: 'story',
                                    rpDate: p.rpDate,
                                    date: new Date().toISOString(),
                                });
                                if (baby.milestones.length > 40) {
                                    baby.milestones.splice(0, baby.milestones.length - 40);
                                }
                                if (s.showNotifications) {
                                    showNotification(`| 'Baby'}: ${txt}|<i class="fa-solid fa-trophy"></i> ${baby.name || 'Baby'}: ${txt}|| 'Baby'}: ${txt}`, 'success');
                                }
                            }
                        }
                    }
                }
            });
        }
        p._dynamic = { note: userData.note || null, _owner: 'user' };

    } else if (p.isPregnant) {
        // Pregnancy mode
        if (userData.mood) p.mood = userData.mood;
        if (userData.libido) p.libido = userData.libido;
        if (userData.weight_gain) p.weightGain = userData.weight_gain;
        if (userData.baby_activity) p.babyActivity = userData.baby_activity;
        if (!p._secondParentManual && userData.father_name && userData.father_name !== p.fatherName) {
            p.fatherName = String(userData.father_name).slice(0, 80);
        }

        // Sex reveal from RP_STATUS (in case model puts it here instead of tag)
        if (userData.sex_revealed === true && !p.fetusSexRevealed) {
            p.fetusSexRevealed = true;
            if (s.showNotifications) {
                const icons = p.fetusSex.map(sx => sx === 'M' ? '♂ boy' : '♀ girl').join(', ');
                showNotification(`<i class="fa-solid fa-baby"></i> Sex determined: ${icons}`, 'success');
            }
        }

        p._dynamic = {
            symptoms: userData.symptoms || null,
            recommendations: userData.recommendations || null,
            movements: userData.movements || null,
            swelling: userData.swelling || null,
            braxton_hicks: userData.braxton_hicks || null,
            fetal_position: userData.fetal_position || null,
            // Internal implementation note.
            // Internal implementation note.
            fetusSize: userData.fetus_size || null,
            note: userData.note || null,
            _owner: 'user',
        };

    } else {
        // Cycle mode
        p._dynamic = {
            fertility: userData.fertility || null,
            libido: userData.libido || null,
            mood: userData.mood || null,
            physical: userData.physical || null,
            note: userData.note || null,
            _owner: 'user',
        };
    }

    // Internal implementation note.
    if (partnerData && isTracked('char')) {
        const c = getPartnerData();
        const d2 = partnerData;
        if (d2.mood) c.mood = d2.mood;
        if (d2.libido) c.libido = d2.libido;
        if (d2.weight_gain) c.weightGain = d2.weight_gain;
        if (d2.baby_activity) c.babyActivity = d2.baby_activity;
        if (!c._secondParentManual && d2.father_name) c.fatherName = String(d2.father_name).slice(0, 80);
        if (d2.sex_revealed === true && c.isPregnant && !c.fetusSexRevealed) c.fetusSexRevealed = true;
        c._dynamic = c.isPregnant ? {
            symptoms: d2.symptoms || null,
            recommendations: d2.recommendations || null,
            movements: d2.movements || null,
            fetusSize: d2.fetus_size || null,
            note: d2.note || null,
            _owner: 'char',
        } : {
            fertility: d2.fertility || null,
            libido: d2.libido || null,
            mood: d2.mood || null,
            physical: d2.physical || null,
            note: d2.note || null,
            _owner: 'char',
        };
    }
}

// ─── Advance cycle day and pregnancy weeks ───

function advanceTime(s, p, daysPassed) {
    if (daysPassed <= 0) return;
    let changed = false;

    // Internal implementation note.
    if (isTracked('char')) {
        try {
            const c = getPartnerData();
            // Each selected carrier advances the same cycle model independently.
            if (!c.isPregnant && hasCycle(s, 'char')) {
                const pp = getPostpartum(c, p);
                if (!pp || pp.cycleReturned) {
                    c._dynamic = {};
                    const shift = Math.max(0, parseInt(c._cycleShift) || 0);
                    const cycleLen = 28 + shift;
                    let newDay = (c.cycleDay || 1) + daysPassed;
                    if (newDay > cycleLen) {
                        newDay = ((newDay - cycleLen - 1) % 28) + 1;
                        if (shift) c._cycleShift = 0;
                    }
                    if (newDay > 28 && !shift) newDay = ((newDay - 1) % 28) + 1;
                    c.cycleDay = newDay;
                    changed = true;
                }
            }
            if (c.isPregnant && c.conceptionDate && p.rpDate) {
                const w = Math.floor((new Date(p.rpDate).getTime() - new Date(c.conceptionDate).getTime()) / (7 * 86400000));
                const dur = s.pregnancyDuration || 40;
                if (w >= 0 && w !== c.pregnancyWeeks) {
                    c.pregnancyWeeks = w;
                    changed = true;
                }

            }
        } catch (e) { reportError('[Reproductive] partner carrier update failed:', e); }
    }

    // ── Advance cycle day (28-day cycle, wraps around) ──
    const userPostpartum = getPostpartum(p, p);
    if (!p.isPregnant && isTracked('user') && hasCycle(s, 'user') && (!userPostpartum || userPostpartum.cycleReturned)) {
        const oldDay = getCycleDay();
        // Internal implementation note.
        // Internal implementation note.
        const shift = Math.max(0, parseInt(p._cycleShift) || 0);
        const cycleLen = 28 + shift;
        let newDay = oldDay + daysPassed;
        if (newDay > cycleLen) {
            newDay = ((newDay - cycleLen - 1) % 28) + 1;
            if (shift) p._cycleShift = 0;
        }
        if (newDay > 28 && !shift) newDay = ((newDay - 1) % 28) + 1;
        p._dynamic = {};
        setCycleDay(newDay, true, false);
        changed = true;

        // Cycle milestone notifications
        if (s.showNotifications) {
            if (hasMenstrualCycle(s, 'user') && s.menstruationEnabled !== false && oldDay > 5 && newDay <= 5) {
                showNotification('<i class="fa-solid fa-droplet"></i> Menstruation started', 'info');
            }
            if (oldDay < 12 && newDay >= 12 && newDay <= 16) {
                showNotification(`<i class="fa-solid fa-fire"></i> Phase started: ${cyclePhase(s, 'user', newDay).name}`, 'warning');
            }
        }
    }

    // ── Recalculate pregnancy weeks strictly from conceptionDate ──
    if (p.isPregnant && p.conceptionDate && p.rpDate) {
        const oldWeeks = p.pregnancyWeeks;
        const conceptionTime = new Date(p.conceptionDate).getTime();
        const rpTime = new Date(p.rpDate).getTime();
        const diffMs = rpTime - conceptionTime;

        if (diffMs > 0) {
            const newW = Math.floor(diffMs / (7 * 86400000));
            const duration = s.pregnancyDuration || 40;
            if (newW !== oldWeeks) {
                p.pregnancyWeeks = newW;
                changed = true;

                // ── Milestone notifications ──
                if (s.showNotifications && newW > oldWeeks) {
                    if (oldWeeks < 13 && newW >= 13)
                        showNotification('<i class="fa-solid fa-leaf"></i> Second trimester — morning sickness eases, energy returns', 'success');
                    if (oldWeeks < 28 && newW >= 28)
                        showNotification('<i class="fa-solid fa-baby"></i> Third trimester — final stretch!', 'info');
                    if (oldWeeks < 8 && newW >= 8)
                        showNotification('<i class="fa-solid fa-heart-pulse"></i> 8 weeks — fetal heartbeat can be detected', 'info');
                    if (oldWeeks < 12 && newW >= 12)
                        showNotification('<i class="fa-solid fa-stethoscope"></i> 12 weeks — time for the first screening', 'info');
                    if (oldWeeks < 20 && newW >= 20)
                        showNotification('<i class="fa-solid fa-cake-candles"></i> 20 weeks — halfway point! Anatomy ultrasound', 'success');
                    if (oldWeeks < 24 && newW >= 24)
                        showNotification('<i class="fa-solid fa-shield-halved"></i> 24 weeks — fetus may be viable outside the womb', 'info');
                    if (oldWeeks < 36 && newW >= 36)
                        showNotification('<i class="fa-solid fa-suitcase-medical"></i> 36 weeks — time to pack the hospital bag', 'warning');

                    const oldMonth = Math.floor(oldWeeks / 4);
                    const newMonth = Math.floor(newW / 4);
                    if (newMonth > oldMonth && newW !== 8 && newW !== 12 && newW !== 20 && newW !== 24 && newW !== 28 && newW !== 36) {
                        showNotification(`<i class="fa-solid fa-calendar-check"></i> ${newW} weeks — lunar month ${newMonth + 1}`, 'info');
                    }

                    if (newW >= duration && oldWeeks < duration) {
                        showNotification('<i class="fa-solid fa-hospital"></i> Due date reached. Birth is recorded from the scene event.', 'warning');
                    }
                }

                // ── Reveal planned complications whose week has arrived ──
                revealPlannedComplications(s, p, oldWeeks, newW);
            }


        }
    }

    // Internal implementation note.
    if (p.hasBaby && p.babies && p.babies.length > 0 && p.rpDate) {
        try { updateBabyCare(); } catch (e) { reportError('[Reproductive] baby-care update failed:', e); }
        maybeGraduateBabies(s, p);
    }

    if (changed) {
        saveSettingsDebounced();
    }
}

// Internal implementation note.
let _graduationDialogShowing = false;
function maybeGraduateBabies(s, p) {
    if (_graduationDialogShowing) return;
    try {
        // Internal implementation note.
        import('./pregnancy.js').then(mod => {
            const graduates = mod.checkBabyGraduation();
            if (!graduates || graduates.length === 0) return;
            if (_graduationDialogShowing) return;
            _graduationDialogShowing = true;
            import('./notifications.js').then(nMod => {
                nMod.showGraduationDialog(graduates, () => {
                    mod.graduateBabies(graduates);
                    _graduationDialogShowing = false;
                    setTimeout(renderInfoblock, 300);
                });
            }).catch(e => {
                // Internal implementation note.
                mod.graduateBabies(graduates);
                _graduationDialogShowing = false;
            });
        }).catch(e => {
            reportError('[Reproductive] graduation handling error:', e);
        });
    } catch (e) { reportError('[Reproductive] baby graduation error:', e); }
}

// ─── Reveal planned complications when their week arrives ───

function revealPlannedComplications(s, p, oldWeeks, newWeeks) {
    if (!p._plannedComplications || p._plannedComplications.length === 0) return;
    for (const pc of p._plannedComplications) {
        if (pc.revealed) continue;
        if (pc.revealWeek > oldWeeks && pc.revealWeek <= newWeeks) {
            pc.revealed = true;
            p.complications.push({
                week: pc.revealWeek,
                type: pc.type,
                severity: pc.severity,
                description: pc.type,
                rpDate: p.rpDate,
                date: new Date().toISOString(),
                resolved: false,
            });
            if (pc.severity === 'critical') {
                p.healthStatus = 'critical';
            } else if (p.healthStatus === 'normal') {
                p.healthStatus = 'warning';
            }
            if (s.showNotifications) {
                const icon = pc.severity === 'critical'
                    ? '<i class="fa-solid fa-circle-exclamation"></i>'
                    : '<i class="fa-solid fa-triangle-exclamation"></i>';
                showNotification(`${icon} Complication (${pc.revealWeek} weeks): ${pc.type}`, pc.severity === 'critical' ? 'warning' : 'info');
            }
        }
    }
}

// ─── Infoblock rendering ───

export function renderInfoblock() {
    const s = getSettings();
    const pos = s.infoblockPosition;
    if (!s.isEnabled || !pos || pos === 'off') {
        document.querySelectorAll('.rp-infoblock-inserted').forEach(el => el.remove());
        return;
    }

    const html = buildInfoblockHtml();
    if (!html) { document.querySelectorAll('.rp-infoblock-inserted').forEach(el => el.remove()); return; }

    const allMessages = document.querySelectorAll('.mes:not([is_system="true"])');
    let lastBotMsg = null;
    for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        // Internal implementation note.
        if (msg.getAttribute('is_user') === 'false' && !msg.classList.contains('gp-sms-hidden')) {
            lastBotMsg = msg;
            break;
        }
    }
    if (!lastBotMsg) return;
    const mesText = lastBotMsg.querySelector('.mes_text');
    if (!mesText) return;

    const existing = mesText.querySelector('.rp-infoblock-inserted');
    if (existing && existing._reproHtml === html && existing._reproPos === pos) return;
    document.querySelectorAll('.rp-infoblock-inserted').forEach(el => el.remove());
    const wrapper = document.createElement('div');
    wrapper._reproHtml = html;
    wrapper._reproPos = pos;
    wrapper.className = 'rp-infoblock-inserted';
    wrapper.innerHTML = html;

    if (pos === 'top') {
        mesText.insertBefore(wrapper, mesText.firstChild);
    } else {
        mesText.appendChild(wrapper);
    }

    // Internal implementation note.
    wrapper.querySelectorAll('.repro-baby-name').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const idx = parseInt(el.getAttribute('data-baby-idx'));
            const p = getPregnancyData();
            if (!p.babies || !p.babies[idx]) return;
            const current = p.babies[idx].name || '';
            const newName = prompt('Baby name:', current);
            if (newName === null) return; // Internal implementation note.
            const cleanName = newName.trim().slice(0, 60);
            p.babies[idx].name = cleanName;
            // Internal implementation note.
            if (idx === 0) p.babyName = cleanName;
            try { saveSettingsDebounced(); } catch (e) { reportError('[Reproductive] handled exception:', e); }
            renderInfoblock();
        });
    });
}

// ─── Event handler ───

const TURN_GUARDS = ['_lastConceptionRollAt', '_lastCharConceptionRollAt',
    '_conceptionBlockedUntilUser', '_conceptionBlockedUntilChar',
    '_birthBlockedUntilUser', '_birthBlockedUntilChar'];

function captureTurnBaseline(pos) {
    const p = getPregnancyData(), s = getSettings();
    _preRegenSnapshot = snapshotOf(p);
    _snapshotChatId = getCurrentChatId();
    p._turnBaseline = { pos, state: _preRegenSnapshot,
        guards: Object.fromEntries(TURN_GUARDS.map(k => [k, s[k] ?? null])) };
}

function restoreTurnBaseline(pos) {
    const p = getPregnancyData(), s = getSettings();
    let baseline = p._turnBaseline;
    // Upgrade old saves: their previous committed message is the available baseline.
    if (!baseline && s._lastScannedPosition === pos) {
        const prev = (p._history || []).filter(h => h.pos < pos).sort((a,b) => b.pos-a.pos)[0];
        if (prev) baseline = { pos, state: prev.state, guards: {} };
    }
    if (!baseline || baseline.pos !== pos) return false;
    const history = (p._history || []).filter(h => h.pos < pos);
    const restored = snapshotOf(baseline.state);
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, restored, { _history: history, _turnBaseline: baseline });
    for (const k of TURN_GUARDS) s[k] = baseline.guards?.[k] ?? null;
    _preRegenSnapshot = snapshotOf(p);
    _snapshotChatId = getCurrentChatId();
    saveSettingsDebounced();
    return true;
}

export function markRegeneration({ newReply = false } = {}) {
    const chat = SillyTavern.getContext().chat;
    const msg = chat?.[chat.length - 1];
    if (newReply && msg?.extra?.reproRaw) {
        // A fresh generation can produce identical prose without the old event tag.
        // Clone extra so metadata of an already saved swipe remains intact.
        msg.extra = { ...msg.extra, reproRawInvalid: true };
    }
    if (_isRegeneration) return;
    _isRegeneration = true;
    // Restore BEFORE generating too, so the model receives the correct state.
    if (restoreTurnBaseline(chat?.length || 0)) {
        updatePromptInjection();
        syncUI();
    }
}

// Called for every host generation, even if no MESSAGE_SENT event is emitted
// (regenerate, swipe, continue and prompt preview). No additional prompt slot.
export function prepareGeneration(genType, dryRun = false) {
    if (!dryRun && (genType === 'regenerate' || genType === 'swipe')) {
        markRegeneration({ newReply: true });
    }
    updatePromptInjection();
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function setManualCycleDay(who, day) {
    if (!['user','char'].includes(who)) return false;
    const p = getPregnancyData(), c = who === 'char' ? getPartnerData() : p;
    if (c.isPregnant) return false;
    const value = Math.max(1, Math.min(28, parseInt(day) || 1));
    c.cycleDay = value;
    c._cycleShift = 0;
    c._dynamic = {};
    c._userSetCycleAt = Date.now();
    c._manualCyclePosition = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext().chat?.length || 0 : 0;
    // Synchronous commit before another regeneration event can restore an older snapshot.
    refreshRegenSnapshot();
    saveSettingsDebounced();
    updatePromptInjection();
    return value;
}

export function refreshRegenSnapshot() {
    try {
        const p = getPregnancyData();
        _preRegenSnapshot = snapshotOf(p);
        _snapshotChatId = getCurrentChatId();
        // Internal implementation note.
        try {
            const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : null;
            const len = ctx?.chat?.length ?? 0;
            if (len > 0) { captureTurnBaseline(len); pushStateHistory(len); }
        } catch (e) { reportError('[Reproductive] turn baseline error:', e); }
    } catch (e) { reportError('[Reproductive] regeneration snapshot error:', e); }
}

export async function onMessageReceived(messageIndex, type) {
    if (type === 'quiet') return;
    runScan();
}

// User-side scan: triggered from MESSAGE_SENT so player descriptions
// Internal implementation note.
export async function onMessageSent(messageIndex, type) {
    if (type === 'quiet') return;
    runScan();
}

// ─── Process RP_DATE tag from text (can be called from index.js on render) ───

export function processDateTag(text) {
    if (!text) return false;
    text = stripThink(text);
    const s = getSettings();
    const rpDate = scanDateTag(text);
    if (!rpDate) return false;

    const p = getPregnancyData();
    // Internal implementation note.
    if (rpDate.rpTime) {
        p.rpTime = rpDate.rpTime;
    }
    let prevRaw = p._lastRpDateTag || p.rpDate;

    // Bootstrap: if no previous date stored, scan chat history
    if (!prevRaw) {
        const chat = typeof SillyTavern?.getContext === 'function'
            ? SillyTavern.getContext().chat : window.chat;
        if (chat) {
            for (let i = chat.length - 2; i >= 0; i--) {
                const msg = chat[i];
                if (msg && msg.mes && !msg.is_system) {
                    const prev = scanDateTag(stripThink(rawTextOf(msg)));
                    if (prev) {
                        prevRaw = prev.toISOString();
                        break;
                    }
                }
            }
        }
    }

    // Same date as last stored? Skip
    const newIso = rpDate.toISOString();
    if (p._lastRpDateTag === newIso) return false;

    p._lastRpDateTag = newIso;
    p.rpDate = newIso;

    // ── Anchor pregnancy to RP timeline ──
    // If conception was set manually (or before any RP_DATE was seen), conceptionDate is
    // anchored to real-world time. On the FIRST RP_DATE we see, re-anchor so that the
    // accumulated pregnancyWeeks are preserved and start ticking from the RP timeline.
    for (const c of [p, getPartnerData()]) {
        if (c.isPregnant && (!c._conceptionAnchored || !c.conceptionDate)) {
            const weeks = Math.max(0, c.pregnancyWeeks || 0);
            c.conceptionDate = new Date(rpDate.getTime() - weeks * 7 * 86400000).toISOString();
            c._conceptionAnchored = true;
        }
    }

    // Clamp: if rpDate < conceptionDate (model rewound time), pull conceptionDate back
    // Internal implementation note.
    // Internal implementation note.
    if (p.isPregnant && p.conceptionDate && new Date(p.conceptionDate).getTime() > rpDate.getTime()) {
        const userSetMs = p._userSetWeeksAt || 0;
        const minutesSinceUserSet = (Date.now() - userSetMs) / 60000;
        const recentlyUserSet = userSetMs > 0 && minutesSinceUserSet < 30;
        if (recentlyUserSet) {
        } else {
            const w = Math.max(0, p.pregnancyWeeks || 0);
            // Preserve weeks: shift conceptionDate to (rpDate - weeks*7d)
            p.conceptionDate = new Date(rpDate.getTime() - w * 7 * 86400000).toISOString();
        }
    }

    if (prevRaw) {
        const prev = new Date(prevRaw);
        const diffMs = rpDate.getTime() - prev.getTime();
        // Cycle days follow RP calendar dates, not rounded partial days.
        const calendarDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
        const diffDays = calendarDay(rpDate) - calendarDay(prev);
        if (diffDays > 0 && diffDays <= 365) {
            advanceTime(s, p, diffDays);
            saveSettingsDebounced();
            syncUI();
            updatePromptInjection();
            setTimeout(renderInfoblock, 500);
            return true;
        } else if (diffDays < 0) {
        }
    } else {
        saveSettingsDebounced();
    }
    return false;
}

export function setManualPregnancyWeeks(who, value) {
    if (!['user','char'].includes(who)) return false;
    const p = getPregnancyData(), c = who === 'char' ? getPartnerData() : p;
    if (!c.isPregnant) return false;
    const weeks = Math.max(0, Math.min(100, parseInt(value) || 0));
    const anchor = p.rpDate ? new Date(p.rpDate) : null;
    c.pregnancyWeeks = weeks;
    c.conceptionDate = anchor && Number.isFinite(anchor.getTime())
        ? new Date(anchor.getTime() - weeks * 7 * 86400000).toISOString() : null;
    c._conceptionAnchored = !!c.conceptionDate;
    c._userSetWeeksAt = Date.now();
    refreshRegenSnapshot();
    saveSettingsDebounced();
    updatePromptInjection();
    return weeks;
}

export function prepareTrackerOutput(msg) {
    if (!msg || msg.is_user || !getSettings().isEnabled) return false;
    const current = msg.mes || '';
    if (/\[RP_DATE[:\s]/i.test(current)) return false;
    const date = scanDateTag(stripThink(current));
    if (!date?.rpTime) return false;
    const pad = n => String(n).padStart(2, '0');
    // Canonicalize the explicit clock already supplied by the phone extension.
    msg.mes = current + `\n<!-- [RP_DATE:${pad(date.getDate())}.${pad(date.getMonth()+1)}.${date.getFullYear()} ${date.rpTime}] -->`;
    if (Array.isArray(msg.swipes) && msg.swipes[msg.swipe_id] === current) msg.swipes[msg.swipe_id] = msg.mes;
    return true;
}

export function filterTrackerContext(messages) {
    // SillyTavern passes coreChat, a prompt copy. Replace entries rather than
    // mutating shared message objects or deleting the tags in the saved chat.
    for (let i = 0; i < messages.length; i++) {
        if (typeof messages[i]?.mes !== 'string') continue;
        const clean = stripReproTags(messages[i].mes);
        if (clean !== messages[i].mes) messages[i] = { ...messages[i], mes: clean };
    }
    updatePromptInjection();
}

export function setSecondParent(who, name) {
    if (!['user','char'].includes(who)) return false;
    const carrier = who === 'char' ? getPartnerData() : getPregnancyData();
    if (!carrier.isPregnant) return false;
    carrier.fatherName = String(name || '').trim().slice(0,80);
    carrier._secondParentManual = true;
    refreshRegenSnapshot();
    saveSettingsDebounced();
    syncUI();
    updatePromptInjection();
    renderInfoblock();
    return true;
}
