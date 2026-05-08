export type ModelPricing = {
  inputPer1M: number
  outputPer1M: number
}

export const MODEL_PRICING_USD_PER_1M: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4o': { inputPer1M: 5, outputPer1M: 15 },
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
  'gpt-4.1': { inputPer1M: 2, outputPer1M: 8 },
}

export type CostEstimateInput = {
  model: string
  promptTokens: number
  completionTokens: number
}

/**
 * 未定義モデルは安全側で 0 扱いせず、誤った請求表示を防ぐため Error を投げる。
 */
export const estimateCost = ({ model, promptTokens, completionTokens }: CostEstimateInput): number => {
  const pricing = MODEL_PRICING_USD_PER_1M[model]
  if (!pricing) {
    throw new Error(`unknown_model_pricing:${model}`)
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M
  return inputCost + outputCost
}
