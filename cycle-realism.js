// ═══════════════════════════════════════════
// Internal implementation note.
// Internal implementation note.
// ═══════════════════════════════════════════

// Internal implementation note.
// Internal implementation note.
export const HYGIENE = {
    pad:    { id: 'pad',    label: 'pad', labelEn: 'pad',         maxHours: 4,  limitHours: 6 },
    tampon: { id: 'tampon', label: 'tampon',    labelEn: 'tampon',      maxHours: 5,  limitHours: 8 },
    cup:    { id: 'cup',    label: 'cup',      labelEn: 'menstrual cup', maxHours: 10, limitHours: 12 },
    none:   { id: 'none',   label: 'no protection', labelEn: 'nothing',    maxHours: 0,  limitHours: 0 },
};

// Internal implementation note.
export function getFlow(day) {
    const d = parseInt(day) || 1;
    if (d === 1) return { level: 'starting', label: 'starts',  labelEn: 'just started', factor: 0.7 };
    if (d <= 3)  return { level: 'heavy',    label: 'heavy',     labelEn: 'heavy',        factor: 1.4 };
    if (d === 4) return { level: 'medium',   label: 'moderate',    labelEn: 'moderate',     factor: 1 };
    if (d <= 5)  return { level: 'light',    label: 'spotting',       labelEn: 'spotting',     factor: 0.5 };
    return { level: 'none', label: '', labelEn: '', factor: 0 };
}

// Internal implementation note.
export function hoursBetween(fromIso, toIso) {
    if (!fromIso || !toIso) return null;
    const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
    if (isNaN(ms) || ms < 0) return null;
    return ms / 3600000;
}

// Internal implementation note.
// Internal implementation note.
export function getHygieneState(typeId, hours, flow) {
    const h = HYGIENE[typeId] || HYGIENE.none;
    if (h.id === 'none') {
        return { type: h, hours, needsChange: true, overdue: true, leakRisk: flow?.factor > 0 ? 0.9 : 0,
                 label: 'uses nothing', labelEn: 'using nothing', health: null };
    }
    if (hours === null || !(flow?.factor > 0)) {
        return { type: h, hours, needsChange: false, overdue: false, leakRisk: 0, label: h.label, labelEn: h.labelEn, health: null };
    }
    const factor = flow.factor || 1;
    const soft = h.maxHours / factor;
    const hard = h.limitHours / factor;

    const needsChange = hours >= soft;
    const overdue = hours >= hard;
    // Internal implementation note.
    let leakRisk = 0;
    if (hours > soft) leakRisk = Math.min(0.95, (hours - soft) / Math.max(1, hard - soft) * 0.8);
    if (overdue) leakRisk = Math.min(0.95, 0.8 + (hours - hard) * 0.05);

    // Internal implementation note.
    const health = (h.id === 'tampon' && hours >= 8) ? 'tampon-too-long' : null;

    return { type: h, hours, needsChange, overdue, leakRisk, label: h.label, labelEn: h.labelEn, health,
             hoursLeft: Math.max(0, Math.round((soft - hours) * 10) / 10) };
}

// Internal implementation note.
export function getPhaseEffects(day) {
    const d = parseInt(day) || 1;
    if (d <= 5) {
        const flow = getFlow(d);
        return {
            key: 'menstruation',
            label: 'Menstruation',
            labelEn: 'menstruation',
            body: d <= 3 ? 'cramps, lower abdominal heaviness, lower back discomfort' : 'mild cramps, fatigue',
            bodyEn: d <= 3 ? 'cramps, heaviness low in the belly, aching back' : 'mild cramps, tiredness',
            energy: d <= 2 ? -2 : -1,
            libido: d <= 2 ? -1 : 0,
            mood: -1,
            flow,
        };
    }
    if (d <= 11) {
        return { key: 'follicular', label: 'Follicular', labelEn: 'follicular',
                 body: 'energy returns, skin is clearer', bodyEn: 'energy returning, clearer skin',
                 energy: 1, libido: 1, mood: 1, flow: getFlow(99) };
    }
    if (d <= 16) {
        return { key: 'ovulation', label: 'Ovulation', labelEn: 'ovulation',
                 body: 'one-sided lower abdominal twinges, stretchy discharge, heightened sense of smell',
                 bodyEn: 'one-sided twinge low in the belly, stretchy discharge, sharper sense of smell',
                 energy: 2, libido: 2, mood: 1, flow: getFlow(99) };
    }
    if (d <= 24) {
        return { key: 'luteal', label: 'Luteal', labelEn: 'luteal',
                 body: 'breasts feel more sensitive, cravings for salty food, bloating',
                 bodyEn: 'tender breasts, salt cravings, bloating',
                 energy: 0, libido: 0, mood: 0, flow: getFlow(99) };
    }
    return { key: 'pms', label: 'PMS', labelEn: 'PMS',
             body: 'breast tenderness, swelling, irritability, lower back pain',
             bodyEn: 'sore breasts, water retention, irritability, aching lower back',
             energy: -1, libido: -1, mood: -2, flow: getFlow(99) };
}

// Internal implementation note.
export const DISRUPTIONS = {
    stress:    { label: 'severe stress',   shift: [3, 10] },
    illness:   { label: 'illness',          shift: [2, 7] },
    starvation:{ label: 'undereating',       shift: [5, 14] },
    travel:    { label: 'jet lag', shift: [1, 5] },
    overtrain: { label: 'overtraining',  shift: [3, 9] },
};

// Internal implementation note.
export function disruptionShift(kind, rnd = Math.random) {
    const d = DISRUPTIONS[kind];
    if (!d) return 0;
    const [min, max] = d.shift;
    return min + Math.floor(rnd() * (max - min + 1));
}

// Internal implementation note.
// Internal implementation note.
export function realismPromptLine(day, hygieneState, opts = {}) {
    const eff = getPhaseEffects(day);
    const en = opts.lang !== 'ru';
    const parts = [];
    parts.push(en ? `${eff.labelEn} (cycle day ${day})` : `${eff.label} (day ${day})`);
    parts.push(en ? eff.bodyEn : eff.body);

    if (eff.key === 'menstruation' && hygieneState) {
        const h = hygieneState;
        const flowWord = en ? eff.flow.labelEn : eff.flow.label;
        parts.push(en ? `bleeding: ${flowWord}` : `bleeding: ${flowWord}`);
        if (h.type.id === 'none') {
            parts.push(en ? 'no protection in use — will stain through' : 'without protection — will leak');
        } else if (h.overdue) {
            parts.push(en
                ? `${h.labelEn} is well past due (${Math.round(h.hours)}h) — leaking is likely`
                : `${h.label} is overdue for a change (${Math.round(h.hours)} h) — may leak soon`);
        } else if (h.needsChange) {
            parts.push(en ? `${h.labelEn} needs changing soon` : `${h.label} should be changed now`);
        }
        if (h.health === 'tampon-too-long') {
            parts.push(en ? 'tampon in over 8h — a real health risk' : 'a tampon for more than 8 hours is unsafe');
        }
    }
    return parts.join('; ');
}
