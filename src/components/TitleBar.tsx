import { useEffect, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'

declare global {
  interface Window {
    desktop?: {
      platform: string
      minimize: () => void
      toggleMaximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      onMaximized: (callback: (value: boolean) => void) => () => void
    }
  }
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const desktop = window.desktop

  useEffect(() => {
    if (!desktop) return
    desktop.isMaximized().then(setMaximized).catch(() => undefined)
    return desktop.onMaximized(setMaximized)
  }, [desktop])

  return (
    <header className="titlebar">
      <div className="titlebar-drag">
        <span className="titlebar-mark">高</span>
        <span className="titlebar-name">高考年华</span>
        <span className="titlebar-divider" />
        <span className="titlebar-sub">HIGHSCHOOL RUNTIME</span>
      </div>
      <div className="window-controls">
        <button type="button" aria-label="最小化" onClick={() => desktop?.minimize()}>
          <Minus size={14} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          aria-label={maximized ? '还原' : '最大化'}
          onClick={() => desktop?.toggleMaximize()}
        >
          <Square size={11} strokeWidth={1.7} />
        </button>
        <button type="button" className="close-button" aria-label="关闭" onClick={() => desktop?.close()}>
          <X size={15} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  )
}
