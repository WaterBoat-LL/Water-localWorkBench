/**
 * 鲸屿工作台 - Electron 主进程
 * DeepSeek 鲸鱼娘的海洋风本地桌面工作台
 */
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');

// dsh-ppt 引擎路径（零依赖，可直接 node 调用）
const DECK_ENGINE_DIR_CANDIDATES = [
  path.join(require('os').homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-ppt', 'skills', 'dsh-ppt', 'scripts'),
  path.join(__dirname, 'node_modules', 'dsh-ppt', 'skills', 'dsh-ppt', 'scripts'),
];

// Git 相关路径（D:\Git 安装了 Git for Windows 2.53）
const GIT_EXE = ['D:\\Git\\bin\\git.exe', 'D:\\Git\\cmd\\git.exe'].find((p) => fs.existsSync(p)) || 'git';
const GIT_BASH = ['D:\\Git\\git-bash.exe', 'D:\\Git\\bin\\bash.exe'].find((p) => fs.existsSync(p)) || '';

// 自定义 local:// 协议必须先注册为特权协议（需在 app ready 之前）
protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
const DECKS_DIR = path.join(__dirname, 'data', 'decks');

/** 确保数据目录存在 */
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** 读取 JSON 数据文件，不存在则返回默认值 */
function readData(file, def) {
  ensureDirs();
  const p = path.join(DATA_DIR, file);
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      if (raw.trim()) return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[readData]', file, e.message);
  }
  return def !== undefined ? def : {};
}

/** 写入 JSON 数据文件 */
function writeData(file, data) {
  ensureDirs();
  const p = path.join(DATA_DIR, file);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
  return { ok: true };
}

