(function (A) {
  "use strict";
  A.FORMAT_VERSION = 1;
  A.STORAGE_KEY = "anki-template-studio:config:v1";
  A.id = function () {
    return globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  };
  A.defaultConfig = function () {
    return { version: A.FORMAT_VERSION, id: A.id(), fields: [
      { id: A.id(), name: "English", language: "en", front: true, back: true, supplementary: false },
      { id: A.id(), name: "Spanish", language: "es", front: false, back: true, supplementary: false }
    ] };
  };
  // These constraints prevent injecting Anki directives, filters, or special fields.
  // HTML punctuation and quotes are safe: names are used raw only in Anki tokens.
  A.nameError = function (name) {
    if (!name.trim()) return "Enter an Anki field name.";
    if (name !== name.trim()) return "Remove spaces at the beginning or end of the field name.";
    if (/[{}:\r\n\u0000-\u001f\u007f]/.test(name) || /^[#^/!>=%&]/.test(name)) return "Field names cannot contain braces, colons, control characters, or begin with Anki directive symbols.";
    if (/<\s*\/?script\b/i.test(name)) return "Field names cannot contain script tags.";
    if (/^(FrontSide|Tags|Type|Deck|Subdeck|Card|CardFlag|Card\d+|c\d+)$/i.test(name)) return "This name is reserved by Anki; choose a regular note field name.";
    if (name.length > 200) return "Keep field names within 200 characters.";
    return "";
  };
  A.validate = function (config) {
    const errors = [], names = new Set();
    config.fields.forEach(function (field, index) {
      const label = "Field " + (index + 1) + ": ";
      const problem = A.nameError(field.name);
      if (problem) errors.push(label + problem);
      const key = field.name.trim().toLowerCase();
      if (key && names.has(key)) errors.push(label + "Duplicate name “" + field.name + "”. Each Anki field needs a unique name.");
      names.add(key);
      if (!field.supplementary && !Object.hasOwn(A.languages, field.language)) errors.push(label + "Choose a language, or mark the field as supplementary.");
    });
    if (!config.fields.some(f => f.front)) errors.push("Select at least one field for the front side.");
    if (!config.fields.some(f => f.back)) errors.push("Select at least one field for the back side.");
    return errors;
  };
  // Structural validation allows autosaved incomplete edits; Generate validates semantics.
  A.parseConfig = function (input) {
    const c = typeof input === "string" ? JSON.parse(input) : input;
    const safeId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
    if (!c || c.version !== A.FORMAT_VERSION) throw new Error("Unsupported configuration format. Expected version 1.");
    if (!safeId(c.id) || !Array.isArray(c.fields) || c.fields.length > 200) throw new Error("Invalid configuration identity or field list (maximum 200 fields).");
    const ids = new Set();
    const fields = c.fields.map(function (f) {
      if (!f || !safeId(f.id) || ids.has(f.id) || typeof f.name !== "string" || f.name.length > 200 || typeof f.language !== "string" || (f.language !== "" && !Object.hasOwn(A.languages, f.language)) || ["front", "back", "supplementary"].some(k => typeof f[k] !== "boolean")) throw new Error("Invalid field data, duplicate field identity, or unsupported language.");
      ids.add(f.id);
      return { id: f.id, name: f.name, language: f.language, front: f.front, back: f.back, supplementary: f.supplementary };
    });
    return { version: A.FORMAT_VERSION, id: c.id, fields: fields };
  };
  A.moveField = function (config, id, offset) {
    const from = config.fields.findIndex(f => f.id === id);
    const to = Math.max(0, Math.min(config.fields.length - 1, from + offset));
    if (from < 0 || from === to) return false;
    config.fields.splice(to, 0, config.fields.splice(from, 1)[0]);
    return true;
  };
})(globalThis.AnkiMaker = globalThis.AnkiMaker || {});
