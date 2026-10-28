import type { AnswerMap, Attempt, Paper, QuestionAnswer, QuestionMeta } from '../types'

export function answerIsEmpty(answer: QuestionAnswer | undefined): boolean {
  if (!answer) return true
  if (answer.choice?.length) return false
  return !answer.text?.trim()
}

export function answerLetter(answer: QuestionAnswer | undefined): string {
  return (answer?.choice ?? []).join('').toUpperCase()
}

function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[，。；：、！？,.!?;:]/g, '')
    .replace(/[（）()]/g, '')
    .toLowerCase()
}

export function gradeObjective(question: QuestionMeta, answer: QuestionAnswer | undefined): number | null {
  if (question.grading !== 'auto' || !question.answer) return null
  if (answerIsEmpty(answer)) return 0

  if (question.type === 'single') {
    return answerLetter(answer) === question.answer.trim().toUpperCase() ? question.score : 0
  }

  if (question.type === 'multiple') {
    const chosen = Array.from(new Set(answer?.choice ?? [])).sort().join('')
    const expected = Array.from(new Set(question.answer.toUpperCase().split(''))).sort().join('')
    return chosen === expected ? question.score : 0
  }

  if (question.type === 'fill') {
    const accepted = question.answer.split('|').map((item) => item.trim()).filter(Boolean)
    const actual = normalizeText(answer?.text ?? '')
    return accepted.some((item) => normalizeText(item) === actual) ? question.score : 0
  }

  return null
}

export function autoGradePaper(paper: Paper, answers: AnswerMap): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const question of paper.questions) {
    const score = gradeObjective(question, answers[question.id])
    if (score != null) scores[question.id] = score
  }
  return scores
}

export function selfGradeQuestions(paper: Paper): QuestionMeta[] {
  return paper.questions.filter((question) => {
    if (question.grading === 'self') return true
    return !question.answer
  })
}

export function attemptTotal(attempt: Attempt): number {
  const auto = Object.values(attempt.autoScores).reduce((sum, value) => sum + value, 0)
  const self = Object.values(attempt.selfScores).reduce((sum, value) => sum + value, 0)
  return Math.round((auto + self) * 10) / 10
}

export function isAttemptReady(attempt: Attempt, paper: Paper): boolean {
  if (attempt.status === 'completed') return true
  return selfGradeQuestions(paper).every((question) => typeof attempt.selfScores[question.id] === 'number')
}

export function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, Math.round(value * 10) / 10))
}