/** 通用 HTTPS/HTTP 请求（Node 原生，规避浏览器 CORS） */
function request(options, body) {
  return new Promise((resolve, reject) => {
    const mod = options.protocol === 'http:' ? http : https;
    const req = mod.request(options, (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.setTimeout(options.timeout || 20000, () => {
      req.destroy(new Error('请求超时'));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** 解析 url 字符串 */
function parseUrl(u) {
  try {
    return new URL(u);
  } catch (e) {
    return null;
  }
}

/**
 * 查询各平台 API 余额
 * 返回统一结构: { ok, available, total, currency, raw, error, updatedAt }
 */
async function queryBalance(acc) {
  const { type, apiKey, baseUrl } = acc || {};
  const updatedAt = new Date().toISOString();
  if (!apiKey) return { ok: false, error: '未配置 API Key', updatedAt };
  const now = updatedAt;

  try {
    // ===== DeepSeek 官方 =====
    if (type === 'deepseek') {
      const url = parseUrl(baseUrl || 'https://api.deepseek.com');
      const res = await request({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: '/user/balance',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          Accept: 'application/json',
          'User-Agent': 'ocean-workbench',
        },
      });
      const json = safeParse(res.body);
      if (!json) return { ok: false, error: '响应解析失败 HTTP ' + res.status, updatedAt };
      if (res.status >= 400) {
        return { ok: false, error: (json.error && json.error.message) || json.message || ('HTTP ' + res.status), updatedAt, raw: json };
      }
      const bi = (json.balance_infos || [])[0] || {};
      return {
        ok: true,
        available: json.is_available !== false,
        total: bi.total_balance,
        granted: bi.granted_balance,
        toppedUp: bi.topped_up_balance,
        currency: bi.currency || 'CNY',
        raw: json,
        updatedAt: now,
      };
    }

    // ===== OpenRouter =====
    if (type === 'openrouter') {
      const url = parseUrl(baseUrl || 'https://openrouter.ai');
      const res = await request({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: '/api/v1/credits',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          Accept: 'application/json',
          'User-Agent': 'ocean-workbench',
        },
      });
      const json = safeParse(res.body);
      if (!json) return { ok: false, error: '响应解析失败 HTTP ' + res.status, updatedAt };
      if (res.status >= 400) {
        return { ok: false, error: (json.error && json.error.message) || ('HTTP ' + res.status), updatedAt, raw: json };
      }
      const d = json.data || {};
      return {
        ok: true,
        available: true,
        total: d.credits,
        currency: 'USD',
        raw: json,
        updatedAt: now,
      };
    }

    // ===== OpenAI 官方 =====
    if (type === 'openai') {
      const res = await request({
        protocol: 'https:',
        hostname: 'api.openai.com',
        path: '/dashboard/billing/credit_grants',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      });
      const json = safeParse(res.body);
      if (!json) return { ok: false, error: '响应解析失败 HTTP ' + res.status, updatedAt };
      if (res.status >= 400) {
        return { ok: false, error: (json.error && json.error.message) || ('HTTP ' + res.status), updatedAt, raw: json };
      }
      return {
        ok: true,
        available: true,
        total: json.total_granted && json.total_used ? json.total_granted - json.total_used : json.total_granted,
        granted: json.total_granted,
        used: json.total_used,
        currency: 'USD',
        raw: json,
        updatedAt: now,
      };
    }

    // ===== 硅基流动 SiliconFlow（GET /v1/user/info 返回余额） =====
    if (type === 'siliconflow') {
      const url = parseUrl(baseUrl || 'https://api.siliconflow.cn/v1');
      const basePath = url.pathname.replace(/\/+$/, '');
      const res = await request({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: basePath + '/user/info',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json', 'User-Agent': 'ocean-workbench' },
      });
      const json = safeParse(res.body);
      if (!json) return { ok: false, error: '响应解析失败 HTTP ' + res.status, updatedAt };
      if (res.status >= 400) {
        return { ok: false, error: (json.error && json.error.message) || json.message || ('HTTP ' + res.status), updatedAt, raw: json };
      }
      const d = json.data || json;
      // 硅基流动实际返回 data.totalBalance；兼容其它命名
      const total = d.totalBalance ?? d.balance ?? d.total_balance ?? d.remaining_amount
        ?? d.available_balance ?? d.remaining ?? (d.user && d.user.remaining_amount);
      if (total == null) {
        // 把接口的 code/message（可能含 deprecated 提示）反馈出来
        return { ok: false, error: (json.message || json.error?.message || '未返回余额字段 (totalBalance)'), updatedAt, raw: json };
      }
      return { ok: true, available: true, total, currency: d.currency || 'CNY', used: d.used_balance, raw: json, updatedAt: now };
    }

    // ===== 通义千问 / 阿里云百炼 DashScope =====
    // 注意：DashScope 没有公开的余额查询接口（仅控制台可看），返回明确提示
    if (type === 'dashscope') {
      return { ok: false, error: '通义千问/DashScope 没有公开的余额查询接口，请到阿里云百炼控制台查看余额', updatedAt };
    }

    // ===== Moonshot AI / Kimi 开放平台（GET {base}/v1/users/me/balance） =====
    if (type === 'moonshot') {
      const url = parseUrl(baseUrl || 'https://api.moonshot.cn/v1');
      const basePath = url.pathname.replace(/\/+$/, '');
      const res = await request({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: basePath + '/users/me/balance',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json', 'User-Agent': 'ocean-workbench' },
      });
      const json = safeParse(res.body);
      if (!json) return { ok: false, error: '响应解析失败 HTTP ' + res.status, updatedAt };
      if (res.status >= 400) {
        return { ok: false, error: (json.error && json.error.message) || json.message || ('HTTP ' + res.status), updatedAt, raw: json };
      }
      // Moonshot 返回 { code, data: { available_balance, cash_balance, vouchers_balance } }
      if (json.code != null && json.code !== 0) {
        return { ok: false, error: json.message || json.scode_msg || ('Moonshot 错误 code=' + json.code), updatedAt, raw: json };
      }
      const d = json.data || json;
      const available =
        d.available_balance ?? d.balance ?? d.remaining_balance ??
        (d.cash_balance != null && d.vouchers_balance != null ? Number(d.cash_balance) + Number(d.vouchers_balance) : null);
      if (available == null) {
        return { ok: false, error: '未返回余额字段 (available_balance)', updatedAt, raw: json };
      }
      const currency = /moonshot\.ai/i.test(url.hostname) ? 'USD' : (d.currency || 'CNY');
      return {
        ok: true,
        available: true,
        total: available,
        cash: d.cash_balance,
        vouchers: d.vouchers_balance,
        currency,
        raw: json,
        updatedAt: now,
      };
    }

    // ===== 通用 OpenAI 兼容（自定义 baseUrl，如中转站） =====
    if (type === 'custom' && baseUrl) {
      let url = parseUrl(baseUrl);
      if (!url) return { ok: false, error: 'baseUrl 不合法', updatedAt };
      const basePath = url.pathname.replace(/\/+$/, '');
      // 按 baseUrl 前缀拼接常见余额接口
      const candidates = [
        basePath + '/user/info',
        basePath + '/user/balance',
        basePath + '/dashboard/billing/credit_grants',
        basePath + '/v1/user/info',
        basePath + '/v1/user/balance',
        '/user/info',
        '/v1/user/balance',
      ];
      const seen = new Set();
      for (const p of candidates) {
        if (seen.has(p)) continue;
        seen.add(p);
        try {
          const res = await request({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || undefined,
            path: p,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
          });
          const json = safeParse(res.body);
          if (res.status === 200 && json) {
            // 尝试多种常见返回结构
            const d = json.data || json;
            const total =
              d.totalBalance ?? d.balance ?? d.total_balance ??
              d.remaining_amount ?? d.available_balance ?? d.remaining ??
              d.total_balance ?? d.total_granted ?? d.credits ?? d.remaining_balance ??
              (d.total_granted != null && d.total_used != null ? d.total_granted - d.total_used : null);
            if (total != null) {
              const currency =
                d.currency ||
                (json.balance_infos && json.balance_infos[0] && json.balance_infos[0].currency) ||
                'CNY';
              return {
                ok: true,
                available: json.is_available !== false && json.error == null,
                total,
                used: d.total_used ?? d.used ?? d.used_balance,
                currency,
                raw: json,
                updatedAt: now,
              };
            }
          }
        } catch (e) {
          /* 尝试下一个路径 */
        }
      }
      return { ok: false, error: '无法识别该 baseUrl 的余额接口（已尝试多个常见路径）', updatedAt };
    }

    return { ok: false, error: '不支持的账号类型: ' + type, updatedAt };
  } catch (e) {
    return { ok: false, error: e.message, updatedAt };
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/** 创建主窗口 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: '鲸屿工作台',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#04223a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 自检模式：DSH_APP_TEST=1 时验证渲染进程后自动退出（供开发验证用）
  if (process.env.DSH_APP_TEST === '1') {
    win.webContents.once('did-finish-load', async () => {
      try {
        await new Promise((r) => setTimeout(r, 3000)); // 等启动画面与首页渲染
        const report = await win.webContents.executeJavaScript(`(() => {
          const hasWB = !!(window.WB && window.WB.api && window.WB.views);
          const views = ['home','balance','memo','schedule','links','notes','tools','git','games','about'].map(v => ({
            id: v,
            exists: !!document.getElementById('view-' + v)
          }));
          const active = document.querySelector('.view.active');
          const ballCount = document.querySelectorAll('.ball').length;
          const activeBall = (document.querySelector('.ball.active') || {}).dataset
            ? document.querySelector('.ball.active').dataset.view : null;
          const three = typeof window.THREE !== 'undefined';
          const bg3dEl = !!document.getElementById('bg3d');
          const topnav = !!document.querySelector('.topnav');
          const whaleLayer = !!document.querySelector('.whale-layer img');
          const whaleBlur = whaleLayer ? getComputedStyle(document.querySelector('.whale-layer')).filter : null;
          const avatarImg = !!document.querySelector('.whale-avatar img');
          const splashImg = !!document.querySelector('.splash-logo img');
          const bgImg = getComputedStyle(document.body).backgroundImage || '';
          const activeClass = active ? active.id : null;
          return JSON.stringify({ title: document.title, hasWB, three, bg3dEl, topnav,
            ballCount, activeBall, activeView: activeClass,
            views, homeHtmlLen: (document.getElementById('view-home').innerHTML || '').length,
            avatarImg, splashImg, bgImageLoaded: bgImg.includes('background.png'),
            whaleLayer, whaleBlur });
        })()`);
        console.log('[SELFTEST]', report);
      } catch (e) {
        console.log('[SELFTEST] FAILED', e.message);
      }
      setTimeout(() => app.exit(0), 500);
    });
  }

  win.once('ready-to-show', () => win.show());

  // 外部链接一律走系统默认浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

let mainWindow = null;

// ---------------------------------------------------------------------------
// AI 生成 PPT（dsh-ppt 引擎 + DeepSeek 扩写 + 可选 AI 生图配图）
// ---------------------------------------------------------------------------

const PPT_THEMES = [
  { id: 'data', name: '数据漂移', mood: '未来·沉浸', bestFor: 'AI、技术、研究（默认）' },
  { id: 'swiss', name: '瑞士脉冲', mood: '精准·理性', bestFor: 'SaaS、数据、开发者工具' },
  { id: 'velvet', name: '天鹅绒标准', mood: '高级·克制', bestFor: '高管汇报、品牌、路演' },
  { id: 'soft', name: '柔和信号', mood: '温暖·人本', bestFor: '品牌故事、培训、个人分享' },
  { id: 'bold', name: '极繁大字', mood: '大声·动能', bestFor: '产品发布、活动、大事件' },
];
const PPT_THEME_MOOD = PPT_THEMES.reduce((acc, t) => { acc[t.id] = t.mood; return acc; }, {});

/** 生成安全文件名 */
function sanitizeFileName(input) {
  const base = String(input || 'deck').trim().replace(/\.(html?|pptx|json)$/i, '');
  const cleaned = base
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 120) || 'deck';
}

const PPT_SYSTEM_PROMPT = `你是一位资深演示文稿策划师。根据用户给的主题/提示词，产出一份直接能渲染成 PPT 的 Markdown 大纲。
严格按下面的格式输出，且只输出 Markdown 本身（不要代码围栏、不要额外解释、不要 Markdown 说明）：

# <演讲标题，用一句判断句>

<副标题：一句话点题/情绪句，不加 # 号>

## <板块1标题>
- <要点，≤20字，先结论后理由>
- <要点>
## <板块2标题>
- <要点>
- <要点>

结构要求：封面 → 背景/问题 → 解决方案/论点（3~6 页）→ 证据/案例 → 行动号召。
每页只讲一个观点；要点不超过 6 条；每条不超过 20 字；用短句；中文。
最后一页不要写「谢谢」（引擎会自动补结束页）。`;

/** 定位 dsh-ppt 引擎脚本 */
function resolveDeckEngine() {
  for (const dir of DECK_ENGINE_DIR_CANDIDATES) {
    const p = path.join(dir, 'build-deck.mjs');
    if (fs.existsSync(p)) return p;
  }
  return '';
}

/** 运行 dsh-ppt 引擎（node build-deck.mjs ...），捕获输出 */
function runDeckEngine(args) {
  return new Promise((resolve) => {
    const engine = resolveDeckEngine();
    if (!engine) return resolve({ ok: false, code: -1, stdout: '', stderr: '未找到 dsh-ppt 引擎（build-deck.mjs）' });
    // 优先用 Electron 自带的 Node 运行时，避免依赖系统 PATH；失败再回退 'node'
    const useSelf = !!process.versions.electron && !!process.execPath;
    const cmd = useSelf ? process.execPath : 'node';
    const env = useSelf ? Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }) : process.env;
    let child;
    try {
      child = spawn(cmd, [engine].concat(args), { windowsHide: true, env });
    } catch (e) {
      return resolve({ ok: false, code: -1, stdout: '', stderr: String(e) });
    }
    let out = '', err = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => (out += d));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout: out, stderr: err }));
    child.on('error', (e) => resolve({ ok: false, code: -1, stdout: out, stderr: String(e) }));
  });
}

