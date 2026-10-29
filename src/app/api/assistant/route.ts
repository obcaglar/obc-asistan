import { NextRequest, NextResponse } from "next/server";
import {
  AssistantCredentials,
  processAssistantInput,
  recentWebhookEvents,
} from "@/lib/assistant-engine";

// Deduplication cache to prevent duplicate WhatsApp bot replies within 15 seconds
const recentBotRequests = new Map<string, number>();

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

    if (fromWhatsAppBot) {
      const now = Date.now();
      for (const [k, ts] of recentBotRequests.entries()) {
        if (now - ts > 15000) recentBotRequests.delete(k);
      }
      const sig = audioBase64
        ? `audio:${audioBase64.slice(0, 160)}:${audioBase64.length}`
        : `text:${(text || "").trim().toLocaleLowerCase("tr-TR")}`;
      const lastTs = recentBotRequests.get(sig);
      if (lastTs && now - lastTs < 15000) {
        return NextResponse.json({
          duplicate: true,
          replyText: "",
        });
      }
      recentBotRequests.set(sig, now);
    }

    const result = await processAssistantInput({
      text,
      audioBase64,
      mimeType,
      isVoice,
      credentials,
    });

    if (fromWhatsAppBot && !result.duplicate) {
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
