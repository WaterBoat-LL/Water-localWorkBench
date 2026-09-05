/* ============================================================
 * 鲸屿工作台 - 个人主页（纯黑 · 三七开 · 左大头像+名字 · 右今日版本迭代预览）
 * ============================================================ */
WB.views.about = (() => {
  const U = WB.util;
  let config = {};

  const CHANGELOG = [
    { v: '2.0.0', date: '2026-09-05', tag: '个人化改版', items: [
      '👤 新增本地账号系统：全黑登录框，多账号切换、头像上传',
      '🎨 背景改为 UI 图 + 鼠标视差；移除 3D 水母动画',
      '🧭 顶栏去白条、悬停高亮，左上角换成用户头像',
      '🖤 个人页重做：纯黑背景、三七开、大头像、今日版本迭代预览',
      '🎬 切换功能时「灭屏 → 亮屏」过渡',
      '🗂️ 建立本地 Git 仓库',
    ] },
    { v: '1.1.0', date: '2026-08-27', tag: 'UI 焕新', items: [
      '🎨 版面重做：科技暗调 + 海洋青点缀',
      '🔘 导航改顶部圆球栏目条，单根横向滚动',
      '🫧 内容区统一单根纵向滚动条，v-show 式高亮切换',
      '👧 鲸鱼娘透明形象图上线',
    ] },
    { v: '1.0.0', date: '2026-08-26', tag: '首发', items: [
      '🐋 全新海洋风 3D 界面，鲸鱼娘登场',
      '💰 API 余额查询：DeepSeek / OpenAI / OpenRouter / 通用兼容',
      '📝 每日备忘录：日历 + 农历',
      '🔗 课业网址快捷入口',
      '🗂️ 项目笔记栏',
      '🧰 常用工具：透明底色擦除器 + 计算器',
      '🎮 游戏栏：接珍珠 / 猜数 / 翻翻乐 / 石头剪刀布',
    ] },
  ];

  async function render() {
    config = (await WB.api.getConfig()) || {};
    const info = await WB.api.appInfo().catch(() => ({}));
    const about = config.about || {};
    const me = (typeof WB.login !== 'undefined' && WB.login.currentUser) ? WB.login.currentUser() : null;

    const name = (me && me.name) || about.whaleName || 'WaterBoat';
    const avatar = (me && me.avatar) || '';
    const handle = (me && me.name) || 'WaterBoat-LL';
    const avatarHtml = avatar ? `<img src="${U.esc(avatar)}" alt="" />` : `<span class="ua-letter">${U.esc(name.slice(0, 1))}</span>`;

    root().innerHTML = `
      <div class="profile-dark">
        <div class="p-profile">
          <div class="p-left">
            <div class="p-avatar">${avatarHtml}</div>
            <div class="p-name">${U.esc(name)}</div>
            <div class="p-handle">${U.esc(handle)}</div>
            <div class="p-bio">${U.esc(about.selfIntro || 'A code freshman · 这是我用 AI 和主人一起做的第一个工作台')}</div>
            <button class="btn btn-primary-soft btn-mini" id="about-edit-intro">✏️ Edit profile</button>
          </div>
          <div class="p-right">
            <div class="p-preview-head">
              <h4 class="p-preview-title">📅 今日版本迭代预览</h4>
              <span class="p-ver-badge">v${U.esc(info.version || '2.0.0')}</span>
            </div>
            <div class="p-preview-sub">${U.esc(info.name || '鲸屿工作台')} · Electron ${U.esc(info.electron || '—')} / Chromium ${U.esc(info.chrome || '—')} / Node ${U.esc(info.node || '—')}</div>

            <div class="changelog">
              ${CHANGELOG.map((c, i) => `
                <div class="cl-item">
                  <div class="cl-marker"></div>
                  <div class="cl-body">
                    <div class="cl-head">
                      <span class="cl-ver">v${c.v}</span>
                      <span class="cl-date">${c.date}</span>
                      <span class="cl-tag">${c.tag}</span>
                    </div>
                    <ul class="cl-list">${c.items.map((it) => `<li>${U.esc(it)}</li>`).join('')}</ul>
                  </div>
                </div>`).join('')}
            </div>

            <div class="p-thanks">💙 特别感谢：主人 WaterBoat-LL 的老站 <strong>TOOLBOX_Lully</strong> 给了鲸鱼设计灵感。</div>
          </div>
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

  function root() { return document.getElementById('view-about'); }

  return { render };
})();
