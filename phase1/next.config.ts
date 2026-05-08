import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // pdf-parse は fs を使うため Next.js バンドラーから除外してサーバー外部モジュール扱いにする
  serverExternalPackages: ['pdf-parse'],
}

export default nextConfig
