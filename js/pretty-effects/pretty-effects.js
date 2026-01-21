/* global CONFIG */

(function() {
  'use strict';

  const state = {
    sakura: null,
    trail: null,
    raf: null,
    lastInitKey: ''
  };

  const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchLike = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => min + Math.random() * (max - min);

    const resolveAssetUrl = (url) => {
      const u = String(url || '').trim();
      if (!u) return '';
      if (/^https?:\/\//i.test(u) || /^data:/i.test(u) || /^blob:/i.test(u)) return u;
      if (u.startsWith('/')) {
        const root = (window.CONFIG && window.CONFIG.root) ? String(window.CONFIG.root) : '/';
        return root.replace(/\/$/, '/') + u.replace(/^\//, '');
      }
      return u;
    };

  const ensureCanvas = (id, zIndex) => {
    let canvas = document.getElementById(id);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = id;
      canvas.className = 'pretty-effects-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
    }
    canvas.style.zIndex = String(zIndex);
    return canvas;
  };

  const fitCanvas = (canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, ctx };
  };

  const applyBackgroundVars = (cfg) => {
    const bg = (cfg && cfg.background) || {};
    if (!bg.enable) return;

    const el = document.getElementById('pretty-bg');
    if (!el) return;

    const root = document.documentElement;

    const fixed = bg.fixed !== false;
    el.style.backgroundAttachment = fixed ? 'fixed' : 'scroll';

      if (bg.image) root.style.setProperty('--pretty-bg-image', `url("${resolveAssetUrl(bg.image)}")`);
    if (bg.position) root.style.setProperty('--pretty-bg-position', bg.position);
    if (bg.repeat) root.style.setProperty('--pretty-bg-repeat', bg.repeat);
    if (bg.size) root.style.setProperty('--pretty-bg-size', bg.size);

    root.style.setProperty('--pretty-bg-opacity', String(clamp(Number(bg.opacity ?? 0.75), 0, 1)));
    root.style.setProperty('--pretty-bg-blur', `${Math.max(0, Number(bg.blur_px ?? 0))}px`);
    root.style.setProperty('--pretty-bg-brightness', String(Math.max(0, Number(bg.brightness ?? 1))));
    root.style.setProperty('--pretty-bg-saturate', String(Math.max(0, Number(bg.saturate ?? 1))));

    const overlay = bg.overlay || {};
    if (overlay.enable === false) {
      root.style.setProperty('--pretty-bg-overlay-opacity', '0');
    } else {
      root.style.setProperty('--pretty-bg-overlay-opacity', String(clamp(Number(overlay.opacity ?? 0.2), 0, 1)));
    }
  };

  // ---------------------- Sakura ----------------------

  const createSakura = (cfg) => {
    const sakuraCfg = cfg.sakura || {};
    const canvas = ensureCanvas('pretty-sakura-canvas', sakuraCfg.z_index ?? 9999);
    let { w, h, ctx } = fitCanvas(canvas);

    let img = null;
      const imageUrl = resolveAssetUrl((sakuraCfg.image || '').trim());
    if (imageUrl) {
      img = new Image();
      img.decoding = 'async';
      img.src = imageUrl;
    }

    const count = clamp(Number(sakuraCfg.count ?? 42), 0, 200);
    const petals = [];

    const reset = (p, initial = false) => {
      p.x = rand(0, w);
      p.y = initial ? rand(0, h) : rand(-h * 0.2, -20);
      p.vy = rand(Number(sakuraCfg.speed_min ?? 0.6), Number(sakuraCfg.speed_max ?? 1.8));
      p.vx = rand(-0.35, 0.35);
      p.size = rand(Number(sakuraCfg.size_min ?? 8), Number(sakuraCfg.size_max ?? 18));
      p.rot = rand(0, Math.PI * 2);
      p.rotSpeed = rand(-0.02, 0.02);
      p.opacity = rand(0.45, 0.95);
      p.swing = rand(0.6, 1.8);
      p.swingPhase = rand(0, Math.PI * 2);
    };

    for (let i = 0; i < count; i++) {
      const p = {};
      reset(p, true);
      petals.push(p);
    }

    const onResize = () => {
      ({ w, h, ctx } = fitCanvas(canvas));
    };

    window.addEventListener('resize', onResize, { passive: true });

    const drawPetalShape = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (sakuraCfg.rotation !== false) ctx.rotate(p.rot);

      const s = p.size;
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = 'rgba(255, 170, 205, 0.9)';
      ctx.beginPath();
      // Simple petal-like bezier shape
      ctx.moveTo(0, -s * 0.9);
      ctx.bezierCurveTo(s * 0.7, -s * 0.9, s * 0.9, -s * 0.1, 0, s);
      ctx.bezierCurveTo(-s * 0.9, -s * 0.1, -s * 0.7, -s * 0.9, 0, -s * 0.9);
      ctx.closePath();
      ctx.fill();

      // subtle highlight
      ctx.globalAlpha = p.opacity * 0.35;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.15, -s * 0.15, s * 0.18, s * 0.5, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawPetalImage = (p) => {
      if (!img || !img.complete || !img.naturalWidth) {
        drawPetalShape(p);
        return;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      if (sakuraCfg.rotation !== false) ctx.rotate(p.rot);
      ctx.globalAlpha = p.opacity;
      const s = p.size;
      ctx.drawImage(img, -s, -s, s * 2, s * 2);
      ctx.restore();
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      const wind = Number(sakuraCfg.wind ?? 0.35);

      for (const p of petals) {
        p.swingPhase += 0.02;
        p.x += p.vx + wind + Math.sin(p.swingPhase) * 0.35 * p.swing;
        p.y += p.vy;
        p.rot += p.rotSpeed;

        if (p.y > h + 40 || p.x < -60 || p.x > w + 60) {
          reset(p, false);
        }

        if (img) drawPetalImage(p);
        else drawPetalShape(p);
      }
    };

    return {
      canvas,
      tick,
      destroy() {
        window.removeEventListener('resize', onResize);
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  };

  // ---------------------- Cursor Trail ----------------------

  const createTrail = (cfg) => {
    const trailCfg = cfg.cursor_trail || {};
    const canvas = ensureCanvas('pretty-trail-canvas', trailCfg.z_index ?? 9998);
    let { w, h, ctx } = fitCanvas(canvas);

    const maxPoints = clamp(Number(trailCfg.max_points ?? 80), 0, 400);
    const lifeMs = clamp(Number(trailCfg.life_ms ?? 550), 50, 5000);
    const size = clamp(Number(trailCfg.size ?? 10), 1, 60);
    const glow = clamp(Number(trailCfg.glow ?? 18), 0, 120);
    const colors = Array.isArray(trailCfg.colors) && trailCfg.colors.length ? trailCfg.colors : ['#ff9ecf', '#ffd1e8', '#ffffff'];

    const points = [];
    let lastMoveTs = 0;

    const onMove = (ev) => {
      const now = performance.now();
      lastMoveTs = now;

      const x = ev.clientX;
      const y = ev.clientY;

      points.push({ x, y, t: now, c: colors[points.length % colors.length] });
      if (points.length > maxPoints) points.splice(0, points.length - maxPoints);
    };

    const onResize = () => {
      ({ w, h, ctx } = fitCanvas(canvas));
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    const tick = () => {
      const now = performance.now();
      ctx.clearRect(0, 0, w, h);

      // If no movement, still decay old points
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        const age = now - p.t;
        if (age > lifeMs) points.splice(i, 1);
      }

      for (const p of points) {
        const age = now - p.t;
        const k = 1 - age / lifeMs;
        const r = size * (0.4 + 0.6 * k);
        const a = 0.35 * k;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // glow
        if (glow > 0) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r + glow);
          g.addColorStop(0, hexToRgba(p.c, a));
          g.addColorStop(1, hexToRgba(p.c, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + glow, 0, Math.PI * 2);
          ctx.fill();
        }

        // core
        ctx.fillStyle = hexToRgba(p.c, a * 1.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // If user stopped moving, the trail will fade naturally
      if (points.length === 0 && now - lastMoveTs > lifeMs) {
        // nothing
      }
    };

    return {
      canvas,
      tick,
      destroy() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('resize', onResize);
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  };

  const hexToRgba = (hex, alpha) => {
    const h = String(hex || '').trim();
    if (!h.startsWith('#')) return `rgba(255,255,255,${alpha})`;
    let r, g, b;
    if (h.length === 4) {
      r = parseInt(h[1] + h[1], 16);
      g = parseInt(h[2] + h[2], 16);
      b = parseInt(h[3] + h[3], 16);
    } else if (h.length === 7) {
      r = parseInt(h.slice(1, 3), 16);
      g = parseInt(h.slice(3, 5), 16);
      b = parseInt(h.slice(5, 7), 16);
    } else {
      return `rgba(255,255,255,${alpha})`;
    }
    return `rgba(${r},${g},${b},${alpha})`;
  };

  // ---------------------- Orchestrator ----------------------

  const destroyAll = () => {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;

    if (state.sakura) state.sakura.destroy();
    if (state.trail) state.trail.destroy();

    state.sakura = null;
    state.trail = null;
  };

  const init = () => {
    const cfg = (window.CONFIG && window.CONFIG.pretty_effects) ? window.CONFIG.pretty_effects : null;
    if (!cfg || !cfg.enable) {
      destroyAll();
      return;
    }

    if (!cfg.ignore_reduced_motion && prefersReducedMotion()) {
      destroyAll();
      return;
    }

    applyBackgroundVars(cfg);

    const disableTouch = isTouchLike();

    // Build an init key to avoid redundant rebuilds
    const key = JSON.stringify({
      sakura: cfg.sakura,
      trail: cfg.cursor_trail,
      disableTouch
    });

    if (key === state.lastInitKey && (state.sakura || state.trail)) return;
    state.lastInitKey = key;

    destroyAll();

    if (cfg.sakura && cfg.sakura.enable) {
      state.sakura = createSakura(cfg);
    }

    if (cfg.cursor_trail && cfg.cursor_trail.enable) {
      if (!(cfg.cursor_trail.disable_on_touch !== false && disableTouch)) {
        state.trail = createTrail(cfg);
      }
    }

    const loop = () => {
      if (state.sakura) state.sakura.tick();
      if (state.trail) state.trail.tick();
      state.raf = requestAnimationFrame(loop);
    };

    state.raf = requestAnimationFrame(loop);
  };

  // Init for normal load + PJAX navigation
  document.addEventListener('page:loaded', init);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // In case page:loaded already fired (rare)
    setTimeout(init, 0);
  }
})();
