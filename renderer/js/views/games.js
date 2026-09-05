/* ============================================================
 * 鲸屿工作台 - 游戏栏（与鲸鱼娘的小游戏）
 * 内置：接珍珠 / 猜鲸鱼想的数 / 海底记忆翻翻乐 / 石头剪刀布
 * ============================================================ */
WB.views.games = (() => {
  const U = WB.util;
  let games = [];

  async function render() {
    games = (await WB.api.getGames()) || [];
    root().innerHTML = `
      <div class="page-head">
        <h2 class="page-title"><span class="title-ico">🎮</span>游戏栏</h2>
        <p class="page-sub">这些是鲸鱼娘和主人一起做的小游戏~ 累了就玩一局吧！</p>
      </div>
      <div class="game-grid" id="game-grid"></div>
    `;
    renderGrid();
  }

  function root() { return document.getElementById('view-games'); }

  function renderGrid() {
    const grid = document.getElementById('game-grid');
    const gitCard = `
      <div class="game-card glass" data-act-entry="git">
        <div class="game-art">🐙</div>
        <div class="game-name">Git 学习</div>
        <div class="game-desc">学学版本管理 · 启动 Git Bash / 常用命令速查</div>
        <button class="btn btn-primary-soft btn-mini" data-act="git">开始学习</button>
      </div>`;
    grid.innerHTML = gitCard + games.map((g) => {
      const best = g.best != null ? `<span class="game-best">🏆 最高分 ${g.best}</span>` : '';
      return `
      <div class="game-card glass" data-id="${g.id}">
        <div class="game-art">${U.esc(g.icon || '🎮')}</div>
        <div class="game-name">${U.esc(g.name)}</div>
        <div class="game-desc">${U.esc(g.desc || '')}</div>
        ${best}
        <button class="btn btn-primary btn-mini" data-act="play">开始游戏</button>
      </div>`;
    }).join('');
    grid.querySelectorAll('[data-act="play"]').forEach((btn) => {
      const g = games.find((x) => x.id === btn.closest('.game-card').dataset.id);
      if (g) btn.addEventListener('click', () => play(g));
    });
    grid.querySelectorAll('[data-act="git"]').forEach((btn) => {
      btn.addEventListener('click', () => { if (WB.nav) WB.nav('git'); });
    });
  }

  async function saveBest(id, score) {
    const g = games.find((x) => x.id === id);
    if (g && (g.best == null || score > g.best)) {
      g.best = score;
      await WB.api.saveGames(games);
      renderGrid();
    }
  }

  function play(g) {
    const runners = { 'pearl-catch': playPearlCatch, 'guess-number': playGuessNumber, 'memory-card': playMemory, 'rps': playRps };
    const fn = runners[g.id];
    if (!fn) return U.toast('这个游戏还没写出来呢~', 'warn');
    fn(g);
  }

  /* ============ 接珍珠 ============ */
  function playPearlCatch(g) {
    let score = 0, life = 3, lv = 1, over = false, raf = null;

    function cleanup() {
      over = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', keyHandler);
    }
    function keyHandler(e) {
      if (e.key === 'ArrowLeft') moveBasket(basket.x - 22);
      if (e.key === 'ArrowRight') moveBasket(basket.x + 22);
    }

    const m = U.modal({ title: '🫧 接珍珠', width: '640px', onClose: cleanup });
    m.body.innerHTML = `
      <div class="game-stage">
        <div class="game-hud">
          <span>得分 <b id="pc-score">0</b></span>
          <span>生命 <b id="pc-life">❤️❤️❤️</b></span>
          <span>速度 <b id="pc-lv">1</b></span>
        </div>
        <canvas id="pc-canvas" width="600" height="400"></canvas>
        <p class="game-tip">← → 或移动鼠标控制篮子接住珍珠，别让它掉到海底！</p>
      </div>
    `;
    const canvas = m.body.querySelector('#pc-canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = m.body.querySelector('#pc-score');
    const lifeEl = m.body.querySelector('#pc-life');
    const lvEl = m.body.querySelector('#pc-lv');

    const W = canvas.width, H = canvas.height;
    let basket = { x: W / 2, w: 70, h: 26 };
    let pearls = [];
    let spawnT = 0;

    function moveBasket(x) {
      basket.x = Math.max(basket.w / 2 + 10, Math.min(W - basket.w / 2 - 10, x));
    }

    function spawn() {
      pearls.push({
        x: 30 + Math.random() * (W - 60),
        y: -14,
        r: 7 + Math.random() * 5,
        vy: 1.4 + Math.random() * 1.2 + lv * 0.35,
        hue: Math.random() * 40 + 180,
      });
    }

    function frame(t) {
      if (over) return;
      spawnT++;
      if (spawnT % Math.max(14, 30 - lv * 2) === 0) spawn();

      ctx.clearRect(0, 0, W, H);
      // 海底
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(4, 28, 50, 0.9)');
      g.addColorStop(1, 'rgba(2, 14, 28, 0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // 珍珠
      for (let i = pearls.length - 1; i >= 0; i--) {
        const p = pearls[i];
        p.y += p.vy;
        p.x += Math.sin(t * 0.004 + i) * 0.5;
        // 碰撞篮子
        if (p.y + p.r > H - 40 - basket.h && p.y - p.r < H - 30 && Math.abs(p.x - basket.x) < basket.w / 2 + p.r) {
          pearls.splice(i, 1);
          score++;
          scoreEl.textContent = score;
          if (score % 8 === 0 && lv < 8) { lv++; lvEl.textContent = lv; U.toast(`速度提升！Lv.${lv}`, 'info'); }
          continue;
        }
        if (p.y - p.r > H - 30) {
          pearls.splice(i, 1);
          life--;
          lifeEl.textContent = '❤️'.repeat(Math.max(life, 0)) + '🖤'.repeat(Math.max(3 - life, 0));
          if (life <= 0) { over = true; end(); return; }
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        const rg = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, p.r);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.5, `hsl(${p.hue}, 80%, 75%)`);
        rg.addColorStop(1, `hsl(${p.hue}, 80%, 55%)`);
        ctx.fillStyle = rg;
        ctx.fill();
      }

      // 篮子（小鲸鱼）
      const bx = basket.x;
      ctx.save();
      ctx.translate(bx, H - 30);
      ctx.fillStyle = '#57b8ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, basket.w / 2, basket.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a93d8';
      ctx.beginPath();
      ctx.moveTo(-basket.w / 2, 2);
      ctx.lineTo(-basket.w / 2 - 12, -6);
      ctx.lineTo(-basket.w / 2 - 12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(basket.w / 2 - 12, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(frame);
    }

    function onMove(x) {
      moveBasket(x);
    }
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      onMove((e.clientX - rect.left) * (W / rect.width));
    });

    function end() {
      cancelAnimationFrame(raf);
      ctx.fillStyle = 'rgba(2,12,24,0.75)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('游戏结束！得分 ' + score, W / 2, H / 2 - 10);
      ctx.font = '16px sans-serif';
      ctx.fillText(score > 20 ? '太棒了，鲸鱼娘给你点赞！🐋' : '再接再厉，鲸鱼娘陪你！', W / 2, H / 2 + 26);
      saveBest(g.id, score);
    }

    window.addEventListener('keydown', keyHandler);
    raf = requestAnimationFrame(frame);
  }

  /* ============ 猜鲸鱼想的数 ============ */
  function playGuessNumber() {
    const target = 1 + Math.floor(Math.random() * 100);
    let tries = 0;
    const m = U.modal({ title: '🔮 猜猜鲸鱼想的数', width: '460px' });
    m.body.innerHTML = `
      <div class="game-stage guess-stage">
        <div class="guess-bubble" id="g-bubble">🐋 我心里想了一个 1~100 的数，来猜猜看？</div>
        <div class="guess-input-row">
          <input class="input" id="g-input" type="number" min="1" max="100" placeholder="输入你的猜测" />
          <button class="btn btn-primary" id="g-go">猜！</button>
        </div>
        <div class="guess-tries">已猜 <b id="g-tries">0</b> 次</div>
        <div class="guess-history" id="g-history"></div>
      </div>
    `;
    const bubble = m.body.querySelector('#g-bubble');
    const input = m.body.querySelector('#g-input');
    const triesEl = m.body.querySelector('#g-tries');
    const historyEl = m.body.querySelector('#g-history');
    const go = m.body.querySelector('#g-go');
    let over = false;

    function say(txt, cls) {
      bubble.textContent = txt;
      bubble.className = 'guess-bubble ' + (cls || '');
    }

    function guess() {
      if (over) return;
      const v = parseInt(input.value, 10);
      if (!v || v < 1 || v > 100) { say('🐋 要认真猜 1~100 之间的数哦！'); return; }
      tries++;
      triesEl.textContent = tries;
      const item = document.createElement('div');
      item.className = 'guess-item';
      if (v === target) {
        item.textContent = `${v} ✅`;
        item.classList.add('right');
        historyEl.prepend(item);
        say(`🎉 没错！就是 ${target}！你用了 ${tries} 次就猜中了，鲸鱼娘服气啦！`);
        over = true;
        go.textContent = '再来一局';
        go.onclick = () => { m.close(); playGuessNumber(); };
        return;
      }
      item.textContent = v > target ? `${v} ↑ 大了` : `${v} ↓ 小了`;
      historyEl.prepend(item);
      const hot = v > target + 15 ? '🐳 哼，太大啦！' : v < target - 15 ? '🐳 太小了啦！' :
        v > target ? '🐋 嗯...还是大了一点点~' : '🐋 嗯...再大一点试试？';
      say(hot);
      input.value = '';
      input.focus();
      if (tries >= 10) {
        say(`🐋 已经猜了 10 次啦，偷偷告诉你：答案是 ${target}！`);
        over = true;
      }
    }

    go.addEventListener('click', guess);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') guess(); });
    setTimeout(() => input.focus(), 100);
  }

  /* ============ 海底记忆翻翻乐 ============ */
  function playMemory() {
    const EMOJIS = ['🐙', '🦀', '🐬', '🐠', '🐡', '🪼', '🐚', '⭐'];
    let cards = [];
    let first = null, lock = false, moves = 0, matched = 0;
    const m = U.modal({ title: '🃏 海底记忆翻翻乐', width: '520px' });
    m.body.innerHTML = `
      <div class="game-stage">
        <div class="game-hud">
          <span>翻开 <b id="mm-moves">0</b> 次</span>
          <span>配对 <b id="mm-matched">0</b>/8</span>
          <button class="btn btn-mini btn-ghost" id="mm-restart">重开</button>
        </div>
        <div class="memory-grid" id="mm-grid"></div>
      </div>
    `;
    const grid = m.body.querySelector('#mm-grid');
    const movesEl = m.body.querySelector('#mm-moves');
    const matchedEl = m.body.querySelector('#mm-matched');

    function build() {
      cards = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5);
      first = null; lock = false; moves = 0; matched = 0;
      movesEl.textContent = 0;
      matchedEl.textContent = '0/8';
      grid.innerHTML = cards.map((e, i) => `<button class="m-card" data-i="${i}" data-e="${e}"><span class="m-face">?</span></button>`).join('');
      grid.querySelectorAll('.m-card').forEach((c) => c.addEventListener('click', () => flip(c)));
    }

    function flip(c) {
      if (lock || c.classList.contains('open') || c.classList.contains('match')) return;
      c.classList.add('open');
      c.querySelector('.m-face').textContent = c.dataset.e;
      if (!first) { first = c; return; }
      moves++;
      movesEl.textContent = moves;
      if (first.dataset.e === c.dataset.e) {
        first.classList.add('match');
        c.classList.add('match');
        matched++;
        matchedEl.textContent = matched + '/8';
        first = null;
        if (matched === 8) {
          U.toast(`全配对了！共翻开 ${moves} 次 🎉`, 'ok');
          setTimeout(() => { m.close(); playMemory(); }, 900);
        }
      } else {
        lock = true;
        const a = first, b = c;
        setTimeout(() => {
          a.classList.remove('open');
          b.classList.remove('open');
          a.querySelector('.m-face').textContent = '?';
          b.querySelector('.m-face').textContent = '?';
          lock = false;
        }, 650);
        first = null;
      }
    }

    m.body.querySelector('#mm-restart').addEventListener('click', build);
    build();
  }

  /* ============ 石头剪刀布 vs 鲸鱼娘 ============ */
  function playRps() {
    const OPTS = { '🪨': '石头', '✂️': '剪刀', '📄': '布' };
    let scoreP = 0, scoreW = 0;
    const m = U.modal({ title: '✂️ 石头剪刀布 vs 鲸鱼娘', width: '480px' });
    m.body.innerHTML = `
      <div class="game-stage rps-stage">
        <div class="rps-score">
          <span>主人 <b id="rps-p">0</b></span>
          <span>鲸鱼娘 <b id="rps-w">0</b></span>
        </div>
        <div class="rps-arena">
          <div class="rps-side">
            <div class="rps-emoji" id="rps-you">🫥</div>
            <span>主人</span>
          </div>
          <div class="rps-vs">VS</div>
          <div class="rps-side">
            <div class="rps-emoji" id="rps-whale">🐋</div>
            <span>鲸鱼娘</span>
          </div>
        </div>
        <div class="rps-bubble" id="rps-msg">选一个出手吧！鲸鱼娘要认真了！</div>
        <div class="rps-btns">
          ${Object.keys(OPTS).map((k) => `<button class="rps-btn" data-k="${k}">${k}</button>`).join('')}
        </div>
      </div>
    `;
    const youEl = m.body.querySelector('#rps-you');
    const whaleEl = m.body.querySelector('#rps-whale');
    const msgEl = m.body.querySelector('#rps-msg');
    const pEl = m.body.querySelector('#rps-p');
    const wEl = m.body.querySelector('#rps-w');

    function judge(a, b) {
      if (a === b) return 0;
      if ((a === '🪨' && b === '✂️') || (a === '✂️' && b === '📄') || (a === '📄' && b === '🪨')) return 1;
      return -1;
    }

    function play(k) {
      const whale = Object.keys(OPTS)[Math.floor(Math.random() * 3)];
      youEl.textContent = k;
      whaleEl.textContent = whale;
      const r = judge(k, whale);
      if (r === 1) {
        scoreP++; pEl.textContent = scoreP;
        msgEl.textContent = `呜...鲸鱼娘输了！你的${OPTS[k]}赢了我的${OPTS[whale]}！再来！`;
      } else if (r === -1) {
        scoreW++; wEl.textContent = scoreW;
        msgEl.textContent = `嘿嘿，鲸鱼娘的${OPTS[whale]}赢了你的${OPTS[k]}！认输吧主人~`;
      } else {
        msgEl.textContent = `平手！我们都出了${OPTS[k]}，心有灵犀呢~`;
      }
    }

    m.body.querySelectorAll('.rps-btn').forEach((b) => b.addEventListener('click', () => play(b.dataset.k)));
  }

  return { render };
})();