/** DeepSeek / OpenAI 兼容的对话补全 */
async function chatCompletions(account, systemPrompt, userText, opts = {}) {
  const apiKey = account && account.apiKey;
  if (!apiKey) return { ok: false, error: '未配置 API Key' };
  let url;
  try { url = new URL(account.baseUrl || 'https://api.deepseek.com'); }
  catch { url = new URL('https://api.deepseek.com'); }
  const basePath = url.pathname.replace(/\/+$/, '');
  const body = JSON.stringify({
    model: account.model || opts.model || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
    temperature: opts.temperature != null ? opts.temperature : 0.7,
    max_tokens: opts.maxTokens || 3000,
  });
  const res = await request({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || undefined,
    path: opts.path || (basePath + '/chat/completions'),
    method: 'POST',
    timeout: opts.timeout || 60000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json',
    },
  }, body);
  const json = safeParse(res.body);
  if (res.status >= 400 || !json) {
    return { ok: false, error: (json && json.error && json.error.message) || (json && json.message) || ('HTTP ' + res.status) };
  }
  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  return { ok: true, content: content || '' };
}

/** 下载图片为二进制（供 url 型生图结果转 base64） */
function fetchBuffer(urlStr) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch { return reject(new Error('图片 URL 不合法')); }
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.get(u, (res) => {
      if (res.statusCode >= 400) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('图片下载超时')));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 调用图像生成：千问(DashScope) 走异步任务，其余走 OpenAI 兼容同步 */
