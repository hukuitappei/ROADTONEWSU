import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  mapDbDocumentToDetail,
  mapDbDocumentToSummary,
  mapDbMessageToMessageItem,
  mapDbSessionToSessionDetail,
  type DbDocumentRow,
  type DbMessageRow,
  type DbSessionRow,
  type DocumentStatus,
} from '@/types/api'

const migrationPath = join(process.cwd(), '../../supabase/migrations/20260507_001_init_phase1.sql')
const migrationSql = readFileSync(migrationPath, 'utf8')

describe('DB schema consistency: migration vs api types', () => {
  it('documents.status enum values match DocumentStatus', () => {
    const statusCheck = migrationSql.match(/status\s+text\s+not\s+null\s+default\s+'uploaded'\s+check\s*\(status\s+in\s*\(([^)]*)\)\)/i)
    expect(statusCheck).not.toBeNull()

    const statusValues = (statusCheck?.[1] ?? '')
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
      .filter(Boolean)
      .sort()

    const expected: DocumentStatus[] = ['uploaded', 'processing', 'ready', 'error']
    expect(statusValues).toEqual([...expected].sort())
  })

  it('foreign keys for messages/documents/document_chunks match expected parent tables', () => {
    expect(migrationSql).toMatch(/session_id\s+uuid\s+references\s+sessions\(id\)\s+on\s+delete\s+cascade/i)
    expect(migrationSql).toMatch(/document_id\s+uuid\s+not\s+null\s+references\s+documents\(id\)\s+on\s+delete\s+cascade/i)
  })

  it('required columns used by API mappings are defined as NOT NULL', () => {
    // sessions/messages/documents/document_chunks primary identifiers and relation keys
    expect(migrationSql).toMatch(/create table if not exists sessions[\s\S]*id\s+uuid\s+primary key/i)
    expect(migrationSql).toMatch(/create table if not exists messages[\s\S]*id\s+uuid\s+primary key/i)
    expect(migrationSql).toMatch(/create table if not exists documents[\s\S]*id\s+uuid\s+primary key/i)
    expect(migrationSql).toMatch(/create table if not exists document_chunks[\s\S]*id\s+uuid\s+primary key/i)

    expect(migrationSql).toMatch(/documents[\s\S]*filename\s+text\s+not\s+null/i)
    expect(migrationSql).toMatch(/documents[\s\S]*status\s+text\s+not\s+null/i)
    expect(migrationSql).toMatch(/document_chunks[\s\S]*content\s+text\s+not\s+null/i)
    expect(migrationSql).toMatch(/document_chunks[\s\S]*chunk_index\s+int\s+not\s+null/i)
  })
})

describe('API mapping: core columns for sessions/messages/documents/document_chunks', () => {
  it('maps session row into SessionDetail', () => {
    const row: DbSessionRow = {
      id: 'session-1',
      title: '  Demo Session  ',
      created_at: '2026-05-07T12:00:00.000Z',
    }

    expect(mapDbSessionToSessionDetail(row)).toEqual({
      id: 'session-1',
      title: 'Demo Session',
      createdAt: '2026-05-07T12:00:00.000Z',
    })
  })

  it('maps message row into MessageItem', () => {
    const row: DbMessageRow = {
      id: 'message-1',
      session_id: 'session-1',
      role: 'assistant',
      content: '回答テキスト',
      created_at: '2026-05-07T12:01:00.000Z',
    }

    expect(mapDbMessageToMessageItem(row)).toEqual({
      id: 'message-1',
      role: 'assistant',
      content: '回答テキスト',
      createdAt: '2026-05-07T12:01:00.000Z',
    })
  })

  it('maps document row into detail and summary with snake_case -> camelCase conversion', () => {
    const row: DbDocumentRow = {
      id: 'document-1',
      session_id: 'session-1',
      filename: 'spec.pdf',
      status: 'ready',
      summary: '要約',
      page_count: 10,
      char_count: 12000,
      qa_enabled: true,
      error_message: null,
      created_at: '2026-05-07T12:02:00.000Z',
      updated_at: '2026-05-07T12:03:00.000Z',
    }

    expect(mapDbDocumentToDetail(row)).toEqual({
      id: 'document-1',
      sessionId: 'session-1',
      fileName: 'spec.pdf',
      status: 'ready',
      qaEnabled: true,
      summary: '要約',
      pageCount: 10,
      charCount: 12000,
      createdAt: '2026-05-07T12:02:00.000Z',
      updatedAt: '2026-05-07T12:03:00.000Z',
    })

    expect(mapDbDocumentToSummary(row)).toEqual({
      id: 'document-1',
      fileName: 'spec.pdf',
      status: 'ready',
      qaEnabled: true,
      summary: '要約',
      createdAt: '2026-05-07T12:02:00.000Z',
    })
  })

  it('document mapping fallback: qa_enabled=null uses status===ready', () => {
    const row: DbDocumentRow = {
      id: 'document-2',
      session_id: 'session-1',
      filename: 'draft.pdf',
      status: 'processing',
      summary: null,
      page_count: null,
      char_count: null,
      qa_enabled: null,
      error_message: null,
      created_at: null,
      updated_at: null,
    }

    expect(mapDbDocumentToDetail(row).qaEnabled).toBe(false)
    expect(mapDbDocumentToSummary(row).qaEnabled).toBe(false)
  })
})
