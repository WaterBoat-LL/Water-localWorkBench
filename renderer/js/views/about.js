/* ============================================================
 * 鲸屿工作台 - 个人主页（change 风格） + 版本预览
 * ============================================================ */
WB.views.about = (() => {
  const U = WB.util;
  let config = {};
  let notes = [];

  const CHANGELOG = [
    { v: '2.0.0', date: '2026-09-05', tag: '个人化改版', items: [
      '👤 新增本地账号系统：全黑登录框，支持多账号切换、头像上传',
      '🎨 背景改为自定义 UI 图，随鼠标做视差滑动；移除 3D 水母动画',
      '🧭 顶栏去白条、悬停高亮，左上角换成当前用户头像',
      '🖤 个人页改造成深色个人主页（头像 + 项目卡 + 贡献热力图）',
      '🎬 切换功能时 1 秒内「灭屏 → 亮屏」过渡',
      '🗂️ 建立本地 Git 仓库，开始版本管理',
    ] },
    { v: '1.1.0', date: '2026-08-27', tag: 'UI 焕新', items: [
      '🎨 版面重做：科技暗调 + 海洋青点缀，更大气极简',
      '🔘 导航改顶部圆球栏目条，所有栏目圆球化，单根横向滚动',
      '🫧 内容区统一单根纵向滚动条，栏目 v-show 式高亮切换',
      '👧 鲸鱼娘透明形象图上线，背景模糊前后层',
    ] },
    { v: '1.0.0', date: '2026-08-26', tag: '首发', items: [
      '🐋 全新海洋风 3D 界面，鲸鱼娘登场',
      '💰 API 余额查询：DeepSeek / OpenAI / OpenRouter / 通用兼容',
      '📝 每日备忘录：日历选日期 + 新建备忘 + 农历',
      '🔗 课业网址快捷入口：分类管理 + 一键打开',
      '🗂️ 项目笔记栏：记录项目 + 图片上传',
      '🧰 常用工具：透明底色擦除器 + 小型计算机',
      '🎮 游戏栏：接珍珠 / 猜鲸鱼想的数 / 海底翻翻乐 / 石头剪刀布',
    ] },
  ];

  const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

  async function render() {
    config = (await WB.api.getConfig()) || {};
    const info = await WB.api.appInfo().catch(() => ({}));
    const about = config.about || {};
    const me = (typeof WB.login !== 'undefined' && WB.login.currentUser) ? WB.login.currentUser() : null;
    try { notes = Array.isArray(await WB.api.getNotes()) ? (await WB.api.getNotes()) : []; } catch (e) { notes = []; }

    const name = (me && me.name) || about.whaleName || 'WaterBoat';
    const handle = about.selfIntro ? '' : 'WaterBoat-LL';
    const avatar = (me && me.avatar) || '';
    const avatarHtml = avatar ? `<img src="${U.esc(avatar)}" alt="" />` : `<span class="ua-letter">${U.esc(name.slice(0, 1))}</span>`;

    root().innerHTML = `
      <div class="profile-dark">
        <div class="p-profile">
          <div class="p-left">
            <div class="p-avatar">${avatarHtml}</div>
            <div class="p-name">${U.esc(name)}</div>
            <div class="p-handle">${U.esc(handle)}</div>
            <div class="p-bio">${U.esc(about.selfIntro || 'A code freshman · 这是我用 AI 和主人一起做的第一个工作台')}</div>
            <span class="p-edit"><button class="btn btn-primary-soft btn-mini" id="about-edit-intro">✏️ Edit profile</button></span>
          </div>
          <div class="p-right">
            <h4>Popular repositories</h4>
            ${repoCards()}
            <div class="p-contrib-head">
              <h4>136 contributions in the last year</h4>
              <span class="p-settings">Contribution settings ▾</span>
            </div>
            <div class="p-card p-heatmap">${heatmap()}</div>
            <div class="p-legend">Less <i style="background:#1a2b1a"></i><i style="background:#0e4429"></i><i style="background:#26a641"></i><i style="background:#39d353"></i> More</div>
            <div class="p-activity-title">Contribution activity</div>
            <div class="p-month">September 2026</div>
            <div class="p-noact">${me ? (me.name) : 'WaterBoat-LL'} has no activity yet for this period.</div>
            <div class="p-more">Show more activity</div>
          </div>
        </div>

        <div class="about-version">
          <h4 class="about-version-title">🕹️ 版本预览</h4>
          <div class="ver-now">
            <span class="ver-badge">v${U.esc(info.version || '2.0.0')}</span>
            <span class="ver-name">${U.esc(info.name || '鲸屿工作台')}</span>
          </div>
          <div class="ver-tech">
            <span>Electron ${U.esc(info.electron || '—')}</span>
            <span>Chromium ${U.esc(info.chrome || '—')}</span>
            <span>Node ${U.esc(info.node || '—')}</span>
            <span>${U.esc(info.platform || '')} ${U.esc(info.arch || '')}</span>
          </div>
        </div>

        <div class="about-version">
          <h4 class="about-version-title">📜 更新日志</h4>
          <div class="changelog">
            ${CHANGELOG.map((c) => `
              <div class="cl-item">
                <div class="cl-marker"></div>
                <div class="cl-body">
                  <div class="cl-head">
                    <span class="cl-ver">v${c.v}</span>
                    <span class="cl-date">${c.date}</span>
                    <span class="cl-tag">${c.tag}</span>
                  </div>
                  <ul class="cl-list">${c.items.map((i) => `<li>${U.esc(i)}</li>`).join('')}</ul>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div class="about-version">
          <h4 class="about-version-title">💙 特别感谢</h4>
          <p class="about-thanks">主人 WaterBoat-LL 的老站 <strong>TOOLBOX_Lully</strong> 给了鲸鱼设计灵感，这个桌面工作台是主人和鲸鱼娘一起做的第一个正经项目~ 以后也会一起做更多好玩的东西！</p>
        </div>
      </div>
    `;

    document.getElementById('about-edit-intro').addEventListener('click', () => {
      const m = U.modal({ title: '编辑自我介绍', width: '480px' });
      m.body.innerHTML = `
        <textarea class="input area" id="ai-text" rows="5" placeholder="介绍一下自己吧~">${U.esc(about.selfIntro || '')}</textarea>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="ai-cancel">取消</button>
          <button class="btn btn-primary" id="ai-save">保存</button>
        </div>`;
      m.body.querySelector('#ai-cancel').addEventListener('click', () => m.close());
      m.body.querySelector('#ai-save').addEventListener('click', async () => {
        const text = m.body.querySelector('#ai-text').value.trim();
        const cfg = await WB.api.getConfig();
        cfg.about = cfg.about || {};
        cfg.about.selfIntro = text;
        await WB.api.saveConfig(cfg);
        m.close();
        render();
        U.toast('自我介绍已保存', 'ok');
      });
    });
  }

  function repoCards() {
    const repos = notes.slice(0, 3).map((n) => ({
      name: n.title || '未命名项目',
      desc: (n.content || n.text || '').slice(0, 40) || '这是一个项目笔记',
      lang: 'HTML',
      stars: n.tags ? n.tags.length : 0,
    }));
    if (!repos.length) {
      repos.push({ name: 'lightligh-', desc: '这是LL设计的网页集', lang: 'HTML', stars: 3 });
    }
    return repos.map((r) => `
      <div class="p-card">
        <span class="p-repo-pub">Public</span>
        <div class="p-repo-name">${U.esc(r.name)}</div>
        <div class="p-repo-desc">${U.esc(r.desc)}</div>
        <div class="p-repo-meta">● ${U.esc(r.lang)} &nbsp; ⭐ ${r.stars}</div>
      </div>`).join('');
  }

  function heatmap() {
    // 12 个月 × 3 行（Mon/Wed/Fri），绿色贡献格
    let html = '<div style="display:grid;grid-template-columns:30px repeat(52,1fr);gap:3px;align-items:center;">';
    html += `<span></span>` + MONTHS.map((m) => `<span style="font-size:10px;color:#7d8794;text-align:center;">${m}</span>`).join('');
    const rows = ['Mon', 'Wed', 'Fri'];
    for (let r = 0; r < 3; r++) {
      html += `<span style="font-size:10px;color:#7d8794;">${rows[r]}</span>`;
      for (let c = 0; c < 52; c++) {
        const has = ((r * 7 + c * 3) % 11) < 4;
        const col = has ? (c % 3 === 0 ? '#26a641' : (c % 3 === 1 ? '#0e4429' : '#39d353')) : '#161b22';
        html += `<span style="width:10px;height:10px;border-radius:2px;background:${col};"></span>`;
      }
    }
    html += '</div>';
    return html;
  }

  function root() { return document.getElementById('view-about'); }

  return { render };
})();
