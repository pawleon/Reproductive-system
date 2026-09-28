// Compatibility API. One cycle per explicitly selected carrier; no sex/role inference.
import { getPhaseInfo } from './helpers.js';
export function isOmegaverse(s) { return s?.universe === 'omegaverse'; }
export function carrierMode(s) {
    if (['user', 'char', 'both', 'none'].includes(s?.carrierMode)) return s.carrierMode;
    return ['user', 'char', 'both', 'none'].includes(s?.trackFor) ? s.trackFor : 'user';
}
export function canCarry(s, who) { const m = carrierMode(s); return (who === 'user' || who === 'char') && (m === 'both' || m === who); }
export function hasMenstrualCycle(s, who) { return canCarry(s, who); }
export function hasAnyTracking(s, who) { const mode = s?.trackFor || 'user'; return mode === 'both' || mode === who; }
// Legacy callers cannot reintroduce role-based fertility or independent clocks.
export function designationOf(s, who) {
    const role = who === 'char' ? s?.charDesignation : s?.userDesignation;
    return ['alpha','beta','omega'].includes(role) ? role : who === 'char' ? 'alpha' : 'omega';
}
export function hasCycle(s, who) { return canCarry(s, who) || (isOmegaverse(s) && designationOf(s, who) !== 'beta'); }
export function roleLabel(s, who) { return {alpha:'Alpha',beta:'Beta',omega:'Omega'}[designationOf(s,who)]; }
export function cyclePhase(s, who, day, lang = 'ru') {
    const abo = isOmegaverse(s), role = designationOf(s, who), carrier = canCarry(s, who), en = lang === 'en';
    const info = getPhaseInfo(day, lang, false, s?.menstruationEnabled !== false && carrier);
    if (!abo) return carrier ? info : { ...info, name: en ? 'State' : 'Status', color:'#999999' };
    const active = day >= 12 && day <= 16;
    if (role === 'beta') return carrier ? info : { ...info, name: en ? 'Beta' : 'Beta', color:'#999999' };
    if (active) return { ...info, name: role === 'alpha' ? (carrier ? (en ? 'Ovulation / rut' : 'Ovulation / rut') : 'Rut') : (carrier ? (en ? 'Ovulation / heat' : 'Ovulation / heat') : 'Heat'), color:'#ff6b6b' };
    if (!carrier) return { ...info, name: role === 'alpha' ? 'Outside rut' : 'Between heats', color:'#a88ae3' };
    return info;
}
export function sexOf(s, who) { return who === 'char' ? s?.charSex : s?.userSex; }
export function getCfg() { return { heatCycleLength: 28, heatDuration: 5, rutCycleLength: 28, rutDuration: 0 }; }
export function getHeatPhase(day) {
    const d = Math.max(1, Math.trunc(Number(day)) || 1);
    const info = getPhaseInfo(d, 'ru', true);
    const heat = d >= 12 && d <= 16;
    return { phase: heat ? 'heat' : d > 28 ? 'delayed' : 'normal', day: d, len: 28,
        label: info.name + (heat ? ` · ${d - 11}/5 days` : ''),
        sub: d > 28 ? `Delay ${d - 28} days` : `day ${d} of 28`,
        labelEn: getPhaseInfo(d, 'en', true).name + ` (cycle day ${d}/28)`, fertility: 1 };
}
export function getRutPhase(day) { const phase = getHeatPhase(day); return { ...phase, phase: phase.phase === 'heat' ? 'rut' : phase.phase, inRut: phase.phase === 'heat', potency: phase.phase === 'heat' ? 1.5 : 1 }; }
export function carrierAboStatus(carrier, desig, s) {
    if (carrier?.isPregnant) return { kind:'cycle', phase:'paused', label:'Cycle paused', labelEn:'cycle paused', fertility:0 };
    const day = Math.max(1, parseInt(carrier?.cycleDay) || 1), active = day >= 12 && day <= 16;
    const phase = desig === 'omega' && active ? 'heat' : desig === 'alpha' && active ? 'rut' : 'normal';
    return { kind:desig, phase, day, len:28, inRut:phase==='rut', fertility:1, label:phase==='heat'?'Heat':phase==='rut'?'Rut':desig==='alpha'?'Outside rut':desig==='omega'?'Between heats':'Beta' };
}
export function advanceAboCycles() { return []; }
