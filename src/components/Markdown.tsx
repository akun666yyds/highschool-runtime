import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface Props {
  children: string
  className?: string
}

export function Markdown({ children, className }: Props) {
  return (
    <div className={`markdown-body ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ children: linkChildren, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {linkChildren}
            </a>
          ),
          table: ({ children: tableChildren }) => (
            <div className="md-table-wrap">
              <table>{tableChildren}</table>
            </div>
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
