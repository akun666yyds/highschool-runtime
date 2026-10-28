import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  Circle,
  Clock3,
  FileText,
  Flag,
  Pause,
  Send,
  Timer,
  X
} from 'lucide-react'
import { Modal } from '../components/Modal'
import { Markdown } from '../components/Markdown'
import { answerIsEmpty } from '../lib/grading'
import { formatClock, percent } from '../lib/format'
import { subjectMeta } from '../lib/subjects'
import type { AnswerMap, Attempt, Paper, QuestionBlock, QuestionType } from '../types'

interface Props {
  paper: Paper
  attempt: Attempt
  onAnswer: (questionId: string, answer: AnswerMap[string]) => void
  onSubmit: (reason: 'manual' | 'pause') => void
  onExpire: () => void
}

type SubmitMode = 'manual' | 'pause' | null

export function Exam({ paper, attempt, onAnswer, onSubmit, onExpire }: Props) {
  const meta = subjectMeta(paper.subject)
  const [now, setNow] = useState(Date.now())
  const [submitMode, setSubmitMode] = useState<SubmitMode>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const expired = useRef(false)
  const paperRef = useRef<HTMLDivElement>(null)

  const remaining = Math.max(0, Math.floor((attempt.deadline - now) / 1000))
  const answered = paper.questions.filter((question) => !answerIsEmpty(attempt.answers[question.id])).length
  const progress = paper.questions.length ? (answered / paper.questions.length) * 100 : 0
  const unanswered = paper.questions.length - answered

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (attempt.deadline - Date.now() <= 0 && !expired.current) {
      expired.current = true
      onExpire()
    }
  }, [now, attempt.deadline, onExpire])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [attempt.id])

  const optionsByQuestion = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const section of paper.sections) {
      for (const question of section.questions) {
        map.set(question.meta.id, extractOptions(question.content))
      }
    }
    return map
  }, [paper])

  const scrollToQuestion = (id: string) => {
    setActiveId(id)
    const element = document.getElementById(`question-${id}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const confirmSubmit = () => {
    const mode = submitMode
    setSubmitMode(null)
    if (mode) onSubmit(mode)
  }

  return (
    <div className="exam-page" style={{ '--subject-color': meta.color, '--subject-soft': meta.soft } as CSSProperties}>
      <header className="exam-topbar">
        <div className="exam-brand">
          <span className="exam-seal">{meta.short}</span>
          <div>
            <span>{paper.title}</span>
            <em>
              {paper.region} · {paper.year} · {paper.questions.length} 题 · {paper.totalScore} 分
            </em>
          </div>
        </div>
        <div className={`exam-timer ${remaining <= 300 ? 'danger' : ''}`}>
          <span className="timer-label">
            <Timer size={14} />
            剩余时间
          </span>
          <strong>{formatClock(remaining)}</strong>
        </div>
        <div className="exam-actions">
          <span className="save-status">
            <Check size={13} /> 已自动保存
          </span>
          <button type="button" className="btn ghost exam-pause" onClick={() => setSubmitMode('pause')}>
            <Pause size={15} />
            暂停并交卷
          </button>
          <button type="button" className="btn primary" onClick={() => setSubmitMode('manual')}>
            <Send size={15} />
            交卷
          </button>
        </div>
      </header>

      <div className="exam-body">
        <main className="exam-paper-scroll" ref={paperRef}>
          <article className="exam-paper">
            <header className="exam-paper-head">
              <div className="exam-paper-kicker">
                <span>{paper.kind === 'real' ? '正式试卷' : '模拟试卷'}</span>
                <span>{paper.region}</span>
                <span>{paper.year}</span>
              </div>
              <h1>{paper.title}</h1>
              <div className="exam-paper-meta">
                <span>
                  <Clock3 size={14} /> 考试时长 {paper.duration} 分钟
                </span>
                <span>
                  <FileText size={14} /> 满分 {paper.totalScore} 分
                </span>
              </div>
              {paper.note && <p className="exam-paper-note">{paper.note}</p>}
            </header>

            <div className="exam-questions">
              {paper.sections.map((section, sectionIndex) => (
                <section className="exam-section" key={`${section.title}-${sectionIndex}`}>
                  <div className="exam-section-title">
                    <span>{String(sectionIndex + 1).padStart(2, '0')}</span>
                    <h2>{section.title}</h2>
                  </div>
                  {section.intro && (
                    <div className="exam-section-intro">
                      <Markdown>{stripQuote(section.intro)}</Markdown>
                    </div>
                  )}
                  {section.questions.map((question) => (
                    <QuestionCard
                      key={question.meta.id}
                      question={question}
                      answer={attempt.answers[question.meta.id]}
                      options={optionsByQuestion.get(question.meta.id) ?? ['A', 'B', 'C', 'D']}
                      onAnswer={(answer) => onAnswer(question.meta.id, answer)}
                      onFocus={() => setActiveId(question.meta.id)}
                    />
                  ))}
                </section>
              ))}
            </div>

            <footer className="exam-paper-footer">
              <span>— 试卷结束 —</span>
              <button type="button" className="text-link" onClick={() => setSubmitMode('manual')}>
                检查并交卷
              </button>
            </footer>
          </article>
        </main>

        <aside className="answer-sheet">
          <div className="answer-sheet-inner">
            <div className="sheet-head">
              <div>
                <span className="section-kicker">ANSWER SHEET</span>
                <h2>答题卡</h2>
              </div>
              <span className="sheet-progress-text">
                <b>{answered}</b> / {paper.questions.length}
              </span>
            </div>
            <div className="sheet-progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="sheet-grid">
              {paper.questions.map((question, index) => {
                const isDone = !answerIsEmpty(attempt.answers[question.id])
                return (
                  <button
                    type="button"
                    key={question.id}
                    className={`${isDone ? 'done' : ''} ${activeId === question.id ? 'active' : ''}`}
                    onClick={() => scrollToQuestion(question.id)}
                    title={`第 ${question.number} 题 · ${question.score} 分`}
                  >
                    {index + 1}
                    {isDone && <i />}
                  </button>
                )
              })}
            </div>
            <div className="sheet-legend">
              <span>
                <i className="legend-done" /> 已答
              </span>
              <span>
                <i className="legend-empty" /> 未答
              </span>
              <span>
                <Flag size={12} /> 交卷前可回看
              </span>
            </div>

            <div className="sheet-divider" />

            <div className="sheet-count">
              <div>
                <strong>{unanswered}</strong>
                <span>题未作答</span>
              </div>
              <div>
                <strong>{Math.round(progress)}%</strong>
                <span>完成度</span>
              </div>
              <div>
                <strong>{percent(answered, paper.questions.length)}%</strong>
                <span>已覆盖</span>
              </div>
            </div>

            <div className="sheet-tip">
              <Circle size={6} fill="currentColor" />
              <p>时间不会暂停。离开窗口、切到后台，倒计时仍按真实时间流动。</p>
            </div>

            <div className="sheet-actions">
              <button type="button" className="btn primary full" onClick={() => setSubmitMode('manual')}>
                <Send size={15} /> 交卷
              </button>
              <button type="button" className="btn ghost full" onClick={() => setSubmitMode('pause')}>
                <Pause size={15} /> 暂停并交卷
              </button>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={submitMode !== null}
        title={submitMode === 'pause' ? '暂停即交卷' : '确认交卷'}
        description={
          submitMode === 'pause'
            ? '这场考试没有“暂停”按钮。一旦暂停，本场立即结束并进入评卷，剩余时间不会保留。'
            : unanswered > 0
              ? `还有 ${unanswered} 题未作答。交卷后将无法修改答案，确认结束本场考试吗？`
              : '所有题目都已作答。交卷后将进入评卷，确认结束本场考试吗？'
        }
        confirmText={submitMode === 'pause' ? '确认暂停并交卷' : '确认交卷'}
        cancelText="继续作答"
        tone="warn"
        onConfirm={confirmSubmit}
        onCancel={() => setSubmitMode(null)}
      />
    </div>
  )
}

function QuestionCard({
  question,
  answer,
  options,
  onAnswer,
  onFocus
}: {
  question: QuestionBlock
  answer: AnswerMap[string] | undefined
  options: string[]
  onAnswer: (answer: AnswerMap[string]) => void
  onFocus: () => void
}) {
  const { meta } = question
  const selected = answer?.choice ?? []
  const text = answer?.text ?? ''
  const type = meta.type
  const isChoice = type === 'single' || type === 'multiple'

  const choose = (letter: string) => {
    onFocus()
    if (type === 'multiple') {
      const next = selected.includes(letter)
        ? selected.filter((item) => item !== letter)
        : [...selected, letter]
      onAnswer({ ...answer, choice: next.sort() })
    } else {
      onAnswer({ ...answer, choice: [letter] })
    }
  }

  return (
    <article id={`question-${meta.id}`} className="exam-question" onMouseEnter={onFocus}>
      <div className="exam-question-head">
        <span className="question-number">{meta.number}</span>
        <span className="question-score">{meta.score} 分</span>
        <span className={`question-mode ${meta.grading}`}>
          {meta.grading === 'auto' && meta.answer ? '自动评阅' : '交卷自评'}
        </span>
      </div>
      <div className="question-content">
        <Markdown>{question.content}</Markdown>
      </div>

      <div className={`answer-box ${isChoice ? 'choice' : ''}`}>
        <div className="answer-box-head">
          <span>作答</span>
          <span>{isChoice ? (type === 'multiple' ? '可多选' : '单选') : type === 'fill' ? '填空' : '主观题'}</span>
        </div>
        {isChoice ? (
          <div className="option-row">
            {options.map((letter) => {
              const active = selected.includes(letter)
              return (
                <button
                  type="button"
                  key={letter}
                  className={`option-chip ${active ? 'active' : ''}`}
                  onClick={() => choose(letter)}
                >
                  <b>{letter}</b>
                  <span>{active ? '已选' : '选择'}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="text-answer">
            <textarea
              value={text}
              rows={type === 'fill' ? 2 : type === 'essay' ? 8 : 5}
              placeholder={type === 'fill' ? '在此填写答案…' : '写下你的解答。内容会自动保存。'}
              onChange={(event) => {
                onFocus()
                onAnswer({ ...answer, text: event.target.value })
              }}
            />
            <div className="text-answer-foot">
              <span>{text.trim().length} 字</span>
              <span>
                <Check size={12} /> 自动保存
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function extractOptions(content: string): string[] {
  const found = new Set<string>()
  const regex = /(?:^|[\n\t ])([A-H])[.．、]\s*/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content))) {
    found.add(match[1])
  }
  const letters = Array.from(found).sort()
  if (letters.length >= 2) return letters
  return ['A', 'B', 'C', 'D']
}

function stripQuote(value: string): string {
  if (value.startsWith('>')) {
    return value
      .split('\n')
      .filter((line) => !line.trim().startsWith('>'))
      .join('\n')
      .trim()
  }
  return value
}
