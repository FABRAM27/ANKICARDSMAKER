const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { root, library, renderAnki } = require('./helpers.cjs');
const A = library();
let appURL, server;
const artifactDir = path.join(root, 'test-artifacts');
const cfield = (name, language, extra = {}) => ({ id: A.id(), name, language, front: true, back: true, supplementary: false, ...extra });
const cconfig = fields => ({ version: 1, id: A.id(), fields });
let passed = 0, browser, context, page;
async function check(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
async function saved() { return page.evaluate(() => JSON.parse(localStorage.getItem(AnkiMaker.STORAGE_KEY))); }
async function cardPage(source, values, options = {}) {
  const p = await context.newPage();
  await p.goto(appURL);
  await p.evaluate(({ html, css, options }) => {
    if (options.noStorage) Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new Error('blocked'); } });
    window.__attempts = [];
    let exposed = options.voices || [], listener;
    function utterance(text) { this.text = text; }
    const synth = {
      getVoices() { if (options.throwVoices) throw new Error('Voice enumeration failed'); return exposed; },
      addEventListener(name, fn) { listener = fn; }, removeEventListener() { listener = null; },
      cancel() {},
      speak(u) {
        window.__attempts.push(u.voice.name);
        if (options.throwSpeech) throw new Error('Device refused');
        if (options.hang) return;
        if (options.fail || u.voice.name.includes('Fail')) {
          setTimeout(() => { u.onerror({ error: 'network' }); u.onerror({ error: 'network' }); }, 5);
        } else {
          u.onstart();
          setTimeout(() => u.onend(), 20);
        }
      }
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: options.unsupported ? undefined : synth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: options.unsupported ? undefined : utterance });
    window.__setVoices = function (v) { exposed = v; if (listener) listener(); };
    // Test a standalone export: remove generator styles, scripts and namespace.
    document.head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style>';
    delete window.AnkiMaker;
    document.body.className = 'card';
    const range = document.createRange();
    document.body.replaceChildren(range.createContextualFragment(html));
  }, { html: renderAnki(source, values, options.native), css: A.cardStyle, options });
  return p;
}

