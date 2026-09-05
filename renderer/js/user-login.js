/* ============================================================
 * 鲸屿工作台 - 本地账号系统（登录 / 切换账号 / 新建 / 头像）
 * 全黑登录框，首次登录成功后可在登录界面切换账号
 * ============================================================ */
WB.login = (() => {
  const U = WB.util;
  let current = null;       // 当前用户 {id,name,avatar}
  let onDone = null;
  let users = [];
  let selectedId = '';

  /* ---------- 对外 ---------- */
  async function show(onDoneCb) {
    onDone = onDoneCb;
    const root = document.getElementById('login-root');
    root.classList.add('show');
    await render();
  }
  function hide() { document.getElementById('login-root').classList.remove('show'); }
  function currentUser() { return current; }
  function setCurrent(u) {
    current = u;
    applyTop();
  }

  /* ---------- 顶栏头像联动 ---------- */
  function applyTop() {
    const av = document.getElementById('user-avatar');
    const nm = document.getElementById('brand-name');
    if (av) av.innerHTML = current && current.avatar
      ? `<img src="${U.esc(current.avatar)}" alt="头像" />`
      : '<span class="ua-letter">' + U.esc((current && current.name || '?').slice(0, 1)) + '</span>';
    if (nm) nm.textContent = (current && current.name) || 'Workbench';
  }

  /* ---------- 渲染登录界面 ---------- */
  async function render() {
    const root = document.getElementById('login-root');
    const res = await window.workbench.usersList();
    users = (res && res.users) || [];
    const firstRun = users.length === 0;

    root.innerHTML = `
      <div class="login-card">
        <div class="login-logo"><span class="login-emoji">🐋</span> 鲸屿工作台</div>
        <div class="login-sub">${firstRun ? '欢迎！先创建一个本地账号' : '选择一个账号进入，或新建一个'}</div>
        <div class="login-users" id="login-users">
          ${users.length ? users.map((u) => `
            <button class="login-user ${u.id === selectedId ? 'sel' : ''}" data-id="${u.id}">
              <span class="login-uavatar">${u.avatar ? `<img src="${U.esc(u.avatar)}" />` : `<span class="ua-letter">${U.esc((u.name || '?').slice(0, 1))}</span>`}</span>
              <span class="login-uname">${U.esc(u.name)}</span>
              ${u.id === (current && current.id) ? '<span class="login-cur">当前</span>' : ''}
            </button>`).join('')
            : '<div class="login-empty">暂无账号，先创建一个👇</div>'}
        </div>

        <div class="login-form" id="login-form">
          ${firstRun || !selectedId ? `
            <div class="login-fields">
              <input class="input" id="lf-name" placeholder="给自己起个名字（如：WaterBoat-LL）" maxlength="24" />
              <input class="input" id="lf-pass" type="password" placeholder="密码（可留空）" />
            </div>
            <div class="login-avatarrow">
              <span class="login-avatar-preview" id="lf-avatar"><span class="ua-letter">?</span></span>
              <button class="btn btn-ghost btn-mini" id="lf-upload">📷 上传头像</button>
            </div>
            <div class="login-foot">
              <button class="btn btn-ghost" id="lf-cancel" hidden>返回账号列表</button>
              <button class="btn btn-primary" id="lf-create">🚀 创建并进入</button>
            </div>
          ` : `
            <div class="login-who">进入 <b>${U.esc(userName(selectedId))}</b></div>
            <div class="login-fields">
              <input class="input" id="lf-pass" type="password" placeholder="密码（该账号若未设密码则留空）" />
            </div>
            <div class="login-foot">
              <button class="btn btn-ghost" id="lf-cancel">返回账号列表</button>
              <button class="btn btn-primary" id="lf-enter">进入工作台</button>
            </div>
          `}
        </div>
      </div>
    `;
    bind();
  }

  function userName(id) {
    const u = users.find((x) => x.id === id);
    return u ? u.name : '';
  }
  function userHasPass(id) {
    // 服务端判断：这里简单用登录结果提示；若账号有密码，进入时会校验
    return true;
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    const root = document.getElementById('login-root');
    // 账号选择
    root.querySelectorAll('.login-user').forEach((b) => {
      b.addEventListener('click', () => {
        selectedId = b.dataset.id;
        hideFormShowLogin();
      });
    });

    const createBtn = root.querySelector('#login-create-btn');
    if (createBtn) createBtn.addEventListener('click', () => { selectedId = ''; showCreateForm(); });

    // 密码输入回车
    const pass = root.querySelector('#lf-pass');
    if (pass) pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') doEnter(); });
    const nameInput = root.querySelector('#lf-name');
    if (nameInput) nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(); });

    const enter = root.querySelector('#lf-enter');
    if (enter) enter.addEventListener('click', doEnter);
    const cr = root.querySelector('#lf-create');
    if (cr) cr.addEventListener('click', doCreate);
    const cancel = root.querySelector('#lf-cancel');
    if (cancel) cancel.addEventListener('click', showAccountList);
    const up = root.querySelector('#lf-upload');
    if (up) up.addEventListener('click', uploadAvatar);
  }

  function hideFormShowLogin() {
    const root = document.getElementById('login-root');
    root.innerHTML = root.innerHTML; // placeholder
    render();
  }
  function showCreateForm() { render(); }
  function showAccountList() {
    selectedId = '';
    // 保留账号列表，返回到选择态
    document.getElementById('login-root').querySelector('.login-form').innerHTML = createFormHtml();
    bind();
  }

  function createFormHtml() {
    return `
      <div class="login-fields">
        <input class="input" id="lf-name" placeholder="给自己起个名字（如：WaterBoat-LL）" maxlength="24" />
        <input class="input" id="lf-pass" type="password" placeholder="密码（可留空）" />
      </div>
      <div class="login-avatarrow">
        <span class="login-avatar-preview" id="lf-avatar"><span class="ua-letter">?</span></span>
        <button class="btn btn-ghost btn-mini" id="lf-upload">📷 上传头像</button>
      </div>
      <div class="login-foot">
        <button class="btn btn-ghost" id="lf-cancel">返回账号列表</button>
        <button class="btn btn-primary" id="lf-create">🚀 创建并进入</button>
      </div>`;
  }

  /* ---------- 动作 ---------- */
  async function uploadAvatar() {
    const r = await window.workbench.openImageDialog();
    if (!r || !r.url) { U.toast('未选择图片', 'info'); return; }
    let preview = document.getElementById('lf-avatar');
    if (preview) preview.innerHTML = `<img src="${U.esc(r.url)}" />`;
    window._newAvatar = r.url;
  }

  async function doCreate() {
    const root = document.getElementById('login-root');
    const name = (root.querySelector('#lf-name') || {}).value ? root.querySelector('#lf-name').value.trim() : '';
    const pass = (root.querySelector('#lf-pass') || {}).value ? root.querySelector('#lf-pass').value : '';
    if (!name) return U.toast('先给自己起个名字~', 'warn');
    const avatar = window._newAvatar || '';
    const res = await window.workbench.userCreate({ name, pass, avatar });
    if (!res.ok) return U.toast(res.error, 'err');
    window._newAvatar = '';
    afterLogin(res.user);
  }

  async function doEnter() {
    const root = document.getElementById('login-root');
    const pass = (root.querySelector('#lf-pass') || {}).value ? root.querySelector('#lf-pass').value : '';
    const res = await window.workbench.userLogin({ id: selectedId, pass });
    if (!res.ok) return U.toast(res.error, 'err');
    U.toast(`欢迎回来，${res.user.name}！`, 'ok');
    afterLogin(res.user);
  }

  function afterLogin(u) {
    setCurrent(u);
    hide();
    if (onDone) onDone(u);
  }

  return { show, hide, setCurrent, currentUser };
})();
