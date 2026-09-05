/* ============================================================
 * 鲸屿工作台 - 项目笔记栏模块（支持图片）
 * 图片通过主进程复制到 data/uploads/，走 local:// 协议展示
 * ============================================================ */
WB.views.notes = (() => {
  const U = WB.util;
  let notes = [];
  let filter = '';

  async function render() {
    notes = (await WB.api.getNotes()) || [];
    root().innerHTML = `
      <div class="page-head">
        <h2 class="page-title"><span class="title-ico">🗂️</span>项目笔记栏</h2>
        <p class="page-sub">每次做了什么项目，都记在这里，还能配图~</p>
        <div class="head-actions">
          <input class="input search-input" id="note-search" placeholder="🔍 搜索标题/标签/内容..." value="${U.esc(filter)}" />
          <button class="btn btn-primary" id="note-add">＋ 新建笔记</button>
        </div>
      </div>
      <div class="note-grid" id="note-grid"></div>
      <div class="bal-empty" id="note-empty" hidden>
        <div class="empty-art">🗒️</div>
        <p>还没有项目笔记~<br/>完成一个项目就记一笔吧！</p>
      </div>
    `;

    document.getElementById('note-add').addEventListener('click', () => editNote(null));
    document.getElementById('note-search').addEventListener('input', (e) => {
      filter = e.target.value.trim();
      renderGrid();
    });
    renderGrid();
  }

  function root() { return document.getElementById('view-notes'); }

  function renderGrid() {
    const grid = document.getElementById('note-grid');
    const empty = document.getElementById('note-empty');
    const kw = filter.toLowerCase();
    const items = notes
      .filter((n) => !kw || (n.title || '').toLowerCase().includes(kw) || (n.content || '').toLowerCase().includes(kw) || (n.tags || []).some((t) => t.toLowerCase().includes(kw)))
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));

    if (!items.length) { if (grid) grid.innerHTML = ''; if (empty) empty.hidden = false; return; }
    if (empty) empty.hidden = true;

    grid.innerHTML = items.map((n) => {
      const cover = (n.images || []).length ? `<img class="note-cover" src="${U.esc(n.images[0])}" alt="" />` : '<div class="note-cover none">🌊</div>';
      const tags = (n.tags || []).map((t) => `<span class="note-tag">${U.esc(t)}</span>`).join('');
      return `
      <div class="note-card glass" data-id="${n.id}">
        ${cover}
        <div class="note-card-body">
          <div class="note-title">${U.esc(n.title || '（无标题）')}</div>
          <div class="note-desc">${U.esc((n.content || '').slice(0, 70))}</div>
          <div class="note-tags">${tags}</div>
          <div class="note-meta">🕐 ${U.fmtDate(new Date(n.updatedAt || n.createdAt))} · ${(n.images || []).length} 图</div>
        </div>
        <div class="note-ops">
          <button class="btn btn-mini btn-primary-soft" data-act="open">查看</button>
          <button class="btn btn-mini btn-ghost" data-act="edit">编辑</button>
          <button class="btn btn-mini btn-danger-soft" data-act="del">删除</button>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-act]').forEach((btn) => {
      const n = notes.find((x) => x.id === btn.closest('.note-card').dataset.id);
      if (!n) return;
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'open') viewNote(n);
        else if (act === 'edit') editNote(n);
        else if (act === 'del') removeNote(n);
      });
    });
  }

  function viewNote(n) {
    const m = U.modal({ title: n.title || '笔记', width: '680px' });
    const tags = (n.tags || []).map((t) => `<span class="note-tag">${U.esc(t)}</span>`).join('');
    m.body.innerHTML = `
      <div class="note-view-meta">${U.fmtDateTime(n.updatedAt || n.createdAt)} ${tags ? '· ' + tags : ''}</div>
      <div class="note-view-content">${U.esc(n.content || '').replace(/\n/g, '<br/>')}</div>
      ${(n.images || []).map((im) => `<img class="note-view-img" src="${U.esc(im)}" alt="" />`).join('')}
      <div class="modal-foot">
        <button class="btn btn-primary" id="v-edit">编辑</button>
      </div>
    `;
    m.body.querySelector('#v-edit').addEventListener('click', () => { m.close(); editNote(n); });
  }

  function editNote(note) {
    const isEdit = !!note;
    const m = U.modal({ title: isEdit ? '编辑笔记' : '新建项目笔记', width: '720px' });
    const imgs = (note && note.images) || [];
    m.body.innerHTML = `
      <div class="form-grid">
        <label class="field full">
          <span class="field-label">标题</span>
          <input class="input" id="n-title" placeholder="项目名称" value="${U.esc((note && note.title) || '')}" />
        </label>
        <label class="field full">
          <span class="field-label">标签（逗号分隔）</span>
          <input class="input" id="n-tags" placeholder="如：毕业设计, 前端" value="${U.esc(((note && note.tags) || []).join(', '))}" />
        </label>
        <label class="field full">
          <span class="field-label">内容</span>
          <textarea class="input area" id="n-content" rows="8" placeholder="记录做了什么、用了什么技术、踩了什么坑...">${U.esc((note && note.content) || '')}</textarea>
        </label>
      </div>
      <div class="note-upload-row">
        <span class="field-label">图片</span>
        <button class="btn btn-ghost btn-mini" id="n-add-img">＋ 添加图片</button>
      </div>
      <div class="note-img-list" id="n-imgs">
        ${imgs.map((im, i) => `
          <div class="note-img-item" data-i="${i}">
            <img src="${U.esc(im)}" alt="" />
            <button class="note-img-x" data-i="${i}">×</button>
          </div>`).join('')}
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="n-cancel">取消</button>
        <button class="btn btn-primary" id="n-save">保存</button>
      </div>
    `;

    let images = [...imgs];

    m.body.querySelector('#n-add-img').addEventListener('click', async () => {
      const r = await window.workbench.openImageDialog();
      if (!r) return;
      if (r.error) return U.toast(r.error, 'err');
      if (images.length >= 6) return U.toast('最多放 6 张图哦', 'warn');
      images.push(r.url);
      renderImgs();
    });

    function renderImgs() {
      const list = m.body.querySelector('#n-imgs');
      list.innerHTML = images.map((im, i) => `
        <div class="note-img-item" data-i="${i}">
          <img src="${U.esc(im)}" alt="" />
          <button class="note-img-x" data-i="${i}">×</button>
        </div>`).join('');
      list.querySelectorAll('.note-img-x').forEach((b) => {
        b.addEventListener('click', () => {
          images = images.filter((_, i) => i !== Number(b.dataset.i));
          renderImgs();
        });
      });
    }

    m.body.querySelector('#n-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#n-save').addEventListener('click', async () => {
      const title = m.body.querySelector('#n-title').value.trim();
      const content = m.body.querySelector('#n-content').value.trim();
      const tags = m.body.querySelector('#n-tags').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (!title && !content) return U.toast('写点内容吧~', 'warn');
      const now = new Date().toISOString();
      if (isEdit) {
        note.title = title; note.content = content; note.tags = tags; note.images = images;
        note.updatedAt = now;
      } else {
        notes.push({ id: U.uid('note'), title, content, tags, images, createdAt: now, updatedAt: now });
      }
      await WB.api.saveNotes(notes);
      m.close();
      renderGrid();
      U.toast('笔记已保存 🐋', 'ok');
    });
  }

  function removeNote(n) {
    U.confirmDlg(`删除笔记「${n.title || '无标题'}」？`, async () => {
      notes = notes.filter((x) => x.id !== n.id);
      await WB.api.saveNotes(notes);
      renderGrid();
      U.toast('笔记已删除', 'ok');
    });
  }

  return { render };
})();
