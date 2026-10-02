// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.

// Internal implementation note.
const CONCEPTION_RE_STRICT = /<!--(?:(?!-->)[\s\S])*?\[CONCEPTION_CHECK\](?:(?!-->)[\s\S])*?-->/i;
const BIRTH_RE_STRICT = /<!--(?:(?!-->)[\s\S])*?\[BIRTH\](?:(?!-->)[\s\S])*?-->/i;
// Internal implementation note.
const MISCARRIAGE_RE_STRICT = /<!--(?:(?!-->)[\s\S])*?\[MISCARRIAGE\](?:(?!-->)[\s\S])*?-->/i;
const ABORTION_RE_STRICT = /<!--(?:(?!-->)[\s\S])*?\[ABORTION\](?:(?!-->)[\s\S])*?-->/i;

// Internal implementation note.
const CYCLE_DAY_RE = /<!--(?:(?!-->)[\s\S])*?\[CYCLE_DAY[:\s]+(\d+)\](?:(?!-->)[\s\S])*?-->/i;

// Internal implementation note.
// Internal implementation note.
const RP_DATE_RE_DOT = /<!--(?:(?!-->)[\s\S])*?\[RP_DATE[:\s]+\s*(\d{1,2})\.(\d{1,2})\.(\d{1,4})(?:[\s,T]+(\d{1,2}):(\d{2}))?\s*\](?:(?!-->)[\s\S])*?-->/i;
const RP_DATE_RE_SLASH = /<!--(?:(?!-->)[\s\S])*?\[RP_DATE[:\s]+\s*(\d{1,2})\/(\d{1,2})\/(\d{1,4})(?:[\s,T]+(\d{1,2}):(\d{2}))?\s*\](?:(?!-->)[\s\S])*?-->/i;
const RP_DATE_RE_ISO = /<!--(?:(?!-->)[\s\S])*?\[RP_DATE[:\s]+\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[\s,T]+(\d{1,2}):(\d{2}))?\s*\](?:(?!-->)[\s\S])*?-->/i;

// Internal implementation note.
const SEX_REVEAL_RE_STRICT = /<!--(?:(?!-->)[\s\S])*?\[SEX_REVEAL\](?:(?!-->)[\s\S])*?-->/i;

// Internal implementation note.
const CONCEPTION_CHAR_RE = /<!--(?:(?!-->)[\s\S])*?\[CONCEPTION_CHECK:CHAR\](?:(?!-->)[\s\S])*?-->/i;
const BIRTH_CHAR_RE = /<!--(?:(?!-->)[\s\S])*?\[BIRTH:CHAR\](?:(?!-->)[\s\S])*?-->/i;
const SEX_REVEAL_CHAR_RE = /<!--(?:(?!-->)[\s\S])*?\[SEX_REVEAL:CHAR\](?:(?!-->)[\s\S])*?-->/i;

function extractRevealedSexes(text) {
    if (!text) return null;
    const found = [];
    const re = /(\u043c\u0430\u043b\u044c\u0447\u0438\u043a|\u0434\u0435\u0432\u043e\u0447\u043a|\u0441\u044b\u043d|\u0434\u043e\u0447(?:\u044c|\u043a\u0430|\u0435\u043d\u044c\u043a\u0430|\u0435\u0440\u0438|\u0435\u043d\u044c\u043a\u0438)|boy|girl|son|daughter|male|female)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        const w = m[1].toLowerCase();
        let sex = null;
        if (/^(?:\u043c\u0430\u043b\u044c\u0447\u0438\u043a|\u0441\u044b\u043d|boy|son|male)/.test(w)) sex = 'M';
        else if (/^(?:\u0434\u0435\u0432\u043e\u0447\u043a|\u0434\u043e\u0447|girl|daughter|female)/.test(w)) sex = 'F';
        if (sex && (found.length === 0 || found[found.length - 1] !== sex)) {
            found.push(sex);
        }
        if (found.length >= 4) break;
    }
    return found.length > 0 ? found : null;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
function looksLikeInternalRelease(text) {
    const releaseInside = /(?:\u0441\u043f\u0435\u0440\u043c|\u0441\u0435\u043c\u0435\u043d|\u0441\u0435\u043c\u044f|semen|creampie|cum(?:s|ming|med)?\s+(?:in|inside|into)|(?:came|come|coming)\s+(?:in|inside|into)|fill(?:s|ed|ing)?\s+(?:her|you|me)\b|\u043a\u043e\u043d\u0447(?:\u0438\u043b|\u0438\u043b\u0430|\u0430\u0435\u0442|\u0430\u044e|\u0430\u0435\u0448\u044c|\u0430\u044f)\s+(?:\u0432|\u0432\u043d\u0443\u0442\u0440)|\u0438\u0437\u043b\u0438(?:\u0432|\u043b)[\u0430-\u044f\u0451]*\s+(?:\u0432|\u0432\u043d\u0443\u0442\u0440)|\u0437\u0430\u043b\u0438\u0432\u0430(?:\u043b|\u043b\u0430|\u0435\u0442)\s+(?:\u0432|\u0432\u043d\u0443\u0442\u0440)|\u0437\u0430\u043f\u043e\u043b\u043d(?:\u0438\u043b|\u0438\u043b\u0430|\u044f\u0435\u0442)\s+(?:\u0435\u0451|\u0435\u0435|\u0442\u0435\u0431\u044f|\u043c\u0435\u043d\u044f|\u043b\u043e\u043d\u043e|\u043c\u0430\u0442\u043a)|\u0432\u043d\u0443\u0442\u0440\u0438\s+(?:\u043d\u0435\u0451|\u043d\u0435\u0435|\u0442\u0435\u0431\u044f|\u043c\u0435\u043d\u044f))/i;
    // Internal implementation note.
    const knotting = /(?:\u0443\u0437\u043b[\u0430\u043e\u0435\u044b]\u043c?|\u0443\u0437\u0435\u043b|knot(?:s|ted|ting)?)\b/i.test(text)
        && /(?:\u0432\u043d\u0443\u0442\u0440|inside|\u0438\u0437\u043b\u0438|\u0441\u043f\u0435\u0440\u043c|\u0441\u0435\u043c\u0435\u043d|cum)/i.test(text);
    if (!releaseInside.test(text) && !knotting) return false;

    // Internal implementation note.
    const toys = /(?:\u0441\u0435\u043a\u0441[- ]?\u0438\u0433\u0440\u0443\u0448\u043a|\u0438\u0433\u0440\u0443\u0448\u043a[\u0438\u0430\u0443\u0435\u043e]?\s|\u0434\u0438\u043b\u0434\u043e|dildo|\u0432\u0438\u0431\u0440\u0430\u0442\u043e\u0440|vibrator|strap[- ]?on|\u0441\u0442\u0440\u0430\u043f\u043e\u043d|\u0444\u0430\u043b\u043b\u043e\u0438\u043c\u0438\u0442\u0430\u0442\u043e\u0440|plug\b|\u043f\u0440\u043e\u0431\u043a[\u0430\u0443\u0438])/i;
    const semen = /(?:\u0441\u043f\u0435\u0440\u043c|\u0441\u0435\u043c\u0435\u043d|\u0441\u0435\u043c\u044f|semen|creampie|cum|\u043a\u043e\u043d\u0447(?:\u0438\u043b|\u0438\u043b\u0430|\u0430\u0435\u0442)\s+(?:\u0432|\u0432\u043d\u0443\u0442\u0440))/i;
    if (toys.test(text) && !semen.test(text)) return false;

    return true;
}

