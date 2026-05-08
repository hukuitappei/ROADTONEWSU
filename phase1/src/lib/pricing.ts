export type ModelPricing = {
  inputPer1k: number
  outputPer1k: number
}

export const MODEL_PRICING_USD_PER_1K: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015 },
  'gpt-4.1-mini': { inputPer1k: 0.0004, outputPer1k: 0.0016 },
  'gpt-4.1': { inputPer1k: 0.002, outputPer1k: 0.008 },
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
  const pricing = MODEL_PRICING_USD_PER_1K[model]
  if (!pricing) {
    throw new Error(`unknown_model_pricing:${model}`)
  }

  const inputCost = (promptTokens / 1000) * pricing.inputPer1k
  const outputCost = (completionTokens / 1000) * pricing.outputPer1k
  return inputCost + outputCost
}
