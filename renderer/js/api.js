/* ============================================================
 * 鲸屿工作台 - 数据层（本地 JSON 持久化）
 * ============================================================ */
WB.api = (() => {
  const CACHE = {};

  async function load(file) {
    if (CACHE[file] !== undefined) return CACHE[file];
    const d = await window.workbench.readData(file);
    CACHE[file] = d || {};
    return CACHE[file];
  }

  async function save(file, data) {
    CACHE[file] = data;
    await window.workbench.writeData(file, data);
    return data;
  }

  /** 配置 */
  const getConfig = () => load('config.json');
  const saveConfig = (c) => save('config.json', c);

  /** 备忘录 */
  const getMemos = () => load('memos.json');
  const saveMemos = (m) => save('memos.json', m);

  /** 网址 */
  const getLinks = () => load('links.json');
  const saveLinks = (l) => save('links.json', l);

  /** 项目笔记 */
  const getNotes = () => load('notes.json');
  const saveNotes = (n) => save('notes.json', n);

  /** 课表 */
  const getSchedule = () => load('schedule.json');
  const saveSchedule = (s) => save('schedule.json', s);

  /** 工具 */
  const getTools = () => load('tools.json');
  const saveTools = (t) => save('tools.json', t);

  /** 游戏 */
  const getGames = () => load('games.json');
  const saveGames = (g) => save('games.json', g);

  /** 余额查询（主进程代理） */
  const queryBalance = (acc) => window.workbench.queryBalance(acc);

  /** 应用信息 */
  const appInfo = () => window.workbench.appInfo();

  return {
    getConfig, saveConfig,
    getMemos, saveMemos,
    getLinks, saveLinks,
    getNotes, saveNotes,
    getSchedule, saveSchedule,
    getTools, saveTools,
    getGames, saveGames,
    queryBalance, appInfo,
  };
})();
