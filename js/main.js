/* =============================================================================
   SHADOW MOSES · Fan Film — Interactivity (vanilla JavaScript)
   -----------------------------------------------------------------------------
   Included features:
     1. Live HUD clock
     2. "Typed" text effect on key headings/dialogs
     3. Smooth section reveal on scroll (IntersectionObserver)
     4. Alert "!" micro-interaction (flash when reaching the gallery)
     5. Gallery lightbox (open, close, keyboard)
   Everything respects prefers-reduced-motion: if enabled, the typing, the
   alert flash and the more aggressive animations are disabled.
   ============================================================================= */

(function () {
  "use strict";

  // Does the user request reduced motion? We check the media query only once.
  const REDUCED_MOTION = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  /* -------------------------------------------------------------------------
     1. LIVE HUD CLOCK
     Updates any #hud-clock element with the time in 24h format.
     ------------------------------------------------------------------------- */
  function initClock() {
    const clock = document.getElementById("hud-clock");
    if (!clock) return;

    const update = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      clock.textContent = `${hh}:${mm}:${ss}`;
    };

    update();
    setInterval(update, 1000);
  }

  /* -------------------------------------------------------------------------
     2. "TYPED" TEXT EFFECT
     Any element with [data-typed] writes its content letter by letter.
     With prefers-reduced-motion the full text is shown instantly.
     The text comes from the attribute (already un-escaped by the browser).
     ------------------------------------------------------------------------- */
  function typeText(el, text, speed) {
    return new Promise((resolve) => {
      el.textContent = "";

      // Blinking cursor at the end while typing
      const cursor = document.createElement("span");
      cursor.className = "cursor";
      cursor.textContent = "_";
      el.appendChild(cursor);

      let i = 0;
      const tick = () => {
        if (i < text.length) {
          // We insert the character before the cursor
          cursor.insertAdjacentText("beforebegin", text.charAt(i));
          i++;
          setTimeout(tick, speed);
        } else {
          resolve();
        }
      };
      tick();
    });
  }

  function initTyping() {
    const targets = document.querySelectorAll("[data-typed]");

    targets.forEach((el) => {
      const text = el.getAttribute("data-typed") || el.textContent.trim();

      if (REDUCED_MOTION) {
        // No animation: we leave the text as is, readable from the start.
        el.textContent = text;
        return;
      }
      // We start with the element empty and type it out.
      typeText(el, text, 45);
    });
  }

  /* -------------------------------------------------------------------------
     3. SMOOTH REVEAL ON SCROLL
     Adds the .is-visible class to .reveal elements when they enter the viewport.
     ------------------------------------------------------------------------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    // Without IntersectionObserver or with reduced motion: show everything now.
    if (REDUCED_MOTION || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target); // only once
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    items.forEach((el) => observer.observe(el));
  }

  /* -------------------------------------------------------------------------
     4. ALERT "!" MICRO-INTERACTION
     When the key section (the gallery) enters the screen for the first time,
     the characteristic "!" box flashes. No sound, so it doesn't disturb.
     ------------------------------------------------------------------------- */
  function initAlert() {
    const flash = document.getElementById("alert-flash");
    if (!flash || REDUCED_MOTION) return;

    // Reusable: triggers the flash and clears it when the animation ends.
    const triggerFlash = () => {
      flash.classList.remove("is-active");
      // Force a reflow so the animation can restart if repeated.
      void flash.offsetWidth;
      flash.classList.add("is-active");
    };

    // In proyecto.html: when reaching the gallery.
    const key = document.getElementById("galeria");
    if (key && "IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              triggerFlash();
              obs.unobserve(entry.target); // only the first time
            }
          });
        },
        { threshold: 0.4 },
      );
      obs.observe(key);
    }

    // On the landing: hovering over the mission button gives a "!" wink.
    const cta = document.querySelector(".hero .btn");
    if (cta) {
      let armed = true;
      cta.addEventListener("mouseenter", () => {
        if (!armed) return;
        armed = false;
        triggerFlash();
        // Re-arm after a few seconds so it doesn't saturate.
        setTimeout(() => (armed = true), 5000);
      });
    }
  }

  /* -------------------------------------------------------------------------
     5. GALLERY LIGHTBOX
     Opens the image full-screen. Closes with the X, with a click on the
     background or with the Escape key. Manages focus for accessibility.
     ------------------------------------------------------------------------- */
  function initLightbox() {
    const gallery = document.getElementById("gallery");
    const lightbox = document.getElementById("lightbox");
    if (!gallery || !lightbox) return;

    const imgEl = document.getElementById("lightbox-img");
    const captionEl = document.getElementById("lightbox-caption");
    const closeBtn = document.getElementById("lightbox-close");
    let lastFocused = null; // to return focus on close

    const open = (src, caption, alt) => {
      imgEl.src = src;
      imgEl.alt = alt || caption || "Enlarged image";
      captionEl.textContent = caption || "";
      lightbox.classList.add("is-open");
      document.body.style.overflow = "hidden"; // blocks background scroll
      lastFocused = document.activeElement;
      closeBtn.focus();
    };

    const close = () => {
      lightbox.classList.remove("is-open");
      document.body.style.overflow = "";
      imgEl.src = "";
      if (lastFocused) lastFocused.focus(); // returns focus to the trigger
    };

    // Event delegation: a single listener for the whole gallery.
    gallery.addEventListener("click", (e) => {
      const item = e.target.closest(".gallery__item");
      if (!item) return;
      const full = item.getAttribute("data-full");
      const caption = item.getAttribute("data-caption");
      const alt = item.querySelector("img")
        ? item.querySelector("img").alt
        : "";
      if (full) open(full, caption, alt);
    });

    closeBtn.addEventListener("click", close);

    // Clicking the background (outside the figure) closes the viewer.
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });

    // Escape closes the viewer.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightbox.classList.contains("is-open")) close();
    });
  }

  /* -------------------------------------------------------------------------
     6. CODEC TRANSITION (landing intro overlay)
     Click on "ENTER MISSION" -> opens the CODEC overlay and starts the voice
     (assets/audio/snake-intro.mp3) -> subtitles synced with the audio
     -> when the voice ends ('ended') or SKIP is pressed -> redirects to proyecto.html.
     The audio can ONLY play after the click (browsers block autoplay).
     If the mp3 fails to load/play, it falls back to a backup timer so the
     flow never gets stuck.
     ------------------------------------------------------------------------- */
  function initCodecTransition() {
    const overlay = document.getElementById("codec-overlay");
    if (!overlay) return; // only exists on the landing page

    /* ===========================================================
       SUBTITLE SCRIPT — EDIT HERE.
       't' = start second of each line. Timings calibrated with the
       per-word timestamps from snake-intro_eng.json (each 't' is the
       start of the first spoken word of that phrase).
       =========================================================== */
    const SCRIPT = [
      { t: 0.26, txt: "Colonel... I'm in." },              // "Colonel," 0.258
      { t: 1.98, txt: "It's quiet. Too quiet." },          // "It's" 1.979
      { t: 4.34, txt: "What you're about to witness isn't real footage —" }, // "What" 4.338
      { t: 7.56, txt: "it was generated, frame by frame, by AI." },          // "was" 7.558
      { t: 11.3, txt: "A tribute to a mission we never forgot." },           // "tribute" 11.298
      { t: 13.58, txt: "Kept you waiting, huh?" },         // "Kept" 13.579
      { t: 15.12, txt: "Let's move." },                    // "Let's" 15.119
    ];
    // Fallback duration (s) if the audio provides no metadata: the real
    // audio ends at ~15.7 s (end_time of the segment in the JSON).
    const DURATION = 15.7;

    // --- DOM references ---
    const trigger = document.querySelector(".hero .btn"); // ENTER MISSION button
    const statusEl = document.getElementById("codec-status");
    const waveEl = document.getElementById("codec-wave");
    const subEl = document.getElementById("codec-subtext");
    const barEl = document.getElementById("codec-bar");
    const skipBtn = document.getElementById("codec-skip");
    const muteBtn = document.getElementById("codec-mute");
    const voice = document.getElementById("codec-voice");
    const snakeFace = document.getElementById("codec-face-snake");

    // --- State ---
    let muted = false;
    let rafWave = 0;
    let rafTimer = 0;
    let lastLine = -1;
    let lineTimer = 0;
    let safetyTimer = 0;
    let finished = false;
    let timerStarted = false;
    let startTs = 0;
    let actx = null;

    // --- Audio wave: bars created only once ---
    const BAR_COUNT = 28;
    for (let i = 0; i < BAR_COUNT; i++)
      waveEl.appendChild(document.createElement("span"));
    const bars = Array.from(waveEl.children);

    function animateWave(active) {
      cancelAnimationFrame(rafWave);
      const loop = () => {
        bars.forEach((b) => {
          const h = active && !REDUCED_MOTION ? 4 + Math.random() * 30 : 4;
          b.style.height = h + "px";
          b.style.opacity = active ? "0.9" : "0.35";
        });
        rafWave = requestAnimationFrame(loop);
      };
      loop();
    }

    // "Typed" subtitle (instant if reduced motion)
    function typeLine(text) {
      subEl.textContent = "";
      if (REDUCED_MOTION) {
        subEl.textContent = text;
        return;
      }
      let i = 0;
      clearInterval(lineTimer);
      lineTimer = setInterval(() => {
        subEl.textContent = text.slice(0, ++i);
        if (i >= text.length) clearInterval(lineTimer);
      }, 28);
    }

    // Connection beep with the Web Audio API (no extra file)
    function beep(freq, dur) {
      if (muted) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = "square";
        o.frequency.value = freq;
        o.connect(g);
        g.connect(actx.destination);
        g.gain.setValueAtTime(0.05, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
        o.start();
        o.stop(actx.currentTime + dur);
      } catch (e) {
        /* Web Audio not available: we ignore it */
      }
    }

    // Syncs the active subtitle + the progress bar based on time t
    function runTimeline(t, dur) {
      let idx = -1;
      for (let i = 0; i < SCRIPT.length; i++) if (t >= SCRIPT[i].t) idx = i;
      if (idx !== lastLine && idx >= 0) {
        lastLine = idx;
        typeLine(SCRIPT[idx].txt);
      }
      barEl.style.right = Math.max(0, 100 - (t / dur) * 100) + "%";
    }

    // Timer fallback if the audio doesn't load/play
    function runTimerFallback() {
      if (timerStarted || finished) return; // don't start twice
      timerStarted = true;
      startTs = performance.now();
      const tick = () => {
        const t = (performance.now() - startTs) / 1000;
        runTimeline(t, DURATION);
        if (t < DURATION) rafTimer = requestAnimationFrame(tick);
        else finish();
      };
      rafTimer = requestAnimationFrame(tick);
    }

    // Re-arms the "safety": if 'ended' never fires, we force the ending.
    // Uses the real audio duration when it's already available.
    function armSafety() {
      clearTimeout(safetyTimer);
      const dur =
        isFinite(voice.duration) && voice.duration > 0
          ? voice.duration
          : DURATION;
      safetyTimer = setTimeout(finish, (dur + 3) * 1000);
    }

    // End of the transmission: stops everything and REDIRECTS to the project
    function finish() {
      if (finished) return; // prevents double redirects
      finished = true;
      cancelAnimationFrame(rafWave);
      cancelAnimationFrame(rafTimer);
      clearInterval(lineTimer);
      clearTimeout(safetyTimer);
      try {
        voice.pause();
      } catch (e) {}
      snakeFace.classList.remove("is-talking");
      overlay.classList.add("is-closing"); // fade to black
      // Signal for proyecto.html: we come from the intro (the user already
      // interacted by pressing ENTER MISSION), so the music can start
      // automatically there without waiting for another interaction.
      try {
        sessionStorage.setItem("sm_autoplay", "1");
      } catch (e) {}
      // ▼▼▼ REDIRECT TO THE PROJECT PAGE (end of the CODEC intro) ▼▼▼
      // Brief delay so the fade is visible before changing pages.
      setTimeout(() => {
        window.location.href = "proyecto.html";
      }, 600);
    }

    // Shows the CODEC (connection ambience: beeps, status, wave). It does not
    // start the voice yet, so it can be delayed and not overlap other audio.
    function showCodec() {
      overlay.hidden = false;
      document.body.style.overflow = "hidden"; // blocks background scroll
      skipBtn.focus(); // focus on the main control

      // Double connection beep
      beep(660, 0.08);
      setTimeout(() => beep(660, 0.08), 140);
      // CALLING... -> CONNECTED
      setTimeout(() => {
        statusEl.textContent = "CONNECTED";
      }, 700);

      animateWave(true);
    }

    // Starts the VOICE (snake-intro): portrait talking, subtitles and redirect.
    function startVoice() {
      snakeFace.classList.add("is-talking"); // Snake starts to "talk"
      voice.muted = muted;
      try {
        voice.currentTime = 0;
      } catch (e) {}
      // Subtitles synced with the real time of the audio
      voice.ontimeupdate = () =>
        runTimeline(voice.currentTime, voice.duration || DURATION);
      voice.onended = finish; // when the voice ends -> redirect
      voice.onerror = runTimerFallback; // if the file fails -> fallback
      voice.onloadedmetadata = armSafety; // re-arm the safety with the real duration

      const playPromise = voice.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(() => runTimerFallback());
      }
      armSafety(); // initial safety (re-armed with the real metadata)
    }

    // Full sequence (used if entering without going through the call screen)
    function startCodec() {
      showCodec();
      startVoice();
    }

    // --- INCOMING CALL SCREEN (step before the CODEC) ---
    const callOverlay = document.getElementById("call-overlay");
    const ring = document.getElementById("call-ring");   // looping ring tone
    const answer = document.getElementById("call-answer"); // answer sound
    let answered = false;

    // Opens the "CALL" screen and starts the looping ring tone (the click on
    // ENTER MISSION is the gesture that unlocks the audio).
    function openCall() {
      if (!callOverlay) { startCodec(); return; } // no screen: straight to the CODEC
      answered = false;
      callOverlay.hidden = false;
      document.body.style.overflow = "hidden"; // blocks background scroll
      callOverlay.setAttribute("tabindex", "0");
      callOverlay.focus();
      if (ring) {
        ring.muted = muted;
        try { ring.currentTime = 0; } catch (e) {}
        ring.play().catch(() => {}); // if it fails, the tone simply doesn't play
      }
    }

    // Answer: cuts the tone, plays codec-answer.mp3 and, when it ends,
    // starts the CODEC transmission (which already plays the voice).
    function answerCall() {
      if (answered) return; // prevents double answers
      answered = true;
      if (ring) ring.pause();

      // Answer sound (plays over the top during the fade).
      if (answer) {
        answer.muted = muted;
        try { answer.currentTime = 0; } catch (e) {}
        answer.play().catch(() => {});
      }

      // We show the CODEC (connection ambience) now, underneath, and fade the
      // call screen to reveal it (a smooth crossfade by opacity).
      showCodec();
      if (callOverlay) {
        callOverlay.classList.add("is-answering");
        const hide = () => {
          callOverlay.hidden = true;
          callOverlay.classList.remove("is-answering");
        };
        callOverlay.addEventListener("transitionend", hide, { once: true });
        setTimeout(hide, 700); // fallback in case transitionend doesn't fire
      }

      // The VOICE starts 1 second after answering (once the answer sound has
      // been heard), without waiting for it to finish completely.
      let voiceStarted = false;
      const beginVoice = () => {
        if (voiceStarted || finished) return;
        voiceStarted = true;
        startVoice();
      };
      setTimeout(beginVoice, 1000);
    }

    // --- Listeners ---
    if (trigger) {
      trigger.addEventListener("click", (e) => {
        e.preventDefault(); // we don't navigate directly: we open the call
        openCall();
      });
    }
    // The whole call screen answers (click or Enter/Space)
    if (callOverlay) {
      callOverlay.addEventListener("click", answerCall);
      callOverlay.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); answerCall(); }
      });
    }
    skipBtn.addEventListener("click", finish);
    // Esc also skips the transmission
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden && !finished) finish();
    });
    // Persistent mute with accessible state (aria-pressed)
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      voice.muted = muted;
      muteBtn.setAttribute("aria-pressed", String(muted));
      muteBtn.textContent = muted ? "🔇 SOUND: OFF" : "🔊 SOUND: ON";
    });
  }

  /* -------------------------------------------------------------------------
     7. BACKGROUND MUSIC (proyecto.html only)
     The track starts 2 s after loading. Controls: play/pause, stop
     (stops + rewinds) and mute. Browsers block autoplay with sound until
     the user interacts; if it's blocked, the music starts on the user's
     first gesture (click/key), as a fallback.
     ------------------------------------------------------------------------- */
  function initBackgroundMusic() {
    const audio = document.getElementById("bg-music");
    if (!audio) return; // only exists on proyecto.html

    // Desktop-only: on mobile/touch (<= 560px, same breakpoint as the CSS that
    // hides the player) we don't play the track nor wire up any controls.
    if (window.matchMedia("(max-width: 560px)").matches) return;

    const toggleBtn = document.getElementById("bg-toggle");
    const stopBtn = document.getElementById("bg-stop");
    const muteBtn = document.getElementById("bg-mute");

    audio.volume = 0.4; // comfortable background level (doesn't cover the reading)

    // Are we coming from the CODEC intro? If so, the user already interacted on
    // the landing, so the browser usually allows automatic playback.
    // We consume the signal (it's used only once).
    let fromIntro = false;
    try {
      fromIntro = sessionStorage.getItem("sm_autoplay") === "1";
      sessionStorage.removeItem("sm_autoplay");
    } catch (e) {}

    // Tries to play; returns a promise that resolves to true/false
    // depending on whether the browser allowed playback or not.
    const tryPlay = () => {
      const p = audio.play();
      if (p && typeof p.then === "function") {
        return p.then(() => true).catch(() => false);
      }
      return Promise.resolve(true);
    };

    // Robust autoplay: browsers block audible playback after a navigation
    // (the gesture from the intro doesn't carry over). So if the audible
    // attempt is rejected, we start MUTED — always allowed — and immediately
    // unmute: an element that is already playing stays audible without a
    // fresh gesture. Resolves true if playback ended up running.
    const startPlayback = () =>
      tryPlay().then((ok) => {
        if (ok) return true;
        audio.muted = true;
        return tryPlay().then((ok2) => {
          audio.muted = false; // reveal the sound (or reflect the block)
          syncMute();
          return ok2;
        });
      });

    // Keeps the play/pause icon in sync with the real state of the audio
    const syncToggle = () => {
      const playing = !audio.paused;
      toggleBtn.textContent = playing ? "❚❚" : "▶";
      toggleBtn.setAttribute("aria-label", playing ? "Pause music" : "Play music");
      toggleBtn.classList.toggle("is-active", playing);
    };

    // --- START after 2 seconds (the delay is always respected) ---
    setTimeout(() => {
      // Arms the start on the first click/key (only once).
      let armed = false;
      const armFirstGesture = () => {
        if (armed) return;
        armed = true;
        const kickstart = () => tryPlay();
        window.addEventListener("pointerdown", kickstart, { once: true });
        window.addEventListener("keydown", kickstart, { once: true });
      };
      // Coming from the intro: force the autoplay (audible, else muted-then-
      // unmute). Direct visit: a plain attempt, which browsers usually block.
      // Either way, if nothing starts we arm the user's first gesture.
      const attempt = fromIntro ? startPlayback : tryPlay;
      attempt().then((ok) => {
        if (!ok) armFirstGesture();
      });
      // On a direct visit (without going through the intro) autoplay with sound
      // is almost always blocked: we arm the start on the first gesture already.
      if (!fromIntro) armFirstGesture();
    }, 2000);

    // --- Controls ---
    // Play / Pause
    toggleBtn.addEventListener("click", () => {
      if (audio.paused) tryPlay();
      else audio.pause();
    });
    // Stop: pauses and returns to the start of the track
    stopBtn.addEventListener("click", () => {
      audio.pause();
      audio.currentTime = 0;
    });
    // Reflects the mute state on the mute button (icon + accessibility)
    const syncMute = () => {
      muteBtn.setAttribute("aria-pressed", String(audio.muted));
      muteBtn.textContent = audio.muted ? "🔇" : "🔊";
      muteBtn.setAttribute("aria-label", audio.muted ? "Unmute music" : "Mute music");
      muteBtn.classList.toggle("is-active", audio.muted);
    };
    // Mute (toggles)
    muteBtn.addEventListener("click", () => {
      audio.muted = !audio.muted;
      syncMute();
    });

    // Volume control: moves audio.volume (0–1) based on the slider (0–100).
    const volume = document.getElementById("bg-volume");
    if (volume) {
      volume.addEventListener("input", () => {
        audio.volume = volume.value / 100;
        // If they raise the volume while muted, we remove the mute.
        if (audio.volume > 0 && audio.muted) {
          audio.muted = false;
          syncMute();
        }
      });
    }

    // The play/pause icon reacts to any change in the audio state
    audio.addEventListener("play", syncToggle);
    audio.addEventListener("pause", syncToggle);
    syncToggle();
  }

  /* -------------------------------------------------------------------------
     STARTUP
     ------------------------------------------------------------------------- */
  function init() {
    initClock();
    initTyping();
    initReveal();
    initAlert();
    initLightbox();
    initCodecTransition();
    initBackgroundMusic();
  }

  // defer guarantees the DOM is ready, but we check just in case.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
