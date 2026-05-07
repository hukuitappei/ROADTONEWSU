const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'
const REQUEST_TIMEOUT_MS = 30_000
const RETRY_DELAYS_MS = [1000, 2000, 4000] as const

type GenerateAnswerInput = {
  prompt: string
  signal?: AbortSignal
}

export type ChatCompletion = {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

type ProviderErrorCode = 'provider_rate_limited' | 'provider_internal_error' | 'provider_unavailable' | 'provider_network_error'

type ProviderErrorCause = {
  status?: number
  code: ProviderErrorCode
}

const getClientConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL

  if (!apiKey) {
    throw new Error('missing_openai_api_key')
  }

  return { apiKey, baseUrl, model }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const shouldRetry = (status?: number, isNetworkError?: boolean) => {
  if (isNetworkError) return true
  if (status === 429) return true
  return typeof status === 'number' && status >= 500 && status <= 599
}

const classifyProviderErrorCode = (status?: number, isNetworkError?: boolean): ProviderErrorCode => {
  if (isNetworkError) return 'provider_network_error'
  if (status === 429) return 'provider_rate_limited'
  if (typeof status === 'number' && status >= 500 && status <= 599) return 'provider_unavailable'
  return 'provider_internal_error'
}

const toProviderError = (status?: number, isNetworkError?: boolean) => {
  const error = new Error('provider_error')
  ;(error as Error & { cause?: ProviderErrorCause }).cause = {
    status,
    code: classifyProviderErrorCode(status, isNetworkError),
  }
  return error
}

const withTimeoutSignal = (signal?: AbortSignal) => {
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)

  const controller = new AbortController()
  const onAbort = () => controller.abort()

  signal?.addEventListener('abort', onAbort)
  timeoutController.signal.addEventListener('abort', onAbort)

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
      timeoutController.signal.removeEventListener('abort', onAbort)
    },
  }
}

const fetchWithRetry = async (url: string, init: RequestInit) => {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const { signal, cleanup } = withTimeoutSignal(init.signal)

    try {
      const response = await fetch(url, { ...init, signal })
      if (!response.ok && shouldRetry(response.status) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }

      return response
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === 'AbortError'
      const isNetworkError = error instanceof TypeError || isAbortError

      if (shouldRetry(undefined, isNetworkError) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }

      throw toProviderError(undefined, isNetworkError)
    } finally {
      cleanup()
    }
  }

  throw toProviderError(undefined, true)
}

export async function generateAnswer({ prompt, signal }: GenerateAnswerInput): Promise<ChatCompletion> {
  if (!prompt.trim()) {
    throw new Error('empty_prompt')
  }

  const { apiKey, baseUrl, model } = getClientConfig()

  const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'あなたはPDF内容に基づいて回答するアシスタントです。根拠がない場合は「PDFの内容からは判断できません」と答えてください。',
        },
        { role: 'user', content: prompt },
      ],
    }),
    signal,
  })

  if (!res.ok) {
    throw toProviderError(res.status)
  }

  const data = await res.json()
  return {
    content: data?.choices?.[0]?.message?.content ?? '',
    usage: data?.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  }
}

export async function streamAnswer(prompt: string, signal?: AbortSignal) {
  if (!prompt.trim()) {
    throw new Error('empty_prompt')
  }

  const { apiKey, baseUrl, model } = getClientConfig()
  const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        {
          role: 'system',
          content:
            'あなたはPDF内容に基づいて回答するアシスタントです。根拠がない場合は「PDFの内容からは判断できません」と答えてください。',
        },
        { role: 'user', content: prompt },
      ],
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    throw toProviderError(res.status)
  }

  return res.body
}
