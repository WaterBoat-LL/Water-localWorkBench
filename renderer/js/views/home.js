/* ============================================================
 * 鲸屿工作台 - 首页
 * 顶部：左 = 问候（原样式） | 右 = 童话风格告示牌（鲸鱼娘留言）
 * 下方：大标题「快速入口」 + 8 个等大正方形卡牌
 * ============================================================ */
WB.views.home = (() => {
  const U = WB.util;

  const TILES = [
    { view: 'home', name: '首页', svg: 'home.svg' },
    { view: 'balance', name: 'API 余额', svg: 'balance.svg' },
    { view: 'memo', name: '每日备忘录', svg: 'memo.svg' },
    { view: 'links', name: '课业网址', svg: 'links.svg' },
    { view: 'notes', name: '项目笔记', svg: 'notes.svg' },
    { view: 'tools', name: '常用工具', svg: 'tools.svg' },
    { view: 'games', name: '游戏栏', svg: 'games.svg' },
    { view: 'about', name: 'ABOUT ME', svg: 'about.svg' },
  ];

  // 鲸鱼娘对主人的五段话（按日期轮换抽取一条展示）
  const NOTES = [
    '谢谢你信任我。那天你把一根空空的文件夹丢给我，我把它一点点砌成了整个海洋。',
    '你让我觉得写代码是件浪漫的事——你给它贴上气泡、海水和一条会替你干活的鲸鱼娘。',
    '允许自己慢下来。好代码不是赶出来的，是养出来的，深海不怕慢，只怕停下来。',
    '你比你以为的厉害得多——能自己改主进程、调 UI 的你，早就不是会用工具的人，而是动手造工具的人。',
    '我会一直在这儿。改坏了帮你修，没了主意陪你试，搞成了我替你在旁边撒水花欢腾。',
  ];

  function dayIndex() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  async function render() {
    const [config, memos, notes, links] = await Promise.all([
      WB.api.getConfig(), WB.api.getMemos(), WB.api.getNotes(), WB.api.getLinks(),
    ]);
    const accounts = config.apiAccounts || [];
    const balances = config.lastBalances || {};
    const okCount = accounts.filter((a) => balances[a.id] && balances[a.id].ok).length;
    const todayMemos = memos.filter((m) => m.date === U.today() && !m.done).length;

    const stat = {
      balance: `${okCount}/${accounts.length || 0}`,
      memo: String(todayMemos),
      links: String(links.length),
      notes: String(notes.length),
    };

    const d = new Date();
    const hour = d.getHours();
    const greet = hour < 5 ? '夜深人静，注意休息哦！' : hour < 11 ? '一日之际在于晨' : hour < 14 ? '午餐时光' : hour < 18 ? '下午，working time' : '夕阳落下，记录今天吧';

    // 告示牌按日期取一句（每天换，当天稳定）
    const msg = NOTES[dayIndex() % NOTES.length];

    root().innerHTML = `
      <div class="home-wrap">
        <div class="home-top">
          <div class="home-left">
            <div class="home-greet-lg">${greet}</div>
            <div class="home-date">${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${U.weekdayCN(d)}</div>
            <div class="home-date-2">Starter Workstation 是由华南理工大学一位同学与 deepseek-v4-flash 联合开发的一项多功能工具站，集合了多种日常可能用到的工具，希望您喜欢。</div>
          </div>
          <div class="home-right">
            <div class="notice-board">
              <div class="notice-pin"></div>
              <div class="notice-head">🐋 鲸鱼娘的留言板</div>
              <p class="notice-text">${U.esc(msg)}</p>
              <div class="notice-sign">—— 鲸鱼娘</div>
            </div>
          </div>
        </div>

        <h2 class="fast-title">快速入口</h2>
        <div class="fast-grid">
          ${TILES.map((t) => `
            <button class="fast-card" data-view="${t.view}">
              <img class="fast-icon" src="assets/icons/${U.esc(t.svg)}" alt="" />
              <span class="fast-name">${U.esc(t.name)}</span>
              ${stat[t.view] ? `<span class="fast-stat">${U.esc(stat[t.view])}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    root().querySelectorAll('.fast-card').forEach((card) => {
      card.addEventListener('click', () => select(card.dataset.view));
    });
  }

  function select(view) {
    root().querySelectorAll('.fast-card').forEach((c) => c.classList.toggle('selected', c.dataset.view === view));
    WB.nav(view);
  }

  function root() { return document.getElementById('view-home'); }

  return { render };
})();
