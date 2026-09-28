import { reportError } from './diagnostics.js';
import { setExtensionPrompt, extension_prompts, extension_prompt_types, extension_prompt_roles } from '../../../../script.js';
import { extensionName } from './config.js';
import { getSettings, getPregnancyData, getPartnerData, getCycleDay, isTracked, getContraception } from './state.js';
import { isOmegaverse, hasMenstrualCycle, hasAnyTracking, canCarry, hasCycle, designationOf, cyclePhase } from './omegaverse.js';
import { pregnancyIsKnown, getPostpartum, monthsTrying } from './pregnancy.js';
import { fertileWindow, conceptionStruggle } from './fertility.js';
import { getFlow, getHygieneState, realismPromptLine, hoursBetween } from './cycle-realism.js';
import { calculateWeeksFromDates, detectChatLanguage } from './helpers.js';
import { babyAgeDays, getCareNeeds } from './baby-care.js';

/*
 * LLM prompt is intentionally compact.
 * JavaScript remains authoritative for state; the model only gets the current
 * state plus the few rules needed to narrate it and emit scanner tags.
 */
function langRequirement() {
    const lang = detectChatLanguage();
    const langName = lang === 'ru' ? 'Russian' : 'English';
    return { lang, langName, line: `RP_STATUS text values must be in ${langName}. Keep values short (2–5 words).` };
}

function sexToText(arr) {
    if (!arr?.length) return '';
    return arr.map(s => s === 'M' ? 'boy' : 'girl').join(', ');
}

function carrierCycleLine(who, s) {
    if (!hasAnyTracking(s, who)) return '';
    if (!hasCycle(s, who)) return `${who}: no cycle tracking`;
    const c = who === 'char' ? getPartnerData() : getPregnancyData();
    const nm = who === 'char' ? '{{char}}' : '{{user}}';
    if (c.isPregnant) return pregnancyIsKnown(c, s) ? `${nm}: pregnant; cycle paused` : `${nm}: pregnancy private; cycle paused`;
    const pp = getPostpartum(c, getPregnancyData());
    if (pp && !pp.cycleReturned) return `${nm}: postpartum; cycle paused`;
    const day = who === 'char' ? (c.cycleDay || 1) : getCycleDay();
    return `${nm}: day ${day}/28 (${cyclePhase(s, who, day, 'en').name})`;
}

function realismBlock(s, p) {
    if (!s.realism || p.isPregnant || (s.menstruationEnabled === false && getCycleDay() <= 5)) return '';
    if (!hasMenstrualCycle(s, 'user') || !isTracked('user')) return '';
    const day = getCycleDay();
    const flow = getFlow(day);
    const hy = flow.factor > 0
        ? getHygieneState(p.hygieneType || 'pad', hoursBetween(p.hygieneChangedRpDate, p.rpDate), flow)
        : null;
    let b = `[BODY] {{user}}: ${realismPromptLine(day, hy, { lang: 'en' })}. Let it affect the scene naturally, not dominate it. Only visible/told signs are known to others.`;
    if (hy && (hy.overdue || hy.type.id === 'none')) b += ' If relevant, handle hygiene plainly.';
    b += ' If this reply contains a genuine cycle disruptor (severe stress, illness, starvation, travel, overtraining), add cycle_event to RP_STATUS; otherwise omit it.\n';
    return b;
}

function cycleScenePrompt(s) {
    let b = '';
    for (const who of ['user', 'char']) {
        if (!isTracked(who) || !hasCycle(s, who)) continue;
        const c = who === 'char' ? getPartnerData() : getPregnancyData();
        const pp = getPostpartum(c, getPregnancyData());
        if (c.isPregnant || (pp && !pp.cycleReturned)) continue;
        const d = who === 'char' ? c.cycleDay || 1 : getCycleDay();
        if (d <= 5 && canCarry(s, who) && s.menstruationEnabled !== false) {
            b += `${who}: menstruating. Reflect only scene-supported blood, hygiene, or discomfort; never force actions.\n`;
        } else if (d >= 12 && d <= 16 && isOmegaverse(s) && designationOf(s, who) !== 'beta') {
            b += `${who}: ${designationOf(s, who) === 'alpha' ? 'rut' : 'heat'}; use only scene-supported signs, never forced actions.\n`;
        }
    }
    return b;
}

