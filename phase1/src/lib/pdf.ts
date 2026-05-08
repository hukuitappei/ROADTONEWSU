import pdfParse from 'pdf-parse'

export const PHASE1_PDF_PAGE_LIMIT = 30
export const PHASE1_PDF_CHAR_LIMIT = 80000

export const PHASE1_QA_LIMIT_MESSAGE = 'このPDFはPhase 1のQ&A上限を超えています。要約のみ対応します。'

export type ExtractedPdf = {
  text: string
  pageCount: number
}

export const extractPdfText = async (file: File): Promise<ExtractedPdf> => {
  const buffer = Buffer.from(await file.arrayBuffer())
  const data = await pdfParse(buffer)
  return {
    text: data.text,
    pageCount: data.numpages,
  }
}

export const isPdfWithinQaLimit = (pageCount: number, charCount: number) =>
  pageCount <= PHASE1_PDF_PAGE_LIMIT && charCount <= PHASE1_PDF_CHAR_LIMIT
