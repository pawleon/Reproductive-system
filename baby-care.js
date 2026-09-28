import { reportError } from './diagnostics.js';
// ═══════════════════════════════════════════
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// ═══════════════════════════════════════════

import { saveSettingsDebounced } from '../../../../script.js';
import { getSettings, getPregnancyData } from './state.js';
import { showNotification } from './notifications.js';

// Internal implementation note.
function seedHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

// Internal implementation note.
function jitter(baby, key, range) {
    if (!range) return 0;
    const h = seedHash(`${baby?.birthRpDate || ''}|${baby?.sex || ''}|${key}`);
    return (h % (range * 2 + 1)) - range;
}

// Internal implementation note.
export function babyAgeDays(baby, p) {
    if (!baby?.birthRpDate || !p?.rpDate) return null;
    const ms = new Date(p.rpDate).getTime() - new Date(baby.birthRpDate).getTime();
    if (isNaN(ms) || ms < 0) return null;
    return Math.floor(ms / 86400000);
}

// Internal implementation note.
export const MILESTONES = [
    { key: 'smile',   label: 'first smile',                base: 40,  range: 12 },
    { key: 'head',    label: 'holds head steadily',      base: 75,  range: 15 },
    { key: 'roll',    label: 'rolls from back',    base: 120, range: 20 },
    { key: 'laugh',   label: 'laughs loudly',               base: 130, range: 20 },
    { key: 'sit',     label: 'sits without support',          base: 185, range: 25 },
    { key: 'solids',  label: 'first solid food',               base: 183, range: 10 },
    { key: 'tooth',   label: 'first tooth (lower incisor)',    base: 195, range: 55 },
    { key: 'crawl',   label: 'crawls',                      base: 250, range: 35 },
    { key: 'stand',   label: 'stands while holding onto support',               base: 290, range: 25 },
    { key: 'babble',  label: 'babbling “mama”, “papa”',       base: 320, range: 40 },
    { key: 'steps',   label: 'first steps',                  base: 370, range: 40 },
    { key: 'words',   label: 'first meaningful words',      base: 380, range: 45 },
    { key: 'run',     label: 'runs',                       base: 550, range: 60 },
    { key: 'phrases', label: 'two-word phrases',           base: 640, range: 70 },
    { key: 'potty',   label: 'learning to use the potty',             base: 660, range: 90 },
];

// Internal implementation note.
export function milestoneDay(baby, m) {
    return m.base + jitter(baby, m.key, m.range);
}

// Internal implementation note.
export const GROWTH_STAGES = [
    { key: 'newborn',   label: 'newborn', icon: 'fa-baby',            maxDays: 30 },
    { key: 'infant',    label: 'infant',     icon: 'fa-baby-carriage',   maxDays: 365 },
    { key: 'toddler',   label: 'toddler 1–3',     icon: 'fa-shoe-prints',     maxDays: 1095 },
    { key: 'preschool', label: 'preschooler',    icon: 'fa-shapes',          maxDays: 2555 },
    { key: 'school',    label: 'school-age child',      icon: 'fa-book',            maxDays: 4380 },
    { key: 'teen',      label: 'teenager',     icon: 'fa-headphones',      maxDays: 6570 },
    { key: 'adult',     label: 'adult',      icon: 'fa-user',            maxDays: Infinity },
];

export function getGrowthStage(ageDays) {
    if (ageDays === null || ageDays === undefined || isNaN(ageDays)) return null;
    for (const st of GROWTH_STAGES) {
        if (ageDays < st.maxDays) return st;
    }
    return GROWTH_STAGES[GROWTH_STAGES.length - 1];
}