function pregnancyBlock(who, s, p) {
    const c = who === 'char' ? getPartnerData() : p;
    if (!isTracked(who) || !c.isPregnant) return '';
    const known = pregnancyIsKnown(c, s);
    const nm = who === 'char' ? '{{char}}' : '{{user}}';
    const suffix = who === 'char' ? ':CHAR' : '';
    const duration = s.pregnancyDuration || 40;
    const { weeks } = calculateWeeksFromDates(c.conceptionDate, p.rpDate, c.pregnancyWeeks);
    const pct = Math.round(weeks / duration * 100);
    let b = `[PREGNANCY] ${who}=${known ? nm : 'private'}; ${weeks}/${duration} weeks; fetuses=${c.fetusCount || 1}; sex=${c.fetusSexRevealed ? sexToText(c.fetusSex) : 'unknown'}; health=${c.healthStatus || 'normal'}; cycle paused.\n`;
    if (c.fatherName) b += `parent=${JSON.stringify(c.fatherName)}.\n`;
    if (!known) b += 'Pregnancy facts are private simulation data until the scene establishes discovery.\n';
    b += 'Do not invent multiples, delivery, fetal traits, or discoveries. Due date alone is not birth.\n';
    if (duration !== 40) b += `Development scale=${pct}% of configured term.\n`;
    if (c.complications?.length) b += `Complications=${c.complications.filter(x => !x.resolved).map(x => x.type).join(', ')}.\n`;
    b += `Completed delivery only: <!-- [BIRTH${suffix}] --> and <!-- [BABY_TRAITS:{"babies":[{"name":"","fatherName":"","personality":[],"appearance":[]}]}] -->.\n`;
    b += 'Use pregnancy status fields only when relevant: libido, weight_gain, baby_activity, movements, swelling, braxton_hicks, fetal_position, recommendations.\n';
    if (!c.fetusSexRevealed) b += `If a medical reveal occurs: <!-- [SEX_REVEAL${suffix}] -->.\n`;
    if (who === 'user') b += 'Confirmed loss/termination only: <!-- [MISCARRIAGE] --> or <!-- [ABORTION] -->; never for a scare or plan.\n';
    return b;
}

function knowledgePrompt(s) {
    let b = `Pregnancy knowledge: ${s.hiddenPregnancy === false ? 'no concealment rule' : 'do not assume discovery'}. Scene tests/disclosures override missing records.\n`;
    for (const who of ['user', 'char']) {
        const c = who === 'char' ? getPartnerData() : getPregnancyData();
        if (isTracked(who) && c.isPregnant) b += `${who}: known=${!!c.pregnancyKnown}; test=${c.lastTestResult || 'none'}. `;
    }
    return b + 'Only establish pregnancy_known/test_result from actual scene evidence.\n';
}

function tryingBlock(s, p) {
    if (!s.tryingToConceive || p.isPregnant) return '';
    const w = fertileWindow(getCycleDay(), 28);
    const months = monthsTrying(p);
    const struggle = conceptionStruggle(months);
    let b = `[TRYING] {{user}} and partner are trying for a baby. `;
    b += w.fertile ? `Fertile window now${w.peak ? ', peak' : ''}; she knows and may initiate.` : `Not fertile; peak in about ${w.daysToPeak} day(s).`;
    if (months > 0) b += ` Trying ${months} month(s).`;
    if (struggle) b += ` ${struggle.label}. Reflect quietly, without forcing the scene.`;
    return b + '\n';
}

function contraceptionLine(who, s, p) {
    const c = who === 'char' ? getPartnerData() : p;
    if (c.isPregnant || !canCarry(s, who)) return '';
    const suffix = who === 'char' ? ':CHAR' : '';
    return `${who}: protection=${getContraception(who)}. Only actual internal semen release in this scene can trigger <!-- [CONCEPTION_CHECK${suffix}] -->; exclude memories, intentions, withdrawal, and external/oral release. Condom requires failure.\n`;
}