async function genImage(cfg, prompt) {
  const base = (cfg.baseUrl || '').trim();
  if (!base) return { ok: false, error: '未配置图像生成 baseUrl' };
  let url;
  try { url = new URL(base); } catch { return { ok: false, error: '图像 baseUrl 不合法' }; }
  const isDash = /dashscope/i.test(url.hostname) || /wanx|qwen-image/i.test(cfg.model || '');
  if (isDash) return dashscopeImage(url, cfg, prompt);
  return openaiCompatibleImage(url, cfg, prompt);
}

/** 千问 / 阿里云百炼：异步提交任务 + 轮询取图 */
async function dashscopeImage(url, cfg, prompt) {
  const dashSize = (cfg.size || '1024x1024').replace(/[x×]/i, '*'); // 千问要求 1024*1024
  const model = cfg.model || 'wanx-v1';
  const submit = await request({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || undefined,
    path: '/api/v1/services/aigc/text2image/image-synthesis',
    method: 'POST',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (cfg.apiKey || ''), Accept: 'application/json' },
  }, JSON.stringify({ model, input: { prompt }, parameters: { size: dashSize, n: 1 } }));
  const sj = safeParse(submit.body);
  if (submit.status >= 400 || !sj) {
    return { ok: false, error: (sj && (sj.message || sj.error)) || ('HTTP ' + submit.status) };
  }
  const taskId = sj.output && sj.output.task_id;
  if (!taskId) {
    return { ok: false, error: '未获取到任务 id：' + ((sj.message) || submit.body.slice(0, 160)) };
  }
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const pr = await request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: '/api/v1/tasks/' + taskId,
      method: 'GET',
      timeout: 30000,
      headers: { Authorization: 'Bearer ' + (cfg.apiKey || ''), Accept: 'application/json' },
    });
    const pj = safeParse(pr.body);
    const st = pj && pj.output && pj.output.task_status;
    if (st === 'SUCCEEDED') {
      const im = pj.output.results && pj.output.results[0];
      if (im && im.b64_image) return { ok: true, mime: 'image/png', b64: im.b64_image };
      if (im && im.url) {
        try { const buf = await fetchBuffer(im.url); return { ok: true, mime: 'image/png', b64: buf.toString('base64') }; }
        catch (e) { return { ok: false, error: '图片下载失败：' + e.message }; }
      }
      return { ok: false, error: '任务成功但未返回图片' };
    }
    if (st === 'FAILED' || st === 'CANCELED' || (pj && pj.code && pj.code !== 20000 && pj.code !== 20001)) {
      return { ok: false, error: (pj && pj.message) || ('任务失败 (' + st + ')') };
    }
  }
  return { ok: false, error: '任务超时，请稍后重试' };
}

