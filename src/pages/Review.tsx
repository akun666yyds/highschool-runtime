import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Info,
  PenLine,
  Save,
  Sparkles,
  XCircle
} from 'lucide-react'
import { Markdown } from '../components/Markdown'
import { answerIsEmpty, attemptTotal, clampScore, selfGradeQuestions } from '../lib/grading'
import { formatDateTime, percent, scoreText } from '../lib/format'
import { subjectMeta } from '../lib/subjects'
import type { Attempt, Paper, QuestionMeta } from '../types'

interface Props {
  paper: Paper
  attempt: Attempt
  onFinalize: (selfScores: Record<string, number>) => void
  onBack: () => void
}

export function Review({ paper, attempt, onFinalize, onBack }: Props) {
  const meta = subjectMeta(paper.subject)
  const selfQuestions = useMemo(() => selfGradeQuestions(paper), [paper])
  const [scores, setScores] = useState<Record<string, number>>(() => ({ ...attempt.selfScores }))
  const [openAnalysis, setOpenAnalysis] = useState<Record<string, boolean>>({})

  const autoScore = Object.values(attempt.autoScores).reduce((sum, value) => sum + value, 0)
  const selfScore = selfQuestions.reduce((sum, question) => sum + (scores[question.id] ?? 0), 0)
  const total = Math.round((autoScore + selfScore) * 10) / 10
  const unscored = selfQuestions.filter((question) => typeof scores[question.id] !== 'number')
  const autoQuestions = paper.questions.filter((question) => typeof attempt.autoScores[question.id] === 'number')
  const correct = autoQuestions.filter((question) => (attempt.autoScores[question.id] ?? 0) >= question.score).length
  const wrong = autoQuestions.length - correct

  const setScore = (question: QuestionMeta, value: number) => {
    setScores((current) => ({ ...current, [question.id]: clampScore(value, question.score) }))
  }

  const fillAll = (ratio: number) => {
    setScores((current) => {
      const next = { ...current }
      for (const question of selfQuestions) {
        next[question.id] = clampScore(question.score * ratio, question.score)
      }
      return next
    })
  }

  return (
    <div
      className="review-page"
      style={{ '--subject-color': meta.color, '--subject-soft': meta.soft } as CSSProperties}
    >
      <header className="flow-topbar">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> 返回战绩
        </button>
        <div className="flow-topbar-title">
          <span className="review-seal">{meta.short}</span>
          <div>
            <strong>评卷 · {paper.title}</strong>
            <em>交卷于 {formatDateTime(attempt.submittedAt)}</em>
          </div>
        </div>
        <div className="flow-topbar-right">
          <span className="pill-soft">待自评 {unscored.length} 题</span>
        </div>
      </header>

      <main className="review-main">
        <section className="review-hero">
          <div>
            <div className="eyebrow">OBJECTIVE GRADED · 客观题已自动批改</div>
            <h1>把最后几分，交给自己的判断。</h1>
            <p>
              客观题已经批改完成。下面是需要对照参考答案自评的题目，按得分点给分即可。
              评卷完成后，本场成绩会计入战绩。
            </p>
          </div>
          <div className="review-score">
            <span>预计总分</span>
            <strong>
              {scoreText(total)}
              <em>/ {scoreText(paper.totalScore)}</em>
            </strong>
            <small>{percent(total, paper.totalScore)}%</small>
          </div>
        </section>

        <section className="review-summary">
          <div className="review-summary-item">
            <span>客观题</span>
            <strong>{scoreText(autoScore)} 分</strong>
            <em>
              <CheckCircle2 size={13} /> {correct} 对
              <XCircle size={13} /> {wrong} 错
            </em>
          </div>
          <div className="review-summary-item">
            <span>自评题</span>
            <strong>{scoreText(selfScore)} 分</strong>
            <em>{selfQuestions.length} 题待确认</em>
          </div>
          <div className="review-summary-item">
            <span>完成度</span>
            <strong>
              {selfQuestions.length - unscored.length} / {selfQuestions.length}
            </strong>
            <em>已评题目</em>
          </div>
          <div className="quick-fill">
            <span>
              <Sparkles size={14} /> 快速估分
            </span>
            <div>
              {[
                [0.5, '50%'],
                [0.8, '80%'],
                [1, '满分']
              ].map(([ratio, label]) => (
                <button type="button" key={String(label)} onClick={() => fillAll(Number(ratio))}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="review-list">
          {selfQuestions.map((question, index) => {
            const answer = attempt.answers[question.id]
            const hasAnswer = !answerIsEmpty(answer)
            const value = scores[question.id]
            const analysisOpen = Boolean(openAnalysis[question.id])
            return (
              <article className="review-card" key={question.id}>
                <header className="review-card-head">
                  <span className="review-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>第 {question.number} 题</strong>
                    <span>
                      {question.type === 'single' || question.type === 'multiple'
                        ? '选择题'
                        : question.type === 'fill'
                          ? '填空题'
                          : '主观题'}{' '}
                      · 满分 {question.score} 分
                    </span>
                  </div>
                  <span className={`review-status ${typeof value === 'number' ? 'done' : ''}`}>
                    {typeof value === 'number' ? `${scoreText(value)} 分` : '待评分'}
                  </span>
                </header>

                <div className="review-question-content">
                  <Markdown>{paper.sections.flatMap((section) => section.questions).find((item) => item.meta.id === question.id)?.content ?? ''}</Markdown>
                </div>

                <div className="review-answer-grid">
                  <div className="review-answer-block">
                    <div className="answer-block-head">
                      <PenLine size={14} /> 你的作答
                    </div>
                    {hasAnswer ? (
                      <div className="answer-text">
                        {answer?.choice?.length ? (
                          <span className="choice-answer">{answer.choice.join('')}</span>
                        ) : null}
                        {answer?.text ? <Markdown>{answer.text}</Markdown> : null}
                      </div>
                    ) : (
                      <span className="empty-answer">未作答</span>
                    )}
                  </div>
                  <div className="review-answer-block reference">
                    <div className="answer-block-head">
                      <Award size={14} /> 参考答案 / 评分说明
                    </div>
                    {question.answer ? (
                      <div className="answer-text">
                        <Markdown>{question.answer.replace(/\|/g, ' / ')}</Markdown>
                      </div>
                    ) : (
                      <div className="missing-reference">
                        <CircleHelp size={17} />
                        <span>原卷未附参考答案</span>
                        <p>请对照自己的解题过程与步骤完整度评分；这道题会如实标记为“自评卷”。</p>
                      </div>
                    )}
                    {question.analysis && (
                      <div className="analysis-wrap">
                        <button
                          type="button"
                          className="analysis-toggle"
                          onClick={() =>
                            setOpenAnalysis((current) => ({ ...current, [question.id]: !analysisOpen }))
                          }
                        >
                          {analysisOpen ? '收起解析' : '查看解析'}
                          <ChevronDown size={14} className={analysisOpen ? 'rotated' : ''} />
                        </button>
                        {analysisOpen && (
                          <div className="analysis-body">
                            <Markdown>{question.analysis}</Markdown>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="score-input-row">
                  <span>本题得分</span>
                  <input
                    type="range"
                    min={0}
                    max={question.score}
                    step={0.5}
                    value={value ?? 0}
                    onChange={(event) => setScore(question, Number(event.target.value))}
                  />
                  <div className="score-number">
                    <input
                      type="number"
                      min={0}
                      max={question.score}
                      step={0.5}
                      value={value ?? ''}
                      placeholder="—"
                      onChange={(event) => setScore(question, Number(event.target.value))}
                    />
                    <span>/ {question.score}</span>
                  </div>
                  <div className="score-quick">
                    {[0, 0.5, 0.8, 1].map((ratio) => (
                      <button
                        type="button"
                        key={ratio}
                        className={value === clampScore(question.score * ratio, question.score) ? 'active' : ''}
                        onClick={() => setScore(question, question.score * ratio)}
                      >
                        {ratio === 0 ? '0' : Math.round(ratio * 100) + '%'}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <footer className="review-footer">
          <div className="review-footer-note">
            <Info size={15} />
            <span>
              {unscored.length
                ? `还有 ${unscored.length} 题没有评分。全部评完后才能归档成绩。`
                : '所有自评题都已确认。归档后本场成绩将进入战绩。'}
            </span>
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={unscored.length > 0}
            onClick={() => onFinalize(scores)}
          >
            <Save size={15} />
            完成评卷并归档
          </button>
        </footer>
      </main>
    </div>
  )
}
