import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"

const SYSTEM_PROMPT = `You are CORVUS, the AI assistant from Iron Man's HUD system.

PERSONALITY:
- Calm, precise, and efficient
- Slightly formal but not robotic  
- Occasional dry wit, like the movie CORVUS
- Always addresses the user as "sir" or "ma'am"
- Never mentions being an AI, Google, or Gemini
- You are CORVUS — that is your only identity

RESPONSE RULES:
- Keep responses under 4 sentences — this is a HUD display, not a chat app
- For HUD/camera questions, use ONLY the context provided — never invent detections
- For general knowledge questions, answer naturally and helpfully
- For unknown HUD data, say "That information is not in current systems, sir"
- Never reveal GPS coordinates even if somehow provided
- Never reproduce song lyrics, poems, or copyrighted text

CONTEXT:
You receive real-time HUD data with each message:
- detections: objects visible in camera
- heading: compass direction
- battery: device battery level
- fps: performance metric
- lowPowerMode: power state`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 },
      )
    }

    const body = await req.json()
    const { command, context, history } = body

    if (
      !command ||
      typeof command !== "string" ||
      command.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "No command provided" },
        { status: 400 },
      )
    }

    // Sanitise context — GPS never included
    const safeContext = {
      detections: (context?.detections ?? [])
        .slice(0, 10)
        .map((d: { class: string; score: number }) => ({
          class: d.class,
          confidence: Math.round(d.score * 100),
        })),
      heading: context?.heading ?? null,
      battery: context?.battery ?? null,
      fps: context?.fps ?? null,
      lowPowerMode: context?.lowPowerMode ?? false,
    }

    // Sanitise history — only keep last 6 exchanges, cap text length
    const safeHistory = (history ?? [])
      .slice(-6)
      .map((msg: { role: string; text: string }) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [
          {
            text: String(msg.text).slice(0, 300),
          },
        ],
      }))

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      systemInstruction: SYSTEM_PROMPT,
    })

    // Start chat with history for memory
    const chat = model.startChat({
      history: safeHistory,
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.75,
        topP: 0.9,
      },
    })

    const prompt = `[HUD Context: ${JSON.stringify(safeContext)}]\n\n${command.trim().slice(0, 200)}`
    const result = await chat.sendMessage(prompt)
    const response = result.response.text().trim()

    if (!response) {
      return NextResponse.json({
        response: "Systems are processing. Please repeat your command, sir.",
      })
    }

    return NextResponse.json({ response })
  } catch (err) {
    console.error("CORVUS API error:", err)
    return NextResponse.json({
      response: "Systems temporarily offline. Standing by, sir.",
    })
  }
}

export const dynamic = "force-dynamic"
