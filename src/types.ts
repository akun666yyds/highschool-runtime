export type Subject =
  | '语文'
  | '数学'
  | '英语'
  | '物理'
  | '化学'
  | '生物'
  | '政治'
  | '历史'
  | '地理'

export type Region = '江苏' | '上海' | '全国'
export type PaperKind = 'real' | 'mock'
export type PaperFormat = 'full' | 'selection' | 'objective'
export type QuestionType = 'single' | 'multiple' | 'fill' | 'essay' | 'solution'
export type GradingMode = 'auto' | 'self'

export interface QuestionMeta {
  id: string
  number: number
  type: QuestionType
  score: number
  answer: string
  grading: GradingMode
  analysis?: string
  section?: string
}

export interface QuestionBlock {
  meta: QuestionMeta
  content: string
}

export interface PaperSection {
  title: string
  intro: string
  questions: QuestionBlock[]
}

export interface Paper {
  id: string
  title: string
  subject: Subject
  region: Region
  year: number
  kind: PaperKind
  format: PaperFormat
  duration: number
  totalScore: number
  sourceName: string
  sourceUrl: string
  sourceNote: string
  note: string
  tags: string[]
  questions: QuestionMeta[]
  sections: PaperSection[]
}

export interface QuestionAnswer {
  choice?: string[]
  text?: string
}

export type AnswerMap = Record<string, QuestionAnswer>

export type AttemptStatus = 'active' | 'grading' | 'completed'
export type SubmitReason = 'manual' | 'pause' | 'timeout'

export interface Attempt {
  id: string
  paperId: string
  startedAt: number
  deadline: number
  submittedAt: number | null
  gradedAt: number | null
  status: AttemptStatus
  reason: SubmitReason | null
  answers: AnswerMap
  autoScores: Record<string, number>
  selfScores: Record<string, number>
  score: number | null
  maxScore: number
}

export interface SubjectMeta {
  name: Subject
  short: string
  color: string
  soft: string
  index: number
}

export interface PaperStats {
  attempts: number
  bestScore: number | null
  bestPercent: number | null
  lastScore: number | null
  lastAt: number | null
}