function statusTemplate(s, p) {
    const fields = c => c.isPregnant && pregnancyIsKnown(c, s)
        ? { mood: '...', symptoms: '...', fetus_count: c.fetusCount || 1, fetus_size: '...', note: '...' }
        : { libido: '...', mood: '...', physical: '...', note: '...' };
    const status = isTracked('user') && !p.hasBaby ? fields(p) : { note: '...' };
    status.subject = 'user';
    if (isTracked('char')) status.partner = { subject: 'char', ...fields(getPartnerData()) };
    if (p.hasBaby) status.babies = p.babies.map((c, i) => ({
        label: c.name || `Baby${i + 1}`, mood: '...', sleep: '...', feeding: '...', diaper: '...', care_note: '...', milestone: null
    }));
    return status;
}

export function getBasePrompt() {
    const s = getSettings(), p = getPregnancyData();
    if (!s.isEnabled) return '';
    const active = ['user', 'char'].filter(isTracked);
    if (!active.length && !p.hasBaby) return '';

    const universe = isOmegaverse(s) ? 'OMEGAVERSE' : 'NORMAL';
    let b = `[REPRO TRACKER] ${universe}. Tracked=${active.join(',') || 'none'}; carriers=${active.filter(w => canCarry(s, w)).join(',') || 'none'}. State is authoritative; do not infer anatomy/carrier status.\n`;
    if (p.rpDate) b += `RP time=${new Date(p.rpDate).toLocaleString('en-GB', { hour12: false })}; advance only by elapsed scene time.\n`;
    b += 'Identity: {{user}}=player, {{char}}=bot. Keep their states separate. Do not reveal private tracker facts without scene evidence.\n';
    if (isOmegaverse(s)) b += active.map(w => `${w}=${designationOf(s, w)}`).join(', ') + '.\n';
    b += active.map(w => carrierCycleLine(w, s)).join(' | ') + '\n';
    if (s.menstruationEnabled === false) b += 'Menstrual bleeding disabled. No hygiene reminders.\n';
    b += cycleScenePrompt(s);
    b += realismBlock(s, p);

    if (s.menstruationEnabled !== false) {
        for (const who of active) {
            const c = who === 'char' ? getPartnerData() : p;
            const pp = getPostpartum(c, p);
            if (!canCarry(s, who) || c.isPregnant || c.cycleDay > 5 || (pp && !pp.cycleReturned)) continue;
            const h = getHygieneState(c.hygieneType || 'pad', hoursBetween(c.hygieneChangedRpDate, p.rpDate), getFlow(c.cycleDay));
            if (h.needsChange) b += `${who}: hygiene needs changing; mention only if relevant/observable.\n`;
        }
    }

    if (active.some(w => (w === 'char' ? getPartnerData() : p).isPregnant)) {
        b += knowledgePrompt(s);
        b += 'Appearance comes only from established story/card facts; omit unknown hair/eye traits.\n';
    }
    for (const who of active) b += contraceptionLine(who, s, p);
    for (const who of active) b += pregnancyBlock(who, s, p);
    if (isTracked('user') && s.tryingToConceive && !p.isPregnant) b += tryingBlock(s, p);

    const { langName, line } = langRequirement();
    const status = statusTemplate(s, p);
    b += `End with exactly one hidden status tag. Values: ${langName}, short, current-scene only; omit unknown fields.\n<!-- [RP_STATUS:${JSON.stringify(status)}] -->\n`;
    b += line + '\n';
    if (p.hasBaby) b += 'Keep existing baby labels unchanged; milestone only for a new first achievement in this scene.\n';
    b += 'End with current RP time: <!-- [RP_DATE:DD.MM.YYYY HH:MM] -->. Event tags belong only in the final reply and must reflect completed/current-scene events.\n';
    return b;
}

export function getPregnancyPrompt() {
    const s = getSettings(), p = getPregnancyData();
    if (!s.isEnabled) return '';
    let b = '';
    if (p.hasBaby) b += postpartumBlock(p) + birthdayBlock(p) + compactFamily(p);
    return b;
}

