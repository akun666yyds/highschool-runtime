import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const vitePort = 5179
const url = `http://localhost:${vitePort}`

const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  throw new Error('Vite dev server did not start in time.')
}

let electron
async function startElectron() {
  await waitForServer()
  electron = spawn(electronBinary, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: url }
  })
  electron.on('close', () => {
    vite.kill()
    process.exit(0)
  })
}

startElectron().catch((error) => {
  console.error(error)
  vite.kill()
  process.exit(1)
})

process.on('SIGINT', () => {
  electron?.kill()
  vite.kill()
  process.exit(0)
})
