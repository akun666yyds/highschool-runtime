import type { Attempt } from '../types'

const ATTEMPTS_KEY = 'highschool-runtime.attempts.v1'
const ACTIVE_KEY = 'highschool-runtime.active.v1'
const PROFILE_KEY = 'highschool-runtime.profile.v1'

export interface Profile {
  name: string
  targetYear: number
}

const DEFAULT_PROFILE: Profile = {
  name: '阿坤',
  targetYear: 2027
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Unable to persist local data', error)
  }
}

export function loadAttempts(): Attempt[] {
  const attempts = readJson<Attempt[]>(ATTEMPTS_KEY, [])
  return Array.isArray(attempts) ? attempts : []
}

export function saveAttempts(attempts: Attempt[]): void {
  writeJson(ATTEMPTS_KEY, attempts)
}

export function loadActiveAttemptId(): string | null {
  return readJson<string | null>(ACTIVE_KEY, null)
}

export function saveActiveAttemptId(id: string | null): void {
  writeJson(ACTIVE_KEY, id)
}

export function loadProfile(): Profile {
  return { ...DEFAULT_PROFILE, ...readJson<Partial<Profile>>(PROFILE_KEY, {}) }
}

export function saveProfile(profile: Profile): void {
  writeJson(PROFILE_KEY, profile)
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
