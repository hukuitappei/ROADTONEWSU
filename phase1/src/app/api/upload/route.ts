import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    uploadId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    fileName: 'placeholder.pdf',
    fileSize: 0,
    status: 'processing',
    createdAt: new Date().toISOString(),
  })
}