(async () => {
  fs.mkdirSync(artifactDir, { recursive: true });
  server = http.createServer((request, response) => {
    const filename = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
    fs.readFile(filename, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'text/plain' }).end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  appURL = `http://127.0.0.1:${server.address().port}/index.html`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  page = await context.newPage();
  const errors = [];
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(appURL);
  await check('offline loaded app, exact default, generated outputs, complete source popup and focus restoration', async () => {
    await context.setOffline(true);
    assert.equal(await page.locator('.field-row').count(), 2);
    const c = await saved(); assert.equal(c.fields[0].name, 'English'); assert.equal(c.fields[1].name, 'Spanish');
    await page.locator('#generate').click();
    assert.deepEqual(await page.locator('#checklist li').allTextContents(), ['English', 'Spanish']);
    for (const key of ['front', 'back', 'style']) {
      const button = page.locator(`[data-output="${key}"] [data-action="see"]`);
      await button.click();
      assert.equal(await page.locator('#source-code').inputValue(), A.generate(c)[key]);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#source-code').evaluate(e => e === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#source-dialog').evaluate(e => e.contains(document.activeElement)), true);
      await page.keyboard.press('Escape');
      assert.equal(await button.evaluate(e => e === document.activeElement), true);
    }
    await page.screenshot({ path: path.join(artifactDir, 'desktop.png'), fullPage: true });
    await context.setOffline(false);
  });
  await check('copy each current output; denied clipboard exposes selectable complete code', async () => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('[data-output="front"] [data-action="copy"]').click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), A.generate(await saved()).front);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copied = text; } } }));
    const c = await saved();
    for (const key of ['front', 'back', 'style']) {
      await page.locator(`[data-output="${key}"] [data-action="copy"]`).click();
      assert.equal(await page.evaluate(() => window.__copied), A.generate(c)[key]);
    }
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } }));
    await page.locator('[data-output="back"] [data-action="copy"]').click();
    assert.equal(await page.locator('#source-dialog').evaluate(e => e.open), true);
    assert.equal(await page.locator('#source-code').inputValue(), A.generate(c).back);
    assert.equal(await page.locator('#source-code').evaluate(e => e.selectionEnd - e.selectionStart), A.generate(c).back.length);
    await page.keyboard.press('Escape');
  });
  await check('add/rename/roles/keyboard reorder/remove preserve settings, invalidate outputs and autosave on reopen', async () => {
    const initial = await saved();
    await page.locator('#add-field').click();
    assert.equal(await page.locator('.output-actions button:enabled').count(), 0);
    let row = page.locator('.field-row').last();
    await row.locator('[data-setting="name"]').fill('German Example');
    await row.locator('select').selectOption('de');
    await row.locator('[data-setting="front"]').check();
    await row.locator('[data-action="up"]').click();
    let c = await saved();
    assert.deepEqual(c.fields.filter(f => initial.fields.some(old => old.id === f.id)), initial.fields);
    assert.equal(c.fields[1].name, 'German Example');
    const id = c.fields[1].id;
    row = page.locator(`[data-id="${id}"]`);
    await row.locator('[data-setting="supplementary"]').check();
    await row.locator('select').selectOption('');
    await row.locator('[data-setting="name"]').fill('Grammar Hint');
    c = await saved();
    await page.reload(); assert.deepEqual(await saved(), c);
    await page.locator(`[data-id="${id}"] [data-action="remove"]`).click();
    assert.deepEqual((await saved()).fields, initial.fields);
    await page.locator('#reset').click();
    c = await saved(); assert.equal(c.fields.length, 2); assert.notEqual(c.id, initial.id);
    assert.equal(c.fields[0].front, true); assert.equal(c.fields[1].front, false);
  });
  await check('JSON export/import roundtrip, malformed rejection and incomplete draft validation', async () => {
    const c = await saved();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadPromise;
    const buffer = fs.readFileSync(await download.path());
    assert.deepEqual(JSON.parse(buffer), c);
    await page.locator('#reset').click();
    await page.locator('#import-file').setInputFiles({ name: 'config.json', mimeType: 'application/json', buffer });
    await page.waitForFunction(id => JSON.parse(localStorage.getItem(AnkiMaker.STORAGE_KEY)).id === id, c.id);
    assert.deepEqual(await saved(), c);
    await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":3}') });
    await page.locator('#validation').waitFor({ state: 'visible' });
    assert.deepEqual(await saved(), c);
    await page.locator('.field-row').first().locator('[data-setting="name"]').fill('Spanish');
    await page.locator('#generate').click();
    assert.match(await page.locator('#validation').innerText(), /Duplicate/);
    await page.locator('#reset').click();
    await page.locator('#generate').click();
  });
  await check('mouse drag moves complete field configuration', async () => {
    for (const name of ['German Word', 'German Example']) {
      await page.locator('#add-field').click();
      await page.locator('.field-row').last().locator('[data-setting="name"]').fill(name);
      await page.locator('.field-row').last().locator('select').selectOption('de');
    }
    await page.locator('#fields').evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 180));
    const initial = await saved();
    const handle = await page.locator('.field-row').first().locator('.drag-handle').boundingBox();
    const target = await page.locator('.field-row').last().boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down(); await page.mouse.move(target.x + 25, target.y + target.height - 5, { steps: 12 }); await page.mouse.up();
    assert.deepEqual((await saved()).fields, [...initial.fields.slice(1), initial.fields[0]]);
  });
  await check('mobile layout has no horizontal overflow and touch drag preserves complete rows', async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await mobile.newPage(); await p.goto(appURL);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const first = p.locator('.field-row').first(), second = p.locator('.field-row').last();
    await p.locator('#fields').evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 180));
    const handle = await first.locator('.drag-handle').boundingBox(), target = await second.boundingBox();
    const cdp = await mobile.newCDPSession(p);
    const x = Math.round(handle.x + handle.width / 2), y = Math.round(handle.y + handle.height / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await p.locator('.dragging').waitFor({ state: 'attached' });
    for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y + (target.y + target.height - 8 - y) * step / 8) }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await p.locator('.field-row').first().locator('[data-setting="name"]').inputValue(), 'Spanish');
    await p.screenshot({ path: path.join(artifactDir, 'mobile.png'), fullPage: true });
    await p.setViewportSize({ width: 320, height: 700 });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.close();
  });
  const config = cconfig([cfield('English', 'en'), cfield('Hint', '', { supplementary: true }), cfield('Spanish', 'es', { front: false }), cfield('Empty', 'de')]);
  const generated = A.generate(config), values = { English: '<b>Hello</b> world', Hint: '<em>Useful context</em>', Spanish: 'Hola', Empty: '<div>&nbsp;<br></div>' };
  await check('exported templates render order, formatted content and no visually empty orphan rows', async () => {
    const p = await cardPage(generated.back, values, { unsupported: true });
    assert.equal(await p.locator('.am-language').count(), 2);
    assert.equal(await p.locator('.am-content b').innerText(), 'Hello');
    assert.equal(await p.locator('.am-supplementary').isVisible(), false);
    await p.locator('[data-preference="supplementary"]').check();
    assert.equal(await p.locator('.am-supplementary').isVisible(), true);
    assert.deepEqual(await p.locator('.am-field > .am-content').allTextContents(), ['Hello world', 'Useful context', 'Hola']);
    await p.setViewportSize({ width: 390, height: 844 });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.screenshot({ path: path.join(artifactDir, 'generated-card.png'), fullPage: true });
    await p.locator('[data-preference="flags"]').uncheck();
    assert.equal(await p.locator('.am-flag').first().isVisible(), false);
    await p.locator('[data-preference="text"]').uncheck();
    assert.equal(await p.locator('.am-language > .am-content').first().isVisible(), false);
    assert.equal(await p.locator('.am-play').first().isVisible(), true);
    await p.setViewportSize({ width: 390, height: 844 });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Same page/session simulates Anki's switch from question to answer.
    await p.evaluate(({ html }) => { document.body.replaceChildren(document.createRange().createContextualFragment(html)); }, { html: renderAnki(generated.front, values) });
    assert.equal(await p.locator('[data-preference="supplementary"]').isChecked(), true);
    assert.equal(await p.locator('[data-preference="flags"]').isChecked(), false);
    assert.equal(await p.locator('[data-preference="text"]').isChecked(), false);
    const other = A.generate(cconfig([cfield('English', 'en')]));
    await p.evaluate(({ html }) => { document.body.replaceChildren(document.createRange().createContextualFragment(html)); }, { html: renderAnki(other.front, values) });
    assert.equal(await p.locator('[data-preference="flags"]').isChecked(), true);
    assert.equal(await p.locator('[data-preference="text"]').isChecked(), true);
    await p.close();
  });
  await check('empty supplementary content hides its switch; blocked storage still permits controls', async () => {
    const p = await cardPage(generated.front, { English: 'Hello', Hint: '<br>' }, { unsupported: true, noStorage: true });
    assert.equal(await p.locator('[data-preference="supplementary"]').isVisible(), false);
    assert.equal(await p.locator('.am-supplementary').count(), 0);
    await p.locator('[data-preference="flags"]').uncheck();
    assert.equal(await p.locator('.am-flag').isVisible(), false);
    await p.close();
    const empty = await cardPage(generated.front, {}, { unsupported: true });
    assert.equal(await empty.locator('.am-field').count(), 0);
    assert.equal(await empty.locator('.am-switches').isVisible(), false);
    await empty.close();
  });
  const speech = A.generate(cconfig([cfield('English', 'en')])).front;
  const v = (name, lang, localService = true) => ({ name, lang, localService, voiceURI: name });
  await check('all eleven standalone language rows and repeated-language fields render and play independently', async () => {
    const fields = Object.entries(A.languages).map(([key, profile]) => cfield(profile.name, key));
    fields.push(cfield('English Example', 'en'));
    const generated = A.generate(cconfig(fields));
    const values = Object.fromEntries(fields.map(f => [f.name, f.name + ' content']));
    const voices = Object.values(A.languages).map(p => v(p.name + ' Neural', p.locales[0]));
    const p = await cardPage(generated.back, values, { voices });
    assert.equal(await p.locator('.am-language').count(), 12);
    assert.equal(await p.locator('.am-flag svg').count(), 12);
    assert.deepEqual(await p.locator('.am-content').allTextContents(), fields.map(f => values[f.name]));
    for (let i = 0; i < fields.length; i++) {
      await p.locator('.am-play').nth(i).click();
      await p.waitForFunction(() => document.querySelector('.am-speech-status').textContent.includes('Finished'));
    }
    assert.deepEqual(await p.evaluate(() => window.__attempts), fields.map(f => A.languages[f.language].name + ' Neural'));
    await p.close();
  });
  await check('natural fallback selected over generic primary and successful playback exposes voice status', async () => {
    const p = await cardPage(speech, { English: 'Hello' }, { voices: [v('US Generic', 'en-US'), v('British Natural', 'en-GB', false)] });
    await p.locator('.am-play').click();
    await p.waitForFunction(() => document.querySelector('.am-speech-status').textContent.includes('Finished'));
    assert.deepEqual(await p.evaluate(() => window.__attempts), ['British Natural']);
    assert.equal(await p.locator('.is-loading,.is-speaking').count(), 0);
    await p.close();
  });
  await check('delayed voice enumeration resumes once; late duplicate errors do not create loops', async () => {
    const p = await cardPage(speech, { English: 'Hello' }, { voices: [] });
    await p.locator('.am-play').click();
    await p.evaluate(voices => window.__setVoices(voices), [v('Fail Neural', 'en-US', false), v('Good Generic', 'en-US')]);
    await p.waitForFunction(() => document.querySelector('.am-speech-status').textContent.includes('Finished'));
    assert.deepEqual(await p.evaluate(() => window.__attempts), ['Fail Neural', 'Good Generic']);
    await p.close();
  });
  await check('all browser failures bounded to three then one native request with cleared loading', async () => {
    const p = await cardPage(speech, { English: 'Hello' }, { voices: [v('One Neural', 'en-US'), v('Two Neural', 'en-US'), v('Three', 'en-US'), v('Four', 'en-US')], fail: true, native: true });
    await p.locator('.am-play').click();
    await p.waitForFunction(() => window.__native === 1);
    assert.equal((await p.evaluate(() => window.__attempts)).length, 3);
    assert.equal(await p.locator('.is-loading,.is-speaking,[aria-busy="true"]').count(), 0);
    assert.match(await p.locator('.am-speech-status').innerText(), /Requested native Anki/);
    await p.close();
  });
  await check('missing speech APIs, empty/throwing enumeration and thrown native playback remain readable', async () => {
    for (const options of [{ unsupported: true }, { voices: [] }, { throwVoices: true }, { unsupported: true, native: true }]) {
      const p = await cardPage(speech, { English: 'Still readable' }, options);
      if (options.native) await p.locator('.am-native button').evaluate(e => e.click = () => { throw new Error('Native rejected'); });
      await p.locator('.am-play').click();
      await p.waitForFunction(() => !document.querySelector('.am-play').classList.contains('is-loading'));
      assert.equal(await p.locator('.am-content').innerText(), 'Still readable');
      assert.match(await p.locator('.am-speech-status').innerText(), /unavailable|Requested native/);
      await p.close();
    }
  });
  await check('startup timeouts fall back once; repeated click cancels pending playback', async () => {
    const p = await cardPage(speech, { English: 'Hello' }, { voices: [v('Hung Neural', 'en-US')], hang: true, native: true });
    await p.clock.install();
    await p.locator('.am-play').click(); await p.clock.fastForward(4000);
    await p.waitForFunction(() => window.__native === 1);
    assert.equal(await p.locator('.is-loading').count(), 0);
    await p.close();
    const stopped = await cardPage(speech, { English: 'Hello' }, { voices: [v('Hung Neural', 'en-US')], hang: true, native: true });
    await stopped.clock.install();
    await stopped.locator('.am-play').click(); await stopped.locator('.am-play').click();
    await stopped.clock.fastForward(10000);
    assert.equal(await stopped.evaluate(() => window.__native || 0), 0);
    assert.match(await stopped.locator('.am-speech-status').innerText(), /stopped/);
    await stopped.close();
  });
  await check('synchronous speech exceptions, empty voices with native fallback and long-running playback watchdog', async () => {
    const thrown = await cardPage(speech, { English: 'Hello' }, { voices: [v('Exception Neural', 'en-US')], throwSpeech: true });
    await thrown.locator('.am-play').click();
    await thrown.waitForFunction(() => document.querySelector('.am-speech-status').textContent.includes('unavailable'));
    assert.equal(await thrown.locator('.is-loading').count(), 0);
    await thrown.close();
    const empty = await cardPage(speech, { English: 'Hello' }, { voices: [], native: true });
    await empty.locator('.am-play').click();
    await empty.waitForFunction(() => window.__native === 1);
    assert.deepEqual(await empty.evaluate(() => window.__attempts), []);
    await empty.close();
    const long = await cardPage(speech, { English: 'Hello' }, { voices: [v('Long Neural', 'en-US')], hang: true });
    await long.clock.install();
    await long.evaluate(() => { speechSynthesis.speak = function (u) { window.__attempts.push(u.voice.name); u.onstart(); }; });
    await long.locator('.am-play').click();
    await long.clock.fastForward(121000);
    assert.match(await long.locator('.am-speech-status').innerText(), /Playback timed out/);
    assert.equal(await long.locator('.is-loading,.is-speaking').count(), 0);
    await long.close();
  });
  assert.deepEqual(errors, []);
  console.log(`${passed} browser scenarios passed; no uncaught page errors.`);
})().catch(async error => {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); if (server) server.close(); });
