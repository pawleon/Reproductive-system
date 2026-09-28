import { reportError } from './diagnostics.js';
// ═══════════════════════════════════════════
// INDEX — extension entry point
// ═══════════════════════════════════════════

import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { extensionName, defaultSettings } from './config.js';
import { getSettings, getPregnancyData, getCurrentChatId, resetChatIdCache, resetFallback } from './state.js';
import { initCustomNotifications } from './notifications.js';
import { setSyncUI, setUpdatePromptInjection, setRenderInfoblock } from './pregnancy.js';
import { updatePromptInjection } from './prompts.js';
import { syncUI, setupUI } from './ui.js';
import { onMessageReceived, onMessageSent, renderInfoblock, markRegeneration, prepareGeneration, processDateTag, rescanStatusOnly, rollbackToPosition, clearRegenState, detachTags, rawTextOf, prepareTrackerOutput, filterTrackerContext } from './message-handler.js';
import { stripHiddenTags, scanFullHistory } from './scanner.js';

window.reproductiveSystemContextFilter = filterTrackerContext;

// ── Load CSS ──
const cssId = 'reproductive-system-css';
if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(link);
}

function loadSettings() {
    try {
        if (!extension_settings[extensionName]) {
            extension_settings[extensionName] = structuredClone(defaultSettings);
        } else {
            const s = extension_settings[extensionName];
            // Migrate before defaults can overwrite an older tracking choice.
            if (!['user', 'char', 'both', 'none'].includes(s.carrierMode)) {
                s.carrierMode = ['user', 'char', 'both', 'none'].includes(s.trackFor) ? s.trackFor : 'user';
            }

            // Migrate legacy data
            if (s.isPregnant !== undefined && !s.chatPregnancyData) {
                s.chatPregnancyData = {};
                const chatId = getCurrentChatId();
                if (chatId && s.isPregnant) {
                    s.chatPregnancyData[chatId] = {
                        isPregnant: s.isPregnant,
                        conceptionDate: s.conceptionDate,
                        pregnancyWeeks: s.pregnancyWeeks,
                        rpDate: s.rpDate,
                        fetusCount: s.fetusCount,
                        fetusSex: s.fetusSex,
                        complications: s.complications || [],
                        healthStatus: s.healthStatus || 'normal',
                        lastComplicationCheck: s.lastComplicationCheck,
                    };
                }
                delete s.isPregnant;
                delete s.conceptionDate;
                delete s.pregnancyWeeks;
                delete s.rpDate;
                delete s.fetusCount;
                delete s.fetusSex;
                delete s.complications;
                delete s.healthStatus;
                delete s.lastComplicationCheck;
            }

            // Remove obsolete fields
            delete s.racePreset;
            delete s.fertilityModifier;
            delete s.customRaceName;
            delete s.specialTraits;

            // Migrate shared contraception into separate carrier settings.
            // Keep the legacy field as an alias for {{user}} so old configs remain compatible.
            const legacyContraception = s.contraception || 'none';
            if (s.contraceptionUser === undefined) s.contraceptionUser = legacyContraception;
            if (s.contraceptionChar === undefined) s.contraceptionChar = legacyContraception;

            // Add new fields. Clone objects/arrays so settings do not share references to defaults.
            for (const key in defaultSettings) {
                if (s[key] === undefined) {
                    s[key] = structuredClone(defaultSettings[key]);
                }
            }
            s.contraception = s.contraceptionUser || 'none';

            // ── Repair broken conceptionDate (real-world Date stored vs RP rpDate) ──
            // Old bug: checkConception fell back to `new Date()` when rpDate was missing,
            // creating a real-world ISO that's far ahead of the RP timeline → weeks=0 forever.
            if (s.chatPregnancyData) {
                for (const cid in s.chatPregnancyData) {
                    const cp = s.chatPregnancyData[cid];
                    if (!cp || !cp.isPregnant) continue;

                    // Backfill _conceptionAnchored flag for existing saves
                    if (cp._conceptionAnchored === undefined) {
                        if (cp.conceptionDate && cp.rpDate) {
                            const ct = new Date(cp.conceptionDate).getTime();
                            const rt = new Date(cp.rpDate).getTime();
                            const diffWeeks = (rt - ct) / (7 * 86400000);
                            // Anchored if math matches pregnancyWeeks within 1 week
                            cp._conceptionAnchored = (diffWeeks >= 0 && Math.abs(diffWeeks - (cp.pregnancyWeeks || 0)) <= 1);
                        } else {
                            cp._conceptionAnchored = false;
                        }
                    }

                    if (cp.conceptionDate && cp.rpDate) {
                        const ct = new Date(cp.conceptionDate).getTime();
                        const rt = new Date(cp.rpDate).getTime();
                        if (ct > rt) {
                            // Preserve pregnancyWeeks by shifting conceptionDate backwards from rpDate
                            const w = Math.max(0, cp.pregnancyWeeks || 0);
                            cp.conceptionDate = new Date(rt - w * 7 * 86400000).toISOString();
                            cp._conceptionAnchored = true;
                        }
                    }
                }
            }
        }
    } catch (error) {
        reportError('[Reproductive] Error loading settings:', error);
        extension_settings[extensionName] = structuredClone(defaultSettings);
    }
}

