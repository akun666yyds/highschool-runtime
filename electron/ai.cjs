'use strict'

/**
 * AI student exam service.
 *
 * The renderer sends the paper as plain text plus image references; this module
 * reads the images from the bundled assets, asks the model to sit the paper,
 * grades objective items locally and has the model mark the written answers.
 * The API key never leaves the main process.
 */

const fs = require('node:fs')
const path = require('node:path')
const { nativeImage } = require('electron')

const ROOT = path.join(__dirname, '..')
const CONFIG_PATH = path.join(__dirname, 'ai.config.json')
const ASSET_BASES = [path.join(ROOT, 'dist'), path.join(ROOT, 'public')]

const ANSWER_TIMEOUT = 150000
const GRADE_TIMEOUT = 90000
const IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)\)/g

let activeJob = null
let imageCache = new Map()

function loadConfig() {
  const fallback = {
    endpoint: '',
    apiKey: '',
    model: 'qwen3.8-max',
    answerConcurrency: 3,
    gradingConcurrency: 2
  }
  try {
    Object.assign(fallback, JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')))
  } catch (error) {
    // Missing config only disables the AI track; the rest of the app works.
  }
  if (process.env.HSRT_AI_ENDPOINT) fallback.endpoint = process.env.HSRT_AI_ENDPOINT
  if (process.env.HSRT_AI_KEY) fallback.apiKey = process.env.HSRT_AI_KEY
  if (process.env.HSRT_AI_MODEL) fallback.model = process.env.HSRT_AI_MODEL
  fallback.endpoint = String(fallback.endpoint || '').replace(/\/+$/, '')
  return fallback
}

function status() {
  const config = loadConfig()
  return { ready: Boolean(config.apiKey && config.endpoint), model: config.model }
}

function abortError() {
  const error = new Error('cancelled')
  error.name = 'AbortError'
  return error
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer)
        reject(abortError())
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

function withTimeout(signal, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(abortError()), ms)
  const onAbort = () => controller.abort(abortError())
  if (signal) {
    if (signal.aborted) controller.abort(abortError())
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
  }
}

