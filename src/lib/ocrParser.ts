export interface ParsedAssignment {
  title?: string
  dueDate?: string // ISO-like: YYYY-MM-DDTHH:mm
  description?: string
  externalLink?: string
}

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'

const SYSTEM_PROMPT = `You are an assignment information extractor.
Given a screenshot of a university assignment page (Korean or English), extract ONLY the following fields and return ONLY valid JSON (no markdown):
{
  "title": "과제 제목 (string or null)",
  "dueDate": "마감일시 ISO format YYYY-MM-DDTHH:mm (string or null). If a range is given, use the END date/time.",
  "description": "과제 설명/내용/주의사항 (string or null). Include submission instructions if present.",
  "externalLink": "외부 링크/URL if any (string or null)"
}

Rules:
- Always use the submission DEADLINE (end of a range), not the start.
- Combine multi-line descriptions into a single string with newlines.
- If a field cannot be found, set it to null.`

function getApiKey(): string | undefined {
  // Vite browser build
  const viteKey = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_GEMINI_API_KEY
  if (typeof viteKey === 'string' && viteKey.trim()) return viteKey

  // Node/CLI tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (globalThis as any)?.process
  const envKey = proc?.env?.VITE_GEMINI_API_KEY
  if (typeof envKey === 'string' && envKey.trim()) return envKey

  return undefined
}

async function fileToBase64(file: File): Promise<string> {
  // Browser path
  if (typeof FileReader !== 'undefined') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1] ?? '')
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Node path (for local debug)
  const nodeBuffer = (globalThis as unknown as { Buffer?: unknown }).Buffer as
    | { from: (input: ArrayBuffer) => { toString: (encoding: string) => string } }
    | undefined
  if (nodeBuffer && file.arrayBuffer) {
    const buf = nodeBuffer.from(await file.arrayBuffer())
    return buf.toString('base64')
  }

  throw new Error('Cannot convert file to base64 in this runtime')
}

function cleanModelText(text: string) {
  return text
    .replace(/```json\s*/g, '')
    .replace(/```/g, '')
    .trim()
}

export async function scanScreenshot(file: File): Promise<ParsedAssignment> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured')
  }

  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'image/png'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const debugEnabled =
    Boolean((globalThis as unknown as { __DEBUG_OCR?: boolean }).__DEBUG_OCR) ||
    Boolean((globalThis as unknown as { process?: { env?: { DEBUG_OCR?: unknown } } }).process?.env
      ?.DEBUG_OCR)

  const body = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errText}`)
  }

  const json = await response.json()
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const cleaned = cleanModelText(text)

  if (debugEnabled) {
    // Avoid logging payload (includes image base64 + API key in URL).
    // Safe to print only the model text section.
    // eslint-disable-next-line no-console
    console.log('===== GEMINI RAW TEXT =====')
    // eslint-disable-next-line no-console
    console.log(text)
    // eslint-disable-next-line no-console
    console.log('===== GEMINI CLEANED JSON =====')
    // eslint-disable-next-line no-console
    console.log(cleaned)
  }

  const parsed = JSON.parse(cleaned) as Record<string, unknown>

  const result: ParsedAssignment = {}

  if (typeof parsed.title === 'string' && parsed.title.trim()) {
    result.title = parsed.title.trim()
  }
  if (typeof parsed.dueDate === 'string' && parsed.dueDate.trim()) {
    // Keep as-is (caller will map into date+time parts)
    result.dueDate = parsed.dueDate.trim()
  }
  if (typeof parsed.description === 'string' && parsed.description.trim()) {
    result.description = parsed.description.trim()
  }
  if (typeof parsed.externalLink === 'string' && parsed.externalLink.trim()) {
    result.externalLink = parsed.externalLink.trim()
  }

  return result
}