// The event marker alone must not turn contractions or plans into a newborn.
export function hasCompletedDelivery(text) {
    const scene = stripThink(text).replace(/<!--[\s\S]*?-->/g, '').replace(/\[OOC:[\s\S]*?\]/gi, '');
    return scene.split(/[.!?\n]+/).some(line =>
        !/(?:\u0435\u0449[\u0435\u0451] \u043d\u0435|\u043d\u0435 (?:\u0440\u043e\u0434\u0438\u043b|\u0440\u043e\u0434\u0438\u043b\u0430|\u0440\u043e\u0434\u0438\u043b\u0441\u044f|\u0440\u043e\u0434\u0438\u043b\u0430\u0441\u044c)|not yet|has not|hasn't|will be|would|could|\u0431\u0443\u0434\u0435\u0442|\u043a\u043e\u0433\u0434\u0430|\u0435\u0441\u043b\u0438|\u0432\u0441\u043f\u043e\u043c\u0438\u043d|\u0432 \u043f\u0440\u043e\u0448\u043b\u043e\u043c|(?:^|\s)\u0431\u044b(?:\s|$))/i.test(line)
        && /(?:\u0440\u043e\u0434\u0438\u043b(?:\u0430|\u0441\u044f|\u0430\u0441\u044c|\u0438\u0441\u044c)?[ ,]|\u043f\u043e\u044f\u0432\u0438\u043b(?:\u0441\u044f|\u0430\u0441\u044c|\u0438\u0441\u044c) \u043d\u0430 \u0441\u0432\u0435\u0442|\u0440\u0435\u0431[\u0435\u0451]\u043d\u043e\u043a \u0440\u043e\u0434\u0438\u043b\u0441\u044f|\u043c\u0430\u043b\u044b\u0448 \u0440\u043e\u0434\u0438\u043b\u0441\u044f|gave birth|was born|were born|has been born|delivered (?:the |a )?bab)/i.test(line + ' '));
}

// Internal implementation note.
// Internal implementation note.
export function scanMessage(text) {
    if (!text) return null;

    let hasConception = CONCEPTION_RE_STRICT.test(text);
    const hasBirth = BIRTH_RE_STRICT.test(text) && hasCompletedDelivery(text);
    const hasSexReveal = SEX_REVEAL_RE_STRICT.test(text);
    let hasMiscarriage = MISCARRIAGE_RE_STRICT.test(text);
    let hasAbortion = ABORTION_RE_STRICT.test(text);

    // Internal implementation note.
    // Internal implementation note.
    if (hasMiscarriage) {
        const textNoTags = text.replace(/<!--[\s\S]*?-->/g, '');
        if (!/(\u0432\u044b\u043a\u0438\u0434\u044b\u0448|miscarr|\u043a\u0440\u043e\u0432\u043e\u0442\u0435\u0447|\u043a\u0440\u043e\u0432(?:\u044c|\u0438|\u044c\u044e)|\u043f\u043e\u0442\u0435\u0440(?:\u044f|\u044f\u043b|\u044f\u043b\u0430|\u044f\u043b\u0438)|\u0441\u0445\u0432\u0430\u0442\u043a|\u0441\u043f\u0430\u0437\u043c|\u0431\u043e\u043b\u044c|\u0441\u043a\u043e\u0440\u0430\u044f|\u0431\u043e\u043b\u044c\u043d\u0438\u0446|\u0432\u0440\u0430\u0447|\u043f\u043b\u043e\u0434|\u0441\u0440\u044b\u0432|\u0442\u044f\u043d\u0443\u0449|\u0437\u0430\u043c\u0435\u0440\u0448)/i.test(textNoTags)) {
            hasMiscarriage = false;
        }
    }
    if (hasAbortion) {
        const textNoTags = text.replace(/<!--[\s\S]*?-->/g, '');
        if (!/(\u0430\u0431\u043e\u0440\u0442|abortion|\u043f\u0440\u0435\u0440\u044b\u0432|\u043a\u043b\u0438\u043d\u0438\u043a|\u043f\u0440\u043e\u0446\u0435\u0434\u0443\u0440|\u0432\u0430\u043a\u0443\u0443\u043c|\u0442\u0430\u0431\u043b\u0435\u0442\u043a|\u0433\u0438\u043d\u0435\u043a\u043e\u043b\u043e\u0433|\u043e\u043f\u0435\u0440\u0430\u0446)/i.test(textNoTags)) {
            hasAbortion = false;
        }
    }

    if (hasConception && !looksLikeInternalRelease(text.replace(/<!--[\s\S]*?-->/g, ''))) {
        hasConception = false;
    }

    let cycleDay = null;
    const cycleMatch = text.match(CYCLE_DAY_RE);
    if (cycleMatch) {
        const day = parseInt(cycleMatch[1]);
        if (day >= 1 && day <= 28) cycleDay = day;
    }

    // Internal implementation note.
    let hasCharConception = CONCEPTION_CHAR_RE.test(text);
    const hasCharBirth = BIRTH_CHAR_RE.test(text) && hasCompletedDelivery(text);
    const hasCharSexReveal = SEX_REVEAL_CHAR_RE.test(text);
    if (hasCharConception && !looksLikeInternalRelease(text.replace(/<!--[\s\S]*?-->/g, ''))) {
        hasCharConception = false;
    }

    const anyTag = hasConception || hasBirth || hasSexReveal || hasMiscarriage || hasAbortion
                || hasCharConception || hasCharBirth || hasCharSexReveal;
    if (!anyTag && cycleDay === null) return null;

    const result = {
        vaginal_ejaculation_occurred: hasConception,
        birth_occurred: hasBirth,
        miscarriage_occurred: hasMiscarriage,
        abortion_occurred: hasAbortion,
        sex_revealed: hasSexReveal,
        // Internal implementation note.
        char_conception: hasCharConception,
        char_birth: hasCharBirth,
        char_sex_revealed: hasCharSexReveal,
        revealed_sexes: (hasSexReveal || hasCharSexReveal) ? extractRevealedSexes(text) : null,
        baby_traits: (hasBirth || hasCharBirth) ? scanBabyTraitsTag(text) : null,
        cycle_day: cycleDay,
        _source: anyTag ? 'tag' : 'cycle_only',
    };



    return result;
}

// Internal implementation note.
const RP_STATUS_RE = /<!--\s*\[RP_STATUS:\s*(\{[\s\S]*?\})\s*\]\s*-->/i;

// BABY_TRAITS tag
const BABY_TRAITS_RE = /<!--\s*\[BABY_TRAITS:\s*(\{[\s\S]*?\})\s*\]\s*-->/i;

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
const PREGNANCY_STATE_RE = /<!--\s*\[PREGNANCY_STATE:\s*(\{[\s\S]*?\})\s*\]\s*-->/i;

function _safeParseJson(raw) {
    try { return JSON.parse(raw); } catch (e) {
        try {
            const fixed = raw.replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"');
            return JSON.parse(fixed);
        } catch (e2) { return null; }
    }
}

export function scanBabyTraitsTag(text) {
    if (!text) return null;
    const m = text.match(BABY_TRAITS_RE);
    if (!m) return null;
    const json = _safeParseJson(m[1]);
    if (!json) {
        return null;
    }
    if (Array.isArray(json.babies)) return json;
    if (Array.isArray(json)) return { babies: json };
    return { babies: [json] };
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function scanPregnancyStateTag(text) {
    if (!text) return null;
    const m = text.match(PREGNANCY_STATE_RE);
    if (!m) return null;
    const json = _safeParseJson(m[1]);
    if (!json || typeof json !== 'object') {
        return null;
    }

    // Internal implementation note.
    let conceptionIso = null;
    const cdRaw = json.conception_date || json.conceptionDate || json.conception || json.date;
    if (typeof cdRaw === 'string' && cdRaw.length > 0) {
        let dt = null;
        // Internal implementation note.
        const mm = cdRaw.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
        if (mm) {
            let y = parseInt(mm[3]);
            if (y < 100) y += 2000;
            dt = new Date(y, parseInt(mm[2]) - 1, parseInt(mm[1]));
        } else {
            // Internal implementation note.
            const parsed = new Date(cdRaw);
            if (!isNaN(parsed.getTime())) dt = parsed;
        }
        if (dt && !isNaN(dt.getTime())) {
            conceptionIso = dt.toISOString();
        }
    }

    if (!conceptionIso) {
        return null;
    }

    // Internal implementation note.
    const suppliedCount = Number(json.fetus_count ?? json.fetusCount);
    const fetusCount = Number.isInteger(suppliedCount) && suppliedCount >= 1 && suppliedCount <= 4 ? suppliedCount : null;
    let fetusSex = json.fetus_sex || json.fetusSex || json.sex;
    if (typeof fetusSex === 'string') {
        fetusSex = fetusSex.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(fetusSex)) fetusSex = [];
    fetusSex = fetusSex.map(s => {
        const u = String(s).toUpperCase();
        if (u === 'M' || u === 'MALE' || u === 'BOY' || u === '\u041c\u0410\u041b\u042c\u0427\u0418\u041a' || u === '\u041c') return 'M';
        if (u === 'F' || u === 'FEMALE' || u === 'GIRL' || u === '\u0414\u0415\u0412\u041e\u0427\u041a\u0410' || u === '\u0414' || u === '\u0416') return 'F';
        return '?';
    });
    while (fetusSex.length < (fetusCount || 0)) fetusSex.push('?');

    const father = (json.father || json.father_name || json.fatherName || '').toString().slice(0, 80);

    const result = {
        conceptionDate: conceptionIso,
        fetusCount: fetusCount,
        fetusCountConfirmed: json.fetus_count_confirmed === true,
        fetusSex: fetusSex,
        fatherName: father,
    };
    return result;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
//   • "I'm 16 weeks pregnant" / "20 weeks along" / "at 12 weeks"
// Internal implementation note.
//
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function scanWeeksFromText(text) {
    if (!text) return null;

    // Internal implementation note.
    const candidates = [];

    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    const ruWeekRe = /(\d{1,2})[\s\-—]?(?:\u0439|\u044f|\u0430\u044f|\u043e\u0439|\u0443\u044e|\u044c\u044e|\u043e\u043c)?\s*\u043d\u0435\u0434\u0435\u043b(?:\u044c|\u044f|\u0438|\u0435|\u044e|\u0435\u0439|\u044f\u043c|\u044f\u043c\u0438|\u044f\u0445|\u044c\u043a\u0443|\u044c\u043a\u0438|\u044c\u043a\u043e\u0439)?(?![\u0430-\u044f\u0451a-z])/gi;
    let m;
    while ((m = ruWeekRe.exec(text)) !== null) {
        candidates.push({ value: parseInt(m[1]), unit: 'week', index: m.index, lang: 'ru' });
    }

    // Internal implementation note.
    const enWeekRe = /(\d{1,2})[\s\-]?(?:th|st|nd|rd)?\s*week(?:s|ly)?\b/gi;
    while ((m = enWeekRe.exec(text)) !== null) {
        candidates.push({ value: parseInt(m[1]), unit: 'week', index: m.index, lang: 'en' });
    }

    // Internal implementation note.
    const ruMonthRe = /(\d{1,2})[\s\-—]?(?:\u043c|\u0439|\u043e\u0439|\u043e\u043c)?\s*\u043c\u0435\u0441\u044f\u0446(?:\u0430|\u0435|\u0435\u0432|\u0443|\u0430\u043c|\u0430\u0445|\u044b)?(?![\u0430-\u044f\u0451a-z])/gi;
    while ((m = ruMonthRe.exec(text)) !== null) {
        candidates.push({ value: parseInt(m[1]), unit: 'month', index: m.index, lang: 'ru' });
    }

    // Internal implementation note.
    const enMonthRe = /(\d{1,2})\s*month(?:s)?\b/gi;
    while ((m = enMonthRe.exec(text)) !== null) {
        candidates.push({ value: parseInt(m[1]), unit: 'month', index: m.index, lang: 'en' });
    }

    if (candidates.length === 0) return null;

    // Internal implementation note.
    const pregContextRe = /(?:\u0431\u0435\u0440\u0435\u043c\u0435\u043d\u043d|\u043f\u0440\u0435\u0434\u044b?\u043d|\u0441\u0440\u043e\u043a|\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438|\u0436\u0438\u0432\u043e\u0442\u0438\u043a|\u043f\u0443\u0437\u043e|gravid|pregnan|expect(?:ing|ant)|gestation|along|trimester|\u0442\u0440\u0438\u043c\u0435\u0441\u0442\u0440)/i;

    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    const futureContextRe = /(?:\u043a\u043e\u0433\u0434\u0430|\u0435\u0441\u043b\u0438\s+\u0431\u044b?|\u0435\u0441\u043b\u0438\s+\u0431\u0443\u0434\u0443\u0442?|\u0435\u0441\u043b\u0438\s+\u0441\u0442\u0430\u043d\u0435\u0442|\u0431\u0443\u0434\u0435\u0442|\u0431\u0443\u0434\u0443\u0442|\u0441\u0442\u0430\u043d\u0435\u0442|\u043f\u043e\u0439\u0434[\u0435\u0451]\u043c|\u043f\u043e\u0439\u0442\u0438|\u0441\u0445\u043e\u0434\u0438\u043c|\u0447\u0435\u0440\u0435\u0437\s+\d|\u0441\u043f\u0443\u0441\u0442\u044f\s+\d|\u043f\u043e\u0442\u043e\u043c|\u043f\u043e\u0441\u043b\u0435|\u043f\u043e\u0437\u0436\u0435|\u0441\u043a\u043e\u0440\u043e|\u0432\u043e\u0442-\u0432\u043e\u0442|\u0445\u043e\u0447\u0443\s+\u0447\u0442\u043e\u0431\u044b|\u0445\u043e\u0447\u0435\u0442\u0441\u044f|\u043c\u0435\u0447\u0442\u0430\u044e|\u043f\u043b\u0430\u043d\u0438\u0440\u0443\u044e|\u0441\u043e\u0431\u0438\u0440\u0430[\u0435\u044e]\u043c\u0441\u044f|\u043d\u0435\s+\u0434\u0430\u0439\s+\u0431\u043e\u0433|\u0431\u043e\u044e\u0441\u044c|\u0441\u0442\u0440\u0430\u0448\u043d\u043e|\u043e\u043f\u0430\u0441\u043d\u043e|\u043d\u0435\u043b\u044c\u0437\u044f|\u043e\u0431\u0441\u0443\u0434\u0438[\u043c\u0442]|\u043f\u043e\u0433\u043e\u0432\u043e\u0440\u0438\u043c|\u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u044c|\u0432\u043e\u043e\u0431\u0440\u0430\u0437\u0438|\u0434\u043e\u043f\u0443\u0441\u0442\u0438\u043c|when\s+(?:i|we|she)|if\s+(?:i|we|she|only)|gonna|going\s+to|will\s+be|would\s+be|hope|wish|plan\s+to)/i;

    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    const progressContextRe = /(?:\d+\s*\/\s*\d+\s*(?:\u043d\u0435\u0434\u0435\u043b|\u043d\u0435\u0434\.|week|month|\u043c\u0435\u0441)|term\s*[:=]|"term"|due[_\s]date|"due"|\u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441|\(\s*\d+\s*%\s*\)|\d+\s+\u0438\u0437\s+\d+\s*(?:\u043d\u0435\u0434\u0435\u043b|\u043d\u0435\u0434)|fetus\s*:|"fetus"|\u0440\u0430\u0437\u043c\u0435\u0440\s+\u043f\u043b\u043e\u0434\u0430\s*[:=])/i;

    // Internal implementation note.
    // Internal implementation note.
    const oocContextRe = /(?:\bOOC\s*[:!.,]|\(\s*OOC|\[\s*OOC|\bAN\s*[:=]|\bAuthor'?s?\s+Note|\bSystem\s*[:=])/i;

    for (const c of candidates) {
        // Internal implementation note.
        const start = Math.max(0, c.index - 100);
        const end = Math.min(text.length, c.index + 100);
        const context = text.slice(start, end);

        if (!pregContextRe.test(context)) continue;

        // Internal implementation note.
        if (futureContextRe.test(context)) {
            continue;
        }

        // Internal implementation note.
        if (progressContextRe.test(context)) {
            continue;
        }

        // Internal implementation note.
        if (oocContextRe.test(context)) {
            continue;
        }

        // Internal implementation note.
        // Internal implementation note.
        const localChars = text.slice(Math.max(0, c.index - 5), Math.min(text.length, c.index + 10));
        if (/\d\s*\/\s*\d/.test(localChars)) {
            continue;
        }

        // Internal implementation note.
        let weeks = c.value;
        if (c.unit === 'month') {
            // Internal implementation note.
            weeks = c.value * 4;
        }

        // Internal implementation note.
        if (weeks < 1 || weeks > 42) continue;

        return { weeks, source: c.unit, sourceLang: c.lang };
    }

    return null;
}

export function scanStatusTag(text) {
    if (!text) return null;

    // Internal implementation note.
    // Internal implementation note.
    const markerRe = /<!--\s*\[RP_STATUS\s*:\s*/ig;
    const statuses = [];
    let marker;

    while ((marker = markerRe.exec(text)) !== null) {
        const start = text.indexOf('{', marker.index + marker[0].length);
        if (start < 0) continue;

        let depth = 0;
        let inString = false;
        let escaped = false;
        let raw = null;
        let end = -1;

        for (let i = start; i < text.length; i++) {
            const ch = text[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch === '\\') {
                    escaped = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '"') {
                inString = true;
            } else if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    end = i;
                    raw = text.slice(start, i + 1);
                    break;
                }
            }
        }

        if (!raw) continue;
        const closing = text.slice(end + 1).match(/^\s*\]\s*-->/);
        if (!closing) continue;
        const json = _safeParseJson(raw);
        if (!json || typeof json !== 'object' || Array.isArray(json)) {
        } else {
            statuses.push(json);
        }

        // Internal implementation note.
        if (end >= 0) markerRe.lastIndex = end + 1 + (closing ? closing[0].length : 0);
    }

    if (statuses.length === 0) return null;

    // Internal implementation note.
    // Internal implementation note.
    const merged = Object.assign({}, ...statuses);
    return merged;
}

// Parse RP_DATE tag → Date or null
// Internal implementation note.
export function scanDateTag(text) {
    if (!text) return null;
    let m = text.match(RP_DATE_RE_DOT);
    if (m) return _parseDate(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), m[4], m[5]);
    m = text.match(RP_DATE_RE_SLASH);
    if (m) return _parseDate(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), m[4], m[5]);
    m = text.match(RP_DATE_RE_ISO);
    if (m) return _parseDate(parseInt(m[3]), parseInt(m[2]), parseInt(m[1]), m[4], m[5]);
    const phone = text.match(/<!--\s*tel:time:(\d{1,2}):(\d{2})\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\s*-->/i);
    if (phone) return _parseDate(+phone[3], +phone[4], +phone[5], phone[1], phone[2]);
    // Only the diary entry header is a clock. Dates mentioned inside its prose aren't.
    const diary = text.match(/<!--\s*diary\s*(?:📖\s*)?(?:\u0414\u043d\u0435\u0432\u043d\u0438\u043a|Diary)\s+(\d{1,2})\.(\d{1,2})\.(\d{1,4})[,\s]+(\d{1,2}):(\d{2})/i);
    if (diary) return _parseDate(+diary[1], +diary[2], +diary[3], diary[4], diary[5]);
    return null;
}

function _parseDate(day, month, year, hourStr, minStr) {
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1) return null;
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    // Internal implementation note.
    if (hourStr !== undefined && minStr !== undefined) {
        const h = parseInt(hourStr);
        const mn = parseInt(minStr);
        if (!(h >= 0 && h <= 23 && mn >= 0 && mn <= 59)) return null;
        if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59) {
            d.setHours(h, mn, 0, 0);
            d.rpTime = `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
        }
    }
    return d;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function stripThink(text) {
    if (!text) return '';
    let res = String(text);
    // Internal implementation note.
    res = res.replace(/<(think|thinking|reasoning|analysis|reflection)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // Internal implementation note.
    const unclosed = res.match(/<(think|thinking|reasoning)[^>]*>/i);
    if (unclosed) {
        // Internal implementation note.
        const isPrefillWrapper = res.slice(0, unclosed.index).trim() === '';
        const inner = res.slice(unclosed.index + unclosed[0].length);
        // Internal implementation note.
        if (isPrefillWrapper && /<!--\s*\[/.test(inner)) {
            res = res.slice(0, unclosed.index) + inner;
        } else {
            res = res.slice(0, unclosed.index);
        }
    }
    return res;
}

// Internal implementation note.
export function messageRaw(msg) {
    if (!msg) return '';
    const current = msg.mes || '';
    // New markers always belong to the current answer, never to a cached swipe.
    if (hasReproTags(current)) return current;
    if (msg.extra?.reproRawInvalid) return current;
    const raw = msg.extra?.reproRaw;
    if (typeof raw !== 'string') return current;
    const savedSwipe = msg.extra?.reproRawSwipe;
    if (savedSwipe !== undefined && savedSwipe !== (msg.swipe_id ?? null)) return current;
    // Also validates legacy caches without metadata. An edit invalidates the cache.
    return stripReproTags(raw) === current ? raw : current;
}

// Internal implementation note.
// Internal implementation note.
export const REPRO_TAG_RE = /<!--\s*\[(?:RP_STATUS|RP_DATE|CONCEPTION_CHECK|BIRTH|MISCARRIAGE|ABORTION|SEX_REVEAL|CYCLE_DAY|PREGNANCY_STATE|BABY_TRAITS)(?::CHAR)?[\s\S]*?-->/gi;

export function hasReproTags(text) {
    REPRO_TAG_RE.lastIndex = 0;
    return !!text && REPRO_TAG_RE.test(text);
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function stripReproTags(text) {
    if (!text) return text;
    return String(text)
        .replace(REPRO_TAG_RE, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+$/gm, '')
        .trim();
}

export function stripHiddenTags(text) {
    if (!text) return text;
    text = text.replace(/<!--\s*\[(?!RP_DATE)[\s\S]*?\]\s*-->/g, '');
    text = text.replace(/<repro_scan>[\s\S]*?<\/repro_scan>/gi, '');
    text = text.replace(/<!--\s*repro\b[\s\S]*?-->/gi, '');
    text = text.replace(/\[?CONCEPTION_CHECK(?::CHAR)?\]?/gi, '');
    text = text.replace(/\[?BIRTH(?::CHAR)?\]?(?!\w)/gi, '');
    text = text.replace(/\[?MISCARRIAGE\]?/gi, '');
    text = text.replace(/\[?ABORTION\]?(?!\w)/gi, '');
    text = text.replace(/\[?SEX_REVEAL(?::CHAR)?\]?/gi, '');
    text = text.replace(/\[?CYCLE_DAY[:\s]*\d+\]?/gi, '');
    text = text.replace(/\[?RP_STATUS:\s*\{[\s\S]*?\}\s*\]?/gi, '');
    text = text.replace(/\[?BABY_TRAITS:\s*\{[\s\S]*?\}\s*\]?/gi, '');
    return text.trim();
}

// Internal implementation note.
export function isScanning() { return false; }

export async function scanChat() {
    const chat = typeof SillyTavern?.getContext === 'function'
        ? SillyTavern.getContext().chat
        : window.chat;
    if (!chat || chat.length === 0) return null;
    const lastMessage = chat[chat.length - 1];
    if (!lastMessage || lastMessage.is_user) return null;
    return scanMessage(messageRaw(lastMessage));
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
//
// Internal implementation note.
function isTrackedForScan(s, who) {
    const mode = s?.trackFor || 'user';
    return mode === 'both' || mode === who;
}

export async function scanFullHistory() {
    const chat = typeof SillyTavern?.getContext === 'function'
        ? SillyTavern.getContext().chat
        : window.chat;
    if (!chat || chat.length === 0) return { processed: 0, conceptions: 0, births: 0, dates: 0, sexReveals: 0 };

    // Internal implementation note.
    const { applyScanResult, createPregnancyFromWeeks, createPregnancyFromStateTag, partnerCheckConception, partnerBirth, createUndoCheckpoint } = await import('./pregnancy.js');
    const { processDateTag } = await import('./message-handler.js');
    const { getPregnancyData, getPartnerData, getSettings, setCycleDay } = await import('./state.js');
    const { defaultPregnancyData } = await import('./config.js');

    const s = getSettings();
    const stats = { processed: 0, conceptions: 0, births: 0, charConceptions: 0, charBirths: 0, dates: 0, sexReveals: 0, charSexReveals: 0 };

    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    const p = getPregnancyData();
    createUndoCheckpoint('Full chat rescan');
    const savedUserPregnancy = p.isPregnant ? structuredClone({
        isPregnant: p.isPregnant, conceptionDate: p.conceptionDate, pregnancyWeeks: p.pregnancyWeeks,
        _conceptionAnchored: p._conceptionAnchored, fetusCount: p.fetusCount, fetusSex: p.fetusSex,
        fetusSexRevealed: p.fetusSexRevealed, complications: p.complications, _plannedComplications: p._plannedComplications,
        healthStatus: p.healthStatus, pregnancyKnown: p.pregnancyKnown, testTakenAt: p.testTakenAt,
        lastTestResult: p.lastTestResult, fatherName: p.fatherName, mood: p.mood, libido: p.libido,
        weightGain: p.weightGain, babyActivity: p.babyActivity,
    }) : null;
    const savedPartner = p.partner ? structuredClone(p.partner) : null;
    const savedGrown = Array.isArray(p.grownChildren) ? [...p.grownChildren] : [];
    const savedBabyState = p.hasBaby ? {
        hasBaby: true,
        babies: Array.isArray(p.babies) ? structuredClone(p.babies) : [],
        babyName: p.babyName || '',
        babyCount: p.babyCount || 0,
        babySex: Array.isArray(p.babySex) ? [...p.babySex] : [],
        babyBirthRpDate: p.babyBirthRpDate || null,
        babyHealth: p.babyHealth || 'normal',
        babyMood: p.babyMood || '',
        babyDiaperClean: p.babyDiaperClean !== false,
        babySleep: p.babySleep || '',
        babyAge: p.babyAge || '',
        babyFeedingType: p.babyFeedingType || '',
        babyTeething: !!p.babyTeething,
        babyColicky: !!p.babyColicky,
        babyMilestones: Array.isArray(p.babyMilestones) ? [...p.babyMilestones] : [],
        momState: p.momState || null,
    } : null;
    const undoSnapshot = p._undoSnapshot ? structuredClone(p._undoSnapshot) : null;
    Object.keys(p).forEach(k => delete p[k]);
    Object.assign(p, structuredClone(defaultPregnancyData));
    if (undoSnapshot) p._undoSnapshot = undoSnapshot;
    p.grownChildren = savedGrown;
    // Internal implementation note.
    setCycleDay(14, false);

    // Internal implementation note.
    const oldNotify = s.showNotifications;
    s.showNotifications = false;

    // Internal implementation note.
    const oldBlocks = {
        conceptionUser: s._conceptionBlockedUntilUser,
        conceptionChar: s._conceptionBlockedUntilChar,
        birthUser: s._birthBlockedUntilUser,
        birthChar: s._birthBlockedUntilChar,
        legacy: s._conceptionBlockedUntil,
        historyScan: s._historyScanInProgress,
    };
    s._conceptionBlockedUntilUser = null;
    s._conceptionBlockedUntilChar = null;
    s._birthBlockedUntilUser = null;
    s._birthBlockedUntilChar = null;
    s._conceptionBlockedUntil = null;
    s._historyScanInProgress = true;

    try {
        for (let i = 0; i < chat.length; i++) {
            const msg = chat[i];
            if (!msg || !msg.mes || msg.is_system) continue;
            const text = stripThink(messageRaw(msg));
            stats.processed++;

            // Internal implementation note.
            if (processDateTag(text)) stats.dates++;

            // Internal implementation note.
            const statusData = scanStatusTag(text);
            if (statusData) {
                const p2 = getPregnancyData();
                // New status schema: user is explicit, partner remains the
                // character/second-carrier branch. Legacy root-level status
                // is still accepted so old messages remain reconstructable.
                const userStatus = statusData.user && typeof statusData.user === 'object'
                    ? statusData.user
                    : statusData;
                const partnerStatus = statusData.partner && typeof statusData.partner === 'object'
                    ? statusData.partner
                    : statusData.char && typeof statusData.char === 'object'
                        ? statusData.char
                        : null;

                if (p2.hasBaby) {
                    p2._dynamic = { note: userStatus.note || null, _owner: 'user' };
                } else if (p2.isPregnant) {
                    p2._dynamic = {
                        symptoms: userStatus.symptoms || null,
                        recommendations: userStatus.recommendations || null,
                        movements: userStatus.movements || null,
                        swelling: userStatus.swelling || null,
                        braxton_hicks: userStatus.braxton_hicks || null,
                        fetal_position: userStatus.fetal_position || null,
                        note: userStatus.note || null,
                        _owner: 'user',
                    };
                    if (userStatus.mood) p2.mood = userStatus.mood;
                    if (userStatus.libido) p2.libido = userStatus.libido;
                    if (userStatus.weight_gain) p2.weightGain = userStatus.weight_gain;
                    if (userStatus.baby_activity) p2.babyActivity = userStatus.baby_activity;
                    if (userStatus.father_name) p2.fatherName = String(userStatus.father_name).slice(0, 80);
                } else {
                    p2._dynamic = {
                        fertility: userStatus.fertility || null,
                        libido: userStatus.libido || null,
                        mood: userStatus.mood || null,
                        physical: userStatus.physical || null,
                        note: userStatus.note || null,
                        _owner: 'user',
                    };
                }

                if (partnerStatus && isTrackedForScan(s, 'char')) {
                    const c2 = getPartnerData();
                    if (c2.isPregnant) {
                        c2._dynamic = {
                            symptoms: partnerStatus.symptoms || null,
                            recommendations: partnerStatus.recommendations || null,
                            movements: partnerStatus.movements || null,
                            swelling: partnerStatus.swelling || null,
                            braxton_hicks: partnerStatus.braxton_hicks || null,
                            fetal_position: partnerStatus.fetal_position || null,
                            fetusSize: partnerStatus.fetus_size || null,
                            note: partnerStatus.note || null,
                            _owner: 'char',
                        };
                        if (partnerStatus.mood) c2.mood = partnerStatus.mood;
                        if (partnerStatus.libido) c2.libido = partnerStatus.libido;
                        if (partnerStatus.weight_gain) c2.weightGain = partnerStatus.weight_gain;
                        if (partnerStatus.baby_activity) c2.babyActivity = partnerStatus.baby_activity;
                        if (partnerStatus.father_name) c2.fatherName = String(partnerStatus.father_name).slice(0, 80);
                    } else {
                        c2._dynamic = {
                            fertility: partnerStatus.fertility || null,
                            libido: partnerStatus.libido || null,
                            mood: partnerStatus.mood || null,
                            physical: partnerStatus.physical || null,
                            note: partnerStatus.note || null,
                            _owner: 'char',
                        };
                    }
                }
            }

            // Internal implementation note.
            const tagResult = scanMessage(text);
            if (tagResult) {
                // Internal implementation note.
                if (tagResult.vaginal_ejaculation_occurred && tagResult._source === 'keyword' && msg.is_user) {
                    tagResult.vaginal_ejaculation_occurred = false;
                }
                if (tagResult.birth_occurred && tagResult._source === 'keyword' && msg.is_user) {
                    tagResult.birth_occurred = false;
                }
                const p2 = getPregnancyData();
                if (p2.isPregnant) tagResult.vaginal_ejaculation_occurred = false;

                if (tagResult.vaginal_ejaculation_occurred) {
                    applyScanResult(tagResult);
                    stats.conceptions++;
                } else if (tagResult.birth_occurred && p2.isPregnant) {
                    applyScanResult({ ...tagResult, _silent: true });
                    stats.births++;
                } else if ((tagResult.miscarriage_occurred || tagResult.abortion_occurred) && p2.isPregnant) {
                    applyScanResult(tagResult);
                } else if (tagResult.sex_revealed && p2.isPregnant && !p2.fetusSexRevealed) {
                    if (tagResult.revealed_sexes && tagResult.revealed_sexes.length > 0) {
                        const need = p2.fetusCount || 1;
                        const newSex = [];
                        for (let j = 0; j < need; j++) {
                            newSex.push(tagResult.revealed_sexes[j] || tagResult.revealed_sexes[tagResult.revealed_sexes.length - 1]);
                        }
                        p2.fetusSex = newSex;
                    }
                    p2.fetusSexRevealed = true;
                    stats.sexReveals++;
                }
            }

            // 3b) :CHAR events — symmetric recovery for the tracked partner.
            if (tagResult && isTrackedForScan(s, 'char')) {
                const c = getPartnerData();
                if (tagResult.char_conception && !c.isPregnant) {
                    partnerCheckConception();
                    stats.charConceptions++;
                }
                if (tagResult.char_sex_revealed && c.isPregnant && !c.fetusSexRevealed) {
                    if (tagResult.revealed_sexes?.length) {
                        const need = c.fetusCount || 1;
                        c.fetusSex = Array.from({ length: need }, (_, j) => tagResult.revealed_sexes[j] || tagResult.revealed_sexes[tagResult.revealed_sexes.length - 1]);
                    }
                    c.fetusSexRevealed = true;
                    stats.charSexReveals++;
                }
                if (tagResult.char_birth && c.isPregnant) {
                    if (partnerBirth(tagResult.baby_traits, { silent: true, source: 'tag' })) stats.charBirths++;
                }
            }

            // Internal implementation note.
            // Internal implementation note.
            {
                const p3 = getPregnancyData();
                if (!p3.isPregnant) {
                    const pregState = scanPregnancyStateTag(text);
                    if (pregState && createPregnancyFromStateTag(pregState, { notify: false })) {
                        stats.conceptions++;
                    }
                }
            }

            // Internal implementation note.
            {
                const p4 = getPregnancyData();
                if (!p4.isPregnant) {
                    const weeksData = scanWeeksFromText(text);
                    if (weeksData && createPregnancyFromWeeks(weeksData.weeks, { notify: false })) {
                        stats.conceptions++;
                    }
                }
            }
        }
    } finally {
        // Internal implementation note.
        s.showNotifications = oldNotify;
        s._conceptionBlockedUntilUser = oldBlocks.conceptionUser;
        s._conceptionBlockedUntilChar = oldBlocks.conceptionChar;
        s._birthBlockedUntilUser = oldBlocks.birthUser;
        s._birthBlockedUntilChar = oldBlocks.birthChar;
        s._conceptionBlockedUntil = oldBlocks.legacy;
        s._historyScanInProgress = oldBlocks.historyScan;
        s._lastScannedPosition = chat.length;
    }

    // Manual/current user pregnancy should survive a full scan when the history has
    // no reproductive evidence capable of rebuilding it.
    if (savedUserPregnancy && stats.conceptions === 0 && stats.births === 0) {
        Object.assign(getPregnancyData(), savedUserPregnancy);
    }

    // If the partner was configured/manually pregnant but history contains no :CHAR
    // reproductive events, preserve that state instead of silently deleting it.
    if (savedPartner) {
        const rebuiltPartner = getPartnerData();
        const noCharEvidence = stats.charConceptions === 0 && stats.charBirths === 0 && stats.charSexReveals === 0;
        const lostActivePregnancy = savedPartner.isPregnant && !rebuiltPartner.isPregnant && stats.charBirths === 0;
        if (noCharEvidence || lostActivePregnancy) getPregnancyData().partner = savedPartner;
    }

    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    if (savedBabyState && stats.births === 0 && stats.charBirths === 0) {
        const pNow = getPregnancyData();
        // Internal implementation note.
        pNow.isPregnant = false;
        pNow.conceptionDate = null;
        pNow.pregnancyWeeks = 0;
        pNow.fetusCount = 0;
        pNow.fetusSex = [];
        pNow.fetusSexRevealed = false;
        pNow.complications = [];
        pNow._plannedComplications = [];
        // Internal implementation note.
        Object.assign(pNow, savedBabyState);
    }

    return stats;
}

// Read a discovery from this carrier's own status, never from the whole scene:
// a partner's dialogue may refer to somebody else, a wish, or an earlier pregnancy.
export function confirmedFetusCount(status) {
    if (!status || typeof status !== 'object') return null;
    const tagged = Number(status.fetus_count);
    if (status.fetus_count_confirmed === true && Number.isInteger(tagged) && tagged >= 1 && tagged <= 4) return tagged;
    const found = new Set();
    for (const key of ['note', 'symptoms']) {
        if (typeof status[key] !== 'string') continue;
        for (const sentence of status[key].slice(0, 800).split(/[.!?;\n]+/)) {
            if (/\u043f\u043e\u0434\u0440\u0443\u0433|\u0441\u0435\u0441\u0442\u0440|\u0441\u043e\u0441\u0435\u0434|\u0434\u0440\u0443\u0433\u043e\u0439 \u0431\u0435\u0440\u0435\u043c\u0435\u043d\u043d|\u0447\u0443\u0436|\u0441\u043d\u044b|\u0432\u043e \u0441\u043d\u0435|\u043f\u0440\u0438\u0441\u043d\u0438\u043b|dream|friend's|sister's/i.test(sentence)) continue;
            if (/(?:\b(?:not|no|may|might|hope|wish|fear|suspect|maybe|previous)\b|(?:^|\s)(?:\u043d\u0435|\u043d\u0435\u0442|\u0435\u0441\u043b\u0438|\u0431\u044b)(?:\s|$)|\u043c\u043e\u0436\u0435\u0442|\u043f\u043e\u0445\u043e\u0436\u0435|\u044f\u043a\u043e\u0431\u044b|\u0445\u043e\u0447|\u043c\u0435\u0447\u0442\u0430|\u0431\u043e\u0438\u0442\u0441\u044f|\u0441\u0442\u0440\u0430\u0445|\u043d\u0430\u0434\u0435|\u0432\u043e\u0437\u043c\u043e\u0436|\u043f\u0440\u0435\u0434\u043f\u043e\u043b\u043e\u0436|\u043f\u043e\u0434\u043e\u0437\u0440|\u0432\u0435\u0440\u043e\u044f\u0442|\u0440\u0430\u043d\u044c\u0448\u0435|\u043f\u0440\u043e\u0448\u043b|\u0435\u0449[\u0435\u0451] \u043d\u0435)/i.test(sentence)) continue;
            if (!/(?:\u0443\u0437\u043d\u0430\u043b|\u0432\u044b\u044f\u0441\u043d\u0438\u043b|\u043e\u0431\u043d\u0430\u0440\u0443\u0436|\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434|\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436|\u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d|\u043f\u043e\u043a\u0430\u0437\u0430\u043b|\u0441\u043e\u043e\u0431\u0449\u0438\u043b|\u0432\u044b\u044f\u0432|confirmed|discovered|learned|found out|scan shows)/i.test(sentence)) continue;
            const counts = [];
            if (/\u0434\u0432\u043e\u0439\u043d|\u0431\u043b\u0438\u0437\u043d\u0435\u0446|\btwins\b|(?:\u0434\u0432\u0430|\u0434\u0432\u043e\u0435|\u0434\u0432\u0443\u0445|2)\s+(?:\u043f\u043b\u043e\u0434|\u0440\u0435\u0431[\u0435\u0451]\u043d|\u043c\u0430\u043b\u044b\u0448|\u044f\u0439\u0446|fetuses|babies|eggs)/i.test(sentence)) counts.push(2);
            if (/\u0442\u0440\u043e\u0439\u043d|\btriplets\b|(?:\u0442\u0440\u0438|\u0442\u0440[\u0435\u0451]\u0445|3)\s+(?:\u043f\u043b\u043e\u0434|\u0440\u0435\u0431[\u0435\u0451]\u043d|\u043c\u0430\u043b\u044b\u0448|\u044f\u0439\u0446|fetuses|babies|eggs)/i.test(sentence)) counts.push(3);
            if (/\u0447\u0435\u0442\u0432\u0435\u0440\u043d|\bquadruplets\b|(?:\u0447\u0435\u0442\u044b\u0440\u0435|\u0447\u0435\u0442\u044b\u0440[\u0435\u0451]\u0445|4)\s+(?:\u043f\u043b\u043e\u0434|\u0440\u0435\u0431[\u0435\u0451]\u043d|\u043c\u0430\u043b\u044b\u0448|\u044f\u0439\u0446|fetuses|babies|eggs)/i.test(sentence)) counts.push(4);
            if (/(?:\u043e\u0434\u0438\u043d|\u043e\u0434\u043d\u043e\u0433\u043e|1)\s+(?:\u043f\u043b\u043e\u0434|\u0440\u0435\u0431[\u0435\u0451]\u043d|\u043c\u0430\u043b\u044b\u0448|fet[u]?s|baby)|\u043e\u0434\u043d\u043e\s+\u044f\u0439\u0446\u043e|singleton/i.test(sentence)) counts.push(1);
            if (counts.length === 1) found.add(counts[0]);
        }
    }
    return found.size === 1 ? [...found][0] : null;
}
