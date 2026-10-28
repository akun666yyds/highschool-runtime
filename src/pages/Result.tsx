import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  MinusCircle,
  RotateCcw,
  Trophy,
  XCircle
} from 'lucide-react'
import { Markdown } from '../components/Markdown'
import { answerIsEmpty } from '../lib/grading'
import { formatDateTime, formatDuration, percent, scoreText } from '../lib/format'
import { subjectMeta } from '../lib/subjects'
import type { Attempt, Paper, QuestionMeta } from '../types'

interface Props {
  paper: Paper
  attempt: Attempt
  previous?: Attempt
  onRetake: () => void
  onBack: () => void
  onLibrary: () => void
}

type ReviewFilter = 'all' | 'wrong' | 'unanswered'

export function Result({ paper, attempt, previous, onRetake, onBack, onLibrary }: Props) {
  const meta = subjectMeta(paper.subject)
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const pct = percent(attempt.score, attempt.maxScore)
  const prevPct = previous ? percent(previous.score, previous.maxScore) : null
  const delta = prevPct == null ? null : Math.round((pct - prevPct) * 10) / 10
  const usedSeconds = Math.max(0, Math.round(((attempt.submittedAt ?? attempt.deadline) - attempt.startedAt) / 1000))
  const autoQuestions = paper.questions.filter((question) => typeof attempt.autoScores[question.id] === 'number')
  const correct = autoQuestions.filter((question) => (attempt.autoScores[question.id] ?? 0) >= question.score).length
  const wrong = autoQuestions.length - correct
  const unanswered = paper.questions.filter((question) => answerIsEmpty(attempt.answers[question.id])).length
  const selfQuestions = paper.questions.filter((question) => typeof attempt.selfScores[question.id] === 'number')
  const selfScore = selfQuestions.reduce((sum, question) => sum + (attempt.selfScores[question.id] ?? 0), 0)
  const autoScore = Object.values(attempt.autoScores).reduce((sum, value) => sum + value, 0)
  const questionContent = useMemo(() => {
    const map = new Map<string, string>()
    for (const section of paper.sections) {
      for (const question of section.questions) map.set(question.meta.id, question.content)
    }
    return map
  }, [paper])

  const filtered = paper.questions.filter((question) => {
    const empty = answerIsEmpty(attempt.answers[question.id])
    const isSelf = typeof attempt.selfScores[question.id] === 'number'
    const isWrong = typeof attempt.autoScores[question.id] === 'number' && (attempt.autoScores[question.id] ?? 0) < question.score
    if (filter === 'unanswered') return empty
    if (filter === 'wrong') return isWrong || (isSelf && (attempt.selfScores[question.id] ?? 0) < question.score)
    return true
  })

  return (
    <div className="result-page" style={{ '--subject-color': meta.color, '--subject-soft': meta.soft } as CSSProperties}>
      <header className="flow-topbar">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> 返回战绩
        </button>
        <div className="flow-topbar-title">
          <span className="review-seal">{meta.short}</span>
          <div>
            <strong>{paper.title}</strong>
            <em>成绩单 · {formatDateTime(attempt.submittedAt)}</em>
          </div>
        </div>
        <div className="flow-topbar-right">
          <button type="button" className="btn ghost" onClick={onLibrary}>
            <FileText size={15} /> 去题库
          </button>
          <button type="button" className="btn primary" onClick={onRetake}>
            <RotateCcw size={15} /> 再考一次
          </button>
        </div>
      </header>

      <main className="result-main">
        <section className="result-hero">
          <div className="result-hero-copy">
            <div className="eyebrow">EXAM ARCHIVED · 本场成绩已归档</div>
            <h1>{headline(pct)}</h1>
            <p>
              {paper.region} · {paper.year} · {paper.subject} ·{' '}
              {attempt.reason === 'pause' ? '暂停交卷' : attempt.reason === 'timeout' ? '时间到自动交卷' : '主动交卷'}
            </p>
            <div className="result-hero-actions">
              <button type="button" className="btn primary" onClick={onRetake}>
                <RotateCcw size={15} /> 再刷一次
              </button>
              <button type="button" className="btn ghost" onClick={onBack}>
                查看全部战绩 <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div className="score-display">
            <ScoreRing percentValue={pct} />
            <div className="score-number">
              <span>{scoreText(attempt.score)}</span>
              <em>/ {scoreText(attempt.maxScore)}</em>
            </div>
            <div className="score-sub">
              {delta == null ? (
                <span>首次作答</span>
              ) : delta >= 0 ? (
                <span className="up">较上次 +{delta}%</span>
              ) : (
                <span className="down">较上次 {delta}%</span>
              )}
            </div>
          </div>
        </section>

        <section className="result-stat-grid">
          <ResultStat icon={<CheckCircle2 />} label="客观题" value={`${correct} 对`} foot={`${scoreText(autoScore)} 分`} />
          <ResultStat icon={<XCircle />} label="客观题失分" value={`${wrong} 题`} foot={`${autoQuestions.length} 题已批改`} />
          <ResultStat icon={<Award />} label="自评题" value={`${selfQuestions.length} 题`} foot={`${scoreText(selfScore)} 分`} />
          <ResultStat icon={<Clock3 />} label="用时" value={formatDuration(usedSeconds)} foot={`限时 ${paper.duration} 分钟`} />
        </section>

        <section className="result-lower">
          <div className="result-breakdown">
            <div className="section-head compact">
              <div>
                <span className="section-kicker">BREAKDOWN</span>
                <h2>成绩构成</h2>
              </div>
            </div>
            <div className="breakdown-rows">
              <BreakdownRow label="自动评阅得分" value={autoScore} max={paper.totalScore} color={meta.color} />
              <BreakdownRow label="主观题自评" value={selfScore} max={paper.totalScore} color="#c6a15b" />
              <BreakdownRow label="总得分" value={attempt.score ?? 0} max={paper.totalScore} color="#83a58d" strong />
            </div>
            <div className="result-small-stats">
              <span>
                <MinusCircle size={14} /> 未作答 {unanswered} 题
              </span>
              <span>
                <Trophy size={14} /> {previous ? `上次 ${Math.round(prevPct ?? 0)}%` : '第一次做这套卷'}
              </span>
              <span>
                <FileText size={14} /> 共 {paper.questions.length} 题
              </span>
            </div>
          </div>

          <div className="result-note-card">
            <div className="card-head">
              <div>
                <span className="card-kicker">NEXT</span>
                <h2>这场之后</h2>
              </div>
            </div>
            <p>{advice(pct, wrong, unanswered)}</p>
            <div className="next-actions">
              <button type="button" className="text-link" onClick={onRetake}>
                立刻重考这套卷 <ArrowRight size={14} />
              </button>
              <button type="button" className="text-link" onClick={onLibrary}>
                换一套继续 <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>

        <section className="review-answers-section">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">ANSWER REVIEW</span>
              <h2>逐题回看</h2>
            </div>
            <div className="review-filter">
              {[
                ['all', '全部'],
                ['wrong', '失分题'],
                ['unanswered', '未作答']
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={filter === value ? 'active' : ''}
                  onClick={() => setFilter(value as ReviewFilter)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="result-question-list">
            {filtered.map((question) => {
              const answer = attempt.answers[question.id]
              const auto = attempt.autoScores[question.id]
              const self = attempt.selfScores[question.id]
              const isOpen = Boolean(open[question.id])
              const resultText =
                typeof auto === 'number'
                  ? auto >= question.score
                    ? '正确'
                    : '失分'
                  : typeof self === 'number'
                    ? `自评 ${scoreText(self)} 分`
                    : '未评'
              const stateClass =
                typeof auto === 'number'
                  ? auto >= question.score
                    ? 'correct'
                    : 'wrong'
                  : 'self'
              return (
                <div className={`result-question ${isOpen ? 'open' : ''}`} key={question.id}>
                  <button
                    type="button"
                    className="result-question-head"
                    onClick={() => setOpen((current) => ({ ...current, [question.id]: !isOpen }))}
                  >
                    <span className={`result-q-state ${stateClass}`}>
                      {stateClass === 'correct' ? (
                        <CheckCircle2 size={16} />
                      ) : stateClass === 'wrong' ? (
                        <XCircle size={16} />
                      ) : (
                        <Award size={16} />
                      )}
                    </span>
                    <span className="result-q-number">第 {question.number} 题</span>
                    <span className="result-q-score">
                      {typeof auto === 'number'
                        ? `${scoreText(auto)} / ${question.score}`
                        : typeof self === 'number'
                          ? `${scoreText(self)} / ${question.score}`
                          : `— / ${question.score}`}
                    </span>
                    <span className={`result-q-label ${stateClass}`}>{resultText}</span>
                    <ChevronDown size={15} className={isOpen ? 'rotated' : ''} />
                  </button>
                  {isOpen && (
                    <div className="result-question-body">
                      <div className="result-q-content">
                        <Markdown>{questionContent.get(question.id) ?? ''}</Markdown>
                      </div>
                      <div className="result-answer-grid">
                        <div>
                          <span className="mini-label">你的作答</span>
                          {answerIsEmpty(answer) ? (
                            <p className="empty-answer">未作答</p>
                          ) : (
                            <div className="answer-text">
                              {answer?.choice?.length ? (
                                <span className="choice-answer">{answer.choice.join('')}</span>
                              ) : null}
                              {answer?.text ? <Markdown>{answer.text}</Markdown> : null}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="mini-label">参考答案</span>
                          {question.answer ? (
                            <div className="answer-text">
                              <Markdown>{question.answer.replace(/\|/g, ' / ')}</Markdown>
                            </div>
                          ) : (
                            <p className="empty-answer">原卷未附参考答案</p>
                          )}
                        </div>
                      </div>
                      {question.analysis && (
                        <details className="result-analysis">
                          <summary>查看解析</summary>
                          <Markdown>{question.analysis}</Markdown>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && <div className="empty-inline">这一栏没有题目。</div>}
          </div>
        </section>
      </main>
    </div>
  )
}

function ResultStat({
  icon,
  label,
  value,
  foot
}: {
  icon: ReactNode
  label: string
  value: string
  foot: string
}) {
  return (
    <div className="result-stat">
      <span className="result-stat-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <em>{foot}</em>
      </div>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  max,
  color,
  strong
}: {
  label: string
  value: number
  max: number
  color: string
  strong?: boolean
}) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`breakdown-row ${strong ? 'strong' : ''}`}>
      <div>
        <span>{label}</span>
        <strong>
          {scoreText(value)} <em>/ {scoreText(max)}</em>
        </strong>
      </div>
      <div className="breakdown-track">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function ScoreRing({ percentValue }: { percentValue: number }) {
  const radius = 64
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percentValue)) / 100) * circumference
  return (
    <svg className="score-ring" viewBox="0 0 156 156" aria-hidden="true">
      <circle cx="78" cy="78" r={radius} className="ring-track" />
      <circle
        cx="78"
        cy="78"
        r={radius}
        className="ring-value"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  )
}

function headline(pct: number): string {
  if (pct >= 90) return '这一场，很稳。'
  if (pct >= 75) return '分数在长出来。'
  if (pct >= 60) return '还有空间，方向是对的。'
  if (pct >= 40) return '先把会做的，稳稳拿住。'
  return '找到问题，就是进步的起点。'
}

function advice(pct: number, wrong: number, unanswered: number): string {
  if (unanswered > 0) return `有 ${unanswered} 道题没有作答。下一次先确保整张卷子被走完，再回头抠难题。`
  if (pct >= 85) return '这套卷已经很熟了。可以换一套同科目的新卷，或者隔两天再重考一次，看看稳定性。'
  if (wrong > 0) return `有 ${wrong} 道客观题失分。把错题重新做一遍，比立刻刷新卷更有用。`
  return '把自评题的参考答案过一遍，确认哪些步骤是你真正写出来的。'
}
