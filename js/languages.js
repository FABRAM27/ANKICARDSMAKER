(function (A) {
  "use strict";
  // Inline vector flags stay available offline, including on Windows systems
  // whose emoji font renders regional-indicator letters instead of flag images.
  const svg = body => '<svg viewBox="0 0 60 60" aria-hidden="true" focusable="false">' + body + '</svg>';
  const stripes = colors => colors.map((c, i) => `<rect y="${i * 20}" width="60" height="20" fill="${c}"/>`).join("");
  const vertical = colors => colors.map((c, i) => `<rect x="${i * 20}" width="20" height="60" fill="${c}"/>`).join("");
  const flags = {
    en: svg('<rect width="60" height="60" fill="#fff"/><path d="M0 4h60M0 14h60M0 24h60M0 34h60M0 44h60M0 54h60" stroke="#b22234" stroke-width="5"/><path d="M0 0h32v32H0z" fill="#3c3b6e"/><path d="M6 7h2m6 0h2m6 0h2M6 15h2m6 0h2m6 0h2M6 23h2m6 0h2m6 0h2" stroke="#fff" stroke-width="3"/>'),
    es: svg(vertical(['#006847', '#fff', '#ce1126']) + '<path d="M26 36q4 6 8 0M27 27l7 6-6 2z" fill="#876332" stroke="#536d32" stroke-width="2"/>'),
    pt: svg('<rect width="60" height="60" fill="#009b3a"/><path d="M4 30L30 10l26 20-26 20z" fill="#ffdf00"/><circle cx="30" cy="30" r="12" fill="#002776"/><path d="M19 26q12-2 22 9" fill="none" stroke="#fff" stroke-width="3"/>'),
    fr: svg(vertical(['#002395', '#fff', '#ed2939'])),
    it: svg(vertical(['#009246', '#fff', '#ce2b37'])),
    de: svg(stripes(['#151515', '#d00', '#ffce00'])),
    nb: svg('<rect width="60" height="60" fill="#ba0c2f"/><path d="M22 0v60M0 30h60" stroke="#fff" stroke-width="15"/><path d="M22 0v60M0 30h60" stroke="#00205b" stroke-width="8"/>'),
    ru: svg(stripes(['#fff', '#0039a6', '#d52b1e'])),
    zh: svg('<rect width="60" height="60" fill="#de2910"/><path d="m17 10 2.4 7.2H27l-6.2 4.5 2.4 7.3-6.2-4.5-6.2 4.5 2.4-7.3L7 17.2h7.6z" fill="#ffde00"/><g fill="#ffde00"><circle cx="31" cy="10" r="2"/><circle cx="38" cy="17" r="2"/><circle cx="38" cy="26" r="2"/><circle cx="31" cy="33" r="2"/></g>'),
    ja: svg('<rect width="60" height="60" fill="#fff"/><circle cx="30" cy="30" r="16" fill="#bc002d"/>'),
    ko: svg('<rect width="60" height="60" fill="#fff"/><circle cx="30" cy="30" r="13" fill="#cd2e3a"/><path d="M17 30a13 13 0 0 0 26 0c0-7-13-7-13 0s-13 7-13 0" fill="#0047a0"/><g stroke="#111" stroke-width="2.5"><path d="m8 16 9-8m-7 11 9-8m-7 11 9-8M39 48l9-8m-6 11 9-8m-6 11 9-8M8 43l9 8m-7-11 9 8m-7-11 9 8M39 11l9 8m-6-11 9 8m-6-11 9 8"/></g>')
  };
  // The only language registry. Locale order is also the regional priority.
  // Known names break ties; they do not prove natural/neural quality.
  A.languages = Object.freeze({
    en: { name: "English", locales: ["en-US", "en-GB"], anki: "en_US", flag: flags.en, names: { "en-US": ["jenny", "aria", "guy"], "en-GB": ["sonia", "ryan", "libby"] } },
    es: { name: "Spanish", locales: ["es-MX", "es-ES"], anki: "es_MX", flag: flags.es, names: { "es-MX": ["dalia", "jorge"], "es-ES": ["elvira", "alvaro", "abril", "ximena"] } },
    pt: { name: "Portuguese", locales: ["pt-BR", "pt-PT"], anki: "pt_BR", flag: flags.pt, names: { "pt-BR": ["francisca", "antonio"], "pt-PT": ["raquel", "duarte"] } },
    fr: { name: "French", locales: ["fr-FR"], anki: "fr_FR", flag: flags.fr, names: { "fr-FR": ["denise", "henri"] } },
    it: { name: "Italian", locales: ["it-IT"], anki: "it_IT", flag: flags.it, names: { "it-IT": ["elsa", "diego"] } },
    de: { name: "German", locales: ["de-DE"], anki: "de_DE", flag: flags.de, names: { "de-DE": ["katja", "conrad", "amala"] } },
    nb: { name: "Norwegian", locales: ["nb-NO"], anki: "nb_NO", flag: flags.nb, aliases: { "no-no": "nb-no", no: "nb-no", nb: "nb-no" }, names: { "nb-NO": ["pernille", "finn", "iselin"] } },
    ru: { name: "Russian", locales: ["ru-RU"], anki: "ru_RU", flag: flags.ru, names: { "ru-RU": ["svetlana", "dmitry"] } },
    zh: { name: "Chinese", locales: ["zh-CN"], anki: "zh_CN", flag: flags.zh, names: { "zh-CN": ["xiaoxiao", "yunxi"] } },
    ja: { name: "Japanese", locales: ["ja-JP"], anki: "ja_JP", flag: flags.ja, names: { "ja-JP": ["nanami", "keita"] } },
    ko: { name: "Korean", locales: ["ko-KR"], anki: "ko_KR", flag: flags.ko, names: { "ko-KR": ["sunhi", "injoon"] } }
  });
})(globalThis.AnkiMaker = globalThis.AnkiMaker || {});
