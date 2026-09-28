// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

export function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function detectChatLanguage() {
    try {
        const chat = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext().chat : [];
        const languageOf = text => {
            const clean = String(text || '').replace(/<think[\s\S]*?<\/think>/gi,'').replace(/<think[\s\S]*$/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/```[\s\S]*?```/g,'').replace(/<[^>]*>/g,'').slice(-3000);
            const ru = (clean.match(/[\u0430-\u044f\u0451]/gi)||[]).length, en = (clean.match(/[a-z]/gi)||[]).length;
            return ru + en < 3 ? null : ru > 0 && ru >= en / 3 ? 'ru' : 'en';
        };
        // Latest player prose determines the scene language, not generated JSON keys.
        for (const userOnly of [true,false]) {
            for (let i=(chat?.length||0)-1;i>=Math.max(0,(chat?.length||0)-20);i--) {
                const m=chat[i]; if (!m || m.is_system || (userOnly && !m.is_user)) continue;
                const lang=languageOf(m.mes); if(lang) return lang;
            }
        }
    } catch (e) { /* default for an empty scene */ }
    return 'ru';
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
const STATUS_EN_RU = {
    'concerned': 'Concerned', 'tense': 'Tense', 'focused': 'Focused', 'intrigued': 'Interested',
    'cramps': 'Cramps', 'pale': 'Pale', 'watching over him': 'Watching over the baby', 'hiding the pain': 'Hiding pain',
    'busy with work': 'Busy with work', 'end of workday': 'End of workday',
    'high': 'High', 'low': 'Low', 'medium': 'Moderate', 'average': 'Moderate',
    'normal': 'Normal', 'ok': 'Normal', 'good': 'Good', 'bad': 'Poor', 'none': 'None',
    'very high': 'Very high', 'very low': 'Very low',
    'anxious': 'Anxious', 'worried': 'Distressed', 'nervous': 'Nervous',
    'calm': 'Calm', 'relaxed': 'Relaxed', 'neutral': 'Neutral',
    'happy': 'Happy', 'joyful': 'Happy', 'sad': 'Sad', 'upset': 'Upset',
    'scared': 'Frightened', 'afraid': 'Frightened', 'angry': 'Angry', 'irritated': 'Irritated',
    'excited': 'Excited', 'playful': 'Playful', 'flirty': 'Flirty',
    'tired': 'Fatigue', 'exhausted': 'Exhaustion', 'energetic': 'Energetic',
    'sleepy': 'Sleepiness', 'hungry': 'Hunger', 'nauseous': 'Nausea',
    'cold': 'Cold', 'warm': 'Warm', 'hot': 'Hot', 'freezing': 'Cold',
    'wet': 'Wet', 'sore': 'Soreness', 'aching': 'Aches',
    'horny': 'Aroused', 'aroused': 'Aroused',
    'sleeping': 'Sleeping', 'awake': 'Awake', 'crying': 'Crying', 'fussy': 'Fussy',
    'content': 'Content', 'breastfeeding': 'Breast milk', 'formula': 'Formula',
    'sensitive': 'Sensitivity', 'sensitivity': 'Sensitivity',
};

export function translateStatusValue(val) {
    if (!val || typeof val !== 'string') return val;
    const key = val.trim().replace(/_/g,' ').toLowerCase();
    if (STATUS_EN_RU[key]) return STATUS_EN_RU[key];
    if (/[\u0430-\u044f\u0451]/i.test(val) || !/[a-z]/i.test(val)) return val;
    const parts = key.split(/[,;]\s*/).map(x => STATUS_EN_RU[x.trim()]);
    return parts.every(Boolean) ? parts.join(', ') : '';

}

export function parseReproBlock(raw) {
    const result = {};
    for (const line of raw.split('\n')) {
        const idx = line.indexOf(':');
        if (idx < 0) continue;
        const key = line.substring(0, idx).trim().toLowerCase().replace(/\s+/g, '_');
        const val = line.substring(idx + 1).trim();
        if (key && val) result[key] = val;
    }
    return result;
}

export function getSeededRandomSymptoms(arr, count, seed) {
    function seededRandom(s) {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    }
    const indexed = arr.map((item, idx) => ({ item, idx }));
    indexed.sort((a, b) => {
        return seededRandom(seed * 1000 + a.idx) - seededRandom(seed * 1000 + b.idx);
    });
    return indexed.slice(0, count).map(x => x.item).join(', ');
}

export function roll(max = 100) {
    return Math.floor(Math.random() * max) + 1;
}

export function getPhaseInfo(day, lang = 'ru', heat = false, menstruation = true) {
    const L = lang === 'en';
    if (day > 28) return { name: L ? 'Delayed period' : 'Delay', icon: 'fa-clock', color: '#ffd43b' };
    if (day <= 5 && menstruation) return { name: L ? 'Menstruation' : 'Menstruation', icon: 'fa-droplet', color: '#ff4444' };
    if (day <= 11) return { name: L ? 'Follicular' : 'Follicular', icon: 'fa-seedling', color: '#66bb6a' };
    if (day <= 16) return { name: L ? (heat ? 'Ovulation / heat' : 'Ovulation') : (heat ? 'Ovulation / heat' : 'Ovulation'), icon: 'fa-fire', color: '#ff6b6b' };
    return { name: L ? 'Luteal' : 'Luteal', icon: 'fa-moon', color: '#ffd43b' };
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function getCycleModifier(day) {
    const d = parseInt(day) || 1;
    if (d <= 5) return 0.01;            // Internal implementation note.
    if (d <= 8) return 0.15;            // Internal implementation note.
    if (d <= 11) return 0.7;            // Internal implementation note.
    if (d <= 16) return 1.65;           // Internal implementation note.
    if (d <= 18) return 0.2;            // Internal implementation note.
    return 0.02;                        // Internal implementation note.
}

export function calculateWeeksFromDates(conceptionDate, rpDate, fallbackWeeks = 0) {
    if (conceptionDate && rpDate) {
        const rpTime = new Date(rpDate).getTime();
        const conceptionTime = new Date(conceptionDate).getTime();
        const diffMs = rpTime - conceptionTime;
        if (diffMs >= 0) {
            const totalDays = Math.floor(diffMs / 86400000);
            return { weeks: Math.floor(totalDays / 7), days: totalDays % 7 };
        }
        // rpDate < conceptionDate — broken state (e.g. real-world conceptionDate vs RP rpDate).
        // Don't fall back to stale pregnancyWeeks (would mask the bug). Return 0; caller's
        // clamp logic in processDateTag will fix conceptionDate on next RP_DATE tag.
        return { weeks: 0, days: 0 };
    }
    return { weeks: fallbackWeeks, days: 0 };
}

export function getSymptomsForProgress(progressPercent, weeks, lang = 'ru') {
    const L = lang === 'en';
    let pool, count;
    if (progressPercent <= 10) {
        // Internal implementation note.
        // Internal implementation note.
        // Internal implementation note.
        pool = L
            ? ['mild morning nausea', 'increased fatigue', 'mood swings', 'heightened sense of smell', 'tingling in breasts', 'daytime drowsiness', 'mild lower abdominal cramps', 'appetite changes']
            : ['mild morning nausea', 'increased fatigue', 'mood swings', 'heightened sense of smell', 'breast tingling', 'daytime sleepiness', 'mild lower abdominal cramps', 'appetite changes'];
        count = 3;
    } else if (progressPercent <= 20) {
        pool = L
            ? ['morning sickness (nausea/vomiting)', 'breast tenderness', 'frequent urination', 'metallic taste in mouth', 'aversion to smells', 'dizziness', 'constipation', 'emotional instability']
            : ['morning sickness (nausea/vomiting)', 'breast sensitivity', 'frequent urination', 'metallic taste in the mouth', 'smell aversions', 'dizziness', 'constipation', 'emotional instability'];
        count = 4;
    } else if (progressPercent <= 30) {
        pool = L
            ? ['belly starts to show', 'morning sickness fading', 'mood swings', 'skin pigmentation', 'visible veins on breasts', 'increased appetite', 'shortness of breath on stairs']
            : ['abdomen begins to round', 'morning sickness eases', 'emotional fluctuations', 'skin pigmentation', 'visible breast veins', 'increased appetite', 'shortness of breath when climbing'];
        count = 4;
    } else if (progressPercent <= 40) {
        pool = L
            ? ['first fetal movements', 'libido increases', 'energy returns', 'breasts enlarging', 'thicker hair', 'leg cramps', 'nasal congestion']
            : ['first fetal movements', 'libido increases', 'energy returns', 'breasts enlarge', 'hair becomes thicker', 'calf cramps', 'nasal congestion'];
        count = 4;
    } else if (progressPercent <= 50) {
        pool = L
            ? ['noticeably larger belly', 'rapid heartbeat', 'stretch marks', 'colostrum from nipples', 'leg cramps', 'heartburn', 'darkening areolas']
            : ['abdomen noticeably enlarged', 'increased heart rate', 'stretch marks', 'colostrum from nipples', 'leg cramps', 'heartburn', 'darkening of the areolas'];
        count = 5;
    } else if (progressPercent <= 70) {
        pool = L
            ? ['heaviness in abdomen', 'swollen feet by evening', 'lower back pain', 'shortness of breath walking', 'heartburn', 'insomnia', 'active fetal kicks', 'varicose veins']
            : ['abdominal heaviness', 'evening leg swelling', 'lower back pain', 'shortness of breath while walking', 'heartburn', 'insomnia', 'active fetal kicks', 'varicose veins'];
        count = 5;
    } else if (progressPercent <= 90) {
        pool = L
            ? ['severe fatigue', 'frequent bathroom trips', 'Braxton Hicks contractions', 'difficulty breathing', 'swelling', 'insomnia', 'pelvic pain', 'waddling gait']
            : ['severe fatigue', 'frequent bathroom trips', 'Braxton Hicks contractions', 'hard to breathe', 'swelling', 'insomnia', 'pelvic pain', 'waddling gait'];
        count = 6;
    } else if (progressPercent <= 100) {
        pool = L
            ? ['belly has dropped', 'mucus plug discharge', 'contractions intensifying', 'water leaking', 'diarrhea', 'pulling pains', 'nesting instinct']
            : ['abdomen has dropped', 'mucus plug discharge', 'contractions are becoming more frequent', 'leaking amniotic fluid', 'diarrhea', 'aching pains', 'nesting instinct'];
        count = 5;
    } else {
        return L ? 'OVERDUE — risk of complications' : 'POST-TERM — complication risk';
    }
    return getSeededRandomSymptoms(pool, count, weeks);
}

export function getRecommendationsForProgress(progressPercent, lang = 'ru') {
    const L = lang === 'en';
    if (progressPercent <= 10) return L ? 'Early stage, rest, proper nutrition' : 'Early stage, rest, balanced nutrition';
    if (progressPercent <= 20) return L ? 'First trimester, monitoring, small frequent meals' : 'First trimester, monitoring, small frequent meals';
    if (progressPercent <= 30) return L ? 'Weight control, vitamins, avoid overheating' : 'Monitor weight, vitamins, avoid overheating';
    if (progressPercent <= 40) return L ? 'Mid-term, sex can be determined, anti-stretch massage' : 'Mid-pregnancy, sex may be visible, stretch-mark massage';
    if (progressPercent <= 50) return L ? 'Belly support band, iron supplements, stretch mark cream' : 'Belly support, iron, stretch-mark cream';
    if (progressPercent <= 70) return L ? 'Sleep on left side, rest, regular checkups' : 'Sleep on the left side, rest, regular monitoring';
    if (progressPercent <= 90) return L ? 'Birth preparation, exercises, frequent checkups' : 'Prepare for birth, exercises, frequent monitoring';
    if (progressPercent <= 100) return L ? 'BIRTH SOON — be ready!' : 'BIRTH SOON — be ready!';
    return L ? 'URGENT — labor induction may be needed' : 'URGENT — labor induction may be needed';
}


export function formatSexIcons(fetusSex, withText = false) {
    if (!fetusSex || fetusSex.length === 0) return '';
    return fetusSex.map(sex => {
        if (withText) return sex === 'M' ? '<i class="fa-solid fa-mars" style="color:#4dabf7"></i> boy' : '<i class="fa-solid fa-venus" style="color:#ff9ff3"></i> girl';
        return sex === 'M' ? '<i class="fa-solid fa-mars" style="color:#4dabf7"></i>' : '<i class="fa-solid fa-venus" style="color:#ff9ff3"></i>';
    }).join(withText ? ', ' : ' ');
}

export function formatFetusCount(count, style = 'short', lang = 'ru') {
    const L = lang === 'en';
    if (style === 'instrumental') {
        return L
            ? (count === 1 ? 'single fetus' : count === 2 ? 'twins' : 'triplets')
            : (count === 1 ? 'single fetus' : count === 2 ? 'twins' : 'triplets');
    }
    if (style === 'full') {
        return L
            ? (count === 1 ? '1 fetus' : count === 2 ? '2 fetuses (twins)' : '3 fetuses (triplets)')
            : (count === 1 ? '1 fetus' : count === 2 ? '2 fetuses (twins)' : '3 fetuses (triplets)');
    }
    return L
        ? (count === 1 ? '1 fetus' : count === 2 ? 'Twins' : 'Triplets')
        : (count === 1 ? '1 fetus' : count === 2 ? 'Twins' : 'Triplets');
}

export function getHealthInfo(healthStatus, lang = 'ru') {
    const L = lang === 'en';
    if (healthStatus === 'warning') return { text: L ? 'Needs attention' : 'Needs attention', icon: 'fa-triangle-exclamation', color: '#ffaa00' };
    if (healthStatus === 'critical') return { text: L ? 'CRITICAL' : 'CRITICAL', icon: 'fa-circle-exclamation', color: '#ff4444' };
    return { text: L ? 'Normal' : 'Normal', icon: 'fa-circle-check', color: '#00e676' };
}

// ─── Complication definitions (one-time roll at conception) ───

const COMPLICATIONS = {
    early: [
        { type: 'Threatened miscarriage', severity: 'critical', chance: 8, weekMin: 4, weekMax: 12 },
        { type: 'Severe morning sickness', severity: 'warning', chance: 15, weekMin: 5, weekMax: 12 },
        { type: 'Low progesterone', severity: 'warning', chance: 10, weekMin: 4, weekMax: 10 },
    ],
    mid: [
        { type: 'Gestational diabetes', severity: 'warning', chance: 10, weekMin: 14, weekMax: 26 },
        { type: 'Anemia', severity: 'warning', chance: 12, weekMin: 14, weekMax: 26 },
        { type: 'Placenta previa', severity: 'critical', chance: 5, weekMin: 16, weekMax: 24 },
        { type: 'Cervical insufficiency', severity: 'critical', chance: 4, weekMin: 14, weekMax: 22 },
    ],
    late: [
        { type: 'Preeclampsia', severity: 'critical', chance: 8, weekMin: 28, weekMax: 38 },
        { type: 'Breech presentation', severity: 'warning', chance: 12, weekMin: 30, weekMax: 37 },
        { type: 'Low amniotic fluid', severity: 'warning', chance: 7, weekMin: 28, weekMax: 38 },
        { type: 'Excess amniotic fluid', severity: 'warning', chance: 5, weekMin: 28, weekMax: 38 },
        { type: 'Preterm contractions', severity: 'critical', chance: 6, weekMin: 28, weekMax: 36 },
    ],
};

/**
 * Roll ALL complications at conception. Each complication is rolled once:
 * either it will happen at a specific week, or it won't happen at all.
 */
export function rollPlannedComplications() {
    const planned = [];
    const allPools = [...COMPLICATIONS.early, ...COMPLICATIONS.mid, ...COMPLICATIONS.late];
    for (const comp of allPools) {
        if (roll(100) <= comp.chance) {
            const week = comp.weekMin + Math.floor(Math.random() * (comp.weekMax - comp.weekMin + 1));
            planned.push({
                type: comp.type,
                severity: comp.severity,
                revealWeek: week,
                revealed: false,
            });
        }
    }
    return planned;
}