function compactFamily(p) {
    let b = '[CHILDREN] Use age-appropriate behaviour and current scene needs.\n';
    for (const [i, c] of (p.babies || []).entries()) {
        const age = babyAgeDays(c, p);
        b += `${c.name || `Baby${i + 1}`}: age=${age ?? '?'}d, health=${c.health || 'normal'}, mood=${c.mood || '?'}, sleep=${c.sleep || '?'}, feeding=${c.feedingType || '?'}, diaper=${c.diaperClean === false ? 'needs changing' : 'clean'}.`;
        const needs = getCareNeeds(age, p.rpTime, c);
        b += ` Care=${[needs.feeding, needs.sleep, needs.diaper, needs.careNote].filter(Boolean).join('; ')}.\n`;
        if (c.personality?.length) b += `Personality=${c.personality.join(', ')}. `;
        if (c.appearance?.length) b += `Appearance=${c.appearance.join(', ')}. `;
        const recent = (c.milestones || []).slice(-3).map(x => x.text).filter(Boolean);
        if (recent.length) b += `Achieved=${recent.join('; ')}. `;
        b += '\n';
    }
    if (p.grownChildren?.length) b += 'Older children: ' + p.grownChildren.map(c => `${c.name || 'unnamed'} (${babyAgeDays(c, p) ?? '?'}d)`).join('; ') + '.\n';
    return b;
}

function postpartumBlock(p) {
    const pp = getPostpartum(p, p);
    if (!pp) return '';
    let b = `[POSTPARTUM] ${pp.days}d since birth; recovery=${pp.healing || 'normal'}; lochia=${pp.lochia ? 'yes' : 'no'}; breastfeeding=${pp.lactating ? 'yes' : 'no'}.\n`;
    b += pp.cycleReturned ? 'Cycle returned; conception possible.\n' : 'Cycle not returned yet.\n';
    if (pp.days < 42) b += 'Early recovery: fatigue/discomfort may matter; never force intimacy.\n';
    return b;
}

function birthdayBlock(p) {
    if (!p.rpDate || !Array.isArray(p.babies)) return '';
    const now = new Date(p.rpDate);
    if (isNaN(now.getTime())) return '';
    const lines = [];
    for (const k of [...(p.babies || []), ...(p.grownChildren || [])]) {
        if (!k.birthRpDate) continue;
        const b = new Date(k.birthRpDate);
        if (isNaN(b.getTime())) continue;
        const years = now.getFullYear() - b.getFullYear();
        if (years < 1) continue;
        const sameDay = now.getDate() === b.getDate() && now.getMonth() === b.getMonth();
        if (sameDay) lines.push(`${k.name || 'Child'} birthday today; turning ${years}.`);
        else {
            const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
            if (next < now) next.setFullYear(now.getFullYear() + 1);
            const days = Math.round((next - now) / 86400000);
            if (days > 0 && days <= 3) lines.push(`${k.name || 'Child'} birthday in ${days}d; turning ${years + (next.getFullYear() > now.getFullYear() ? 1 : 0)}.`);
        }
    }
    return lines.length ? `[BIRTHDAYS]\n${lines.join('\n')}\n` : '';
}

let legacySlotsCleared = false;
export function updatePromptInjection() {
    try {
        if (!legacySlotsCleared) {
            setExtensionPrompt(extensionName + '_sys', '', extension_prompt_types.IN_PROMPT, 0);
            setExtensionPrompt(extensionName + '_scan', '', extension_prompt_types.IN_PROMPT, 0);
            legacySlotsCleared = true;
        }
        const core = getBasePrompt() + getPregnancyPrompt();
        const installed = extension_prompts[extensionName];
        if (installed?.value === core && installed.position === extension_prompt_types.IN_CHAT && installed.depth === 0 && installed.role === extension_prompt_roles.SYSTEM) return;
        setExtensionPrompt(extensionName, core, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
    } catch (error) {
        reportError('[Reproductive] updatePromptInjection error:', error);
    }
}
