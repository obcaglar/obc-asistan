import { NextRequest, NextResponse } from "next/server";
import {
  AssistantCredentials,
  processAssistantInput,
  recentWebhookEvents,
  fetchLiveWorkspaceSnapshot,
  activeWhatsAppCall,
  callTerminatedAt,
  pendingWhatsAppNotifications,
  queueWhatsAppNotification,
  triggerIncomingWhatsAppCall,
  acknowledgeWhatsAppCall,
  terminateWhatsAppCall,
  resolveGoogleAccessToken,
} from "@/lib/assistant-engine";

// Deduplication cache to prevent duplicate WhatsApp bot replies within 15 seconds
const recentBotRequests = new Map<string, number>();

export async function GET(request: NextRequest) {
  const wantLive = request.nextUrl.searchParams.get("live") === "1";
  const consumeNotifs =
    request.nextUrl.searchParams.get("consume_notifications") === "1";

  if (consumeNotifs) {
    const items = pendingWhatsAppNotifications.splice(
      0,
      pendingWhatsAppNotifications.length
    );
    return NextResponse.json({
      ok: true,
      notifications: items,
      activeWhatsAppCall,
      callTerminatedAt,
    });
  }

  let liveWorkspace = null;

  if (
    wantLive ||
    (recentWebhookEvents.calendars.length === 0 &&
      recentWebhookEvents.contacts.length === 0)
  ) {
    liveWorkspace = await fetchLiveWorkspaceSnapshot(wantLive);
  }

  const hasToken = Boolean(
    process.env.GOOGLE_REFRESH_TOKEN || (await resolveGoogleAccessToken({}))
  );

  const now = Date.now();
  const currentCall =
    activeWhatsAppCall &&
    now - activeWhatsAppCall.timestamp < 45000 &&
    !activeWhatsAppCall.answeredByWeb
      ? activeWhatsAppCall
      : null;

  return NextResponse.json({
    envStatus: {
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasGoogleOAuth: hasToken,
      hasWhatsAppConfig: true,
    },
    recentWebhookEvents,
    liveWorkspace,
    activeWhatsAppCall: currentCall,
    callTerminatedAt,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Handle incoming WhatsApp voice call signal from bot-baileys.js
    if (body.action === "incoming_call") {
      const callState = triggerIncomingWhatsAppCall(
        body.callId || "call-" + Date.now(),
        body.callerJid || "+905491007729"
      );
      return NextResponse.json({ ok: true, activeWhatsAppCall: callState });
    }

    // 2. Handle call acknowledgement from Web/Mobile client
    if (body.action === "ack_call") {
      acknowledgeWhatsAppCall(body.callId);
      return NextResponse.json({ ok: true });
    }

    // 3. Handle remote/voice/button call termination ("end_call") so ALL open tabs/windows stop listening immediately
    if (body.action === "end_call") {
      const terminatedTs = terminateWhatsAppCall();
      if (body.notifyWhatsApp) {
        queueWhatsAppNotification(
          `🛑 *Sesli Arama ve Asistan Dinleme Modu Kapatıldı.*\n\n_Görüşme sonlandırıldı Onur Bey._`
        );
      }
      return NextResponse.json({ ok: true, callTerminatedAt: terminatedTs });
    }

    const {
      text,
      audioBase64,
      mimeType,
      isVoice,
      credentials,
      fromWhatsAppBot,
      fromLiveCall,
      senderName,
      senderPhone,
      isExternalCaller,
    }: {
      text?: string;
      audioBase64?: string;
      mimeType?: string;
      isVoice?: boolean;
      credentials?: AssistantCredentials;
      fromWhatsAppBot?: boolean;
      fromLiveCall?: boolean;
      senderName?: string;
      senderPhone?: string;
      isExternalCaller?: boolean;
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
      senderName,
      senderPhone,
      isExternalCaller,
    });

    // If a real command or hangup was executed during a Live Voice Call, also queue its confirmation card for the user's WhatsApp chat!
    if (
      fromLiveCall &&
      !fromWhatsAppBot &&
      !result.duplicate &&
      result.replyText &&
      (result.intent !== "help" || result.endCall)
    ) {
      queueWhatsAppNotification(result.replyText);
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
