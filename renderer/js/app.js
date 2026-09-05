/* ============================================================
 * 鲸屿工作台 - 应用主逻辑（路由 / 启动 / 登录 / 视差背景 / 屏幕过渡）
 * ============================================================ */
(() => {
  const U = WB.util;
  let currentView = 'home';
  const VIEWS = ['home', 'balance', 'memo', 'schedule', 'links', 'notes', 'tools', 'git', 'games', 'about'];
  let launching = true;
  let currentUser = null;

  /* ---------- 视图切换 + 灭屏→亮屏过渡 ---------- */
  function renderView(view) {
    document.querySelectorAll('.ball').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach((s) => s.classList.remove('active'));
    const sec = document.getElementById('view-' + view);
    if (sec) sec.classList.add('active');
    const runner = {
      home: () => WB.views.home.render(),
      balance: () => WB.views.balance.render(),
      memo: () => WB.views.memo.render(),
      schedule: () => WB.views.schedule.render(),
      links: () => WB.views.links.render(),
      notes: () => WB.views.notes.render(),
      tools: () => WB.views.tools.render(),
      git: () => WB.views.git.render(),
      games: () => WB.views.games.render(),
      about: () => WB.views.about.render(),
    };
    (runner[view] || runner.home)();
    const active = document.querySelector('.ball.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function nav(view, opts) {
    const { fade } = opts || {};
    if (fade === false) { currentView = view; renderView(view); return; }
    const sf = document.getElementById('screen-fade');
    if (!sf) { currentView = view; renderView(view); return; }
    // 灭屏
    sf.classList.add('on');
    setTimeout(() => {
      currentView = view;
      renderView(view);
      // 亮屏（过渡动画在 CSS 里 <1s）
      requestAnimationFrame(() => requestAnimationFrame(() => sf.classList.remove('on')));
    }, 240);
  }
  WB.nav = nav;

  /* ---------- 时钟 ---------- */
  function tickClock() {
    const el = document.getElementById('foot-clock');
    if (!el) return;
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /* ---------- 背景视差（跟随鼠标，图片视角滑动） ---------- */
  function setupParallax() {
    const bg = document.getElementById('bg-parallax');
    if (!bg) return;
    let raf = null;
    addEventListener('mousemove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const x = e.clientX / innerWidth - 0.5;
        const y = e.clientY / innerHeight - 0.5;
        bg.style.transform = `translate(${(-x * 34).toFixed(1)}px, ${(-y * 24).toFixed(1)}px) scale(1.12)`;
        raf = null;
      });
    });
  }

  /* ---------- 用户头像菜单 ---------- */
  function renderUserMenu() {
    const menu = document.getElementById('user-menu');
    if (!menu) return;
    menu.innerHTML = `
      <button class="um-item" data-act="avatar">📷 上传头像</button>
      <button class="um-item" data-act="about">👤 我的主页</button>
      <div class="um-sep"></div>
      <button class="um-item" data-act="logoff">🚪 切换账号</button>`;
    menu.hidden = false;
    menu.querySelectorAll('.um-item').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = true; ;
        const act = b.dataset.act;
        if (act === 'avatar') uploadAvatar();
        else if (act === 'about') nav('about');
        else if (act === 'logoff') logoff();
      });
    });
  }
  function setupUserMenu() {
    const av = document.getElementById('user-avatar');
    const menu = document.getElementById('user-menu');
    if (!av || !menu) return;
    av.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden ? renderUserMenu() : (menu.hidden = true); });
    addEventListener('click', () => { menu.hidden = true; });
  }

  async function uploadAvatar() {
    if (!currentUser) return;
    const r = await window.workbench.openImageDialog();
    if (!r || !r.url) { U.toast('未选择图片', 'info'); return; }
    const res = await window.workbench.userUpdate({ id: currentUser.id, avatar: r.url });
    if (res.ok) { currentUser = res.user; WB.login.setCurrent(currentUser); U.toast('头像已更新', 'ok'); }
  }

  async function logoff() {
    await window.workbench.userLogoff();
    WB.login.setCurrent(null);
    WB.login.show(async (u) => { currentUser = u; WB.login.setCurrent(u); nav('home', { fade: false }); });
  }

  /* ---------- 启动 ---------- */
  async function boot() {
    const info = await WB.api.appInfo().catch(() => ({ version: '1.0.0' }));
    document.getElementById('splash-ver').textContent = info.version || '1.0.0';
    document.getElementById('side-ver').textContent = info.version || '1.0.0';

    setupParallax();

    document.querySelectorAll('.ball').forEach((b) => {
      b.addEventListener('click', () => nav(b.dataset.view));
    });

    tickClock();
    setInterval(tickClock, 1000);
    setupUserMenu();

    // 恢复登录状态或进入登录界面
    const s = await window.workbench.sessionGet().catch(() => ({ user: null }));
    if (s && s.user) {
      currentUser = s.user;
      WB.login.setCurrent(currentUser);
      nav('home', { fade: false });
    } else {
      WB.login.show(async (u) => {
        currentUser = u;
        WB.login.setCurrent(u);
        nav('home', { fade: false });
        U.toast(`欢迎，${u.name}！`, 'ok');
      });
    }

    // 启动画面淡出
    setTimeout(() => {
      const sp = document.getElementById('splash');
      if (sp) { sp.classList.add('hide'); setTimeout(() => sp.remove(), 900); }
    }, 1200);
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
