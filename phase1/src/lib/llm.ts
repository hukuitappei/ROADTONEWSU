export type ChatCompletion = {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export async function generateAnswer(prompt: string): Promise<ChatCompletion> {
  if (!prompt.trim()) {
    throw new Error('empty_prompt')
  }

  return {
    content: `質問を受け取りました: ${prompt}`,
    usage: {
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: 16,
      totalTokens: Math.ceil(prompt.length / 4) + 16,
    },
  }
}
