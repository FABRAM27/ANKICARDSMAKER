const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { library, renderAnki } = require('./helpers.cjs');
const A = library();
const plain = value => JSON.parse(JSON.stringify(value));
function field(name, language = 'en', extra = {}) { return { id: A.id(), name, language, front: true, back: true, supplementary: false, ...extra }; }
function config(fields) { return { version: 1, id: A.id(), fields }; }
const voice = (name, lang, localService = true, extra = {}) => ({ name, lang, localService, voiceURI: name, ...extra });

test('fresh and reset presets contain exactly English on front, English and Spanish on back', () => {
  for (let i = 0; i < 2; i++) {
    const c = A.defaultConfig(), o = A.generate(c);
    assert.deepEqual(plain(c.fields.map(({ name, front, back, supplementary }) => ({ name, front, back, supplementary }))), [
      { name: 'English', front: true, back: true, supplementary: false }, { name: 'Spanish', front: false, back: true, supplementary: false }
    ]);
    assert.match(o.front, /{{#English}}/); assert.doesNotMatch(o.front, /Spanish|es_MX/);
    assert.match(o.back, /{{#English}}/); assert.match(o.back, /{{#Spanish}}/);
  }
});
test('eleven complete profiles generate their correct locale, flag and exact placeholders', () => {
  assert.equal(Object.keys(A.languages).length, 11);
  for (const [key, profile] of Object.entries(A.languages)) {
    const name = profile.name + ' Example', o = A.generate(config([field(name, key)]));
    assert.ok(profile.flag); assert.ok(profile.names[profile.locales[0]]);
    assert.equal(profile.anki, profile.locales[0].replace('-', '_'));
    assert.ok(o.front.includes('{{tts ' + profile.anki + ':' + name + '}}'));
    assert.ok(o.front.includes('{{#' + name + '}}')); assert.ok(o.front.includes('{{/' + name + '}}'));
    assert.ok(o.front.includes(profile.flag));
  }
});
test('moves retain complete field metadata and identities; boundaries are stable', () => {
  const c = config([field('Word', 'de'), field('Example', 'de', { front: false }), field('Hint', '', { supplementary: true })]);
  const snapshot = plain(c.fields), id = c.fields[2].id;
  assert.equal(A.moveField(c, id, -2), true);
  assert.deepEqual(plain(c.fields), [snapshot[2], snapshot[0], snapshot[1]]);
  assert.equal(A.moveField(c, id, -1), false);
  c.fields[1].name = 'German Word';
  assert.equal(c.fields[1].id, snapshot[0].id); assert.equal(c.fields[1].language, 'de');
});
test('both sides follow the shared order after independent filtering and allow repeated languages', () => {
  const c = config([field('Word', 'de'), field('Unused', 'ru', { front: false, back: false }), field('Hint', '', { supplementary: true }), field('Example', 'de', { front: false })]);
  const o = A.generate(c);
  assert.ok(o.front.indexOf('{{#Word}}') < o.front.indexOf('{{#Hint}}'));
  assert.doesNotMatch(o.front, /{{#Example}}|{{#Unused}}/);
  assert.ok(o.back.indexOf('{{#Hint}}') < o.back.indexOf('{{#Example}}'));
  assert.equal((o.back.match(/{{tts de_DE:/g) || []).length, 2);
  assert.deepEqual(plain(o.checklist), ['Word', 'Hint', 'Example']);
});
test('supplementary fields omit speech/flags and have one visibility switch', () => {
  const o = A.generate(config([field('Hint', '', { supplementary: true }), field('Notes', '', { supplementary: true })]));
  assert.doesNotMatch(o.front, /class="am-play"|class="am-flag"|{{tts /);
  assert.equal((o.front.match(/data-preference="supplementary"/g) || []).length, 1);
  assert.equal((o.front.match(/class="am-field am-supplementary"/g) || []).length, 2);
  assert.doesNotMatch(o.front, /show-supplementary"/);
});
test('all inclusion combinations, no supplementary fields, and empty note values', () => {
  const c = config([field('FrontOnly', 'en', { back: false }), field('BackOnly', 'es', { front: false }), field('Both'), field('Excluded', 'fr', { front: false, back: false })]);
  const o = A.generate(c);
  assert.doesNotMatch(o.front, /{{BackOnly}}|{{Excluded}}/); assert.doesNotMatch(o.back, /{{FrontOnly}}|{{Excluded}}/);
  assert.ok(o.front.includes('{{Both}}') && o.back.includes('{{Both}}'));
  assert.doesNotMatch(o.front, /data-preference="supplementary"/);
  const empty = renderAnki(o.front, {});
  assert.doesNotMatch(empty, /class="am-field |class="am-flag"|class="am-play"/);
  assert.ok(renderAnki(o.front, { Both: '<b>formatted</b>' }).includes('<b>formatted</b>'));
});
test('semantic validation catches names, duplicate names, languages and empty sides', () => {
  for (const name of ['', ' ', ' English', 'English ', '{{Name}}', 'tts:Name', '#Name', 'FrontSide', 'Card1', 'c1', '</script>']) assert.ok(A.validate(config([field(name)])).length, name);
  assert.ok(A.validate(config([field('One'), field('one')])).some(e => /Duplicate/.test(e)));
  assert.ok(A.validate(config([field('Name', '')])).some(e => /Choose a language/.test(e)));
  assert.ok(A.validate(config([])).some(e => /front/.test(e)));
  assert.ok(A.validate(config([])).some(e => /back/.test(e)));
  assert.equal(A.validate(config([field('Hint', '', { supplementary: true })])).length, 0);
});
test('HTML punctuation in names is escaped in attributes and exact inside Anki tokens', () => {
  const name = 'Word "quoted" & <example> \'note\'';
  const o = A.generate(config([field(name)]));
  assert.ok(o.front.includes('{{#' + name + '}}'));
  assert.ok(o.front.includes('{{tts en_US:' + name + '}}'));
  assert.ok(o.front.includes('aria-label="Play Word &quot;quoted&quot; &amp; &lt;example&gt; &#39;note&#39;"'));
});
test('configuration roundtrip retains identities, roles, order and even incomplete drafts', () => {
  const c = config([field('Hint', '', { supplementary: true }), field('', '', { front: false })]);
  assert.deepEqual(plain(A.parseConfig(JSON.stringify(c))), plain(c));
  const o = A.generate(A.defaultConfig()); assert.ok(o.style.includes('.am-supplementary'));
});
test('untrusted imports reject unknown formats, languages, duplicate IDs and wrong types', () => {
  const valid = plain(A.defaultConfig());
  for (const mutate of [c => c.version = 2, c => c.id = '"><script>', c => c.fields[0].language = 'xx', c => c.fields[0].front = 'true', c => c.fields[1].id = c.fields[0].id, c => c.fields = {}, c => c.fields[0].language = '__proto__']) {
    const c = structuredClone(valid); mutate(c); assert.throws(() => A.parseConfig(c));
  }
  assert.throws(() => A.parseConfig('{'));
});
test('exported scripts compile independently and regeneration preserves configuration identity', () => {
  const c = A.defaultConfig();
  assert.equal(A.generate(c).front, A.generate(c).front);
  for (const key of ['front', 'back']) {
    const source = A.generate(c)[key];
    new vm.Script(source.match(/<script>\n([\s\S]*)\n<\/script>/)[1]);
    assert.ok(source.includes('data-config="' + c.id + '"'));
  }
  assert.notEqual(A.defaultConfig().id, c.id);
});
for (const key of ['en', 'es', 'pt']) test(key + ': natural fallback outranks generic primary, with all four tiers ordered', () => {
  const p = A.languages[key], [primary, fallback] = p.locales;
  const v = [voice('Generic fallback', fallback), voice('Generic primary', primary), voice('Fallback Neural', fallback, false), voice('Primary Natural', primary, false)];
  assert.deepEqual(plain(A.createVoiceTools().rank(v, p).map(x => x.name)), ['Primary Natural', 'Fallback Neural', 'Generic primary', 'Generic fallback']);
});
test('system voice precedes online within tier; names only break ties; online does not prove quality', () => {
  const p = A.languages.en;
  const v = [voice('Microsoft Jenny Online', 'en-US', false), voice('Generic system', 'en-US'), voice('British Neural', 'en-GB', false), voice('US Neural remote', 'en-US', false), voice('US Natural system', 'en-US')];
  assert.deepEqual(plain(A.createVoiceTools().rank(v, p).map(x => x.name)), ['US Natural system', 'US Neural remote', 'British Neural', 'Generic system', 'Microsoft Jenny Online']);
  assert.equal(A.createVoiceTools().quality(v[0]), 1);
});
test('remaining languages prefer matching natural voices and exclude other regions', () => {
  for (const [key, p] of Object.entries(A.languages).filter(([k]) => !['en', 'es', 'pt'].includes(k))) {
    const ranked = A.createVoiceTools().rank([voice('Generic', p.locales[0]), voice('Remote Neural', p.locales[0], false), voice('Wrong Neural', 'en-AU')], p);
    assert.equal(ranked[0].name, 'Remote Neural', key); assert.equal(ranked.length, 2);
  }
  assert.equal(A.createVoiceTools().rank([voice('Norwegian', 'no_NO')], A.languages.nb).length, 1);
  assert.equal(A.createVoiceTools().rank([], A.languages.en).length, 0);
});
