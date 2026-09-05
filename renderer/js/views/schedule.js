/* ============================================================
 * 鲸屿工作台 - 课表模块
 * CSV 导入（UTF-8 / GBK）→ 卡牌式纵向排列，按星期分组
 * ============================================================ */
WB.views = WB.views || {};

WB.views.schedule = (() => {
  const U = WB.util;
  let schedule = [];   // 课程条目数组

  const WEEK_LABEL = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日', '时间待定'];
  const PALETTE = ['#4fd8c9', '#58a6ff', '#c9a84c', '#7c3aed', '#ff7e67', '#ffd166', '#3ddc97', '#e58a2f', '#06b6d4', '#e63946'];

  /* ---------- 颜色（按课程名稳定取色） ---------- */
  function colorOf(name) {
    let h = 0;
    for (const c of String(name || '')) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  /* ================= 渲染主视图 ================= */
  async function render() {
    schedule = await loadSchedule();
    const rootEl = root();
    rootEl.innerHTML = `
      <div class="page-head">
        <h2 class="page-title"><span class="title-ico">📅</span>我的课表</h2>
        <p class="page-sub">从 CSV 导入课表，卡牌式查看 · 数据仅保存在本地</p>
        <div class="head-actions">
          <button class="btn btn-ghost" id="sch-paste">📋 粘贴 CSV</button>
          <button class="btn btn-ghost" id="sch-add">＋ 手动添加</button>
          <button class="btn btn-primary" id="sch-import">📁 导入 CSV</button>
          <button class="btn btn-danger-soft" id="sch-clear">🗑 清空</button>
        </div>
      </div>
      <div class="sch-summary" id="sch-summary"></div>
      <div class="sch-body" id="sch-body"></div>
      <input type="file" id="sch-file" accept=".csv,.txt,text/csv,application/vnd.ms-excel" hidden />
    `;

    rootEl.querySelector('#sch-import').addEventListener('click', () => rootEl.querySelector('#sch-file').click());
    rootEl.querySelector('#sch-file').addEventListener('change', (e) => onFilePick(e.target));
    rootEl.querySelector('#sch-paste').addEventListener('click', pasteModal);
    rootEl.querySelector('#sch-add').addEventListener('click', () => editEntry(null));
    rootEl.querySelector('#sch-clear').addEventListener('click', () => {
      if (!schedule.length) return U.toast('课表本来就是空的~', 'info');
      U.confirmDlg('确定要清空整个课表吗？', async () => {
        schedule = [];
        await WB.api.saveSchedule(schedule);
        render();
        U.toast('课表已清空', 'ok');
      });
    });

    renderBody();
  }

  function root() { return document.getElementById('view-schedule'); }

  async function loadSchedule() {
    try {
      const d = await WB.api.getSchedule();
      return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
  }

  /* ================= 卡牌列表 ================= */
  function renderBody() {
    const body = document.getElementById('sch-body');
    const summary = document.getElementById('sch-summary');
    if (!body) return;

    if (!schedule.length) {
      summary.innerHTML = '';
      body.innerHTML = `
        <div class="sch-empty glass">
          <div class="empty-art">📅</div>
          <p>还没有课表哦~ 点右上角「导入 CSV」把 Excel/WPS 导出的课表传进来，<br/>或「粘贴 CSV」直接粘贴表格内容，也可以手动一条条添加。</p>
          <p class="sch-empty-tip">表头示例：<code>课程,星期,节次,周次,地点,教师</code></p>
        </div>`;
      return;
    }

    const today = new Date().getDay() || 7;
    summary.innerHTML = `共 <b>${schedule.length}</b> 节课 · 覆盖 <b>${new Set(schedule.map((e) => e.weekday)).size}</b> 天`;

    // 按星期分组，组内按开始节次排序
    const groups = new Map();
    for (const e of schedule) {
      const wd = e.weekday >= 1 && e.weekday <= 7 ? e.weekday : 8; // 8 = 待定
      if (!groups.has(wd)) groups.set(wd, []);
      groups.get(wd).push(e);
    }
    const order = [1, 2, 3, 4, 5, 6, 7, 8];
    let html = '';
    for (const wd of order) {
      if (!groups.has(wd)) continue;
      const items = groups.get(wd).sort((a, b) => (a.startPeriod ?? 99) - (b.startPeriod ?? 99));
      html += `
        <div class="sch-day">
          <span class="sch-day-label">${WEEK_LABEL[wd]}</span>
          <span class="sch-day-count">${items.length} 节</span>
          ${wd === today ? '<span class="sch-today">今天</span>' : ''}
        </div>
        <div class="sch-col">${items.map(cardHtml).join('')}</div>`;
    }
    body.innerHTML = html;

    body.querySelectorAll('[data-act]').forEach((btn) => {
      const id = btn.closest('.sch-card').dataset.id;
      const act = btn.dataset.act;
      btn.addEventListener('click', () => {
        const entry = schedule.find((e) => e.id === id);
        if (!entry) return;
        if (act === 'edit') editEntry(entry);
        else if (act === 'del') delEntry(entry);
      });
    });
  }

  function cardHtml(e) {
    const color = e.color || colorOf(e.name);
    const time = timeLabel(e);
    const metaBits = [];
    if (e.weeks) metaBits.push('🗓 ' + U.esc(e.weeks));
    if (e.location) metaBits.push('🏫 ' + U.esc(e.location));
    if (e.teacher) metaBits.push('👩‍🏫 ' + U.esc(e.teacher));
    const note = e.note ? `<div class="sch-card-note">💬 ${U.esc(e.note)}</div>` : '';
    return `
      <div class="sch-card glass" data-id="${U.esc(e.id)}" style="--sch-color:${color}">
        <div class="sch-card-main">
          <div class="sch-card-top">
            <span class="sch-card-name">${U.esc(e.name)}</span>
            <span class="sch-card-time">${U.esc(time)}</span>
          </div>
          ${metaBits.length ? `<div class="sch-card-meta">${metaBits.join(' · ')}</div>` : ''}
          ${note}
        </div>
        <div class="sch-card-ops">
          <button class="btn btn-mini btn-ghost" data-act="edit" title="编辑">✏️</button>
          <button class="btn btn-mini btn-danger-soft" data-act="del" title="删除">🗑</button>
        </div>
      </div>`;
  }

  function timeLabel(e) {
    if (e.timeRaw) return e.timeRaw;
    if (e.startPeriod != null) {
      return e.endPeriod != null && e.endPeriod !== e.startPeriod
        ? `第 ${e.startPeriod}-${e.endPeriod} 节`
        : `第 ${e.startPeriod} 节`;
    }
    return '时间待定';
  }

  /* ================= CSV 解析 ================= */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQ = false;
    const s = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* 跳过，配合 \n 换行 */ }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }

    const cleaned = [];
    for (const r of rows) {
      const t = r.map((x) => String(x).trim());
      if (t.every((x) => x === '')) continue;
      cleaned.push(t);
    }
    if (!cleaned.length) return { headers: [], rows: [] };
    return { headers: cleaned[0], rows: cleaned.slice(1) };
  }

  const COL_MAP = [
    { key: 'name', aliases: ['课程', '课程名', '科目', '课名', '名称', '课程名称', '课', 'subject', 'course', 'name'] },
    { key: 'weekday', aliases: ['星期', '星期几', '周几', '礼拜', '礼拜几', 'day', 'weekday'] },
    { key: 'start', aliases: ['开始节次', '节次', '第几节', '开始', '节', '节数', 'start', 'startperiod'] },
    { key: 'end', aliases: ['结束节次', '结束', 'end', 'endperiod'] },
    { key: 'time', aliases: ['时间', '上课时间', 'time', '时段'] },
    { key: 'weeks', aliases: ['周次', '周数', '教学周', '周', 'weeks', 'weekrange', 'week'] },
    { key: 'location', aliases: ['地点', '教室', '位置', '上课地点', 'room', 'location', 'place'] },
    { key: 'teacher', aliases: ['教师', '老师', '授课教师', '教师姓名', 'teacher', '教授'] },
    { key: 'note', aliases: ['备注', '说明', 'note', 'notes'] },
  ];

  function normHeader(h) {
    return String(h || '').toLowerCase().replace(/[\s（）()：:·\-_]/g, '');
  }

  function mapColumns(headers) {
    const col = { name: -1, weekday: -1, start: -1, end: -1, time: -1, weeks: -1, location: -1, teacher: -1, note: -1 };
    for (const def of COL_MAP) {
      for (let i = 0; i < headers.length; i++) {
        if (col[def.key] >= 0) break;
        if (def.aliases.some((a) => normHeader(a) === normHeader(headers[i]))) col[def.key] = i;
      }
    }
    return col;
  }

  function parseWeekday(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    const num = parseInt(s, 10);
    if (!isNaN(num) && num >= 1 && num <= 7) return num;
    const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7 };
    const m = s.match(/[一二三四五六日天1-7]/);
    return m ? (map[m[0]] || null) : null;
  }

  function parsePeriods(v) {
    const s = String(v || '').trim();
    if (!s) return { start: null, end: null, raw: '' };
    const range = s.match(/(\d+)\s*[-–—~至到]\s*(\d+)/);
    if (range) return { start: parseInt(range[1], 10), end: parseInt(range[2], 10), raw: '' };
    const single = s.match(/(\d+)/);
    if (single) return { start: parseInt(single[1], 10), end: parseInt(single[1], 10), raw: '' };
    return { start: null, end: null, raw: s };
  }

  function rowsToEntries(rows, headers) {
    const col = mapColumns(headers);
    const matched = Object.values(col).filter((v) => v >= 0).length;
    let dataRows = rows;
    // 表头完全无法识别：按固定列位猜测（课程,星期,节次,结束,周次,地点,教师,备注），且第一行也是数据
    if (matched === 0 && headers.length >= 1) {
      col.name = 0; col.weekday = 1; col.start = 2; col.end = 3;
      col.weeks = 4; col.location = 5; col.teacher = 6; col.note = 7;
      dataRows = [headers].concat(rows);
    }
    const get = (r, k) => (col[k] >= 0 && r[col[k]] != null ? String(r[col[k]]).trim() : '');
    const entries = [];
    for (const r of dataRows) {
      const name = get(r, 'name');
      if (!name) continue;
      let weekday = parseWeekday(get(r, 'weekday'));
      const startText = get(r, 'start');
      const timeText = get(r, 'time');
      let p = parsePeriods(startText);
      if (startText === '' && timeText) p = parsePeriods(timeText);
      if (weekday == null) weekday = parseWeekday(timeText);
      if (p.start == null && timeText && startText === '') p = parsePeriods(timeText);
      const endText = get(r, 'end');
      let end = p.end;
      if (endText) { const pe = parsePeriods(endText); if (pe.start != null) end = pe.start; }

      const rawSource = startText || timeText;
      const periodLike = /^第?\d+(\s*[-–—~至到]\s*\d+)?\s*节?$/.test(rawSource);
      const timeRaw = (!periodLike && rawSource && rawSource !== '') ? rawSource : '';

      entries.push({
        id: U.uid('cls'),
        name,
        weekday,
        startPeriod: p.start,
        endPeriod: end,
        timeRaw,
        weeks: get(r, 'weeks'),
        location: get(r, 'location'),
        teacher: get(r, 'teacher'),
        note: get(r, 'note'),
        color: colorOf(name),
      });
    }
    return entries;
  }

  /* ================= 文件导入 ================= */
  async function onFilePick(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const text = await readFileText(file);
    if (!text.trim()) return U.toast('文件读取失败或为空', 'err');
    importText(text, '导入');
  }

  function readFileText(file) {
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => {
        const buf = new Uint8Array(fr.result);
        let txt = '';
        try { txt = new TextDecoder('utf-8').decode(buf); } catch (e) { txt = ''; }
        if (txt.includes('\uFFFD')) {
          try { txt = new TextDecoder('gb18030').decode(buf); } catch (e) { /* 保留 utf8 结果 */ }
        }
        resolve(txt);
      };
      fr.onerror = () => resolve('');
      fr.readAsArrayBuffer(file);
    });
  }

  function importText(text, mode) {
    const { headers, rows } = parseCSV(text);
    if (!rows.length) return U.toast('CSV 里没有数据行', 'warn');
    const entries = rowsToEntries(rows, headers);
    if (!entries.length) return U.toast('没解析出课程，检查表头（课程/星期/节次/地点/教师 等）', 'err');
    const named = entries.filter((e) => e.weekday != null).length;
    const m = U.modal({ title: '📥 ' + mode + '课表', width: '640px' });
    const sample = entries.slice(0, 10).map((e) => `
      <div class="sch-preview-item">
        <span class="sch-preview-name">${U.esc(e.name)}</span>
        <span class="sch-preview-sub">${WEEK_LABEL[e.weekday || 8]} · ${U.esc(timeLabel(e))}</span>
      </div>`).join('');
    m.body.innerHTML = `
      <p class="cfg-note">共解析出 <b>${entries.length}</b> 条课程（${named} 条带星期）。确认导入方式：</p>
      <div class="sch-preview-list">${sample}${entries.length > 10 ? `<div class="sch-empty">… 还有 ${entries.length - 10} 条</div>` : ''}</div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="ip-cancel">取消</button>
        <button class="btn btn-ghost" id="ip-append">追加导入</button>
        <button class="btn btn-primary" id="ip-replace">替换全部</button>
      </div>`;
    m.body.querySelector('#ip-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#ip-append').addEventListener('click', async () => {
      schedule = schedule.concat(entries);
      await WB.api.saveSchedule(schedule);
      m.close();
      render();
      U.toast(`已追加 ${entries.length} 节课`, 'ok');
    });
    m.body.querySelector('#ip-replace').addEventListener('click', async () => {
      schedule = entries.slice();
      await WB.api.saveSchedule(schedule);
      m.close();
      render();
      U.toast(`课表已替换（${entries.length} 节）`, 'ok');
    });
  }

  /* ================= 粘贴 CSV ================= */
  function pasteModal() {
    const m = U.modal({ title: '📋 粘贴 CSV 课表', width: '680px' });
    m.body.innerHTML = `
      <p class="cfg-note">把 Excel / WPS 导出的 CSV 内容粘贴进来（支持 UTF-8 与 GBK 编码）。<br/>表头建议：<code>课程,星期,节次,结束节次,周次,地点,教师,备注</code></p>
      <textarea class="input area" id="csv-text" rows="10" spellcheck="false"
        placeholder="课程,星期,节次,周次,地点,教师&#10;高等数学,周一,1-2,1-16,教学楼A101,张三&#10;大学英语,周三,3-4,1-16,教学楼B202,李四&#10;线性代数,周五,第1-2节,1-8,实验楼C305,王五"></textarea>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="csv-cancel">取消</button>
        <button class="btn btn-primary" id="csv-parse">解析导入</button>
      </div>`;
    m.body.querySelector('#csv-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#csv-parse').addEventListener('click', () => {
      const text = m.body.querySelector('#csv-text').value;
      if (!text.trim()) return U.toast('先粘贴内容吧~', 'warn');
      m.close();
      importText(text, '粘贴');
    });
  }

  /* ================= 手动添加 / 编辑 ================= */
  function editEntry(entry) {
    const isEdit = !!entry;
    const m = U.modal({ title: isEdit ? '编辑课程' : '手动添加课程', width: '540px' });
    const wdOpts = ['', 1, 2, 3, 4, 5, 6, 7].map((wd) =>
      `<option value="${wd}" ${entry && entry.weekday === wd ? 'selected' : ''}>${wd ? WEEK_LABEL[wd] : '待定'}</option>`).join('');
    m.body.innerHTML = `
      <div class="form-grid">
        <label class="field full"><span class="field-label">课程名称</span>
          <input class="input" id="c-name" value="${U.esc((entry && entry.name) || '')}" placeholder="如：高等数学" /></label>
        <label class="field"><span class="field-label">星期</span>
          <select class="input" id="c-weekday">${wdOpts}</select></label>
        <label class="field"><span class="field-label">开始节次</span>
          <input class="input" id="c-start" type="number" min="1" max="14" value="${entry && entry.startPeriod != null ? entry.startPeriod : ''}" placeholder="如 1" /></label>
        <label class="field"><span class="field-label">结束节次</span>
          <input class="input" id="c-end" type="number" min="1" max="14" value="${entry && entry.endPeriod != null ? entry.endPeriod : ''}" placeholder="留空=只上一节" /></label>
        <label class="field"><span class="field-label">周次</span>
          <input class="input" id="c-weeks" value="${U.esc((entry && entry.weeks) || '')}" placeholder="如 1-16 或 1-8,10-16" /></label>
        <label class="field full"><span class="field-label">地点</span>
          <input class="input" id="c-loc" value="${U.esc((entry && entry.location) || '')}" placeholder="如：教学楼A101" /></label>
        <label class="field full"><span class="field-label">教师</span>
          <input class="input" id="c-teacher" value="${U.esc((entry && entry.teacher) || '')}" placeholder="如：张三" /></label>
        <label class="field full"><span class="field-label">备注</span>
          <input class="input" id="c-note" value="${U.esc((entry && entry.note) || '')}" placeholder="可选" /></label>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="c-cancel">取消</button>
        <button class="btn btn-primary" id="c-save">保存</button>
      </div>`;
    m.body.querySelector('#c-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#c-save').addEventListener('click', async () => {
      const q = (id) => m.body.querySelector(id);
      const name = q('#c-name').value.trim();
      if (!name) return U.toast('课程名称不能为空~', 'warn');
      const weekday = parseInt(q('#c-weekday').value, 10) || null;
      const start = parseInt(q('#c-start').value, 10) || null;
      const end = parseInt(q('#c-end').value, 10) || start;
      const data = {
        id: entry ? entry.id : U.uid('cls'),
        name,
        weekday,
        startPeriod: start,
        endPeriod: end,
        timeRaw: entry && entry.timeRaw || '',
        weeks: q('#c-weeks').value.trim(),
        location: q('#c-loc').value.trim(),
        teacher: q('#c-teacher').value.trim(),
        note: q('#c-note').value.trim(),
        color: entry ? entry.color : colorOf(name),
      };
      if (isEdit) {
        const idx = schedule.findIndex((e) => e.id === data.id);
        if (idx >= 0) schedule[idx] = data;
      } else {
        schedule.push(data);
      }
      await WB.api.saveSchedule(schedule);
      m.close();
      render();
      U.toast(isEdit ? '课程已更新' : '课程已添加', 'ok');
    });
  }

  function delEntry(entry) {
    U.confirmDlg(`删除课程「${entry.name}」？`, async () => {
      schedule = schedule.filter((e) => e.id !== entry.id);
      await WB.api.saveSchedule(schedule);
      render();
      U.toast('已删除', 'ok');
    });
  }

  return { render };
})();
