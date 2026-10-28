import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react'
import { percent, scoreText } from '../lib/format'
import { paperStatsMap } from '../lib/stats'
import { SUBJECTS, subjectMeta } from '../lib/subjects'
import type { Attempt, Paper, PaperKind, PaperStats, Region, Subject } from '../types'

interface Props {
  papers: Paper[]
  attempts: Attempt[]
  initialSubject?: Subject
  initialKind?: PaperKind
  onOpen: (paper: Paper) => void
}

type KindFilter = 'all' | PaperKind
type RegionFilter = 'all' | Region

export function Library({ papers, attempts, initialSubject, initialKind, onOpen }: Props) {
  const [kind, setKind] = useState<KindFilter>(initialKind ?? 'all')
  const [region, setRegion] = useState<RegionFilter>('all')
  const [subject, setSubject] = useState<Subject | 'all'>(initialSubject ?? 'all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'latest' | 'unattempted'>('latest')

  useEffect(() => {
    if (initialKind) setKind(initialKind)
    if (initialSubject) setSubject(initialSubject)
  }, [initialKind, initialSubject])

  const statsMap = useMemo(() => paperStatsMap(attempts), [attempts])
  const activePaperIds = useMemo(
    () => new Set(attempts.filter((attempt) => attempt.status === 'active').map((attempt) => attempt.paperId)),
    [attempts]
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const result = papers.filter((paper) => {
      if (kind !== 'all' && paper.kind !== kind) return false
      if (region !== 'all' && paper.region !== region) return false
      if (subject !== 'all' && paper.subject !== subject) return false
      if (needle) {
        const haystack = `${paper.title} ${paper.subject} ${paper.region} ${paper.year} ${paper.tags.join(' ')}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
    return result.sort((a, b) => {
      if (sort === 'unattempted') {
        const countA = statsMap.get(a.id)?.attempts ?? 0
        const countB = statsMap.get(b.id)?.attempts ?? 0
        if (countA !== countB) return countA - countB
      }
      return b.year - a.year
    })
  }, [papers, kind, region, subject, query, sort, statsMap])

  const counts = useMemo(
    () => ({
      all: papers.length,
      real: papers.filter((paper) => paper.kind === 'real').length,
      mock: papers.filter((paper) => paper.kind === 'mock').length
    }),
    [papers]
  )

  return (
    <div className="page library">
      <header className="page-head">
        <div>
          <div className="eyebrow">LIBRARY · 已自动载入 {counts.all} 套</div>
          <h1>题库</h1>
          <p className="page-sub">真题优先，也保留足够的模拟训练。按学科，或按正式 / 模拟筛。</p>
        </div>
        <div className="library-total">
          <BookOpen size={18} strokeWidth={1.6} />
          <span>
            正式 <b>{counts.real}</b>
          </span>
          <span className="dot-sep" />
          <span>
            模拟 <b>{counts.mock}</b>
          </span>
        </div>
      </header>

      <section className="filter-panel">
        <div className="filter-row">
          <div className="segmented">
            {[
              ['all', '全部'],
              ['real', '正式'],
              ['mock', '模拟']
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={kind === value ? 'active' : ''}
                onClick={() => setKind(value as KindFilter)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="filter-divider" />
          <div className="region-pills">
            {[
              ['all', '全部地区'],
              ['江苏', '江苏'],
              ['上海', '上海'],
              ['全国', '全国卷']
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={region === value ? 'active' : ''}
                onClick={() => setRegion(value as RegionFilter)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="filter-grow" />
          <label className="search-box">
            <Search size={16} strokeWidth={1.8} />
            <input
              value={query}
              placeholder="搜索试卷、年份、标签"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={`icon-button ${sort === 'unattempted' ? 'active' : ''}`}
            title={sort === 'latest' ? '优先显示未做过的卷' : '恢复按年份排序'}
            onClick={() => setSort(sort === 'latest' ? 'unattempted' : 'latest')}
          >
            <SlidersHorizontal size={17} strokeWidth={1.7} />
          </button>
        </div>

        <div className="subject-pills">
          <button
            type="button"
            className={subject === 'all' ? 'active' : ''}
            onClick={() => setSubject('all')}
          >
            全部学科
          </button>
          {SUBJECTS.map((item) => (
            <button
              key={item.name}
              type="button"
              className={subject === item.name ? 'active' : ''}
              style={{ '--pill-color': item.color } as CSSProperties}
              onClick={() => setSubject(item.name)}
            >
              <i />
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <div className="library-result-head">
        <span>
          共 <b>{filtered.length}</b> 套试卷
          {subject !== 'all' ? ` · ${subject}` : ''}
          {kind !== 'all' ? ` · ${kind === 'real' ? '正式' : '模拟'}` : ''}
        </span>
        <span className="result-note">
          {sort === 'unattempted' ? '未做过的排前面' : '按年份从新到旧'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <FileText size={30} strokeWidth={1.3} />
          <h3>没有匹配的试卷</h3>
          <p>换一个学科或地区试试。</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setKind('all')
              setRegion('all')
              setSubject('all')
              setQuery('')
            }}
          >
            清除筛选
          </button>
        </div>
      ) : (
        <div className="paper-grid">
          {filtered.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              stats={statsMap.get(paper.id)}
              active={activePaperIds.has(paper.id)}
              onOpen={() => onOpen(paper)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PaperCard({
  paper,
  stats,
  active,
  onOpen
}: {
  paper: Paper
  stats: PaperStats | undefined
  active: boolean
  onOpen: () => void
}) {
  const meta = subjectMeta(paper.subject)
  const done = (stats?.attempts ?? 0) > 0
  const isFull = paper.format === 'full'
  return (
    <button
      type="button"
      className="paper-card"
      onClick={onOpen}
      style={{ '--subject-color': meta.color, '--subject-soft': meta.soft } as CSSProperties}
    >
      <div className="paper-card-top">
        <span className="paper-seal">{meta.short}</span>
        <span className={`kind-badge ${paper.kind}`}>{paper.kind === 'real' ? '正式' : '模拟'}</span>
        <span className="paper-year">{paper.year}</span>
        {active && <span className="live-badge">进行中</span>}
      </div>
      <h3>{paper.title}</h3>
      <div className="paper-meta">
        <span>{paper.subject}</span>
        <span>{paper.region}</span>
        <span>{paper.duration} 分钟</span>
        <span>{scoreText(paper.totalScore)} 分</span>
      </div>
      <div className="paper-tags">
        {(isFull ? ['完整卷'] : paper.tags.slice(0, 2)).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        {paper.format === 'selection' && <span>真题选编</span>}
        {paper.format === 'objective' && <span>客观题</span>}
      </div>
      <div className="paper-card-foot">
        <span className="paper-foot-stat">
          {done ? (
            <>
              <CheckCircle2 size={14} /> 最佳 {Math.round(stats?.bestPercent ?? 0)}% · {stats?.attempts} 次
            </>
          ) : (
            <>
              <Sparkles size={14} /> 还没做过
            </>
          )}
        </span>
        <span className="paper-open">
          <Clock3 size={13} /> 开考
          <ArrowUpRight size={14} />
        </span>
      </div>
      <span className="paper-corner-line" />
    </button>
  )
}
