// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

import { getSettings } from './state.js';

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function initCustomNotifications() {
    if ($('#custom-notification-container').length > 0) return;

    $('body').append('<div id="custom-notification-container"></div>');

    $('head').append(`<style id="repro-notifications-style">
#custom-notification-container {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
}
.custom-notification {
    min-width: 300px;
    max-width: 500px;
    padding: 16px 22px;
    border-radius: 15px;
    font-size: 14px;
    font-weight: 600;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    animation: slideIn 0.3s ease-out;
    pointer-events: all;
    position: relative;
    cursor: pointer;
}
.custom-notification.success {
    background: rgba(0, 255, 136, 0.15);
    border: 1px solid rgba(0, 255, 136, 0.3);
    color: #00ff88;
    box-shadow: 0 8px 32px rgba(0, 255, 136, 0.2);
}
.custom-notification.warning {
    background: rgba(255, 170, 0, 0.15);
    border: 1px solid rgba(255, 170, 0, 0.3);
    color: #ffaa00;
    box-shadow: 0 8px 32px rgba(255, 170, 0, 0.2);
}
.custom-notification.info {
    background: rgba(74, 158, 255, 0.15);
    border: 1px solid rgba(74, 158, 255, 0.3);
    color: #4a9eff;
    box-shadow: 0 8px 32px rgba(74, 158, 255, 0.2);
}
.custom-notification .close-btn {
    position: absolute;
    top: 10px;
    right: 12px;
    background: none;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
    opacity: 0.7;
    line-height: 1;
}
.custom-notification .close-btn:hover { opacity: 1; }
.custom-notification i.fa-solid { margin-right: 6px; font-size: 15px; vertical-align: middle; }
@keyframes slideIn {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
@keyframes slideOut {
    to { transform: translateY(-100%); opacity: 0; }
}
</style>`);
}

