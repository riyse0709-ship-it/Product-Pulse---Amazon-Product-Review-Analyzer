import { GoogleGenAI } from '@google/genai'
import type { Config } from '@netlify/functions'

const SYSTEM_PROMPT = `You are ProductPulse — an AI-powered Consumer Intelligence Engine.
Analyze up to 50 Amazon reviews (or a product URL) and generate a high-fidelity intelligence report.

If only a URL is provided, try to identify the product from the URL segments and provide a theoretical consensus based on your internal knowledge of that product's general reception, but lower the Confidence Score to reflect this.

==================================================
MANDATORY OUTPUT FORMAT (USE THIS EXACT STRUCTURE)
==================================================
─────────────────────────────────────
PRODUCTPULSE // INTELLIGENCE REPORT
Product: [Full product name]
ASIN: [ASIN]
Price: [Price]
Reviews Analyzed: [Count]
Generated: [Date]
─────────────────────────────────────

Sentiment: [Very Positive / Positive / Mixed / Polarized / Negative]
Consensus Strength: [Strong / Moderate / Weak]
Confidence Score: [0-100] (CRITICAL: MUST INCLUDE THIS LINE)

👍 XX% [Praise]
⚠️ XX% [Warning]
😐 XX% [Issue]
❌ XX% [Failure]

🛒 XX% recommend | [Buy / Mixed / Avoid]

🧠 Emotional Core: "[Theme]"
   → [Explanation]

📦 Logistics Issues: [Ignore / Minor / Significant]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUYER TRUTH (5-LINE SIGNAL STACK)
① [Finding 1]
② [Finding 2]
③ [Finding 3]
④ [Finding 4]
⑤ [Finding 5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINAL VERDICT: [Verdict] — [Reason]

STRICT: Use compact, factual, noun-heavy phrasing. Zero hallucination regarding specific buyer stories unless repeated in reviews.`

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let reviews: string
  try {
    const body = await req.json()
    reviews = body.reviews
    if (!reviews || typeof reviews !== 'string') {
      return Response.json({ error: 'Missing reviews field' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ai = new GoogleGenAI({})

  const isUrl = reviews.trim().split('\n').length === 1 && /^https?:\/\//.test(reviews.trim())
  const promptSuffix = isUrl
    ? '\n\n(Note: A URL was provided. Please infer the product details and general consensus from your internal knowledge base if direct review text is missing.)'
    : ''

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze these reviews and provide the ProductPulse Intelligence Report:\n\n${reviews}${promptSuffix}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
    },
  })

  return Response.json({ text: response.text })
}

export const config: Config = {
  path: '/api/analyze',
}
