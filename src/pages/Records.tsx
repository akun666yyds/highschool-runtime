import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Flame,
  Hourglass,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy
} from 'lucide-react'
import { formatDate, formatDuration, percent, scoreText } from '../lib/format'
import { completedAttempts, overallStats, subjectStats } from '../lib/stats'
import { SUBJECTS, subjectMeta } from '../lib/subjects'
import type { Attempt, Paper, Subject } from '../types'

interface Props {
  papers: Paper[]
  attempts: Attempt[]
  onOpenPaper: (paperId: string) => void
  onReview: (attemptId: string) => void
  onResult: (attemptId: string) => void
  onStart: (paper: Paper) => void
}

type Scope = 'all' | 'completed' | 'grading'

export function Records({ papers, attempts, onOpenPaper, onReview, onResult, onStart }: Props) {
  const paperMap = useMemo(() => new Map(papers.map((paper) => [paper.id, paper])), [papers])
  const stats = useMemo(() => overallStats(attempts), [attempts])
  const done = useMemo(() => completedAttempts(attempts), [attempts])
  const subjectStatList = useMemo(() => subjectStats(attempts, papers), [attempts, papers])
  const statBySubject = useMemo(
    () => new Map(subjectStatList.map((item) => [item.subject, item])),
    [subjectStatList]
  )

  const [scope, setScope] = useState<Scope>('all')
  const [subject, setSubject] = useState<Subject | 'all'>('all')

  const grading = attempts.filter((attempt) => attempt.status === 'grading')

  const history = useMemo(() => {
    return attempts
      .filter((attempt) => attempt.status !== 'active')
      .filter((attempt) => {
        if (scope === 'completed' && attempt.status !== 'completed') return false
        if (scope === 'grading' && attempt.status !== 'grading') return false
        if (subject !== 'all') {
          const paper = paperMap.get(attempt.paperId)
          if (!paper || paper.subject !== subject) return false
        }
        return true
      })
      .sort((a, b) => (b.submittedAt ?? b.startedAt) - (a.submittedAt ?? a.startedAt))
  }, [attempts, paperMap, scope, subject])

  const uniquePapers = new Set(done.map((attempt) => attempt.paperId)).size
  const totalHours = Math.floor(stats.totalMinutes / 60)
  const totalRest = stats.totalMinutes % 60

  const trend = useMemo(() => [...done].reverse().slice(-12), [done])

  return (
    <div className="page records">
      <header className="page-head records-head">
        <div>
          <div className="eyebrow">RECORDS · 每一次作答都留痕</div>
          <h1>战绩</h1>
          <p className="page-sub">成绩不是判决书，是下一次练习的坐标。看看趋势，再决定练什么。</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            const last = done[0] ? paperMap.get(done[0].paperId) : undefined
            const target = last ?? papers[0]
            if (target) onStart(target)
          }}
        >
          <Play size={15} fill="currentColor" />
          继续练习
        </button>
      </header>

      <section className="records-hero">
        <div className="records-score-card">
          <div className="records-score-top">
            <span className="section-kicker">OVERALL</span>
            <span className="records-score-note">{stats.completedAttempts} 场已归档</span>
          </div>
          <div className="records-score-main">
            <strong>{stats.completedAttempts ? stats.averagePercent : '—'}</strong>
            <em>%</em>
          </div>
          <span className="records-score-label">全部考试平均得分率</span>
          <div className="records-score-rule" />
          <div className="records-score-foot">
            <span>
              <Trophy size={14} /> 最佳 {stats.bestPercent ? `${stats.bestPercent}%` : '—'}
            </span>
            <span>
              <Clock3 size={14} /> {totalHours > 0 ? `${totalHours} 小时 ${totalRest} 分` : `${stats.totalMinutes} 分钟`}
            </span>
            <span>
              <Flame size={14} /> 连续 {stats.streak} 天
            </span>
          </div>
        </div>

        <div className="records-trend-card">
          <div className="card-head">
            <div>
              <span className="card-kicker">TREND</span>
              <h2>得分率走势</h2>
            </div>
            <span className="trend-caption">最近 {trend.length || 0} 场</span>
          </div>
          {trend.length === 0 ? (
            <div className="records-empty-chart">
              <TrendingUp size={30} strokeWidth={1.3} />
              <strong>还没有可绘制的成绩</strong>
              <span>完成一场考试后，这里会出现你的走势。</span>
            </div>
          ) : (
            <TrendChart attempts={trend} papers={paperMap} />
          )}
          <div className="trend-foot">
            <span>
              <Target size={14} /> 目标 {Math.max(85, stats.bestPercent)}%
            </span>
            <span>横轴为考试时间，纵轴为得分率</span>
          </div>
        </div>
      </section>

      <section className="records-facts">
        <FactCard
          icon={<CheckCircle2 size={18} />}
          label="完成场次"
          value={`${stats.completedAttempts}`}
          foot={stats.totalAttempts > stats.completedAttempts ? `另有 ${stats.totalAttempts - stats.completedAttempts} 场未归档` : '全部已归档'}
          tone="teal"
        />
        <FactCard
          icon={<FileText size={18} />}
          label="做过的试卷"
          value={`${uniquePapers}`}
          foot={`题库共 ${papers.length} 套`}
          tone="blue"
        />
        <FactCard
          icon={<Award size={18} />}
          label="最佳得分率"
          value={stats.bestPercent ? `${stats.bestPercent}%` : '—'}
          foot={stats.bestPercent ? '历史单卷最高' : '完成首场后生成'}
          tone="gold"
        />
        <FactCard
          icon={<Hourglass size={18} />}
          label="待评卷"
          value={`${grading.length}`}
          foot={grading.length ? '评完后计入战绩' : '没有积压'}
          tone="rose"
        />
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <span className="section-kicker">BY SUBJECT</span>
            <h2>学科表现</h2>
          </div>
          <span className="muted-note">按平均得分率排序</span>
        </div>
        <div className="subject-stat-grid">
          {SUBJECTS.map((item) => {
            const stat = statBySubject.get(item.name)
            const width = stat ? Math.min(100, stat.averagePercent) : 0
            return (
              <button
                type="button"
                key={item.name}
                className="subject-stat-card"
                style={{ '--subject-color': item.color, '--subject-soft': item.soft } as CSSProperties}
                onClick={() => setSubject(item.name)}
              >
                <div className="subject-stat-head">
                  <span className="subject-seal">{item.short}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <em>{stat ? `${stat.attempts} 场` : '尚未作答'}</em>
                  </div>
                  <span className="subject-stat-value">{stat ? `${Math.round(stat.averagePercent)}%` : '—'}</span>
                </div>
                <div className="subject-stat-track">
                  <span style={{ width: `${width}%` }} />
                </div>
                <div className="subject-stat-foot">
                  <span>最佳 {stat ? `${Math.round(stat.bestPercent)}%` : '—'}</span>
                  <span>{stat ? `${stat.minutes} 分钟` : '从题库开始'}</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {grading.length > 0 && (
        <section className="records-pending">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">TO GRADE</span>
              <h2>等待评卷</h2>
            </div>
            <span className="muted-note">{grading.length} 场</span>
          </div>
          <div className="pending-list">
            {grading.map((attempt) => {
              const paper = paperMap.get(attempt.paperId)
              if (!paper) return null
              return (
                <button
                  type="button"
                  key={attempt.id}
                  className="pending-row"
                  onClick={() => onReview(attempt.id)}
                >
                  <span className="pending-icon">
                    <Hourglass size={17} />
                  </span>
                  <span className="pending-main">
                    <strong>{paper.title}</strong>
                    <em>
                      交卷于 {formatDate(attempt.submittedAt)} · {paper.subject} · 客观题已自动批改
                    </em>
                  </span>
                  <span className="chip warn">待自评</span>
                  <span className="pending-action">
                    去评卷 <ArrowRight size={14} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="records-history">
        <div className="section-head compact">
          <div>
            <span className="section-kicker">HISTORY</span>
            <h2>全部考试记录</h2>
          </div>
          <span className="muted-note">共 {history.length} 条</span>
        </div>

        <div className="history-filters">
          <div className="segmented">
            {[
              ['all', '全部'],
              ['completed', '已归档'],
              ['grading', '待评卷']
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={scope === value ? 'active' : ''}
                onClick={() => setScope(value as Scope)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="history-subject-pills">
            <button
              type="button"
              className={subject === 'all' ? 'active' : ''}
              onClick={() => setSubject('all')}
            >
              全部学科
            </button>
            {SUBJECTS.map((item) => (
              <button
                type="button"
                key={item.name}
                className={subject === item.name ? 'active' : ''}
                style={{ '--pill-color': item.color } as CSSProperties}
                onClick={() => setSubject(item.name)}
              >
                <i />
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="empty-state compact">
            <BarChart3 size={30} strokeWidth={1.3} />
            <h3>还没有这类的考试记录</h3>
            <p>换一个筛选条件，或者从题库开始一场新的考试。</p>
          </div>
        ) : (
          <div className="history-table">
            <div className="history-head-row">
              <span>试卷</span>
              <span>时间</span>
              <span>用时</span>
              <span>得分</span>
              <span>得分率</span>
              <span>操作</span>
            </div>
            {history.map((attempt) => {
              const paper = paperMap.get(attempt.paperId)
              if (!paper) return null
              const meta = subjectMeta(paper.subject)
              const pct = percent(attempt.score, attempt.maxScore)
              const seconds = Math.max(0, Math.round(((attempt.submittedAt ?? attempt.deadline) - attempt.startedAt) / 1000))
              const isGrading = attempt.status === 'grading'
              return (
                <div className="history-row" key={attempt.id}>
                  <button
                    type="button"
                    className="history-paper"
                    title="查看这套试卷"
                    onClick={() => onOpenPaper(paper.id)}
                  >
                    <span className="history-seal" style={{ color: meta.color, background: meta.soft }}>
                      {meta.short}
                    </span>
                    <span className="history-paper-text">
                      <strong>{paper.title}</strong>
                      <em>
                        {paper.region} · {paper.kind === 'real' ? '正式' : '模拟'} ·{' '}
                        {attempt.reason === 'pause' ? '暂停交卷' : attempt.reason === 'timeout' ? '到时交卷' : '主动交卷'}
                      </em>
                    </span>
                  </button>
                  <span className="history-date">
                    <CalendarDays size={13} /> {formatDate(attempt.submittedAt)}
                  </span>
                  <span className="history-time">{formatDuration(seconds)}</span>
                  <span className="history-score">
                    {isGrading ? '—' : `${scoreText(attempt.score)} / ${scoreText(attempt.maxScore)}`}
                  </span>
                  <span className={`history-percent ${isGrading ? 'pending' : pct >= 60 ? 'good' : 'low'}`}>
                    {isGrading ? '待评卷' : `${Math.round(pct)}%`}
                  </span>
                  <span className="history-actions">
                    {isGrading ? (
                      <button type="button" className="text-link" onClick={() => onReview(attempt.id)}>
                        去评卷 <ChevronRight size={13} />
                      </button>
                    ) : (
                      <>
                        <button type="button" className="text-link" onClick={() => onResult(attempt.id)}>
                          成绩单 <ChevronRight size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-button small"
                          title="再考一次"
                          onClick={() => onStart(paper)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function FactCard({
  icon,
  label,
  value,
  foot,
  tone
}: {
  icon: ReactNode
  label: string
  value: string
  foot: string
  tone: string
}) {
  return (
    <div className={`fact-card ${tone}`}>
      <span className="fact-icon">{icon}</span>
      <span className="fact-label">{label}</span>
      <strong className="fact-value">{value}</strong>
      <span className="fact-foot">{foot}</span>
    </div>
  )
}

function TrendChart({ attempts, papers }: { attempts: Attempt[]; papers: Map<string, Paper> }) {
  const width = 680
  const height = 220
  const padding = { left: 38, right: 18, top: 18, bottom: 30 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const points = attempts.map((attempt, index) => {
    const pct = Math.min(100, Math.max(0, percent(attempt.score, attempt.maxScore)))
    const x =
      attempts.length === 1
        ? padding.left + innerW / 2
        : padding.left + (index / (attempts.length - 1)) * innerW
    const y = padding.top + (1 - pct / 100) * innerH
    const paper = papers.get(attempt.paperId)
    return {
      x,
      y,
      pct,
      label: paper ? `${paper.subject} ${paper.year}` : '考试',
      date: formatDate(attempt.submittedAt ?? attempt.startedAt)
    }
  })

  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${points[0].x},${padding.top + innerH} ${line} ${points[points.length - 1].x},${padding.top + innerH}`
  const grid = [0, 25, 50, 75, 100]

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最近考试得分率走势图">
        <defs>
          <linearGradient id="records-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((value) => {
          const y = padding.top + (1 - value / 100) * innerH
          return (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="trend-grid-line"
              />
              <text x={padding.left - 10} y={y + 4} className="trend-axis-label" textAnchor="end">
                {value}
              </text>
            </g>
          )
        })}
        {points.length > 1 && <polygon points={area} fill="url(#records-trend-fill)" />}
        {points.length > 1 && <polyline points={line} className="trend-line" />}
        {points.map((point, index) => (
          <g key={`${point.x}-${index}`} className="trend-point-group">
            <circle cx={point.x} cy={point.y} r={7} className="trend-point-halo" />
            <circle cx={point.x} cy={point.y} r={3.4} className="trend-point" />
            <title>
              {point.label} · {point.date} · {Math.round(point.pct)}%
            </title>
            {(index === 0 || index === points.length - 1 || points.length <= 6) && (
              <text x={point.x} y={padding.top + innerH + 21} className="trend-axis-label" textAnchor="middle">
                {Math.round(point.pct)}%
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
