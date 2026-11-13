/**
 * ARZ PORTFOLIO — Interactive layer
 * Made by maher-aladdin.me
 *
 *  1. Header, mobile menu & scroll-spy
 *  2. Hero viewfinder timecode
 *  3. Reveal-on-scroll, counters, clients marquee
 *  4. Scroll-driven skills + center video (with "continue / keep scrolling" choice)
 *  5. Projects & services rendering
 *  6. Deep-linked viewer dialog  (?project=slug  /  ?service=slug)
 *  7. Bot-protected Web3Forms contact form (AJAX, no mail client)
 */
(function () {
  'use strict';

  const DATA = window.AZ_DATA || { PROJECTS: [], SERVICES: [] };
  const THUMBS = window.AZ_THUMBS || {};
  const HAS_THUMB = window.AZ_HAS_THUMB || new Set();
  const WA_NUMBER = '201014673393';
  const BASE_TITLE = document.title;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const isArabic = (s) => /[\u0600-\u06FF]/.test(s || '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

  /* ------------------------------------------------------------------ *
   * 0. Hero entrance animation scene
   * ------------------------------------------------------------------ */
  (function initHeroAnimation() {
    const heroTitle = $('#heroTitle');
    const heroSection = $('.hero');
    if (!heroTitle || !heroSection) return;

    const params = new URLSearchParams(window.location.search);
    const navEntries = performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
    const navType = navEntries.length ? navEntries[0].type : 'navigate';
    const isReloadOrFresh = navType === 'reload' || navType === 'navigate';

    // Always start from the very top with the hero intro on fresh visit or page reload,
    // unless a specific project/service modal deep-link or ?static flag is present.
    if (isReloadOrFresh && !params.has('project') && !params.has('service') && !params.has('static')) {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    // Skip if user prefers reduced motion, or arrived via modal deep link / back-forward scroll
    if (
      reducedMotion ||
      window.scrollY > 80 ||
      window.location.hash ||
      params.has('project') ||
      params.has('service') ||
      params.has('static')
    ) {
      return;
    }

    // 1. Measure natural coordinates before applying any intro classes
    const rect = heroTitle.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // 2. Set intro state: hides surrounding elements cleanly
    document.body.classList.add('hero-intro');

    const naturalCenterX = rect.left + rect.width / 2;
    const naturalCenterY = rect.top + rect.height / 2;
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    const deltaX = Math.round(screenCenterX - naturalCenterX);
    const deltaY = Math.round(screenCenterY - naturalCenterY);

    // Calculate scale: bigger font in the middle, strictly constrained on mobile to prevent overflow
    const isMobile = window.innerWidth <= 900;
    const maxSafeWidth = window.innerWidth - (isMobile ? 32 : 80);
    let targetScale = Math.min(1.36, maxSafeWidth / rect.width);
    if (isMobile) {
      targetScale = Math.min(Math.max(1.02, targetScale), 1.08);
    } else {
      targetScale = Math.min(Math.max(1.15, targetScale), 1.36);
    }

    // Place title at the center in its larger state
    heroTitle.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${targetScale * 0.94})`;
    heroTitle.style.opacity = '0';
    heroTitle.style.filter = 'blur(10px)';
    heroTitle.style.transition = 'none';

    // Force layout reflow
    void heroTitle.offsetWidth;

    // Phase 1: Fade & zoom in at the center
    heroTitle.style.transition = 'opacity 0.45s ease-out, transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), filter 0.45s ease-out';
    heroTitle.style.opacity = '1';
    heroTitle.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${targetScale})`;
    heroTitle.style.filter = 'blur(0)';

    let completed = false;
    let accelerating = false;
    let tAccelDone = null;
    let touchStartY = null;

    function cleanupListeners() {
      window.removeEventListener('wheel', onWheelIntercept, { passive: false });
      window.removeEventListener('touchstart', onTouchStart, { passive: true });
      window.removeEventListener('touchmove', onTouchMoveIntercept, { passive: false });
      window.removeEventListener('keydown', onKeyIntercept, { passive: false });
    }

    function unlockFully() {
      if (completed) return;
      completed = true;
      accelerating = false;
      clearTimeout(tMove);
      clearTimeout(tReveal);
      clearTimeout(tDone);
      clearTimeout(tAccelDone);
      document.body.classList.remove('hero-intro', 'hero-ready', 'hero-fast');
      heroTitle.style.transform = '';
      heroTitle.style.transition = '';
      heroTitle.style.opacity = '';
      heroTitle.style.filter = '';
      cleanupListeners();
    }

    function accelerateIntro() {
      if (completed || accelerating) return;
      accelerating = true;
      clearTimeout(tMove);
      clearTimeout(tReveal);
      clearTimeout(tDone);

      document.body.classList.remove('hero-intro');
      document.body.classList.add('hero-ready', 'hero-fast');

      heroTitle.style.transition = 'transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease, filter 0.25s ease';
      heroTitle.style.transform = 'translate(0, 0) scale(1)';
      heroTitle.style.opacity = '1';
      heroTitle.style.filter = 'none';

      // Keep scroll intercepted for 380ms until 100% of hero elements finish settling, then release smoothly
      tAccelDone = setTimeout(() => {
        unlockFully();
      }, 380);
    }

    function onWheelIntercept(e) {
      if (completed) return;
      if (e.deltaY > 0) {
        e.preventDefault();
        accelerateIntro();
      }
    }

    function onTouchStart(e) {
      if (e.touches && e.touches.length) {
        touchStartY = e.touches[0].clientY;
      }
    }

    function onTouchMoveIntercept(e) {
      if (completed) return;
      if (touchStartY !== null && e.touches && e.touches.length) {
        const dy = touchStartY - e.touches[0].clientY;
        if (dy > 4) {
          if (e.cancelable) e.preventDefault();
          accelerateIntro();
        }
      }
    }

    function onKeyIntercept(e) {
      if (completed) return;
      if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
        accelerateIntro();
      }
    }

    // Intercept downward scroll during intro: accelerate intro to 100% first, then allow scrolling
    window.addEventListener('wheel', onWheelIntercept, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMoveIntercept, { passive: false });
    window.addEventListener('keydown', onKeyIntercept, { passive: false });

    // Phase 2: Hold for ~0.85s, then glide title to its natural place (normal speed if user didn't scroll)
    const tMove = setTimeout(() => {
      if (completed || accelerating) return;
      heroTitle.style.transition = 'transform 0.95s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s ease';
      heroTitle.style.transform = 'translate(0, 0) scale(1)';
    }, 1100);

    // Phase 3: Cascade all other components into view
    const tReveal = setTimeout(() => {
      if (completed || accelerating) return;
      document.body.classList.remove('hero-intro');
      document.body.classList.add('hero-ready');
    }, 1500);

    // Phase 4: Clean up classes and inline styles once 100% complete
    const tDone = setTimeout(() => {
      unlockFully();
    }, 2350);
  })();

  /* ------------------------------------------------------------------ *
   * 1. Header, mobile menu & scroll-spy
   * ------------------------------------------------------------------ */
  const header = $('#siteHeader');
  const navToggle = $('#navToggle');
  const navLinks = $('#navLinks');
  const themeToggle = $('#themeToggle');
  const fab = $('.fab-wa');

  // Theme switcher (Dark / Light mode) with OS preference detection & localStorage override
  (function initTheme() {
    const saved = localStorage.getItem('arz-theme');
    const osLightMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    const initial = (saved === 'light' || saved === 'dark')
      ? saved
      : (osLightMq && osLightMq.matches ? 'light' : 'dark');
    applyTheme(initial);

    if (osLightMq && typeof osLightMq.addEventListener === 'function') {
      osLightMq.addEventListener('change', (e) => {
        if (!localStorage.getItem('arz-theme')) {
          applyTheme(e.matches ? 'light' : 'dark');
        }
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
        const next = cur === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try { localStorage.setItem('arz-theme', next); } catch (_) {}
      });
    }

    function applyTheme(mode) {
      if (mode === 'light') {
        document.documentElement.dataset.theme = 'light';
      } else {
        delete document.documentElement.dataset.theme;
      }
      if (themeToggle) {
        themeToggle.setAttribute('aria-label', mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
        themeToggle.setAttribute('title', mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode');
      }
      const metaTheme = $('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', mode === 'light' ? '#FAF6F0' : '#110E0A');
      }
    }
  })();

  function onScrollChrome() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 24);
    fab.classList.toggle('is-visible', y > window.innerHeight * 0.85);
  }
  window.addEventListener('scroll', onScrollChrome, { passive: true });
  onScrollChrome();

  function setMenu(open) {
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navLinks.classList.toggle('is-open', open);
  }
  navToggle.addEventListener('click', () => setMenu(navToggle.getAttribute('aria-expanded') !== 'true'));
  navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  const spyLinks = new Map($$('.nav-links a').map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      spyLinks.forEach((a) => a.classList.remove('is-active'));
      const link = spyLinks.get(entry.target.id);
      if (link) link.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => spy.observe(s));

  $('#year').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------ *
   * 2. Hero viewfinder timecode (24 fps, starting at 00:03:20:18) + Interactive Focus Box
   * ------------------------------------------------------------------ */
  const tcList = $$('.vf-tc');
  const isStaticShot = new URLSearchParams(window.location.search).has('static');
  if (tcList.length && !reducedMotion && !isStaticShot) {
    const start = performance.now();
    const baseFrames = ((3 * 60 + 20) * 24) + 18;
    const pad = (n) => String(n).padStart(2, '0');
    let last = -1;
    const tick = (now) => {
      const frames = baseFrames + Math.floor(((now - start) / 1000) * 24);
      if (frames !== last) {
        last = frames;
        const f = frames % 24, s = Math.floor(frames / 24);
        const str = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
        tcList.forEach((el) => { el.textContent = str; });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Interactive camera focus tracking on portrait hover
  $$('.hero-scene').forEach((scene) => {
    const vf = $('.viewfinder', scene);
    const focusBox = $('.vf-focus', scene);
    if (!vf || !focusBox) return;

    scene.addEventListener('pointermove', (e) => {
      const r = vf.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
      const ny = clamp((e.clientY - r.top) / r.height - 0.42, -0.5, 0.5);
      // Smoothly track face area with realistic autofocus damping
      const fx = Math.round(nx * 36);
      const fy = Math.round(ny * 32);
      focusBox.style.setProperty('--fx', `${fx}px`);
      focusBox.style.setProperty('--fy', `${fy}px`);
    }, { passive: true });

    scene.addEventListener('pointerleave', () => {
      focusBox.style.setProperty('--fx', '0px');
      focusBox.style.setProperty('--fy', '0px');
    }, { passive: true });
  });

  /* ------------------------------------------------------------------ *
   * 3. Reveal, counters, marquee
   * ------------------------------------------------------------------ */
  const revealer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.15 });
  const observeReveals = (root = document) => $$('.reveal:not(.is-in)', root).forEach((el) => revealer.observe(el));
  observeReveals();


  // Review card AR/EN borderless language toggle
  $$('.review-lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.review-card');
      if (!card) return;
      const lang = btn.dataset.reviewLang;
      const quote = card.querySelector('.review-quote');
      const arEl = card.querySelector('.review-ar');
      const enEl = card.querySelector('.review-en');
      if (!quote || !arEl || !enEl) return;
      quote.setAttribute('data-active-lang', lang);
      if (lang === 'en') {
        arEl.hidden = true;
        enEl.hidden = false;
      } else {
        arEl.hidden = false;
        enEl.hidden = true;
      }
      card.querySelectorAll('.review-lang-btn').forEach((b) => {
        const active = b.dataset.reviewLang === lang;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  });

  const counterObs = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);
      $$('[data-count]', entry.target).forEach((el) => {
        const target = Number(el.dataset.count);
        const startVal = Number(el.dataset.from || 0);
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        if (reducedMotion) return;
        const t0 = performance.now();
        const dur = 1400;
        const step = (now) => {
          const k = clamp((now - t0) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - k, 3);
          el.textContent = prefix + Math.round(startVal + (target - startVal) * eased) + suffix;
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    });
  }, { threshold: 0.4 });
  const stats = $('.stats');
  if (stats) counterObs.observe(stats);

  const track = $('.marquee-track');
  if (track) {
    $$('li', track).forEach((li) => {
      const clone = li.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. Scroll-driven skills + center video (Downloaded MP4s per craft)
   * ------------------------------------------------------------------ */
  const skillsSection = $('#skills');
  const skills = $$('.skill').sort((a, b) => a.dataset.i - b.dataset.i);
  const steps = $$('.skills-steps i');
  const videoFrame = $('#skillsVideoFrame');
  const skillsVideo = $('#skillsVideo');
  const badge = $('#videoBadge');
  const caption = $('#skillCaption');
  const progressBar = $('#skillsProgress');
  const soundBtn = $('#videoSoundBtn');

  /*
   * ─── CRAFT VIDEOS (downloaded local MP4s with tailored aspect ratios) ─
   *   0  Editing & Pacing      → 16:9 widescreen (STENG Fashion)
   *   1  Color Grading        → 9:16 vertical reel (ALEX Before/After)
   *   2  Motion & 3D           → 16:9 widescreen (3D Earth Orbit)
   *   3  Sound Design          → 16:9 widescreen (Tamer Hosny Concert)
   *   4  Generative AI         → 4:5 portrait (AI Cinema Showcase)
   *   5  Cinematography        → 16:9 widescreen (Formula 1 Highlight)
   * ───────────────────────────────────────────────────────────────────────
   */
  const SKILL_VIDEOS = [
    {
      mode: 'trio',
      src: 'assets/videos/skills/craft_4_ai.mp4?v=20261113I',
      poster: 'assets/videos/skills/craft_4_ai.jpg?v=20261113I',
      label: 'Generative AI',
      caption: 'AI Cinema Showcase — Veo 3 · Google Flow · Higgsfield',
      ar: '9/16'
    },
    {
      mode: 'single',
      src: 'assets/videos/skills/craft_3_sound.mp4?v=20261113I',
      poster: 'assets/videos/skills/craft_3_sound.jpg?v=20261113I',
      label: 'Editing & Pacing',
      caption: 'Tamer Hosny — Live Concert Package',
      ar: '16/9'
    },
    {
      mode: 'single',
      src: 'assets/videos/skills/craft_1_color.mp4?v=20261113I',
      poster: 'assets/videos/skills/craft_1_color.jpg?v=20261113I',
      label: 'Color Grading',
      caption: 'DaVinci Resolve — Log to Film Look Grade Pass',
      ar: '16/9'
    },
    {
      mode: 'single',
      src: 'assets/videos/skills/3d.mp4?v=20261113I',
      poster: 'assets/videos/skills/3d.jpg?v=20261113I',
      label: 'Motion & 3D',
      caption: 'Blender 3D Camera Movement & Spatial Render',
      ar: '16/9'
    },
    {
      mode: 'single',
      src: 'assets/videos/skills/Abdelrazek_SrVideoEditor_Main.mp4?v=20261113I',
      poster: 'assets/videos/skills/Abdelrazek_SrVideoEditor_Main.jpg?v=20261113I',
      label: 'Sound Design',
      caption: 'Dialogue Restoration & Cinematic Mix — Showreel',
      ar: '16/9'
    },
    {
      mode: 'single',
      src: 'assets/videos/skills/craft_5_cinematography.mp4?v=20261113I',
      poster: 'assets/videos/skills/craft_5_cinematography.jpg?v=20261113I',
      label: 'Cinematography',
      caption: 'Formula 1 — Motorsport Highlight',
      ar: '16/9'
    }
  ];

  const centerStage = $('#skillsCenterStage');
  const skillsVideoWrap = $('#skillsVideoWrap');
  const trioVideos = $$('.trio-video');
  const trioFrames = $$('.trio-frame');
  const introStep = $('#skillIntroStep');
  const introIco = $('#skillIntroIco');
  const introTitle = $('#skillIntroTitle');
  const introDesc = $('#skillIntroDesc');

  let lastSlot = -2;
  let skillsTicking = false;
  let currentSrc = '';

  function setSkillVideo(index) {
    const info = SKILL_VIDEOS[clamp(index, 0, SKILL_VIDEOS.length - 1)];
    const mode = info.mode || 'single';
    if (skillsVideoWrap) {
      skillsVideoWrap.dataset.mode = mode;
    }

    if (mode === 'trio') {
      if (skillsVideo && !skillsVideo.paused) skillsVideo.pause();
      if (badge) badge.innerHTML = `<i></i> Now playing · ${esc(info.label)}`;
      return;
    }

    trioVideos.forEach((v) => { if (!v.paused) v.pause(); });

    if (!skillsVideo) return;
    if (info.src === currentSrc) return;
    currentSrc = info.src;

    if (videoFrame) {
      videoFrame.dataset.ar = info.ar;
    }

    skillsVideo.poster = info.poster;
    skillsVideo.src = info.src;
    skillsVideo.setAttribute('aria-label', `${info.label} showcase by Abdelrazek Mahmoud`);
    skillsVideo.currentTime = 0;

    if (badge) badge.innerHTML = `<i></i> Now playing · ${esc(info.label)}`;
  }

  function renderSkillStage(index, phase) {
    const cur = skills[index];
    if (!cur) return;
    const title = $('h3', cur).textContent;
    const text = $('p', cur).textContent;
    const sub = cur.dataset.sub || '';
    const iconName = cur.dataset.icon || 'cut';

    if (centerStage) centerStage.dataset.phase = phase;
    if (introStep) introStep.textContent = `0${index + 1} / 0${skills.length}`;
    if (introIco) introIco.innerHTML = `<svg><use href="#i-${esc(iconName)}"/></svg>`;
    if (introTitle) introTitle.textContent = title;
    if (introDesc) {
      introDesc.innerHTML = sub
        ? `${esc(text)}<span class="skill-intro-sub">${esc(sub)}</span>`
        : esc(text);
    }

    if (caption) {
      caption.innerHTML = `<b>${esc(title)}</b>${esc(text)}${sub ? ' — ' + esc(sub) : ''}`;
    }

    skills.forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
      el.classList.toggle('is-done', i < index);
    });
    steps.forEach((el, i) => {
      el.classList.toggle('is-on', i <= index);
      el.classList.toggle('is-current', i === index);
    });

    setSkillVideo(index);
    const info = SKILL_VIDEOS[clamp(index, 0, SKILL_VIDEOS.length - 1)];
    const isTrio = (info && info.mode === 'trio');

    if (isTrio) {
      if (skillsVideo && !skillsVideo.paused) skillsVideo.pause();
      trioVideos.forEach((v) => {
        if (phase === 'video' && (!viewer || !viewer.open) && !reducedMotion) {
          v.play().catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    } else if (skillsVideo) {
      trioVideos.forEach((v) => { if (!v.paused) v.pause(); });
      if (phase === 'video' && (!viewer || !viewer.open) && !reducedMotion) {
        skillsVideo.play().catch(() => {});
      } else if (!skillsVideo.paused) {
        skillsVideo.pause();
      }
    }
  }

  // Trio video controls (each frame has its own mute/unmute, play/pause, and progress bar)
  trioFrames.forEach((frame) => {
    const vid = $('.trio-video', frame);
    const sBtn = $('.trio-sound', frame);
    const pBar = $('.trio-progress', frame);
    if (!vid) return;

    if (sBtn) {
      sBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willUnmute = vid.muted;
        // Mute all other trio videos so audio never overlaps
        trioFrames.forEach((otherFrame) => {
          const ov = $('.trio-video', otherFrame);
          const ob = $('.trio-sound', otherFrame);
          if (ov && ov !== vid) {
            ov.muted = true;
            if (ob) {
              ob.classList.remove('is-unmuted');
              ob.setAttribute('aria-label', 'Unmute video');
              const sp = ob.querySelector('span');
              if (sp) sp.textContent = 'Sound off';
            }
          }
        });
        vid.muted = !willUnmute;
        sBtn.classList.toggle('is-unmuted', !vid.muted);
        sBtn.setAttribute('aria-label', vid.muted ? 'Unmute video' : 'Mute video');
        const txt = sBtn.querySelector('span');
        if (txt) txt.textContent = vid.muted ? 'Sound off' : 'Sound on';
      });
    }

    frame.addEventListener('click', (e) => {
      if (e.target.closest('.trio-sound')) return;
      if (vid.paused) vid.play().catch(() => {});
      else vid.pause();
    });

    if (pBar) {
      vid.addEventListener('timeupdate', () => {
        if (vid.duration) {
          pBar.style.transform = `scaleX(${vid.currentTime / vid.duration})`;
        }
      });
    }
  });

  // Sound toggle button (Mute / Unmute)
  if (soundBtn && skillsVideo) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      skillsVideo.muted = !skillsVideo.muted;
      soundBtn.classList.toggle('is-unmuted', !skillsVideo.muted);
      soundBtn.setAttribute('aria-label', skillsVideo.muted ? 'Unmute video' : 'Mute video');
      const text = soundBtn.querySelector('span');
      if (text) text.textContent = skillsVideo.muted ? 'Sound off' : 'Sound on';
    });
  }

  // Click on video frame toggles play/pause
  if (videoFrame && skillsVideo) {
    videoFrame.addEventListener('click', (e) => {
      if (e.target.closest('#videoSoundBtn')) return;
      if (skillsVideo.paused) skillsVideo.play().catch(() => {});
      else skillsVideo.pause();
    });
  }

  // Progress bar update
  if (progressBar && skillsVideo) {
    skillsVideo.addEventListener('timeupdate', () => {
      if (skillsVideo.duration) {
        progressBar.style.transform = `scaleX(${skillsVideo.currentTime / skillsVideo.duration})`;
      }
    });
  }

  // Allow clicking on any skill pill to jump directly to its video slot
  skills.forEach((el, i) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      if (!skillsSection) return;
      const totalSlots = skills.length * 2;
      const targetSlot = i * 2 + 1; // video slot for skill i
      lastSlot = targetSlot;
      renderSkillStage(i, 'video');

      const total = skillsSection.offsetHeight - window.innerHeight;
      const targetP = 0.02 + ((targetSlot + 0.5) / totalSlots) * 0.92;
      const targetY = window.scrollY + skillsSection.getBoundingClientRect().top + targetP * total;
      window.scrollTo({ top: targetY, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  });

  function updateSkills() {
    skillsTicking = false;
    if (!skillsSection) return;
    const rect = skillsSection.getBoundingClientRect();
    const total = skillsSection.offsetHeight - window.innerHeight;
    const p = clamp(-rect.top / Math.max(total, 1), 0, 1);
    const inView = rect.top < window.innerHeight && rect.bottom > 0;

    // 12 sequential slots: even = Title Card ('intro'), odd = Large Video ('video')
    const totalSlots = skills.length * 2;
    let slot = 0;
    if (p > 0.02) {
      slot = clamp(Math.floor(((p - 0.02) / 0.92) * totalSlots), 0, totalSlots - 1);
    }

    if (slot !== lastSlot) {
      lastSlot = slot;
      const skillIndex = Math.floor(slot / 2);
      const phase = slot % 2 === 0 ? 'intro' : 'video';
      renderSkillStage(skillIndex, phase);
    }

    const currentPhase = centerStage ? centerStage.dataset.phase : 'video';
    const isTrioMode = skillsVideoWrap && skillsVideoWrap.dataset.mode === 'trio';
    if (isTrioMode) {
      if (skillsVideo && !skillsVideo.paused) skillsVideo.pause();
      trioVideos.forEach((v) => {
        if (!inView || currentPhase !== 'video' || (viewer && viewer.open) || reducedMotion) {
          if (!v.paused) v.pause();
        } else if (v.paused) {
          v.play().catch(() => {});
        }
      });
    } else if (skillsVideo) {
      trioVideos.forEach((v) => { if (!v.paused) v.pause(); });
      if (!inView || currentPhase !== 'video' || (viewer && viewer.open) || reducedMotion) {
        if (!skillsVideo.paused) skillsVideo.pause();
      } else if (skillsVideo.paused) {
        skillsVideo.play().catch(() => {});
      }
    }
  }
  const requestSkills = () => {
    if (!skillsTicking) { skillsTicking = true; requestAnimationFrame(updateSkills); }
  };
  window.addEventListener('scroll', requestSkills, { passive: true });
  window.addEventListener('resize', requestSkills);
  // Set first stage on load
  renderSkillStage(0, 'intro');
  updateSkills();

  /* ------------------------------------------------------------------ *
   * 5. Projects & services rendering
   * ------------------------------------------------------------------ */
  const projectBySlug = new Map(DATA.PROJECTS.map((p) => [p.slug, p]));
  const serviceBySlug = new Map(DATA.SERVICES.map((s) => [s.slug, s]));
  let globalWorkFormat = 'reels'; // 'reels' or 'long'

  function getFormatCounts() {
    let longTotal = 0;
    let reelTotal = 0;
    let longCats = 0;
    let reelCats = 0;
    DATA.PROJECTS.forEach((p) => {
      const { longVideos, reelVideos } = splitVideosByFormat(p.videos);
      if (longVideos.length > 0) {
        longTotal += longVideos.length;
        longCats += 1;
      }
      if (reelVideos.length > 0) {
        reelTotal += reelVideos.length;
        reelCats += 1;
      }
    });
    return { longTotal, reelTotal, longCats, reelCats };
  }

  function getFormatCover(p, fmt, longVideos, reelVideos) {
    const customCover = fmt === 'long' ? (p.longCover || p.cover) : (p.reelCover || p.cover);
    const targetList = fmt === 'long' ? longVideos : reelVideos;
    let firstThumb = null;
    if (targetList.length > 0) {
      const firstV = normalize(targetList[0].raw);
      const firstM = mediaInfo(firstV);
      firstThumb = firstM.thumb || firstM.fallbackThumb || null;
    }
    if (customCover) {
      const isExternal = /^https?:\/\//i.test(customCover);
      return {
        thumb: isExternal ? customCover : `${customCover}?v=20261113H`,
        fallbackThumb: firstThumb
      };
    }
    return {
      thumb: firstThumb,
      fallbackThumb: null
    };
  }

  function renderWorkFormatSwitch() {
    const sw = $('#workFormatSwitch');
    if (!sw) return;
    const { longTotal, reelTotal, longCats, reelCats } = getFormatCounts();
    sw.innerHTML = `
      <button type="button" role="tab" class="work-fmt-card${globalWorkFormat === 'reels' ? ' is-active' : ''}" data-work-format="reels" aria-selected="${globalWorkFormat === 'reels' ? 'true' : 'false'}">
        <div class="wfc-collage wfc-collage-reels" aria-hidden="true">
          <span class="wfc-c-item"><img src="assets/images/categories/wfc-reel-1.jpg?v=20261113H" alt="" loading="lazy" decoding="async"></span>
          <span class="wfc-c-item"><img src="assets/images/categories/wfc-reel-2.jpg?v=20261113H" alt="" loading="lazy" decoding="async"></span>
          <span class="wfc-c-item"><img src="assets/images/categories/wfc-reel-3.jpg?v=20261113H" alt="" loading="lazy" decoding="async"></span>
        </div>
        <div class="wfc-body">
          <span class="wfc-kicker">9:16 Vertical · ${reelCats} Categories · ${reelTotal} Reels</span>
          <strong>Vertical Reels &amp; Shorts</strong>
          <small>High-retention 9:16 social edits, reels &amp; ads</small>
        </div>
      </button>
      <button type="button" role="tab" class="work-fmt-card${globalWorkFormat === 'long' ? ' is-active' : ''}" data-work-format="long" aria-selected="${globalWorkFormat === 'long' ? 'true' : 'false'}">
        <div class="wfc-collage wfc-collage-long" aria-hidden="true">
          <span class="wfc-c-item"><img src="assets/images/categories/commercial-brand-films-retail.jpg?v=20261113H" alt="" loading="lazy" decoding="async"></span>
          <span class="wfc-c-item"><img src="assets/images/categories/cinematic-weddings-royal.jpg?v=20261113H" alt="" loading="lazy" decoding="async"></span>
          <span class="wfc-c-item"><img src="assets/images/categories/official-summits-conferences.jpg?v=20261113H" alt="" loading="lazy" decoding="async"></span>
        </div>
        <div class="wfc-body">
          <span class="wfc-kicker">16:9 Cinema · ${longCats} Categories · ${longTotal} Films</span>
          <strong>Horizontal Films</strong>
          <small>16:9 widescreen commercials, summits &amp; concerts</small>
        </div>
      </button>`;
  }

  function normalize(item) {
    if (Array.isArray(item)) {
      const isYT = item[0] && item[0].length === 11;
      return {
        type: isYT ? 'youtube' : 'drive',
        id: item[0],
        title: item[1] || '',
        sub: item[2] || '',
        o: item[3] || (isYT ? 'v' : ((THUMBS && THUMBS[item[0]]) || 'v'))
      };
    }
    return { sub: '', ...item };
  }
  function mediaInfo(v) {
    const o = v.o || (THUMBS && THUMBS[v.id]) || (v.type === 'image' ? 'h' : 'v');
    const hasThumb = HAS_THUMB instanceof Set ? HAS_THUMB.has(v.id) : Boolean(HAS_THUMB && HAS_THUMB[v.id]);
    switch (v.type) {
      case 'youtube':
        return {
          thumb: v.thumb || `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`,
          fallbackThumb: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          o: v.o || 'v',
          ext: `https://youtu.be/${v.id}`
        };
      case 'drive':
      case 'image':
        return {
          thumb: hasThumb ? `assets/thumbs/drive/${v.id}.jpg` : null,
          o,
          ext: `https://drive.google.com/file/d/${v.id}/view`
        };
      case 'instagram':
        return { thumb: null, o: 'v', ext: `https://www.instagram.com/reel/${v.id}/` };
      case 'local':
        return { thumb: v.poster || null, o, ext: v.src };
      default:
        return { thumb: null, o: 'v', ext: '#' };
    }
  }

  const fallbackPoster = (v, m) => {
    const tagLabel = m.o === 'h' ? '16:9 Cinema' : (m.o === 's' ? '1:1 Square' : '9:16 Reel');
    return `
      <span class="poster-fallback" aria-hidden="true">
        <span class="pf-brand">${icon('stage')} ARZ PORTFOLIO</span>
        <span class="pf-foot">
          <strong class="pf-title"${isArabic(v.title) ? ' dir="rtl" lang="ar"' : ''}>${esc(v.title)}</strong>
          <span class="pf-tag">${esc(tagLabel)}</span>
        </span>
      </span>`;
  };

  function videoCard(raw, key) {
    const v = normalize(raw);
    const m = mediaInfo(v);
    const typeIcon = v.type === 'instagram' ? 'instagram' : v.type === 'image' ? 'image' : null;
    const poster = fallbackPoster(v, m);
    const media = m.thumb
      ? `${poster}<img src="${esc(m.thumb)}" alt="" loading="lazy" decoding="async"${m.fallbackThumb ? ` data-fb="${esc(m.fallbackThumb)}" onload="if(this.naturalWidth<=120&&this.dataset.fb){this.src=this.dataset.fb;delete this.dataset.fb;}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;delete this.dataset.fb;}else{this.remove();}"` : ' onerror="this.remove()"'}>`
      : poster;
    return `
      <article class="vcard" data-key="${esc(key)}" data-type="${v.type}" data-o="${m.o}">
        <button type="button" class="vcard-media" aria-label="${v.type === 'image' ? 'View' : 'Play'}: ${esc(v.title)}">
          ${media}
          <span class="vcard-play">${icon(v.type === 'image' ? 'image' : 'play')}</span>
          ${v.badge ? `<span class="vcard-badge">${esc(v.badge)}</span>` : ''}
          ${typeIcon ? `<span class="vcard-type">${icon(typeIcon)}</span>` : ''}
        </button>
        <div class="vcard-info">
          <div>
            <h4>${esc(v.title)}</h4>
            ${v.sub ? `<p${isArabic(v.sub) ? ' dir="rtl" lang="ar"' : ''}>${esc(v.sub)}</p>` : ''}
          </div>
          <a class="vcard-ext" href="${esc(m.ext)}" target="_blank" rel="noopener" aria-label="Open ${esc(v.title)} in a new tab">${icon('external')}</a>
        </div>
      </article>`;
  }

  function renderStairDesc(item) {
    if (Array.isArray(item.lines) && item.lines.length) {
      return `<p class="stair-text">${item.lines.map((l) => `<span>${esc(l)}</span>`).join('')}</p>`;
    }
    return `<p>${esc(item.description)}</p>`;
  }

  function splitVideosByFormat(videos) {
    const longVideos = [];
    const reelVideos = [];
    videos.forEach((raw, idx) => {
      const v = normalize(raw);
      const m = mediaInfo(v);
      if (m.o === 'h') longVideos.push({ raw, idx });
      else reelVideos.push({ raw, idx });
    });
    return { longVideos, reelVideos };
  }

  function renderProjects() {
    renderWorkFormatSwitch();
    const grid = $('#projectGrid');
    const filteredProjects = DATA.PROJECTS.filter((p) => {
      const { longVideos, reelVideos } = splitVideosByFormat(p.videos);
      return globalWorkFormat === 'long' ? longVideos.length > 0 : reelVideos.length > 0;
    });

    grid.innerHTML = filteredProjects.map((p, i) => {
      const { longVideos, reelVideos } = splitVideosByFormat(p.videos);
      const activeList = globalWorkFormat === 'long' ? longVideos : reelVideos;
      const countLabel = globalWorkFormat === 'long'
        ? `${activeList.length} ${activeList.length === 1 ? 'film' : 'films'}`
        : `${activeList.length} ${activeList.length === 1 ? 'reel' : 'reels'}`;
      const coverObj = getFormatCover(p, globalWorkFormat, longVideos, reelVideos);
      const coverAttr = coverObj.fallbackThumb
        ? ` data-fb="${esc(coverObj.fallbackThumb)}" onload="if(this.naturalWidth<=120&&this.dataset.fb){this.src=this.dataset.fb;delete this.dataset.fb;}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;delete this.dataset.fb;}else{this.remove();}"`
        : ' onerror="this.remove()"';

      return `
      <a class="project-card reveal is-in" href="?project=${encodeURIComponent(p.slug)}&format=${globalWorkFormat}" data-open-project="${esc(p.slug)}" data-format="${globalWorkFormat}" aria-label="Open project: ${esc(p.title)}">
        <div class="project-cover">
          <span class="poster-fallback" aria-hidden="true">${icon('stage')}<strong>${esc(p.client.split('·')[0].trim())}</strong><span>${esc(p.tag)}</span></span>
          ${coverObj.thumb ? `<img src="${esc(coverObj.thumb)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async"${coverAttr}>` : ''}
          <span class="project-tag">${esc(p.tag)}</span>
          <span class="project-count">${icon(globalWorkFormat === 'long' ? 'camera' : 'reel')} ${countLabel}</span>
          <span class="project-play">${icon('play')}</span>
        </div>
        <div class="project-body">
          <p class="project-client">${esc(p.client)}</p>
          <h3>${esc(p.title)}</h3>
          ${renderStairDesc(p)}
          <div class="project-foot">
            <span class="project-metric">${esc(p.metric)}</span>
            <span class="project-open">Watch ${globalWorkFormat === 'long' ? 'films' : 'reels'} ${icon('arrow-right')}</span>
          </div>
        </div>
      </a>`;
    }).join('');
  }

  function renderServices() {
    const grid = $('#serviceGrid');
    grid.innerHTML = DATA.SERVICES.map((s) => `
      <article class="service-card reveal">
        <span class="service-ico">${icon(s.icon)}</span>
        <h3>${esc(s.title)}</h3>
        <p class="service-outcome">${esc(s.outcome)}</p>
        ${renderStairDesc(s)}
        <ul class="service-list">${s.deliverables.map((d) => `<li>${icon('check')}${esc(d)}</li>`).join('')}</ul>
        <div class="service-actions">
          <a class="btn btn-accent" href="?service=${encodeURIComponent(s.slug)}" data-open-service="${esc(s.slug)}">${icon('play')} See related videos &amp; Q&amp;A</a>
        </div>
      </article>`).join('');
  }

  renderProjects();
  renderServices();
  observeReveals();

  const workFormatSwitch = $('#workFormatSwitch');
  if (workFormatSwitch) {
    workFormatSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-work-format]');
      if (!btn) return;
      const fmt = btn.dataset.workFormat;
      if (fmt === globalWorkFormat) return;
      globalWorkFormat = fmt;
      renderProjects();
    });
  }

  /* ------------------------------------------------------------------ *
   * 6. Deep-linked viewer dialog
   * ------------------------------------------------------------------ */
  const viewer = $('#viewer');
  const viewerBody = $('#viewerBody');
  const viewerPrev = $('#viewerPrev');
  const viewerNext = $('#viewerNext');
  const viewerPrevLabel = $('#viewerPrevLabel');
  const viewerNextLabel = $('#viewerNextLabel');
  const shareTip = $('#shareTip');
  let openedByPush = false;
  let ignoreNextPop = false;
  let closingFromPop = false;
  let afterClose = null;
  let activeProjectSlug = null;
  let activeProjectFormat = 'reels';

  function getProjectsForFormat(fmt) {
    return DATA.PROJECTS.filter((p) => {
      const { longVideos, reelVideos } = splitVideosByFormat(p.videos);
      return fmt === 'long' ? longVideos.length > 0 : reelVideos.length > 0;
    });
  }

  function updateProjectNav(type, slug, fmt = globalWorkFormat) {
    if (!viewerPrev || !viewerNext) return;
    if (type !== 'project') {
      activeProjectSlug = null;
      viewerPrev.hidden = true;
      viewerNext.hidden = true;
      return;
    }
    const list = getProjectsForFormat(fmt);
    const idx = list.findIndex((p) => p.slug === slug);
    if (idx === -1 || list.length < 2) {
      activeProjectSlug = null;
      viewerPrev.hidden = true;
      viewerNext.hidden = true;
      return;
    }
    activeProjectSlug = slug;
    activeProjectFormat = fmt;
    const prevProj = list[(idx - 1 + list.length) % list.length];
    const nextProj = list[(idx + 1) % list.length];

    viewerPrev.hidden = false;
    viewerNext.hidden = false;
    viewerPrev.dataset.targetSlug = prevProj.slug;
    viewerNext.dataset.targetSlug = nextProj.slug;
    viewerPrev.dataset.targetFormat = fmt;
    viewerNext.dataset.targetFormat = fmt;
    viewerPrev.setAttribute('aria-label', `Previous project: ${prevProj.title}`);
    viewerNext.setAttribute('aria-label', `Next project: ${nextProj.title}`);
    if (viewerPrevLabel) viewerPrevLabel.textContent = prevProj.tag || prevProj.title;
    if (viewerNextLabel) viewerNextLabel.textContent = nextProj.tag || nextProj.title;
  }

  function renderFormatTabs(longCount, reelCount, activeFormat, scopeAttr = '') {
    return `
      <div class="format-tabs" role="tablist" aria-label="Filter videos by format"${scopeAttr}>
        <button type="button" role="tab" class="format-tab${activeFormat === 'long' ? ' is-active' : ''}${longCount === 0 ? ' is-empty' : ''}" data-format-tab="long" aria-selected="${activeFormat === 'long' ? 'true' : 'false'}" ${longCount === 0 ? 'disabled' : ''}>
          ${icon('camera')}
          <span class="ft-label">Horizontal Films</span>
          <span class="ft-sub">16:9</span>
          <span class="ft-count">${longCount}</span>
        </button>
        <button type="button" role="tab" class="format-tab${activeFormat === 'reels' ? ' is-active' : ''}${reelCount === 0 ? ' is-empty' : ''}" data-format-tab="reels" aria-selected="${activeFormat === 'reels' ? 'true' : 'false'}" ${reelCount === 0 ? 'disabled' : ''}>
          ${icon('reel')}
          <span class="ft-label">Reels</span>
          <span class="ft-sub">9:16</span>
          <span class="ft-count">${reelCount}</span>
        </button>
      </div>`;
  }

  function projectView(p, initialFormat) {
    const { longVideos, reelVideos } = splitVideosByFormat(p.videos);
    let activeFormat = initialFormat || globalWorkFormat;
    if (activeFormat !== 'long' && activeFormat !== 'reels') {
      activeFormat = reelVideos.length > 0 ? 'reels' : 'long';
    }
    if (activeFormat === 'long' && longVideos.length === 0 && reelVideos.length > 0) activeFormat = 'reels';
    if (activeFormat === 'reels' && reelVideos.length === 0 && longVideos.length > 0) activeFormat = 'long';
    activeProjectFormat = activeFormat;

    const shownVideos = activeFormat === 'long' ? longVideos : reelVideos;
    const formatBadge = activeFormat === 'long'
      ? `<span class="chip accent">${icon('camera')} Horizontal Films (16:9) · ${shownVideos.length} ${shownVideos.length === 1 ? 'Film' : 'Films'}</span>`
      : `<span class="chip accent">${icon('reel')} Vertical Reels (9:16) · ${shownVideos.length} ${shownVideos.length === 1 ? 'Reel' : 'Reels'}</span>`;

    return `
      <header class="viewer-head">
        <div class="viewer-meta">${formatBadge}</div>
        <h2 id="viewerTitle">${esc(p.title)}</h2>
        <div class="viewer-ctas">
          <a class="btn btn-wa" href="${waLink(`Hi Abdelrazek, I watched your "${p.title}" project and I'd like something similar.`)}" target="_blank" rel="noopener">${icon('whatsapp')} I want something like this</a>
        </div>
      </header>
      <div class="format-section" data-active-format="${activeFormat}">
        <div class="video-grid format-panel" data-format-panel="${activeFormat}">
          ${shownVideos.map(({ raw, idx }) => videoCard(raw, `${p.slug}:${idx}`)).join('')}
        </div>
      </div>`;
  }

  function serviceView(s) {
    const groups = s.projects.map((slug) => projectBySlug.get(slug)).filter(Boolean);
    return `
      <header class="viewer-head">
        <p class="kicker">Service</p>
        <h2 id="viewerTitle">${esc(s.title)}</h2>
        ${renderStairDesc(s)}
        <div class="viewer-meta">
          <span class="chip accent">${esc(s.outcome)}</span>
          ${s.deliverables.map((d) => `<span class="chip">${esc(d)}</span>`).join('')}
        </div>
        <div class="viewer-ctas">
          <a class="btn btn-wa" href="${waLink(`Hi Abdelrazek, I'm interested in your "${s.title}" service.`)}" target="_blank" rel="noopener">${icon('whatsapp')} Book this service</a>
          <button type="button" class="btn btn-ghost" data-goto-contact>${icon('mail')} Send a brief</button>
        </div>
      </header>

      <section class="viewer-qa" aria-label="Questions about this service">
        <h3>Quick answers</h3>
        <div class="qa-list">
          ${s.qa.map(([q, a], i) => `
            <details class="qa" name="svc-qa"${i === 0 ? ' open' : ''}>
              <summary>${esc(q)}</summary>
              <div class="qa-body"><p>${esc(a)}</p></div>
            </details>`).join('')}
        </div>
      </section>

      ${groups.map((p) => {
        const { longVideos, reelVideos } = splitVideosByFormat(p.videos);
        const activeFormat = (s.slug === 'short-form-reels' && reelVideos.length > 0)
          ? 'reels'
          : (longVideos.length > 0 ? 'long' : 'reels');
        return `
        <section class="video-group format-section" data-active-format="${activeFormat}">
          <div class="group-head">
            <h3>${esc(p.title)} <small>${esc(p.client)}</small></h3>
            <a class="link-arrow" href="?project=${encodeURIComponent(p.slug)}" data-open-project="${esc(p.slug)}">Open full project ${icon('arrow-right')}</a>
          </div>
          ${renderFormatTabs(longVideos.length, reelVideos.length, activeFormat)}
          <div class="video-grid format-panel" data-format-panel="long" ${activeFormat !== 'long' ? 'hidden' : ''}>
            ${longVideos.slice(0, 6).map(({ raw, idx }) => videoCard(raw, `${p.slug}:${idx}`)).join('')}
          </div>
          <div class="video-grid format-panel" data-format-panel="reels" ${activeFormat !== 'reels' ? 'hidden' : ''}>
            ${reelVideos.slice(0, 6).map(({ raw, idx }) => videoCard(raw, `${p.slug}:${idx}`)).join('')}
          </div>
        </section>`;
      }).join('')}

      <div class="viewer-foot">
        <p>Want results like these?</p>
        <div class="viewer-ctas">
          <a class="btn btn-wa" href="${waLink(`Hi Abdelrazek, I'd like a quote for "${s.title}".`)}" target="_blank" rel="noopener">${icon('whatsapp')} Get a quote</a>
          <button type="button" class="btn btn-light" data-goto-contact>Use the contact form</button>
        </div>
      </div>`;
  }

  function cleanUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    url.searchParams.delete('service');
    url.searchParams.delete('format');
    return url;
  }

  /**
   * @param {'project'|'service'} type
   * @param {string} slug
   * @param {'push'|'replace'|'none'} mode  how to update the address bar
   * @param {'long'|'reels'} [initialFormat]
   */
  function openView(type, slug, mode = 'push', initialFormat) {
    const item = type === 'project' ? projectBySlug.get(slug) : serviceBySlug.get(slug);
    if (!item) return false;

    const targetFormat = type === 'project' ? (initialFormat || globalWorkFormat) : undefined;
    viewerBody.innerHTML = type === 'project' ? projectView(item, targetFormat) : serviceView(item);
    viewerBody.scrollTop = 0;
    document.title = `${item.title} — ARZ Portfolio`;
    updateProjectNav(type, slug, activeProjectFormat);

    if (mode !== 'none') {
      const url = cleanUrl();
      url.searchParams.set(type, slug);
      if (type === 'project' && activeProjectFormat) {
        url.searchParams.set('format', activeProjectFormat);
      }
      url.hash = '';
      if (mode === 'push' && !viewer.open) {
        history.pushState({ az: true }, '', url);
        openedByPush = true;
      } else {
        history.replaceState(history.state, '', url);
      }
    }
    if (!viewer.open) {
      if (skillsVideo && !skillsVideo.paused) skillsVideo.pause();
      viewer.showModal();
    }
    return true;
  }

  function closeView(then) {
    afterClose = then || null;
    if (viewer.open) viewer.close();
  }

  viewer.addEventListener('close', () => {
    viewerBody.innerHTML = ''; // stops any playing iframe / video
    document.title = BASE_TITLE;
    updateProjectNav(null, null);
    if (closingFromPop) {
      closingFromPop = false;
    } else if (openedByPush) {
      ignoreNextPop = true;
      history.back();
    } else {
      history.replaceState(history.state, '', cleanUrl());
    }
    openedByPush = false;
    if (afterClose) { const fn = afterClose; afterClose = null; setTimeout(fn, 60); }
    requestSkills();
  });

  window.addEventListener('popstate', () => {
    if (ignoreNextPop) { ignoreNextPop = false; return; }
    const params = new URLSearchParams(window.location.search);
    const project = params.get('project');
    const service = params.get('service');
    const fmt = params.get('format') || undefined;
    if (project && openView('project', project, 'none', fmt)) return;
    if (service && openView('service', service, 'none')) return;
    if (viewer.open) { closingFromPop = true; openedByPush = false; viewer.close(); }
  });

  $('#viewerClose').addEventListener('click', () => closeView());

  if (viewerPrev) {
    viewerPrev.addEventListener('click', () => {
      if (viewerPrev.dataset.targetSlug) openView('project', viewerPrev.dataset.targetSlug, 'replace', viewerPrev.dataset.targetFormat || activeProjectFormat);
    });
  }
  if (viewerNext) {
    viewerNext.addEventListener('click', () => {
      if (viewerNext.dataset.targetSlug) openView('project', viewerNext.dataset.targetSlug, 'replace', viewerNext.dataset.targetFormat || activeProjectFormat);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!viewer.open || !activeProjectSlug) return;
    if (theater && theater.open) return;
    if (e.key === 'ArrowLeft' && viewerPrev && !viewerPrev.hidden && viewerPrev.dataset.targetSlug) {
      e.preventDefault();
      openView('project', viewerPrev.dataset.targetSlug, 'replace', viewerPrev.dataset.targetFormat || activeProjectFormat);
    } else if (e.key === 'ArrowRight' && viewerNext && !viewerNext.hidden && viewerNext.dataset.targetSlug) {
      e.preventDefault();
      openView('project', viewerNext.dataset.targetSlug, 'replace', viewerNext.dataset.targetFormat || activeProjectFormat);
    }
  });

  // Light-dismiss fallback for browsers without <dialog closedby>
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, d) => {
      const r = d.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    $$('dialog[closedby="any"]').forEach((d) => {
      let pressedOutside = false;
      d.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, d); });
      d.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, d)) d.close(); });
    });
  }

  $('#viewerShare').addEventListener('click', async () => {
    const url = window.location.href;
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: document.title, url }); return; } catch (_) { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      shareTip.textContent = 'Link copied';
    } catch (_) {
      shareTip.textContent = 'Copy the address bar link';
    }
    shareTip.classList.add('is-on');
    setTimeout(() => shareTip.classList.remove('is-on'), 1800);
  });

  // Open from page (project cards / service buttons)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-open-project], [data-open-service]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    const inViewer = viewer.contains(link);
    const mode = inViewer ? 'replace' : 'push';
    const initialFormat = link.dataset.format || undefined;
    if (link.dataset.openProject) openView('project', link.dataset.openProject, mode, initialFormat);
    else openView('service', link.dataset.openService, mode);
  });

  // Inside the viewer: play cards, contact shortcuts
  const cardTemplates = new Map();
  function stopPlaying(except) {
    $$('.vcard.is-playing', viewerBody).forEach((card) => {
      if (card === except) return;
      const html = cardTemplates.get(card.dataset.key);
      if (html) card.outerHTML = html;
    });
  }
  function findItem(key) {
    const [slug, idx] = key.split(':');
    const p = projectBySlug.get(slug);
    return p ? normalize(p.videos[Number(idx)]) : null;
  }
  const theater = $('#theaterDialog');
  const theaterHolder = $('#theaterMediaHolder');
  const theaterFrame = $('#theaterMediaFrame');
  const theaterTitle = $('#theaterTitle');
  const theaterSub = $('#theaterSub');
  const theaterExt = $('#theaterExt');
  const theaterClose = $('#theaterClose');
  const theaterDirectLink = $('#theaterDirectLink');

  function openTheater(card) {
    if (!theater || !card) return;
    const v = findItem(card.dataset.key);
    if (!v) return;
    const m = mediaInfo(v);

    theaterTitle.textContent = v.title;
    theaterSub.textContent = v.sub || '';
    if (v.sub && isArabic(v.sub)) {
      theaterSub.setAttribute('dir', 'rtl');
      theaterSub.setAttribute('lang', 'ar');
    } else {
      theaterSub.removeAttribute('dir');
      theaterSub.removeAttribute('lang');
    }

    if (theaterExt) theaterExt.href = m.ext;
    if (theaterFrame) theaterFrame.dataset.o = m.o;

    if (theaterDirectLink) {
      if (v.type === 'youtube') {
        theaterDirectLink.href = `https://youtu.be/${encodeURIComponent(v.id)}`;
        theaterDirectLink.style.display = 'inline-flex';
        const span = theaterDirectLink.querySelector('span');
        if (span) span.textContent = 'Watch on YouTube';
      } else if (v.type === 'drive') {
        theaterDirectLink.href = `https://drive.google.com/file/d/${encodeURIComponent(v.id)}/view`;
        theaterDirectLink.style.display = 'inline-flex';
        const span = theaterDirectLink.querySelector('span');
        if (span) span.textContent = 'Open directly in Google Drive';
      } else if (v.type === 'instagram') {
        theaterDirectLink.href = `https://www.instagram.com/reel/${encodeURIComponent(v.id)}/`;
        theaterDirectLink.style.display = 'inline-flex';
        const span = theaterDirectLink.querySelector('span');
        if (span) span.textContent = 'Open on Instagram';
      } else {
        theaterDirectLink.style.display = 'none';
      }
    }

    let inner = '';
    if (v.type === 'youtube') {
      inner = `<iframe class="yt-frame" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0&modestbranding=1" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="eager"></iframe>`;
    } else if (v.type === 'drive') {
      inner = `<iframe class="drive-frame" src="https://drive.google.com/file/d/${encodeURIComponent(v.id)}/preview" title="${esc(v.title)}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen loading="eager"></iframe>`;
    } else if (v.type === 'instagram') {
      inner = `<iframe class="insta-frame" src="https://www.instagram.com/reel/${encodeURIComponent(v.id)}/embed/" title="${esc(v.title)}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen loading="eager" scrolling="no"></iframe>`;
    } else if (v.type === 'image') {
      inner = `<img src="https://drive.google.com/thumbnail?id=${encodeURIComponent(v.id)}&sz=w1600" alt="${esc(v.title)}">`;
    } else if (v.type === 'local') {
      inner = `<video src="${esc(v.src)}" poster="${esc(v.poster || '')}" controls autoplay playsinline></video>`;
    }

    theaterHolder.innerHTML = inner;
    theater.showModal();
  }

  function closeTheater() {
    if (theater && theater.open) theater.close();
  }

  if (theater) {
    theater.addEventListener('close', () => {
      if (theaterHolder) theaterHolder.innerHTML = ''; // stops playing iframe / video
    });
    // Backdrop click dismisses modal
    theater.addEventListener('click', (e) => {
      if (e.target === theater || e.target.classList.contains('theater-shell')) closeTheater();
    });
  }
  if (theaterClose) {
    theaterClose.addEventListener('click', closeTheater);
  }

  viewerBody.addEventListener('click', (e) => {
    // Format tab switching (Long / Horizontal vs Reels)
    const tabBtn = e.target.closest('[data-format-tab]');
    if (tabBtn && !tabBtn.disabled) {
      const targetFmt = tabBtn.dataset.formatTab;
      const section = tabBtn.closest('.format-section');
      if (section) {
        section.dataset.activeFormat = targetFmt;
        $$('[data-format-tab]', section).forEach((btn) => {
          const isMatch = btn.dataset.formatTab === targetFmt;
          btn.classList.toggle('is-active', isMatch);
          btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });
        $$('[data-format-panel]', section).forEach((panel) => {
          panel.hidden = panel.dataset.formatPanel !== targetFmt;
        });
      }
      return;
    }

    // If clicking external link in card info, let standard link behavior proceed
    if (e.target.closest('.vcard-ext')) return;

    // Tapping anywhere on the video card opens theater
    const card = e.target.closest('.vcard');
    if (card) {
      openTheater(card);
      return;
    }

    if (e.target.closest('[data-goto-contact]')) {
      closeView(() => {
        $('#contact').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
        setTimeout(() => $('#cfName').focus({ preventScroll: true }), 700);
      });
    }
  });

  // Initial deep link
  (function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const fmt = params.get('format') || undefined;
    if (fmt === 'long' || fmt === 'reels') {
      globalWorkFormat = fmt;
      renderProjects();
    }
    if (params.get('project')) openView('project', params.get('project'), 'none', fmt) || history.replaceState(null, '', cleanUrl());
    else if (params.get('service')) openView('service', params.get('service'), 'none') || history.replaceState(null, '', cleanUrl());
  })();

  /* ------------------------------------------------------------------ *
   * Email obfuscation (address is assembled only on click)
   * ------------------------------------------------------------------ */
  $$('.js-mail').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const addr = `${el.dataset.u}@${el.dataset.d}`;
      $$('.js-mail-text').forEach((t) => { t.textContent = addr; });
      window.location.href = `mailto:${addr}`;
    });
  });

  /* ------------------------------------------------------------------ *
   * 7. Bot-protected Web3Forms contact form
   * ------------------------------------------------------------------ */
  const form = $('#emailForm');
  const submitBtn = $('#submitBtn');
  const statusEl = $('#formStatus');
  const msgEl = $('#cfMessage');
  const countEl = $('#cfCount');
  const RATE_KEY = 'az_contact_sent';
  const MIN_FILL_MS = 3500;
  const submitLabel = submitBtn.innerHTML;

  let formStartedAt = 0;
  let humanSignals = 0;
  ['pointerdown', 'keydown', 'touchstart', 'focusin'].forEach((evt) =>
    form.addEventListener(evt, () => {
      if (!formStartedAt) formStartedAt = Date.now();
      humanSignals += 1;
    }, { passive: true })
  );

  msgEl.addEventListener('input', () => { countEl.textContent = msgEl.value.length; });

  const fields = {
    name: { el: $('#cfName'), err: $('#cfNameErr') },
    email: { el: $('#cfEmail'), err: $('#cfEmailErr') },
    message: { el: msgEl, err: $('#cfMessageErr') }
  };
  Object.values(fields).forEach(({ el, err }) => {
    el.setAttribute('aria-describedby', err.id);
    el.addEventListener('input', () => setFieldError(el, err, ''));
    el.addEventListener('blur', () => { if (el.value) validateField(el); });
  });

  function setFieldError(el, err, msg) {
    err.textContent = msg;
    el.toggleAttribute('aria-invalid', Boolean(msg));
    el.classList.toggle('is-invalid', Boolean(msg));
  }

  const URL_RE = /(https?:\/\/|www\.)/gi;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateField(el) {
    const v = el.value.trim();
    const f = Object.values(fields).find((x) => x.el === el);
    let msg = '';
    if (el === fields.name.el) {
      if (v.length < 2) msg = 'Please enter your name.';
      else if (v.length > 80) msg = 'Name is too long.';
      else if (URL_RE.test(v) || /[<>]/.test(v)) msg = 'Please enter a real name.';
    } else if (el === fields.email.el) {
      if (!EMAIL_RE.test(v)) msg = 'Please enter a valid email address.';
    } else if (el === fields.message.el) {
      if (v.length < 10) msg = 'Please write at least a short sentence (10+ characters).';
      else if (v.length > 2000) msg = 'Message is too long (2000 characters max).';
      else if ((v.match(URL_RE) || []).length > 2) msg = 'Please include at most 2 links.';
    }
    URL_RE.lastIndex = 0;
    setFieldError(el, f.err, msg);
    return !msg;
  }

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = `form-status is-${type}`;
  }

  function readSent() {
    try { return JSON.parse(localStorage.getItem(RATE_KEY) || '[]').filter((t) => Date.now() - t < 3600e3); }
    catch (_) { return []; }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    statusEl.className = 'form-status';

    // Trap 1 + 2: Web3Forms honeypot checkbox and decoy text field
    const botcheck = form.querySelector('input[name="botcheck"]');
    const decoy = form.querySelector('input[name="website_url"]');
    if ((botcheck && botcheck.checked) || (decoy && decoy.value)) {
      showStatus('Thank you! Your message has been received.', 'success'); // silent drop
      form.reset();
      return;
    }

    // Field validation
    const valid = Object.values(fields).map(({ el }) => validateField(el));
    if (valid.includes(false)) {
      const firstBad = Object.values(fields).find(({ el }) => el.hasAttribute('aria-invalid'));
      if (firstBad) firstBad.el.focus();
      return;
    }

    // Trap 3: humans need a few seconds and real input events
    if (!formStartedAt || Date.now() - formStartedAt < MIN_FILL_MS || humanSignals < 3) {
      showStatus('That was quick! Please take a moment to review your message, then send again.', 'error');
      formStartedAt = formStartedAt || Date.now();
      return;
    }

    // Trap 4: rate limit (1 per minute, 3 per hour per browser)
    const sent = readSent();
    if (sent.length && Date.now() - sent[sent.length - 1] < 60e3) {
      showStatus('Message already sent — please wait a minute before sending another.', 'error');
      return;
    }
    if (sent.length >= 3) {
      showStatus('You have sent several messages already. For anything urgent, please use WhatsApp.', 'error');
      return;
    }

    // Trap 5: hCaptcha (rendered by the Web3Forms client script)
    const captcha = form.querySelector('[name="h-captcha-response"]');
    if (captcha && !captcha.value) {
      showStatus('Please complete the captcha to prove you are human.', 'error');
      return;
    }

    const formData = new FormData(form);
    if (formData.get('access_key') === 'YOUR_ACCESS_KEY_HERE') {
      showStatus('The contact form is not configured yet. Please reach out on WhatsApp for now.', 'error');
      console.warn('[ARZ Portfolio] Add your Web3Forms access key to the hidden "access_key" input in index.html.');
      return;
    }
    formData.delete('website_url');
    formData.set('name', fields.name.el.value.trim());
    formData.set('email', fields.email.el.value.trim());
    formData.set('message', fields.message.el.value.trim());
    formData.set('replyto', fields.email.el.value.trim());

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData)),
        signal: controller.signal
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        showStatus('Message sent! Abdelrazek will get back to you within 24 hours.', 'success');
        form.reset();
        countEl.textContent = '0';
        sent.push(Date.now());
        try { localStorage.setItem(RATE_KEY, JSON.stringify(sent)); } catch (_) { /* private mode */ }
        formStartedAt = 0;
        humanSignals = 0;
      } else {
        showStatus(json.message || 'Something went wrong. Please try again or use WhatsApp.', 'error');
      }
    } catch (err) {
      showStatus(err.name === 'AbortError'
        ? 'The request timed out. Please check your connection and try again.'
        : 'Unable to send right now. Please try again or reach out on WhatsApp.', 'error');
    } finally {
      clearTimeout(timer);
      if (window.hcaptcha && typeof window.hcaptcha.reset === 'function') {
        try { window.hcaptcha.reset(); } catch (_) { /* widget not ready */ }
      }
      submitBtn.disabled = false;
      submitBtn.innerHTML = submitLabel;
    }
  });

  /* ------------------------------------------------------------------ *
   * 8. Interactive Amber Embers & Dust Particles (Mouse + Scroll Down/Up)
   * ------------------------------------------------------------------ */
  (function initParticles() {
    const canvas = $('#particleCanvas');
    if (!canvas || reducedMotion) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let rafId = 0;
    let time = 0;

    let lastScrollY = window.scrollY || 0;
    let scrollVelocity = 0;
    let scrollOffset = lastScrollY;

    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      vx: 0,
      vy: 0,
      active: false,
      presence: 0
    };

    const PALETTE = [
      '219, 155, 62',   // honey-amber (#DB9B3E)
      '235, 178, 88',   // warm gold ember
      '204, 134, 46',   // deep amber
      '244, 218, 170',  // champagne spark
      '172, 112, 38'    // muted bronze dust
    ];

    function buildParticles() {
      particles = [];
      // +300% density: rich 3D multi-layer particle field (480 desktop / 290 mobile)
      const count = width < 768 ? 290 : 480;
      for (let i = 0; i < count; i++) {
        // Non-linear depth distribution: far dust, mid embers, and near 3D bokeh orbs
        const u = ((i * 73 + 19) % 1000) / 1000;
        const z = Math.pow(u, 1.55); // 0 = far background, 1 = close foreground
        const depth = 0.22 + z * 2.15; // parallax speed multiplier

        const isForeground = z > 0.80;
        const isMid = z > 0.35 && !isForeground;
        const isFlake = i % 3 === 0;

        // Distinct size tiers for clear 3D perspective
        let baseSize;
        if (isForeground) {
          baseSize = 3.2 + ((i * 29) % 8) * 0.45; // 3.2px .. 6.35px soft close orbs
        } else if (isMid) {
          baseSize = 1.4 + ((i * 41) % 7) * 0.24; // 1.4px .. 2.84px mid embers
        } else {
          baseSize = 0.65 + ((i * 17) % 5) * 0.14; // 0.65px .. 1.21px distant micro-dust
        }

        particles.push({
          x: ((i * 137.508) % 100) / 100 * width,
          y: ((i * 293.713) % 100) / 100 * height,
          vx: 0,
          vy: 0,
          z,
          depth,
          isForeground,
          isMid,
          driftX: ((((i * 53) % 100) / 50) - 1) * 0.22 * depth,
          driftY: (-0.08 - (((i * 31) % 100) / 100) * 0.28) * depth,
          size: baseSize,
          stretch: isFlake ? (1.35 + (i % 4) * 0.35) : 1.05,
          aspect: isFlake ? (0.42 + (i % 3) * 0.14) : 0.88,
          angle: ((i * 47) % 360) * (Math.PI / 180),
          spin: ((((i * 19) % 100) / 50) - 1) * 0.012 * (0.5 + z),
          baseAlpha: isForeground
            ? (0.22 + (i % 4) * 0.05)
            : isMid
              ? (0.28 + (i % 5) * 0.055)
              : (0.13 + (i % 4) * 0.035),
          phase: i * 0.65,
          rgb: PALETTE[i % PALETTE.length]
        });
      }
      // Sort back-to-front so near 3D particles render over distant dust
      particles.sort((a, b) => a.z - b.z);
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      if (!pointer.active) {
        pointer.x = pointer.targetX = width * 0.5;
        pointer.y = pointer.targetY = height * 0.45;
      }
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', (e) => {
      pointer.vx = e.clientX - pointer.targetX;
      pointer.vy = e.clientY - pointer.targetY;
      pointer.targetX = e.clientX;
      pointer.targetY = e.clientY;
      if (!pointer.active) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      }
      pointer.active = true;
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      pointer.active = false;
    }, { passive: true });

    window.addEventListener('scroll', () => {
      const currentY = window.scrollY || 0;
      const delta = currentY - lastScrollY;
      lastScrollY = currentY;
      // Positive delta = scrolling down -> particles flow up (and vice versa on scroll up)
      scrollVelocity = clamp(scrollVelocity + delta * 0.32, -48, 48);
    }, { passive: true });

    window.addEventListener('wheel', (e) => {
      scrollVelocity = clamp(scrollVelocity + e.deltaY * 0.08, -48, 48);
    }, { passive: true });

    function shouldPause() {
      return document.hidden || (theater && theater.open);
    }

    function tick() {
      if (shouldPause()) {
        rafId = 0;
        return;
      }
      time += 0.016;

      // Smooth cursor following
      pointer.x += (pointer.targetX - pointer.x) * 0.14;
      pointer.y += (pointer.targetY - pointer.y) * 0.14;
      pointer.vx *= 0.86;
      pointer.vy *= 0.86;
      pointer.presence += ((pointer.active ? 1 : 0) - pointer.presence) * 0.08;

      // Smooth scroll velocity decay
      scrollVelocity *= 0.90;
      scrollOffset += scrollVelocity;

      ctx.clearRect(0, 0, width, height);

      const influenceRadius = 240;
      const TWO_PI = Math.PI * 2;
      const margin = 24;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Ambient floating + scroll-up / scroll-down parallax impulse
        const waveX = Math.cos(time * 0.8 + p.phase) * 0.22 * p.depth;
        const waveY = Math.sin(time * 0.7 + p.phase) * 0.18 * p.depth;
        const scrollPushY = -scrollVelocity * 0.42 * p.depth;
        const scrollSwirlX = Math.sin(time * 1.4 + p.phase) * (scrollVelocity * 0.06) * p.depth;

        // Mouse interaction: gentle swirl + wake push + attraction glow
        let mouseForceX = 0;
        let mouseForceY = 0;
        let proximity = 0;

        if (pointer.presence > 0.01) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < influenceRadius && dist > 0.001) {
            const norm = 1 - dist / influenceRadius;
            proximity = pointer.presence * (norm * norm);
            const nx = dx / dist;
            const ny = dy / dist;
            // Subtle breeze push when cursor passes by (no orbiting or clustering around cursor)
            mouseForceX = nx * 0.22 * proximity + pointer.vx * 0.025 * proximity;
            mouseForceY = ny * 0.22 * proximity + pointer.vy * 0.025 * proximity;
          }
        }

        p.vx = (p.vx + mouseForceX) * 0.90;
        p.vy = (p.vy + mouseForceY) * 0.90;

        p.x += p.driftX + waveX + scrollSwirlX + p.vx;
        p.y += p.driftY + waveY + scrollPushY + p.vy;
        p.angle += p.spin + scrollVelocity * 0.002;

        // Wrap seamlessly around viewport edges (both scroll down & scroll up)
        if (p.x < -margin) p.x += width + margin * 2;
        else if (p.x > width + margin) p.x -= width + margin * 2;
        if (p.y < -margin) p.y += height + margin * 2;
        else if (p.y > height + margin) p.y -= height + margin * 2;

        const speedStretch = Math.min(2.2, Math.abs(scrollPushY) * 0.14 + Math.hypot(p.vx, p.vy) * 0.22);
        // 3D tumbling perspective: apparent width modulates with cos(time + phase)
        const tumble = 0.65 + 0.35 * Math.abs(Math.cos(time * 1.3 + p.phase));
        const rx = p.size * (p.stretch + speedStretch * 0.6);
        const ry = Math.max(0.45, p.size * p.aspect * tumble);
        const twinkle = 0.80 + Math.sin(time * 2.2 + p.phase) * 0.20;
        const alpha = Math.min(0.92, (p.baseAlpha * twinkle) + proximity * 0.45 + Math.min(0.22, Math.abs(scrollVelocity) * 0.006));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + (Math.abs(scrollPushY) > 0.8 ? scrollPushY * 0.04 : 0));

        const isLight = document.documentElement.dataset.theme === 'light';
        const rgb = isLight ? '212, 88, 10' : p.rgb;
        const alphaBoost = isLight ? 1.35 : 1;
        const effAlpha = Math.min(0.92, alpha * alphaBoost);

        if (p.isForeground) {
          // Soft 3D depth-of-field bokeh glow for close foreground embers
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.45);
          grad.addColorStop(0, `rgba(${rgb}, ${(effAlpha * 0.95).toFixed(3)})`);
          grad.addColorStop(0.45, `rgba(${rgb}, ${(effAlpha * 0.42).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx * 1.45, ry * 1.45, 0, 0, TWO_PI);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${rgb}, ${effAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, TWO_PI);
          ctx.fill();
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    }

    function resumeIfNeeded() {
      if (!rafId && !shouldPause()) {
        rafId = requestAnimationFrame(tick);
      }
    }

    document.addEventListener('visibilitychange', resumeIfNeeded);
    if (viewer) viewer.addEventListener('close', resumeIfNeeded);
    if (theater) theater.addEventListener('close', resumeIfNeeded);

    resize();
    resumeIfNeeded();
  })();
})();
