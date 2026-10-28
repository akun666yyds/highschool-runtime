import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface Props {
  text: string | null
  tone?: 'normal' | 'warn'
}

export function Toast({ text, tone = 'normal' }: Props) {
  if (!text) return null
  return (
    <div className={`toast ${tone}`} role="status">
      {tone === 'warn' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      <span>{text}</span>
    </div>
  )
}
