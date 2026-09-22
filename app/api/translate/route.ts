import { NextRequest, NextResponse } from "next/server";
import { SarvamAIClient } from "sarvamai";

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLanguageCode, targetLanguageCode } = await req.json();

    if (!text || !sourceLanguageCode || !targetLanguageCode) {
      return NextResponse.json(
        { error: "text, sourceLanguageCode, and targetLanguageCode are required" },
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

    const response = await client.text.translate({
      input: text,
      source_language_code: sourceLanguageCode,
      target_language_code: targetLanguageCode,
    });

    return NextResponse.json(response);
  } /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  catch (error: any) {
    console.error("Translation API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to translate text" },
      { status: 500 }
    );
  }
}
