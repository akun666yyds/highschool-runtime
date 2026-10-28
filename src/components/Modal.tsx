import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  tone?: 'normal' | 'warn'
  onConfirm: () => void
  onCancel: () => void
}

export function Modal({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  tone = 'normal',
  onConfirm,
  onCancel
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="关闭" onClick={onCancel}>
          <X size={16} />
        </button>
        <div className={`modal-icon ${tone}`}>
          <AlertTriangle size={20} strokeWidth={1.8} />
        </div>
        <h3 id="modal-title">{title}</h3>
        {description && <p>{description}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'warn' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
