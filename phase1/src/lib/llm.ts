const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

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

const getClientConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL

  if (!apiKey) {
    throw new Error('missing_openai_api_key')
  }

  return { apiKey, baseUrl, model }
}

export async function generateAnswer({ prompt, signal }: GenerateAnswerInput): Promise<ChatCompletion> {
  if (!prompt.trim()) {
    throw new Error('empty_prompt')
  }

  const { apiKey, baseUrl, model } = getClientConfig()

  const res = await fetch(`${baseUrl}/chat/completions`, {
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
    const error = new Error('provider_error')
    ;(error as Error & { cause?: unknown }).cause = { status: res.status }
    throw error
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
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
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
    const error = new Error('provider_error')
    ;(error as Error & { cause?: unknown }).cause = { status: res.status }
    throw error
  }

  return res.body
}
