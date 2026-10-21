(function (A) {
  "use strict";
  // Embedded verbatim in each exported side. No generator globals are required.
  A.cardRuntime = function (profiles, voiceTools) {
    "use strict";
    var script = document.currentScript;
    var root = script && script.previousElementSibling;
    if (!root || !root.classList.contains("am-card")) {
      var roots = document.querySelectorAll(".am-card");
      root = roots[roots.length - 1];
    }
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = "true";
    var previous = window.__ankiStudioPlayback;
    if (previous && previous.dispose) previous.dispose();
    var synth = window.speechSynthesis;
    var supported = Boolean(synth && window.SpeechSynthesisUtterance);
    var status = root.querySelector(".am-speech-status");
    var sequence = 0, attempt = 0, timers = [], activeButton = null, activeUtterance = null, stopped = false;
    var voiceWake = null;

    function schedule(callback, delay) {
      var timer = window.setTimeout(callback, delay);
      timers.push(timer);
      return timer;
    }
    function cancelSpeech() {
      if (supported) { try { synth.cancel(); } catch (error) { /* The text is still usable. */ } }
    }
    function clearPlayback() {
      sequence += 1;
      attempt += 1;
      timers.forEach(window.clearTimeout);
      timers = [];
      voiceWake = null;
      activeUtterance = null;
      root.querySelectorAll(".am-play").forEach(function (button) {
        button.removeAttribute("aria-busy");
        button.setAttribute("aria-pressed", "false");
        button.classList.remove("is-loading", "is-speaking");
      });
      activeButton = null;
      cancelSpeech();
    }
    function announce(message) { if (status) status.textContent = message; }
    function voices() {
      if (!supported) return [];
      try { return synth.getVoices() || []; } catch (error) { return []; }
    }
    function onVoicesChanged() { if (voiceWake) voiceWake(); }
    if (supported && synth.addEventListener) synth.addEventListener("voiceschanged", onVoicesChanged);
    // Cache warming helps devices that only enumerate after the first request.
    voices();

    // Anki sections omit truly empty fields. Also suppress visual HTML-only empties
    // such as <br> or <div>&nbsp;</div>, while preserving images, math and audio.
    root.querySelectorAll(".am-field").forEach(function (row) {
      var content = row.querySelector(".am-content");
      var text = content.textContent.replace(/[\s\u200b\ufeff]/g, "");
      var media = content.querySelector("img,svg,audio,video,canvas,math,mjx-container,.MathJax,anki-mathjax,.replay-button,.soundLink,iframe,object");
      if (!text && !media) row.remove();
    });
    var preferences = { flags: true, text: true, supplementary: false };
    var key = "anki-template-studio:display:v1:" + root.dataset.config;
    try {
      var stored = JSON.parse(sessionStorage.getItem(key));
      Object.keys(preferences).forEach(function (name) { if (stored && typeof stored[name] === "boolean") preferences[name] = stored[name]; });
    } catch (error) { /* Storage is optional in Anki webviews. */ }
    var hasLanguages = Boolean(root.querySelector(".am-language"));
    var hasSupplementary = Boolean(root.querySelector(".am-supplementary"));
    function applyPreferences() {
      Object.keys(preferences).forEach(function (name) { root.classList.toggle("show-" + name, preferences[name]); });
      root.querySelectorAll("[data-preference]").forEach(function (input) { input.checked = preferences[input.dataset.preference]; });
    }
    root.querySelectorAll("[data-preference]").forEach(function (input) {
      var name = input.dataset.preference;
      input.closest("label").hidden = name === "supplementary" ? !hasSupplementary : !hasLanguages;
      input.addEventListener("change", function () {
        preferences[name] = input.checked;
        try { sessionStorage.setItem(key, JSON.stringify(preferences)); } catch (error) { /* Keep local controls working. */ }
        applyPreferences();
      });
    });
    applyPreferences();
    if (!hasLanguages && !hasSupplementary) root.querySelector(".am-switches").hidden = true;

    function finish(button, message) {
      if (activeButton === button) {
        button.classList.remove("is-loading", "is-speaking");
        button.removeAttribute("aria-busy");
        button.setAttribute("aria-pressed", "false");
        activeButton = null;
      }
      announce(message);
    }
    function nativeFallback(row, button, token) {
      if (token !== sequence || stopped) return;
      attempt += 1;
      cancelSpeech();
      var nativeControl = row.querySelector(".am-native .replay-button, .am-native .replaybutton, .am-native .soundLink, .am-native anki-play-button");
      if (nativeControl) {
        try {
          nativeControl.click();
          // Native replay exposes no portable voice, start, end or error events.
          // Report the request honestly rather than claiming successful audio.
          finish(button, "Requested native Anki speech. The voice and playback result are not exposed by this client. If silent, check Anki’s TTS settings. Your card is still readable.");
          return;
        } catch (error) { /* Continue to the readable failure state. */ }
      }
      finish(button, "Speech is unavailable on this device or all playback attempts failed. Your card is still readable; check your device voices or Anki TTS settings.");
    }
    function browserAttempt(row, button, candidates, index, token) {
      if (token !== sequence || stopped) return;
      if (index >= candidates.length || index >= 3) { nativeFallback(row, button, token); return; }
      var voice = candidates[index];
      var text = row.querySelector(".am-content").textContent.replace(/\s+/g, " ").trim();
      var currentAttempt = ++attempt, done = false, started = false, startup, watchdog;
      function current() { return !done && token === sequence && currentAttempt === attempt && !stopped; }
      function fail() {
        if (!current()) return;
        done = true;
        window.clearTimeout(startup);
        window.clearTimeout(watchdog);
        attempt += 1;
        cancelSpeech();
        button.classList.remove("is-speaking");
        button.classList.add("is-loading");
        announce("Trying another available voice…");
        // Schedule after cancel() so late callbacks cannot affect the next attempt.
        schedule(function () { browserAttempt(row, button, candidates, index + 1, token); }, 80);
      }
      try {
        var utterance = new window.SpeechSynthesisUtterance(text);
        activeUtterance = utterance; // Some webviews require a retained reference.
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = 1;
        utterance.onstart = function () {
          if (!current()) return;
          started = true;
          window.clearTimeout(startup);
          button.classList.remove("is-loading");
          button.classList.add("is-speaking");
          button.removeAttribute("aria-busy");
          announce("Playing with " + voice.name + " (" + voice.lang + ").");
        };
        utterance.onend = function () {
          if (!current()) return;
          if (!started) { fail(); return; }
          done = true;
          window.clearTimeout(startup);
          window.clearTimeout(watchdog);
          activeUtterance = null;
          finish(button, "Finished playing with " + voice.name + ".");
        };
        utterance.onerror = fail;
        startup = schedule(fail, 3500);
        watchdog = schedule(function () {
          if (!current()) return;
          done = true;
          attempt += 1;
          cancelSpeech();
          finish(button, "Playback timed out. Try a shorter passage or check your device’s speech settings.");
        }, 120000);
        synth.speak(utterance);
      } catch (error) { fail(); }
    }
    function play(row, button) {
      if (activeButton === button) { clearPlayback(); announce("Playback stopped."); return; }
      clearPlayback();
      var token = sequence;
      var profile = profiles[row.dataset.language];
      var text = row.querySelector(".am-content").textContent.trim();
      if (!text) { announce("There is no text to speak in this field."); return; }
      activeButton = button;
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-busy", "true");
      button.classList.add("is-loading");
      announce("Finding an available " + profile.name + " voice…");
      var begun = false;
      function begin(waited) {
        if (begun || token !== sequence || stopped) return;
        var ranked = voiceTools.rank(voices(), profile);
        if (!ranked.length && supported && !waited) return;
        begun = true;
        voiceWake = null;
        // Deduplicate the same exposed voice, then bound attempts to three.
        var seen = {};
        ranked = ranked.filter(function (voice) {
          var identity = voice.voiceURI + "|" + voice.name + "|" + voice.lang;
          if (seen[identity]) return false;
          seen[identity] = true;
          return true;
        }).slice(0, 3);
        browserAttempt(row, button, ranked, 0, token);
      }
      voiceWake = function () { begin(false); };
      begin(false);
      if (!begun) {
        schedule(function () { begin(false); }, 200);
        schedule(function () { begin(false); }, 500);
        schedule(function () { begin(true); }, 1000);
      }
    }
    root.querySelectorAll(".am-language").forEach(function (row) {
      row.querySelector(".am-play").addEventListener("click", function () { play(row, this); });
      row.querySelectorAll(".am-native a, .am-native button, .am-native anki-play-button").forEach(function (control) { control.setAttribute("tabindex", "-1"); });
    });
    function dispose() {
      stopped = true;
      clearPlayback();
      if (supported && synth.removeEventListener) synth.removeEventListener("voiceschanged", onVoicesChanged);
      window.removeEventListener("pagehide", dispose);
    }
    window.addEventListener("pagehide", dispose);
    window.__ankiStudioPlayback = { dispose: dispose };
  };
})(globalThis.AnkiMaker = globalThis.AnkiMaker || {});
