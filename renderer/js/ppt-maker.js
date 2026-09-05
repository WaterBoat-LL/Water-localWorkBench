/* ============================================================
 * 鲸屿工作台 - AI 生成 PPT 工具
 * 一句话/大纲 → DeepSeek 扩写 → dsh-ppt 渲染为 PPT 式 HTML（可选 AI 生图）
 * ============================================================ */
WB.pptMaker = (() => {
  const U = WB.util;

  const LAYOUT_ICON = {
    cover: '🫧', section: '🔰', bullets: '·', statement: '✨', closing: '🐋',
  };

  /* ================= 打开工具 ================= */
  async function open() {
    const m = U.modal({ title: '🎬 AI 生成 PPT', width: '1080px' });
    m.body.innerHTML = `
      <div class="ppt-maker">
        <div class="ppt-form glass-inner">
          <label class="field full">
            <span class="field-label">主题 / 提示词</span>
            <textarea class="input area" id="pm-prompt" rows="3"
              placeholder="一句话或大纲，例：用 AI 帮初中生做一份关于海洋保护的科普 PPT"></textarea>
          </label>
          <div class="form-grid">
            <label class="field"><span class="field-label">标题（可选）</span>
              <input class="input" id="pm-title" placeholder="留空则自动生成" />
            </label>
            <label class="field"><span class="field-label">视觉主题</span>
              <select class="input" id="pm-theme"></select>
            </label>
            <label class="field"><span class="field-label">界面语言</span>
              <select class="input" id="pm-lang">
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="bilingual">中英双语</option>
              </select>
            </label>
            <label class="field"><span class="field-label">页数上限</span>
              <select class="input" id="pm-slides">
                <option value="5">5 页</option>
                <option value="6" selected>6 页</option>
                <option value="8">8 页</option>
                <option value="10">10 页</option>
                <option value="12">12 页</option>
              </select>
            </label>
            <label class="field"><span class="field-label">内容扩写账号 <em class="field-tip">（DeepSeek/通义千问等）</em></span>
              <select class="input" id="pm-account"></select>
            </label>
            <label class="field"><span class="field-label">扩写模型 <em class="field-tip">（默认用账号模型）</em></span>
              <input class="input" id="pm-model" placeholder="如 qwen-plus / deepseek-chat" />
            </label>
            <label class="field"><span class="field-label">AI 配图</span>
              <select class="input" id="pm-img">
                <option value="off" selected>关闭</option>
                <option value="cover">仅封面</option>
                <option value="all">全部页面</option>
              </select>
            </label>
            <label class="field"><span class="field-label">配图服务</span>
              <button class="btn btn-ghost btn-mini" id="pm-imgcfg">⚙ 配置配图服务</button>
            </label>
          </div>
        </div>

        <div class="ppt-actions">
          <button class="btn btn-primary" id="pm-gen">🌈 一键生成</button>
          <span class="ppt-status" id="pm-status"></span>
        </div>

        <div class="ppt-result" id="pm-result" hidden>
          <div class="ppt-result-head">
            <div class="ppt-title" id="pm-r-title"></div>
            <div class="ppt-meta" id="pm-r-meta"></div>
          </div>
          <div class="ppt-slide-list" id="pm-slides"></div>
          <div class="ppt-foot">
            <button class="btn btn-primary-soft" id="pm-play">▶ 演示窗口</button>
            <button class="btn btn-ghost" id="pm-browser">🌐 浏览器打开</button>
            <button class="btn btn-ghost" id="pm-print">🖨 打印 / PDF</button>
            <button class="btn btn-ghost" id="pm-folder">📂 打开文件夹</button>
          </div>
        </div>

        <div class="ppt-history" id="pm-history"></div>
      </div>
    `;

    // 绑定
    const q = (id) => m.body.querySelector(id);
    await loadThemes(q('#pm-theme'));
    await loadAccounts(q('#pm-account'));
    await restoreImageConfig();
    refreshHistory(m);

    q('#pm-gen').addEventListener('click', () => generate(m));
    q('#pm-imgcfg').addEventListener('click', () => imageConfigModal(m));
    q('#pm-play').addEventListener('click', () => openDeck(m, {}));
    q('#pm-print').addEventListener('click', () => openDeck(m, { print: true }));
    q('#pm-browser').addEventListener('click', () => openPath(m, 'open'));
    q('#pm-folder').addEventListener('click', () => openPath(m, 'folder'));
  }

  /* ================= 主题加载 ================= */
  async function loadThemes(sel) {
    let themes = [{ id: 'data', name: '数据漂移', bestFor: 'AI·技术' }];
    try {
      themes = (await window.workbench.pptThemes()) || themes;
    } catch (e) { /* 忽略 */ }
    sel.innerHTML = themes.map((t) =>
      `<option value="${U.esc(t.id)}">${U.esc(t.name)}｜${U.esc(t.bestFor || '')}</option>`
    ).join('');
  }

  /* ================= 扩写账号加载 ================= */
  const ACCT_LABEL = { deepseek: 'DeepSeek', dashscope: '通义千问', siliconflow: '硅基流动', openai: 'OpenAI', openrouter: 'OpenRouter', custom: '兼容' };
  async function loadAccounts(sel) {
    let accounts = [];
    try { accounts = ((await WB.api.getConfig()).apiAccounts) || []; } catch (e) { accounts = []; }
    const none = { id: '', name: '自动（DeepSeek/通义）' };
    sel.innerHTML = [none].concat(accounts).map((a) =>
      `<option value="${U.esc(a.id || '')}">${U.esc(a.name || a.id)}${a.type ? ' · ' + (ACCT_LABEL[a.type] || a.type) : ''}</option>`
    ).join('');
  }

  /* ================= 配图服务配置 ================= */
  async function getPptConfig() {
    const cfg = await WB.api.getConfig();
    if (!cfg.ppt) cfg.ppt = { imageGen: { enabled: false, baseUrl: '', apiKey: '', model: '', size: '1024x1024' } };
    if (!cfg.ppt.imageGen) cfg.ppt.imageGen = { enabled: false, baseUrl: '', apiKey: '', model: '', size: '1024x1024' };
    return cfg;
  }

  async function restoreImageConfig() {
    try {
      const cfg = await getPptConfig();
      const g = cfg.ppt.imageGen;
      const btn = document.getElementById('pm-imgcfg');
      const imgSel = document.getElementById('pm-img');
      if (btn && g.enabled && g.baseUrl && g.apiKey) btn.textContent = '⚙ 已配置 ✓';
      if (imgSel && g.enabled && g.baseUrl && g.apiKey && imgSel.value === 'off') imgSel.value = 'cover';
    } catch (e) { /* 忽略 */ }
  }

  function imageConfigModal(m) {
    const sm = U.modal({ title: '⚙ 配图服务设置', width: '520px' });
    sm.body.innerHTML = `
      <p class="cfg-note">开启后为 PPT 配图。千问/百炼：baseUrl 填 <b>https://dashscope.aliyuncs.com</b>，模型填 <b>wanx-v1</b>（或 qwen-image）；其它 OpenAI 兼容：baseUrl 填含 /v1 的地址（如 https://api.openai.com/v1）。</p>
      <div class="form-grid">
        <label class="field full"><span class="field-label">启用</span>
          <select class="input" id="ic-enabled"><option value="false">关闭</option><option value="true">开启</option></select>
        </label>
        <label class="field full"><span class="field-label">接口 baseUrl</span>
          <input class="input" id="ic-base" placeholder="https://dashscope.aliyuncs.com / 或 https://xxx.com/v1" />
        </label>
        <label class="field full"><span class="field-label">API Key</span>
          <input class="input" id="ic-key" type="password" placeholder="sk-..." />
        </label>
        <label class="field"><span class="field-label">模型名</span>
          <input class="input" id="ic-model" placeholder="wanx-v1 / dall-e-3 / 你的模型" />
        </label>
        <label class="field"><span class="field-label">尺寸</span>
          <select class="input" id="ic-size">
            <option value="1024x1024">1024×1024</option>
            <option value="1024x1792">1024×1792</option>
            <option value="1792x1024">1792×1024</option>
            <option value="512x512">512×512</option>
          </select>
        </label>
      </div>
      <div class="modal-foot">
        <span class="ic-test-status" id="ic-test-status"></span>
        <button class="btn btn-ghost" id="ic-test">⚡ 测试连接</button>
        <button class="btn btn-ghost" id="ic-cancel">取消</button>
        <button class="btn btn-primary" id="ic-save">保存</button>
      </div>
    `;

    getPptConfig().then((cfg) => {
      const g = cfg.ppt.imageGen;
      sm.body.querySelector('#ic-enabled').value = String(!!g.enabled);
      sm.body.querySelector('#ic-base').value = U.esc(g.baseUrl || '');
      sm.body.querySelector('#ic-key').value = U.esc(g.apiKey || '');
      sm.body.querySelector('#ic-model').value = U.esc(g.model || '');
      sm.body.querySelector('#ic-size').value = g.size || '1024x1024';
    });

    sm.body.querySelector('#ic-cancel').addEventListener('click', () => sm.close());
    sm.body.querySelector('#ic-test').addEventListener('click', async () => {
      const statusEl = sm.body.querySelector('#ic-test-status');
      const cfg = {
        enabled: sm.body.querySelector('#ic-enabled').value === 'true',
        baseUrl: sm.body.querySelector('#ic-base').value.trim(),
        apiKey: sm.body.querySelector('#ic-key').value.trim(),
        model: sm.body.querySelector('#ic-model').value.trim(),
        size: sm.body.querySelector('#ic-size').value,
      };
      if (!cfg.baseUrl || !cfg.apiKey) {
        statusEl.textContent = '请先填 baseUrl 和 API Key';
        statusEl.className = 'ic-test-status err';
        return;
      }
      statusEl.textContent = '正在测试（约 10~30 秒）…';
      statusEl.className = 'ic-test-status busy';
      try {
        const r = await window.workbench.pptTestImage(cfg);
        if (r && r.ok) {
          statusEl.textContent = '✅ 成功，配置可用！';
          statusEl.className = 'ic-test-status ok';
          U.toast('配图服务测试成功', 'ok');
        } else {
          statusEl.textContent = '❌ ' + ((r && r.error) || '失败');
          statusEl.className = 'ic-test-status err';
        }
      } catch (e) {
        statusEl.textContent = '❌ ' + e.message;
        statusEl.className = 'ic-test-status err';
      }
    });
    sm.body.querySelector('#ic-save').addEventListener('click', async () => {
      const cfg = await getPptConfig();
      cfg.ppt.imageGen = {
        enabled: sm.body.querySelector('#ic-enabled').value === 'true',
        baseUrl: sm.body.querySelector('#ic-base').value.trim(),
        apiKey: sm.body.querySelector('#ic-key').value.trim(),
        model: sm.body.querySelector('#ic-model').value.trim(),
        size: sm.body.querySelector('#ic-size').value,
      };
      await WB.api.saveConfig(cfg);
      sm.close();
      restoreImageConfig();
      U.toast('配图服务已保存', 'ok');
    });
  }

  /* ================= 生成 ================= */
  async function generate(m) {
    const q = (id) => m.body.querySelector(id);
    const prompt = q('#pm-prompt').value.trim();
    if (!prompt) return U.toast('先写点主题或提示词吧~', 'warn');

    const payload = {
      prompt,
      title: q('#pm-title').value.trim(),
      theme: q('#pm-theme').value,
      lang: q('#pm-lang').value,
      maxSlides: Number(q('#pm-slides').value) || 6,
      imageMode: q('#pm-img').value,
      accountId: q('#pm-account').value,
      model: q('#pm-model').value.trim(),
    };

    const btn = q('#pm-gen');
    const status = q('#pm-status');
    btn.disabled = true; btn.textContent = '⏳ 生成中…';
    status.textContent = '正在调用 DeepSeek 扩写内容…';
    status.className = 'ppt-status busy';
    try {
      const res = await window.workbench.pptGenerate(payload);
      if (!res || !res.ok) {
        status.textContent = '生成失败';
        status.className = 'ppt-status err';
        U.toast((res && res.error) || '生成失败', 'err');
        return;
      }
      status.textContent = payload.imageMode !== 'off' && res.imageCount === 0
        ? '⚠ 未启用配图服务，已生成为纯文字版'
        : '✅ 生成成功';
      status.className = 'ppt-status ok';
      showResult(m, res);
      refreshHistory(m);
    } catch (e) {
      status.textContent = '生成失败：' + e.message;
      status.className = 'ppt-status err';
      U.toast('生成失败：' + e.message, 'err');
    } finally {
      btn.disabled = false; btn.textContent = '🌈 一键生成';
    }
  }

  /* ================= 结果展示 ================= */
  function showResult(m, res) {
    const q = (id) => m.body.querySelector(id);
    q('#pm-result').hidden = false;
    q('#pm-result').dataset.html = res.htmlPath || '';
    q('#pm-result').dataset.dir = res.dir || '';
    q('#pm-r-title').textContent = res.title || '未命名';

    const imgTxt = res.imageMode === 'off' ? '纯文字版'
      : (res.imageCount > 0 ? `配图 ${res.imageCount} 张` : '未配图');
    const metaBits = [
      `主题 ${res.theme || '-'}`,
      `语言 ${res.lang || '-'}`,
      `${res.slideCount || 0} 页`,
      imgTxt,
    ];
    if (res.imageError) metaBits.push('⚠ ' + res.imageError);
    const time = new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    q('#pm-r-meta').textContent = metaBits.join(' · ') + ' · ' + time;

    const slides = res.slides || [];
    q('#pm-slides').innerHTML = slides.map((s, i) => {
      const icon = LAYOUT_ICON[s.layout] || '·';
      const title = s.title || s.layout || '';
      const n = s.bullets && s.bullets.length ? s.bullets.length : 0;
      return `
        <div class="ppt-slide-item">
          <span class="ppt-slide-no">${String(i + 1).padStart(2, '0')}</span>
          <span class="ppt-slide-ico">${icon}</span>
          <span class="ppt-slide-title">${U.esc(title)}</span>
          <span class="ppt-slide-count">${n ? n + ' 条要点' : ''}</span>
        </div>`;
    }).join('') || '<div class="ppt-empty">无幻灯片</div>';
  }

  function currentPath(m, key) {
    const r = document.getElementById('pm-result');
    return (r && r.dataset[key]) || '';
  }

  async function openDeck(m, opts) {
    const html = currentPath(m, 'html');
    if (!html) return U.toast('还没有可打开的演示', 'warn');
    const res = await window.workbench.pptOpenDeck(html, opts);
    if (res && !res.ok) U.toast(res.error || '打开失败', 'err');
  }

  async function openPath(m, mode) {
    const p = mode === 'folder' ? currentPath(m, 'dir') : currentPath(m, 'html');
    if (!p) return U.toast('还没有可操作的路径', 'warn');
    const res = await window.workbench.pptOpenPath(p, mode);
    if (res && !res.ok) U.toast(res.error || '打开失败', 'err');
  }

  /* ================= 历史 ================= */
  async function refreshHistory(m) {
    const wrap = m.body.querySelector('#pm-history');
    if (!wrap) return;
    let list = [];
    try { list = (await window.workbench.pptHistory()) || []; } catch (e) { list = []; }
    if (!list.length) {
      wrap.innerHTML = `<div class="ppt-history-title">最近生成</div><div class="ppt-empty">还没有生成记录</div>`;
      return;
    }
    wrap.innerHTML = `<div class="ppt-history-title">最近生成</div>` + list.map((h, i) => `
      <div class="ppt-history-item" data-i="${i}">
        <span class="ppt-history-ico">🎬</span>
        <span class="ppt-history-name">${U.esc(h.title || '未命名')}</span>
        <span class="ppt-history-meta">${U.esc(h.theme || '')} · ${h.slideCount || 0} 页 · ${U.timeAgo(h.createdAt)}</span>
      </div>`).join('');
    wrap.querySelectorAll('.ppt-history-item').forEach((it) => {
      it.addEventListener('click', () => {
        const h = list[Number(it.dataset.i)];
        if (!h) return;
        const q = (id) => m.body.querySelector(id);
        q('#pm-result').hidden = false;
        q('#pm-result').dataset.html = h.htmlPath || '';
        q('#pm-result').dataset.dir = h.dir || '';
        q('#pm-r-title').textContent = h.title || '未命名';
        q('#pm-r-meta').textContent = `${h.theme || '-'} · ${h.lang || '-'} · ${h.slideCount || 0} 页 · ${(h.imageCount || 0) ? '配图 ' + h.imageCount + ' 张' : '纯文字版'}`;
        U.toast('已加载：' + (h.title || '历史演示'), 'info');
      });
    });
    wrap.style.display = 'block';
  }

  return { open };
})();
