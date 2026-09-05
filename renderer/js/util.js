/* ============================================================
 * 鲸屿工作台 - 通用工具函数
 * ============================================================ */
window.WB = window.WB || {};

WB.util = (() => {
  /** 转义 HTML，防止注入 */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 生成短 id */
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  /** 今日日期 YYYY-MM-DD */
  function today() {
    return fmtDate(new Date());
  }

  function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** 相对时间描述 */
  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    const h = Math.floor(min / 60);
    if (h < 24) return h + ' 小时前';
    const d = Math.floor(h / 24);
    if (d < 30) return d + ' 天前';
    return fmtDate(new Date(iso));
  }

  /** 中文星期 */
  function weekdayCN(d) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  }

  /** 余额格式化 */
  function fmtMoney(n, currency) {
    if (n == null || isNaN(n)) return '—';
    const sym = currency === 'USD' ? '$' : '¥';
    const num = Number(n);
    return sym + num.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
  }

  /* ---------- DOM ---------- */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2), attrs[k]);
        } else if (attrs[k] != null && attrs[k] !== false) {
          node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
        }
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  /** Toast 提示 */
  function toast(msg, type) {
    const root = document.getElementById('toast-root');
    const t = el('div', { class: 'toast toast-' + (type || 'info') });
    const icon = { info: '🫧', ok: '✅', err: '🌊', warn: '⚠️' }[type || 'info'] || '🫧';
    t.innerHTML = `<span class="toast-ico">${icon}</span><span>${esc(msg)}</span>`;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 2600);
  }

  /** 弹窗（返回元素，由调用方填充内容） */
  function modal({ title, content, onClose, width }) {
    const root = document.getElementById('modal-root');
    const overlay = el('div', { class: 'modal-overlay' });
    const box = el('div', { class: 'modal-box', style: width ? 'width:' + width : '' });
    const head = el('div', { class: 'modal-head' });
    head.innerHTML = `<span class="modal-title">${esc(title)}</span>`;
    const closeBtn = el('button', { class: 'modal-x', onclick: () => close() });
    closeBtn.innerHTML = '&times;';
    head.appendChild(closeBtn);
    const body = el('div', { class: 'modal-body' });
    if (content) {
      body.appendChild(typeof content === 'string' ? el('div', { html: content }) : content);
    }
    box.appendChild(head);
    box.appendChild(body);
    overlay.appendChild(box);
    root.appendChild(overlay);

    function close() {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 250);
      if (onClose) onClose();
    }
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });
    return { overlay, box, body, close, head };
  }

  /** 确认框 */
  function confirmDlg(message, onYes) {
    const m = modal({ title: '鲸鱼确认一下~', content: `<p class="confirm-text">${esc(message)}</p>` });
    const foot = el('div', { class: 'modal-foot' });
    const no = el('button', { class: 'btn btn-ghost', text: '算了' });
    const yes = el('button', { class: 'btn btn-primary', text: '确定' });
    no.addEventListener('click', () => m.close());
    yes.addEventListener('click', () => {
      m.close();
      onYes && onYes();
    });
    foot.append(no, yes);
    m.body.appendChild(foot);
  }

  /* ---------- 异步 ---------- */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 深拷贝 */
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  return {
    esc, uid, today, fmtDate, fmtDateTime, timeAgo, weekdayCN, fmtMoney,
    el, toast, modal, confirmDlg, sleep, clone,
  };
})();