/** OpenAI 兼容同步图生图（DeepSeek/硅基流动/中转站等） */
async function openaiCompatibleImage(url, cfg, prompt) {
  const basePath = url.pathname.replace(/\/+$/, '');
  const ep = (basePath || '') + '/images/generations';
  const size = cfg.size || '1024x1024';
  const isSF = /siliconflow|silicon/i.test(url.hostname);
  const body = isSF
    ? JSON.stringify({ model: cfg.model || 'Kwai-Kolors/Kolors', prompt, image_size: size, batch_size: 1, response_format: 'b64_json' })
    : JSON.stringify({ model: cfg.model || 'dall-e-3', prompt, n: 1, size, response_format: 'b64_json' });
  const res = await request({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || undefined,
    path: ep || '/images/generations',
    method: 'POST',
    timeout: 120000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (cfg.apiKey || ''),
      Accept: 'application/json',
    },
  }, body);
  const json = safeParse(res.body);
  if (res.status >= 400 || !json) {
    return { ok: false, error: (json && json.error && json.error.message) || (json && json.message) || ('HTTP ' + res.status) };
  }
  const imgArr =
    (Array.isArray(json.images) && json.images) ||
    (json.data && json.data.images) ||
    (Array.isArray(json.data) && json.data) ||
    [];
  const item = imgArr[0];
  if (item && item.b64_json) return { ok: true, mime: 'image/png', b64: item.b64_json };
  if (item && item.url) {
    try {
      const buf = await fetchBuffer(item.url);
      return { ok: true, mime: 'image/png', b64: buf.toString('base64') };
    } catch (e) { return { ok: false, error: '图片下载失败：' + e.message }; }
  }
  return { ok: false, error: '图像接口未返回图片数据' };
}

/** 规范化模型返回的 Markdown（去代码围栏） */
function sanitizeMd(text) {
  let t = String(text || '')
    .replace(/```(?:markdown|md)?/gi, '')
    .replace(/```/g, '')
    .trim();
  return t;
}

/** 从 Markdown 里取第一个 H1 作标题 */
function mdTitle(md) {
  const m = /:?^\s*#\s+(.+)$/m.exec(String(md || ''));
  return m ? m[1].trim() : '';
}

/** 把生成的图片作为背景注入到对应 index 的 slide 上（index 从 1 开始） */
function injectImages(html, images) {
  return String(html).replace(/<section class="slide slide--[^"]*?" data-index="(\d+)">/g, (full, di) => {
    const n = parseInt(di, 10);
    const dataUrl = images[n - 1];
    if (!dataUrl) return full;
    const style = `background-image:linear-gradient(rgba(5,12,24,0.34),rgba(5,12,24,0.34)),url(${dataUrl});background-size:cover;background-position:center;`;
    return full.replace('>', ' style="' + style + '">');
  });
}