function refreshAfterChatChange(attempt = 1) {
    const MAX_ATTEMPTS = 6;
    const chatId = getCurrentChatId();
    syncUI();
    updatePromptInjection();
    renderInfoblock();
    if (!chatId && attempt < MAX_ATTEMPTS) {
        setTimeout(() => refreshAfterChatChange(attempt + 1), 200);
        return;
    }
    if (chatId) {
        maybeBootstrapFromHistory();
    }
}

// Auto-bootstrap: when the extension is enabled for a fresh chat that already has history,
// scan the history and restore dates, conception, birth, and pregnancy timing from text.
// This covers chats that started before the extension was enabled.
let _bootstrapRunning = false;
async function maybeBootstrapFromHistory() {
    if (_bootstrapRunning) return;
    try {
        const s = getSettings();
        if (!s.isEnabled) return;
        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat;
        if (!chat || chat.length < 2) return;

        const p = getPregnancyData();
        if (p._bootstrapDone) return;

        // Virgin state means this chat has not been tracked by the extension yet
        const virgin = !p.isPregnant && !p.hasBaby && !p.rpDate
            && (!Array.isArray(p._history) || p._history.length === 0);
        p._bootstrapDone = true;
        if (!virgin) {
            saveSettingsDebounced();
            return;
        }

        _bootstrapRunning = true;
        const stats = await scanFullHistory();
        getPregnancyData()._bootstrapDone = true; // scanFullHistory resets state, so restore the flag
        saveSettingsDebounced();
        syncUI();
        updatePromptInjection();
        setTimeout(renderInfoblock, 300);
    } catch (e) { reportError('[Reproductive] bootstrap error:', e); } finally {
        _bootstrapRunning = false;
    }
}

