/* ============================================================
 * 鲸屿工作台 - 课业网址快捷入口模块
 * ============================================================ */
WB.views.links = (() => {
  const U = WB.util;
  let links = [];
  let activeCat = '全部';

  const DEFAULT_CATS = ['全部', '学习', '工具', '娱乐', '其他'];

  async function render() {
    links = (await WB.api.getLinks()) || [];

    root().innerHTML = `
      <div class="page-head">
        <h2 class="page-title"><span class="title-ico">🔗</span>课业网址快捷入口</h2>
        <p class="page-sub">把常用的网址都收进来，点一下就到~</p>
        <div class="head-actions">
          <button class="btn btn-primary" id="link-add">＋ 添加网址</button>
        </div>
      </div>
      <div class="link-cats" id="link-cats"></div>
      <div class="link-grid" id="link-grid"></div>
      <div class="bal-empty" id="link-empty" hidden>
        <div class="empty-art">🧭</div>
        <p>还没有收藏网址~<br/>点「添加网址」把课业链接放进来吧！</p>
      </div>
    `;

    document.getElementById('link-add').addEventListener('click', () => editLink(null));
    renderCats();
    renderGrid();
  }

  function root() { return document.getElementById('view-links'); }

  function allCats() {
    const set = new Set(DEFAULT_CATS);
    links.forEach((l) => l.category && set.add(l.category));
    return [...set];
  }

  function renderCats() {
    const wrap = document.getElementById('link-cats');
    wrap.innerHTML = allCats().map((c) =>
      `<button class="cat-chip ${c === activeCat ? 'active' : ''}" data-cat="${U.esc(c)}">${U.esc(c)}</button>`
    ).join('');
    wrap.querySelectorAll('.cat-chip').forEach((b) => {
      b.addEventListener('click', () => { activeCat = b.dataset.cat; renderCats(); renderGrid(); });
    });
  }

  function iconOf(url) {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
    } catch (e) { return ''; }
  }

  function renderGrid() {
    const grid = document.getElementById('link-grid');
    const empty = document.getElementById('link-empty');
    const items = activeCat === '全部' ? links : links.filter((l) => l.category === activeCat);

    if (!items.length) { grid.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    grid.innerHTML = items.map((l) => {
      const fav = l.icon || '';
      return `
      <div class="link-card glass" data-id="${l.id}">
        <div class="link-fav">
          ${fav ? `<img src="${U.esc(fav)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'" />` : `<span>${U.esc((l.name || '?').slice(0, 1))}</span>`}
        </div>
        <div class="link-info">
          <div class="link-name">${U.esc(l.name)}</div>
          <div class="link-url">${U.esc(l.url.replace(/^https?:\/\//, '').slice(0, 40))}</div>
          ${l.category && l.category !== '其他' ? `<span class="link-tag">${U.esc(l.category)}</span>` : ''}
        </div>
        <div class="link-ops">
          <button class="btn btn-mini btn-primary-soft" data-act="open" title="打开">↗</button>
          <button class="btn btn-mini btn-ghost" data-act="edit" title="编辑">✎</button>
          <button class="btn btn-mini btn-danger-soft" data-act="del" title="删除">×</button>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-act]').forEach((btn) => {
      const l = links.find((x) => x.id === btn.closest('.link-card').dataset.id);
      if (!l) return;
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'open') openLink(l);
        else if (act === 'edit') editLink(l);
        else if (act === 'del') removeLink(l);
      });
    });
  }

  function openLink(l) {
    window.workbench.openExternal(l.url).then(() => U.toast(`已用系统浏览器打开「${l.name}」`, 'ok'));
  }

  function editLink(link) {
    const isEdit = !!link;
    const m = U.modal({ title: isEdit ? '编辑网址' : '添加网址', width: '500px' });
    m.body.innerHTML = `
      <div class="form-grid">
        <label class="field full">
          <span class="field-label">名称</span>
          <input class="input" id="l-name" placeholder="如：DeepSeek 开放平台" value="${U.esc((link && link.name) || '')}" />
        </label>
        <label class="field full">
          <span class="field-label">网址 URL</span>
          <input class="input" id="l-url" placeholder="https://..." value="${U.esc((link && link.url) || '')}" />
        </label>
        <label class="field">
          <span class="field-label">分类</span>
          <input class="input" id="l-cat" list="cat-list" placeholder="学习/工具/娱乐..." value="${U.esc((link && link.category) || '学习')}" />
          <datalist id="cat-list">
            ${DEFAULT_CATS.filter((c) => c !== '全部').map((c) => `<option value="${c}">`).join('')}
          </datalist>
        </label>
        <label class="field">
          <span class="field-label">图标 emoji（可选）</span>
          <input class="input" id="l-icon" maxlength="4" placeholder="📚" value="${U.esc((link && link.icon) || '')}" />
        </label>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="l-cancel">取消</button>
        <button class="btn btn-primary" id="l-save">保存</button>
      </div>
    `;
    m.body.querySelector('#l-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#l-save').addEventListener('click', async () => {
      const name = m.body.querySelector('#l-name').value.trim();
      const url = m.body.querySelector('#l-url').value.trim();
      const category = m.body.querySelector('#l-cat').value.trim() || '其他';
      const icon = m.body.querySelector('#l-icon').value.trim() || '';
      if (!name) return U.toast('给网址起个名字~', 'warn');
      if (!/^https?:\/\//i.test(url)) return U.toast('网址要以 http(s):// 开头哦', 'warn');

      if (isEdit) {
        link.name = name; link.url = url; link.category = category; link.icon = icon;
      } else {
        links.push({ id: U.uid('link'), name, url, category, icon, createdAt: new Date().toISOString() });
      }
      await WB.api.saveLinks(links);
      m.close();
      renderCats(); renderGrid();
      U.toast('网址已保存 🐋', 'ok');
    });
  }

  function removeLink(l) {
    U.confirmDlg(`删除网址「${l.name}」？`, async () => {
      links = links.filter((x) => x.id !== l.id);
      await WB.api.saveLinks(links);
      renderCats(); renderGrid();
      U.toast('网址已删除', 'ok');
    });
  }

  return { render };
})();
