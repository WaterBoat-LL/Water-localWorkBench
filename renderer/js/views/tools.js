/* ============================================================
 * 鲸屿工作台 - 常用工具栏模块
 * 内置：透明底色擦除器 / 小型计算机；支持自定义工具（名称+链接）
 * ============================================================ */
WB.views.tools = (() => {
  const U = WB.util;
  let tools = [];

  async function render() {
    tools = (await WB.api.getTools()) || [];
    root().innerHTML = `
      <div class="page-head">
        <h2 class="page-title"><span class="title-ico">🧰</span>常用工具栏</h2>
        <p class="page-sub">平时用的小工具，都放在这里~</p>
        <div class="head-actions">
          <button class="btn btn-primary" id="tool-add">＋ 自定义工具</button>
        </div>
      </div>
      <div class="tool-grid" id="tool-grid"></div>
    `;

    document.getElementById('tool-add').addEventListener('click', () => addCustomTool());
    renderGrid();
  }

  function root() { return document.getElementById('view-tools'); }

  function renderGrid() {
    const grid = document.getElementById('tool-grid');
    grid.innerHTML = tools.map((t) => `
      <div class="tool-card glass" data-id="${t.id}">
        <div class="tool-icon">${U.esc(t.icon || '🧩')}</div>
        <div class="tool-name">${U.esc(t.name)}</div>
        <div class="tool-desc">${U.esc(t.desc || '')}</div>
        <div class="tool-ops">
          <button class="btn btn-mini btn-primary-soft" data-act="open">${t.builtin ? '打开' : '启动'}</button>
          ${t.builtin ? '' : `<button class="btn btn-mini btn-ghost" data-act="edit">编辑</button>
          <button class="btn btn-mini btn-danger-soft" data-act="del">删除</button>`}
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-act]').forEach((btn) => {
      const t = tools.find((x) => x.id === btn.closest('.tool-card').dataset.id);
      if (!t) return;
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'open') openTool(t);
        else if (act === 'edit') editCustomTool(t);
        else if (act === 'del') delCustomTool(t);
      });
    });
  }

  function openTool(t) {
    if (t.builtin) {
      if (t.id === 'bg-eraser') openEraser();
      else if (t.id === 'calculator') openCalculator();
      else if (t.id === 'ppt-maker') openPptMaker();
      else U.toast('未知内置工具', 'warn');
    } else if (t.url) {
      window.workbench.openExternal(t.url);
    }
  }

  /* ================= AI 生成 PPT ================= */
  function openPptMaker() {
    WB.pptMaker.open();
  }

  /* ================= 透明底色擦除器 ================= */
  function openEraser() {
    const m = U.modal({ title: '🎨 透明底色擦除器', width: '780px' });
    m.body.innerHTML = `
      <div class="eraser-wrap">
        <div class="eraser-bar">
          <button class="btn btn-primary-soft btn-mini" id="e-load">📁 选择图片</button>
          <input type="file" id="e-file" accept="image/*" hidden />
          <label class="eraser-label">容差 <input type="range" id="e-tol" min="0" max="160" value="40" /> <span id="e-tol-v">40</span></label>
          <button class="btn btn-primary btn-mini" id="e-apply" disabled>✨ 擦除背景</button>
          <button class="btn btn-ghost btn-mini" id="e-reset" disabled>↺ 重置</button>
          <button class="btn btn-ok btn-mini" id="e-download" disabled>💾 导出 PNG</button>
        </div>
        <div class="eraser-canvas-wrap">
          <canvas id="e-canvas"></canvas>
        </div>
        <p class="eraser-tip">💡 提示：先在画布上点击想要变成透明的颜色（默认取左上角像素），再点「擦除背景」。</p>
      </div>
    `;

    const canvas = m.body.querySelector('#e-canvas');
    const ctx = canvas.getContext('2d');
    const fileInput = m.body.querySelector('#e-file');
    const tolInput = m.body.querySelector('#e-tol');
    const tolVal = m.body.querySelector('#e-tol-v');
    const btnApply = m.body.querySelector('#e-apply');
    const btnReset = m.body.querySelector('#e-reset');
    const btnDl = m.body.querySelector('#e-download');
    let image = null;      // 原始 Image
    let erased = false;

    tolInput.addEventListener('input', () => { tolVal.textContent = tolInput.value; });
    m.body.querySelector('#e-load').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        image = img;
        fitCanvas(img, canvas);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        erased = false;
        btnApply.disabled = false;
        btnReset.disabled = true;
        btnDl.disabled = true;
      };
      img.src = url;
    });

    // 点击取色
    canvas.addEventListener('click', (e) => {
      if (!image) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      const px = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      U.toast(`已取色 RGB(${px[0]},${px[1]},${px[2]})`, 'info');
      sampleColor = [px[0], px[1], px[2]];
      if (erased) { ctx.drawImage(image, 0, 0, canvas.width, canvas.height); erased = false; }
    });
    let sampleColor = null;

    btnApply.addEventListener('click', () => {
      if (!image) return;
      const tol = Number(tolInput.value);
      // 若未手动取色，取左上角像素
      if (!sampleColor) {
        const p = ctx.getImageData(1, 1, 1, 1).data;
        sampleColor = [p[0], p[1], p[2]];
      }
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      const [sr, sg, sb] = sampleColor;
      for (let i = 0; i < px.length; i += 4) {
        const dr = px[i] - sr, dg = px[i + 1] - sg, db = px[i + 2] - sb;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist <= tol) px[i + 3] = 0;
      }
      ctx.putImageData(data, 0, 0);
      erased = true;
      btnReset.disabled = false;
      btnDl.disabled = false;
      U.toast('擦除完成！点「导出 PNG」保存透明图', 'ok');
    });

    btnReset.addEventListener('click', () => {
      if (!image) return;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      erased = false;
      sampleColor = null;
      btnReset.disabled = true;
      btnDl.disabled = true;
    });

    btnDl.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = '透明图_' + Date.now() + '.png';
      a.click();
      U.toast('已导出 PNG', 'ok');
    });
  }

  function fitCanvas(img, canvas) {
    const MAX = 900;
    let w = img.naturalWidth, h = img.naturalHeight;
    const scale = Math.min(1, MAX / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.style.width = '100%';
    canvas.style.maxHeight = '480px';
  }

  /* ================= 小型计算机 ================= */
  function openCalculator() {
    const m = U.modal({ title: '🧮 小型计算机', width: '340px' });
    m.body.innerHTML = `
      <div class="calc">
        <div class="calc-screen">
          <div class="calc-expr" id="c-expr"></div>
          <div class="calc-result" id="c-result">0</div>
        </div>
        <div class="calc-grid">
          ${['C', '±', '%', '÷',
            '7', '8', '9', '×',
            '4', '5', '6', '−',
            '1', '2', '3', '+',
            '0', '.', '⌫', '='].map((k) => `<button class="calc-btn ${keyClass(k)}" data-k="${k}">${k}</button>`).join('')}
        </div>
      </div>
    `;

    function keyClass(k) {
      if (k === '=') return 'eq';
      if (['C', '±', '%', '⌫'].includes(k)) return 'fn';
      if (['÷', '×', '−', '+'].includes(k)) return 'op';
      return '';
    }

    let expr = '';
    let acc = null;
    let op = null;
    let fresh = true;

    function render() {
      const result = m.body.querySelector('#c-result');
      const exprEl = m.body.querySelector('#c-expr');
      if (acc != null && op) exprEl.textContent = `${acc} ${op}`;
      else exprEl.textContent = expr;
      result.textContent = acc != null ? trim(acc) : (expr === '' ? '0' : trim(expr));
    }
    function trim(n) {
      if (!isFinite(n)) return '错误';
      const s = String(Math.round(n * 1e8) / 1e8);
      return s.length > 14 ? n.toExponential(6) : s;
    }

    function press(k) {
      if (/\d/.test(k)) {
        if (fresh) { expr = k; fresh = false; }
        else expr = expr.length < 16 ? expr + k : expr;
      } else if (k === '.') {
        if (fresh) { expr = '0.'; fresh = false; }
        else if (!expr.includes('.')) expr += '.';
      } else if (k === 'C') {
        expr = ''; acc = null; op = null; fresh = true;
      } else if (k === '⌫') {
        if (!fresh) { expr = expr.slice(0, -1); if (!expr) fresh = true; }
      } else if (k === '±') {
        if (!fresh) expr = expr.startsWith('-') ? expr.slice(1) : '-' + expr;
      } else if (k === '%') {
        if (!fresh) { const v = parseFloat(expr) / 100; expr = String(v); }
      } else if (['+', '−', '×', '÷'].includes(k)) {
        const v = parseFloat(expr);
        if (acc == null) { acc = v; }
        else if (!fresh) { acc = calc(acc, v, op); }
        op = k;
        expr = '';
        fresh = true;
      } else if (k === '=') {
        const v = parseFloat(expr);
        if (acc != null && op) {
          acc = calc(acc, v, op);
          expr = String(acc);
          acc = null; op = null; fresh = true;
        }
      }
      render();
    }

    function calc(a, b, o) {
      switch (o) {
        case '+': return a + b;
        case '−': return a - b;
        case '×': return a * b;
        case '÷': return b === 0 ? NaN : a / b;
        default: return b;
      }
    }

    m.body.querySelectorAll('.calc-btn').forEach((b) => {
      b.addEventListener('click', () => press(b.dataset.k));
    });
    render();
  }

  /* ================= 自定义工具 ================= */
  function addCustomTool() { editCustomTool(null); }

  function editCustomTool(tool) {
    const isEdit = !!tool;
    const m = U.modal({ title: isEdit ? '编辑工具' : '添加自定义工具', width: '460px' });
    m.body.innerHTML = `
      <div class="form-grid">
        <label class="field full">
          <span class="field-label">工具名称</span>
          <input class="input" id="t-name" value="${U.esc((tool && tool.name) || '')}" placeholder="如：图片压缩" />
        </label>
        <label class="field full">
          <span class="field-label">图标（emoji）</span>
          <input class="input" id="t-icon" maxlength="4" value="${U.esc((tool && tool.icon) || '🧩')}" />
        </label>
        <label class="field full">
          <span class="field-label">网页工具 URL（点击会用浏览器打开）</span>
          <input class="input" id="t-url" value="${U.esc((tool && tool.url) || '')}" placeholder="https://..." />
        </label>
        <label class="field full">
          <span class="field-label">描述</span>
          <input class="input" id="t-desc" value="${U.esc((tool && tool.desc) || '')}" placeholder="这个工具是干嘛的" />
        </label>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="t-cancel">取消</button>
        <button class="btn btn-primary" id="t-save">保存</button>
      </div>
    `;
    m.body.querySelector('#t-cancel').addEventListener('click', () => m.close());
    m.body.querySelector('#t-save').addEventListener('click', async () => {
      const name = m.body.querySelector('#t-name').value.trim();
      const icon = m.body.querySelector('#t-icon').value.trim() || '🧩';
      const url = m.body.querySelector('#t-url').value.trim();
      const desc = m.body.querySelector('#t-desc').value.trim();
      if (!name) return U.toast('给工具起个名字~', 'warn');
      if (!isEdit && !/^https?:\/\//i.test(url)) return U.toast('URL 要以 http(s):// 开头', 'warn');
      if (isEdit) {
        tool.name = name; tool.icon = icon; tool.url = url; tool.desc = desc;
      } else {
        tools.push({ id: U.uid('tool'), name, icon, url, desc, builtin: false, createdAt: new Date().toISOString() });
      }
      await WB.api.saveTools(tools);
      m.close();
      renderGrid();
      U.toast('工具已保存', 'ok');
    });
  }

  function delCustomTool(t) {
    U.confirmDlg(`删除工具「${t.name}」？`, async () => {
      tools = tools.filter((x) => x.id !== t.id);
      await WB.api.saveTools(tools);
      renderGrid();
      U.toast('工具已删除', 'ok');
    });
  }

  return { render };
})();