/** 读取生成历史（data/decks/index.json） */
function getDeckHistory() {
  try {
    const raw = fs.readFileSync(path.join(DECKS_DIR, 'index.json'), 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function pushDeckHistory(entry) {
  try {
    fs.mkdirSync(DECKS_DIR, { recursive: true });
    const arr = getDeckHistory();
    arr.unshift(entry);
    fs.writeFileSync(path.join(DECKS_DIR, 'index.json'), JSON.stringify(arr.slice(0, 30), null, 2), 'utf-8');
  } catch (e) { /* 忽略历史写入失败 */ }
}

/** 主流程：扩写 + 渲染 + 可选配图 */
async function deckGenerate(payload = {}) {
  const { prompt, title = '', theme = 'data', lang = 'zh', maxSlides = 6, imageMode = 'off', accountId = '', model = '' } = payload;
  const p = String(prompt || '').trim();
  if (!p) return { ok: false, error: '请填写主题/提示词' };

  const cfg = readData('config.json', {});
  const accounts = cfg.apiAccounts || [];
  const account = (accountId && accounts.find((a) => a.id === accountId))
    || accounts.find((a) => a.type === 'deepseek')
    || accounts.find((a) => a.type === 'dashscope')
    || accounts[0];
  if (!account || !account.apiKey) return { ok: false, error: '请先在「API 余额」里配置一个账号（DeepSeek / 通义千问等）' };

  // 1. 扩写（默认用账号模型；通义千问没配模型则用 qwen-plus）
  const expandModel = model || account.model
    || (String(account.baseUrl || '').includes('dashscope') ? 'qwen-plus' : 'deepseek-chat');
  const userText = p + `\n\n（目标页数：约 ${maxSlides} 页，含封面与结束页；每页一个观点，要点不超过 6 条。）`;
  const expanded = await chatCompletions(account, PPT_SYSTEM_PROMPT, userText, { model: expandModel });
  if (!expanded.ok) return { ok: false, error: '内容扩写失败：' + expanded.error };
  let md = sanitizeMd(expanded.content || '');
  if (!md) return { ok: false, error: '扩写结果为空' };
  const mdName = mdTitle(md);

  // 2. 输出目录
  const slug = sanitizeFileName(title || mdName || 'ppt');
  const dir = path.join(DECKS_DIR, Date.now() + '_' + slug);
  fs.mkdirSync(dir, { recursive: true });
  const contentPath = path.join(dir, 'content.md');
  fs.writeFileSync(contentPath, md, 'utf-8');

  const deckTitle = title || mdName || '演示文稿';

  // 3. 渲染
  const res = await runDeckEngine([
    '--title', deckTitle,
    '--content', '@' + contentPath,
    '--theme', theme,
    '--lang', lang,
    '--out', dir,
    '--file', slug,
  ]);
  if (!res.ok) return { ok: false, error: '渲染失败：' + res.stderr };

  const htmlPath = path.join(dir, slug + '.html');
  const pptxPath = path.join(dir, slug + '.pptx');
  const jsonPath = path.join(dir, slug + '.json');
  let slideCount = 0;
  let manifestSlides = [];
  try {
    const manifest = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    slideCount = manifest.slideCount || 0;
    manifestSlides = manifest.slides || [];
  } catch (e) { /* ignore */ }

  // 4. 可选 AI 生图（读取用户已保存的配图服务配置）
  const imageGen = (cfg.ppt && cfg.ppt.imageGen) || {};
  let imageCount = 0, imageError = '';
  const wantImage = imageMode !== 'off' && imageGen.enabled && imageGen.baseUrl && imageGen.apiKey;
  if (wantImage) {
    try {
      const manifest = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const slides = manifest.slides || [];
      const indexes = imageMode === 'cover' ? [0] : slides.map((_, i) => i);
      const images = [];
      for (const idx of indexes) {
        const s = slides[idx] || {};
        const label = String(s.title || deckTitle).slice(0, 40);
        const prompt2 = `Minimal refined abstract illustration for a presentation slide titled "${label}". Theme mood: ${PPT_THEME_MOOD[theme] || 'futuristic'}. Clean composition, generous negative space, subtle gradient, no text, no words, no letters, no UI, no diagram, no numbers.`;
        const im = await genImage(imageGen, prompt2);
        if (im.ok) { images[idx] = 'data:' + im.mime + ';base64,' + im.b64; imageCount += 1; }
        else { imageError = im.error; }
      }
      if (images.length) {
        let html = fs.readFileSync(htmlPath, 'utf-8');
        fs.writeFileSync(htmlPath, injectImages(html, images), 'utf-8');
      }
    } catch (e) {
      imageError = e.message;
    }
  }

  // 5. 记录历史
  pushDeckHistory({
    title: deckTitle,
    theme, lang, slideCount, imageCount, file: slug, dir,
    htmlPath, pptxPath, jsonPath,
    createdAt: new Date().toISOString(),
  });

  return {
    ok: true, title: deckTitle, theme, lang, slideCount, slides: manifestSlides,
    imageMode, imageCount, imageError,
    dir, file: slug, htmlPath, pptxPath, jsonPath,
  };
}

// ---------------------------------------------------------------------------
// Git 学习（主进程桥：启动 Git Bash / 查询与设置身份）
// ---------------------------------------------------------------------------

function runGit(args, timeoutMs) {
  const limit = timeoutMs || 8000;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(GIT_EXE, args, { cwd: require('os').homedir(), windowsHide: true });
    } catch (e) {
      return resolve({ ok: false, error: String(e) });
    }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill(); } catch (e) { /* ignore */ } }, limit);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => (out += d));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ ok: code === 0, code, output: (out || err).trim(), stdout: out.trim(), stderr: err.trim() });
    });
    child.on('error', (e) => { clearTimeout(t); resolve({ ok: false, error: String(e) }); });
  });
}

async function gitRunCmd(key) {
  const map = {
    version: ['--version'],
    name: ['config', '--global', 'user.name'],
    email: ['config', '--global', 'user.email'],
  };
  const args = map[key];
  if (!args) return { ok: false, error: '未知命令' };
  return runGit(args);
}

async function gitSetIdentity(field, value) {
  const v = String(value || '').trim();
  if (field !== 'name' && field !== 'email') return { ok: false, error: '未知字段' };
  if (!v) return { ok: false, error: '值不能为空' };
  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: '邮箱格式不对' };
  return runGit(['config', '--global', 'user.' + field, v]);
}

// ---------------------------------------------------------------------------
// 本地账号系统（data/users.json + data/session.json）
// ---------------------------------------------------------------------------
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');

