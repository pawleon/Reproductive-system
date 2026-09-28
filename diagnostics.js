// Keep actionable errors without flooding the console on repeated render events.
const lastErrorAt = new Map();
export function reportError(label, ...details) {
    const now = Date.now();
    if (lastErrorAt.has(label) && now - lastErrorAt.get(label) < 30000) return;
    lastErrorAt.set(label, now);
    console.error(label, ...details);
}
