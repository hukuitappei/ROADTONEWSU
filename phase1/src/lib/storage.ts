import { createSupabaseServiceClient } from '@/lib/supabase'

export type StorageSaveErrorType = 'authorization' | 'capacity' | 'network' | 'unknown'

export class StorageSaveError extends Error {
  type: StorageSaveErrorType
  cause?: unknown

  constructor(type: StorageSaveErrorType, message: string, cause?: unknown) {
    super(message)
    this.name = 'StorageSaveError'
    this.type = type
    this.cause = cause
  }
}

const sanitizePdfFileName = (fileName: string): string => {
  const base = fileName.replace(/\.pdf$/i, '')
  const normalized = base
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${normalized || 'document'}.pdf`
}

const classifyStorageError = (error: unknown): StorageSaveErrorType => {
  const details = String((error as { message?: string })?.message ?? '').toLowerCase()
  const code = String(
    (error as { code?: string; statusCode?: string })?.code ??
    (error as { statusCode?: string })?.statusCode ?? ''
  ).toLowerCase()

  if (code.includes('401') || code.includes('403') || details.includes('unauthorized') || details.includes('permission')) {
    return 'authorization'
  }
  if (code.includes('413') || details.includes('payload too large') || details.includes('quota') || details.includes('exceeded')) {
    return 'capacity'
  }
  if (code.includes('network') || details.includes('fetch') || details.includes('timeout') || details.includes('econn')) {
    return 'network'
  }
  return 'unknown'
}

export const savePdfToStorage = async (
  sessionId: string,
  fileName: string,
  binary: ArrayBuffer | Buffer,
  contentType: string,
): Promise<{ storage_path: string }> => {
  const supabase = createSupabaseServiceClient()
  const sanitizedName = sanitizePdfFileName(fileName)
  const storagePath = `sessions/${sessionId}/${crypto.randomUUID()}_${sanitizedName}`

  const { error } = await supabase.storage.from('documents').upload(storagePath, binary, {
    contentType,
    upsert: false,
  })

  if (error) {
    const type = classifyStorageError(error)
    throw new StorageSaveError(type, `storage_upload_failed:${type}`, error)
  }

  return { storage_path: storagePath }
}

export const deletePdfFromStorage = async (storagePath: string): Promise<void> => {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.storage.from('documents').remove([storagePath])
  if (error) throw error
}
