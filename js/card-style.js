(function (A) {
  "use strict";
  // Shared CSS source is embedded in JS so file:// generation needs no fetch/build.
  A.cardStyle = `/* Anki Template Studio — shared styling for both sides */
@font-face {
  font-family: "Hybrid Google Sans";
  src: url("_GoogleFont.ttf") format("truetype"), url("GoogleFont.ttf") format("truetype");
  font-weight: 100 900;
  font-display: swap;
}
.card, .card.nightMode, .nightMode .card {
  margin: 0 !important; padding: 0 !important; background: #f7f7f8 !important;
  color: #22232a !important; font-family: "Hybrid Google Sans", "Segoe UI", Arial, sans-serif;
  text-align: center; -webkit-text-size-adjust: 100%;
}
.am-card, .am-card * { box-sizing: border-box; }
.am-card {
  max-width: 820px; min-height: 90vh; margin: auto; padding: 36px 24px 24px;
  display: flex; flex-direction: column; justify-content: space-between; gap: 48px;
  background: radial-gradient(ellipse at top, #fff, transparent 65%); color: #22232a;
}
.am-fields { display: flex; flex-direction: column; gap: 18px; width: 100%; }
.am-field { min-width: 0; }
.am-language { width: 100%; max-width: 700px; margin: auto; display: flex; align-items: center; justify-content: center; gap: 16px; }
.am-play {
  appearance: none; flex: 0 0 48px; width: 48px; height: 48px; border: 0; border-radius: 50%;
  background: #121216; color: #fff; cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; padding: 0; box-shadow: 0 5px 14px #0002; font: 18px Arial;
}
.am-play::before { content: ""; border-left: 12px solid #fff; border-top: 8px solid transparent; border-bottom: 8px solid transparent; margin-left: 4px; }
.am-play.is-speaking::before { width: 12px; height: 14px; border: 0; border-left: 4px solid #fff; border-right: 4px solid #fff; margin: 0; }
.am-play.is-loading, .am-play.is-speaking { box-shadow: 0 0 0 5px #ff78b233, 0 5px 14px #0002; }
.am-play.is-loading { animation: am-pulse 1s ease-in-out infinite alternate; }
.am-play:focus-visible, .am-switch:focus-within { outline: 3px solid #b94976; outline-offset: 5px; }
.am-native { display: none !important; }
.am-flag { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 44px; width: 44px; height: 44px; border-radius: 50%; background: #fff; box-shadow: 0 2px 7px #0001; font: 30px/1 "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; overflow: hidden; }
.am-flag svg { display: block; width: 100%; height: 100%; }
.am-content { min-width: 0; overflow-wrap: anywhere; }
.am-language > .am-content { flex: 1; padding: 16px 24px; border-radius: 26px; background: #fff; box-shadow: 0 4px 15px #18181e0f; font-size: 17px; line-height: 1.5; }
.am-content img, .am-content video { max-width: 100%; height: auto; }
.am-content table { max-width: 100%; }
.am-supplementary { display: none; width: 100%; max-width: 700px; margin: auto; padding: 18px 24px; border-radius: 22px; background: #fff; box-shadow: 0 4px 15px #18181e0a; text-align: left; font-size: 15px; line-height: 1.65; }
.am-card.show-supplementary .am-supplementary { display: block; }
.am-card:not(.show-flags) .am-flag { display: none; }
.am-card:not(.show-text) .am-language > .am-content { display: none; }
.am-footer { width: 100%; }
.am-switches { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px 26px; }
.am-switch { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 13px; cursor: pointer; min-height: 44px; }
.am-switch input { appearance: none; -webkit-appearance: none; width: 46px; height: 26px; border: 2px solid #c8c8cf; border-radius: 99px; background: #fff; margin: 0; cursor: pointer; flex: 0 0 46px; position: relative; }
.am-switch input::before { content: ""; position: absolute; width: 16px; height: 16px; top: 3px; left: 3px; border-radius: 50%; background: #a9a9b2; transition: transform .18s; }
.am-switch input:checked { border-color: #ec92b4; }
.am-switch input:checked::before { transform: translateX(20px); background: linear-gradient(135deg, #ffbf9f, #ff78b2); }
.am-switch input:focus { outline: none; }
.am-card [hidden] { display: none !important; }
.am-speech-status { min-height: 24px; color: #62626d; font-size: 12px; line-height: 1.6; margin: 20px 0 0; }
.am-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@keyframes am-pulse { to { box-shadow: 0 0 0 7px #ff78b211, 0 5px 14px #0002; } }
@media (max-width: 600px) {
  .am-card { padding: 24px 12px 16px; gap: 32px; }
  .am-language { gap: 10px; }
  .am-language > .am-content { font-size: 15px; padding: 14px 16px; }
  .am-play { flex-basis: 44px; width: 44px; height: 44px; }
  .am-flag { flex-basis: 36px; width: 36px; height: 36px; font-size: 26px; }
  .am-switches { flex-direction: column; gap: 4px; }
  .am-switch { justify-content: space-between; padding: 4px 12px; }
}
@media (prefers-reduced-motion: reduce) { .am-card *, .am-card *::before { animation: none !important; transition: none !important; } }
`;
})(globalThis.AnkiMaker = globalThis.AnkiMaker || {});
