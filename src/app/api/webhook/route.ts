import { NextRequest, NextResponse } from "next/server";
import {
  processAssistantInput,
  recentWebhookEvents,
} from "@/lib/assistant-engine";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken =
    process.env.WHATSAPP_VERIFY_TOKEN || "whatsapp_gizli_anahtar_2026";

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json(
    { error: "Webhook doğrulaması başarısız (Geçersiz verify_token)" },
    { status: 403 }
  );
}

async function fetchMetaAudioAsBase64(
  mediaId: string,
  accessToken: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(mediaId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();
    if (!metaData?.url) return null;

    const audioRes = await fetch(metaData.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!audioRes.ok) return null;

    const arrayBuffer = await audioRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return {
      base64,
      mimeType: metaData.mime_type || "audio/ogg",
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) {
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    const sender: string = msg.from;
    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    let text: string | undefined;
    let audioBase64: string | undefined;
    let mimeType: string | undefined;
    let isVoice = false;

    if (msg.type === "text" && msg.text?.body) {
      text = msg.text.body;
    } else if (msg.type === "audio" && msg.audio?.id && whatsappToken) {
      isVoice = true;
      const audioData = await fetchMetaAudioAsBase64(
        msg.audio.id,
        whatsappToken
      );
      if (audioData) {
        audioBase64 = audioData.base64;
        mimeType = audioData.mimeType;
      }
    }

    if (text || audioBase64) {
      const result = await processAssistantInput({
        text,
        audioBase64,
        mimeType,
        isVoice,
      });

      // Save to recentWebhookEvents so the web dashboard can display incoming items
      if (result.calendarEvent) {
        recentWebhookEvents.calendars.unshift(result.calendarEvent);
      }
      if (result.contact) {
        recentWebhookEvents.contacts.unshift(result.contact);
      }
      if (result.note) {
        recentWebhookEvents.notes.unshift(result.note);
      }

      if (whatsappToken && phoneNumberId && sender) {
        const prefix = isVoice ? "🎙️ *[Sesli Mesaj Çözümlendi]*\n\n" : "";
        await fetch(
          `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: sender,
              type: "text",
              text: { body: prefix + result.replyText },
            }),
          }
        );
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Meta Webhook işleme hatası:", error);
    // Always return 200 to prevent Meta from endlessly retrying
    return new Response("EVENT_HANDLED", { status: 200 });
  }
}
