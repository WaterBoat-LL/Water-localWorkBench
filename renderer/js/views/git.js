/* ============================================================
 * 鲸屿工作台 - Git 学习模块
 * 一键启动 Git Bash + 首次身份配置 + 常用命令速查（可复制）
 * ============================================================ */
WB.views = WB.views || {};

WB.views.git = (() => {
  const U = WB.util;

  const CATS = [
    {
      title: '🚀 起步',
      items: [
        { cmd: 'git init', desc: '把当前文件夹变成一个仓库（只做一次）' },
        { cmd: 'git clone <仓库地址>', desc: '把远程仓库克隆到本地' },
        { cmd: 'git status', desc: '查看当前状态（改了哪些、提交了没）' },
      ],
    },
    {
      title: '🔁 日常循环（核心）',
      items: [
        { cmd: 'git add .', desc: '把所有改动放进暂存区（. = 全部）' },
        { cmd: 'git add <文件名>', desc: '只暂存某个文件' },
        { cmd: 'git commit -m "说明文字"', desc: '提交一个快照（养成写好说明的习惯）' },
        { cmd: 'git log --oneline', desc: '看提交历史，一行一条' },
      ],
    },
    {
      title: '↩️ 撤销',
      items: [
        { cmd: 'git restore <文件>', desc: '撤销还没 add 的修改' },
        { cmd: 'git restore --staged <文件>', desc: '把已暂存的文件移出暂存区' },
        { cmd: 'git commit --amend', desc: '修改最近一次提交的说明' },
        { cmd: 'git reset --hard', desc: '回到上一次提交（⚠ 会丢未提交的修改）' },
      ],
    },
    {
      title: '🌿 分支',
      items: [
        { cmd: 'git branch', desc: '查看所有分支（* 是当前分支）' },
        { cmd: 'git branch <新名字>', desc: '新建分支' },
        { cmd: 'git checkout -b <新名字>', desc: '新建并立刻切换过去' },
        { cmd: 'git merge <分支名>', desc: '把某个分支合并到当前分支' },
      ],
    },
    {
      title: '☁️ 远程仓库（GitHub/Gitee）',
      items: [
        { cmd: 'git remote add origin <地址>', desc: '把本地仓库和远程关联起来' },
        { cmd: 'git push -u origin main', desc: '第一次把代码推到远程' },
        { cmd: 'git push', desc: '以后日常推送' },
        { cmd: 'git pull', desc: '拉取远程最新更新' },
      ],
    },
  ];

  async function render() {
    root().innerHTML = `
      <div class="page-head">
        <h2 class="page-title"><span class="title-ico">🐙</span>Git 学习</h2>
        <p class="page-sub">你的 Git 在 D:\\Git（2.53）· 随时启动终端练手 · 命令点击即复制</p>
        <div class="head-actions">
          <button class="btn btn-ghost" id="git-refresh">🔄 刷新状态</button>
          <button class="btn btn-primary" id="git-launch">🚀 打开 Git Bash</button>
        </div>
      </div>

      <div class="git-hero glass" id="git-hero">
        <div class="git-hero-main">
          <div class="git-hero-title">Git 首次使用，先做 2 件事</div>
          <div class="git-hero-sub">提交代码时需要用「身份签名」，在下面填一次就永久生效：</div>
          <div class="git-ident-form">
            <label class="git-ident-field"><span>你的名字</span>
              <input class="input" id="git-name" placeholder="如：WaterBoat-LL" />
            </label>
            <label class="git-ident-field"><span>你的邮箱</span>
              <input class="input" id="git-email" placeholder="如：you@example.com" />
            </label>
            <button class="btn btn-primary-soft" id="git-save-ident">💾 保存到 Git</button>
          </div>
        </div>
        <div class="git-status" id="git-status"></div>
      </div>

      <div class="git-steps glass">
        <div class="git-steps-title">🧪 5 分钟练手：走一遍第一次提交</div>
        <div class="git-steps-row">
          <div class="git-step"><b>1</b><code>mkdir demo && cd demo</code><span>建文件夹进去</span></div>
          <div class="git-step"><b>2</b><code>git init</code><span>变成仓库</span></div>
          <div class="git-step"><b>3</b><code>git add .</code><span>暂存</span></div>
          <div class="git-step"><b>4</b><code>git commit -m "第一次提交"</code><span>提交</span></div>
        </div>
        <p class="git-steps-hint">点上方「🚀 打开 Git Bash」，在终端里照着敲一遍。</p>
      </div>

      <div class="git-cats" id="git-cats"></div>
    `;

    root().querySelector('#git-launch').addEventListener('click', launchBash);
    root().querySelector('#git-refresh').addEventListener('click', refreshAll);
    root().querySelector('#git-save-ident').addEventListener('click', saveIdentity);
    renderCats();
    refreshAll();
  }

  function root() { return document.getElementById('view-git'); }

  /* ================= 速查卡片 ================= */
  function renderCats() {
    const wrap = root().querySelector('#git-cats');
    wrap.innerHTML = CATS.map((cat) => `
      <div class="git-cat glass">
        <div class="git-cat-title">${cat.title}</div>
        ${cat.items.map((it) => `
          <div class="git-cmd-row">
            <code class="git-cmd" data-cmd="${U.esc(it.cmd)}">${U.esc(it.cmd)}</code>
            <span class="git-cmd-desc">${U.esc(it.desc)}</span>
            <button class="btn btn-mini btn-ghost git-copy" data-cmd="${U.esc(it.cmd)}">复制</button>
          </div>`).join('')}
      </div>`).join('');
    wrap.querySelectorAll('.git-copy').forEach((b) => {
      b.addEventListener('click', () => copyText(b.dataset.cmd));
    });
  }

  function copyText(text) {
    const done = () => U.toast('已复制：' + text, 'ok');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { U.toast('复制失败，请手动选中复制', 'err'); }
    ta.remove();
  }

  /* ================= 启动 Git Bash ================= */
  async function launchBash() {
    const r = await window.workbench.gitLaunch();
    if (r && r.ok) U.toast('Git Bash 已启动 🐙', 'ok');
    else U.toast((r && r.error) || '启动失败', 'err');
  }

  /* ================= 身份配置 ================= */
  async function refreshAll() {
    const status = root().querySelector('#git-status');
    const nameInput = root().querySelector('#git-name');
    const emailInput = root().querySelector('#git-email');
    if (!status) return;
    status.innerHTML = '⏳ 正在检查 git …';
    const [ver, name, email] = await Promise.all([
      window.workbench.gitRun('version'),
      window.workbench.gitRun('name'),
      window.workbench.gitRun('email'),
    ]);
    const vTxt = ver && ver.ok ? ver.output : '未检测到 git';
    const nameTxt = (name && name.ok && name.output) ? name.output : '';
    const emailTxt = (email && email.ok && email.output) ? email.output : '';
    if (nameInput && !nameInput.value) nameInput.value = nameTxt;
    if (emailInput && !emailInput.value) emailInput.value = emailTxt;

    const identOk = !!(nameTxt && emailTxt);
    status.innerHTML = `
      <div class="git-chip ${identOk ? 'ok' : 'warn'}">
        ${identOk ? '✅ 身份已配置' : '⚠ 身份还没配好'}
        <span class="git-chip-sub">${vTxt}</span>
      </div>
      ${identOk ? `<div class="git-ident-now">签名：<b>${U.esc(nameTxt)}</b> &lt;${U.esc(emailTxt)}&gt;</div>` : ''}
    `;
  }

  async function saveIdentity() {
    const q = (id) => root().querySelector(id);
    const name = q('#git-name').value.trim();
    const email = q('#git-email').value.trim();
    if (!name) return U.toast('填一下名字~', 'warn');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return U.toast('邮箱格式不对（要带 @ 和 .）', 'warn');
    const btn = q('#git-save-ident');
    btn.disabled = true;
    const r1 = await window.workbench.gitSet('name', name);
    const r2 = r1.ok ? await window.workbench.gitSet('email', email) : r1;
    btn.disabled = false;
    if (r1.ok && r2.ok) {
      U.toast(`已保存身份：${name} <${email}>，现在可以提交了！`, 'ok');
      refreshAll();
    } else {
      U.toast('保存失败：' + ((r1 && r1.error) || (r2 && r2.error) || '未知错误'), 'err');
    }
  }

  return { render };
})();
