(function (A) {
  "use strict";
  const $ = id => document.getElementById(id);
  let config = A.defaultConfig(), output = null, revision = 0, returnFocus = null;
  const titles = { front: "FRONT SIDE", back: "BACK SIDE", style: "STYLE" };
  try {
    const saved = localStorage.getItem(A.STORAGE_KEY);
    if (saved) config = A.parseConfig(saved);
  } catch (error) {
    $("feedback").textContent = "The saved configuration could not be restored. Using the default; import a backup if needed.";
  }

  function save() {
    try {
      localStorage.setItem(A.STORAGE_KEY, JSON.stringify(config));
      $("save-status").textContent = "Saved on this device";
    } catch (error) { $("save-status").textContent = "Local saving unavailable. Export JSON to keep your settings."; }
  }
  function closeSource() {
    $("source-dialog").close();
  }
  function changed() {
    revision += 1;
    if (output) $("output-state").textContent = "Settings changed — generate again";
    output = null;
    document.querySelectorAll(".output-actions button").forEach(button => { button.disabled = true; });
    $("checklist-section").hidden = true;
    $("validation").hidden = true;
    $("feedback").textContent = "";
    if ($("source-dialog").open) closeSource();
    save();
  }
  function renderFields() {
    $("fields").replaceChildren();
    $("field-count").textContent = config.fields.length;
    $("add-field").disabled = config.fields.length >= 200;
    config.fields.forEach(function (field, index) {
      const row = document.createElement("li");
      row.className = "field-row";
      row.dataset.id = field.id;
      const options = Object.entries(A.languages).map(([id, language]) => `<option value="${id}">${language.name}</option>`).join("");
      row.innerHTML = `<div class="move-controls">
        <button type="button" class="drag-handle" data-action="drag" aria-label="Drag to reorder field ${index + 1}" title="Drag to reorder; use the arrows for keyboard movement">⠿</button>
        <div class="move-buttons"><button type="button" data-action="up" aria-label="Move field ${index + 1} up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="down" aria-label="Move field ${index + 1} down" ${index === config.fields.length - 1 ? "disabled" : ""}>↓</button></div>
      </div>
      <label class="field-control"><span>Anki field name</span><input type="text" data-setting="name" maxlength="200" autocomplete="off" spellcheck="false" aria-label="Anki field name ${index + 1}"></label>
      <label class="field-control"><span class="language-label">Language${field.supplementary ? " (optional)" : ""}</span><select data-setting="language" aria-label="Language for field ${index + 1}" ${field.supplementary ? "" : "required"}><option value="">Choose language</option>${options}</select></label>
      <div class="field-options" role="group" aria-label="Placement and role for field ${index + 1}">
        <label><input type="checkbox" data-setting="front"> Front</label>
        <label><input type="checkbox" data-setting="back"> Back</label>
        <label><input type="checkbox" data-setting="supplementary"> Supplementary</label>
      </div>
      <button type="button" class="remove-field" data-action="remove" aria-label="Remove field ${index + 1}" title="Remove field">×</button>`;
      row.querySelector('[data-setting="name"]').value = field.name;
      row.querySelector('[data-setting="language"]').value = field.language;
      ["front", "back", "supplementary"].forEach(k => { row.querySelector('[data-setting="' + k + '"]').checked = field[k]; });
      $("fields").append(row);
    });
  }
  function rowById(id) { return Array.from($("fields").children).find(row => row.dataset.id === id); }
  function showErrors(errors) {
    const box = $("validation");
    box.replaceChildren(document.createTextNode("A few things to fix before continuing:"));
    const list = document.createElement("ul");
    errors.forEach(error => { const item = document.createElement("li"); item.textContent = error; list.append(item); });
    box.append(list);
    box.hidden = false;
    box.focus();
  }
  $("fields").addEventListener("input", function (event) {
    const input = event.target, setting = input.dataset.setting;
    if (!setting) return;
    const row = input.closest(".field-row");
    const field = config.fields.find(f => f.id === row.dataset.id);
    field[setting] = input.type === "checkbox" ? input.checked : input.value;
    if (setting === "supplementary") {
      row.querySelector(".language-label").textContent = "Language" + (field.supplementary ? " (optional)" : "");
      row.querySelector("select").required = !field.supplementary;
    }
    changed();
  });
  $("fields").addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest(".field-row"), id = row.dataset.id, action = button.dataset.action;
    if (action === "up" || action === "down") {
      if (A.moveField(config, id, action === "up" ? -1 : 1)) {
        changed(); renderFields();
        const replacement = rowById(id);
        const arrow = replacement.querySelector('[data-action="' + action + '"]');
        (arrow.disabled ? replacement.querySelector(".drag-handle") : arrow).focus();
        $("feedback").textContent = "Field moved to position " + (config.fields.findIndex(f => f.id === id) + 1) + ".";
      }
    } else if (action === "remove") {
      const index = config.fields.findIndex(f => f.id === id);
      config.fields.splice(index, 1);
      changed(); renderFields();
      const next = $("fields").children[Math.min(index, config.fields.length - 1)];
      (next ? next.querySelector("input") : $("add-field")).focus();
    }
  });

  // Pointer events cover mouse, pen and touch. Only the handle captures gestures,
  // leaving normal page scrolling available everywhere else in a row.
  let drag = null, frame = 0;
  function relocateAtPointer() {
    if (!drag) return;
    const target = document.elementFromPoint(drag.x, drag.y);
    const over = target && target.closest(".field-row");
    if (!over || over === drag.row || !$("fields").contains(over)) return;
    const from = config.fields.findIndex(f => f.id === drag.row.dataset.id);
    const to = config.fields.findIndex(f => f.id === over.dataset.id);
    const rect = over.getBoundingClientRect();
    if ((from < to && drag.y < rect.top + rect.height / 2) || (from > to && drag.y > rect.top + rect.height / 2)) return;
    if (A.moveField(config, drag.row.dataset.id, to - from)) {
      if (from < to) over.after(drag.row); else over.before(drag.row);
      // Reacquire after moving the captured element's ancestor in the DOM.
      drag.handle.setPointerCapture(drag.pointer);
      drag.moved = true;
      changed();
    }
  }
  function autoScroll() {
    if (!drag) return;
    const delta = drag.y < 75 ? -12 : drag.y > window.innerHeight - 75 ? 12 : 0;
    if (delta) { window.scrollBy(0, delta); relocateAtPointer(); }
    frame = window.requestAnimationFrame(autoScroll);
  }
  $("fields").addEventListener("pointerdown", function (event) {
    const handle = event.target.closest(".drag-handle");
    if (!handle || event.button !== 0 || drag) return;
    event.preventDefault();
    handle.focus();
    handle.setPointerCapture(event.pointerId);
    drag = { row: handle.closest(".field-row"), handle: handle, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    drag.row.classList.add("dragging");
    frame = window.requestAnimationFrame(autoScroll);
  });
  $("fields").addEventListener("pointermove", function (event) {
    if (!drag || drag.pointer !== event.pointerId) return;
    drag.x = event.clientX; drag.y = event.clientY;
    relocateAtPointer();
  });
  function endDrag(event) {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (event.type === "lostpointercapture" && drag.handle.hasPointerCapture(event.pointerId)) return;
    const id = drag.row.dataset.id, moved = drag.moved;
    drag.row.classList.remove("dragging");
    drag = null;
    window.cancelAnimationFrame(frame);
    renderFields();
    rowById(id).querySelector(".drag-handle").focus();
    if (moved) $("feedback").textContent = "Field order updated.";
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => $("fields").addEventListener(name, endDrag));

  $("add-field").addEventListener("click", function () {
    if (config.fields.length >= 200) return;
    const field = { id: A.id(), name: "", language: "", front: false, back: true, supplementary: false };
    config.fields.push(field);
    changed(); renderFields();
    rowById(field.id).querySelector("input").focus();
  });
  $("reset").addEventListener("click", function () {
    config = A.defaultConfig();
    changed(); renderFields();
    $("output-state").textContent = "Default restored — generate to continue";
    $("feedback").textContent = "Restored English on both sides and Spanish on the back.";
  });
  $("generate").addEventListener("click", function () {
    const errors = A.validate(config);
    if (errors.length) { showErrors(errors); return; }
    try { output = A.generate(config); }
    catch (error) { showErrors([error.message]); return; }
    $("validation").hidden = true;
    $("checklist").replaceChildren();
    output.checklist.forEach(name => { const item = document.createElement("li"); item.textContent = name; $("checklist").append(item); });
    $("checklist-section").hidden = false;
    document.querySelectorAll(".output-actions button").forEach(button => { button.disabled = false; });
    $("output-state").textContent = "Generated · ready to copy";
    $("feedback").textContent = "Templates generated. Check your Anki field names below, then See or Copy each output.";
  });
  function showSource(key, trigger, select) {
    if (!output) return;
    returnFocus = trigger;
    $("source-title").textContent = titles[key];
    $("source-code").value = output[key];
    $("source-dialog").showModal();
    if (select) { $("source-code").focus(); $("source-code").select(); }
    else $("close-dialog").focus();
  }
  $("outputs").addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-action]");
    if (!button || !output) return;
    const key = button.closest("[data-output]").dataset.output;
    if (button.dataset.action === "see") { showSource(key, button, false); return; }
    const current = revision, source = output[key];
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(source);
      if (revision === current) $("feedback").textContent = titles[key] + " copied.";
    } catch (error) {
      if (revision !== current) return;
      $("feedback").textContent = "Clipboard access failed. Select and copy the complete code in the popup.";
      showSource(key, button, true);
    }
  });
  $("close-dialog").addEventListener("click", closeSource);
  $("source-dialog").addEventListener("close", function () { if (returnFocus && returnFocus.isConnected && !returnFocus.disabled) returnFocus.focus(); });
  // Keep Tab inside the popup even in browsers that otherwise tab to browser chrome.
  $("source-dialog").addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    const first = $("close-dialog"), last = $("source-code");
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // Native dialog supplies Escape; also close on backdrop clicks.
  $("source-dialog").addEventListener("click", function (event) {
    if (event.target !== this) return;
    const rect = this.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSource();
  });
  $("export").addEventListener("click", function () {
    const blob = new Blob([JSON.stringify(config, null, 2) + "\n"], { type: "application/json" });
    const link = document.createElement("a"), url = URL.createObjectURL(blob);
    link.href = url; link.download = "anki-template-configuration.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("feedback").textContent = "Configuration exported, including field order and identities.";
  });
  $("import").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async function () {
    const file = this.files[0];
    this.value = "";
    if (!file) return;
    const beforeRead = revision;
    try {
      if (file.size > 1024 * 1024) throw new Error("Choose a configuration file smaller than 1 MB.");
      const parsed = A.parseConfig(await file.text());
      if (revision !== beforeRead) throw new Error("Settings changed while reading the file. Import it again to replace the current settings.");
      // Incomplete configurations are valid drafts. They reopen as saved and
      // receive the same clear validation messages when Generate is clicked.
      config = parsed;
      changed(); renderFields();
      $("feedback").textContent = "Configuration imported. Generate to create its templates.";
    } catch (error) { showErrors(["Import failed: " + error.message]); }
  });
  renderFields();
  save();
})(globalThis.AnkiMaker);
