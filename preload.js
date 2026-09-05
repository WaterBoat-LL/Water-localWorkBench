/**
 * 鲸屿工作台 - 预加载脚本
 * 通过 contextBridge 向渲染进程暴露安全 API
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workbench', {
  /** 读取数据文件 (data/xxx.json) */
  readData: (file) => ipcRenderer.invoke('data:read', file),
  /** 写入数据文件 */
  writeData: (file, data) => ipcRenderer.invoke('data:write', file, data),
  /** 查询 API 余额（主进程代理，无 CORS） */
  queryBalance: (account) => ipcRenderer.invoke('balance:query', account),
  /** 系统浏览器打开外链 */
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  /** 选择图片并复制到本地 uploads，返回 {fileName,url} */
  openImageDialog: () => ipcRenderer.invoke('dialog:openImage'),
  /** 读取上传的本地图片 base64 */
  readUpload: (name) => ipcRenderer.invoke('upload:read', name),
  /** 应用信息 */
  appInfo: () => ipcRenderer.invoke('app:info'),
  /** ===== AI 生成 PPT ===== */
  /** 生成 PPT（主题提示词，主进程调 DeepSeek 扩写 + dsh-ppt 渲染 + 可选配图） */
  pptGenerate: (payload) => ipcRenderer.invoke('ppt:generate', payload),
  /** 可用主题列表 */
  pptThemes: () => ipcRenderer.invoke('ppt:themes'),
  /** 测试 PPT 配图服务（配置是否可用） */
  pptTestImage: (cfg) => ipcRenderer.invoke('ppt:testImage', cfg),
  /** 生成历史 */
  pptHistory: () => ipcRenderer.invoke('ppt:history'),
  /** 打开生成的演示（opts.print 触发打印） */
  pptOpenDeck: (htmlPath, opts) => ipcRenderer.invoke('ppt:openDeck', htmlPath, opts),
  /** 打开文件 / 定位文件夹 */
  pptOpenPath: (p, mode) => ipcRenderer.invoke('ppt:openPath', p, mode),
  /** ===== Git 学习 ===== */
  /** 打开 Git Bash 终端 */
  gitLaunch: () => ipcRenderer.invoke('git:launch'),
  /** 查询 git 信息（version / name / email） */
  gitRun: (key) => ipcRenderer.invoke('git:run', key),
  /** 设置全局身份（field: name / email） */
  gitSet: (field, value) => ipcRenderer.invoke('git:set', field, value),
  /** ===== 本地账号系统 ===== */
  sessionGet: () => ipcRenderer.invoke('session:get'),
  usersList: () => ipcRenderer.invoke('users:list'),
  userCreate: (data) => ipcRenderer.invoke('users:create', data),
  userLogin: (data) => ipcRenderer.invoke('users:login', data),
  userUpdate: (data) => ipcRenderer.invoke('users:update', data),
  userLogoff: () => ipcRenderer.invoke('users:logoff'),
});
