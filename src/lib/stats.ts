import type { Attempt, Paper, PaperStats, Subject } from '../types'
import { percent, startOfDay } from './format'

export interface OverallStats {
  totalAttempts: number
  completedAttempts: number
  averagePercent: number
  bestPercent: number
  totalMinutes: number
  streak: number
  todayMinutes: number
}

export function completedAttempts(attempts: Attempt[]): Attempt[] {
  return attempts
    .filter((attempt) => attempt.status === 'completed' && attempt.score != null)
    .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
}

export function paperStatsMap(attempts: Attempt[]): Map<string, PaperStats> {
  const map = new Map<string, PaperStats>()
  for (const attempt of attempts) {
    if (attempt.status !== 'completed' || attempt.score == null) continue
    const existing = map.get(attempt.paperId) ?? {
      attempts: 0,
      bestScore: null,
      bestPercent: null,
      lastScore: null,
      lastAt: null
    }
    const pct = percent(attempt.score, attempt.maxScore)
    existing.attempts += 1
    if (existing.bestPercent == null || pct > existing.bestPercent) {
      existing.bestScore = attempt.score
      existing.bestPercent = pct
    }
    if (existing.lastAt == null || (attempt.submittedAt ?? 0) > existing.lastAt) {
      existing.lastAt = attempt.submittedAt
      existing.lastScore = attempt.score
    }
    map.set(attempt.paperId, existing)
  }
  return map
}

export function overallStats(attempts: Attempt[]): OverallStats {
  const done = completedAttempts(attempts)
  const percents = done.map((attempt) => percent(attempt.score, attempt.maxScore))
  const totalSeconds = done.reduce((sum, attempt) => {
    const end = attempt.submittedAt ?? attempt.deadline
    return sum + Math.max(0, Math.round((end - attempt.startedAt) / 1000))
  }, 0)

  const today = startOfDay(Date.now())
  const todaySeconds = done
    .filter((attempt) => startOfDay(attempt.submittedAt ?? 0) === today)
    .reduce((sum, attempt) => {
      const end = attempt.submittedAt ?? attempt.deadline
      return sum + Math.max(0, Math.round((end - attempt.startedAt) / 1000))
    }, 0)

  const days = Array.from(new Set(done.map((attempt) => startOfDay(attempt.submittedAt ?? 0)))).sort(
    (a, b) => b - a
  )
  let streak = 0
  if (days.length) {
    let cursor = startOfDay(Date.now())
    if (days[0] !== cursor) cursor -= 86400000
    for (const day of days) {
      if (day === cursor) {
        streak += 1
        cursor -= 86400000
      } else if (day < cursor) {
        break
      }
    }
  }

  return {
    totalAttempts: attempts.length,
    completedAttempts: done.length,
    averagePercent: percents.length
      ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10
      : 0,
    bestPercent: percents.length ? Math.max(...percents) : 0,
    totalMinutes: Math.round(totalSeconds / 60),
    streak,
    todayMinutes: Math.round(todaySeconds / 60)
  }
}

export interface SubjectStat {
  subject: Subject
  attempts: number
  averagePercent: number
  bestPercent: number
  minutes: number
}

export function subjectStats(attempts: Attempt[], papers: Paper[]): SubjectStat[] {
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]))
  const buckets = new Map<Subject, { percents: number[]; minutes: number; count: number; best: number }>()
  for (const attempt of completedAttempts(attempts)) {
    const paper = paperMap.get(attempt.paperId)
    if (!paper || attempt.score == null) continue
    const bucket = buckets.get(paper.subject) ?? { percents: [], minutes: 0, count: 0, best: 0 }
    const pct = percent(attempt.score, attempt.maxScore)
    bucket.percents.push(pct)
    bucket.count += 1
    bucket.best = Math.max(bucket.best, pct)
    bucket.minutes += Math.round(((attempt.submittedAt ?? attempt.deadline) - attempt.startedAt) / 60000)
    buckets.set(paper.subject, bucket)
  }
  return Array.from(buckets.entries()).map(([subject, bucket]) => ({
    subject,
    attempts: bucket.count,
    averagePercent: Math.round((bucket.percents.reduce((a, b) => a + b, 0) / bucket.percents.length) * 10) / 10,
    bestPercent: bucket.best,
    minutes: bucket.minutes
  }))
}

export function attemptsForPaper(attempts: Attempt[], paperId: string): Attempt[] {
  return attempts
    .filter((attempt) => attempt.paperId === paperId && attempt.status !== 'active')
    .sort((a, b) => (b.submittedAt ?? b.startedAt) - (a.submittedAt ?? a.startedAt))
}