jQuery(async () => {
    try {

        loadSettings();

        // Wire circular dependencies
        setSyncUI(syncUI);
        setUpdatePromptInjection(updatePromptInjection);
        setRenderInfoblock(renderInfoblock);

        initCustomNotifications();
        setupUI();
        updatePromptInjection();

        // Scan when a new message arrives (main path)
        eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);

        // Final scan, infoblock rendering, and tag hiding.
        // rescanStatusOnly idempotently rereads RP_STATUS from the full text.
        const finalStatusSeen = new WeakMap();
        const processFinalMessage = (messageIndex) => {
            try {
                const context = SillyTavern.getContext();
                let idx = messageIndex;
                // GENERATION_ENDED gives chat.length, not message index — adjust
                if (typeof idx !== 'number' || idx >= context.chat.length) {
                    idx = context.chat.length - 1;
                }
                const msg = context.chat[idx];
                if (!msg || !msg.mes || msg.is_user) {
                    setTimeout(renderInfoblock, 200);
                    return;
                }
                // Scan before stripping tags; after that RP_STATUS cannot be restored from msg.mes.
                try {
                    const raw = rawTextOf(msg);
                    if (finalStatusSeen.get(msg) !== raw) {
                        rescanStatusOnly(raw);
                        finalStatusSeen.set(msg, raw);
                    }
                } catch (e) { reportError('[Reproductive] message rescan error:', e); }
                // Keep technical comments in the saved source; HTML already hides them.
                if (prepareTrackerOutput(msg)) {
                    processDateTag(msg.mes);
                    if (context.saveChat) context.saveChat();
                }
                // Hide tags only in the rendered DOM. Keep msg.mes intact so technical comments
                // remain available for rescans, swipes, and reopening the chat.
                if (
                    msg.mes.includes('<!--') &&
                    (msg.mes.includes('[CONCEPTION_CHECK]') ||
                     msg.mes.includes('[BIRTH]') ||
                     msg.mes.includes('[MISCARRIAGE]') ||
                     msg.mes.includes('[ABORTION]') ||
                     msg.mes.includes('[SEX_REVEAL]') ||
                     msg.mes.includes('[CYCLE_DAY') ||
                     msg.mes.includes('[RP_STATUS:') ||
                     msg.mes.includes('[RP_DATE:') ||
                     msg.mes.includes('[PREGNANCY_STATE:') ||
                     msg.mes.includes('[BABY_TRAITS:'))
                ) {
                    // In debug mode, keep tags visible in chat for troubleshooting
                    const s = getSettings();
                    if (true) {
                        const renderedMessage = document.querySelector(`.mes[mesid="${idx}"] .mes_text`);
                        if (renderedMessage) {
                            renderedMessage.innerHTML = stripHiddenTags(renderedMessage.innerHTML);
                        }
                    }
                }
            } catch (e) { reportError('[Reproductive] message processing error:', e); }
            setTimeout(renderInfoblock, 300);
        };

        // Fallback: render the infoblock and hide tags after a non-streaming message is rendered
        if (event_types.CHARACTER_MESSAGE_RENDERED) {
            eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, processFinalMessage);
        }

        // GENERATION_ENDED is the hook for streaming swipe/continue.
        // Scan before processFinalMessage because stripping removes tags from msg.mes.
        if (event_types.GENERATION_ENDED) {
            eventSource.on(event_types.GENERATION_ENDED, (messageIndex) => {
                // 1) Scan the full text while tags are still present
                try { onMessageReceived(messageIndex, 'final'); } catch (e) { reportError('[Reproductive] handled exception:', e); }
                // 2) Then strip tags and render the infoblock
                processFinalMessage(messageIndex);
            });
        }

        // Update on user message send; also scan user text for explicit reproductive events.
        eventSource.on(event_types.MESSAGE_SENT, (messageIndex, type) => {
            updatePromptInjection();
            onMessageSent(messageIndex, type);
            setTimeout(renderInfoblock, 500);
        });

        // Regeneration / swipe — mark so time doesn't double-count
        if (event_types.MESSAGE_SWIPED) {
            eventSource.on(event_types.MESSAGE_SWIPED, () => {
                markRegeneration();
            });
        }
        if (event_types.GENERATION_STARTED) {
            // GENERATION_STARTED fires before the user message is added to chat,
            // so regeneration is determined from the explicit generation type in the first argument.
            eventSource.on(event_types.GENERATION_STARTED, (genType, params, dryRun) => {
                prepareGeneration(genType, dryRun);
            });
        }

        // Re-render infoblock after message edit/swipe
        if (event_types.MESSAGE_EDITED) {
            eventSource.on(event_types.MESSAGE_EDITED, () => {
                setTimeout(renderInfoblock, 400);
            });
        }
        if (event_types.MESSAGE_UPDATED) {
            eventSource.on(event_types.MESSAGE_UPDATED, () => {
                setTimeout(renderInfoblock, 400);
            });
        }

        // Chat change
        if (event_types.CHAT_CHANGED) {
            eventSource.on(event_types.CHAT_CHANGED, () => {
                // Guard: many ST operations emit CHAT_CHANGED even for small metadata updates
                // (e.g. filename/timestamp updates). Only perform a full reset when the
                // resolved chatId actually changes. Otherwise keep per-chat data intact.
                try {
                    const prevId = getCurrentChatId();
                    // Allow ST to update context, then re-resolve
                    setTimeout(() => {
                        // Clear cached resolution and obtain fresh id
                        resetChatIdCache();
                        const newId = getCurrentChatId();
                            const s = getSettings();
                            // Consider same logical chat carefully:
                            // - If either id is a uuid: prefix, compare uuids exactly.
                            // - If both are 'file:' or plain strings, compare normalized base names
                            //   (strip ms suffix). Treat mixed types as different to avoid
                            //   accidentally merging distinct chats.
                            const isSame = (() => {
                                try {
                                    // If both ids are unknown, treat the chats as different; otherwise fallback state can leak across chats.
                                    if (prevId == null && newId == null) return false;
                                    if (prevId === newId) return true;
                                    const parseId = (id) => {
                                        if (!id) return { type: null, val: null, base: null };
                                        const s = String(id);
                                        const m = s.match(/^([^:]+):(.+)$/);
                                        if (m) {
                                            const type = m[1];
                                            const val = m[2];
                                            const base = String(val).replace(/\s-\s\d{4}-\d{2}-\d{2}@.*$/, '').replace(/\s@\d{4}-\d{2}-\d{2}@.*$/, '');
                                            return { type, val, base };
                                        }
                                        return { type: 'plain', val: s, base: s.replace(/\s-\s\d{4}-\d{2}-\d{2}@.*$/, '').replace(/\s@\d{4}-\d{2}-\d{2}@.*$/, '') };
                                    };
                                    const a = parseId(prevId);
                                    const b = parseId(newId);
                                    // If either is uuid, require exact match
                                    if (a.type === 'uuid' || b.type === 'uuid') return a.type === b.type && a.val === b.val;
                                    // If both have the same typed val, treat same
                                    if (a.type && b.type && a.type === b.type && a.val === b.val) return true;
                                    // If both are file/plain compare base
                                    const allowed = (t) => t === 'plain' || t === 'file';
                                    if (allowed(a.type) && allowed(b.type)) return a.base === b.base;
                                    return false;
                                } catch (e) { return false; }
                            })();

                            if (isSame) {
                                // Same logical chat — do not wipe fallback or per-chat storage.
                                s._lastScannedPosition = null;
                                s._processedMessageHashes = {};
                                // Quick UI refresh to pick up any metadata changes
                                refreshAfterChatChange(1);
                                return;
                            }

                        // Different chat — perform full reset as before
                        resetFallback();
                        clearRegenState(); // regeneration snapshot from the old chat must not survive a chat change
                        s._lastScannedPosition = null;
                        s._lastScannedHash = null;
                        s._lastScannedHashStripped = null;
                        s._lastConceptionRollAt = null;
                        s._processedMessageHashes = {};
                        setTimeout(() => refreshAfterChatChange(1), 100);
                    }, 80);
                } catch (e) {
                    // Fallback to previous behavior on error
                    resetChatIdCache();
                    resetFallback();
                    clearRegenState();
                    const s = getSettings();
                    s._lastScannedPosition = null;
                    s._lastScannedHash = null;
                    s._lastScannedHashStripped = null;
                    s._lastConceptionRollAt = null;
                    s._processedMessageHashes = {};
                    setTimeout(() => refreshAfterChatChange(1), 100);
                }
            });
        }

        // Message deletion rolls state back to the snapshot from the previous position.
        // Example: a message caused conception, then is deleted; pregnancy is rolled back.
        // ST emits MESSAGE_DELETED with the new chat length after deletion.
        if (event_types.MESSAGE_DELETED) {
            eventSource.on(event_types.MESSAGE_DELETED, (newLength) => {
                const s = getSettings();
                s._lastScannedPosition = null;
                s._lastScannedHash = null;
                s._lastScannedHashStripped = null;
                s._lastConceptionRollAt = null;
                try {
                    const len = typeof newLength === 'number'
                        ? newLength
                        : (SillyTavern.getContext()?.chat?.length ?? 0);
                    const rolled = rollbackToPosition(len);
                } catch (e) { reportError('[Reproductive] rollback error:', e); }
                saveSettingsDebounced();
                syncUI();
                updatePromptInjection();
                setTimeout(renderInfoblock, 300);
            });
        }

        // ── MutationObserver: re-insert infoblock if ST removes it during re-render ──
        // Continue/edit/swipe rebuild .mes_text, wiping our injected element.
        // Watch the chat container and re-render when the last bot message changes.
        try {
            const chatEl = document.getElementById('chat');
            if (chatEl) {
                let pending = false;
                const reinsert = () => {
                    if (pending) return;
                    pending = true;
                    setTimeout(() => {
                        pending = false;
                        try {
                            // Only re-insert if our block is missing from the last bot message
                            const all = document.querySelectorAll('.mes:not([is_system="true"])');
                            let lastBot = null;
                            for (let i = all.length - 1; i >= 0; i--) {
                                if (all[i].getAttribute('is_user') === 'false' && !all[i].classList.contains('gp-sms-hidden')) { lastBot = all[i]; break; }
                            }
                            if (!lastBot) return;
                            if (!lastBot.querySelector('.rp-infoblock-inserted')) {
                                renderInfoblock();
                            }
                        } catch (e) { reportError('[Reproductive] infoblock refresh error:', e); }
                    }, 150);
                };
                const observer = new MutationObserver((mutations) => {
                    const s = getSettings();
                    if (!s.isEnabled || !s.infoblockPosition || s.infoblockPosition === 'off') return;
                    for (const m of mutations) {
                        // Watch for child changes inside .mes_text and new messages added
                        if (m.target && (m.target.classList?.contains('mes_text') || m.target.classList?.contains('mes'))) {
                            reinsert();
                            return;
                        }
                        // Also re-insert when nodes are removed (our block got wiped)
                        for (const n of m.removedNodes || []) {
                            if (n.classList?.contains('rp-infoblock-inserted')) {
                                reinsert();
                                return;
                            }
                        }
                    }
                });
                observer.observe(chatEl, { childList: true, subtree: true });
            }
        } catch (e) { reportError('[Reproductive] observer setup error:', e); }

    } catch (error) {
        reportError('[Reproductive] FATAL ERROR:', error);
    }
});
