/* ============================================================
 * 鲸屿工作台 - 每日备忘录模块
 * 自定义日历 + 按日期管理备忘录
 * ============================================================ */
WB.views.memo = (() => {
  const U = WB.util;
  let memos = [];
  let viewYear = 0, viewMonth = 0; // 日历当前显示的 年月
  let selectedDate = U.today();

  async function render() {
    memos = (await WB.api.getMemos()) || [];
    const d = new Date();
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();

    root().innerHTML = `
      <div class="page-head">
        <h2 class="page-title"><span class="title-ico">📝</span>每日备忘录</h2>
        <p class="page-sub">选个日期，记下今天的事~</p>
      </div>
      <div class="memo-layout">
        <div class="memo-calendar glass">
          <div class="cal-head">
            <button class="cal-nav" id="cal-prev">‹</button>
            <div class="cal-title" id="cal-title"></div>
            <button class="cal-nav" id="cal-next">›</button>
          </div>
          <div class="cal-week">
            ${['日', '一', '二', '三', '四', '五', '六'].map((w) => `<span>${w}</span>`).join('')}
          </div>
          <div class="cal-grid" id="cal-grid"></div>
          <div class="cal-foot">
            <button class="btn btn-mini btn-primary-soft" id="cal-today">回到今天</button>
            <span class="cal-count" id="cal-count"></span>
          </div>
        </div>

        <div class="memo-panel glass">
          <div class="memo-panel-head">
            <div>
              <div class="memo-date-big" id="memo-date-big"></div>
              <div class="memo-date-sub" id="memo-date-sub"></div>
            </div>
            <button class="btn btn-primary" id="memo-add">＋ 新建备忘</button>
          </div>
          <div class="memo-list" id="memo-list"></div>
        </div>
      </div>
    `;

    document.getElementById('cal-prev').addEventListener('click', () => shiftMonth(-1));
    document.getElementById('cal-next').addEventListener('click', () => shiftMonth(1));
    document.getElementById('cal-today').addEventListener('click', () => {
      const t = new Date();
      viewYear = t.getFullYear();
      viewMonth = t.getMonth();
      selectedDate = U.today();
      drawCalendar(); renderList();
    });
    document.getElementById('memo-add').addEventListener('click', () => editMemo(null));

    drawCalendar();
    renderList();
  }

  function root() { return document.getElementById('view-memo'); }

  function drawCalendar() {
    const title = document.getElementById('cal-title');
    const grid = document.getElementById('cal-grid');
    title.textContent = `${viewYear} 年 ${viewMonth + 1} 月`;

    const first = new Date(viewYear, viewMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const withMemos = new Set(memos.map((m) => m.date));
    const today = U.today();

    let html = '';
    for (let i = 0; i < startDow; i++) html += `<span class="cal-cell blank"></span>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cls = ['cal-cell'];
      if (ds === today) cls.push('today');
      if (ds === selectedDate) cls.push('selected');
      if (withMemos.has(ds)) cls.push('has-memo');
      html += `<button class="${cls.join(' ')}" data-date="${ds}">
        <span class="cal-num">${d}</span>
        ${withMemos.has(ds) ? '<span class="cal-dot"></span>' : ''}
      </button>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.cal-cell[data-date]').forEach((cell) => {
      cell.addEventListener('click', () => {
        selectedDate = cell.dataset.date;
        drawCalendar(); renderList();
      });
    });

    const cnt = memos.filter((m) => m.date === selectedDate && !m.done).length;
    document.getElementById('cal-count').textContent = `今日待办 ${cnt} 条`;
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    drawCalendar();
  }

  function renderList() {
    document.getElementById('memo-date-big').textContent = selectedDate;
    document.getElementById('memo-date-sub').textContent = (() => {
      const d = new Date(selectedDate + 'T00:00:00');
      return `${U.weekdayCN(d)} · 农历${lunarText(d)}`;
    })();

    const list = document.getElementById('memo-list');
    const items = memos.filter((m) => m.date === selectedDate).sort((a, b) => (a.done - b.done) || (a.createdAt > b.createdAt ? -1 : 1));

    if (!items.length) {
      list.innerHTML = `<div class="memo-empty">
        <div class="empty-art">🌊</div>
        <p>这一天还没有备忘~<br/>写点什么吧！</p>
      </div>`;
      return;
    }

    list.innerHTML = items.map((m) => `
      <div class="memo-item ${m.done ? 'done' : ''}" data-id="${m.id}">
        <button class="memo-check" data-act="toggle">${m.done ? '✅' : '⬜'}</button>
        <div class="memo-body">
          <div class="memo-title">${U.esc(m.title || '（无标题）')}</div>
          ${m.content ? `<div class="memo-content">${U.esc(m.content)}</div>` : ''}
          <div class="memo-time">🕐 ${U.fmtDateTime(m.createdAt)}</div>
        </div>
        <div class="memo-ops">
          <button class="btn btn-mini btn-ghost" data-act="edit">编辑</button>
          <button class="btn btn-mini btn-danger-soft" data-act="del">删除</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-act]').forEach((btn) => {
      const id = btn.closest('.memo-item').dataset.id;
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        const memo = memos.find((m) => m.id === id);
        if (!memo) return;
        if (act === 'toggle') toggleMemo(memo);
        else if (act === 'edit') editMemo(memo);
        else if (act === 'del') removeMemo(memo);
      });
    });
  }

  async function toggleMemo(memo) {
    memo.done = !memo.done;
    await WB.api.saveMemos(memos);
    renderList(); drawCalendar();
  }

  async function removeMemo(memo) {
    U.confirmDlg(`删除备忘「${memo.title || '无标题'}」？`, async () => {
      memos = memos.filter((m) => m.id !== memo.id);
      await WB.api.saveMemos(memos);
      renderList(); drawCalendar();
      U.toast('备忘已删除', 'ok');
    });
  }

  function editMemo(memo) {
    const isEdit = !!memo;
    const m = U.modal({ title: isEdit ? '编辑备忘' : '新建备忘', width: '520px' });
    m.body.innerHTML = `
      <label class="field full">
        <span class="field-label">日期</span>
        <input class="input" id="m-date" type="date" value="${U.esc(memo ? memo.date : selectedDate)}" />
      </label>
      <label class="field full">
        <span class="field-label">标题</span>
        <input class="input" id="m-title" placeholder="给备忘起个标题" value="${U.esc((memo && memo.title) || '')}" />
      </label>
      <label class="field full">
        <span class="field-label">内容</span>
        <textarea class="input area" id="m-content" rows="5" placeholder="写点什么...">${U.esc((memo && memo.content) || '')}</textarea>
      </label>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="m-cancel">取消</button>
        <button class="btn btn-primary" id="m-save">保存</button>
      </div>
    `;
    m.body.querySelector('#m-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#m-save').addEventListener('click', async () => {
      const date = m.body.querySelector('#m-date').value;
      const title = m.body.querySelector('#m-title').value.trim();
      const content = m.body.querySelector('#m-content').value.trim();
      if (!date) return U.toast('请选择日期', 'warn');
      if (!title && !content) return U.toast('写点什么内容吧~', 'warn');
      if (isEdit) {
        memo.date = date; memo.title = title; memo.content = content;
        memo.updatedAt = new Date().toISOString();
      } else {
        memos.push({ id: U.uid('memo'), date, title, content, done: false, createdAt: new Date().toISOString() });
      }
      await WB.api.saveMemos(memos);
      selectedDate = date;
      const d = new Date(date + 'T00:00:00');
      viewYear = d.getFullYear(); viewMonth = d.getMonth();
      m.close();
      drawCalendar(); renderList();
      U.toast('备忘已保存 🐋', 'ok');
    });
  }

  /* ---------- 简易农历（日期干支提示） ---------- */
  const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520,
  ];
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  function lunarText(d) {
    try {
      let offset = Math.floor((d - new Date(1900, 0, 31)) / 86400000);
      let year = 1900, leap = 0, isLeap = false;
      for (; year < 2100 && offset > 0; year++) {
        const y = LUNAR_INFO[year - 1900];
        leap = y & 0xf;
        let size = ((y & 0x10000) ? 13 : 12) + (leap ? 1 : 0);
        let days = 0;
        for (let i = 0; i < size; i++) {
          days += (((y >> (i * 2 + 2)) & 0x3) === 0) ? 29 : 30;
        }
        if (offset - days < 0) break;
        offset -= days;
      }
      if (year >= 2100) return '';
      const y = LUNAR_INFO[year - 1900];
      const isLeapY = !!(y & 0x10000);
      leap = y & 0xf;
      let monthDays = [];
      for (let i = 0; i < 12 + (isLeapY ? 1 : 0); i++) {
        monthDays.push((((y >> (i * 2 + 2)) & 0x3) === 0) ? 29 : 30);
      }
      let month = 0;
      for (; month < monthDays.length; month++) {
        if (offset - monthDays[month] < 0) break;
        offset -= monthDays[month];
      }
      let isLeapM = isLeapY && month === leap;
      if (isLeapY && month > leap) month--;
      const ganIdx = (year - 4) % 10, zhiIdx = (year - 4) % 12;
      const dayText = DAYS[offset] || '';
      const monthText = (isLeapM ? '闰' : '') + MONTHS[month] + '月';
      return `${GAN[ganIdx]}${ZHI[zhiIdx]}年 ${monthText}${dayText}`;
    } catch (e) {
      return '';
    }
  }

  return { render };
})();
