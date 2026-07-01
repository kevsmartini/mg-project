/* =============================================================================
   SHADOW MOSES · Fan Film — Interactividad (JavaScript vanilla)
   -----------------------------------------------------------------------------
   Funciones incluidas:
     1. Reloj HUD en vivo
     2. Efecto de texto "tecleado" en titulares/diálogos clave
     3. Aparición suave de secciones al hacer scroll (IntersectionObserver)
     4. Micro-interacción del "!" de alerta (flash al llegar a la galería)
     5. Lightbox de la galería (abrir, cerrar, teclado)
   Todo respeta prefers-reduced-motion: si está activo, se desactivan el
   tecleo, el flash de alerta y las animaciones agresivas.
   ============================================================================= */

(function () {
  "use strict";

  // ¿El usuario pide menos movimiento? Consultamos la media query una sola vez.
  const REDUCED_MOTION = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  /* -------------------------------------------------------------------------
     1. RELOJ HUD EN VIVO
     Actualiza cualquier elemento #hud-clock con la hora en formato 24h.
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
     2. EFECTO DE TEXTO "TECLEADO"
     Cualquier elemento con [data-typed] escribe su contenido letra a letra.
     Con prefers-reduced-motion se muestra el texto completo al instante.
     El texto viene del atributo (ya des-escapado por el navegador).
     ------------------------------------------------------------------------- */
  function typeText(el, text, speed) {
    return new Promise((resolve) => {
      el.textContent = "";

      // Cursor parpadeante al final mientras escribe
      const cursor = document.createElement("span");
      cursor.className = "cursor";
      cursor.textContent = "_";
      el.appendChild(cursor);

      let i = 0;
      const tick = () => {
        if (i < text.length) {
          // Insertamos el carácter antes del cursor
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
        // Sin animación: dejamos el texto tal cual, legible desde el inicio.
        el.textContent = text;
        return;
      }
      // Empezamos con el elemento vacío y tecleamos.
      typeText(el, text, 45);
    });
  }

  /* -------------------------------------------------------------------------
     3. APARICIÓN SUAVE AL HACER SCROLL
     Añade la clase .is-visible a los .reveal cuando entran en el viewport.
     ------------------------------------------------------------------------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    // Sin IntersectionObserver o con movimiento reducido: mostramos todo ya.
    if (REDUCED_MOTION || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target); // una sola vez
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    items.forEach((el) => observer.observe(el));
  }

  /* -------------------------------------------------------------------------
     4. MICRO-INTERACCIÓN DEL "!" DE ALERTA
     Cuando la sección clave (la galería) entra en pantalla por primera vez,
     parpadea la caja "!" característica. Sin sonido, para no molestar.
     ------------------------------------------------------------------------- */
  function initAlert() {
    const flash = document.getElementById("alert-flash");
    if (!flash || REDUCED_MOTION) return;

    // Reutilizable: dispara el flash y lo limpia al terminar la animación.
    const triggerFlash = () => {
      flash.classList.remove("is-active");
      // Forzamos reflow para poder reiniciar la animación si se repite.
      void flash.offsetWidth;
      flash.classList.add("is-active");
    };

    // En proyecto.html: al llegar a la galería.
    const key = document.getElementById("galeria");
    if (key && "IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              triggerFlash();
              obs.unobserve(entry.target); // solo la primera vez
            }
          });
        },
        { threshold: 0.4 },
      );
      obs.observe(key);
    }

    // En la landing: al pasar el ratón por el botón de misión, un guiño "!".
    const cta = document.querySelector(".hero .btn");
    if (cta) {
      let armed = true;
      cta.addEventListener("mouseenter", () => {
        if (!armed) return;
        armed = false;
        triggerFlash();
        // Rearmamos tras unos segundos para que no sature.
        setTimeout(() => (armed = true), 5000);
      });
    }
  }

  /* -------------------------------------------------------------------------
     5. LIGHTBOX DE LA GALERÍA
     Abre la imagen a pantalla completa. Cierra con la X, con clic en el
     fondo o con la tecla Escape. Gestiona el foco por accesibilidad.
     ------------------------------------------------------------------------- */
  function initLightbox() {
    const gallery = document.getElementById("gallery");
    const lightbox = document.getElementById("lightbox");
    if (!gallery || !lightbox) return;

    const imgEl = document.getElementById("lightbox-img");
    const captionEl = document.getElementById("lightbox-caption");
    const closeBtn = document.getElementById("lightbox-close");
    let lastFocused = null; // para devolver el foco al cerrar

    const open = (src, caption, alt) => {
      imgEl.src = src;
      imgEl.alt = alt || caption || "Imagen ampliada";
      captionEl.textContent = caption || "";
      lightbox.classList.add("is-open");
      document.body.style.overflow = "hidden"; // bloquea scroll de fondo
      lastFocused = document.activeElement;
      closeBtn.focus();
    };

    const close = () => {
      lightbox.classList.remove("is-open");
      document.body.style.overflow = "";
      imgEl.src = "";
      if (lastFocused) lastFocused.focus(); // devuelve el foco al disparador
    };

    // Delegación de eventos: un único listener para toda la galería.
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

    // Clic en el fondo (fuera de la figura) cierra el visor.
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });

    // Escape cierra el visor.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightbox.classList.contains("is-open")) close();
    });
  }

  /* -------------------------------------------------------------------------
     6. TRANSICIÓN CODEC (overlay de intro de la landing)
     Clic en "ENTER MISSION" -> abre el overlay CODEC y arranca la voz
     (assets/audio/snake-intro.mp3) -> subtítulos sincronizados con el audio
     -> al terminar la voz ('ended') o pulsar SKIP -> redirige a proyecto.html.
     El audio SOLO puede sonar tras el clic (los navegadores bloquean autoplay).
     Si el mp3 no carga/reproduce, cae a un temporizador de respaldo para que
     el flujo nunca se quede colgado.
     ------------------------------------------------------------------------- */
  function initCodecTransition() {
    const overlay = document.getElementById("codec-overlay");
    if (!overlay) return; // solo existe en la landing

    /* ===========================================================
       GUION DE SUBTÍTULOS — EDITA AQUÍ.
       't' = segundo de inicio de cada línea. Tiempos calibrados con
       los timestamps por palabra de snake-intro_eng.json (cada 't'
       es el inicio de la primera palabra hablada de esa frase).
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
    // Duración de respaldo (s) si el audio no aporta metadatos: el audio
    // real termina en ~15.7 s (end_time del segmento en el JSON).
    const DURATION = 15.7;

    // --- Referencias del DOM ---
    const trigger = document.querySelector(".hero .btn"); // botón ENTER MISSION
    const statusEl = document.getElementById("codec-status");
    const waveEl = document.getElementById("codec-wave");
    const subEl = document.getElementById("codec-subtext");
    const barEl = document.getElementById("codec-bar");
    const skipBtn = document.getElementById("codec-skip");
    const muteBtn = document.getElementById("codec-mute");
    const voice = document.getElementById("codec-voice");
    const snakeFace = document.getElementById("codec-face-snake");

    // --- Estado ---
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

    // --- Onda de audio: barras creadas una sola vez ---
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

    // Subtítulo "tecleado" (instantáneo si hay movimiento reducido)
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

    // Beep de conexión con Web Audio API (sin archivo extra)
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
        /* Web Audio no disponible: lo ignoramos */
      }
    }

    // Sincroniza el subtítulo activo + la barra de progreso según el tiempo t
    function runTimeline(t, dur) {
      let idx = -1;
      for (let i = 0; i < SCRIPT.length; i++) if (t >= SCRIPT[i].t) idx = i;
      if (idx !== lastLine && idx >= 0) {
        lastLine = idx;
        typeLine(SCRIPT[idx].txt);
      }
      barEl.style.right = Math.max(0, 100 - (t / dur) * 100) + "%";
    }

    // Respaldo por temporizador si el audio no carga/reproduce
    function runTimerFallback() {
      if (timerStarted || finished) return; // no arrancar dos veces
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

    // Re-arma el "seguro": si 'ended' nunca dispara, forzamos el final.
    // Usa la duración real del audio cuando ya está disponible.
    function armSafety() {
      clearTimeout(safetyTimer);
      const dur =
        isFinite(voice.duration) && voice.duration > 0
          ? voice.duration
          : DURATION;
      safetyTimer = setTimeout(finish, (dur + 3) * 1000);
    }

    // Fin de la transmisión: para todo y REDIRIGE al proyecto
    function finish() {
      if (finished) return; // evita redirecciones dobles
      finished = true;
      cancelAnimationFrame(rafWave);
      cancelAnimationFrame(rafTimer);
      clearInterval(lineTimer);
      clearTimeout(safetyTimer);
      try {
        voice.pause();
      } catch (e) {}
      snakeFace.classList.remove("is-talking");
      overlay.classList.add("is-closing"); // fundido a negro
      // Señal para proyecto.html: venimos de la intro (el usuario ya
      // interactuó al pulsar ENTER MISSION), así la música puede arrancar
      // automáticamente allí sin esperar otra interacción.
      try {
        sessionStorage.setItem("sm_autoplay", "1");
      } catch (e) {}
      // ▼▼▼ REDIRECCIÓN A LA PÁGINA DEL PROYECTO (fin de la intro CODEC) ▼▼▼
      // Retardo breve para que se vea el fundido antes de cambiar de página.
      setTimeout(() => {
        window.location.href = "proyecto.html";
      }, 600);
    }

    // Muestra el CODEC (ambiente de conexión: beeps, estado, onda). No arranca
    // la voz todavía, para poder retrasarla y que no se solape con otros audios.
    function showCodec() {
      overlay.hidden = false;
      document.body.style.overflow = "hidden"; // bloquea scroll de fondo
      skipBtn.focus(); // foco al control principal

      // Beep doble de conexión
      beep(660, 0.08);
      setTimeout(() => beep(660, 0.08), 140);
      // CALLING... -> CONNECTED
      setTimeout(() => {
        statusEl.textContent = "CONNECTED";
      }, 700);

      animateWave(true);
    }

    // Arranca la VOZ (snake-intro): retrato hablando, subtítulos y redirección.
    function startVoice() {
      snakeFace.classList.add("is-talking"); // Snake empieza a "hablar"
      voice.muted = muted;
      try {
        voice.currentTime = 0;
      } catch (e) {}
      // Subtítulos sincronizados con el tiempo real del audio
      voice.ontimeupdate = () =>
        runTimeline(voice.currentTime, voice.duration || DURATION);
      voice.onended = finish; // al terminar la voz -> redirige
      voice.onerror = runTimerFallback; // si el archivo falla -> respaldo
      voice.onloadedmetadata = armSafety; // re-arma el seguro con la duración real

      const playPromise = voice.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(() => runTimerFallback());
      }
      armSafety(); // seguro inicial (se re-arma con la metadata real)
    }

    // Secuencia completa (usada si se entra sin pasar por la pantalla de llamada)
    function startCodec() {
      showCodec();
      startVoice();
    }

    // --- PANTALLA DE LLAMADA ENTRANTE (paso previo al CODEC) ---
    const callOverlay = document.getElementById("call-overlay");
    const ring = document.getElementById("call-ring");   // tono en bucle
    const answer = document.getElementById("call-answer"); // sonido al responder
    let answered = false;

    // Abre la pantalla "CALL" y arranca el tono en bucle (el clic en ENTER
    // MISSION es el gesto que desbloquea el audio).
    function openCall() {
      if (!callOverlay) { startCodec(); return; } // sin pantalla: directo al CODEC
      answered = false;
      callOverlay.hidden = false;
      document.body.style.overflow = "hidden"; // bloquea scroll de fondo
      callOverlay.setAttribute("tabindex", "0");
      callOverlay.focus();
      if (ring) {
        ring.muted = muted;
        try { ring.currentTime = 0; } catch (e) {}
        ring.play().catch(() => {}); // si falla, el tono simplemente no suena
      }
    }

    // Responder: corta el tono, suena codec-answer.mp3 y, al terminar,
    // arranca la transmisión CODEC (que ya reproduce la voz).
    function answerCall() {
      if (answered) return; // evita respuestas dobles
      answered = true;
      if (ring) ring.pause();

      // Sonido de respuesta (suena por encima durante el fundido).
      if (answer) {
        answer.muted = muted;
        try { answer.currentTime = 0; } catch (e) {}
        answer.play().catch(() => {});
      }

      // Mostramos el CODEC (ambiente de conexión) ya, debajo, y fundimos la
      // pantalla de llamada para descubrirlo (crossfade suave por opacidad).
      showCodec();
      if (callOverlay) {
        callOverlay.classList.add("is-answering");
        const hide = () => {
          callOverlay.hidden = true;
          callOverlay.classList.remove("is-answering");
        };
        callOverlay.addEventListener("transitionend", hide, { once: true });
        setTimeout(hide, 700); // respaldo por si transitionend no dispara
      }

      // La VOZ arranca 1 segundo después de responder (tras oírse el sonido
      // de respuesta), sin esperar a que termine del todo.
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
        e.preventDefault(); // no navegamos directo: abrimos la llamada
        openCall();
      });
    }
    // Toda la pantalla de llamada responde (clic o Enter/Espacio)
    if (callOverlay) {
      callOverlay.addEventListener("click", answerCall);
      callOverlay.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); answerCall(); }
      });
    }
    skipBtn.addEventListener("click", finish);
    // Esc también salta la transmisión
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden && !finished) finish();
    });
    // Mute persistente con estado accesible (aria-pressed)
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      voice.muted = muted;
      muteBtn.setAttribute("aria-pressed", String(muted));
      muteBtn.textContent = muted ? "🔇 SOUND: OFF" : "🔊 SOUND: ON";
    });
  }

  /* -------------------------------------------------------------------------
     7. MÚSICA DE FONDO (solo proyecto.html)
     La pista arranca 2 s después de cargar. Controles: play/pausa, stop
     (detiene + rebobina) y mute. Los navegadores bloquean el autoplay con
     sonido hasta que el usuario interactúa; si se bloquea, la música arranca
     en el primer gesto del usuario (clic/tecla), como respaldo.
     ------------------------------------------------------------------------- */
  function initBackgroundMusic() {
    const audio = document.getElementById("bg-music");
    if (!audio) return; // solo existe en proyecto.html

    const toggleBtn = document.getElementById("bg-toggle");
    const stopBtn = document.getElementById("bg-stop");
    const muteBtn = document.getElementById("bg-mute");

    audio.volume = 0.4; // nivel de fondo cómodo (no tapa la lectura)

    // ¿Venimos de la intro CODEC? Si es así, el usuario ya interactuó en la
    // landing, así que el navegador suele permitir la reproducción automática.
    // Consumimos la señal (se usa una sola vez).
    let fromIntro = false;
    try {
      fromIntro = sessionStorage.getItem("sm_autoplay") === "1";
      sessionStorage.removeItem("sm_autoplay");
    } catch (e) {}

    // Intenta reproducir; devuelve una promesa que resuelve a true/false
    // según si el navegador permitió o no la reproducción.
    const tryPlay = () => {
      const p = audio.play();
      if (p && typeof p.then === "function") {
        return p.then(() => true).catch(() => false);
      }
      return Promise.resolve(true);
    };

    // Mantiene el icono play/pausa sincronizado con el estado real del audio
    const syncToggle = () => {
      const playing = !audio.paused;
      toggleBtn.textContent = playing ? "❚❚" : "▶";
      toggleBtn.setAttribute("aria-label", playing ? "Pausar música" : "Reproducir música");
      toggleBtn.classList.toggle("is-active", playing);
    };

    // --- ARRANQUE a los 2 segundos (siempre se respeta el retardo) ---
    setTimeout(() => {
      // Deja armado el arranque en el primer clic/tecla (una sola vez).
      let armed = false;
      const armFirstGesture = () => {
        if (armed) return;
        armed = true;
        const kickstart = () => tryPlay();
        window.addEventListener("pointerdown", kickstart, { once: true });
        window.addEventListener("keydown", kickstart, { once: true });
      };
      // Intentamos reproducir. Si venimos de la intro suele permitirse solo;
      // si el navegador lo bloquea, arrancará al primer gesto del usuario.
      tryPlay().then((ok) => {
        if (!ok) armFirstGesture();
      });
      // En visita directa (sin pasar por la intro) el autoplay con sonido casi
      // siempre está bloqueado: dejamos ya armado el arranque al primer gesto.
      if (!fromIntro) armFirstGesture();
    }, 2000);

    // --- Controles ---
    // Play / Pausa
    toggleBtn.addEventListener("click", () => {
      if (audio.paused) tryPlay();
      else audio.pause();
    });
    // Stop: pausa y vuelve al inicio de la pista
    stopBtn.addEventListener("click", () => {
      audio.pause();
      audio.currentTime = 0;
    });
    // Refleja el estado de silencio en el botón de mute (icono + accesibilidad)
    const syncMute = () => {
      muteBtn.setAttribute("aria-pressed", String(audio.muted));
      muteBtn.textContent = audio.muted ? "🔇" : "🔊";
      muteBtn.setAttribute("aria-label", audio.muted ? "Activar sonido de la música" : "Silenciar música");
      muteBtn.classList.toggle("is-active", audio.muted);
    };
    // Mute (alterna)
    muteBtn.addEventListener("click", () => {
      audio.muted = !audio.muted;
      syncMute();
    });

    // Control de volumen: mueve audio.volume (0–1) según el slider (0–100).
    const volume = document.getElementById("bg-volume");
    if (volume) {
      volume.addEventListener("input", () => {
        audio.volume = volume.value / 100;
        // Si suben el volumen estando silenciado, quitamos el mute.
        if (audio.volume > 0 && audio.muted) {
          audio.muted = false;
          syncMute();
        }
      });
    }

    // El icono play/pausa reacciona a cualquier cambio de estado del audio
    audio.addEventListener("play", syncToggle);
    audio.addEventListener("pause", syncToggle);
    syncToggle();
  }

  /* -------------------------------------------------------------------------
     ARRANQUE
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

  // defer garantiza que el DOM esté listo, pero comprobamos por seguridad.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
