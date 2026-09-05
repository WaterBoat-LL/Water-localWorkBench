/* ============================================================
 * 鲸屿工作台 - 海底背景动画
 * 纯 Canvas 2D 程序化海洋背景（气泡、光柱、漂浮微粒、鲸鱼剪影）
 * 无需外部依赖，离线可用
 * ============================================================ */
WB.bg = (() => {
  let canvas, ctx, W, H, raf = null;
  let bubbles = [], particles = [], rays = [], fishes = [];
  let mouse = { x: 0, y: 0 };
  let config = { density: 1, speed: 1 };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function initBubbles() {
    bubbles = [];
    const n = Math.round(W * H / 26000 * config.density);
    for (let i = 0; i < n; i++) {
      bubbles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(1, 7),
        vy: rand(0.2, 1.2) * config.speed,
        vx: rand(-0.2, 0.2),
        a: rand(0.08, 0.4),
        wob: rand(0, Math.PI * 2),
        wobSp: rand(0.01, 0.03),
      });
    }
  }

  function initParticles() {
    particles = [];
    const n = Math.round(W * H / 14000 * config.density);
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(0.5, 2.2),
        a: rand(0.05, 0.35),
        vx: rand(0.1, 0.5) * config.speed,
        vy: rand(-0.3, 0.3),
      });
    }
  }

  function initRays() {
    rays = [];
    const n = 4 + Math.round(rand(0, 3));
    for (let i = 0; i < n; i++) {
      rays.push({
        x: rand(-0.2, 1.0) * W,
        w: rand(60, 160),
        tilt: rand(-0.35, 0.35),
        a: rand(0.03, 0.09),
        sway: rand(0, Math.PI * 2),
      });
    }
  }

  function initFishes() {
    fishes = [];
    for (let i = 0; i < 3; i++) {
      fishes.push({
        x: rand(0, W),
        y: rand(H * 0.3, H * 0.85),
        r: rand(8, 16),
        vx: rand(0.3, 0.9),
        dir: Math.random() > 0.5 ? 1 : -1,
        hue: rand(0, 360),
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 背景渐变（深蓝海底）
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#051f3a');
    g.addColorStop(0.5, '#06294d');
    g.addColorStop(1, '#031426');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 光柱
    for (const ray of rays) {
      ray.sway += 0.002;
      const x = ray.x + Math.sin(ray.sway) * 30;
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(ray.tilt + Math.sin(ray.sway) * 0.05);
      const rg = ctx.createLinearGradient(0, 0, 0, H);
      rg.addColorStop(0, `rgba(160, 220, 255, ${ray.a})`);
      rg.addColorStop(1, 'rgba(160,220,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(-ray.w / 2, 0);
      ctx.lineTo(ray.w / 2, 0);
      ctx.lineTo(ray.w * 1.6, H);
      ctx.lineTo(-ray.w * 1.6, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 漂浮微粒
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x > W + 5) p.x = -5; if (p.x < -5) p.x = W + 5;
      if (p.y > H + 5) p.y = -5; if (p.y < -5) p.y = H + 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(190, 230, 255, ${p.a})`;
      ctx.fill();
    }

    // 气泡
    for (const b of bubbles) {
      b.y -= b.vy;
      b.wob += b.wobSp;
      b.x += b.vx + Math.sin(b.wob) * 0.4;
      if (b.y < -20) { b.y = H + 20; b.x = Math.random() * W; }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 235, 255, ${b.a})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      // 高光
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.min(b.a + 0.15, 0.7)})`;
      ctx.fill();
    }

    // 小鱼群
    for (const f of fishes) {
      f.x += f.vx * f.dir;
      if (f.x > W + 30) f.x = -30; if (f.x < -30) f.x = W + 30;
      f.y += Math.sin(f.x * 0.02) * 0.3;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.dir, 1);
      // 身体
      ctx.beginPath();
      ctx.ellipse(0, 0, f.r, f.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${f.hue}, 70%, 60%, 0.5)`;
      ctx.fill();
      // 尾巴
      ctx.beginPath();
      ctx.moveTo(-f.r * 0.7, 0);
      ctx.lineTo(-f.r * 1.3, -f.r * 0.5);
      ctx.lineTo(-f.r * 1.3, f.r * 0.5);
      ctx.closePath();
      ctx.fillStyle = `hsla(${f.hue}, 70%, 55%, 0.5)`;
      ctx.fill();
      // 眼睛
      ctx.beginPath();
      ctx.arc(f.r * 0.4, -f.r * 0.12, f.r * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
      ctx.restore();
    }

    // 鼠标跟随光晕
    const mx = mouse.x, my = mouse.y;
    if (mx > 0 || my > 0) {
      const rg2 = ctx.createRadialGradient(mx, my, 0, mx, my, 160);
      rg2.addColorStop(0, 'rgba(120, 220, 255, 0.10)');
      rg2.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = rg2;
      ctx.fillRect(mx - 160, my - 160, 320, 320);
    }

    raf = requestAnimationFrame(draw);
  }

  function start(cfg) {
    if (cfg) Object.assign(config, cfg);
    canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    initBubbles(); initParticles(); initRays(); initFishes();
    window.addEventListener('resize', () => { resize(); initBubbles(); initParticles(); initRays(); });
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  return { start, stop };
})();
