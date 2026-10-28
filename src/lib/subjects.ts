import type { Subject, SubjectMeta } from '../types'

export const SUBJECTS: SubjectMeta[] = [
  { name: '语文', short: '语', color: '#c6a15b', soft: 'rgba(198, 161, 91, 0.16)', index: 0 },
  { name: '数学', short: '数', color: '#6f9fbd', soft: 'rgba(111, 159, 189, 0.16)', index: 1 },
  { name: '英语', short: '英', color: '#b38aa8', soft: 'rgba(179, 138, 168, 0.16)', index: 2 },
  { name: '物理', short: '物', color: '#83a58d', soft: 'rgba(131, 165, 141, 0.16)', index: 3 },
  { name: '化学', short: '化', color: '#c08d70', soft: 'rgba(192, 141, 112, 0.16)', index: 4 },
  { name: '生物', short: '生', color: '#9aaa72', soft: 'rgba(154, 170, 114, 0.16)', index: 5 },
  { name: '政治', short: '政', color: '#bd7f7a', soft: 'rgba(189, 127, 122, 0.16)', index: 6 },
  { name: '历史', short: '史', color: '#ae9374', soft: 'rgba(174, 147, 116, 0.16)', index: 7 },
  { name: '地理', short: '地', color: '#78a3a0', soft: 'rgba(120, 163, 160, 0.16)', index: 8 }
]

export const SUBJECT_MAP = new Map<Subject, SubjectMeta>(SUBJECTS.map((item) => [item.name, item]))

export function subjectMeta(name: string): SubjectMeta {
  return SUBJECT_MAP.get(name as Subject) ?? SUBJECTS[0]
}