function loadUsers() {
  try {
    const arr = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function saveUsers(users) { ensureDirs(); fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8'); }
function getSession() {
  try {
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    return s && s.userId ? { userId: s.userId } : { userId: '' };
  } catch (e) { return { userId: '' }; }
}
function saveSession(userId) { ensureDirs(); fs.writeFileSync(SESSION_FILE, JSON.stringify({ userId }, null, 2), 'utf-8'); }

function hashPass(pass, salt) { return crypto.createHash('sha256').update(salt + ':' + String(pass || '')).digest('hex'); }
function sanitizePublic(u) { return { id: u.id, name: u.name, avatar: u.avatar || '', createdAt: u.createdAt }; }

function userCreate(input) {
  const users = loadUsers();
  const n = String((input && input.name) || '').trim();
  if (!n) return { ok: false, error: '名字不能为空' };
  if (users.some((u) => u.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: '用户名已存在' };
  const pass = String((input && input.pass) || '');
  const salt = crypto.randomBytes(8).toString('hex');
  const u = {
    id: 'u-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex'),
    name: n,
    salt,
    passHash: pass ? hashPass(pass, salt) : '',
    avatar: (input && input.avatar) || '',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
  users.push(u);
  saveUsers(users);
  saveSession(u.id);
  return { ok: true, user: sanitizePublic(u) };
}

function userLogin(input) {
  const users = loadUsers();
  const u = users.find((x) => x.id === (input && input.id));
  if (!u) return { ok: false, error: '账号不存在' };
  if (u.passHash && hashPass(String((input && input.pass) || ''), u.salt) !== u.passHash) {
    return { ok: false, error: '密码错误' };
  }
  u.lastLogin = new Date().toISOString();
  saveUsers(users);
  saveSession(u.id);
  return { ok: true, user: sanitizePublic(u) };
}

function userUpdate(input) {
  const users = loadUsers();
  const u = users.find((x) => x.id === (input && input.id));
  if (!u) return { ok: false, error: '账号不存在' };
  if (input.name !== undefined) u.name = String(input.name).trim() || u.name;
  if (input.avatar !== undefined) u.avatar = input.avatar;
  saveUsers(users);
  return { ok: true, user: sanitizePublic(u) };
}

/** 注册 IPC 处理器 */
function registerIpc() {
  // 读取数据
  ipcMain.handle('data:read', (_e, file) => {
    const f = String(file).replace(/[^a-zA-Z0-9_\-.]/g, '');
    return readData(f);
  });

  // 写入数据
  ipcMain.handle('data:write', (_e, file, data) => {
    const f = String(file).replace(/[^a-zA-Z0-9_\-.]/g, '');
    return writeData(f, data);
  });

  // 查询余额（代理，避免浏览器 CORS）
  ipcMain.handle('balance:query', (_e, acc) => queryBalance(acc));

  // 用系统浏览器打开外部链接
  ipcMain.handle('shell:openExternal', async (_e, url) => {
    if (/^https?:/i.test(String(url))) await shell.openExternal(String(url));
    return true;
  });

  // 选择图片，返回 base64（限制大小 8MB）
  ipcMain.handle('dialog:openImage', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: '选择图片',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths.length) return null;
    const p = r.filePaths[0];
    const stat = fs.statSync(p);
    if (stat.size > 8 * 1024 * 1024) return { error: '图片过大（>8MB）' };
    const ext = path.extname(p).toLowerCase() || '.png';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const dest = path.join(UPLOAD_DIR, name);
    fs.copyFileSync(p, dest);
    return { fileName: name, filePath: dest, url: 'local://upload/' + name };
  });

  // 读取上传文件（本地图片预览）
  ipcMain.handle('upload:read', (_e, name) => {
    const safe = path.basename(String(name));
    const p = path.join(UPLOAD_DIR, safe);
    if (!fs.existsSync(p)) return null;
    return { data: fs.readFileSync(p).toString('base64'), mime: mimeOf(safe) };
  });

  // 应用信息（版本预览用）
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    name: app.getName(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    userData: app.getPath('userData'),
  }));

  // ===== AI 生成 PPT =====
  ipcMain.handle('ppt:generate', (_e, payload) => deckGenerate(payload));
  ipcMain.handle('ppt:themes', () => PPT_THEMES);
  ipcMain.handle('ppt:history', () => getDeckHistory());
  // 测试配图服务（跑一张小图，验证接口/Key/模型）
  ipcMain.handle('ppt:testImage', async (_e, cfg) => {
    const r = await genImage(cfg || {}, 'A minimal abstract test image, clean gradient, no text, no words');
    return { ok: !!r.ok, error: r.error || '', imageCount: r.ok ? 1 : 0 };
  });

  // 打开生成的 deck（用于播放/打印），print=true 时加载后自动弹打印
  ipcMain.handle('ppt:openDeck', (_e, htmlPath, opts) => {
    if (!htmlPath || typeof htmlPath !== 'string' || !fs.existsSync(htmlPath)) {
      return { ok: false, error: '演示文件不存在' };
    }
    const { print } = opts || {};
    const deckWin = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'PPT 演示 - 鲸屿工作台',
      backgroundColor: '#070B14',
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    deckWin.loadFile(htmlPath);
    if (print) {
      deckWin.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          try { deckWin.webContents.print({ silent: false, printBackground: true }); } catch (e) { /* ignore */ }
        }, 700);
      });
    }
    return { ok: true };
  });

  // 打开文件 / 定位文件夹（mode: 'open' 默认应用打开，'folder' 显示在文件夹）
  ipcMain.handle('ppt:openPath', async (_e, p, mode) => {
    if (!p || typeof p !== 'string' || !fs.existsSync(p)) return { ok: false, error: '路径不存在' };
    if (mode === 'folder') { shell.showItemInFolder(p); return { ok: true }; }
    await shell.openPath(p);
    return { ok: true };
  });

  // ===== Git 学习 =====
  ipcMain.handle('git:launch', () => {
    if (!GIT_BASH) return { ok: false, error: '未找到 Git Bash（git-bash.exe），请确认 D:\Git 已安装' };
    try {
      const child = spawn(GIT_BASH, [], { cwd: require('os').homedir(), detached: true, stdio: 'ignore' });
      child.unref();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('git:run', (_e, key) => gitRunCmd(key));
  ipcMain.handle('git:set', (_e, field, value) => gitSetIdentity(field, value));

  // ===== 本地账号系统 =====
  ipcMain.handle('session:get', () => {
    const s = getSession();
    if (!s.userId) return { ok: true, userId: '', user: null };
    const u = loadUsers().find((x) => x.id === s.userId);
    return { ok: true, userId: s.userId, user: u ? sanitizePublic(u) : null };
  });
  ipcMain.handle('users:list', () => ({ ok: true, users: loadUsers().map(sanitizePublic) }));
  ipcMain.handle('users:create', (_e, data) => userCreate(data));
  ipcMain.handle('users:login', (_e, data) => userLogin(data));
  ipcMain.handle('users:update', (_e, data) => userUpdate(data));
  ipcMain.handle('users:logoff', () => { saveSession(''); return { ok: true }; });
}

function mimeOf(name) {
  const ext = path.extname(name).toLowerCase();
  const map = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
  return map[ext] || 'application/octet-stream';
}

// 拦截 file:// 之外的本地协议，用于 upload 图片展示
app.on('web-contents-created', (_e, contents) => {
  contents.session.protocol.handle('local', async (request) => {
    const u = new URL(request.url);
    if (u.hostname === 'upload') {
      const safe = path.basename(decodeURIComponent(u.pathname || ''));
      const p = path.join(UPLOAD_DIR, safe);
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        return new Response(buf, { headers: { 'Content-Type': mimeOf(safe) } });
      }
    }
    return new Response('Not Found', { status: 404 });
  });
});

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ensureDirs();
    // 默认数据
    if (!fs.existsSync(path.join(DATA_DIR, 'config.json'))) {
      writeData('config.json', {
        apiAccounts: [],
        autoRefreshSec: 300,
        about: { selfIntro: '', whaleName: '鲸鱼娘', whaleHome: '' },
        ppt: {
          imageGen: { enabled: false, baseUrl: '', apiKey: '', model: '', size: '1024x1024' },
          defaults: { theme: 'data', lang: 'zh', maxSlides: 6 },
        },
      });
    }
    for (const [f, d] of Object.entries({
      'memos.json': [],
      'notes.json': [],
      'links.json': [],
      'schedule.json': [],
      'tools.json': [
        { id: 'bg-eraser', name: '透明底色擦除', icon: '🎨', desc: '一键把图片背景变成透明', builtin: true },
        { id: 'calculator', name: '小型计算机', icon: '🧮', desc: '便携计算器', builtin: true },
        { id: 'ppt-maker', name: 'AI 生成 PPT', icon: '🎬', desc: '一句话生成 PPT 式 HTML，可配图导出', builtin: true },
      ],
      'games.json': [
        { id: 'pearl-catch', name: '接珍珠', icon: '🫧', desc: '鲸鱼娘撒珍珠，快用小篮子接住！', builtin: true },
        { id: 'guess-number', name: '猜猜鲸鱼想的数', icon: '🔮', desc: '和鲸鱼娘玩 1~100 猜数', builtin: true },
        { id: 'memory-card', name: '海底记忆翻翻乐', icon: '🃏', desc: '翻卡片配对海底生物', builtin: true },
      ],
    })) {
      if (!fs.existsSync(path.join(DATA_DIR, f))) writeData(f, d);
    }

    registerIpc();

    // 无窗口自检：DSH_PPT_TEST=1 时跑一次核心生成管线（DeepSeek 扩写 + 引擎渲染）后退出
    if (process.env.DSH_PPT_TEST === '1') {
      deckGenerate({ prompt: '用一句话介绍 AI 生成 PPT 的好处', theme: 'data', lang: 'zh', maxSlides: 5, imageMode: 'off' })
        .then((r) => console.log('[PPT TEST]', JSON.stringify(r, null, 2)))
        .catch((e) => console.log('[PPT TEST] FAILED', e.message))
        .finally(() => setTimeout(() => app.exit(0), 400));
      return;
    }

    mainWindow = createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });

  // 移除默认菜单
  app.on('browser-window-created', (_e, win) => {
    win.setMenuBarVisibility(false);
  });
}