async function chat(messages, options) {
  const config = loadConfig()
  if (!config.apiKey || !config.endpoint) {
    throw new Error('尚未配置 AI 服务')
  }
  const { signal, timeoutMs = ANSWER_TIMEOUT, maxTokens = 2400, temperature = 0.2 } = options
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const guard = withTimeout(signal, timeoutMs)
    try {
      const response = await fetch(`${config.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          response_format: { type: 'json_object' },
          temperature,
          max_tokens: maxTokens
        }),
        signal: guard.signal
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`AI 服务返回 ${response.status}${detail ? `：${detail.slice(0, 160)}` : ''}`)
      }
      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('AI 没有返回内容')
      }
      return content
    } catch (error) {
      lastError = error
      if (signal?.aborted || error?.name === 'AbortError') throw abortError()
      if (attempt === 0) await delay(1200, signal)
    } finally {
      guard.cleanup()
    }
  }
  throw lastError ?? new Error('AI 服务暂时不可用')
}

function parseJson(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch (error) {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch (inner) {
        // fall through
      }
    }
    throw new Error('AI 返回的格式无法识别')
  }
}

function normaliseText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[，。；：、！？,.!?;:]/g, '')
    .replace(/[（）()]/g, '')
    .toLowerCase()
}

function lettersOf(value) {
  const raw = Array.isArray(value) ? value.join('') : String(value ?? '')
  const letters = raw.toUpperCase().match(/[A-H]/g) ?? []
  return Array.from(new Set(letters)).sort()
}

function isSelfGraded(question) {
  return question.grading === 'self' || !question.answer
}

function autoScore(question, answer) {
  if (isSelfGraded(question) || !question.answer) return null
  const choice = answer?.choice ?? []
  const text = answer?.text ?? ''
  if (!choice.length && !text.trim()) return 0

  if (question.type === 'single') {
    return choice[0] === String(question.answer).trim().toUpperCase() ? question.score : 0
  }
  if (question.type === 'multiple') {
    const expected = Array.from(new Set(String(question.answer).toUpperCase().split(''))).sort().join('')
    return choice.join('') === expected ? question.score : 0
  }
  if (question.type === 'fill') {
    const accepted = String(question.answer)
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
    const actual = normaliseText(text)
    return accepted.some((item) => normaliseText(item) === actual) ? question.score : 0
  }
  return null
}

function resolveAsset(reference) {
  let clean = String(reference).split('#')[0].split('?')[0]
  if (!clean || /^https?:/i.test(clean)) return null
  clean = clean.replace(/^\.\//, '').replace(/^\/+/, '')
  for (const base of ASSET_BASES) {
    const full = path.join(base, clean)
    if (fs.existsSync(full)) return full
  }
  return null
}

function imageDataUrl(reference) {
  const file = resolveAsset(reference)
  if (!file) return null
  if (imageCache.has(file)) return imageCache.get(file)
  try {
    const stat = fs.statSync(file)
    if (stat.size > 6 * 1024 * 1024) return null
    let image = nativeImage.createFromPath(file)
    if (image.isEmpty()) return null
    const size = image.getSize()
    if (size.width > 1100) {
      image = image.resize({ width: 1100, quality: 'good' })
    }
    const url = `data:image/png;base64,${image.toPNG().toString('base64')}`
    imageCache.set(file, url)
    return url
  } catch (error) {
    return null
  }
}

function imagesFor(question) {
  const references = []
  const scan = (text) => {
    IMAGE_RE.lastIndex = 0
    let match
    while ((match = IMAGE_RE.exec(String(text ?? '')))) {
      references.push(match[1])
    }
  }
  scan(question.content)
  scan(question.sectionIntro)
  const seen = new Set()
  const images = []
  for (const reference of references) {
    const url = imageDataUrl(reference)
    if (!url || seen.has(url)) continue
    seen.add(url)
    images.push(url)
    if (images.length >= 6) break
  }
  return images
}

function typeLabel(question) {
  if (question.type === 'single') return '单项选择题'
  if (question.type === 'multiple') return '多项选择题'
  if (question.type === 'fill') return '填空题'
  if (question.type === 'essay') return '写作/论述题'
  return '解答题'
}

function answerInstruction(question) {
  if (question.type === 'single') {
    return '从中选出一个正确选项，只输出 {"choice":["B"]} 这样的单个字母。'
  }
  if (question.type === 'multiple') {
    return '选出全部正确选项，只输出 {"choice":["A","C"]} 这样的字母数组。'
  }
  if (question.type === 'fill') {
    return '写出填空答案，用 {"text":"答案"} 输出；有多个空时按顺序用 | 分隔。'
  }
  return '完整作答，写清推导步骤或文章的答案要点，用 {"text":"..."} 输出。'
}

function answerPrompt(job, question) {
  const lines = [
    `你正在参加${job.subject}考试，试卷是《${job.title}》。`,
    '请独立作答，不能参考评分标准，也不要讨论题目本身。'
  ]
  if (question.sectionIntro) {
    lines.push('', '阅读材料：', question.sectionIntro)
  }
  lines.push(
    '',
    `第 ${question.number} 题（${typeLabel(question)}，满分 ${question.score} 分）：`,
    question.content
  )
  if (question.images) {
    lines.push('', '题目附带图片，图片内容属于题干的一部分。')
  }
  lines.push('', answerInstruction(question))
  return lines.join('\n')
}

function gradePrompt(job, question, student) {
  const lines = [
    `你是${job.subject}高考阅卷老师，正在批改《${job.title}》第 ${question.number} 题。`,
    `本题满分 ${question.score} 分。`
  ]
  if (question.sectionIntro) lines.push('', '阅读材料：', question.sectionIntro)
  lines.push('', '题目：', question.content)
  if (question.answer) {
    lines.push('', '参考答案 / 评分依据：', question.answer)
  } else {
    lines.push('', '原卷未附参考答案。请先独立解题，再对照学生的关键步骤和最终结果评分。')
  }
  lines.push(
    '',
    '学生作答：',
    student.text || student.choice?.join('') || '（未作答）',
    '',
    '请给出 0 到满分之间的分数（允许 0.5 分粒度），并写一句不超过 40 字的点评。',
    '只输出 {"score": 8.5, "comment": "..."}。'
  )
  return lines.join('\n')
}

function messageContent(prompt, images) {
  if (!images.length) return prompt
  return [
    { type: 'text', text: prompt },
    ...images.map((url) => ({ type: 'image_url', image_url: { url } }))
  ]
}

async function solveQuestion(job, question, signal) {
  const images = imagesFor(question)
  const content = await chat(
    [
      {
        role: 'system',
        content:
          '你是一名正在参加高考的中国高中生。你只依据题目作答，不引用答案或解析，只输出 JSON 对象，不要输出代码块或多余说明。'
      },
      { role: 'user', content: messageContent(answerPrompt(job, question), images) }
    ],
    { signal, maxTokens: question.type === 'essay' || question.type === 'solution' ? 3200 : 1600 }
  )
  const data = parseJson(content)
  if (question.type === 'single' || question.type === 'multiple') {
    const choice = lettersOf(data.choice ?? data.answer).slice(0, 4)
    return { choice, text: '' }
  }
  const rawText = data.text ?? data.answer ?? ''
  const text = Array.isArray(rawText) ? rawText.join('|') : String(rawText ?? '').trim()
  return { choice: [], text }
}

async function markQuestion(job, question, student, signal) {
  const images = imagesFor(question)
  const content = await chat(
    [
      {
        role: 'system',
        content:
          '你是严谨的高考阅卷老师，按得分点给分，宁可严格也不虚高。只输出 JSON 对象。'
      },
      { role: 'user', content: messageContent(gradePrompt(job, question, student), images) }
    ],
    { signal, maxTokens: 1400, temperature: 0.1, timeoutMs: GRADE_TIMEOUT }
  )
  const data = parseJson(content)
  const raw = Number(data.score)
  const score = Number.isFinite(raw) ? Math.max(0, Math.min(question.score, Math.round(raw * 10) / 10)) : 0
  return {
    score,
    comment: String(data.comment ?? '').slice(0, 120)
  }
}

async function pool(items, limit, worker, signal) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      if (signal.aborted) throw abortError()
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

async function runExam(job, emit) {
  if (activeJob) {
    const error = new Error('AI 正在参加另一场考试')
    error.code = 'busy'
    throw error
  }
  if (!job?.questions?.length) throw new Error('这场试卷没有可作答的题目')

  const config = loadConfig()
  const controller = new AbortController()
  const { signal } = controller
  activeJob = controller
  imageCache = new Map()

  const startedAt = Date.now()
  const solved = new Map()
  const records = new Map()
  const total = job.questions.length
  let answered = 0

  for (const question of job.questions) {
    records.set(question.number, {
      questionId: question.id,
      number: question.number,
      type: question.type,
      choice: [],
      text: '',
      awarded: null,
      max: question.score,
      comment: ''
    })
  }

  emit({ attemptId: job.attemptId, type: 'start', total, model: config.model })

  try {
    await pool(
      job.questions,
      Math.max(1, Number(config.answerConcurrency) || 3),
      async (question) => {
        let answer = { choice: [], text: '' }
        try {
          answer = await solveQuestion(job, question, signal)
        } catch (error) {
          if (signal.aborted) throw error
          answer = { choice: [], text: '' }
        }
        solved.set(question.id, answer)
        const record = records.get(question.number)
        record.choice = answer.choice
        record.text = answer.text
        answered += 1
        emit({
          attemptId: job.attemptId,
          type: 'answered',
          done: answered,
          total,
          number: question.number,
          hasAnswer: Boolean(answer.choice.length || answer.text.trim())
        })
      },
      signal
    )

    emit({ attemptId: job.attemptId, type: 'grading', total, done: answered })

    // Objective items are graded locally; written answers go back to the model.
    const selfQuestions = []
    for (const question of job.questions) {
      const record = records.get(question.number)
      const award = autoScore(question, solved.get(question.id))
      if (award == null) {
        selfQuestions.push(question)
      } else {
        record.awarded = award
        record.comment = award >= question.score ? '客观题作答正确' : '客观题作答错误'
        emit({
          attemptId: job.attemptId,
          type: 'graded',
          total,
          number: question.number,
          score: award,
          max: question.score
        })
      }
    }

    let marked = 0
    await pool(
      selfQuestions,
      Math.max(1, Number(config.gradingConcurrency) || 2),
      async (question) => {
        const record = records.get(question.number)
        const student = solved.get(question.id) ?? { choice: [], text: '' }
        if (!student.choice.length && !student.text.trim()) {
          record.awarded = 0
          record.comment = '未作答'
        } else {
          try {
            const result = await markQuestion(job, question, student, signal)
            record.awarded = result.score
            record.comment = result.comment
          } catch (error) {
            if (signal.aborted) throw error
            record.awarded = 0
            record.comment = '评阅未完成'
          }
        }
        marked += 1
        emit({
          attemptId: job.attemptId,
          type: 'graded',
          total,
          number: question.number,
          score: record.awarded,
          max: question.score,
          written: marked,
          writtenTotal: selfQuestions.length
        })
      },
      signal
    )

    const answers = Array.from(records.values()).sort((a, b) => a.number - b.number)
    const score = Math.round(answers.reduce((sum, item) => sum + (item.awarded ?? 0), 0) * 10) / 10
    const objectiveScore = Math.round(
      answers.filter((item) => item.type !== 'essay' && item.type !== 'solution')
        .reduce((sum, item) => sum + (item.awarded ?? 0), 0) * 10
    ) / 10
    const subjectiveScore = Math.round((score - objectiveScore) * 10) / 10

    emit({ attemptId: job.attemptId, type: 'done', score, max: job.maxScore, total })

    return {
      cancelled: false,
      model: config.model,
      answers,
      score,
      maxScore: job.maxScore,
      objectiveScore,
      subjectiveScore,
      answered: answers.filter((item) => item.choice.length || item.text.trim()).length,
      total,
      startedAt,
      finishedAt: Date.now()
    }
  } catch (error) {
    const answers = Array.from(records.values()).sort((a, b) => a.number - b.number)
    if (signal.aborted) {
      emit({ attemptId: job.attemptId, type: 'cancelled', total, done: answered })
      return {
        cancelled: true,
        model: config.model,
        answers,
        score: null,
        maxScore: job.maxScore,
        objectiveScore: null,
        subjectiveScore: null,
        answered: answers.filter((item) => item.choice.length || item.text.trim()).length,
        total,
        startedAt,
        finishedAt: Date.now()
      }
    }
    throw error
  } finally {
    activeJob = null
    imageCache = new Map()
  }
}

function cancel() {
  if (!activeJob) return false
  activeJob.abort(abortError())
  return true
}

module.exports = { status, runExam, cancel }
