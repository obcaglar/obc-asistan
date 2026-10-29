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
      fromWhatsAppBot,
    }: {
      text?: string;
      audioBase64?: string;
      mimeType?: string;
      isVoice?: boolean;
      credentials?: AssistantCredentials;
      fromWhatsAppBot?: boolean;
    } = body;

    const result = await processAssistantInput({
      text,
      audioBase64,
      mimeType,
      isVoice,
      credentials,
    });

    if (fromWhatsAppBot) {
      if (result.calendarEvent) {
        recentWebhookEvents.calendars.unshift(result.calendarEvent);
      }
      if (result.contact) {
        recentWebhookEvents.contacts.unshift(result.contact);
      }
      if (result.note) {
        recentWebhookEvents.notes.unshift(result.note);
      }
    }

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
