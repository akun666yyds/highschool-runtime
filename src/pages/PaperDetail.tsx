import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Hourglass,
  Info,
  Layers3,
  Play,
  ShieldCheck,
  TimerReset
} from 'lucide-react'
import { formatDate, formatDuration, percent, scoreText } from '../lib/format'
import { paperAutoCount, paperSelfCount } from '../lib/papers'
import { paperStatsMap } from '../lib/stats'
import { subjectMeta } from '../lib/subjects'
import type { Attempt, Paper } from '../types'

interface Props {
  paper: Paper
  attempts: Attempt[]
  activeAttempt: Attempt | null
  onBack: () => void
  onStart: () => void
  onResume: () => void
  onOpenAttempt: (attempt: Attempt) => void
}

export function PaperDetail({
  paper,
  attempts,
  activeAttempt,
  onBack,
  onStart,
  onResume,
  onOpenAttempt
}: Props) {
  const meta = subjectMeta(paper.subject)
  const paperAttempts = attempts
    .filter((attempt) => attempt.paperId === paper.id && attempt.status !== 'active')
    .sort((a, b) => (b.submittedAt ?? b.startedAt) - (a.submittedAt ?? a.startedAt))
  const stats = paperStatsMap(attempts).get(paper.id)
  const activeHere = activeAttempt?.paperId === paper.id
  const autoCount = paperAutoCount(paper)
  const selfCount = paperSelfCount(paper)
  const sectionScore = paper.sections.map((section) => ({
    ...section,
    score: section.questions.reduce((sum, question) => sum + question.meta.score, 0)
  }))

  return (
    <div
      className="page paper-detail"
      style={{ '--subject-color': meta.color, '--subject-soft': meta.soft } as CSSProperties}
    >
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> 返回题库
      </button>

      <section className="paper-hero">
        <div className="paper-hero-main">
          <div className="paper-hero-top">
            <span className="subject-seal large">{meta.short}</span>
            <span className={`kind-badge ${paper.kind}`}>{paper.kind === 'real' ? '正式真题' : '模拟试卷'}</span>
            <span className="paper-hero-region">
              {paper.region} · {paper.year}
            </span>
          </div>
          <h1>{paper.title}</h1>
          <p>{paper.note}</p>
          <div className="paper-hero-meta">
            <span>
              <Clock3 size={15} /> {paper.duration} 分钟
            </span>
            <span>
              <FileText size={15} /> {paper.questions.length} 题
            </span>
            <span>
              <Layers3 size={15} /> {scoreText(paper.totalScore)} 分
            </span>
            <span>
              <ShieldCheck size={15} /> {paper.region === '全国' ? '全国卷' : `${paper.region}卷`}
            </span>
          </div>
        </div>
        <div className="paper-hero-action">
          {activeHere ? (
            <button type="button" className="btn primary wide" onClick={onResume}>
              <TimerReset size={16} />
              继续本场考试
            </button>
          ) : (
            <button type="button" className="btn primary wide" onClick={onStart}>
              <Play size={16} fill="currentColor" />
              {paperAttempts.length ? '再考一次' : '开始考试'}
            </button>
          )}
          <span className="action-hint">
            {activeHere ? '计时仍在继续' : paperAttempts.length ? `已考 ${paperAttempts.length} 次，可反复刷分` : '开考后计时不会暂停'}
          </span>
          {activeHere && (
            <button type="button" className="text-link centered" onClick={onStart}>
              结束当前场，重新开始
            </button>
          )}
        </div>
      </section>

      <div className="paper-detail-grid">
        <div className="paper-detail-main">
          <section className="info-strip">
            <div>
              <span>自动评阅</span>
              <strong>{autoCount} 题</strong>
              <em>选择 / 填空</em>
            </div>
            <div>
              <span>交卷自评</span>
              <strong>{selfCount} 题</strong>
              <em>对照参考答案估分</em>
            </div>
            <div>
              <span>历史最佳</span>
              <strong>{stats?.bestPercent != null ? `${Math.round(stats.bestPercent)}%` : '—'}</strong>
              <em>{stats ? `${stats.attempts} 次作答` : '还没有做过'}</em>
            </div>
          </section>

          <section className="detail-section">
            <div className="section-head compact">
              <div>
                <span className="section-kicker">STRUCTURE</span>
                <h2>试卷结构</h2>
              </div>
              <span className="muted-note">{paper.sections.length} 个部分</span>
            </div>
            <div className="structure-list">
              {sectionScore.map((section, index) => (
                <div className="structure-row" key={`${section.title}-${index}`}>
                  <span className="structure-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{section.title}</strong>
                    <span>
                      {section.questions.length} 题 · {scoreText(section.score)} 分
                    </span>
                  </div>
                  <ArrowRight size={15} />
                </div>
              ))}
            </div>
          </section>

          <section className="detail-section exam-rule-card">
            <div className="rule-head">
              <Info size={18} strokeWidth={1.7} />
              <h2>这场考试怎么进行</h2>
            </div>
            <ul>
              <li>点击开始后，倒计时按真实时间流动；切到后台、关闭窗口都不会暂停。</li>
              <li>「暂停并交卷」会立即结束本场考试，没有暂停剩余时间的选项。</li>
              <li>交卷后客观题自动批改，主观题对照参考答案自评，成绩计入战绩。</li>
              <li>同一套卷可以反复重考，记录会保留每一次，并单独显示历史最佳。</li>
            </ul>
          </section>

          <section className="detail-section">
            <div className="section-head compact">
              <div>
                <span className="section-kicker">HISTORY</span>
                <h2>本卷考试记录</h2>
              </div>
            </div>
            {paperAttempts.length === 0 ? (
              <div className="empty-inline compact">
                <Hourglass size={20} strokeWidth={1.5} />
                <div>
                  <strong>还没有记录</strong>
                  <span>这次开考，会成为第一场。</span>
                </div>
              </div>
            ) : (
              <div className="attempt-list">
                {paperAttempts.map((attempt) => {
                  const isGrading = attempt.status === 'grading'
                  return (
                    <button
                      type="button"
                      className="attempt-row"
                      key={attempt.id}
                      onClick={() => onOpenAttempt(attempt)}
                    >
                      <span className={`attempt-state ${isGrading ? 'grading' : 'done'}`}>
                        {isGrading ? <Hourglass size={15} /> : <CheckCircle2 size={15} />}
                      </span>
                      <div className="attempt-main">
                        <strong>
                          {isGrading ? '等待评卷' : `${scoreText(attempt.score)} / ${scoreText(attempt.maxScore)} 分`}
                        </strong>
                        <span>
                          {formatDate(attempt.submittedAt ?? attempt.startedAt)} ·{' '}
                          {formatDuration(
                            Math.max(0, Math.round(((attempt.submittedAt ?? attempt.deadline) - attempt.startedAt) / 1000))
                          )}
                          {attempt.reason === 'pause' ? ' · 暂停交卷' : attempt.reason === 'timeout' ? ' · 到时交卷' : ''}
                        </span>
                      </div>
                      {!isGrading && (
                        <span className="attempt-percent">{percent(attempt.score, attempt.maxScore)}%</span>
                      )}
                      <ArrowRight size={15} />
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="paper-detail-side">
          <div className="side-card">
            <div className="side-card-head">
              <span>数据来源</span>
              <span className="auto-badge">自动配置</span>
            </div>
            <strong>{paper.sourceName}</strong>
            <p>{paper.sourceNote}</p>
            {paper.sourceUrl && (
              <a href={paper.sourceUrl} target="_blank" rel="noreferrer" className="source-link">
                查看来源 <ArrowUpRight size={14} />
              </a>
            )}
          </div>

          <div className="side-card">
            <div className="side-card-head">
              <span>答题方式</span>
            </div>
            <div className="answer-mode">
              <span className="mode-mark">A</span>
              <div>
                <strong>卷面内直接作答</strong>
                <p>选项点击选择，填空与主观题在题目下方编辑，输入自动保存。</p>
              </div>
            </div>
            <div className="answer-mode">
              <span className="mode-mark">B</span>
              <div>
                <strong>右侧答题卡</strong>
                <p>随时查看作答进度，点击题号快速定位，交卷前检查未答题目。</p>
              </div>
            </div>
          </div>

          <div className="side-quote">
            <span>“</span>
            <p>考试不是把你会的东西写出来，而是把不会的东西找出来。</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
