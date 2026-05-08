import { createSupabaseServiceClient } from '@/lib/supabase'
import { deletePdfFromStorage } from '@/lib/storage'
import type { Citation, DbDocumentChunkRow, DbDocumentRow, DbMessageRow, DbSessionRow, DocumentStatus } from '@/types/api'

export const createSession = async (userId: string, title: string) => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('sessions').insert({ user_id: userId, title }).select('*').single<DbSessionRow>()
  if (error) throw error
  return data
}
export const getSession = async (id: string, userId: string) => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).eq('user_id', userId).maybeSingle<DbSessionRow>()
  if (error) throw error
  return data
}
export const listSessions = async (userId: string, limit: number, cursor?: string | null) => {
  const supabase = createSupabaseServiceClient()
  let query = supabase.from('sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit + 1)
  if (cursor) {
    const { data: c } = await supabase.from('sessions').select('created_at').eq('id', cursor).eq('user_id', userId).maybeSingle<{ created_at: string | null }>()
    if (c?.created_at) query = query.lt('created_at', c.created_at)
  }
  const { data, error } = await query.returns<DbSessionRow[]>()
  if (error) throw error
  return { items: (data ?? []).slice(0, limit), nextCursor: (data ?? []).length > limit ? (data ?? [])[limit - 1]?.id ?? null : null }
}
export const addMessage = async (sessionId: string, userId: string, role: 'user' | 'assistant', content: string, citations: Citation[] = []) => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({ session_id: sessionId, user_id: userId, role, content, citations })
    .select('*')
    .single<DbMessageRow>()
  if (error) throw error
  return data
}
export const getMessages = async (sessionId: string, limit = 50, before?: string | null) => {
  const supabase = createSupabaseServiceClient()
  let beforeCreatedAt: string | null = null
  if (before) {
    const { data } = await supabase.from('messages').select('created_at').eq('id', before).eq('session_id', sessionId).maybeSingle<{ created_at: string | null }>()
    beforeCreatedAt = data?.created_at ?? null
  }
  let query = supabase.from('messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(limit + 1)
  if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt)
  const { data, error } = await query.returns<DbMessageRow[]>()
  if (error) throw error
  const rows = data ?? []
  return { items: rows.slice(0, limit).reverse(), hasMore: rows.length > limit }
}
export const createDocument = async (sessionId: string, fileName: string, userId: string, storagePath: string) => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('documents')
    .insert({ user_id: userId, session_id: sessionId, filename: fileName, storage_path: storagePath, status: 'processing' })
    .select('*')
    .single<DbDocumentRow>()
  if (error) throw error
  return data
}

export const deleteDocument = async (id: string) => {
  const supabase = createSupabaseServiceClient()
  const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', id).maybeSingle<{ storage_path: string | null }>()
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
  if (doc?.storage_path) {
    await deletePdfFromStorage(doc.storage_path)
  }
}
export const getDocument = async (id: string, userId: string) => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).eq('user_id', userId).maybeSingle<DbDocumentRow>()
  if (error) throw error
  return data
}
export const getSessionDocuments = async (sessionId: string) => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('documents').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }).returns<DbDocumentRow[]>()
  if (error) throw error
  return data ?? []
}

export const getDocumentsByIds = async (userId: string, ids: string[]) => {
  if (ids.length === 0) return []
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .in('id', ids)
    .returns<DbDocumentRow[]>()
  if (error) throw error
  return data ?? []
}
export const saveDocumentChunks = async (
  documentId: string,
  chunks: Array<{ index: number; content: string; startPage: number | null; endPage: number | null }>,
) => {
  if (chunks.length === 0) return
  const supabase = createSupabaseServiceClient()
  const rows = chunks.map((c) => ({
    document_id: documentId,
    chunk_index: c.index,
    content: c.content,
    page_start: c.startPage,
    page_end: c.endPage,
  }))
  const { error } = await supabase.from('document_chunks').upsert(rows, { onConflict: 'document_id,chunk_index' })
  if (error) throw error
}

export const getDocumentChunks = async (documentId: string, limit = 5) => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('document_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
    .limit(limit)
    .returns<DbDocumentChunkRow[]>()
  if (error) throw error
  return data ?? []
}

export const updateDocument = async (
  id: string,
  patch: Partial<{
    status: DocumentStatus
    qaEnabled: boolean
    summary: string | null
    page_count: number | null
    char_count: number | null
    error_message: string | null
  }>,
) => {
  const supabase = createSupabaseServiceClient()
  const dbPatch = {
    ...patch,
    qa_enabled: patch.qaEnabled,
  }
  if ('qaEnabled' in dbPatch) {
    delete (dbPatch as { qaEnabled?: boolean }).qaEnabled
  }
  const { data, error } = await supabase.from('documents').update(dbPatch).eq('id', id).select('*').maybeSingle<DbDocumentRow>()
  if (error) throw error
  return data
}