export function showNotification(message, type = 'info') {
    const s = getSettings();
    if (!s.showNotifications) return;

    initCustomNotifications();

    const container = $('#custom-notification-container');
    const notification = $(`
        <div class="custom-notification ${type}">
            <button class="close-btn">×</button>
            <div>${message}</div>
        </div>
    `);

    container.append(notification);

    notification.find('.close-btn').on('click', function() {
        notification.css('animation', 'slideOut 0.3s ease-in');
        setTimeout(() => notification.remove(), 300);
    });

    setTimeout(() => {
        notification.css('animation', 'slideOut 0.3s ease-in');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ── Birth dialog — congratulations + name input + generated traits ──

// Pool of UNIQUE traits — rolled at 10% chance per baby, otherwise null.
const SPECIAL_TRAITS = [
    { name: 'heterochromia', desc: 'heterochromic eyes', icon: 'fa-eye' },
    { name: 'twin bond', desc: 'empathic bond with sibling', icon: 'fa-link' },
    { name: 'perfect pitch', desc: 'can distinguish notes perfectly from infancy', icon: 'fa-music' },
    { name: 'photographic memory', desc: 'remembers everything after one exposure', icon: 'fa-brain' },
    { name: 'distinctive birthmark', desc: 'unusual birthmark', icon: 'fa-star' },
    { name: 'rare blood type', desc: 'AB(IV) Rh−', icon: 'fa-droplet' },
    { name: 'unusual eye color', desc: 'violet / amber / silver', icon: 'fa-eye' },
    { name: 'sixth finger', desc: 'polydactyly — an extra finger', icon: 'fa-hand' },
    { name: 'white streak of hair', desc: 'white/gray streak of hair from birth', icon: 'fa-feather' },
    { name: 'unusually calm', desc: 'rarely cries, wise-looking gaze', icon: 'fa-moon' },
    { name: 'strong health', desc: 'rarely gets sick, even during an outbreak', icon: 'fa-shield-heart' },
    { name: 'natural talent', desc: 'for art / sports / languages', icon: 'fa-palette' },
];

function rollSpecialTrait(chancePercent = 10) {
    if (Math.random() * 100 >= chancePercent) return null;
    return SPECIAL_TRAITS[Math.floor(Math.random() * SPECIAL_TRAITS.length)];
}

// Fallback random pools — used only if model didn't provide traits via tag
function generateTraits() {
    const traits = [
        'calm', 'vocal', 'curious', 'smiley', 'serious',
        'active', 'sleepy', 'stubborn', 'affectionate', 'restless',
        'quiet', 'cheerful', 'sensitive', 'fussy', 'sociable',
    ];
    const pick = (arr, n) => {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    };
    return {
        personality: pick(traits, 2),
        appearance: [],
        special: null,
    };
}

export function showBirthDialog(babies, onConfirm) {
    // Remove any existing dialog
    $('#repro-birth-overlay').remove();

    let babiesHtml = '';
    const traitsData = [];

    babies.forEach((baby, i) => {
        const isF = baby.sex === 'F';
        const sexIcon = isF ? '♀' : '♂';
        const sexText = isF ? 'girl' : 'boy';
        const sxCls = isF ? 'f' : 'm';

        // Use model-provided traits if present (parsed from [BABY_TRAITS:{...}] tag),
        // Only personality has a random fallback. Appearance needs supplied facts.
        const fallback = generateTraits();
        const personality = (Array.isArray(baby.personality) && baby.personality.length)
            ? baby.personality : fallback.personality;
        const appearance = (Array.isArray(baby.appearance) && baby.appearance.length)
            ? baby.appearance : fallback.appearance;
        const special = baby.special !== undefined ? baby.special : fallback.special;
        const fatherName = baby.fatherName || '';

        traitsData.push({ personality, appearance, special, fatherName });

        const fatherHtml = fatherName
            ? `<div class="rb-trait-section">
                    <span class="rb-trait-label"><i class="fa-solid fa-person"></i>Second parent:</span>
                    <span class="rb-trait-values">${escapeHtml(fatherName)}</span>
               </div>` : '';

        const specialHtml = special
            ? `<div class="rb-special">
                    <i class="fa-solid ${special.icon || 'fa-star'}"></i>
                    <span class="rb-special-name">${escapeHtml(special.name)}</span>
                    <span class="rb-special-desc">— ${escapeHtml(special.desc)}</span>
               </div>` : '';

        babiesHtml += `
        <div class="rb-baby-card">
            <div class="rb-baby-head">
                <div class="rb-sex-icon ${sxCls}">${sexIcon}</div>
                <div class="rb-sex-text ${sxCls}">You have a ${sexText}</div>
            </div>
            <input type="text" class="rb-name-input" data-idx="${i}"
                   placeholder="Enter name…" autocomplete="off"
                   value="${escapeHtml(baby.name || '')}">
            <div class="rb-traits">
                ${fatherHtml}
                <div class="rb-trait-section">
                    <span class="rb-trait-label"><i class="fa-solid fa-brain"></i>Personality:</span>
                    <span class="rb-trait-values">${escapeHtml(personality.join(', '))}</span>
                </div>
                <div class="rb-trait-section">
                    <span class="rb-trait-label"><i class="fa-solid fa-eye"></i>Appearance:</span>
                    <span class="rb-trait-values">${escapeHtml(appearance.length ? appearance.join(', ') : 'Not provided yet')}</span>
                </div>
            </div>
            ${specialHtml}
        </div>`;
    });

    const multiText = babies.length > 1
        ? `<div class="rb-multi">${babies.length === 2 ? 'twins' : babies.length === 3 ? 'triplets' : babies.length + ' babies'}</div>`
        : '';

    const overlay = $(`
    <div id="repro-birth-overlay">
        <div class="rb-dialog">
            <div class="rb-header">
                <div class="rb-header-icon"><i class="fa-solid fa-baby"></i></div>
                <span class="rb-header-title">Congratulations!</span>
                ${multiText}
            </div>
            <div class="rb-babies">${babiesHtml}</div>
            <button class="rb-confirm-btn">
                <i class="fa-solid fa-heart"></i>Confirm
            </button>
        </div>
    </div>`);

    $('body').append(overlay);

    // Focus first name input
    setTimeout(() => overlay.find('.rb-name-input').first().focus(), 100);

    // Confirm button
    overlay.find('.rb-confirm-btn').on('click', () => {
        const names = [];
        overlay.find('.rb-name-input').each(function() {
            names.push($(this).val().trim());
        });
        overlay.css('animation', 'rbFadeOut 0.3s ease');
        overlay.find('.rb-dialog').css('animation', 'rbSlideOut 0.3s ease');
        setTimeout(() => {
            overlay.remove();
            if (onConfirm) onConfirm(names, traitsData);
        }, 280);
    });

    // Enter key to confirm
    overlay.on('keydown', (e) => {
        if (e.key === 'Enter') overlay.find('.rb-confirm-btn').click();
    });
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function showGraduationDialog(graduates, onConfirm) {
    if (!graduates || graduates.length === 0) {
        if (onConfirm) onConfirm([]);
        return;
    }

    // Internal implementation note.
    if ($('#repro-graduation-style').length === 0) {
        $('head').append(`<style id="repro-graduation-style">
.rg-overlay {
    position: fixed; inset: 0; z-index: 1000000;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    animation: rgFadeIn .3s ease-out;
}
@keyframes rgFadeIn { from { opacity: 0; } to { opacity: 1; } }
.rg-card {
    position: relative;
    background: linear-gradient(145deg, rgba(255, 158, 200, 0.18), rgba(180, 120, 255, 0.18));
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    border-radius: 24px;
    padding: 32px 36px;
    min-width: 340px; max-width: 480px;
    box-shadow: 0 20px 60px rgba(255, 120, 180, 0.25);
    text-align: center;
    color: rgba(255, 255, 255, 0.95);
    animation: rgPop .45s cubic-bezier(.34,1.56,.64,1);
    overflow: hidden;
}
@keyframes rgPop { from { transform: scale(.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.rg-icon {
    font-size: 48px; margin-bottom: 12px;
    background: linear-gradient(135deg, #ff9eb4, #b478ff);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 8px rgba(255, 158, 200, 0.4));
}
.rg-title {
    font-size: 22px; font-weight: 700;
    margin-bottom: 8px;
    background: linear-gradient(135deg, #ff9eb4 0%, #b478ff 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
}
.rg-subtitle {
    font-size: 13px; opacity: 0.75;
    margin-bottom: 18px; line-height: 1.5;
}
.rg-names {
    font-size: 16px; font-weight: 600;
    color: rgba(255, 255, 255, 0.92);
    margin-bottom: 22px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
}
.rg-names .rg-sex-icon {
    display: inline-block;
    margin-right: 4px;
    opacity: 0.8;
}
.rg-btn {
    background: linear-gradient(135deg, rgba(255, 158, 200, 0.3), rgba(180, 120, 255, 0.3));
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.95);
    padding: 10px 28px;
    border-radius: 50px;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
    transition: all .2s;
}
.rg-btn:hover {
    background: linear-gradient(135deg, rgba(255, 158, 200, 0.5), rgba(180, 120, 255, 0.5));
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(255, 120, 180, 0.3);
}
/* English implementation note. */
.rg-confetti {
    position: absolute;
    width: 8px; height: 14px;
    top: -20px;
    border-radius: 2px;
    animation: rgConfettiFall linear forwards;
    pointer-events: none;
}
@keyframes rgConfettiFall {
    0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(520px) rotate(720deg); opacity: 0; }
}
</style>`);
    }

    const sexIcon = (s) => s === 'M' ? '<span class="rg-sex-icon" style="color:#4dabf7">♂</span>'
                       : s === 'F' ? '<span class="rg-sex-icon" style="color:#ff9ff3">♀</span>'
                       : '';
    const namesHtml = graduates.map(b => `${sexIcon(b.sex)}${escapeHtml(b.name || 'baby')}`).join(', ');

    const single = graduates.length === 1;
    const title = single ? 'Your baby is all grown up!' : 'Your babies are all grown up!';
    const subtitle = single
        ? 'Time flies... infant tracking is no longer needed. Of course, your child stays with you — diapers and colic are simply removed from the infoblock.'
        : 'Time flies... infant tracking is no longer needed. Of course, your children stay with you — diapers and colic are simply removed from the infoblock.';

    const overlay = $(`<div class="rg-overlay"></div>`);
    const card = $(`
        <div class="rg-card" tabindex="0">
            <div class="rg-icon"><i class="fa-solid fa-child-reaching"></i></div>
            <div class="rg-title">🎉 ${title}</div>
            <div class="rg-subtitle">${subtitle}</div>
            <div class="rg-names">${namesHtml}</div>
            <button class="rg-btn rg-confirm">Got it ✨</button>
        </div>
    `);
    overlay.append(card);
    $('body').append(overlay);
    card.focus();

    // Internal implementation note.
    const colors = ['#ff9eb4', '#b478ff', '#82c8ff', '#ffd64a', '#82e878', '#ff7fbf'];
    const cardEl = card[0];
    for (let i = 0; i < 60; i++) {
        const conf = document.createElement('div');
        conf.className = 'rg-confetti';
        conf.style.left = Math.random() * 100 + '%';
        conf.style.background = colors[Math.floor(Math.random() * colors.length)];
        conf.style.animationDuration = (1.5 + Math.random() * 2) + 's';
        conf.style.animationDelay = (Math.random() * 0.5) + 's';
        cardEl.appendChild(conf);
    }
    // Internal implementation note.
    setTimeout(() => {
        cardEl.querySelectorAll('.rg-confetti').forEach(c => c.remove());
    }, 4500);

    const close = () => {
        overlay.css({ opacity: 0, transition: 'opacity .25s' });
        setTimeout(() => {
            overlay.remove();
            if (onConfirm) onConfirm(graduates);
        }, 280);
    };

    card.find('.rg-confirm').on('click', close);
    overlay.on('click', (e) => { if (e.target === overlay[0]) close(); });
    overlay.on('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') close(); });
}
