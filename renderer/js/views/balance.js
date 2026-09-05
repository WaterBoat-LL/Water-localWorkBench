/* ============================================================
 * 鲸屿工作台 - API 余额查询模块
 * ============================================================ */
WB.views = WB.views || {};

WB.views.balance = (() => {
  const U = WB.util;
  let accounts = [];   // 账号配置
  let results = {};    // id -> 查询结果缓存
  let config = {};
  let timer = null;
  let inited = false;

  const TYPES = [
    { v: 'deepseek', label: 'DeepSeek', hint: 'https://api.deepseek.com' },
    { v: 'moonshot', label: 'Moonshot AI (Kimi)', hint: 'https://api.moonshot.cn/v1' },
    { v: 'siliconflow', label: '硅基流动 (SiliconFlow)', hint: 'https://api.siliconflow.cn/v1' },
    { v: 'dashscope', label: '通义千问 / 百炼 (DashScope)', hint: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { v: 'openai', label: 'OpenAI', hint: 'https://api.openai.com' },
    { v: 'openrouter', label: 'OpenRouter', hint: 'https://openrouter.ai' },
    { v: 'custom', label: '通用兼容(中转站)', hint: '填你的 baseUrl，如 https://xxx.com/v1' },
  ];

  async function init() {
    if (inited) return;
    inited = true;
    config = await WB.api.getConfig();
    accounts = config.apiAccounts || [];
    // 恢复上次查询结果缓存
    try {
      const last = await WB.api.getConfig().then((c) => c.lastBalances || {});
      results = last || {};
    } catch (e) { results = {}; }
    // 自动刷新定时器
    const sec = (config.autoRefreshSec || 300) * 1000;
    if (sec > 0) {
      timer = setInterval(() => { refreshAll(true); }, sec);
    }
  }

  function root() {
    return document.getElementById('view-balance');
  }

  async function render() {
    await init();
    root().innerHTML = `
      <div class="page-head">
        <h2 class="page-title"><span class="title-ico">💰</span>API 余额查询</h2>
        <p class="page-sub">主进程代理请求，无 CORS 烦恼 · API Key 仅保存在本地</p>
        <div class="head-actions">
          <button class="btn btn-ghost" id="bal-settings">⚙️ 自动刷新设置</button>
          <button class="btn btn-primary" id="bal-add">＋ 添加账号</button>
          <button class="btn btn-primary-soft" id="bal-refresh-all">🔄 全部刷新</button>
        </div>
      </div>
      <div class="bal-cards" id="bal-cards"></div>
      <div class="bal-empty" id="bal-empty" hidden>
        <div class="empty-art">🫧</div>
        <p>还没有 API 账号哦~ 点右上角「添加账号」开始管理余额吧！</p>
      </div>
    `;

    document.getElementById('bal-add').addEventListener('click', () => editAccount(null));
    document.getElementById('bal-settings').addEventListener('click', openSettings);
    document.getElementById('bal-refresh-all').addEventListener('click', () => refreshAll(false));

    renderCards();
  }

  function renderCards() {
    const wrap = document.getElementById('bal-cards');
    const empty = document.getElementById('bal-empty');
    if (!wrap) return;
    if (!accounts.length) { wrap.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    wrap.innerHTML = accounts.map((a) => {
      const r = results[a.id] || {};
      const typeLabel = (TYPES.find((t) => t.v === a.type) || {}).label || a.type;
      const statusHtml = r.ok === true
        ? `<span class="bal-badge ok">● 可用</span>`
        : r.ok === false
          ? `<span class="bal-badge err">● ${U.esc(r.error || '失败')}</span>`
          : `<span class="bal-badge wait">○ 未查询</span>`;
      const total = r.ok ? U.fmtMoney(r.total, r.currency) : '—';
      return `
      <div class="bal-card glass" data-id="${a.id}">
        <div class="bal-card-top">
          <div class="bal-name-row">
            <span class="bal-logo">${U.esc(a.icon || '🪙')}</span>
            <div>
              <div class="bal-name">${U.esc(a.name)}</div>
              <div class="bal-type">${U.esc(typeLabel)}</div>
            </div>
          </div>
          ${statusHtml}
        </div>
        <div class="bal-total">${U.esc(total)}</div>
        <div class="bal-detail">
          <span>${r.currency ? U.esc(r.currency) : '--'}</span>
          <span>更新于 ${r.updatedAt ? U.timeAgo(r.updatedAt) : '--'}</span>
        </div>
        <div class="bal-card-foot">
          <button class="btn btn-mini btn-primary-soft" data-act="refresh">刷新</button>
          <button class="btn btn-mini btn-ghost" data-act="edit">编辑</button>
          <button class="btn btn-mini btn-danger-soft" data-act="del">删除</button>
        </div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('[data-act]').forEach((btn) => {
      const id = btn.closest('.bal-card').dataset.id;
      const act = btn.dataset.act;
      btn.addEventListener('click', () => {
        if (act === 'refresh') refreshOne(id);
        else if (act === 'edit') editAccount(accounts.find((a) => a.id === id));
        else if (act === 'del') removeAccount(id);
      });
    });
  }

  /** 刷新单个账号 */
  async function refreshOne(id, silent) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    if (!silent) {
      setCardState(id, '查询中...');
    }
    const r = await WB.api.queryBalance(acc);
    results[id] = r;
    await persistResults();
    renderCards();
    if (r.ok) {
      if (!silent) U.toast(`「${acc.name}」余额 ${U.fmtMoney(r.total, r.currency)}`, 'ok');
    } else {
      if (!silent) U.toast(`「${acc.name}」${r.error}`, 'err');
    }
  }

  function setCardState(id, text) {
    const card = document.querySelector(`.bal-card[data-id="${id}"]`);
    if (card) {
      const b = card.querySelector('.bal-badge');
      if (b) { b.className = 'bal-badge wait'; b.textContent = '○ ' + text; }
    }
  }

  async function refreshAll(silent) {
    if (!accounts.length) return;
    for (const a of accounts) {
      if (!silent) setCardState(a.id, '查询中...');
    }
    for (const a of accounts) {
      const r = await WB.api.queryBalance(a);
      results[a.id] = r;
    }
    await persistResults();
    renderCards();
    const okN = accounts.filter((a) => results[a.id] && results[a.id].ok).length;
    U.toast(`刷新完成：${okN}/${accounts.length} 个账号成功`, okN === accounts.length ? 'ok' : 'warn');
  }

  async function persistResults() {
    const cfg = await WB.api.getConfig();
    cfg.lastBalances = results;
    await WB.api.saveConfig(cfg);
  }

  /** 添加 / 编辑账号 */
  function editAccount(acc) {
    const isEdit = !!acc;
    const m = U.modal({ title: isEdit ? '编辑账号' : '添加 API 账号', width: '520px' });
    const typeOpts = TYPES.map((t) => `<option value="${t.v}" ${acc && acc.type === t.v ? 'selected' : ''}>${t.label}</option>`).join('');
    m.body.innerHTML = `
      <div class="form-grid">
        <label class="field full">
          <span class="field-label">账号名称</span>
          <input class="input" id="f-name" placeholder="如：DeepSeek 主号" value="${U.esc((acc && acc.name) || '')}" />
        </label>
        <label class="field full">
          <span class="field-label">平台类型</span>
          <select class="input" id="f-type">${typeOpts}</select>
        </label>
        <label class="field full">
          <span class="field-label">API Key <em class="field-tip">（仅存本地 data/config.json）</em></span>
          <input class="input" id="f-key" type="password" placeholder="sk-..." value="${U.esc((acc && acc.apiKey) || '')}" autocomplete="off" />
        </label>
        <label class="field full" id="f-base-wrap">
          <span class="field-label">Base URL <em class="field-tip">（「通用兼容」「通义千问」「Moonshot」需要）</em></span>
          <input class="input" id="f-base" placeholder="https://..." value="${U.esc((acc && acc.baseUrl) || '')}" />
        </label>
        <label class="field full">
          <span class="field-label">模型名 <em class="field-tip">（用于内容扩写等，如 qwen-plus / deepseek-chat）</em></span>
          <input class="input" id="f-model" placeholder="如 qwen-plus" value="${U.esc((acc && acc.model) || '')}" />
        </label>
        <label class="field full">
          <span class="field-label">图标（emoji）</span>
          <input class="input" id="f-icon" maxlength="4" value="${U.esc((acc && acc.icon) || '🪙')}" />
        </label>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="f-cancel">取消</button>
        <button class="btn btn-primary" id="f-save">保存</button>
      </div>
    `;

    const typeSel = m.body.querySelector('#f-type');
    const baseWrap = m.body.querySelector('#f-base-wrap');
    function toggleBase() { baseWrap.hidden = !['custom', 'dashscope', 'moonshot'].includes(typeSel.value); }
    typeSel.addEventListener('change', toggleBase);
    toggleBase();

    m.body.querySelector('#f-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#f-save').addEventListener('click', async () => {
      const name = m.body.querySelector('#f-name').value.trim();
      const type = m.body.querySelector('#f-type').value;
      const apiKey = m.body.querySelector('#f-key').value.trim();
      const baseUrl = m.body.querySelector('#f-base').value.trim();
      const model = m.body.querySelector('#f-model').value.trim();
      const icon = m.body.querySelector('#f-icon').value.trim() || '🪙';
      if (!name) return U.toast('给账号起个名字吧~', 'warn');
      if (!apiKey) return U.toast('API Key 不能为空哦', 'warn');
      if (['custom', 'dashscope', 'moonshot'].includes(type) && !baseUrl) return U.toast(type === 'dashscope' ? '通义千问请填 DashScope 地址' : type === 'moonshot' ? 'Moonshot 请填平台地址，如 https://api.moonshot.cn/v1' : '通用兼容模式需要填 Base URL', 'warn');

      const id = acc ? acc.id : U.uid('acc');
      const entry = { id, name, type, apiKey, baseUrl, model, icon, updatedAt: new Date().toISOString() };
      if (acc) {
        const idx = accounts.findIndex((a) => a.id === id);
        if (idx >= 0) accounts[idx] = entry;
      } else {
        accounts.push(entry);
      }
      config.apiAccounts = accounts;
      await WB.api.saveConfig(config);
      if (!acc) results[id] = { ok: false, error: '未查询', updatedAt: new Date().toISOString() };
      m.close();
      renderCards();
      U.toast(isEdit ? '账号已更新' : '账号已添加，马上查一下余额？', 'ok');
      if (!acc) refreshOne(id);
    });
  }

  function removeAccount(id) {
    U.confirmDlg('确定要删除这个 API 账号吗？（API Key 会一并删除）', async () => {
      accounts = accounts.filter((a) => a.id !== id);
      delete results[id];
      config.apiAccounts = accounts;
      await WB.api.saveConfig(config);
      await persistResults();
      renderCards();
      U.toast('账号已删除', 'ok');
    });
  }

  function openSettings() {
    const m = U.modal({ title: '自动刷新设置', width: '420px' });
    m.body.innerHTML = `
      <label class="field full">
        <span class="field-label">自动刷新间隔（秒，0 表示关闭）</span>
        <input class="input" id="s-sec" type="number" min="0" step="30" value="${config.autoRefreshSec || 300}" />
      </label>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="s-cancel">取消</button>
        <button class="btn btn-primary" id="s-save">保存</button>
      </div>
    `;
    m.body.querySelector('#s-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#s-save').addEventListener('click', async () => {
      const sec = Math.max(0, parseInt(m.body.querySelector('#s-sec').value, 10) || 0);
      config.autoRefreshSec = sec;
      await WB.api.saveConfig(config);
      if (timer) clearInterval(timer);
      if (sec > 0) timer = setInterval(() => refreshAll(true), sec * 1000);
      m.close();
      U.toast(sec > 0 ? `已开启自动刷新（每 ${sec} 秒）` : '已关闭自动刷新', 'ok');
    });
  }

  return { init, render, refreshAll };
})();
