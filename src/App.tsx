import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Modal } from './components/Modal'
import { Toast } from './components/Toast'
import { Dashboard } from './pages/Dashboard'
import { Library } from './pages/Library'
import { PaperDetail } from './pages/PaperDetail'
import { Exam } from './pages/Exam'
import { Review } from './pages/Review'
import { Result } from './pages/Result'
import { Records } from './pages/Records'
import { autoGradePaper, attemptTotal, selfGradeQuestions } from './lib/grading'
import { loadPapers } from './lib/papers'
import {
  createId,
  loadActiveAttemptId,
  loadAttempts,
  loadProfile,
  saveActiveAttemptId,
  saveAttempts,
  saveProfile,
  type Profile
} from './lib/storage'
import type { AnswerMap, Attempt, Paper, SubmitReason } from './types'

export type Route =
  | { name: 'dashboard' }
  | { name: 'library'; subject?: Paper['subject']; kind?: Paper['kind'] }
  | { name: 'records' }
  | { name: 'paper'; paperId: string }
  | { name: 'exam'; attemptId: string }
  | { name: 'review'; attemptId: string }
  | { name: 'result'; attemptId: string }

interface ToastState {
  text: string
  tone: 'normal' | 'warn'
}

export default function App() {
  const papers = useMemo(() => loadPapers(), [])
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts())
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveAttemptId())
  const [profile, setProfile] = useState<Profile>(() => loadProfile())
  const [route, setRoute] = useState<Route>({ name: 'dashboard' })
  const [pendingPaper, setPendingPaper] = useState<Paper | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<number | null>(null)
  const bootChecked = useRef(false)

  const activeAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === activeId && attempt.status === 'active') ?? null,
    [attempts, activeId]
  )

  const paperMap = useMemo(() => new Map(papers.map((paper) => [paper.id, paper])), [papers])

  const showToast = useCallback((text: string, tone: 'normal' | 'warn' = 'normal') => {
    setToast({ text, tone })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    saveAttempts(attempts)
  }, [attempts])

  useEffect(() => {
    saveActiveAttemptId(activeId)
  }, [activeId])

  useEffect(() => {
    saveProfile(profile)
  }, [profile])

  const submitAttempt = useCallback(
    (attemptId: string, reason: SubmitReason, silent = false) => {
      const attempt = attempts.find((item) => item.id === attemptId)
      if (!attempt || attempt.status !== 'active') return
      const paper = paperMap.get(attempt.paperId)
      if (!paper) return
      const now = Date.now()
      const autoScores = autoGradePaper(paper, attempt.answers)
      const needsSelf = selfGradeQuestions(paper).length > 0
      const updated: Attempt = {
        ...attempt,
        submittedAt: now,
        status: needsSelf ? 'grading' : 'completed',
        reason,
        autoScores,
        score: needsSelf ? null : attemptTotal({ ...attempt, autoScores }),
        gradedAt: needsSelf ? null : now
      }
      setAttempts((current) => current.map((item) => (item.id === attemptId ? updated : item)))
      setActiveId(null)
      if (silent) {
        showToast(
          reason === 'timeout' ? '考试时间已到，系统已自动交卷' : `已交卷：${paper.title}`,
          reason === 'timeout' ? 'warn' : 'normal'
        )
      } else {
        setRoute(needsSelf ? { name: 'review', attemptId } : { name: 'result', attemptId })
      }
    },
    [attempts, paperMap, showToast]
  )

  useEffect(() => {
    if (bootChecked.current) return
    bootChecked.current = true
    const active = attempts.find((attempt) => attempt.id === activeId && attempt.status === 'active')
    if (active && active.deadline <= Date.now()) {
      submitAttempt(active.id, 'timeout', true)
    }
  }, [activeId, attempts, submitAttempt])

  const launchExam = useCallback((paper: Paper) => {
    const now = Date.now()
    const attempt: Attempt = {
      id: createId(),
      paperId: paper.id,
      startedAt: now,
      deadline: now + paper.duration * 60 * 1000,
      submittedAt: null,
      gradedAt: null,
      status: 'active',
      reason: null,
      answers: {},
      autoScores: {},
      selfScores: {},
      score: null,
      maxScore: paper.totalScore
    }
    setAttempts((current) => [attempt, ...current])
    setActiveId(attempt.id)
    setRoute({ name: 'exam', attemptId: attempt.id })
  }, [])

  const startExam = useCallback(
    (paper: Paper) => {
      if (activeAttempt) {
        setPendingPaper(paper)
        return
      }
      launchExam(paper)
    },
    [activeAttempt, launchExam]
  )

  const confirmPendingStart = useCallback(() => {
    if (!pendingPaper || !activeAttempt) return
    const paper = pendingPaper
    submitAttempt(activeAttempt.id, 'pause', true)
    setPendingPaper(null)
    launchExam(paper)
  }, [activeAttempt, launchExam, pendingPaper, submitAttempt])

  const updateAnswer = useCallback(
    (questionId: string, answer: AnswerMap[string]) => {
      if (!activeId) return
      setAttempts((current) =>
        current.map((attempt) =>
          attempt.id === activeId
            ? { ...attempt, answers: { ...attempt.answers, [questionId]: answer } }
            : attempt
        )
      )
    },
    [activeId]
  )

  const finalizeAttempt = useCallback(
    (attemptId: string, selfScores: Record<string, number>) => {
      setAttempts((current) => {
        const attempt = current.find((item) => item.id === attemptId)
        if (!attempt) return current
        const now = Date.now()
        const next: Attempt = {
          ...attempt,
          selfScores,
          status: 'completed',
          gradedAt: now,
          score: attemptTotal({ ...attempt, selfScores })
        }
        return current.map((item) => (item.id === attemptId ? next : item))
      })
      setRoute({ name: 'result', attemptId })
    },
    []
  )

  const go = useCallback((next: Route) => {
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const resumeActive = useCallback(() => {
    if (!activeAttempt) return
    if (activeAttempt.deadline <= Date.now()) {
      submitAttempt(activeAttempt.id, 'timeout', true)
      return
    }
    setRoute({ name: 'exam', attemptId: activeAttempt.id })
  }, [activeAttempt, submitAttempt])

  const resolvePaper = (paperId: string): Paper | undefined => paperMap.get(paperId)
  const resolveAttempt = (attemptId: string): Attempt | undefined =>
    attempts.find((attempt) => attempt.id === attemptId)

  const gradingCount = attempts.filter((attempt) => attempt.status === 'grading').length

  if (route.name === 'exam') {
    const attempt = resolveAttempt(route.attemptId)
    const paper = attempt ? resolvePaper(attempt.paperId) : undefined
    if (!attempt || !paper || attempt.status !== 'active') {
      return (
        <Redirect
          onDone={() => go({ name: 'dashboard' })}
          text="这场考试已经结束或不存在。"
        />
      )
    }
    return (
      <div className="flow-window">
        <TitleBar />
        <Exam
          paper={paper}
          attempt={attempt}
          onAnswer={updateAnswer}
          onSubmit={(reason) => submitAttempt(attempt.id, reason)}
          onExpire={() => submitAttempt(attempt.id, 'timeout')}
        />
        <Toast text={toast?.text ?? null} tone={toast?.tone} />
      </div>
    )
  }

  if (route.name === 'review') {
    const attempt = resolveAttempt(route.attemptId)
    const paper = attempt ? resolvePaper(attempt.paperId) : undefined
    if (!attempt || !paper || attempt.status === 'active') {
      return <Redirect onDone={() => go({ name: 'dashboard' })} text="没有找到待评卷的考试。" />
    }
    return (
      <div className="flow-window">
        <TitleBar />
        <Review
          paper={paper}
          attempt={attempt}
          onFinalize={(scores) => finalizeAttempt(attempt.id, scores)}
          onBack={() => go({ name: 'records' })}
        />
        <Toast text={toast?.text ?? null} tone={toast?.tone} />
      </div>
    )
  }

  if (route.name === 'result') {
    const attempt = resolveAttempt(route.attemptId)
    const paper = attempt ? resolvePaper(attempt.paperId) : undefined
    if (!attempt || !paper || attempt.status === 'active') {
      return <Redirect onDone={() => go({ name: 'dashboard' })} text="没有找到这场考试成绩。" />
    }
    const previous = attempts
      .filter(
        (item) =>
          item.paperId === paper.id &&
          item.status === 'completed' &&
          item.id !== attempt.id &&
          (item.submittedAt ?? 0) < (attempt.submittedAt ?? 0)
      )
      .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))[0]
    return (
      <div className="flow-window">
        <TitleBar />
        <Result
          paper={paper}
          attempt={attempt}
          previous={previous}
          onRetake={() => startExam(paper)}
          onBack={() => go({ name: 'records' })}
          onLibrary={() => go({ name: 'library' })}
        />
        <Toast text={toast?.text ?? null} tone={toast?.tone} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar
          route={route}
          profile={profile}
          paperCount={papers.length}
          gradingCount={gradingCount}
          onNavigate={go}
        />
        <main className="app-main">
          {route.name === 'dashboard' && (
            <Dashboard
              papers={papers}
              attempts={attempts}
              activeAttempt={activeAttempt}
              profile={profile}
              onNavigate={go}
              onResume={resumeActive}
              onStart={startExam}
            />
          )}
          {route.name === 'library' && (
            <Library
              papers={papers}
              attempts={attempts}
              initialSubject={route.subject}
              initialKind={route.kind}
              onOpen={(paper) => go({ name: 'paper', paperId: paper.id })}
            />
          )}
          {route.name === 'paper' && (
            (() => {
              const paper = resolvePaper(route.paperId)
              if (!paper) {
                return <Redirect onDone={() => go({ name: 'library' })} text="没有找到这套试卷。" />
              }
              return (
                <PaperDetail
                  paper={paper}
                  attempts={attempts}
                  activeAttempt={activeAttempt}
                  onBack={() => go({ name: 'library' })}
                  onStart={() => startExam(paper)}
                  onResume={resumeActive}
                  onOpenAttempt={(attempt) =>
                    go(
                      attempt.status === 'grading'
                        ? { name: 'review', attemptId: attempt.id }
                        : { name: 'result', attemptId: attempt.id }
                    )
                  }
                />
              )
            })()
          )}
          {route.name === 'records' && (
            <Records
              papers={papers}
              attempts={attempts}
              onOpenPaper={(paperId) => go({ name: 'paper', paperId })}
              onReview={(attemptId) => go({ name: 'review', attemptId })}
              onResult={(attemptId) => go({ name: 'result', attemptId })}
              onStart={(paper) => startExam(paper)}
            />
          )}
        </main>
      </div>

      <Modal
        open={Boolean(pendingPaper)}
        title="当前还有一场考试"
        description="进入新试卷前，需要先结束正在进行的考试。暂停不会保留剩余时间，确认后本场将立即交卷。"
        confirmText="交卷并开始新考试"
        cancelText="返回当前考试"
        tone="warn"
        onConfirm={confirmPendingStart}
        onCancel={() => setPendingPaper(null)}
      />
      <Toast text={toast?.text ?? null} tone={toast?.tone} />
    </div>
  )
}

function Redirect({ onDone, text }: { onDone: () => void; text: string }) {
  useEffect(() => {
    onDone()
  }, [onDone])
  return <div className="redirect-note">{text}</div>
}
