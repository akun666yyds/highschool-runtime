const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')
const ai = require('./ai.cjs')

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#101113',
    title: '高考年华 · Highschool Runtime',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized', false)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev
      ? url.startsWith(process.env.VITE_DEV_SERVER_URL)
      : url.startsWith('file://')
    if (!allowed) event.preventDefault()
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.akun.highschool-runtime')

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:toggle-maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => Boolean(mainWindow?.isMaximized()))

  ipcMain.handle('ai:status', () => ai.status())
  ipcMain.handle('ai:cancel', () => ai.cancel())
  ipcMain.handle('ai:run', async (event, job) => {
    const emit = (payload) => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:progress', payload)
    }
    return ai.runExam(job, emit)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
