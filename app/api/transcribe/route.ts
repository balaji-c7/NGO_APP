import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      console.error("SARVAM_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "Server configuration error: API key is missing" },
        { status: 500 }
      );
    }

    const languageCode = formData.get("languageCode") as string | null;

    // Create a new FormData object matching the Sarvam AI specifications
    const sarvamFormData = new FormData();
    sarvamFormData.append("file", file);
    sarvamFormData.append("model", "saaras:v3");
    sarvamFormData.append("mode", "transcribe");
    if (languageCode) {
      sarvamFormData.append("language_code", languageCode);
    }

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
      },
      body: sarvamFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sarvam API Error Response:", errorText);
      return NextResponse.json(
        { error: "Failed to transcribe audio from Sarvam API", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  catch (error: any) {
    console.error("Sarvam API Exception:", error.message || error);
    
    return NextResponse.json(
      { 
        error: "Failed to transcribe audio", 
        details: error.response?.data || error.message 
      },
      { status: error.response?.status || 500 }
    );
  }
}
