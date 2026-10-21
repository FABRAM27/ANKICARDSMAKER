(function (A) {
  "use strict";
  A.escapeHTML = function (value) { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); };
  function fieldHTML(field) {
    const name = field.name, label = A.escapeHTML(name);
    let markup;
    if (field.supplementary) {
      markup = `<div class="am-field am-supplementary" data-field-id="${field.id}"><div class="am-content">{{${name}}}</div></div>`;
    } else {
      const profile = A.languages[field.language];
      markup = `<div class="am-field am-language" data-field-id="${field.id}" data-language="${field.language}">
  <button type="button" class="am-play" aria-label="Play ${label}" aria-pressed="false"></button>
  <span class="am-flag" aria-hidden="true">${profile.flag}</span>
  <div class="am-content" lang="${profile.locales[0]}">{{${name}}}</div>
  <div class="am-native" aria-hidden="true">{{tts ${profile.anki}:${name}}}</div>
</div>`;
    }
    return `{{#${name}}}\n${markup}\n{{/${name}}}`;
  }
  function side(config, sideName) {
    const fields = config.fields.filter(f => f[sideName]);
    const profiles = {};
    fields.filter(f => !f.supplementary).forEach(f => { profiles[f.language] = A.languages[f.language]; });
    const switches = [];
    if (Object.keys(profiles).length) {
      switches.push('<label class="am-switch"><span>Show flags</span><input type="checkbox" role="switch" data-preference="flags" checked></label>');
      switches.push('<label class="am-switch"><span>Show language text</span><input type="checkbox" role="switch" data-preference="text" checked></label>');
    }
    if (fields.some(f => f.supplementary)) switches.push('<label class="am-switch"><span>Show supplementary information</span><input type="checkbox" role="switch" data-preference="supplementary"></label>');
    const script = `(${A.cardRuntime.toString()})(${JSON.stringify(profiles)}, (${A.createVoiceTools.toString()})());`.replace(/<\//g, "<\\/");
    return `<section class="am-card show-flags show-text" data-config="${config.id}" data-side="${sideName}" aria-label="${sideName === "front" ? "Question" : "Answer"}">
  <div class="am-fields">
${fields.map(fieldHTML).join("\n\n")}
  </div>
  <div class="am-footer">
    <div class="am-switches" aria-label="Card display preferences">${switches.join("\n")}</div>
    <p class="am-speech-status" role="status" aria-live="polite" aria-atomic="true"></p>
  </div>
</section>
<script>
${script}
</script>`;
  }
  A.generate = function (input) {
    const config = A.parseConfig(input);
    const errors = A.validate(config);
    if (errors.length) throw new Error(errors.join("\n"));
    return { front: side(config, "front"), back: side(config, "back"), style: A.cardStyle, checklist: config.fields.filter(f => f.front || f.back).map(f => f.name) };
  };
})(globalThis.AnkiMaker = globalThis.AnkiMaker || {});
