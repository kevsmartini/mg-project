/* =============================================================================
   SHADOW MOSES · Interactive CODEC (proyecto.html)
   -----------------------------------------------------------------------------
   Layered ON TOP of the existing "CODEC LINK" block — no redesign. It only
   drives the elements already in the HTML (portraits, frequency display,
   audio bars, dialog box) plus a few added hooks (dial, CALL button, signal
   indicator).

   Call state machine:
     idle → dialing → ringing → connected → talking → idle

   Nothing here touches js/main.js; it runs as its own isolated module.
   ============================================================================= */

(function () {
  "use strict";

  const widget = document.getElementById("codec-widget");
  if (!widget) return; // only exists on proyecto.html

  /* ===========================================================
     VALID FREQUENCIES — EDIT HERE.
     Keys are integer hundredths (140.15 → 14015) so matching is
     exact and free of floating-point rounding issues.
     Dialing a frequency not listed here = static / no connection.
     =========================================================== */
  const FREQUENCIES = {
    14015: { name: "MERYL",         portrait: "assets/img/meryl-codec.webp",    voice: "assets/audio/audio-for-meryl.mp3",   subs: "assets/audio/audio-for-meryl.json" },
    14085: { name: "CAMPBELL",      portrait: "assets/img/cambell-codec.webp",  voice: "assets/audio/audio-for-cambell.mp3", subs: "assets/audio/audio-for-cambell.json" },
    14112: { name: "OTACON",        portrait: "assets/img/otacon-codec.webp",   voice: "assets/audio/audio-for-otacon.mp3",  subs: "assets/audio/audio-for-otacon.json" },
    14096: { name: "MEI LING",      portrait: "assets/img/may-ling-codec.webp", voice: "assets/audio/audio-forMei-Ling.mp3", subs: "assets/audio/audio-forMei-Ling.json" },
    14180: { name: "MASTER MILLER", portrait: "assets/img/miller-codec.webp",   voice: "assets/audio/audio-for-miller.mp3",  subs: "assets/audio/audio-for-miller.json" },
  };

  // Snake is always the COMMANDER side — the only one who speaks.
  const SNAKE_PORTRAIT = "assets/img/snake-codec.webp";

  // Used while the real timestamp JSON isn't available for a frequency.
  // TODO: añadir JSON de timestamps real en assets/data/codec-lines/ para cada
  //       frecuencia; entonces este fallback deja de usarse.
  const FALLBACK_LINES = [
    { start: 0.0, end: 2.6, text: "> ... (placeholder transmission) ..." },
    { start: 2.6, end: 5.2, text: "> Snake here. This line has no real audio yet." },
    { start: 5.2, end: 7.6, text: "> ... Snake out." },
  ];

  // --- Dial configuration ---
  const MIN = 14000; // 140.00
  const MAX = 14200; // 142.00
  const STEP = 1;    // 0.01 per press (steps on the 2nd decimal)
  let freq = 14015;  // starting frequency (matches the original display)

  // --- Transition timings (ms) ---
  const DIAL_MS = 700;    // static burst while dialing
  const RING_MS = 2200;   // ringtone before the other side picks up
  const CONNECT_MS = 800; // glow beat before Snake starts talking

  // --- DOM references ---
  const freqEl = document.getElementById("codec-freq");
  const upBtn = document.getElementById("codec-freq-up");
  const downBtn = document.getElementById("codec-freq-down");
  const callBtn = document.getElementById("codec-call");
  const signalEl = document.getElementById("codec-signal");
  const dialogEl = document.getElementById("codec-dialog");
  const cmdPhoto = document.getElementById("codec-photo-commander");
  const opPhoto = document.getElementById("codec-photo-operative");
  const cmdName = document.getElementById("codec-name-commander");
  const opName = document.getElementById("codec-name-operative");
  const ringAudio = document.getElementById("codec-ringtone");
  const voiceAudio = document.getElementById("codec-voice");
  const memBtn = document.getElementById("codec-mem");
  const memList = document.getElementById("codec-memlist");

  // --- State ---
  let state = "idle";
  let callToken = 0;   // bumped on every reset to invalidate stale async steps
  const timers = [];   // pending setTimeout ids, cleared on reset
  let rafId = 0;

  const STATE_CLASS = {
    dialing: "is-dialing",
    ringing: "is-ringing",
    connected: "is-connected",
    talking: "is-talking",
    nosignal: "is-nosignal",
  };
  const SIGNAL_TEXT = {
    idle: "NONE",
    dialing: "DIALING",
    ringing: "RINGING",
    connected: "CONNECTED",
    talking: "CONNECTED",
    nosignal: "NO SIGNAL",
  };

  function setState(next) {
    Object.values(STATE_CLASS).forEach((c) => widget.classList.remove(c));
    if (STATE_CLASS[next]) widget.classList.add(STATE_CLASS[next]);
    state = next;
    signalEl.textContent = SIGNAL_TEXT[next] || "NONE";
  }

  // Timer helpers so a reset can cancel everything in flight.
  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    while (timers.length) clearTimeout(timers.pop());
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  // Dialog box always keeps a blinking caret at the end.
  function setDialog(text) {
    dialogEl.textContent = text || "";
    const caret = document.createElement("span");
    caret.className = "codec__caret";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = "_";
    dialogEl.appendChild(caret);
  }

  /* -------------------------------------------------------------------------
     FREQUENCY DIAL
     ------------------------------------------------------------------------- */
  function fmt(hundredths) {
    return (hundredths / 100).toFixed(2);
  }
  function renderFreq() {
    freqEl.value = fmt(freq);
  }
  // Disable the dial (arrows + typing + MEMORY) while a call is in progress.
  function lockDial(locked) {
    upBtn.disabled = locked;
    downBtn.disabled = locked;
    freqEl.disabled = locked;
    memBtn.disabled = locked;
  }

  /* -------------------------------------------------------------------------
     MEMORY — saved frequencies (like the game's codec MEMORY list).
     Built from FREQUENCIES; picking an entry tunes the dial.
     ------------------------------------------------------------------------- */
  function openMem() {
    memList.hidden = false;
    memBtn.setAttribute("aria-expanded", "true");
  }
  function closeMem() {
    memList.hidden = true;
    memBtn.setAttribute("aria-expanded", "false");
  }
  function toggleMem() {
    if (state !== "idle" && state !== "nosignal") return;
    if (memList.hidden) openMem();
    else closeMem();
  }
  function buildMemList() {
    Object.keys(FREQUENCIES)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((key) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "codec__memlist-item";
        item.setAttribute("role", "menuitem");
        const name = document.createElement("span");
        name.textContent = FREQUENCIES[key].name;
        const value = document.createElement("span");
        value.textContent = fmt(key);
        item.append(name, value);
        item.addEventListener("click", () => {
          freq = key;
          renderFreq();
          closeMem();
        });
        memList.appendChild(item);
      });
  }
  function changeFreq(dir) {
    // The dial is locked once a call is in progress.
    if (state !== "idle" && state !== "nosignal") return;
    if (state === "nosignal") resetToIdle();
    freq = Math.min(MAX, Math.max(MIN, freq + dir * STEP));
    renderFreq();
  }

  /* -------------------------------------------------------------------------
     RESET → IDLE (also used as "hang up")
     ------------------------------------------------------------------------- */
  function resetToIdle() {
    callToken++; // invalidate any in-flight call
    clearTimers();
    try { ringAudio && ringAudio.pause(); } catch (e) {}
    try { voiceAudio && voiceAudio.pause(); } catch (e) {}

    // Portraits back to the generic silhouettes.
    cmdPhoto.hidden = true; cmdPhoto.removeAttribute("src");
    opPhoto.hidden = true; opPhoto.removeAttribute("src");
    cmdName.textContent = "COMMANDER";
    opName.textContent = "OPERATIVE";

    setState("idle");
    setDialog(""); // empty box + caret
    callBtn.disabled = false;
    lockDial(false);
    closeMem();
  }

  /* -------------------------------------------------------------------------
     CALL SEQUENCE
     ------------------------------------------------------------------------- */
  function startCall() {
    if (state !== "idle" && state !== "nosignal") return;
    if (state === "nosignal") resetToIdle();

    const entry = FREQUENCIES[freq];
    const token = ++callToken;
    closeMem();
    callBtn.disabled = true;
    lockDial(true);

    // Unknown frequency → just static/noise, no connection (like the game).
    if (!entry) {
      setState("nosignal");
      setDialog("> — NO RESPONSE —");
      later(() => { if (token === callToken) resetToIdle(); }, 1600);
      return;
    }

    // Valid → dialing (static burst) → ringing.
    setState("dialing");
    setDialog("> DIALING " + fmt(freq) + " ...");
    later(() => { if (token === callToken) ring(entry, token); }, DIAL_MS);
  }

  function ring(entry, token) {
    setState("ringing");
    setDialog("> CALLING ...");
    if (ringAudio && ringAudio.getAttribute("src")) {
      try { ringAudio.currentTime = 0; ringAudio.play().catch(() => {}); } catch (e) {}
    }
    later(() => { if (token === callToken) connect(entry, token); }, RING_MS);
  }

  function connect(entry, token) {
    try { ringAudio && ringAudio.pause(); } catch (e) {}
    // COMMANDER → Snake, OPERATIVE → the dialed character.
    swapPortrait(cmdPhoto, cmdName, SNAKE_PORTRAIT, "SNAKE");
    swapPortrait(opPhoto, opName, entry.portrait, entry.name);
    setState("connected");
    setDialog("");
    later(() => { if (token === callToken) talk(entry, token); }, CONNECT_MS);
  }

  // Swap a portrait to a character photo; keep the silhouette if it 404s.
  function swapPortrait(img, nameEl, src, name) {
    nameEl.textContent = name;
    img.onload = () => { img.hidden = false; };
    img.onerror = () => { img.hidden = true; }; // fall back to the silhouette
    img.hidden = false;
    img.src = src;
  }

  function talk(entry, token) {
    setState("talking"); // CSS animates the audio bars + Snake portrait
    loadLines(entry.subs).then((lines) => {
      if (token === callToken) runSubtitles(lines, entry, token);
    });
  }

  // Fetch subtitle JSON and normalize it. Falls back to placeholder lines if
  // the file is missing or unreadable.
  function loadLines(url) {
    return fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => normalizeLines(data) || FALLBACK_LINES)
      .catch(() => FALLBACK_LINES);
  }

  // Accepts two shapes and returns [{ start, end, text }]:
  //   a) the simple format: [{ start, end, text }]
  //   b) the word-timestamp export: { segments: [{ text, start_time,
  //      end_time, words: [{ text, start_time, end_time }] }] }
  // For (b) we split each segment into short phrases (on sentence punctuation
  // or ~64 chars) so subtitles are paced instead of dumped all at once.
  function normalizeLines(data) {
    if (Array.isArray(data)) return data.length ? data : null;
    if (!data || !Array.isArray(data.segments)) return null;

    const lines = [];
    data.segments.forEach((seg) => {
      const words = Array.isArray(seg.words) ? seg.words : null;
      if (!words || !words.length) {
        if (seg.text) {
          lines.push({
            start: seg.start_time || 0,
            end: seg.end_time || 0,
            text: "> " + String(seg.text).trim(),
          });
        }
        return;
      }
      let buf = "";
      let bufStart = null;
      const flush = (endTime) => {
        const text = buf.trim();
        if (text) lines.push({ start: bufStart, end: endTime, text: "> " + text });
        buf = "";
        bufStart = null;
      };
      words.forEach((w) => {
        if (bufStart == null) bufStart = w.start_time;
        buf += w.text;
        const raw = (w.text || "").trim();
        if (/[.?!]$/.test(raw) || buf.trim().length > 64) flush(w.end_time);
      });
      flush(words[words.length - 1].end_time);
    });
    return lines.length ? lines : null;
  }

  function runSubtitles(lines, entry, token) {
    const last = lines[lines.length - 1];
    const total = last ? last.end : 0;

    // The character voice plays here (allowed: CALL was a user gesture) and
    // the timeline syncs to voiceAudio.currentTime. If the file is missing or
    // playback is blocked, a simulated clock (performance.now) drives the subs.
    let useAudio = false;
    if (voiceAudio) {
      voiceAudio.src = entry.voice;
      const p = voiceAudio.play();
      if (p && typeof p.then === "function") p.catch(() => {});
    }

    const startTs = performance.now();
    let shown = -1;
    const tick = () => {
      if (token !== callToken) return; // call was reset/hung up
      useAudio = !!voiceAudio && !voiceAudio.paused && voiceAudio.readyState > 2;
      const t = useAudio
        ? voiceAudio.currentTime
        : (performance.now() - startTs) / 1000;

      let idx = -1;
      for (let i = 0; i < lines.length; i++) if (t >= lines[i].start) idx = i;
      if (idx !== shown && idx >= 0) {
        shown = idx;
        setDialog(lines[idx].text);
      }

      if (t >= total) {
        resetToIdle(); // last line finished → automatically back to idle
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  /* -------------------------------------------------------------------------
     CONTROLS
     ------------------------------------------------------------------------- */
  // Commit whatever is typed in the field: parse, round to 2 decimals, clamp
  // to range. Invalid/empty input reverts to the current value.
  function commitFreqInput() {
    const v = parseFloat(freqEl.value);
    if (isFinite(v)) {
      freq = Math.min(MAX, Math.max(MIN, Math.round(v * 100)));
    }
    renderFreq();
  }

  // Press-and-hold auto-repeat for a dial button. Mouse/touch use pointer
  // events (single step, then a repeating interval while held); keyboard
  // activation (Enter/Space fires a click with detail 0) does one step.
  function bindHold(btn, dir) {
    let holdTO = 0;
    let repeatIV = 0;
    const step = () => changeFreq(dir);
    const stop = () => {
      clearTimeout(holdTO);
      clearInterval(repeatIV);
      holdTO = 0;
      repeatIV = 0;
    };
    btn.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return; // primary button / touch
      e.preventDefault();
      if (btn.setPointerCapture) {
        try { btn.setPointerCapture(e.pointerId); } catch (er) {}
      }
      step();
      holdTO = setTimeout(() => { repeatIV = setInterval(step, 90); }, 350);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
      btn.addEventListener(ev, stop));
    btn.addEventListener("click", (e) => { if (e.detail === 0) step(); }); // keyboard
  }

  bindHold(upBtn, +1);
  bindHold(downBtn, -1);
  callBtn.addEventListener("click", startCall);
  memBtn.addEventListener("click", toggleMem);

  // Frequency field: type it directly, tune with ↑/↓, Enter dials.
  freqEl.addEventListener("focus", () => freqEl.select());
  freqEl.addEventListener("input", () => {
    // keep only digits and a single dot
    let s = freqEl.value.replace(/[^\d.]/g, "");
    const dot = s.indexOf(".");
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    if (s !== freqEl.value) freqEl.value = s;
  });
  freqEl.addEventListener("blur", commitFreqInput);
  freqEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); commitFreqInput(); changeFreq(+1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); commitFreqInput(); changeFreq(-1); }
    else if (e.key === "Enter") { e.preventDefault(); commitFreqInput(); startCall(); }
  });

  // Escape closes the MEMORY list, or hangs up from any active state.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!memList.hidden) closeMem();
    else if (state !== "idle") resetToIdle();
  });

  /* -------------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------------- */
  buildMemList();
  renderFreq();
  setDialog(""); // idle: empty dialog box with a blinking caret
  setState("idle");
})();
