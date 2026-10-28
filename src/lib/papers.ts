import { load } from 'js-yaml'
import type {
  Paper,
  PaperKind,
  PaperSection,
  QuestionBlock,
  QuestionMeta,
  QuestionType,
  Region,
  Subject
} from '../types'
import { subjectMeta } from './subjects'

const rawFiles = import.meta.glob('../data/papers/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

interface Frontmatter extends Omit<Paper, 'sections'> {
  questions: QuestionMeta[]
}

function normaliseQuestion(meta: Partial<QuestionMeta>, number: number): QuestionMeta {
  const type = (meta.type ?? 'essay') as QuestionType
  return {
    id: meta.id ?? `q-${number}`,
    number,
    type,
    score: Number(meta.score ?? 0),
    answer: String(meta.answer ?? ''),
    grading: meta.grading === 'auto' ? 'auto' : 'self',
    analysis: meta.analysis ?? '',
    section: meta.section ?? ''
  }
}

function parseBody(body: string, questionMeta: QuestionMeta[]): {
  sections: PaperSection[]
  intro: string
} {
  const lines = body.split('\n')
  const sections: PaperSection[] = []
  const introLines: string[] = []
  let section: PaperSection | null = null
  let question: QuestionBlock | null = null
  let seenTitle = false

  const metaByNumber = new Map<number, QuestionMeta>()
  for (const meta of questionMeta) metaByNumber.set(Number(meta.number), meta)
  let fallbackIndex = 0

  const pushQuestion = () => {
    if (question && section) section.questions.push(question)
    question = null
  }

  for (const line of lines) {
    const sectionMatch = /^##\s+(.+?)\s*$/.exec(line)
    const questionMatch = /^###\s*第\s*(\d+)\s*题\s*$/.exec(line)

    if (!seenTitle && /^#\s+/.test(line)) {
      seenTitle = true
      continue
    }

    if (sectionMatch) {
      pushQuestion()
      section = { title: sectionMatch[1].trim(), intro: '', questions: [] }
      sections.push(section)
      continue
    }

    if (questionMatch) {
      pushQuestion()
      const number = Number(questionMatch[1])
      const meta = metaByNumber.get(number) ?? questionMeta[fallbackIndex]
      fallbackIndex += 1
      if (!section) {
        section = { title: '试题', intro: '', questions: [] }
        sections.push(section)
      }
      question = {
        meta: normaliseQuestion(meta ?? {}, number),
        content: ''
      }
      continue
    }

    if (question) {
      question.content += `${line}\n`
      continue
    }

    if (section) {
      section.intro += `${line}\n`
      continue
    }

    introLines.push(line)
  }

  pushQuestion()

  for (const sec of sections) {
    sec.intro = sec.intro.trim()
    for (const q of sec.questions) q.content = q.content.trim()
    sec.questions = sec.questions.filter((q) => q.content.length > 0 || q.meta.type === 'single')
  }

  return {
    sections: sections.filter((sec) => sec.questions.length > 0 || sec.intro.length > 0),
    intro: introLines.join('\n').trim()
  }
}

function parsePaper(raw: string, path: string): Paper | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return null
  let front: Frontmatter
  try {
    front = load(match[1]) as Frontmatter
  } catch (error) {
    console.error(`Cannot parse paper frontmatter: ${path}`, error)
    return null
  }
  if (!front?.id || !front?.title) return null

  const questions = Array.isArray(front.questions)
    ? front.questions.map((q, index) => normaliseQuestion(q, Number(q.number ?? index + 1)))
    : []

  const parsed = parseBody(match[2], questions)
  const questionMap = new Map(questions.map((q) => [q.number, q]))
  const mergedQuestions = parsed.sections.flatMap((sec) => sec.questions.map((q) => q.meta))

  return {
    id: String(front.id),
    title: String(front.title),
    subject: front.subject as Subject,
    region: (front.region ?? '全国') as Region,
    year: Number(front.year ?? 0),
    kind: (front.kind ?? 'real') as PaperKind,
    format: front.format ?? 'selection',
    duration: Number(front.duration ?? 120),
    totalScore: Number(front.totalScore ?? 0),
    sourceName: front.sourceName ?? '',
    sourceUrl: front.sourceUrl ?? '',
    sourceNote: front.sourceNote ?? '',
    note: front.note ?? '',
    tags: Array.isArray(front.tags) ? front.tags.map(String) : [],
    questions: mergedQuestions.length
      ? mergedQuestions.map((q) => questionMap.get(q.number) ?? q)
      : questions,
    sections: parsed.sections
  }
}

let cache: Paper[] | null = null

export function loadPapers(): Paper[] {
  if (cache) return cache
  const papers: Paper[] = []
  for (const [path, raw] of Object.entries(rawFiles)) {
    const paper = parsePaper(raw, path)
    if (paper) papers.push(paper)
  }
  papers.sort((a, b) => {
    const kindOrder = a.kind === 'real' ? 0 : 1
    const kindOrderB = b.kind === 'real' ? 0 : 1
    if (kindOrder !== kindOrderB) return kindOrder - kindOrderB
    if (a.subject !== b.subject) return subjectMeta(a.subject).index - subjectMeta(b.subject).index
    return b.year - a.year
  })
  cache = papers
  return papers
}

export function getPaper(paperId: string): Paper | undefined {
  return loadPapers().find((paper) => paper.id === paperId)
}

export function paperQuestionScore(paper: Paper): number {
  return paper.questions.reduce((sum, question) => sum + question.score, 0)
}

export function paperAutoCount(paper: Paper): number {
  return paper.questions.filter((q) => q.grading === 'auto' && q.answer).length
}

export function paperSelfCount(paper: Paper): number {
  return paper.questions.filter((q) => q.grading === 'self' || !q.answer).length
}

export function paperQuestionTypes(paper: Paper): string[] {
  return Array.from(new Set(paper.questions.map((q) => q.type)))
}
