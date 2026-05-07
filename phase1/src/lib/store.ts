import type { DocumentStatus } from '@/types/api'

export type Session = {
  id: string
  title: string
  createdAt: string
  lastMessageAt: string
}

export type Message = {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type Document = {
  id: string
  sessionId: string
  fileName: string
  fileSize: number
  status: DocumentStatus
  qaEnabled: boolean
  summary: string | null
  pageCount: number | null
  charCount: number | null
  createdAt: string
  updatedAt: string
}

const sessions = new Map<string, Session>()
const messages = new Map<string, Message[]>()
const documents = new Map<string, Document>()

export const createSession = (title: string) => {
  const now = new Date().toISOString()
  const session: Session = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    lastMessageAt: now,
  }

  sessions.set(session.id, session)
  messages.set(session.id, [])
  return session
}

export const getSession = (id: string) => sessions.get(id) ?? null

export const listSessions = (limit: number, cursor?: string | null) => {
  const sorted = [...sessions.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const offset = cursor ? sorted.findIndex((s) => s.id === cursor) + 1 : 0
  const page = sorted.slice(Math.max(offset, 0), Math.max(offset, 0) + limit)
  const last = page.at(-1)

  return {
    items: page,
    nextCursor: last && sorted.length > offset + limit ? last.id : null,
  }
}

export const addMessage = (sessionId: string, role: 'user' | 'assistant', content: string) => {
  const list = messages.get(sessionId)
  if (!list) return null

  const item: Message = {
    id: crypto.randomUUID(),
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
  }

  list.push(item)
  const session = sessions.get(sessionId)
  if (session) {
    session.lastMessageAt = item.createdAt
    sessions.set(sessionId, session)
  }

  return item
}

export const getMessages = (sessionId: string, limit = 50, before?: string | null) => {
  const list = messages.get(sessionId) ?? []
  const beforeIndex = before ? list.findIndex((m) => m.id === before) : -1
  const end = beforeIndex === -1 ? list.length : beforeIndex
  const start = Math.max(0, end - limit)

  return {
    items: list.slice(start, end),
    hasMore: start > 0,
  }
}

export const createDocument = (sessionId: string, fileName: string, fileSize: number): Document => {
  const now = new Date().toISOString()
  const doc: Document = {
    id: crypto.randomUUID(),
    sessionId,
    fileName,
    fileSize,
    status: 'processing',
    qaEnabled: false,
    summary: null,
    pageCount: null,
    charCount: null,
    createdAt: now,
    updatedAt: now,
  }

  documents.set(doc.id, doc)
  return doc
}

export const updateDocument = (
  id: string,
  patch: Partial<Omit<Document, 'id' | 'sessionId' | 'createdAt'>>,
): Document | null => {
  const doc = documents.get(id)
  if (!doc) return null

  const updated: Document = { ...doc, ...patch, updatedAt: new Date().toISOString() }
  documents.set(id, updated)
  return updated
}

export const getDocument = (id: string) => documents.get(id) ?? null

export const getSessionDocuments = (sessionId: string) =>
  [...documents.values()].filter((d) => d.sessionId === sessionId)
