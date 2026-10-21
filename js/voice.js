(function (A) {
  "use strict";
  // Self-contained so the same implementation can be embedded in exported cards.
  A.createVoiceTools = function () {
    function normalise(locale) { return String(locale || "").replace(/_/g, "-").toLowerCase(); }
    function quality(voice) {
      // Remote/online alone says nothing about quality. Explicit engine metadata
      // or natural/neural names are the only quality evidence used here.
      return /\b(natural|neural)\b/i.test(String(voice.name) + " " + String(voice.voiceURI)) || /^(natural|neural)$/i.test(voice.quality || "") ? 0 : 1;
    }
    function rank(voices, profile) {
      return Array.from(voices || []).map(function (voice, index) {
        let locale = normalise(voice.lang);
        if (profile.aliases && profile.aliases[locale]) locale = profile.aliases[locale];
        const region = profile.locales.findIndex(l => normalise(l) === locale);
        if (region < 0) return null;
        const names = profile.names[profile.locales[region]] || [];
        const preferred = names.findIndex(n => String(voice.name).toLowerCase().includes(n));
        return { voice: voice, order: [quality(voice), region, voice.localService === true ? 0 : 1, preferred < 0 ? 999 : preferred, voice.default ? 0 : 1, index] };
      }).filter(Boolean).sort(function (a, b) {
        for (let i = 0; i < a.order.length; i++) if (a.order[i] !== b.order[i]) return a.order[i] - b.order[i];
        return 0;
      }).map(item => item.voice);
    }
    return { rank: rank, quality: quality };
  };
})(globalThis.AnkiMaker = globalThis.AnkiMaker || {});
