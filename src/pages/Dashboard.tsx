import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  CalendarDays,
  ChevronRight,
  Clock3,
  Flame,
  Hourglass,
  Play,
  RotateCcw,
  Target,
  TimerReset,
  TrendingUp
} from 'lucide-react'
import type { Route } from '../App'
import type { Profile } from '../lib/storage'
import {
  daysUntil,
  formatDate,
  formatDuration,
  greeting,
  isSameDay,
  percent,
  scoreText,
  startOfDay,
  weekday
} from '../lib/format'
import { completedAttempts, overallStats, paperStatsMap, subjectStats } from '../lib/stats'
import { SUBJECTS, subjectMeta } from '../lib/subjects'
import type { Attempt, Paper } from '../types'

interface Props {
  papers: Paper[]
  attempts: Attempt[]
  activeAttempt: Attempt | null
  profile: Profile
  onNavigate: (route: Route) => void
  onResume: () => void
  onStart: (paper: Paper) => void
}

export function Dashboard({ papers, attempts, activeAttempt, profile, onNavigate, onResume, onStart }: Props) {
  const now = new Date()
  const stats = overallStats(attempts)
  const subjectStatList = subjectStats(attempts, papers)
  const statsBySubject = new Map(subjectStatList.map((item) => [item.subject, item]))
  const bestMap = paperStatsMap(attempts)
  const done = completedAttempts(attempts)
  const recent = attempts
    .filter((attempt) => attempt.status !== 'active')
    .sort((a, b) => (b.submittedAt ?? b.startedAt) - (a.submittedAt ?? a.startedAt))
    .slice(0, 4)
  const target = new Date(`${profile.targetYear}-06-07T09:00:00+08:00`)
  const countdown = daysUntil(target, now)
  const activePaper = activeAttempt ? papers.find((paper) => paper.id === activeAttempt.paperId) : undefined

  const recommend = pickRecommendation(papers, attempts)
  const grading = attempts.filter((attempt) => attempt.status === 'grading')

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = startOfDay(now) - (6 - index) * 86400000
    const minutes = done
      .filter((attempt) => startOfDay(attempt.submittedAt ?? 0) === day)
      .reduce(
        (sum, attempt) =>
          sum + Math.round(((attempt.submittedAt ?? attempt.deadline) - attempt.startedAt) / 60000),
        0
      )
    return {
      label: ['日', '一', '二', '三', '四', '五', '六'][new Date(day).getDay()],
      minutes,
      today: isSameDay(day, now)
    }
  })
  const weekMax = Math.max(30, ...week.map((item) => item.minutes))

  return (
    <div className="page dashboard">
      <header className="page-head dashboard-head">
        <div>
          <div className="eyebrow">
            {formatDate(now)} · {weekday(now)}
            <span className="eyebrow-dot" />
            {stats.completedAttempts > 0 ? `已完成 ${stats.completedAttempts} 场考试` : '准备开始第一场'}
          </div>
          <h1>
            {greeting(now)}，{profile.name}。
          </h1>
          <p className="page-sub">今天也把时间，花在会留下痕迹的地方。</p>
        </div>
        <button type="button" className="btn primary" onClick={() => onNavigate({ name: 'library' })}>
          进入题库
          <ArrowUpRight size={16} strokeWidth={1.8} />
        </button>
      </header>

      {activeAttempt && activePaper && (
        <section className="resume-banner">
          <div className="resume-icon">
            <TimerReset size={22} strokeWidth={1.7} />
          </div>
          <div className="resume-copy">
            <span className="resume-kicker">正在进行</span>
            <strong>{activePaper.title}</strong>
            <span>
              剩余 {formatDuration(Math.max(0, (activeAttempt.deadline - Date.now()) / 1000))} · 计时不会暂停
            </span>
          </div>
          <button type="button" className="btn light" onClick={onResume}>
            继续考试
            <ArrowRight size={15} />
          </button>
        </section>
      )}

      {grading.length > 0 && (
        <section className="grading-banner">
          <Award size={18} strokeWidth={1.7} />
          <span>有 {grading.length} 场考试等待评卷，完成后会计入战绩。</span>
          <button type="button" className="text-link" onClick={() => onNavigate({ name: 'records' })}>
            去评卷 <ChevronRight size={14} />
          </button>
        </section>
      )}

      <section className="hero-grid">
        <div className="hero-card">
          <div className="hero-kicker">COUNTDOWN · {profile.targetYear}</div>
          <div className="hero-count">
            <span>{Math.max(0, countdown)}</span>
            <em>天</em>
          </div>
          <div className="hero-copy">距离 {profile.targetYear} 年高考</div>
          <div className="hero-rule" />
          <p>不必每天都赢，但要让每一次坐下，都比上一次更稳。</p>
          <div className="hero-actions">
            {recommend ? (
              <button type="button" className="btn primary" onClick={() => onStart(recommend)}>
                <Play size={15} fill="currentColor" />
                开始今日推荐
              </button>
            ) : null}
            <button type="button" className="btn ghost subtle" onClick={() => onNavigate({ name: 'records' })}>
              查看战绩
            </button>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <span className="orbit-dot" />
          </div>
        </div>

        <div className="today-card">
          <div className="card-head">
            <div>
              <span className="card-kicker">TODAY</span>
              <h2>今日节奏</h2>
            </div>
            <div className="today-total">
              {stats.todayMinutes}
              <small>分钟</small>
            </div>
          </div>
          <div className="week-chart" aria-label="最近七天学习时长">
            {week.map((item, index) => (
              <div className={`week-col ${item.today ? 'today' : ''}`} key={index}>
                <div className="week-bar-track">
                  <div
                    className="week-bar"
                    style={{ height: `${Math.max(item.minutes > 0 ? 8 : 2, (item.minutes / weekMax) * 100)}%` }}
                  />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="today-foot">
            <span>
              <Flame size={15} /> 连续 {stats.streak} 天
            </span>
            <span>
              <Clock3 size={15} /> 累计 {Math.floor(stats.totalMinutes / 60)} 小时 {stats.totalMinutes % 60} 分
            </span>
          </div>
        </div>
      </section>

      <section className="stat-grid">
        <StatCard
          icon={<Target size={18} />}
          label="平均得分率"
          value={stats.completedAttempts ? `${stats.averagePercent}%` : '—'}
          foot={stats.completedAttempts ? '全部已完成考试' : '完成首场考试后生成'}
          tone="gold"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="最佳单卷"
          value={stats.bestPercent ? `${stats.bestPercent}%` : '—'}
          foot={stats.bestPercent ? '历史最高得分率' : '还没有成绩记录'}
          tone="teal"
        />
        <StatCard
          icon={<Hourglass size={18} />}
          label="累计考试"
          value={`${stats.completedAttempts}`}
          foot={stats.totalAttempts > stats.completedAttempts ? `${stats.totalAttempts - stats.completedAttempts} 场待完成` : '场已完成'}
          tone="blue"
        />
        <StatCard
          icon={<Flame size={18} />}
          label="连续学习"
          value={`${stats.streak}`}
          foot={stats.streak > 0 ? '保持住这个节奏' : '从今天开始'}
          tone="rose"
        />
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <span className="section-kicker">SUBJECTS</span>
            <h2>按学科练习</h2>
          </div>
          <button type="button" className="text-link" onClick={() => onNavigate({ name: 'library' })}>
            全部试卷 <ArrowRight size={14} />
          </button>
        </div>
        <div className="subject-grid">
          {SUBJECTS.map((subject) => {
            const subjectPapers = papers.filter((paper) => paper.subject === subject.name)
            const stat = statsBySubject.get(subject.name)
            const attempted = new Set(
              done
                .map((attempt) => papers.find((paper) => paper.id === attempt.paperId))
                .filter((paper) => paper?.subject === subject.name)
                .map((paper) => paper?.id)
            ).size
            return (
              <button
                type="button"
                className="subject-card"
                key={subject.name}
                style={{ '--subject-color': subject.color, '--subject-soft': subject.soft } as CSSProperties}
                onClick={() => onNavigate({ name: 'library', subject: subject.name })}
              >
                <div className="subject-seal">{subject.short}</div>
                <div className="subject-body">
                  <strong>{subject.name}</strong>
                  <span>
                    {subjectPapers.length} 套 · 已做 {attempted}
                  </span>
                </div>
                <div className="subject-score">
                  {stat ? `${Math.round(stat.averagePercent)}%` : '—'}
                  <small>均分率</small>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="lower-grid">
        <div className="recent-panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">RECENT</span>
              <h2>最近的考试</h2>
            </div>
            <button type="button" className="text-link" onClick={() => onNavigate({ name: 'records' })}>
              全部 <ArrowRight size={14} />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="empty-inline">
              <CalendarDays size={22} strokeWidth={1.5} />
              <div>
                <strong>还没有考试记录</strong>
                <span>从题库里挑一套卷子，开始第一场。</span>
              </div>
              <button type="button" className="btn ghost" onClick={() => onNavigate({ name: 'library' })}>
                去题库
              </button>
            </div>
          ) : (
            <div className="recent-list">
              {recent.map((attempt) => {
                const paper = papers.find((item) => item.id === attempt.paperId)
                if (!paper) return null
                const meta = subjectMeta(paper.subject)
                const isGrading = attempt.status === 'grading'
                return (
                  <button
                    type="button"
                    className="recent-row"
                    key={attempt.id}
                    onClick={() =>
                      isGrading
                        ? onNavigate({ name: 'review', attemptId: attempt.id })
                        : onNavigate({ name: 'result', attemptId: attempt.id })
                    }
                  >
                    <span className="recent-mark" style={{ color: meta.color, background: meta.soft }}>
                      {meta.short}
                    </span>
                    <span className="recent-main">
                      <strong>{paper.title}</strong>
                      <em>
                        {formatDate(attempt.submittedAt ?? attempt.startedAt)} ·{' '}
                        {formatDuration(
                          Math.max(0, Math.round(((attempt.submittedAt ?? attempt.deadline) - attempt.startedAt) / 1000))
                        )}
                      </em>
                    </span>
                    {isGrading ? (
                      <span className="chip warn">待评卷</span>
                    ) : (
                      <span className="recent-score">
                        <strong>{scoreText(attempt.score)}</strong>
                        <em>/ {scoreText(attempt.maxScore)}</em>
                      </span>
                    )}
                    <ChevronRight size={15} className="recent-arrow" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="recommend-panel">
          <div className="card-head">
            <div>
              <span className="card-kicker">PICK FOR YOU</span>
              <h2>今日推荐</h2>
            </div>
            <RotateCcw size={17} strokeWidth={1.5} />
          </div>
          {recommend ? (
            <>
              <div className="recommend-year">{recommend.year}</div>
              <h3>{recommend.title}</h3>
              <div className="recommend-meta">
                <span>{recommend.subject}</span>
                <span>{recommend.region}</span>
                <span>{recommend.duration} 分钟</span>
                <span>{scoreText(recommend.totalScore)} 分</span>
              </div>
              <p>{recommend.note || recommend.sourceNote}</p>
              <div className="recommend-best">
                {bestMap.get(recommend.id)?.bestPercent != null ? (
                  <>
                    历史最佳 <b>{bestMap.get(recommend.id)?.bestPercent}%</b>
                  </>
                ) : (
                  '还没有做过这套卷'
                )}
              </div>
              <button type="button" className="btn primary full" onClick={() => onStart(recommend)}>
                <Play size={15} fill="currentColor" />
                开始这场考试
              </button>
            </>
          ) : (
            <p>题库为空。</p>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({
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
    <div className={`stat-card ${tone}`}>
      <div className="stat-icon">{icon}</div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-foot">{foot}</span>
    </div>
  )
}

function pickRecommendation(papers: Paper[], attempts: Attempt[]): Paper | undefined {
  if (!papers.length) return undefined
  const attemptsByPaper = new Map<string, number>()
  for (const attempt of attempts) {
    if (attempt.status !== 'active') {
      attemptsByPaper.set(attempt.paperId, (attemptsByPaper.get(attempt.paperId) ?? 0) + 1)
    }
  }
  const preferred = papers.filter(
    (paper) =>
      paper.kind === 'real' &&
      (paper.region === '江苏' || paper.region === '上海') &&
      (paper.format === 'full' || paper.format === 'selection')
  )
  const pool = preferred.length ? preferred : papers.filter((paper) => paper.kind === 'real')
  const sorted = [...pool].sort((a, b) => {
    const countA = attemptsByPaper.get(a.id) ?? 0
    const countB = attemptsByPaper.get(b.id) ?? 0
    if (countA !== countB) return countA - countB
    return b.year - a.year
  })
  return sorted[0] ?? papers[0]
}
