// ═══════════════════════════════════════════
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// ═══════════════════════════════════════════

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function testReliability(daysSinceConception) {
    const d = Math.max(0, parseInt(daysSinceConception) || 0);
    if (d < 8) return 0;
    if (d < 11) return 0.35;
    if (d < 14) return 0.7;
    if (d < 18) return 0.92;
    return 0.99;
}

// Internal implementation note.
export function rollTest(isPregnant, daysSinceConception, rnd = Math.random) {
    if (!isPregnant) return 'negative';
    const rel = testReliability(daysSinceConception);
    if (rel === 0) return 'negative';
    if (rnd() > rel) return 'negative';
    return daysSinceConception < 14 ? 'faint' : 'positive';
}

// Internal implementation note.
export function missedDays(cycleDay, cycleLength = 28) {
    const d = parseInt(cycleDay) || 1;
    return d > cycleLength ? d - cycleLength : 0;
}

// Internal implementation note.
export function isObvious(weeks, obviousAtWeek = 12) {
    return (parseInt(weeks) || 0) >= (parseInt(obviousAtWeek) || 12);
}

// Internal implementation note.
// Internal implementation note.
export function fertileWindow(cycleDay, cycleLength = 28) {
    const d = parseInt(cycleDay) || 1;
    const ovu = Math.round(cycleLength / 2);
    const start = ovu - 4;
    const end = ovu + 1;
    if (d >= start && d <= end) {
        return { fertile: true, peak: d >= ovu - 1 && d <= ovu + 1, label: d === ovu ? 'Ovulation — peak fertility' : 'Fertile window', daysToPeak: ovu - d };
    }
    const daysToPeak = d < start ? ovu - d : cycleLength - d + ovu;
    return { fertile: false, peak: false, label: 'Low fertility', daysToPeak };
}

// Internal implementation note.
// Internal implementation note.
export function postpartumState(daysSinceBirth, lactating = true) {
    const d = Math.max(0, parseInt(daysSinceBirth) || 0);
    const healing = d < 42
        ? (d < 10 ? 'stitches are fresh and painful' : d < 25 ? 'healing' : 'almost healed')
        : null;
    // Internal implementation note.
    const cycleReturned = lactating ? d >= 180 : d >= 45;
    const lochia = d < 35;
    return {
        days: d,
        healing,
        lactating: lactating && d < 730,
        cycleReturned,
        lochia,
        // Internal implementation note.
        fertilityMul: cycleReturned ? 1 : (lactating ? 0.05 : 0.3),
        label: d < 42 ? 'Early postpartum period' : cycleReturned ? 'Recovery complete' : 'Lactating, cycle has not returned',
    };
}

// Internal implementation note.
// Internal implementation note.
const EYE_RANK = { 'brown': 3, 'green': 2, 'gray': 1, 'blue': 1 };
const HAIR_RANK = { 'black': 4, 'dark': 3, 'light brown': 2, 'red': 2, 'light': 1 };

function pickInherited(a, b, ranks, rnd) {
    const na = normalizeTrait(a, ranks);
    const nb = normalizeTrait(b, ranks);
    if (!na && !nb) return null;
    if (!na) return nb;
    if (!nb) return na;
    if (na === nb) return na;
    const ra = ranks[na] || 0;
    const rb = ranks[nb] || 0;
    // Internal implementation note.
    const dominant = ra >= rb ? na : nb;
    const recessive = ra >= rb ? nb : na;
    return rnd() < 0.7 ? dominant : recessive;
}

function normalizeTrait(v, ranks) {
    if (!v || typeof v !== 'string') return null;
    const low = v.toLowerCase().replace(/\u0451/g, '\u0435');
    if (ranks === HAIR_RANK && /\u0431\u0440\u044e\u043d\u0435\u0442|black/.test(low)) return 'black';
    if (ranks === HAIR_RANK && /\u0431\u043b\u043e\u043d|blond/.test(low)) return 'light';
    for (const key of Object.keys(ranks)) {
        if (low.includes(key.replace(/\u0451/g, '\u0435').slice(0, 3))) return key;
    }
    return null;
}

// Internal implementation note.
export function inheritLooks(motherLooks, fatherLooks, rnd = Math.random) {
    return {
        eyes: pickInherited(motherLooks?.eyes, fatherLooks?.eyes, EYE_RANK, rnd),
        hair: pickInherited(motherLooks?.hair, fatherLooks?.hair, HAIR_RANK, rnd),
    };
}

// Internal implementation note.
// Internal implementation note.
export function conceptionStruggle(monthsTrying) {
    const m = Math.max(0, parseInt(monthsTrying) || 0);
    if (m < 6) return null;
    if (m < 12) return { level: 'concern', label: 'Six months without success — consider getting checked' };
    return { level: 'serious', label: 'One year without success — consider seeing a fertility specialist' };
}
