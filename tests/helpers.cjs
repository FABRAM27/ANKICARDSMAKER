const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = ['languages', 'config', 'voice', 'card-runtime', 'card-style', 'templates'];
function library() {
  const context = vm.createContext({ console, crypto: require('node:crypto').webcrypto });
  for (const name of files) vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), context);
  return context.AnkiMaker;
}
// Only Anki's ordinary conditional/value/TTS substitution is simulated here.
// Real Anki's field parsing and native audio renderer need platform testing.
function renderAnki(source, values, native = false) {
  return source.replace(/{{#([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, name, body) => values[name] ? body : '')
    .replace(/{{tts ([^:}]+):([^}]+)}}/g, (_, locale, name) => native && values[name] ? `<button class="replay-button" onclick="window.__native=(window.__native||0)+1" data-locale="${locale}">Native audio</button>` : '')
    .replace(/{{([^}]+)}}/g, (_, name) => values[name] || '');
}
module.exports = { root, library, renderAnki };
