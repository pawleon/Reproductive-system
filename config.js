// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

export const extensionName = 'reproductive-system';

export const defaultSettings = {
    isEnabled: true,
    showNotifications: true,
    language: 'en',
    // Legacy alias for old saves/UI. New code keeps separate protection per carrier.
    contraception: 'none',
    contraceptionUser: 'none',
    contraceptionChar: 'none',
    // Anti-resurrection blocks are per carrier so simultaneous pregnancies do not interfere.
    _conceptionBlockedUntilUser: null,
    _conceptionBlockedUntilChar: null,
    _birthBlockedUntilUser: null,
    _birthBlockedUntilChar: null,
    cycleDay: 1,
    lastCycleUpdate: null,
    totalChecks: 0,
    totalConceptions: 0,
    chatPregnancyData: {},
    pregnancyDuration: 40,
    twinsChance: 3,
    tripletsChance: 0.1,
    scanDepth: 10,
    scanResponseLength: 1500,
    autoScan: true,
    infoblockPosition: 'off',
    customInfoblockCss: '',
    // Internal implementation note.
    realism: false,
    menstruationEnabled: true,
    theme: 'glass',
    lightMode: false,
    // Internal implementation note.
    // Internal implementation note.
    babyMaxAgeDays: 730,
    // Internal implementation note.
    debugKeepTags: false,

    // Internal implementation note.
    // Internal implementation note.
    trackFor: 'user',

    // Explicit selection also controls tracking. Legacy auto migrates from trackFor.
    carrierMode: 'user',
    // Changes only the ovulatory phase name, never anatomy or eligibility.
    universe: 'normal',
    userDesignation: 'omega',
    charDesignation: 'alpha',

    // Internal implementation note.
    // Internal implementation note.
    hiddenPregnancy: true,
    // Internal implementation note.
    obviousAtWeek: 12,
    // Internal implementation note.
    tryingToConceive: false,

};

export const defaultPregnancyData = {
    isPregnant: false,
    // Internal implementation note.
    cycleDay: 1,
    lastCycleUpdate: null,
    conceptionDate: null,
    pregnancyWeeks: 0,
    rpDate: null,
    _lastRpDateTag: null,
    fetusCount: 1,
    fetusSex: [],
    fetusSexRevealed: false,
    complications: [],
    _plannedComplications: [],
    healthStatus: 'normal',
    lastComplicationCheck: null,
    lastComplicationCheckRpDate: null,
    lastDoctorVisitRpDate: null,
    // Pregnancy extras
    mood: '',
    libido: '',
    weightGain: '',
    babyActivity: '',
    // Baby data (after birth)
    hasBaby: false,
    babyName: '',
    babySex: [],
    babyCount: 0,
    babyAge: '',
    babyHealth: 'normal',
    babyTeething: false,
    babyColicky: false,
    babyDiaperClean: true,
    babyFeedingType: '',
    babySleep: '',
    babyMood: '',
    babyMilestones: [],
    babyBirthRpDate: null,
    babyLastFeedRpDate: null,
    babyLastChangeRpDate: null,
    momState: '',
    // Per-baby data (array of individual baby objects)
    babies: [],
    // Internal implementation note.
    grownChildren: [],
    // Dynamic descriptions from AI
    _dynamic: {},

    // Internal implementation note.
    pregnancyKnown: false,   // Internal implementation note.
    testTakenAt: null,       // Internal implementation note.
    lastTestResult: null,    // 'positive' | 'negative' | 'faint'
    missedPeriodDays: 0,     // Internal implementation note.

    // Internal implementation note.
    postpartum: null,        // { startRpDate, lactating, healing, cycleReturned }

    // Internal implementation note.
    hygieneType: 'pad',          // 'pad' | 'tampon' | 'cup' | 'none'
    hygieneChangedRpDate: null,  // Internal implementation note.
    _cycleShift: 0,              // Internal implementation note.

    // Internal implementation note.

    // Internal implementation note.
    // Internal implementation note.
    partner: null, // Internal implementation note.
};

// Internal implementation note.
export const defaultPartnerData = {
    isPregnant: false,
    cycleDay: 1,
    lastCycleUpdate: null,
    conceptionDate: null,
    pregnancyWeeks: 0,
    fetusCount: 1,
    fetusSex: [],
    fetusSexRevealed: false,
    complications: [],
    _plannedComplications: [],
    healthStatus: 'normal',
    mood: '',
    libido: '',
    weightGain: '',
    babyActivity: '',
    fatherName: '',
    pregnancyKnown: false,
    testTakenAt: null,
    lastTestResult: null,
    postpartum: null,
    _conceptionAnchored: false,
    _userSetWeeksAt: null,
    _userSetCycleAt: null,
    _dynamic: {},
    hygieneType: 'pad',
    hygieneChangedRpDate: null,
    _cycleShift: 0,
    // A/B/O
};

export const CHANCES = {
    base: 20,
    contraception: {
        none: 0,
        condom: 85,
        pill: 91,
        iud: 99,
    },
};

export const LANG = {
    ru: {
        title: 'Reproductive System',
        enabled: 'Enabled',
        notifications: 'Notifications',
        contraceptionTitle: 'Contraception',
        contraceptionTypes: {
            none: 'No protection',
            condom: 'Condom (85%)',
            pill: 'Pill (91%)',
            iud: 'IUD (99%)',
        },
        cycleDay: 'Cycle day',
        status: 'Status',
        notPregnant: 'Not pregnant',
        pregnant: 'Pregnant',
        conceptionSuccess: 'CONCEPTION OCCURRED!',
        conceptionFail: 'No conception occurred',
        contraceptionFailed: 'CONTRACEPTION FAILED!',
        stats: 'Conceptions: {conceptions} | Checks: {checks}',
        reset: 'Reset pregnancy',
        scan: 'Scan chat',
        scanning: 'Scanning...',
        scanDepth: 'Scan depth',
        autoScan: 'Auto-scan',
    },
    en: {
        title: 'Reproductive System',
        enabled: 'Enable',
        notifications: 'Notifications',
        contraceptionTitle: 'Contraception',
        contraceptionTypes: {
            none: 'None',
            condom: 'Condom (85%)',
            pill: 'Pill (91%)',
            iud: 'IUD (99%)',
        },
        cycleDay: 'Cycle day',
        status: 'Status',
        notPregnant: 'Not pregnant',
        pregnant: 'Pregnant',
        conceptionSuccess: 'CONCEPTION!',
        conceptionFail: 'No conception',
        contraceptionFailed: 'Contraception failed!',
        stats: 'Checks: {checks} | Conceptions: {conceptions}',
        reset: 'Reset pregnancy',
        scan: 'Scan chat',
        scanning: 'Scanning...',
        scanDepth: 'Scan depth',
        autoScan: 'Auto-scan',
    },
};

export const REPRO_REGEX = /<repro>([\s\S]*?)<\/repro>/i;
export const EXPIRATION_DEPTH = 50;
