import { NextRequest, NextResponse } from "next/server";
import {
  AssistantCredentials,
  processAssistantInput,
  recentWebhookEvents,
} from "@/lib/assistant-engine";

export async function GET() {
  return NextResponse.json({
    envStatus: {
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasGoogleOAuth: Boolean(
        process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_REFRESH_TOKEN
      ),
      hasWhatsAppConfig: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN &&
          process.env.WHATSAPP_PHONE_NUMBER_ID
      ),
    },
    recentWebhookEvents,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
      audioBase64,
      mimeType,
      isVoice,
      credentials,
    }: {
      text?: string;
      audioBase64?: string;
      mimeType?: string;
      isVoice?: boolean;
      credentials?: AssistantCredentials;
    } = body;

    const result = await processAssistantInput({
      text,
      audioBase64,
      mimeType,
      isVoice,
      credentials,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Assistant API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "İstek işlenirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
