const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximized: (callback) => {
    const handler = (_event, value) => callback(value)
    ipcRenderer.on('window:maximized', handler)
    return () => ipcRenderer.removeListener('window:maximized', handler)
  },
  aiStatus: () => ipcRenderer.invoke('ai:status'),
  aiRun: (job) => ipcRenderer.invoke('ai:run', job),
  aiCancel: () => ipcRenderer.invoke('ai:cancel'),
  onAiProgress: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('ai:progress', handler)
    return () => ipcRenderer.removeListener('ai:progress', handler)
  }
})
