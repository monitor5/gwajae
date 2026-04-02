export interface ParsedAssignment {
  title?: string
  dueDate?: string
  description?: string
  externalLink?: string
}

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'

const SYSTEM_PROMPT = `You are an assignment information extractor. Given a screenshot of a university assignment page (Korean or English), extract the following fields and return ONLY valid JSON:

{
  "title": "과제 제목 (string or null)",
  "dueDate": "마감일시 ISO format YYYY-MM-DDTHH:mm (string or null). Use the END date if a range is given.",
  "description": "과제 설명/내용/주의사항 (string or null). Include submission instructions if present.",
  "externalLink": "외부 링크/URL if any (string or null)"
}

Rules:
- Return ONLY the JSON object, no markdown fences, no explanation.
- For dueDate, always use the submission DEADLINE (end date), not the start date.
- Combine multi-line descriptions into a single string with newlines.
- If a field cannot be found, set it to null.`

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function scanScreenshot(file: File): Promise<ParsedAssignment> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured')
  }

  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'image/png'

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

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

  const text: string =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  const cleaned = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()

  const parsed = JSON.parse(cleaned) as Record<string, unknown>

  const result: ParsedAssignment = {}

  if (typeof parsed.title === 'string' && parsed.title) {
    result.title = parsed.title
  }
  if (typeof parsed.dueDate === 'string' && parsed.dueDate) {
    result.dueDate = parsed.dueDate
  }
  if (typeof parsed.description === 'string' && parsed.description) {
    result.description = parsed.description
  }
  if (typeof parsed.externalLink === 'string' && parsed.externalLink) {
    result.externalLink = parsed.externalLink
  }

  return result
}
