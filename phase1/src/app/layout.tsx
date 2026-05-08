import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PDF要約・質問応答アプリ',
  description: 'PDFをアップロードして要約・質問応答ができるアプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
