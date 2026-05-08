import pdfParse from 'pdf-parse'

export const PHASE1_PDF_PAGE_LIMIT = 30
export const PHASE1_PDF_CHAR_LIMIT = 80000

export const PHASE1_QA_LIMIT_MESSAGE = 'このPDFはPhase 1のQ&A上限を超えています。要約のみ対応します。'

export type ExtractedPdf = {
  text: string
  pageCount: number
  pages: Array<{ pageNumber: number; start: number; end: number }>
}

export const extractPdfText = async (file: File): Promise<ExtractedPdf> => {
  const buffer = Buffer.from(await file.arrayBuffer())
  let fullText = ''
  const pages: Array<{ pageNumber: number; start: number; end: number }> = []
  const data = await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent()
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim()
      const normalizedPageText = pageText ? `${pageText}\n\n` : ''
      const start = fullText.length
      fullText += normalizedPageText
      const end = fullText.length
      pages.push({ pageNumber: pageData.pageIndex + 1, start, end })
      return normalizedPageText
    },
  })

  const text = data.text || fullText
  return {
    text,
    pageCount: data.numpages,
    pages,
  }
}

export const isPdfWithinQaLimit = (pageCount: number, charCount: number) =>
  pageCount <= PHASE1_PDF_PAGE_LIMIT && charCount <= PHASE1_PDF_CHAR_LIMIT
