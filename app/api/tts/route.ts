import { NextRequest, NextResponse } from "next/server";
import { SarvamAIClient } from "sarvamai";

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguageCode } = await req.json();

    if (!text || !targetLanguageCode) {
      return NextResponse.json(
        { error: "text and targetLanguageCode are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Sarvam API Key is not configured" }, { status: 500 });
    }

    const client = new SarvamAIClient({
      apiSubscriptionKey: apiKey,
    });

    const response = await client.textToSpeech.convert({
      text: text,
      language_code: targetLanguageCode,
      speaker: "shubh",
      model: "bulbul:v3"
    });

    return NextResponse.json(response);
  } /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  catch (error: any) {
    console.error("TTS API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate audio" },
      { status: 500 }
    );
  }
}
