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
  status: 'uploaded' | 'processing' | 'ready' | 'error'
  createdAt: string
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

export const getMessages = (sessionId: string) => messages.get(sessionId) ?? []

export const createDocument = (sessionId: string, fileName: string, fileSize: number): Document => {
  const doc: Document = {
    id: crypto.randomUUID(),
    sessionId,
    fileName,
    fileSize,
    status: 'processing',
    createdAt: new Date().toISOString(),
  }

  documents.set(doc.id, doc)
  return doc
}

export const getDocument = (id: string) => documents.get(id) ?? null

export const getSessionDocuments = (sessionId: string) => [...documents.values()].filter((d) => d.sessionId === sessionId)
