/**
 * Modified from https://code.gamelet.com/view/Base/1.11.17
 */

export interface Language {
    code: string;
    nativeName: string;
    englishName: string;
    fallbacks?: Language[],
}

export const LANG = {
    ACH: { code: "ach", nativeName: "Lwo", englishName: "Acholi" },
    ADY: { code: "ady", nativeName: "Адыгэбзэ", englishName: "Adyghe" },
    AF: { code: "af", nativeName: "Afrikaans", englishName: "Afrikaans" },
    AF_NA: { code: "af-NA", nativeName: "Afrikaans (Namibia)", englishName: "Afrikaans (Namibia)" },
    AF_ZA: { code: "af-ZA", nativeName: "Afrikaans (South Africa)", englishName: "Afrikaans (South Africa)" },
    AK: { code: "ak", nativeName: "Tɕɥi", englishName: "Akan" },
    AR: { code: "ar", nativeName: "العربية", englishName: "Arabic" },
    AR_AR: { code: "ar-AR", nativeName: "العربية", englishName: "Arabic" },
    AR_MA: { code: "ar-MA", nativeName: "العربية", englishName: "Arabic (Morocco)" },
    AR_SA: { code: "ar-SA", nativeName: "العربية (السعودية)", englishName: "Arabic (Saudi Arabia)" },
    AY_BO: { code: "ay-BO", nativeName: "Aymar aru", englishName: "Aymara" },
    AZ: { code: "az", nativeName: "Azərbaycan dili", englishName: "Azerbaijani" },
    AZ_AZ: { code: "az-AZ", nativeName: "Azərbaycan dili", englishName: "Azerbaijani" },
    BE_BY: { code: "be-BY", nativeName: "Беларуская", englishName: "Belarusian" },
    BG: { code: "bg", nativeName: "Български", englishName: "Bulgarian" },
    BG_BG: { code: "bg-BG", nativeName: "Български", englishName: "Bulgarian" },
    BN: { code: "bn", nativeName: "বাংলা", englishName: "Bengali" },
    BN_IN: { code: "bn-IN", nativeName: "বাংলা (ভারত)", englishName: "Bengali (India)" },
    BN_BD: { code: "bn-BD", nativeName: "বাংলা(বাংলাদেশ)", englishName: "Bengali (Bangladesh)" },
    BS_BA: { code: "bs-BA", nativeName: "Bosanski", englishName: "Bosnian" },
    CA: { code: "ca", nativeName: "Català", englishName: "Catalan" },
    CA_ES: { code: "ca-ES", nativeName: "Català", englishName: "Catalan" },
    CAK: { code: "cak", nativeName: "Maya Kaqchikel", englishName: "Kaqchikel" },
    CK_US: { code: "ck-US", nativeName: "ᏣᎳᎩ (tsalagi)", englishName: "Cherokee" },
    CS: { code: "cs", nativeName: "Čeština", englishName: "Czech" },
    CS_CZ: { code: "cs-CZ", nativeName: "Čeština", englishName: "Czech" },
    CY: { code: "cy", nativeName: "Cymraeg", englishName: "Welsh" },
    CY_GB: { code: "cy-GB", nativeName: "Cymraeg", englishName: "Welsh" },
    DA: { code: "da", nativeName: "Dansk", englishName: "Danish" },
    DA_DK: { code: "da-DK", nativeName: "Dansk", englishName: "Danish" },
    DE: { code: "de", nativeName: "Deutsch", englishName: "German" },
    DE_AT: { code: "de-AT", nativeName: "Deutsch (Österreich)", englishName: "German (Austria)" },
    DE_DE: { code: "de-DE", nativeName: "Deutsch (Deutschland)", englishName: "German (Germany)" },
    DE_CH: { code: "de-CH", nativeName: "Deutsch (Schweiz)", englishName: "German (Switzerland)" },
    DSB: { code: "dsb", nativeName: "Dolnoserbšćina", englishName: "Lower Sorbian" },
    EL: { code: "el", nativeName: "Ελληνικά", englishName: "Greek" },
    EL_GR: { code: "el-GR", nativeName: "Ελληνικά", englishName: "Greek (Greece)" },
    EN: { code: "en", nativeName: "English", englishName: "English" },
    EN_GB: { code: "en-GB", nativeName: "English (UK)", englishName: "English (UK)" },
    EN_AU: { code: "en-AU", nativeName: "English (Australia)", englishName: "English (Australia)" },
    EN_CA: { code: "en-CA", nativeName: "English (Canada)", englishName: "English (Canada)" },
    EN_IE: { code: "en-IE", nativeName: "English (Ireland)", englishName: "English (Ireland)" },
    EN_IN: { code: "en-IN", nativeName: "English (India)", englishName: "English (India)" },
    EN_PI: { code: "en-PI", nativeName: "English (Pirate)", englishName: "English (Pirate)" },
    EN_UD: { code: "en-UD", nativeName: "English (Upside Down)", englishName: "English (Upside Down)" },
    EN_US: { code: "en-US", nativeName: "English (US)", englishName: "English (US)" },
    EN_ZA: { code: "en-ZA", nativeName: "English (South Africa)", englishName: "English (South Africa)" },
    EN_PIRATE: { code: "en@pirate", nativeName: "English (Pirate)", englishName: "English (Pirate)" },
    EO: { code: "eo", nativeName: "Esperanto", englishName: "Esperanto" },
    EO_EO: { code: "eo-EO", nativeName: "Esperanto", englishName: "Esperanto" },
    ES: { code: "es", nativeName: "Español", englishName: "Spanish" },
    ES_AR: { code: "es-AR", nativeName: "Español (Argentine)", englishName: "Spanish (Argentina)" },
    ES_419: { code: "es-419", nativeName: "Español (Latinoamérica)", englishName: "Spanish (Latin America)" },
    ES_CL: { code: "es-CL", nativeName: "Español (Chile)", englishName: "Spanish (Chile)" },
    ES_CO: { code: "es-CO", nativeName: "Español (Colombia)", englishName: "Spanish (Colombia)" },
    ES_EC: { code: "es-EC", nativeName: "Español (Ecuador)", englishName: "Spanish (Ecuador)" },
    ES_ES: { code: "es-ES", nativeName: "Español (España)", englishName: "Spanish (Spain)" },
    ES_LA: { code: "es-LA", nativeName: "Español (Latinoamérica)", englishName: "Spanish (Latin America)" },
    ES_NI: { code: "es-NI", nativeName: "Español (Nicaragua)", englishName: "Spanish (Nicaragua)" },
    ES_MX: { code: "es-MX", nativeName: "Español (México)", englishName: "Spanish (Mexico)" },
    ES_US: { code: "es-US", nativeName: "Español (Estados Unidos)", englishName: "Spanish (United States)" },
    ES_VE: { code: "es-VE", nativeName: "Español (Venezuela)", englishName: "Spanish (Venezuela)" },
    ET: { code: "et", nativeName: "eesti keel", englishName: "Estonian" },
    ET_EE: { code: "et-EE", nativeName: "Eesti (Estonia)", englishName: "Estonian (Estonia)" },
    EU: { code: "eu", nativeName: "Euskara", englishName: "Basque" },
    EU_ES: { code: "eu-ES", nativeName: "Euskara", englishName: "Basque" },
    FA: { code: "fa", nativeName: "فارسی", englishName: "Persian" },
    FA_IR: { code: "fa-IR", nativeName: "فارسی", englishName: "Persian" },
    FB_LT: { code: "fb-LT", nativeName: "Leet Speak", englishName: "Leet" },
    FF: { code: "ff", nativeName: "Fulah", englishName: "Fulah" },
    FI: { code: "fi", nativeName: "Suomi", englishName: "Finnish" },
    FI_FI: { code: "fi-FI", nativeName: "Suomi", englishName: "Finnish" },
    FO_FO: { code: "fo-FO", nativeName: "Føroyskt", englishName: "Faroese" },
    FR: { code: "fr", nativeName: "Français", englishName: "French" },
    FR_CA: { code: "fr-CA", nativeName: "Français (Canada)", englishName: "French (Canada)" },
    FR_FR: { code: "fr-FR", nativeName: "Français (France)", englishName: "French (France)" },
    FR_BE: { code: "fr-BE", nativeName: "Français (Belgique)", englishName: "French (Belgium)" },
    FR_CH: { code: "fr-CH", nativeName: "Français (Suisse)", englishName: "French (Switzerland)" },
    FY_NL: { code: "fy-NL", nativeName: "Frysk", englishName: "Frisian (West)" },
    GA: { code: "ga", nativeName: "Gaeilge", englishName: "Irish" },
    GA_IE: { code: "ga-IE", nativeName: "Gaeilge (Gaelic)", englishName: "Irish (Gaelic)" },
    GL: { code: "gl", nativeName: "Galego", englishName: "Galician" },
    GL_ES: { code: "gl-ES", nativeName: "Galego", englishName: "Galician" },
    GN_PY: { code: "gn-PY", nativeName: "Avañe'ẽ", englishName: "Guarani" },
    GU_IN: { code: "gu-IN", nativeName: "ગુજરાતી", englishName: "Gujarati" },
    GX_GR: { code: "gx-GR", nativeName: "Ἑλληνική ἀρχαία", englishName: "Classical Greek" },
    HE: { code: "he", nativeName: "עברית", englishName: "Hebrew" },
    HE_IL: { code: "he-IL", nativeName: "עברית", englishName: "Hebrew" },
    HI: { code: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
    HI_IN: { code: "hi-IN", nativeName: "हिन्दी", englishName: "Hindi" },
    HR: { code: "hr", nativeName: "Hrvatski", englishName: "Croatian" },
    HR_HR: { code: "hr-HR", nativeName: "Hrvatski", englishName: "Croatian" },
    HSB: { code: "hsb", nativeName: "Hornjoserbšćina", englishName: "Upper Sorbian" },
    HT: { code: "ht", nativeName: "Kreyòl", englishName: "Haitian Creole" },
    HU: { code: "hu", nativeName: "Magyar", englishName: "Hungarian" },
    HU_HU: { code: "hu-HU", nativeName: "Magyar", englishName: "Hungarian" },
    HY_AM: { code: "hy-AM", nativeName: "Հայերեն", englishName: "Armenian" },
    ID: { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian" },
    ID_ID: { code: "id-ID", nativeName: "Bahasa Indonesia", englishName: "Indonesian" },
    IS: { code: "is", nativeName: "Íslenska", englishName: "Icelandic" },
    IS_IS: { code: "is-IS", nativeName: "Íslenska (Iceland)", englishName: "Icelandic (Iceland)" },
    IT: { code: "it", nativeName: "Italiano", englishName: "Italian" },
    IT_IT: { code: "it-IT", nativeName: "Italiano", englishName: "Italian" },
    JA: { code: "ja", nativeName: "日本語", englishName: "Japanese" },
    JA_JP: { code: "ja-JP", nativeName: "日本語", englishName: "Japanese" },
    JV_ID: { code: "jv-ID", nativeName: "Basa Jawa", englishName: "Javanese" },
    KA_GE: { code: "ka-GE", nativeName: "ქართული", englishName: "Georgian" },
    KK_KZ: { code: "kk-KZ", nativeName: "Қазақша", englishName: "Kazakh" },
    KM: { code: "km", nativeName: "ភាសាខ្មែរ", englishName: "Khmer" },
    KM_KH: { code: "km-KH", nativeName: "ភាសាខ្មែរ", englishName: "Khmer" },
    KAB: { code: "kab", nativeName: "Taqbaylit", englishName: "Kabyle" },
    KN: { code: "kn", nativeName: "ಕನ್ನಡ", englishName: "Kannada" },
    KN_IN: { code: "kn-IN", nativeName: "ಕನ್ನಡ (India)", englishName: "Kannada (India)" },
    KO: { code: "ko", nativeName: "한국어", englishName: "Korean" },
    KO_KR: { code: "ko-KR", nativeName: "한국어 (韩国)", englishName: "Korean (Korea)" },
    KU_TR: { code: "ku-TR", nativeName: "Kurdî", englishName: "Kurdish" },
    LA: { code: "la", nativeName: "Latin", englishName: "Latin" },
    LA_VA: { code: "la-VA", nativeName: "Latin", englishName: "Latin" },
    LB: { code: "lb", nativeName: "Lëtzebuergesch", englishName: "Luxembourgish" },
    LI_NL: { code: "li-NL", nativeName: "Lèmbörgs", englishName: "Limburgish" },
    LT: { code: "lt", nativeName: "Lietuvių", englishName: "Lithuanian" },
    LT_LT: { code: "lt-LT", nativeName: "Lietuvių", englishName: "Lithuanian" },
    LV: { code: "lv", nativeName: "Latviešu", englishName: "Latvian" },
    LV_LV: { code: "lv-LV", nativeName: "Latviešu", englishName: "Latvian" },
    MAI: { code: "mai", nativeName: "मैथिली, মৈথিলী", englishName: "Maithili" },
    MG_MG: { code: "mg-MG", nativeName: "Malagasy", englishName: "Malagasy" },
    MK: { code: "mk", nativeName: "Македонски", englishName: "Macedonian" },
    MK_MK: { code: "mk-MK", nativeName: "Македонски (Македонски)", englishName: "Macedonian (Macedonian)" },
    ML: { code: "ml", nativeName: "മലയാളം", englishName: "Malayalam" },
    ML_IN: { code: "ml-IN", nativeName: "മലയാളം", englishName: "Malayalam" },
    MN_MN: { code: "mn-MN", nativeName: "Монгол", englishName: "Mongolian" },
    MR: { code: "mr", nativeName: "मराठी", englishName: "Marathi" },
    MR_IN: { code: "mr-IN", nativeName: "मराठी", englishName: "Marathi" },
    MS: { code: "ms", nativeName: "Bahasa Melayu", englishName: "Malay" },
    MS_MY: { code: "ms-MY", nativeName: "Bahasa Melayu", englishName: "Malay" },
    MT: { code: "mt", nativeName: "Malti", englishName: "Maltese" },
    MT_MT: { code: "mt-MT", nativeName: "Malti", englishName: "Maltese" },
    MY: { code: "my", nativeName: "ဗမာစကာ", englishName: "Burmese" },
    NO: { code: "no", nativeName: "Norsk", englishName: "Norwegian" },
    NB: { code: "nb", nativeName: "Norsk (bokmål)", englishName: "Norwegian (bokmal)" },
    NB_NO: { code: "nb-NO", nativeName: "Norsk (bokmål)", englishName: "Norwegian (bokmal)" },
    NE: { code: "ne", nativeName: "नेपाली", englishName: "Nepali" },
    NE_NP: { code: "ne-NP", nativeName: "नेपाली", englishName: "Nepali" },
    NL: { code: "nl", nativeName: "Nederlands", englishName: "Dutch" },
    NL_BE: { code: "nl-BE", nativeName: "Nederlands (België)", englishName: "Dutch (Belgium)" },
    NL_NL: { code: "nl-NL", nativeName: "Nederlands (Nederland)", englishName: "Dutch (Netherlands)" },
    NN_NO: { code: "nn-NO", nativeName: "Norsk (nynorsk)", englishName: "Norwegian (nynorsk)" },
    OC: { code: "oc", nativeName: "Occitan", englishName: "Occitan" },
    OR_IN: { code: "or-IN", nativeName: "ଓଡ଼ିଆ", englishName: "Oriya" },
    PA: { code: "pa", nativeName: "ਪੰਜਾਬੀ", englishName: "Punjabi" },
    PA_IN: { code: "pa-IN", nativeName: "ਪੰਜਾਬੀ (ਭਾਰਤ ਨੂੰ)", englishName: "Punjabi (India)" },
    PL: { code: "pl", nativeName: "Polski", englishName: "Polish" },
    PL_PL: { code: "pl-PL", nativeName: "Polski", englishName: "Polish" },
    PS_AF: { code: "ps-AF", nativeName: "پښتو", englishName: "Pashto" },
    PT: { code: "pt", nativeName: "Português", englishName: "Portuguese" },
    PT_BR: { code: "pt-BR", nativeName: "Português (Brasil)", englishName: "Portuguese (Brazil)" },
    PT_PT: { code: "pt-PT", nativeName: "Português (Portugal)", englishName: "Portuguese (Portugal)" },
    QU_PE: { code: "qu-PE", nativeName: "Qhichwa", englishName: "Quechua" },
    RM_CH: { code: "rm-CH", nativeName: "Rumantsch", englishName: "Romansh" },
    RO: { code: "ro", nativeName: "Română", englishName: "Romanian" },
    RO_RO: { code: "ro-RO", nativeName: "Română", englishName: "Romanian" },
    RU: { code: "ru", nativeName: "Русский", englishName: "Russian" },
    RU_RU: { code: "ru-RU", nativeName: "Русский", englishName: "Russian" },
    SA_IN: { code: "sa-IN", nativeName: "संस्कृतम्", englishName: "Sanskrit" },
    SE_NO: { code: "se-NO", nativeName: "Davvisámegiella", englishName: "Northern Sámi" },
    SI_LK: { code: "si-LK", nativeName: "පළාත", englishName: "Sinhala (Sri Lanka)" },
    SK: { code: "sk", nativeName: "Slovenčina", englishName: "Slovak" },
    SK_SK: { code: "sk-SK", nativeName: "Slovenčina (Slovakia)", englishName: "Slovak (Slovakia)" },
    SL: { code: "sl", nativeName: "Slovenščina", englishName: "Slovenian" },
    SL_SI: { code: "sl-SI", nativeName: "Slovenščina", englishName: "Slovenian" },
    SO_SO: { code: "so-SO", nativeName: "Soomaaliga", englishName: "Somali" },
    SQ: { code: "sq", nativeName: "Shqip", englishName: "Albanian" },
    SQ_AL: { code: "sq-AL", nativeName: "Shqip", englishName: "Albanian" },
    SR: { code: "sr", nativeName: "Српски", englishName: "Serbian" },
    SR_RS: { code: "sr-RS", nativeName: "Српски (Serbia)", englishName: "Serbian (Serbia)" },
    SU: { code: "su", nativeName: "Basa Sunda", englishName: "Sundanese" },
    SV: { code: "sv", nativeName: "Svenska", englishName: "Swedish" },
    SV_SE: { code: "sv-SE", nativeName: "Svenska", englishName: "Swedish" },
    SW: { code: "sw", nativeName: "Kiswahili", englishName: "Swahili" },
    SW_KE: { code: "sw-KE", nativeName: "Kiswahili", englishName: "Swahili (Kenya)" },
    TA: { code: "ta", nativeName: "தமிழ்", englishName: "Tamil" },
    TA_IN: { code: "ta-IN", nativeName: "தமிழ்", englishName: "Tamil" },
    TE: { code: "te", nativeName: "తెలుగు", englishName: "Telugu" },
    TE_IN: { code: "te-IN", nativeName: "తెలుగు", englishName: "Telugu" },
    TG: { code: "tg", nativeName: "забо́ни тоҷикӣ́", englishName: "Tajik" },
    TG_TJ: { code: "tg-TJ", nativeName: "тоҷикӣ", englishName: "Tajik" },
    TH: { code: "th", nativeName: "ภาษาไทย", englishName: "Thai" },
    TH_TH: { code: "th-TH", nativeName: "ภาษาไทย (ประเทศไทย)", englishName: "Thai (Thailand)" },
    TL: { code: "tl", nativeName: "Filipino", englishName: "Filipino" },
    TL_PH: { code: "tl-PH", nativeName: "Filipino", englishName: "Filipino" },
    TLH: { code: "tlh", nativeName: "tlhIngan-Hol", englishName: "Klingon" },
    TR: { code: "tr", nativeName: "Türkçe", englishName: "Turkish" },
    TR_TR: { code: "tr-TR", nativeName: "Türkçe", englishName: "Turkish" },
    TT_RU: { code: "tt-RU", nativeName: "татарча", englishName: "Tatar" },
    UK: { code: "uk", nativeName: "Українська", englishName: "Ukrainian" },
    UK_UA: { code: "uk-UA", nativeName: "Українська", englishName: "Ukrainian" },
    UR: { code: "ur", nativeName: "اردو", englishName: "Urdu" },
    UR_PK: { code: "ur-PK", nativeName: "اردو", englishName: "Urdu" },
    UZ: { code: "uz", nativeName: "O'zbek", englishName: "Uzbek" },
    UZ_UZ: { code: "uz-UZ", nativeName: "O'zbek", englishName: "Uzbek" },
    VI: { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
    VI_VN: { code: "vi-VN", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
    XH_ZA: { code: "xh-ZA", nativeName: "isiXhosa", englishName: "Xhosa" },
    YI: { code: "yi", nativeName: "ייִדיש", englishName: "Yiddish" },
    YI_DE: { code: "yi-DE", nativeName: "ייִדיש (German)", englishName: "Yiddish (German)" },
    ZH: { code: "zh", nativeName: "中文", englishName: "Chinese" },
    ZH_HANS: { code: "zh-Hans", nativeName: "中文简体", englishName: "Chinese Simplified" },
    ZH_HANT: { code: "zh-Hant", nativeName: "中文繁體", englishName: "Chinese Traditional" },
    ZH_CN: { code: "zh-CN", nativeName: "中文（中国）", englishName: "Chinese Simplified (China)" },
    ZH_HK: { code: "zh-HK", nativeName: "中文（香港）", englishName: "Chinese Traditional (Hong Kong)" },
    ZH_SG: { code: "zh-SG", nativeName: "中文（新加坡）", englishName: "Chinese Simplified (Singapore)" },
    ZH_TW: { code: "zh-TW", nativeName: "中文（台灣）", englishName: "Chinese Traditional (Taiwan)" },
    ZU_ZA: { code: "zu-ZA", nativeName: "isiZulu", englishName: "Zulu" }
} as const;

export type LANG_KEY = keyof typeof LANG;
export type LANG_VALUE = typeof LANG[LANG_KEY];
export type LANG_CODE = LANG_VALUE['code'];

const langCodeMap = Object.create(null) as Record<LANG_CODE, LANG_VALUE>;
for (const key in LANG) {
    const lang = LANG[key as LANG_KEY];
    langCodeMap[lang.code] = lang;
}

export function getByCode(langCode: LANG_CODE): Language {
    return langCodeMap[langCode];
}

export function normalizeLanguageTag(value: string): string {
    return value.replaceAll('_', '-').toLowerCase();
}

export function getPrimaryLanguageTag(value: string): string {
    return normalizeLanguageTag(value).split('-')[0];
}

export function isLikeLanguage(a: string, b: string) {
    return normalizeLanguageTag(a) === normalizeLanguageTag(b);
}

export function isSimilarLanguage(a: string, b: string) {
    return getPrimaryLanguageTag(a) === getPrimaryLanguageTag(b);
}

function setLangFallback(lang: Language, fallback: Language[]) {
    lang.fallbacks = fallback;
}

setLangFallback(LANG.ZH_SG, [LANG.ZH_CN, LANG.ZH_HANS, LANG.ZH]);
setLangFallback(LANG.ZH_HANS, [LANG.ZH_CN, LANG.ZH]);
setLangFallback(LANG.ZH_CN, [LANG.ZH_HANS, LANG.ZH]);
setLangFallback(LANG.ZH_HANT, [LANG.ZH]);
setLangFallback(LANG.ZH_HK, [LANG.ZH]);
setLangFallback(LANG.ZH_TW, [LANG.ZH]);