// Internal implementation note.
// { feeding, sleep, diaper, teething|null, colic:bool, upcoming|null }
export function getCareNorms(ageDays, baby) {
    const c = { feeding: '', sleep: '', diaper: '', teething: null, colic: false, upcoming: null };
    const a = ageDays;

    // Internal implementation note.
    const solidsDay = milestoneDay(baby, MILESTONES.find(m => m.key === 'solids'));
    if (a < 60) c.feeding = 'breast/formula every 2–3 h, 8–12 feeds per day (including night)';
    else if (a < 120) c.feeding = 'breast/formula about every 3 h, 7–8 feeds';
    else if (a < solidsDay) c.feeding = 'breast/formula every 3.5–4 h; solids are still too early (until around 6 months)';
    else if (a < 240) c.feeding = 'first solids: vegetable puree and cereal by teaspoon + breast/formula';
    else if (a < 365) c.feeding = 'solids 3 times a day (purees, cereal, meat, finger foods) + breast/formula';
    else if (a < 540) c.feeding = 'adapted family meals, 4–5 times a day';
    else c.feeding = 'family meals, 4 times a day + snacks';

    // Internal implementation note.
    if (a < 90) c.sleep = 'sleep 16–18 h/day, wakes every 2–4 h at night';
    else if (a < 140) c.sleep = 'sleep 15–16 h; sleep regression is possible (~4 months)';
    else if (a < 183) c.sleep = 'sleep 14–15 h, 3 naps';
    else if (a < 365) c.sleep = 'sleep 13–14 h, 2 naps';
    else if (a < 540) c.sleep = 'sleep ~13 h, 1–2 naps';
    else c.sleep = 'sleep 12–13 h, 1 nap';

    // Internal implementation note.
    const pottyDay = milestoneDay(baby, MILESTONES.find(m => m.key === 'potty'));
    if (a < 365) c.diaper = 'diapers: 6–10 changes per day';
    else if (a < pottyDay) c.diaper = 'diapers: 4–6 changes per day';
    else c.diaper = 'learning to use the potty, diaper for sleep and outings';

    // Internal implementation note.
    c.colic = a >= 20 && a <= 105;

    // Internal implementation note.
    const toothDay = milestoneDay(baby, MILESTONES.find(m => m.key === 'tooth'));
    if (a >= toothDay - 15 && a < toothDay) c.teething = 'swollen gums, drooling, puts everything in the mouth — first tooth soon';
    else if (a >= toothDay && a < toothDay + 80) c.teething = 'incisors are coming in: fussiness, drooling, possible fever';
    else if (a >= 390 && a < 480) c.teething = 'lateral incisors are coming in';
    else if (a >= 480 && a < 630) c.teething = 'first molars and canines are coming in — often the most painful';
    else if (a >= 630 && a < 850) c.teething = 'second molars are coming in';

    // Internal implementation note.
    let next = null;
    for (const m of MILESTONES) {
        const d = milestoneDay(baby, m);
        if (d > a && (!next || d < next.d)) next = { d, label: m.label };
    }
    if (next && next.d - a <= 45) c.upcoming = next.label;

    return c;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function getCareNeeds(ageDays, rpTime, baby) {
    const needs = { feeding: null, diaper: null, sleep: null, careNote: null };
    if (ageDays === null || ageDays === undefined) return needs;

    // Internal implementation note.
    let hour = 12;
    if (rpTime && typeof rpTime === 'string') {
        const parts = rpTime.split(':');
        if (parts.length >= 2) {
            const h = parseInt(parts[0]);
            if (h >= 0 && h <= 23) hour = h;
        }
    }

    // Internal implementation note.
    const offset = baby ? jitter(baby, 'schedule', 1) : 0;
    const adjHour = (hour + 24 - offset) % 24;

    // Internal implementation note.
    let feedInterval;
    if (ageDays < 60)       feedInterval = 2.5;
    else if (ageDays < 120) feedInterval = 3;
    else if (ageDays < 180) feedInterval = 3.5;
    else if (ageDays < 365) feedInterval = 4;
    else                    feedInterval = 5;

    // Internal implementation note.
    const hoursSinceLastFeed = adjHour % feedInterval;
    if (hoursSinceLastFeed >= feedInterval - 0.5) {
        needs.feeding = 'Hungry';
    } else if (hoursSinceLastFeed < 0.5) {
        needs.feeding = 'Fed';
    } else {
        needs.feeding = 'Full';
    }

    // Internal implementation note.
    const diaperInterval = ageDays < 180 ? 2.5 : 3.5;
    const hoursSinceDiaper = adjHour % diaperInterval;
    if (hoursSinceDiaper >= diaperInterval - 0.5) {
        needs.diaper = 'Needs changing';
    } else {
        needs.diaper = 'Clean';
    }

    // Internal implementation note.
    const isNight = hour >= 20 || hour < 6;
    const isEarlyMorning = hour >= 6 && hour < 8;
    const isNapTime1 = hour >= 10 && hour < 12;  // Internal implementation note.
    const isNapTime2 = hour >= 14 && hour < 16;  // Internal implementation note.

    if (isNight) {
        needs.sleep = 'Sleeping';
        if (ageDays < 90 && (hour >= 1 && hour < 5)) {
            // Internal implementation note.
            needs.sleep = 'Awake after sleep';
            needs.feeding = 'Hungry';
            needs.careNote = 'Night feeding';
        }
    } else if (isEarlyMorning) {
        needs.sleep = 'Waking up';
    } else if (ageDays < 365 && isNapTime1) {
        needs.sleep = 'Nap';
    } else if (ageDays < 540 && isNapTime2) {
        needs.sleep = 'Nap';
    } else {
        needs.sleep = 'Awake';
    }

    // Internal implementation note.
    if (!needs.careNote) {
        if (hour >= 19 && hour < 20) {
            needs.careNote = 'Time for a bath and bedtime routine';
        } else if (hour >= 9 && hour < 11 && ageDays > 30) {
            needs.careNote = 'Good time for a walk';
        } else if (hour >= 16 && hour < 18 && ageDays > 30) {
            needs.careNote = 'Evening walk';
        } else if (ageDays < 90 && needs.feeding === 'Hungry') {
            needs.careNote = 'Feed on demand every 2–3 h';
        }
    }

    return needs;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function updateBabyCare() {
    try {
        const s = getSettings();
        const p = getPregnancyData();
        if (!p.hasBaby || !Array.isArray(p.babies) || p.babies.length === 0 || !p.rpDate) return false;

        let changed = false;
        const newly = [];

        for (const baby of p.babies) {
            const age = babyAgeDays(baby, p);
            if (age === null) continue;
            if (!Array.isArray(baby.milestones)) baby.milestones = [];

            for (const m of MILESTONES) {
                if (milestoneDay(baby, m) > age) continue;
                const already = baby.milestones.some(x => x.key === m.key || x.text === m.label);
                if (already) continue;
                baby.milestones.push({
                    key: m.key,
                    text: m.label,
                    rpDate: p.rpDate,
                    date: new Date().toISOString(),
                });
                newly.push({ baby, m });
                changed = true;
            }

            const care = getCareNorms(age, baby);
            const teethingNow = !!care.teething;
            if (baby.teething !== teethingNow) { baby.teething = teethingNow; changed = true; }
            if (baby.colicky !== care.colic) { baby.colicky = care.colic; changed = true; }
        }

        // Internal implementation note.
        const youngest = p.babies[p.babies.length - 1];
        if (youngest) {
            p.babyTeething = !!youngest.teething;
            p.babyColicky = !!youngest.colicky;
        }

        if (changed) saveSettingsDebounced();

        if (newly.length > 0 && s.showNotifications) {
            if (newly.length <= 2) {
                for (const { baby, m } of newly) {
                    showNotification(`<i class="fa-solid fa-star"></i> ${baby.name || 'Baby'}: ${m.label}!`, 'success');
                }
            } else {
                // Internal implementation note.
                showNotification(`<i class="fa-solid fa-star"></i> Development milestones: +${newly.length}`, 'success');
            }
        }

        return changed;
    } catch (e) {
        reportError('[Reproductive] updateBabyCare error:', e);
        return false;
    }
}

// Internal implementation note.
export const MILESTONE_ICONS = {
    smile: 'fa-face-smile', head: 'fa-child-reaching', roll: 'fa-arrows-rotate',
    laugh: 'fa-face-laugh', sit: 'fa-chair', solids: 'fa-utensils',
    tooth: 'fa-tooth', crawl: 'fa-baby', stand: 'fa-person', babble: 'fa-comment',
    steps: 'fa-shoe-prints', words: 'fa-comments', run: 'fa-person-running',
    phrases: 'fa-message', potty: 'fa-toilet',
};

// Internal implementation note.
export function milestonesTotal() { return MILESTONES.length; }
