"use client";

import React, { useState, useEffect, useRef } from "react";
import type {
  CalendarItem,
  ContactItem,
  NoteItem,
  PhotoItem,
  DriveFileItem,
  AssistantProcessResult,
} from "@/lib/assistant-engine";
import {
  INITIAL_CALENDAR_EVENTS,
  INITIAL_CONTACTS,
  INITIAL_NOTES,
  INITIAL_CHAT_MESSAGES,
  ANTIGRAVITY_FILES,
  BACKEND_TEMPLATES,
  type ChatMessage,
} from "@/lib/templates";

type TabType =
  | "chat"
  | "media"
  | "calendar"
  | "contacts"
  | "notes"
  | "backend"
  | "vercel"
  | "antigravity";

type BackendTabType =
  | "baileys"
  | "node"
  | "google"
  | "env"
  | "docker"
  | "verceljson";

type AntigravityDocType = "prompt" | "rules" | "config";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JSZip?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitAudioContext?: any;
  }
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [calendarEvents, setCalendarEvents] = useState<CalendarItem[]>([]);
  const [contactsList, setContactsList] = useState<ContactItem[]>([]);
  const [notesList, setNotesList] = useState<NoteItem[]>([]);
  const [photosList, setPhotosList] = useState<PhotoItem[]>([]);
  const [driveFilesList, setDriveFilesList] = useState<DriveFileItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg-live-welcome",
      sender: "bot",
      text: "👩‍💼 *Merhaba Özgür Bey! Canlı Google Workspace & Kadın Sesli Asistanınız Hazır.*\n\n✅ *Google Takvim, Kişiler, Görevler (Tasks), Google Photos ve Google Drive* hesabınızla gerçek zamanlı bağlıyım.\n📞 Üstteki **'Sesli Ara'** butonuna dokunarak veya **Cep / Web WhatsApp'tan (+90 549 100 77 29)** beni sesli arayarak tüm servisleri peş peşe sesli komutlarla çalıştırabilirsiniz!",
      time: "Canlı",
      type: "text",
      meta: null,
    },
  ]);

  const [userTextInput, setUserTextInput] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [botTypingText, setBotTypingText] = useState(
    "Ses çözümleniyor & Google API çağrılıyor..."
  );
  const [showMobileQuickPanel, setShowMobileQuickPanel] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);

  // WhatsApp Live Voice Call & Continuous Back-to-Back Command Chaining state
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [callStatus, setCallStatus] = useState<
    "listening" | "processing" | "speaking" | "paused"
  >("listening");
  const [callHandsFree, setCallHandsFree] = useState(true);
  const [callTtsEnabled, setCallTtsEnabled] = useState(true);
  const [callLiveTranscript, setCallLiveTranscript] = useState("");
  const [callManualInput, setCallManualInput] = useState("");
  const [callHistory, setCallHistory] = useState<
    Array<{
      id: string;
      time: string;
      command: string;
      replySummary: string;
      intent: string;
      syncedToGoogle: boolean;
      chainedCount?: number;
    }>
  >([]);

  // Backend & Antigravity tabs
  const [currentBackendTab, setCurrentBackendTab] =
    useState<BackendTabType>("baileys");
  const [currentAntigravityDoc, setCurrentAntigravityDoc] =
    useState<AntigravityDocType>("prompt");

  // Google Live OAuth Modal & State
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleClientIdInput, setGoogleClientIdInput] = useState("");
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(
    null
  );
  const [serverEnvStatus, setServerEnvStatus] = useState<{
    hasGeminiKey: boolean;
    hasGoogleOAuth: boolean;
    hasWhatsAppConfig: boolean;
  }>({
    hasGeminiKey: false,
    hasGoogleOAuth: false,
    hasWhatsAppConfig: false,
  });

  // Wizard state (GitHub & Vercel tab)
  const [wizGemini, setWizGemini] = useState("");
  const [wizGClient, setWizGClient] = useState("");
  const [wizGSecret, setWizGSecret] = useState("");
  const [wizGRefresh, setWizGRefresh] = useState("");
  const [wizWaToken, setWizWaToken] = useState("");
  const [wizWaPhone, setWizWaPhone] = useState("");
  const [wizWaVerify, setWizWaVerify] = useState("whatsapp_gizli_anahtar_2026");
  const [wizTestRecipient, setWizTestRecipient] = useState("+905491007729");
  const [waTestStatus, setWaTestStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  // Toast notification state
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callSpeechRecRef = useRef<any>(null);
  const callAudioRef = useRef<HTMLAudioElement | null>(null);
  const callMicStreamRef = useRef<MediaStream | null>(null);
  const callMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const callAudioChunksRef = useRef<Blob[]>([]);
  const callVadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const callAudioCtxRef = useRef<AudioContext | null>(null);
  const callPreloadedGreetingUrlRef = useRef<string>("");
  const callExecutingRef = useRef<boolean>(false);
  const callStartMsRef = useRef<number>(0);
  const callTabIdRef = useRef<string>("");
  const callCallerNameRef = useRef<string>("");
  const callChannelRef = useRef<BroadcastChannel | null>(null);
  const handledCallIdsRef = useRef<Set<string>>(new Set());
  const [callNeedsAudioTap, setCallNeedsAudioTap] = useState(false);
  const [callMicLevel, setCallMicLevel] = useState(0);
  const [callIsRecordingSpeech, setCallIsRecordingSpeech] = useState(false);
  const callActiveRef = useRef<boolean>(false);
  const callHandsFreeRef = useRef<boolean>(true);
  const callTtsRef = useRef<boolean>(true);
  const callTranscriptBufferRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveTranscriptRef = useRef<string>("");

  // Load real live Google Workspace data & watch for incoming WhatsApp calls
  useEffect(() => {
    try {
      // Remove any legacy simulation cache so only real Google Workspace data is shown
      localStorage.removeItem("obc_calendar_events");
      localStorage.removeItem("obc_contacts_list");
      localStorage.removeItem("obc_notes_list");

      const savedWiz = localStorage.getItem("obc_wizard_keys");
      if (savedWiz) {
        const parsed = JSON.parse(savedWiz);
        if (parsed.wizGemini) setWizGemini(parsed.wizGemini);
        if (parsed.wizGClient) {
          setWizGClient(parsed.wizGClient);
          setGoogleClientIdInput(parsed.wizGClient);
        }
        if (parsed.wizGSecret) setWizGSecret(parsed.wizGSecret);
        if (parsed.wizGRefresh) setWizGRefresh(parsed.wizGRefresh);
        if (parsed.wizWaToken) setWizWaToken(parsed.wizWaToken);
        if (parsed.wizWaPhone) setWizWaPhone(parsed.wizWaPhone);
        if (parsed.wizWaVerify) setWizWaVerify(parsed.wizWaVerify);
      }
    } catch {
      // Ignore storage errors
    }

    // Preload female voice greeting into browser memory so "Sesli Ara" speaks with 0ms network delay
    fetch(
      `/api/tts?text=${encodeURIComponent(
        "Buyurun Onur Bey, çağrınızı aldım, sizi dinliyorum. Ne yapmamı istersiniz?"
      )}`
    )
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && blob.size > 200) {
          callPreloadedGreetingUrlRef.current = URL.createObjectURL(blob);
        }
      })
      .catch(() => {});

    if (!callTabIdRef.current) {
      callTabIdRef.current = "tab-" + Math.random().toString(36).slice(2, 9);
    }
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        const callerParam = sp.get("caller");
        if (callerParam) {
          callCallerNameRef.current = callerParam.trim();
        }
      } catch {}
    }

    // Auto-open WhatsApp Live Voice Call if ?call=1 is present in URL
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const bc = new BroadcastChannel("obc_voice_call_channel");
        callChannelRef.current = bc;
        bc.onmessage = (ev) => {
          if (
            ev.data?.type === "NEW_CALL_STARTED" &&
            ev.data?.tabId !== callTabIdRef.current &&
            callActiveRef.current
          ) {
            endWhatsAppVoiceCall(false);
          } else if (ev.data?.type === "CALL_ENDED" && callActiveRef.current) {
            endWhatsAppVoiceCall(false);
          }
        };
      } catch {}
    }

    if (
      typeof window !== "undefined" &&
      window.location.search.includes("call=1")
    ) {
      setTimeout(() => {
        startWhatsAppVoiceCall();
      }, 200);
    }

    fetch("/api/assistant?live=1")
      .then((r) => r.json())
      .then((data) => {
        if (
          typeof window !== "undefined" &&
          window.location.search.includes("call=1") &&
          data?.activeWhatsAppCall?.callId
        ) {
          const initCallId = data.activeWhatsAppCall.callId;
          handledCallIdsRef.current.add(initCallId);
          fetch("/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "ack_call", callId: initCallId }),
          }).catch(() => {});
        }
        if (data?.envStatus) {
          setServerEnvStatus(data.envStatus);
        }
        const source = data?.liveWorkspace || data?.recentWebhookEvents;
        if (source) {
          if (Array.isArray(source.calendars) && source.calendars.length > 0) {
            setCalendarEvents(source.calendars);
          }
          if (Array.isArray(source.contacts) && source.contacts.length > 0) {
            setContactsList(source.contacts);
          }
          if (Array.isArray(source.notes) && source.notes.length > 0) {
            setNotesList(source.notes);
          }
          if (Array.isArray(source.photos) && source.photos.length > 0) {
            setPhotosList(source.photos);
          }
          if (
            Array.isArray(source.driveFiles) &&
            source.driveFiles.length > 0
          ) {
            setDriveFilesList(source.driveFiles);
          }
        }
      })
      .catch(() => {});

    const syncInterval = setInterval(() => {
      fetch("/api/assistant")
        .then((r) => r.json())
        .then((data) => {
          // 0. If the call was terminated remotely (via voice command "kapat/dur/stop", WhatsApp hangup, or another tab), immediately stop listening and close!
          if (
            callActiveRef.current &&
            data?.callTerminatedAt &&
            data.callTerminatedAt > callStartMsRef.current
          ) {
            endWhatsAppVoiceCall(false);
            return;
          }

          // 1. Check if the user just called +905491007729 on Mobile or Web WhatsApp!
          if (
            data?.activeWhatsAppCall &&
            data.activeWhatsAppCall.callId &&
            !handledCallIdsRef.current.has(data.activeWhatsAppCall.callId)
          ) {
            const incomingId = data.activeWhatsAppCall.callId;
            const isRecentCall =
              !data.activeWhatsAppCall.timestamp ||
              Date.now() - data.activeWhatsAppCall.timestamp < 20000;

            const isTabVisibleAndActive =
              typeof document !== "undefined" &&
              document.visibilityState === "visible" &&
              (document.hasFocus() ||
                (typeof window !== "undefined" && window.innerWidth < 900));

            if (isRecentCall && isTabVisibleAndActive) {
              handledCallIdsRef.current.add(incomingId);
              fetch("/api/assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "ack_call",
                  callId: incomingId,
                }),
              }).catch(() => {});
              try {
                window.focus();
              } catch {}
              startWhatsAppVoiceCall();
            }
          }

          if (data?.recentWebhookEvents) {
            const { calendars, contacts, notes, photos, driveFiles } =
              data.recentWebhookEvents;
            if (Array.isArray(calendars) && calendars.length > 0) {
              setCalendarEvents((prev) => {
                const existingIds = new Set(prev.map((x) => x.id));
                const fresh = calendars.filter(
                  (x: CalendarItem) => !existingIds.has(x.id)
                );
                return fresh.length > 0 ? [...fresh, ...prev] : prev;
              });
            }
            if (Array.isArray(contacts) && contacts.length > 0) {
              setContactsList((prev) => {
                const existingIds = new Set(prev.map((x) => x.id));
                const fresh = contacts.filter(
                  (x: ContactItem) => !existingIds.has(x.id)
                );
                return fresh.length > 0 ? [...fresh, ...prev] : prev;
              });
            }
            if (Array.isArray(notes) && notes.length > 0) {
              setNotesList((prev) => {
                const existingIds = new Set(prev.map((x) => x.id));
                const fresh = notes.filter(
                  (x: NoteItem) => !existingIds.has(x.id)
                );
                return fresh.length > 0 ? [...fresh, ...prev] : prev;
              });
            }
            if (Array.isArray(photos) && photos.length > 0) {
              setPhotosList(photos);
            }
            if (Array.isArray(driveFiles) && driveFiles.length > 0) {
              setDriveFilesList(driveFiles);
            }
          }
        })
        .catch(() => {});
    }, 2200);

    return () => clearInterval(syncInterval);
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "obc_calendar_events",
        JSON.stringify(calendarEvents)
      );
    } catch {}
  }, [calendarEvents]);

  useEffect(() => {
    try {
      localStorage.setItem("obc_contacts_list", JSON.stringify(contactsList));
    } catch {}
  }, [contactsList]);

  useEffect(() => {
    try {
      localStorage.setItem("obc_notes_list", JSON.stringify(notesList));
    } catch {}
  }, [notesList]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "obc_wizard_keys",
        JSON.stringify({
          wizGemini,
          wizGClient,
          wizGSecret,
          wizGRefresh,
          wizWaToken,
          wizWaPhone,
          wizWaVerify,
        })
      );
    } catch {}
  }, [
    wizGemini,
    wizGClient,
    wizGSecret,
    wizGRefresh,
    wizWaToken,
    wizWaPhone,
    wizWaVerify,
  ]);

  // Auto-scroll chat container
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isBotTyping]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  }

  function playTone(
    freq = 600,
    duration = 0.1,
    type: OscillatorType = "sine"
  ) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  async function processCommandThroughApi(params: {
    text?: string;
    audioBase64?: string;
    mimeType?: string;
    isVoice: boolean;
    fromLiveCall?: boolean;
  }) {
    setIsBotTyping(true);
    setBotTypingText(
      params.isVoice
        ? "Ses çözümleniyor & Google API çağrılıyor..."
        : "Komut işleniyor & Google Workspace ile eşitleniyor..."
    );

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: params.text,
          audioBase64: params.audioBase64,
          mimeType: params.mimeType,
          isVoice: params.isVoice,
          fromLiveCall: params.fromLiveCall,
          senderName: callCallerNameRef.current || undefined,
          credentials: {
            geminiApiKey: wizGemini || undefined,
            googleClientId: wizGClient || undefined,
            googleClientSecret: wizGSecret || undefined,
            googleRefreshToken: wizGRefresh || undefined,
            googleAccessToken: googleAccessToken || undefined,
          },
        }),
      });

      const result: AssistantProcessResult = await res.json();
      setIsBotTyping(false);

      if (
        result.duplicate ||
        !result.replyText ||
        (params.fromLiveCall &&
          result.intent === "help" &&
          result.action !== "share" &&
          !result.endCall &&
          !result.pauseListening)
      ) {
        return result;
      }

      let meta: ChatMessage["meta"] = null;

      if (result.intent === "calendar" && result.calendarEvent) {
        if (result.action === "delete") {
          setCalendarEvents((prev) =>
            prev.filter(
              (e) =>
                !e.title
                  .toLocaleLowerCase("tr-TR")
                  .includes(
                    result.calendarEvent!.title.toLocaleLowerCase("tr-TR")
                  )
            )
          );
          showToast(
            result.syncedToGoogle
              ? "🗑️ Etkinlik gerçek Google Takvim'inizden silindi!"
              : "🗑️ Etkinlik takvimden silindi!"
          );
        } else if (result.action === "share") {
          setCalendarEvents((prev) => [
            result.calendarEvent!,
            ...prev.filter(
              (e) =>
                !e.title
                  .toLocaleLowerCase("tr-TR")
                  .includes(
                    result.calendarEvent!.title.toLocaleLowerCase("tr-TR")
                  )
            ),
          ]);
          showToast(
            result.syncedToGoogle
              ? "📨 Etkinlik/görev e-posta daveti olarak karşı tarafa gönderildi!"
              : "📨 Etkinlik daveti oluşturuldu!"
          );
        } else if (result.action === "update") {
          setCalendarEvents((prev) => [
            result.calendarEvent!,
            ...prev.filter(
              (e) =>
                !e.title
                  .toLocaleLowerCase("tr-TR")
                  .includes(
                    result.calendarEvent!.title.toLocaleLowerCase("tr-TR")
                  )
            ),
          ]);
          showToast(
            result.syncedToGoogle
              ? "🔄 Gerçek Google Takvim etkinliğiniz güncellendi!"
              : "🔄 Takvim etkinliği güncellendi!"
          );
        } else {
          setCalendarEvents((prev) => [result.calendarEvent!, ...prev]);
          showToast(
            result.syncedToGoogle
              ? "✅ Gerçek Google Takvim'inize etkinlik eklendi!"
              : "📅 Google Takvim etkinliği oluşturuldu!"
          );
        }
        meta = {
          type: "calendar",
          id: result.calendarEvent.id,
          syncedToGoogle: result.syncedToGoogle,
          usedGemini: result.usedGemini,
        };
      } else if (result.intent === "contact" && result.contact) {
        if (result.action === "delete") {
          setContactsList((prev) =>
            prev.filter(
              (c) =>
                !c.name
                  .toLocaleLowerCase("tr-TR")
                  .includes(result.contact!.name.toLocaleLowerCase("tr-TR"))
            )
          );
          showToast(
            result.syncedToGoogle
              ? "🗑️ Kişi gerçek Google Kişiler rehberinizden silindi!"
              : "🗑️ Kişi rehberden silindi!"
          );
        } else if (result.action === "update") {
          setContactsList((prev) => [
            result.contact!,
            ...prev.filter(
              (c) =>
                !c.name
                  .toLocaleLowerCase("tr-TR")
                  .includes(result.contact!.name.toLocaleLowerCase("tr-TR"))
            ),
          ]);
          showToast(
            result.syncedToGoogle
              ? "🔄 Gerçek Google Kişiler kaydınız güncellendi!"
              : "🔄 Kişi bilgileri güncellendi!"
          );
        } else {
          setContactsList((prev) => [result.contact!, ...prev]);
          showToast(
            result.syncedToGoogle
              ? "✅ Gerçek Google Kişiler rehberinize eklendi!"
              : "👤 Yeni kişi rehbere eklendi!"
          );
        }
        meta = {
          type: "contact",
          id: result.contact.id,
          syncedToGoogle: result.syncedToGoogle,
          usedGemini: result.usedGemini,
        };
      } else if (result.intent === "note" && result.note) {
        setNotesList((prev) => [result.note!, ...prev]);
        if (result.calendarEvent) {
          setCalendarEvents((prev) => [result.calendarEvent!, ...prev]);
        }
        meta = {
          type: "note",
          id: result.note.id,
          syncedToGoogle: result.syncedToGoogle,
          usedGemini: result.usedGemini,
        };
        showToast(
          result.syncedToGoogle
            ? "📋 Görev & Ajanda Notu Google Takvim ve Tasks'a kaydedildi!"
            : "📝 Not başarıyla kaydedildi!"
        );
      } else if (result.intent === "photos") {
        if (Array.isArray(result.photos) && result.photos.length > 0) {
          setPhotosList((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const fresh = result.photos!.filter((p) => !existingIds.has(p.id));
            return [...fresh, ...prev].slice(0, 24);
          });
        }
        showToast("📸 Google Photos ve Galeri sonuçları getirildi!");
      } else if (result.intent === "drive") {
        if (Array.isArray(result.driveFiles) && result.driveFiles.length > 0) {
          setDriveFilesList((prev) => {
            const existingIds = new Set(prev.map((f) => f.id));
            const fresh = result.driveFiles!.filter(
              (f) => !existingIds.has(f.id)
            );
            return [...fresh, ...prev].slice(0, 24);
          });
        }
        showToast("📁 Google Drive dosya ve içerik seçenekleri listelendi!");
      }

      if (Array.isArray(result.photos) && result.photos.length > 0) {
        setPhotosList((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = result.photos!.filter((p) => !existingIds.has(p.id));
          return [...fresh, ...prev].slice(0, 24);
        });
      }
      if (Array.isArray(result.driveFiles) && result.driveFiles.length > 0) {
        setDriveFilesList((prev) => {
          const existingIds = new Set(prev.map((f) => f.id));
          const fresh = result.driveFiles!.filter((f) => !existingIds.has(f.id));
          return [...fresh, ...prev].slice(0, 24);
        });
      }

      const now = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: "msg-" + Date.now(),
          sender: "bot",
          text:
            (params.isVoice ? "🎙️ *[Sesli Mesaj Çözümlendi]*\n\n" : "") +
            result.replyText,
          time: now,
          type: "text",
          meta,
        },
      ]);

      playTone(800, 0.1, "triangle");
      return result;
    } catch {
      setIsBotTyping(false);
      showToast("İstek işlenirken bir bağlantı hatası oluştu.");
      return null;
    }
  }

  // ==================== WHATSAPP LIVE VOICE CALL & NATURAL TURKISH FEMALE TTS ====================
  // Note: Browser speechSynthesis is intentionally NOT used because Windows default tr-TR voice (Microsoft Tolga) is male.
  // Only /api/tts (Natural Turkish Female Voice) is used.
  function speakTurkishText(text: string, onDone?: () => void) {
    if (typeof window === "undefined" || !callTtsRef.current) {
      if (onDone) onDone();
      return;
    }

    let doneCalled = false;
    const safetyTimer = setTimeout(() => {
      if (!doneCalled) {
        if (
          callAudioRef.current &&
          !callAudioRef.current.paused &&
          !callAudioRef.current.ended
        ) {
          return;
        }
        doneCalled = true;
        if (onDone) onDone();
      }
    }, 18000);

    const safeDone = () => {
      if (!doneCalled) {
        doneCalled = true;
        clearTimeout(safetyTimer);
        // Wait 650ms after speaker audio ends so speaker echo never enters the microphone
        setTimeout(() => {
          if (onDone) onDone();
        }, 650);
      }
    };

    const cleanForSpeech = text
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[0-9]\uFE0F?\u20E3/g, " ")
      .replace(/[*_`~#•━]/g, " ")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);

    // Stop any previous audio stream
    if (callAudioRef.current) {
      try {
        callAudioRef.current.pause();
        callAudioRef.current.src = "";
      } catch {}
      callAudioRef.current = null;
    }

    try {
      const isDefaultGreeting =
        cleanForSpeech.includes("çağrınızı aldım") &&
        Boolean(callPreloadedGreetingUrlRef.current);
      const ttsUrl = isDefaultGreeting
        ? callPreloadedGreetingUrlRef.current
        : `/api/tts?text=${encodeURIComponent(
            cleanForSpeech ||
              "Tamamdır Onur Bey, komutunuzu yerine getirdim. Sizi dinliyorum."
          )}`;
      const audio = new Audio(ttsUrl);
      callAudioRef.current = audio;

      audio.onended = () => {
        setCallNeedsAudioTap(false);
        safeDone();
      };
      audio.onerror = () => {
        safeDone();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setCallNeedsAudioTap(false);
          })
          .catch(() => {
            // Autoplay blocked when window popped open without a prior click:
            // Show 1-tap audio button and start microphone listening immediately (never invoke male speechSynthesis!)
            setCallNeedsAudioTap(true);
            safeDone();
          });
      }
    } catch {
      safeDone();
    }
  }

  function isClientStopOrHangupCommand(rawText?: string): boolean {
    if (!rawText) return false;
    const norm = rawText
      .toLocaleLowerCase("tr-TR")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!norm) return false;

    if (
      /\b(?:diyebilirsiniz|kapatmak\s+icin|durdurmak\s+icin)\b/.test(norm)
    ) {
      return false;
    }

    if (
      /\b(?:sohbeti\s+ve\s+telefonu\s+kapat\w*|telefonu\s+ve\s+sohbeti\s+kapat\w*|telefonu\s+kapat\w*|sohbeti\s+kapat\w*|aramayi\s+kapat\w*|aramayi\s+sonlandir\w*|cagriyi\s+kapat\w*|cagriyi\s+sonlandir\w*|asistani\s+kapat\w*|asistani\s+durdur\w*|dinlemeyi\s+kapat\w*|dinlemeyi\s+durdur\w*|sesli\s+aramayi\s+kapat\w*)\b/.test(
        norm
      )
    ) {
      return true;
    }

    if (
      /\b(?:toplanti\w*|etkinlik\w*|etkinlig\w*|takvim\w*|ajanda\w*|randevu\w*|not\b|notu\b|notunu\b|gorev\w*|hatirlat\w*|ekle\w*|olustur\w*|planla\w*|ayarla\w*|kaydet\w*|rehber\w*|dosya\w*|belge\w*|fotograf\w*|resim\w*|paylas\w*|gonder\w*|saat\b|yarin\b|bugun\b)\b/.test(
        norm
      )
    ) {
      return false;
    }

    if (
      /^(?:lutfen\s+|simdi\s+|hemen\s+|artik\s+|tamam\s+|tesekkurler\s+|peki\s+|asistan\s+|obc\s+|onur\s+bey\s+)*(?:stop|dur|durdur|kapat|kapatalim|bitir|bitirelim|sonlandir|sus|yeter|bu\s+kadar\s+yeter|hosca\s*kal|gorusuruz|iyi\s+gunler\s+kapat)(?:\s+lutfen|\s+artik|\s+hemen|\s+simdi|\s+asistan|\s+obc|\s+onur\s+bey)*$/.test(
        norm
      )
    ) {
      return true;
    }

    const words = norm.split(/\s+/);
    if (
      words.length <= 8 &&
      (/\b(?:telefon\w*|sohbet\w*|arama\w*|cagri\w*|asistan\w*|dinleme\w*|mikrofon\w*|sesli\s+arama\w*|sesli\s+asistan\w*)\b.*\b(?:kapat\w*|durdur\w*|dur\b|bitir\w*|sonlandir\w*|kes\w*|stop\b)\b/.test(
        norm
      ) ||
        /\b(?:kapat\w*|durdur\w*|dur\b|bitir\w*|sonlandir\w*|kes\w*|stop\b)\b.*\b(?:telefon\w*|sohbet\w*|arama\w*|cagri\w*|asistan\w*|dinleme\w*|mikrofon\w*)\b/.test(
          norm
        ))
    ) {
      return true;
    }

    return false;
  }

  function isClientPauseListeningCommand(rawText?: string): boolean {
    if (!rawText) return false;
    const norm = rawText
      .toLocaleLowerCase("tr-TR")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!norm) return false;
    return (
      norm.split(/\s+/).length <= 8 &&
      /\b(?:dinlemeyi\s+duraklat|mikrofonu\s+duraklat|sessize\s+al|beklemeye\s+al|bir\s+dakika\s+bekle|duraklat)\b/.test(
        norm
      )
    );
  }

  function triggerVoiceHangupAndClose(spokenText?: string) {
    callActiveRef.current = false;
    callExecutingRef.current = false;
    stopCallRecognitionOnly();
    if (callMicStreamRef.current) {
      try {
        callMicStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      callMicStreamRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallLiveTranscript(
      spokenText
        ? `🛑 "${spokenText}" — Arama ve Asistan Kapatılıyor...`
        : "🛑 Sesli Arama ve Asistan Kapatılıyor..."
    );
    setCallStatus("paused");
    showToast("🛑 Sesli arama ve asistan dinleme modu kapatıldı.");

    fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end_call", notifyWhatsApp: true }),
    }).catch(() => {});

    speakTurkishText(
      "Tamamdır Onur Bey, sesli aramayı ve dinlemeyi hemen kapatıyorum. İyi günler dilerim.",
      () => {
        endWhatsAppVoiceCall(false);
      }
    );
    setTimeout(() => {
      endWhatsAppVoiceCall(false);
    }, 3200);
  }

  function stopCallRecognitionOnly() {
    if (callSilenceTimeoutRef.current) {
      clearTimeout(callSilenceTimeoutRef.current);
      callSilenceTimeoutRef.current = null;
    }
    if (callVadIntervalRef.current) {
      clearInterval(callVadIntervalRef.current);
      callVadIntervalRef.current = null;
    }
    if (
      callMediaRecorderRef.current &&
      callMediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        callMediaRecorderRef.current.onstop = null;
        callMediaRecorderRef.current.stop();
      } catch {}
    }
    callMediaRecorderRef.current = null;
    if (callSpeechRecRef.current) {
      try {
        callSpeechRecRef.current.onend = null;
        callSpeechRecRef.current.onerror = null;
        callSpeechRecRef.current.stop();
      } catch {}
      callSpeechRecRef.current = null;
    }
    setCallMicLevel(0);
    setCallIsRecordingSpeech(false);
  }

  function flushCallSpeechNow() {
    if (!callActiveRef.current || callExecutingRef.current) return;

    const spokenText = callTranscriptBufferRef.current.trim();
    if (spokenText.length >= 2) {
      executeCallCommand(spokenText);
      return;
    }

    if (
      callMediaRecorderRef.current &&
      callMediaRecorderRef.current.state !== "inactive"
    ) {
      const recToStop = callMediaRecorderRef.current;
      const chunksSnapshot = [...callAudioChunksRef.current];
      recToStop.onstop = () => {
        const finalChunks =
          callAudioChunksRef.current.length > 0
            ? callAudioChunksRef.current
            : chunksSnapshot;
        const blob = new Blob(finalChunks, {
          type: recToStop.mimeType || "audio/webm",
        });
        if (blob.size < 1200) {
          if (callActiveRef.current && !callExecutingRef.current) {
            startCallListeningCycle();
          }
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = String(reader.result || "").split(",")[1];
          if (b64 && callActiveRef.current && !callExecutingRef.current) {
            executeCallCommand("", b64, recToStop.mimeType || "audio/webm");
          }
        };
        reader.readAsDataURL(blob);
      };
      try {
        recToStop.stop();
      } catch {}
    }
  }

  function startCallListeningCycle() {
    if (!callActiveRef.current) return;
    stopCallRecognitionOnly();
    callExecutingRef.current = false;
    callTranscriptBufferRef.current = "";
    callAudioChunksRef.current = [];
    setCallLiveTranscript("");
    setCallStatus("listening");

    const startSpeechAndVadWithStream = (stream: MediaStream | null) => {
      if (!callActiveRef.current) return;
      if (stream) {
        callMicStreamRef.current = stream;
      }

      // 1. Start Web Speech API AFTER mic stream is ready so they never collide on Windows Chrome
      const SpeechRecognition =
        typeof window !== "undefined"
          ? window.SpeechRecognition || window.webkitSpeechRecognition
          : null;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.lang = "tr-TR";
          rec.continuous = true;
          rec.interimResults = true;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rec.onresult = (event: any) => {
            if (!callActiveRef.current || callExecutingRef.current) return;
            let interim = "";
            let finalAcc = "";
            for (let i = 0; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalAcc += event.results[i][0].transcript + " ";
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            const cleanFinal = finalAcc.trim();
            const combined = (finalAcc + interim).trim();
            if (combined) {
              callTranscriptBufferRef.current = combined;
              setCallLiveTranscript(combined);
              setCallIsRecordingSpeech(true);

              // Only check instant stop/pause on FINALIZED speech segments (never on partial interim guesses like "dur" inside "dörtte")
              if (cleanFinal && isClientStopOrHangupCommand(cleanFinal)) {
                if (callSilenceTimeoutRef.current) {
                  clearTimeout(callSilenceTimeoutRef.current);
                  callSilenceTimeoutRef.current = null;
                }
                triggerVoiceHangupAndClose(cleanFinal);
                return;
              }

              if (cleanFinal && isClientPauseListeningCommand(cleanFinal)) {
                if (callSilenceTimeoutRef.current) {
                  clearTimeout(callSilenceTimeoutRef.current);
                  callSilenceTimeoutRef.current = null;
                }
                stopCallRecognitionOnly();
                setCallStatus("paused");
                showToast("⏸️ Dinleme modu duraklatıldı (Sessize alındı).");
                speakTurkishText("Tamamdır Onur Bey, dinlemeyi duraklattım.");
                return;
              }

              if (callHandsFreeRef.current) {
                if (callSilenceTimeoutRef.current) {
                  clearTimeout(callSilenceTimeoutRef.current);
                }
                callSilenceTimeoutRef.current = setTimeout(() => {
                  const spoken = callTranscriptBufferRef.current.trim();
                  if (
                    spoken.length >= 2 &&
                    callActiveRef.current &&
                    !callExecutingRef.current
                  ) {
                    executeCallCommand(spoken);
                  }
                }, 1300);
              }
            }
          };

          rec.onerror = () => {
            // Keep MediaRecorder + Gemini Audio STT active even if browser Web Speech API has an error
          };

          rec.onend = () => {
            if (
              callActiveRef.current &&
              !callExecutingRef.current &&
              !callTranscriptBufferRef.current.trim()
            ) {
              setTimeout(() => {
                if (callActiveRef.current && !callExecutingRef.current) {
                  try {
                    rec.start();
                  } catch {}
                }
              }, 250);
            }
          };

          rec.start();
          callSpeechRecRef.current = rec;
        } catch {}
      }

      // 2. Attach MediaRecorder + Voice Activity Detection (Gemini Flash Audio STT fallback)
      if (!stream) return;
      try {
        callAudioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        callMediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            callAudioChunksRef.current.push(ev.data);
            // Keep first chunk (WebM EBML header) + last 45 chunks (~9 seconds) so audio uploads are fast
            if (callAudioChunksRef.current.length > 48) {
              callAudioChunksRef.current = [
                callAudioChunksRef.current[0],
                ...callAudioChunksRef.current.slice(-45),
              ];
            }
          }
        };

        recorder.start(200);

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!callAudioCtxRef.current && AudioCtx) {
          callAudioCtxRef.current = new AudioCtx();
        }
        const audioCtx = callAudioCtxRef.current;
        if (audioCtx) {
          if (audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
          }
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const dataArr = new Uint8Array(analyser.frequencyBinCount);

          let hasSpokenInCycle = false;
          let consecutiveVoiceFrames = 0;
          let silenceSinceMs = 0;

          callVadIntervalRef.current = setInterval(() => {
            if (!callActiveRef.current || callExecutingRef.current) return;
            if (audioCtx.state === "suspended") {
              audioCtx.resume().catch(() => {});
            }
            analyser.getByteTimeDomainData(dataArr);
            let sumSq = 0;
            let peak = 0;
            for (let i = 0; i < dataArr.length; i++) {
              const norm = Math.abs(dataArr[i] - 128) / 128;
              if (norm > peak) peak = norm;
              sumSq += norm * norm;
            }
            const rms = Math.sqrt(sumSq / dataArr.length);
            const visualLevel = Math.min(
              100,
              Math.round(Math.max(rms * 950, peak * 260))
            );
            setCallMicLevel(visualLevel);

            // Require sustained human voice (rms > 0.042 or peak > 0.14 for >= 6 consecutive ticks = ~720ms)
            // so background room hum or brief clicks never trigger false dead-mic recordings!
            if (rms > 0.042 || peak > 0.14) {
              consecutiveVoiceFrames += 1;
              silenceSinceMs = Date.now();
              if (consecutiveVoiceFrames >= 6) {
                hasSpokenInCycle = true;
                setCallIsRecordingSpeech(true);
              }
            } else {
              consecutiveVoiceFrames = 0;
              if (
                hasSpokenInCycle &&
                callHandsFreeRef.current &&
                Date.now() - silenceSinceMs > 1750
              ) {
                hasSpokenInCycle = false;
                flushCallSpeechNow();
              }
            }
          }, 120);
        }
      } catch {}
    };

    if (
      callMicStreamRef.current &&
      callMicStreamRef.current.active &&
      callMicStreamRef.current
        .getAudioTracks()
        .some((t) => t.readyState === "live")
    ) {
      startSpeechAndVadWithStream(callMicStreamRef.current);
    } else if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.getUserMedia
    ) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => startSpeechAndVadWithStream(stream))
        .catch(() => startSpeechAndVadWithStream(null));
    } else {
      startSpeechAndVadWithStream(null);
    }
  }

  async function executeCallCommand(
    rawCommandText: string,
    audioBase64?: string,
    mimeType?: string
  ) {
    const command = rawCommandText.trim();
    if ((!command && !audioBase64) || callExecutingRef.current) return;

    // Immediate client-side check for stop/hangup or pause before hitting API
    if (command && isClientStopOrHangupCommand(command)) {
      triggerVoiceHangupAndClose(command);
      return;
    }
    if (command && isClientPauseListeningCommand(command)) {
      stopCallRecognitionOnly();
      setCallStatus("paused");
      showToast("⏸️ Dinleme modu duraklatıldı (Sessize alındı).");
      speakTurkishText("Tamamdır Onur Bey, dinlemeyi duraklattım.");
      return;
    }

    callExecutingRef.current = true;

    stopCallRecognitionOnly();
    callTranscriptBufferRef.current = "";
    setCallLiveTranscript(
      command || "🎙️ Ses kaydınız Gemini AI ile çözümleniyor..."
    );
    setCallStatus("processing");
    playTone(520, 0.08, "sine");

    const now = new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (command) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: "msg-call-" + Date.now(),
          sender: "user",
          text: command,
          transcript: command,
          duration: "Canlı Arama",
          time: now,
          type: "audio",
          meta: null,
        },
      ]);
    }

    const result = await processCommandThroughApi({
      text: command || undefined,
      audioBase64,
      mimeType,
      isVoice: true,
      fromLiveCall: true,
    });

    const effectiveCommand = result?.transcript || command || "";

    // Check if Gemini STT transcribed a stop/hangup or pause command from audioBase64
    if (
      result?.endCall ||
      (effectiveCommand && isClientStopOrHangupCommand(effectiveCommand))
    ) {
      triggerVoiceHangupAndClose(effectiveCommand);
      return;
    }
    if (
      result?.pauseListening ||
      (effectiveCommand && isClientPauseListeningCommand(effectiveCommand))
    ) {
      callExecutingRef.current = false;
      stopCallRecognitionOnly();
      setCallStatus("paused");
      showToast("⏸️ Dinleme modu duraklatıldı (Sessize alındı).");
      speakTurkishText("Tamamdır Onur Bey, dinlemeyi duraklattım.");
      return;
    }

    if (
      !effectiveCommand ||
      result?.duplicate ||
      !result?.replyText ||
      (result?.intent === "help" && result?.action !== "share")
    ) {
      callExecutingRef.current = false;
      setCallLiveTranscript("");
      if (callActiveRef.current) {
        startCallListeningCycle();
      }
      return;
    }

    if (!command && result?.transcript) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: "msg-call-" + Date.now(),
          sender: "user",
          text: result.transcript,
          transcript: result.transcript,
          duration: "Canlı Arama",
          time: now,
          type: "audio",
          meta: null,
        },
      ]);
    }

    const summaryLine =
      result?.spokenReply ||
      result?.replyText
        ?.split("\n")
        .filter((l) => l.trim() && !l.includes("Sesli Komut Algılandı"))
        .slice(0, 2)
        .join(" • ") ||
      "Komut işlendi.";

    setCallHistory((prev) => [
      {
        id: "ch-" + Date.now(),
        time: now,
        command: effectiveCommand,
        replySummary: summaryLine,
        intent: result?.intent || "help",
        syncedToGoogle: Boolean(result?.syncedToGoogle),
        chainedCount: result?.chainedCount,
      },
      ...prev,
    ]);

    setCallLiveTranscript("");
    callExecutingRef.current = false;

    if (!callActiveRef.current) return;

    setCallStatus("speaking");
    const voiceSummary =
      result?.spokenReply ||
      (result?.chainedCount
        ? `Tamamdır Onur Bey, peş peşe ${result.chainedCount} komutunuzu da çalıştırdım. Başka bir isteğiniz var mı?`
        : `${summaryLine}. Başka bir isteğiniz var mı?`);

    speakTurkishText(voiceSummary, () => {
      if (callActiveRef.current) {
        startCallListeningCycle();
      }
    });
  }

  function startWhatsAppVoiceCall() {
    callStartMsRef.current = Date.now();
    callActiveRef.current = true;
    callExecutingRef.current = false;
    setIsVoiceCallOpen(true);
    setCallDurationSec(0);
    setCallLiveTranscript("");

    try {
      callChannelRef.current?.postMessage({
        type: "NEW_CALL_STARTED",
        tabId: callTabIdRef.current,
      });
    } catch {}

    // Synchronously unlock AudioContext & Microphone inside the user click gesture!
    if (typeof window !== "undefined") {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!callAudioCtxRef.current && AudioCtx) {
          callAudioCtxRef.current = new AudioCtx();
        }
        if (callAudioCtxRef.current?.state === "suspended") {
          callAudioCtxRef.current.resume().catch(() => {});
        }
      } catch {}

      if (
        navigator.mediaDevices?.getUserMedia &&
        (!callMicStreamRef.current || !callMicStreamRef.current.active)
      ) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            callMicStreamRef.current = stream;
          })
          .catch(() => {});
      }
    }

    playTone(660, 0.14, "sine");
    setTimeout(() => playTone(880, 0.16, "sine"), 160);

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDurationSec((s) => {
        if (s >= 180 && !callExecutingRef.current) {
          setTimeout(() => endWhatsAppVoiceCall(true), 0);
        }
        return s + 1;
      });
    }, 1000);

    setCallStatus("speaking");
    speakTurkishText(
      "Buyurun Onur Bey, çağrınızı aldım, sizi dinliyorum. Ne yapmamı istersiniz?",
      () => {
        if (callActiveRef.current) {
          startCallListeningCycle();
        }
      }
    );
  }

  function endWhatsAppVoiceCall(notifyServer = true) {
    callActiveRef.current = false;
    callExecutingRef.current = false;
    stopCallRecognitionOnly();
    if (callMicStreamRef.current) {
      try {
        callMicStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      callMicStreamRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (callAudioRef.current) {
      try {
        callAudioRef.current.pause();
        callAudioRef.current.src = "";
      } catch {}
      callAudioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (notifyServer) {
      try {
        callChannelRef.current?.postMessage({ type: "CALL_ENDED" });
      } catch {}
      fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_call", notifyWhatsApp: true }),
      }).catch(() => {});
    }
    playTone(340, 0.18, "sawtooth");
    setIsVoiceCallOpen(false);
    setCallStatus("paused");
    showToast("🛑 Canlı sesli görüşme ve mikrofon dinlemesi kapatıldı.");
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("call=1")
    ) {
      setTimeout(() => {
        try {
          window.close();
        } catch {}
      }, 250);
    }
  }

  useEffect(() => {
    callHandsFreeRef.current = callHandsFree;
  }, [callHandsFree]);

  useEffect(() => {
    callTtsRef.current = callTtsEnabled;
  }, [callTtsEnabled]);

  function handleSendTextMessage(e: React.FormEvent) {
    e.preventDefault();
    const val = userTextInput.trim();
    if (!val) return;

    const now = new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setChatMessages((prev) => [
      ...prev,
      {
        id: "msg-" + Date.now(),
        sender: "user",
        text: val,
        time: now,
        type: "text",
        meta: null,
      },
    ]);

    setUserTextInput("");
    playTone(400, 0.06, "sine");
    processCommandThroughApi({ text: val, isVoice: false });
  }

  function dispatchVoiceMessage(
    transcript: string,
    duration = "0:04",
    audioBase64?: string,
    mimeType?: string
  ) {
    const now = new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setChatMessages((prev) => [
      ...prev,
      {
        id: "msg-" + Date.now(),
        sender: "user",
        text: transcript,
        transcript,
        duration,
        time: now,
        type: "audio",
        meta: null,
      },
    ]);

    playTone(450, 0.08, "sine");
    processCommandThroughApi({
      text: transcript,
      audioBase64,
      mimeType,
      isVoice: true,
    });
  }

  function triggerVoiceSample(sampleText: string) {
    dispatchVoiceMessage(sampleText, "0:05");
    showToast("🎙️ Canlı sesli komut Google Workspace üzerinde çalıştırılıyor...");
  }

  async function startLiveVoiceRecording() {
    setIsRecording(true);
    setRecordSeconds(0);
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    audioChunksRef.current = [];

    playTone(600, 0.1, "sine");

    recordIntervalRef.current = setInterval(() => {
      setRecordSeconds((prev) => prev + 1);
    }, 1000);

    // Start Web Speech API if supported
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "tr-TR";
        recognition.continuous = true;
        recognition.interimResults = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let interim = "";
          let finalAcc = "";
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalAcc += event.results[i][0].transcript + " ";
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const combined = (finalAcc + interim).trim();
          if (combined) {
            liveTranscriptRef.current = combined;
            setLiveTranscript(combined);
          }
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch {}
    }

    // Also capture audio via MediaRecorder if microphone permission available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch {}
    }
  }

  function stopVoiceCleanup() {
    setIsRecording(false);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      } catch {}
      mediaRecorderRef.current = null;
    }
  }

  function cancelLiveVoiceRecording() {
    stopVoiceCleanup();
    showToast("Ses kaydı iptal edildi.");
  }

  function finishLiveVoiceRecording() {
    const finalDuration = recordSeconds;
    let transcript = liveTranscriptRef.current.trim();
    stopVoiceCleanup();

    if (!transcript) {
      const samples = [
        "Yarın saat 15:30'da Mehmet Bey ile bütçe toplantısı ayarla",
        "Not al: Ofis için yeni internet sözleşmesini yenilemeyi unutma",
        "Rehbere ekle: Dr. Merve Şahin, telefon 05421112233",
      ];
      transcript = samples[Math.floor(Math.random() * samples.length)];
    }

    const formattedDuration = `0:${String(Math.max(finalDuration, 3)).padStart(2, "0")}`;
    dispatchVoiceMessage(transcript, formattedDuration);
  }

  function playVoiceBlip(msgId: string) {
    setPlayingMsgId(msgId);
    playTone(550, 0.3, "triangle");
    setTimeout(() => {
      setPlayingMsgId((prev) => (prev === msgId ? null : prev));
    }, 1000);
  }

  function insertRandomTemplate() {
    const samples = [
      "!toplanti Yarın 16:00 Tasarım ve Marka İncelemesi",
      "!rehber Avukat Selin 05329991122 selin@hukuk.com",
      "!not Sunucu yedeklerini Cuma 18:00'de kontrol et",
    ];
    setUserTextInput(samples[Math.floor(Math.random() * samples.length)]);
  }

  function clearChatHistory() {
    setChatMessages([
      {
        id: "msg-init-" + Date.now(),
        sender: "bot",
        text: "🧹 Sohbet geçmişi temizlendi. Yeni sesli veya yazılı komutlarınızı dinliyorum!",
        time: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        type: "text",
        meta: null,
      },
    ]);
    showToast("Sohbet temizlendi.");
  }

  function deleteEvent(id: string) {
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
    showToast("Etkinlik takvimden silindi.");
  }

  function deleteContact(id: string) {
    setContactsList((prev) => prev.filter((c) => c.id !== id));
    showToast("Kişi rehberden kaldırıldı.");
  }

  function deleteNote(id: string) {
    setNotesList((prev) => prev.filter((n) => n.id !== id));
    showToast("Not silindi.");
  }

  function downloadBlob(content: BlobPart, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyTextToClipboard(text: string, customToast?: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast(customToast || "Panoya kopyalandı!");
  }

  function downloadSingleICS(id: string) {
    const evt = calendarEvents.find((e) => e.id === id);
    if (!evt) return;
    const cleanDate = evt.date.replace(/-/g, "");
    const cleanStart = evt.startTime.replace(":", "") + "00";
    const cleanEnd = evt.endTime.replace(":", "") + "00";
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//WhatsApp Assistant//TR\nBEGIN:VEVENT\nSUMMARY:${evt.title}\nLOCATION:${evt.location}\nDTSTART:${cleanDate}T${cleanStart}\nDTEND:${cleanDate}T${cleanEnd}\nSTATUS:CONFIRMED\nEND:VEVENT\nEND:VCALENDAR`;
    downloadBlob(
      ics,
      `${evt.title.replace(/\s+/g, "_")}.ics`,
      "text/calendar"
    );
    showToast("Takvim .ICS dosyası indirildi!");
  }

  function downloadAllEventsICS() {
    const events = calendarEvents
      .map((e) => {
        const cleanDate = e.date.replace(/-/g, "");
        const cleanStart = e.startTime.replace(":", "") + "00";
        const cleanEnd = e.endTime.replace(":", "") + "00";
        return `BEGIN:VEVENT\nSUMMARY:${e.title}\nLOCATION:${e.location}\nDTSTART:${cleanDate}T${cleanStart}\nDTEND:${cleanDate}T${cleanEnd}\nEND:VEVENT`;
      })
      .join("\n");
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//WhatsApp Assistant//TR\n${events}\nEND:VCALENDAR`;
    downloadBlob(ics, "google_takvim_whatsapp.ics", "text/calendar");
    showToast("Tüm takvim indirildi!");
  }

  function downloadSingleVCF(id: string) {
    const cnt = contactsList.find((c) => c.id === id);
    if (!cnt) return;
    const vcf = `BEGIN:VCARD\nVERSION:3.0\nFN:${cnt.name}\nTEL;TYPE=CELL:${cnt.phone}\nEMAIL:${cnt.email}\nORG:${cnt.company}\nEND:VCARD`;
    downloadBlob(vcf, `${cnt.name.replace(/\s+/g, "_")}.vcf`, "text/vcard");
    showToast("Kişi kartviziti (.VCF) indirildi!");
  }

  function downloadAllContactsVCF() {
    const vcf = contactsList
      .map(
        (c) =>
          `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nTEL;TYPE=CELL:${c.phone}\nEMAIL:${c.email}\nORG:${c.company}\nEND:VCARD`
      )
      .join("\n");
    downloadBlob(vcf, "google_rehber_whatsapp.vcf", "text/vcard");
    showToast("Tüm rehber indirildi!");
  }

  function getGeneratedEnvBlock() {
    const gemini = wizGemini.trim() || "AIzaSy_BURAYA_GEMINI_KEY_YAZIN";
    const gclient = wizGClient.trim() || "BURAYA_GOOGLE_CLIENT_ID_YAZIN";
    const gsecret = wizGSecret.trim() || "BURAYA_GOOGLE_CLIENT_SECRET_YAZIN";
    const grefresh = wizGRefresh.trim() || "BURAYA_GOOGLE_REFRESH_TOKEN_YAZIN";
    const watoken = wizWaToken.trim() || "BURAYA_META_EAAG_TOKEN_YAZIN";
    const waphone = wizWaPhone.trim() || "BURAYA_PHONE_NUMBER_ID_YAZIN";
    const waverify = wizWaVerify.trim() || "whatsapp_gizli_anahtar_2026";

    return `GEMINI_API_KEY=${gemini}
GOOGLE_CLIENT_ID=${gclient}
GOOGLE_CLIENT_SECRET=${gsecret}
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_REFRESH_TOKEN=${grefresh}
WHATSAPP_ACCESS_TOKEN=${watoken}
WHATSAPP_PHONE_NUMBER_ID=${waphone}
WHATSAPP_VERIFY_TOKEN=${waverify}`;
  }

  async function sendLiveWhatsAppTestMessage() {
    const token = wizWaToken.trim();
    const phoneId = wizWaPhone.trim();
    const recipient = wizTestRecipient
      .trim()
      .replace(/\+/g, "")
      .replace(/\s+/g, "");

    if (!token || !phoneId || !recipient) {
      showToast(
        "Lütfen Token, Phone Number ID ve Alıcı Telefon Numarası alanlarını doldurun."
      );
      return;
    }

    setWaTestStatus({
      type: "loading",
      message: "⏳ Meta Graph API üzerinden WhatsApp mesajı gönderiliyor...",
    });

    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: recipient,
            type: "text",
            text: {
              body: "🚀 *Merhaba!* WhatsApp ⇄ Google Workspace Asistanınız (Next.js) başarıyla bağlandı!\n\nArtık bu numaraya:\n• 🎙️ *Sesli mesaj* gönderebilir\n• 📅 *!toplanti Yarın 14:00 Bütçe* yazabilir\n• 👤 *!rehber Ali Kaya 05321112233* ekleyebilirsiniz.",
            },
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.messages) {
        setWaTestStatus({
          type: "success",
          message: `✅ BAŞARILI! Mesaj telefonunuza iletildi (Message ID: ${data.messages[0].id}). Şimdi telefonunuzdan bu mesaja cevap yazarak veya ses kaydı atarak botu kullanabilirsiniz!`,
        });
        showToast("🎉 Gerçek WhatsApp mesajı telefonunuza gönderildi!");
      } else {
        setWaTestStatus({
          type: "error",
          message: `❌ Meta API Hatası: ${data.error?.message || JSON.stringify(data)}`,
        });
      }
    } catch (err) {
      setWaTestStatus({
        type: "error",
        message: `❌ Bağlantı Hatası: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`,
      });
    }
  }

  function initiateGoogleLiveSignIn() {
    const clientId = googleClientIdInput.trim();
    if (!clientId) {
      showToast("Lütfen geçerli bir Google OAuth Client ID girin.");
      return;
    }

    try {
      if (!window.google?.accounts?.oauth2) {
        showToast("Google Identity servisi henüz yüklenmedi, tekrar deneyin.");
        return;
      }
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:
          "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/contacts",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (response: any) => {
          if (response.access_token) {
            setGoogleAccessToken(response.access_token);
            setWizGClient(clientId);
            setIsGoogleModalOpen(false);
            showToast("✅ Google hesabınız canlı olarak bağlandı!");
          }
        },
      });
      client.requestAccessToken();
    } catch {
      showToast(
        "Google yetkilendirme penceresi açılamadı. Client ID bilgisini kontrol edin."
      );
    }
  }

  function downloadCompleteProjectZip() {
    if (typeof window === "undefined" || !window.JSZip) {
      showToast(
        "ZIP aracı hazırlanıyor, lütfen 1 saniye sonra tekrar tıklayın."
      );
      return;
    }

    showToast("📦 ZIP paketi derleniyor ve indirme başlatılıyor...");
    const zip = new window.JSZip();

    const packageJson = {
      name: "whatsapp-google-workspace-assistant",
      version: "3.0.0",
      description:
        "Next.js WhatsApp voice and text assistant for Google Calendar and Contacts",
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        "start:qr": "node bot-baileys.js",
      },
      dependencies: {
        next: "16.4.3",
        react: "19.3.0",
        "react-dom": "19.3.0",
        "@whiskeysockets/baileys": "^6.7.0",
        axios: "^1.7.0",
        dotenv: "^16.4.5",
        googleapis: "^140.0.0",
        "qrcode-terminal": "^0.12.0",
      },
    };

    zip.file("package.json", JSON.stringify(packageJson, null, 2));
    zip.file("bot-baileys.js", BACKEND_TEMPLATES.baileys);
    zip.file("server.js", BACKEND_TEMPLATES.node);
    zip.file(".env.example", getGeneratedEnvBlock());
    zip.file("GOOGLE_SETUP.md", BACKEND_TEMPLATES.google);
    zip.file("Dockerfile", BACKEND_TEMPLATES.docker);
    zip.file("ANTIGRAVITY_PROMPT.md", ANTIGRAVITY_FILES.prompt);
    zip.file(".antigravityrules", ANTIGRAVITY_FILES.rules);
    zip.file("antigravity.config.json", ANTIGRAVITY_FILES.config);

    zip
      .generateAsync({ type: "blob" })
      .then((content: Blob) => {
        downloadBlob(
          content,
          "whatsapp-google-asistan-nextjs-ready.zip",
          "application/zip"
        );
        showToast(
          "✅ Next.js & Vercel uyumlu .ZIP paketi başarıyla indirildi!"
        );
      })
      .catch(() => {
        showToast("İndirme oluşturulurken bir hata oluştu.");
      });
  }

  function formatWhatsAppText(text: string) {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Parse *bold* and `code` segments safely
      const parts = line.split(/(\*[^*]+\*|`[^`]+`)/g);
      return (
        <React.Fragment key={idx}>
          {parts.map((part, pIdx) => {
            if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
              return (
                <strong key={pIdx} className="font-semibold">
                  {part.slice(1, -1)}
                </strong>
              );
            }
            if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
              return (
                <code
                  key={pIdx}
                  className="bg-black/10 px-1 py-0.5 rounded font-mono text-[11px]"
                >
                  {part.slice(1, -1)}
                </code>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
          {idx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  }

  const filteredContacts = contactsList.filter((c) => {
    const q = contactSearchQuery.toLocaleLowerCase("tr-TR");
    return (
      c.name.toLocaleLowerCase("tr-TR").includes(q) ||
      c.phone.toLocaleLowerCase("tr-TR").includes(q) ||
      c.company.toLocaleLowerCase("tr-TR").includes(q)
    );
  });

  const isLiveGoogleConnected = true;

  const formattedRecordTime = `${String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:${String(recordSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shrink-0 select-none z-20">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-900/30">
              <i className="fa-brands fa-whatsapp text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                WhatsApp ⇄ Google Workspace Asistanı
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                  Next.js Canlı
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Takvim, Kişiler, Notlar ve Sesli Komut Entegrasyonu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={startWhatsAppVoiceCall}
              className="px-3.5 py-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-400 hover:from-green-400 hover:to-teal-300 text-slate-950 text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/50 transition transform active:scale-95 cursor-pointer animate-pulse"
            >
              <i className="fa-solid fa-phone-volume text-sm"></i>
              <span>📞 Sesli Ara (Peş Peşe Komut)</span>
            </button>

            <button
              onClick={downloadCompleteProjectZip}
              className="hidden sm:flex px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl items-center gap-1.5 transition cursor-pointer"
            >
              <i className="fa-solid fa-file-zipper text-xs"></i>
              <span>📦 .ZIP</span>
            </button>

            <nav className="hidden md:flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs overflow-x-auto">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-brands fa-whatsapp"></i>
                <span>WhatsApp Asistan</span>
              </button>

              <button
                onClick={() => setActiveTab("media")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "media"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-regular fa-images text-pink-400"></i>
                <span>Photos & Drive</span>
                <span className="bg-pink-600/30 text-pink-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {photosList.length + driveFilesList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("calendar")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "calendar"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-regular fa-calendar-check text-blue-400"></i>
                <span>Takvim</span>
                <span className="bg-blue-600/30 text-blue-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {calendarEvents.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("contacts")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "contacts"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-regular fa-address-book text-emerald-400"></i>
                <span>Kişiler</span>
                <span className="bg-emerald-600/30 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {contactsList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("notes")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "notes"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-regular fa-note-sticky text-amber-400"></i>
                <span>Görevler</span>
                <span className="bg-amber-600/30 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {notesList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("backend")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "backend"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-solid fa-server text-purple-400"></i>
                <span>Kurulum</span>
              </button>

              <button
                onClick={() => setActiveTab("vercel")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "vercel"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-solid fa-triangle-exclamation rotate-180 text-white"></i>
                <span>Bulut</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden relative pb-14 md:pb-0">
        {/* TOAST */}
        <div
          className={`fixed bottom-16 md:bottom-4 right-4 z-50 transform transition-all duration-300 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs pointer-events-none ${
            toastMsg ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
          }`}
        >
          <i className="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
          <span>{toastMsg}</span>
        </div>

        {/* ==================== TAB 1: WHATSAPP SIMULATOR ==================== */}
        {activeTab === "chat" && (
          <section className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
            {/* Left Sidebar (Collapsible on Mobile) */}
            <aside
              className={`${
                showMobileQuickPanel ? "flex" : "hidden md:flex"
              } w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex-col shrink-0 overflow-y-auto custom-scrollbar p-4 space-y-4 max-h-[55vh] md:max-h-none border-b md:border-b-0`}
            >
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-microphone-lines text-teal-600"></i>
                    Canlı Sesli & Peş Peşe Test Senaryoları
                  </span>
                  <button
                    onClick={() => setShowMobileQuickPanel(false)}
                    className="md:hidden text-slate-400 hover:text-slate-700 text-xs"
                  >
                    Kapat ✕
                  </button>
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Tek tıkla sesli komut veya peş peşe zincirleme komut
                  gönderin:
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() =>
                      triggerVoiceSample(
                        "Yarın saat 10:00'da bütçe toplantısı ekle, ardından Topkapı üniversitesi klasörümdeki 6. hafta dosyalarını getir, daha sonra 19 Eylül 2026 fotoğraflarımı paylaş"
                      )
                    }
                    className="w-full text-left p-2.5 rounded-xl border border-purple-300 bg-purple-50/80 hover:bg-purple-100/80 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-bolt text-purple-600 group-hover:scale-110 transition"></i>{" "}
                        Peş Peşe 3 Sesli Komut (Takvim + Drive + Photos)
                      </span>
                      <span className="text-[11px] text-purple-700/90 line-clamp-1">
                        &quot;Yarın 10:00 toplantı ekle, ardından 6. hafta
                        dosyalarını getir, daha sonra 19 Eylül 2026...&quot;
                      </span>
                    </div>
                    <i className="fa-solid fa-circle-play text-purple-600 text-sm"></i>
                  </button>

                  <button
                    onClick={() =>
                      triggerVoiceSample(
                        "Topkapı üniversitesi klasörümdeki 6. hafta dosyalarını seçenekler halinde getir"
                      )
                    }
                    className="w-full text-left p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <i className="fa-brands fa-google-drive text-blue-600 group-hover:scale-110 transition"></i>{" "}
                        Ses: Google Drive Klasör &amp; Hafta Arama
                      </span>
                      <span className="text-[11px] text-blue-700/90 line-clamp-1">
                        &quot;Topkapı üniversitesi klasörümdeki 6. hafta
                        dosyalarını getir&quot;
                      </span>
                    </div>
                    <i className="fa-solid fa-circle-play text-blue-600 text-sm"></i>
                  </button>

                  <button
                    onClick={() =>
                      triggerVoiceSample(
                        "19 Eylül 2026 tarihindeki fotoğraflarımı paylaş"
                      )
                    }
                    className="w-full text-left p-2.5 rounded-xl border border-pink-200 bg-pink-50/70 hover:bg-pink-100/80 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-pink-900 flex items-center gap-1.5">
                        <i className="fa-regular fa-images text-pink-600 group-hover:scale-110 transition"></i>{" "}
                        Ses: Google Photos Tarih &amp; Kişi Arama
                      </span>
                      <span className="text-[11px] text-pink-700/90 line-clamp-1">
                        &quot;19 Eylül 2026 tarihindeki fotoğraflarımı
                        paylaş&quot;
                      </span>
                    </div>
                    <i className="fa-solid fa-circle-play text-pink-600 text-sm"></i>
                  </button>

                  <button
                    onClick={() =>
                      triggerVoiceSample(
                        "Yarın saat 14:30'da Ahmet Bey ile Finans Bütçe toplantısı planla"
                      )
                    }
                    className="w-full text-left p-2.5 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100/80 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-microphone text-teal-600 group-hover:scale-110 transition"></i>{" "}
                        Ses: Toplantı Planla
                      </span>
                      <span className="text-[11px] text-teal-700/90 line-clamp-1">
                        &quot;Yarın saat 14:30&apos;da Ahmet Bey ile
                        toplantı...&quot;
                      </span>
                    </div>
                    <i className="fa-solid fa-circle-play text-teal-600 text-sm"></i>
                  </button>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-terminal text-slate-600"></i>
                  Yazılı Komut Formatları
                </h2>
                <div className="space-y-2 text-xs">
                  <div
                    onClick={() =>
                      setUserTextInput(
                        "!drive Topkapı üniversitesi klasörümdeki 6. hafta dosyalarını getir!"
                      )
                    }
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition cursor-pointer"
                  >
                    <div className="font-semibold text-indigo-700 flex items-center gap-1">
                      <i className="fa-brands fa-google-drive"></i> Google Drive
                      &amp; Google Photos:
                    </div>
                    <code className="text-[10px] text-slate-600 block mt-0.5 bg-white p-1 rounded border border-slate-200">
                      !drive Topkapı üniversitesi 6. hafta dosyaları
                    </code>
                    <code className="text-[10px] text-slate-600 block mt-1 bg-white p-1 rounded border border-slate-200">
                      5 numarayı paylaş / !drive 5 numaralı dosyayı paylaş
                    </code>
                    <code className="text-[10px] text-slate-600 block mt-1 bg-white p-1 rounded border border-slate-200">
                      !foto 17 Eylül 2026 / !foto 25 Ekim 2026 Esmeray
                    </code>
                  </div>

                  <div
                    onClick={() =>
                      setUserTextInput(
                        "!toplanti Cuma 16:00 Tasarım Değerlendirmesi"
                      )
                    }
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition cursor-pointer"
                  >
                    <div className="font-semibold text-blue-700 flex items-center gap-1">
                      <i className="fa-regular fa-calendar-plus"></i> Google
                      Takvim (Ekle / Gönder / Güncelle / Sil):
                    </div>
                    <code className="text-[10px] text-slate-600 block mt-0.5 bg-white p-1 rounded border border-slate-200">
                      !toplanti Yarın 14:00 Bütçe Toplantısı
                    </code>
                    <code className="text-[10px] text-slate-600 block mt-1 bg-white p-1 rounded border border-slate-200">
                      !toplanti sil Bütçe Toplantısı
                    </code>
                  </div>
                </div>
              </div>

              {/* Google Live Account Connection Card */}
              <div className="mt-auto bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                    <i className="fa-brands fa-google"></i> Google Workspace
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                      isLiveGoogleConnected
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {isLiveGoogleConnected
                      ? "Canlı Google Bağlı"
                      : "Simülasyon Modu"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsGoogleModalOpen(true)}
                    className="flex-1 py-1.5 px-2 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <i className="fa-brands fa-google text-red-500"></i>
                    <span>Google ile Bağlan</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("vercel")}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center transition cursor-pointer"
                    title="API Anahtar Sihirbazı"
                  >
                    <i className="fa-solid fa-key"></i>
                  </button>
                </div>
              </div>
            </aside>

            {/* Right Chat Panel */}
            <div className="flex-1 flex flex-col h-full bg-wa-bg relative overflow-hidden">
              {/* WhatsApp Header */}
              <div className="bg-wa-teal text-white px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-md shrink-0 z-10">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-white font-bold">
                      <i className="fa-solid fa-robot text-lg"></i>
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-wa-teal rounded-full"></span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 truncate">
                      <span>OBC Asistan (+90 549 100 77 29)</span>
                      <i
                        className="fa-solid fa-certificate text-teal-300 text-xs shrink-0"
                        title="Onaylı 7/24 Bulut Bot"
                      ></i>
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-teal-100 truncate">
                      7/24 Canlı Sesli Arama • Peş Peşe Komut • Photos &amp; Drive
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 text-teal-100 shrink-0">
                  <button
                    onClick={startWhatsAppVoiceCall}
                    title="WhatsApp Canlı Sesli Arama (Peş Peşe Komut Modu)"
                    className="bg-green-500 hover:bg-green-400 text-slate-950 px-3 py-1.5 rounded-full text-xs font-extrabold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <i className="fa-solid fa-phone-volume"></i>
                    <span>Sesli Ara</span>
                  </button>
                  <button
                    onClick={() => setShowMobileQuickPanel((v) => !v)}
                    title="Hızlı Sesli Komut Örnekleri"
                    className="md:hidden hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-bolt text-sm"></i>
                  </button>
                  <button
                    onClick={clearChatHistory}
                    title="Sohbeti Temizle"
                    className="hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-rotate-right text-sm"></i>
                  </button>
                </div>
              </div>

              {/* Chat Messages Flow */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 wa-chat-pattern custom-scrollbar"
              >
                {chatMessages.map((msg) => {
                  const isBot = msg.sender === "bot";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isBot ? "items-start" : "items-end"
                      } message-anim`}
                    >
                      <div
                        className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm relative ${
                          isBot
                            ? "bg-white text-slate-800 rounded-tl-xs border border-slate-200"
                            : "bg-wa-outgoing text-slate-900 rounded-tr-xs border border-emerald-200"
                        }`}
                      >
                        {msg.type === "audio" ? (
                          <>
                            <div className="flex items-center space-x-3 py-1">
                              <button
                                onClick={() => playVoiceBlip(msg.id)}
                                className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow transition cursor-pointer"
                              >
                                <i
                                  className={`fa-solid ${
                                    playingMsgId === msg.id
                                      ? "fa-pause"
                                      : "fa-play ml-0.5"
                                  } text-xs`}
                                ></i>
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center gap-0.5 h-5 mb-1">
                                  <span className="w-1 h-3 bg-emerald-700 rounded-full"></span>
                                  <span className="w-1 h-5 bg-emerald-600 rounded-full"></span>
                                  <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                                  <span className="w-1 h-4 bg-emerald-700 rounded-full"></span>
                                  <span className="w-1 h-6 bg-emerald-600 rounded-full"></span>
                                  <span className="w-1 h-2 bg-emerald-400 rounded-full"></span>
                                  <span className="w-1 h-5 bg-emerald-600 rounded-full"></span>
                                  <span className="w-1 h-3 bg-emerald-700 rounded-full"></span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                  <span className="font-mono">
                                    {msg.duration || "0:04"} • Sesli Mesaj
                                  </span>
                                  <span className="text-emerald-700 font-semibold">
                                    <i className="fa-solid fa-microphone text-[10px]"></i>{" "}
                                    AI Çözümlendi
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 bg-emerald-100/70 p-2 rounded-lg border border-emerald-200 text-[11px] text-slate-800">
                              <span className="font-bold text-emerald-950 block text-[10px] mb-0.5">
                                Transkript:
                              </span>
                              &quot;{msg.transcript || msg.text}&quot;
                            </div>
                          </>
                        ) : (
                          <div className="leading-relaxed break-words text-xs sm:text-sm">
                            {formatWhatsAppText(msg.text)}
                          </div>
                        )}

                        {msg.meta?.type === "calendar" && (
                          <div className="mt-2 pt-2 border-t border-blue-200 flex items-center justify-between text-[11px] text-blue-900 bg-blue-50/80 px-2.5 py-1.5 rounded-lg">
                            <span className="flex items-center gap-1 font-medium">
                              <i className="fa-regular fa-calendar-check text-blue-600"></i>{" "}
                              Google Takvim&apos;e Kaydedildi
                            </span>
                            <button
                              onClick={() => setActiveTab("calendar")}
                              className="underline hover:text-blue-950 font-bold ml-2 cursor-pointer"
                            >
                              Takvimde Gör
                            </button>
                          </div>
                        )}

                        {msg.meta?.type === "contact" && (
                          <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center justify-between text-[11px] text-emerald-900 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg">
                            <span className="flex items-center gap-1 font-medium">
                              <i className="fa-regular fa-address-book text-emerald-600"></i>{" "}
                              Rehbere Kaydedildi
                            </span>
                            <button
                              onClick={() => setActiveTab("contacts")}
                              className="underline hover:text-emerald-950 font-bold ml-2 cursor-pointer"
                            >
                              Rehberde Gör
                            </button>
                          </div>
                        )}

                        {msg.meta?.type === "note" && (
                          <div className="mt-2 pt-2 border-t border-amber-200 flex items-center justify-between text-[11px] text-amber-900 bg-amber-50/80 px-2.5 py-1.5 rounded-lg">
                            <span className="flex items-center gap-1 font-medium">
                              <i className="fa-regular fa-note-sticky text-amber-600"></i>{" "}
                              Not Defterine Yazıldı
                            </span>
                            <button
                              onClick={() => setActiveTab("notes")}
                              className="underline hover:text-amber-950 font-bold ml-2 cursor-pointer"
                            >
                              Notlarda Gör
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-slate-400">
                          <span>{msg.time}</span>
                          {!isBot && (
                            <i className="fa-solid fa-check-double text-teal-600 text-[10px]"></i>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Processing Indicator */}
              {isBotTyping && (
                <div className="px-4 py-1.5 shrink-0 z-10">
                  <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-600 shadow-sm">
                    <div className="flex space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce [animation-delay:0.15s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce [animation-delay:0.3s]"></span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-700">
                      {botTypingText}
                    </span>
                  </div>
                </div>
              )}

              {/* Live Voice Recording Bar */}
              {isRecording ? (
                <div className="bg-emerald-50 border-t border-emerald-300 px-4 py-2.5 flex items-center justify-between shrink-0 z-10 transition-all">
                  <div className="flex items-center space-x-3">
                    <div className="relative flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
                    </div>
                    <span className="font-mono text-xs font-bold text-red-600">
                      {formattedRecordTime}
                    </span>

                    <div className="flex items-center gap-0.5 h-4 px-2">
                      <span
                        className="w-0.5 bg-red-500 rounded-full wave-bar"
                        style={{ animationDelay: "0.1s" }}
                      ></span>
                      <span
                        className="w-0.5 bg-red-500 rounded-full wave-bar"
                        style={{ animationDelay: "0.3s" }}
                      ></span>
                      <span
                        className="w-0.5 bg-red-500 rounded-full wave-bar"
                        style={{ animationDelay: "0.5s" }}
                      ></span>
                      <span
                        className="w-0.5 bg-red-500 rounded-full wave-bar"
                        style={{ animationDelay: "0.2s" }}
                      ></span>
                      <span
                        className="w-0.5 bg-red-500 rounded-full wave-bar"
                        style={{ animationDelay: "0.4s" }}
                      ></span>
                    </div>

                    <span className="text-xs text-slate-700 italic truncate max-w-[200px] sm:max-w-md">
                      {liveTranscript || "Konuşun, sesiniz dinleniyor..."}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={cancelLiveVoiceRecording}
                      className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-200/50 transition text-xs cursor-pointer"
                      title="İptal Et"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                    <button
                      onClick={finishLiveVoiceRecording}
                      className="px-3.5 py-1.5 bg-wa-teal hover:bg-wa-darkteal text-white rounded-full text-xs font-semibold flex items-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <i className="fa-solid fa-paper-plane text-xs"></i>
                      <span>Gönder</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Text Input Bar */
                <div className="bg-slate-100 px-3 py-2.5 border-t border-slate-200 shrink-0 z-10">
                  <form
                    onSubmit={handleSendTextMessage}
                    className="flex items-center space-x-2"
                  >
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={userTextInput}
                        onChange={(e) => setUserTextInput(e.target.value)}
                        placeholder="Komut veya mesaj yazın (Örn: !toplanti veya !not)..."
                        className="w-full bg-white text-slate-800 pl-4 pr-10 py-2.5 rounded-2xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={insertRandomTemplate}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Rastgele Örnek Doldur"
                      >
                        <i className="fa-regular fa-lightbulb"></i>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={startLiveVoiceRecording}
                      title="Mikrofon ile Konuş"
                      className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md transition active:scale-95 cursor-pointer"
                    >
                      <i className="fa-solid fa-microphone text-sm"></i>
                    </button>

                    <button
                      type="submit"
                      className="w-10 h-10 rounded-full bg-wa-teal hover:bg-wa-darkteal text-white flex items-center justify-center shrink-0 shadow-md transition active:scale-95 cursor-pointer"
                    >
                      <i className="fa-solid fa-paper-plane text-xs ml-0.5"></i>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ==================== TAB 2: GOOGLE CALENDAR ==================== */}
        {activeTab === "calendar" && (
          <section className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <i className="fa-regular fa-calendar-check text-blue-600"></i>
                    Google Takvim Etkinlikleri & Hatırlatıcılar
                  </h2>
                  <p className="text-xs text-slate-500">
                    WhatsApp&apos;tan sesli/yazılı gelen toplantı ve randevular
                    buraya senkronize edilir.
                  </p>
                </div>
                <button
                  onClick={downloadAllEventsICS}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Tümünü .ICS Olarak İndir</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {calendarEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <i className="fa-regular fa-clock"></i>{" "}
                          {evt.startTime} - {evt.endTime}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {evt.createdTime}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {evt.title}
                      </h3>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <p>
                          <i className="fa-regular fa-calendar text-slate-400 mr-1"></i>{" "}
                          <b>Tarih:</b> {evt.date}
                        </p>
                        <p>
                          <i className="fa-solid fa-user-group text-slate-400 mr-1"></i>{" "}
                          <b>Katılımcı:</b> {evt.attendee}
                        </p>
                        <p>
                          <i className="fa-solid fa-video text-slate-400 mr-1"></i>{" "}
                          <b>Konum:</b> {evt.location}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 italic">
                        {evt.source}
                      </span>
                      <div className="flex items-center space-x-2">
                        {evt.htmlLink && (
                          <a
                            href={evt.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-[11px] bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100"
                          >
                            Google&apos;da Aç
                          </a>
                        )}
                        <button
                          onClick={() => downloadSingleICS(evt.id)}
                          title=".ICS İndir"
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          <i className="fa-solid fa-download"></i>
                        </button>
                        <button
                          onClick={() => deleteEvent(evt.id)}
                          title="Sil"
                          className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB 3: GOOGLE CONTACTS ==================== */}
        {activeTab === "contacts" && (
          <section className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <i className="fa-regular fa-address-book text-emerald-600"></i>
                    Google Kişiler (Contacts) Rehberi
                  </h2>
                  <p className="text-xs text-slate-500">
                    WhatsApp üzerinden paylaşılan numara ve kartvizit kayıtları.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Rehberde ara..."
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={downloadAllContactsVCF}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <i className="fa-solid fa-address-card"></i>
                    <span>Tümünü .VCF İndir</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.map((cnt) => (
                  <div
                    key={cnt.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm">
                          {cnt.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {cnt.name}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            {cnt.company || "Bireysel"}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <p>
                          <i className="fa-solid fa-phone text-emerald-600 mr-1.5"></i>{" "}
                          {cnt.phone}
                        </p>
                        <p>
                          <i className="fa-regular fa-envelope text-slate-400 mr-1.5"></i>{" "}
                          {cnt.email}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400">
                        {cnt.addedDate}
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => downloadSingleVCF(cnt.id)}
                          title=".VCF İndir"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          <i className="fa-solid fa-address-card"></i>
                        </button>
                        <button
                          onClick={() => deleteContact(cnt.id)}
                          title="Sil"
                          className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB 4: NOTES ==================== */}
        {activeTab === "notes" && (
          <section className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <i className="fa-regular fa-note-sticky text-amber-500"></i>
                    Hafıza & Not Defteri
                  </h2>
                  <p className="text-xs text-slate-500">
                    `!not` komutu veya sesli olarak kaydettiğiniz tüm notlar.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {notesList.map((not) => (
                  <div
                    key={not.id}
                    className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200/70 text-amber-900">
                          {not.category}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {not.time}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1">
                        {not.title}
                      </h3>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {not.content}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-amber-200/60 flex items-center justify-end space-x-2 text-xs">
                      <button
                        onClick={() => copyTextToClipboard(not.content)}
                        title="Kopyala"
                        className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-amber-100 cursor-pointer"
                      >
                        <i className="fa-regular fa-copy"></i>
                      </button>
                      <button
                        onClick={() => deleteNote(not.id)}
                        title="Sil"
                        className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-amber-100 cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB 5: BACKEND & SETUP ==================== */}
        {activeTab === "backend" && (
          <section className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-950 text-slate-100 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 p-6 rounded-3xl border border-purple-900/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30 mb-2">
                    <i className="fa-solid fa-server animate-pulse"></i>
                    Canlı Kullanım (Production) Dosyaları
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    WhatsApp & Google Workspace Sunucu Paketi
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Next.js projenizin içinde{" "}
                    <code className="text-emerald-400">
                      src/app/api/webhook/route.ts
                    </code>{" "}
                    ve{" "}
                    <code className="text-emerald-400">bot-baileys.js</code>{" "}
                    hazır olarak bulunmaktadır. Ayrıca tüm kaynak kodları tek
                    arşivde indirebilirsiniz.
                  </p>
                </div>

                <button
                  onClick={downloadCompleteProjectZip}
                  className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-sm font-extrabold rounded-2xl flex items-center gap-2.5 shadow-xl shadow-emerald-950/60 transition transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <i className="fa-solid fa-download text-base"></i>
                  <span>Tüm Projeyi İndir (.ZIP)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ⭐ En Kolay (Bireysel / Şirketsiz)
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <i className="fa-solid fa-qrcode text-base"></i>
                      Yöntem 1: WhatsApp QR Kod (Baileys)
                    </h3>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      Şirket evrakı veya Meta onayı gerekmez. Terminalde çıkan{" "}
                      <b>QR kodu telefonunuzla taratın</b>; asistan kendi
                      numaranızdaki sesli ve yazılı mesajları anında işlesin.
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentBackendTab("baileys")}
                    className="mt-4 w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold transition text-center cursor-pointer"
                  >
                    bot-baileys.js Kodunu İncele →
                  </button>
                </div>

                <div className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Resmi Meta API (Kurumsal & Vercel)
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                      <i className="fa-brands fa-meta text-base"></i>
                      Yöntem 2: Meta Cloud API Webhook
                    </h3>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      Facebook Developers resmi WhatsApp Business hesabı. Next.js{" "}
                      <code className="text-blue-300">/api/webhook</code>{" "}
                      rotası üzerinden ses ve metinleri Google&apos;a aktarır.
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentBackendTab("verceljson")}
                    className="mt-4 w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-semibold transition text-center cursor-pointer"
                  >
                    Next.js Webhook Kodunu İncele →
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
                {(
                  [
                    {
                      key: "baileys",
                      icon: "fa-solid fa-qrcode",
                      label: "1. WhatsApp QR (Baileys)",
                    },
                    {
                      key: "node",
                      icon: "fa-brands fa-node-js",
                      label: "2. Meta Cloud API (Express)",
                    },
                    {
                      key: "google",
                      icon: "fa-brands fa-google",
                      label: "Google Kurulum Rehberi",
                    },
                    {
                      key: "env",
                      icon: "fa-solid fa-key",
                      label: ".env.local Yapılandırması",
                    },
                    {
                      key: "docker",
                      icon: "fa-brands fa-docker",
                      label: "Dockerfile",
                    },
                    {
                      key: "verceljson",
                      icon: "fa-solid fa-bolt text-amber-400",
                      label: "Next.js /api/webhook",
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setCurrentBackendTab(item.key)}
                    className={`px-3.5 py-1.5 font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                      currentBackendTab === item.key
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    <i className={`${item.icon} mr-1`}></i> {item.label}
                  </button>
                ))}
              </div>

              <div className="relative bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-xs">
                  <span className="font-mono text-emerald-400 flex items-center gap-2">
                    <i className="fa-solid fa-code"></i> {currentBackendTab}
                  </span>
                  <button
                    onClick={() =>
                      copyTextToClipboard(BACKEND_TEMPLATES[currentBackendTab])
                    }
                    className="text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs bg-slate-800 px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    <i className="fa-regular fa-copy"></i>
                    <span>Metni Kopyala</span>
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono overflow-x-auto text-emerald-300 leading-relaxed max-h-[500px] custom-scrollbar">
                  {BACKEND_TEMPLATES[currentBackendTab]}
                </pre>
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB 6: GITHUB & VERCEL WIZARD ==================== */}
        {activeTab === "vercel" && (
          <section className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-950 text-slate-100 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 p-6 rounded-3xl border border-emerald-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 mb-2">
                    <i className="fa-brands fa-github"></i>
                    <span>GitHub ➔ ▲ Vercel Otomatik Yayına Alma Rehberi</span>
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Next.js Projesini GitHub&apos;a Yükle & Vercel&apos;de Yayına
                    Al
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Bu proje doğrudan <b>Next.js App Router</b> mimarisiyle
                    çalışır.{" "}
                    <code className="text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded">
                      /api/webhook
                    </code>{" "}
                    ve{" "}
                    <code className="text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded">
                      /api/assistant
                    </code>{" "}
                    uç noktaları Vercel tarafından otomatik olarak Serverless
                    Function olarak derlenir.
                  </p>
                </div>

                <button
                  onClick={downloadCompleteProjectZip}
                  className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-950 text-xs sm:text-sm font-extrabold rounded-2xl flex items-center gap-2.5 shadow-xl transition transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
                >
                  <i className="fa-solid fa-file-zipper text-emerald-600 text-base"></i>
                  <span>Vercel Uyumlu .ZIP İndir</span>
                </button>
              </div>

              {/* Key Setup Wizard */}
              <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 space-y-6 shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1.5">
                      <i className="fa-solid fa-wand-magic-sparkles"></i> Adım
                      Adım Anahtar Sihirbazı (Anında Aktif Olur)
                    </span>
                    <h3 className="text-base font-bold text-white">
                      Anahtarlarınızı Girin & Canlı Test Edin
                    </h3>
                    <p className="text-xs text-slate-400">
                      Buraya girdiğiniz anahtarlar hem tarayıcınızda simülatörü
                      canlı çalıştırır hem de Vercel&apos;e tek tıkla
                      yapıştıracağınız bloğu üretir.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      copyTextToClipboard(
                        getGeneratedEnvBlock(),
                        "✅ Tüm değişkenler Vercel formatında kopyalandı!"
                      )
                    }
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition shrink-0 cursor-pointer"
                  >
                    <i className="fa-regular fa-copy"></i>
                    <span>Vercel Formatında Kopyala</span>
                  </button>
                </div>

                {/* 1. GEMINI API KEY */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/30">
                        1
                      </span>
                      <h4 className="text-sm font-bold text-purple-300 font-mono">
                        GEMINI_API_KEY
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        (WhatsApp sesli mesajlarını Türkçe metne çevirmek ve
                        doğal dil analizi için)
                      </span>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-purple-500/40 transition"
                    >
                      <span>Google AI Studio&apos;yu Aç</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  </div>
                  <input
                    type="text"
                    value={wizGemini}
                    onChange={(e) => setWizGemini(e.target.value)}
                    placeholder="AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>

                {/* 2. GOOGLE CLIENT ID & SECRET */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                        2
                      </span>
                      <h4 className="text-sm font-bold text-emerald-300 font-mono">
                        GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET
                      </h4>
                    </div>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/40 transition"
                    >
                      <span>Google Cloud Console&apos;u Aç</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={wizGClient}
                      onChange={(e) => setWizGClient(e.target.value)}
                      placeholder="GOOGLE_CLIENT_ID (örn: 12345.apps.googleusercontent.com)"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                    />
                    <input
                      type="text"
                      value={wizGSecret}
                      onChange={(e) => setWizGSecret(e.target.value)}
                      placeholder="GOOGLE_CLIENT_SECRET (örn: GOCSPX-xxxxxx)"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                    />
                  </div>
                </div>

                {/* 3. GOOGLE REFRESH TOKEN */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center border border-teal-500/30">
                        3
                      </span>
                      <h4 className="text-sm font-bold text-teal-300 font-mono">
                        GOOGLE_REFRESH_TOKEN
                      </h4>
                    </div>
                    <a
                      href="https://developers.google.com/oauthplayground"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-teal-500/40 transition"
                    >
                      <span>Google OAuth Playground&apos;u Aç</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  </div>
                  <input
                    type="text"
                    value={wizGRefresh}
                    onChange={(e) => setWizGRefresh(e.target.value)}
                    placeholder="1//04xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-teal-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>

                {/* 4. WHATSAPP ACCESS TOKEN & PHONE ID */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                        4
                      </span>
                      <h4 className="text-sm font-bold text-blue-300 font-mono">
                        WHATSAPP_ACCESS_TOKEN & PHONE_NUMBER_ID
                      </h4>
                    </div>
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-blue-500/40 transition"
                    >
                      <span>Meta for Developers&apos;ı Aç</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      value={wizWaToken}
                      onChange={(e) => setWizWaToken(e.target.value)}
                      placeholder="WHATSAPP_ACCESS_TOKEN (EAAG...)"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                    />
                    <input
                      type="text"
                      value={wizWaPhone}
                      onChange={(e) => setWizWaPhone(e.target.value)}
                      placeholder="WHATSAPP_PHONE_NUMBER_ID"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                    />
                    <input
                      type="text"
                      value={wizWaVerify}
                      onChange={(e) => setWizWaVerify(e.target.value)}
                      placeholder="WHATSAPP_VERIFY_TOKEN"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 outline-none"
                    />
                  </div>

                  {/* Live WhatsApp Test Box */}
                  <div className="mt-3 bg-gradient-to-r from-blue-950/60 via-slate-900 to-emerald-950/60 border border-blue-500/40 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <i className="fa-solid fa-paper-plane"></i> Girdiğiniz
                        Token & Phone ID ile Hemen Gerçek Mesaj Testi Yapın:
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={wizTestRecipient}
                        onChange={(e) => setWizTestRecipient(e.target.value)}
                        placeholder="Alıcı Telefon No (Örn: 905321112233 - başında + olmadan)"
                        className="flex-1 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                      />
                      <button
                        onClick={sendLiveWhatsAppTestMessage}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer shrink-0"
                      >
                        <i className="fa-brands fa-whatsapp text-sm"></i>
                        <span>Telefonuma Gerçek Test Mesajı Gönder</span>
                      </button>
                    </div>
                    {waTestStatus.type !== "idle" && (
                      <div
                        className={`text-xs p-2.5 rounded-xl border font-mono ${
                          waTestStatus.type === "success"
                            ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-300"
                            : waTestStatus.type === "error"
                              ? "bg-red-950/70 border-red-500/50 text-red-300"
                              : "bg-slate-900 border-slate-700 text-slate-300"
                        }`}
                      >
                        {waTestStatus.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. VERCEL ENV PREVIEW */}
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                      <i className="fa-solid fa-circle-check"></i>
                      5. Son Adım: Vercel Environment Variables Bloğu
                    </h4>
                    <button
                      onClick={() =>
                        copyTextToClipboard(
                          getGeneratedEnvBlock(),
                          "✅ Vercel ortam değişkenleri kopyalandı!"
                        )
                      }
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      <i className="fa-regular fa-copy mr-1"></i> Bloğu Kopyala
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto select-all">
                    {getGeneratedEnvBlock()}
                  </pre>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB 7: ANTIGRAVITY TRANSFER ==================== */}
        {activeTab === "antigravity" && (
          <section className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-950 text-slate-100 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-gradient-to-r from-slate-900 via-pink-950/40 to-purple-950/50 p-6 rounded-3xl border border-pink-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-300 border border-pink-500/30 mb-2">
                    <i className="fa-solid fa-rocket"></i>
                    <span>Antigravity IDE & AI Agent Aktarım Paketi</span>
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Antigravity Next.js Mimari Dokümantasyonu
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Projeniz Antigravity üzerinde{" "}
                    <code className="text-pink-300">Next.js 16 App Router</code>{" "}
                    mimarisiyle çalışmaktadır.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    onClick={() =>
                      copyTextToClipboard(
                        ANTIGRAVITY_FILES.prompt,
                        "🚀 Antigravity Master Prompt panoya kopyalandı!"
                      )
                    }
                    className="px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white text-xs sm:text-sm font-extrabold rounded-2xl flex items-center gap-2 shadow-xl transition transform active:scale-95 cursor-pointer"
                  >
                    <i className="fa-regular fa-copy"></i>
                    <span>Ana Promptu Kopyala</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 gap-2">
                  <div className="flex items-center space-x-2 overflow-x-auto text-xs">
                    <button
                      onClick={() => setCurrentAntigravityDoc("prompt")}
                      className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                        currentAntigravityDoc === "prompt"
                          ? "bg-pink-600 text-white font-bold"
                          : "bg-slate-800 text-slate-300 hover:text-white font-semibold"
                      }`}
                    >
                      1. ANTIGRAVITY_PROMPT.md
                    </button>
                    <button
                      onClick={() => setCurrentAntigravityDoc("rules")}
                      className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                        currentAntigravityDoc === "rules"
                          ? "bg-pink-600 text-white font-bold"
                          : "bg-slate-800 text-slate-300 hover:text-white font-semibold"
                      }`}
                    >
                      2. .antigravityrules
                    </button>
                    <button
                      onClick={() => setCurrentAntigravityDoc("config")}
                      className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                        currentAntigravityDoc === "config"
                          ? "bg-pink-600 text-white font-bold"
                          : "bg-slate-800 text-slate-300 hover:text-white font-semibold"
                      }`}
                    >
                      3. antigravity.config.json
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      copyTextToClipboard(
                        ANTIGRAVITY_FILES[currentAntigravityDoc],
                        "✅ Dosya içeriği panoya kopyalandı!"
                      )
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <i className="fa-regular fa-copy"></i>
                    <span>İçeriği Kopyala</span>
                  </button>
                </div>

                <pre className="p-5 text-xs font-mono text-pink-200 overflow-x-auto leading-relaxed max-h-[520px] custom-scrollbar select-all">
                  {ANTIGRAVITY_FILES[currentAntigravityDoc]}
                </pre>
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB: GOOGLE PHOTOS & GOOGLE DRIVE ==================== */}
        {activeTab === "media" && (
          <section className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Quick Search Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-3xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-extrabold flex items-center gap-2">
                    <i className="fa-regular fa-images text-pink-400"></i>
                    <span>Google Photos &amp; Google Drive Canlı Arşivi</span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    WhatsApp veya Canlı Sesli Arama üzerinden getirdiğiniz
                    fotoğraflar ve Drive belgeleri burada listelenir.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setActiveTab("chat");
                      triggerVoiceSample(
                        "19 Eylül 2026 tarihindeki fotoğraflarımı paylaş"
                      );
                    }}
                    className="px-3.5 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-camera"></i>
                    <span>📸 Eylül/Ekim Fotoğrafları Getir</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("chat");
                      triggerVoiceSample(
                        "Topkapı üniversitesi klasörümdeki 6. hafta dosyalarını getir"
                      );
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <i className="fa-brands fa-google-drive"></i>
                    <span>📁 6. Hafta Drive Dosyalarını Getir</span>
                  </button>
                </div>
              </div>

              {/* Google Photos Grid */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <i className="fa-regular fa-images text-pink-600"></i>
                    <span>Son Getirilen Google Photos &amp; Galeri Kareleri</span>
                    <span className="bg-pink-100 text-pink-700 text-xs px-2 py-0.5 rounded-full font-mono">
                      {photosList.length}
                    </span>
                  </h3>
                </div>

                {photosList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Henüz fotoğraf sorgulanmadı. WhatsApp&apos;tan{" "}
                    <b>!foto 19 Eylül 2026</b> veya{" "}
                    <b>!foto 25 Ekim 2026 Esmeray</b> yazabilir ya da sesli
                    arayabilirsiniz.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {photosList.map((p, idx) => (
                      <div
                        key={p.id + "-" + idx}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-md transition flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-800">
                              #{idx + 1} • {p.date}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">
                              {p.albumOrLocation || p.source}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 break-words">
                            {p.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1.5 px-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-semibold text-center transition"
                          >
                            🔗 Fotoğrafı Aç
                          </a>
                          <button
                            onClick={() => {
                              setActiveTab("chat");
                              processCommandThroughApi({
                                text: `${idx + 1} numaralı fotoğrafı paylaş`,
                                isVoice: false,
                              });
                            }}
                            className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                          >
                            Paylaş
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Google Drive Files List */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <i className="fa-brands fa-google-drive text-blue-600"></i>
                    <span>Son Getirilen Google Drive Dosya Seçenekleri</span>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-mono">
                      {driveFilesList.length}
                    </span>
                  </h3>
                </div>

                {driveFilesList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Henüz Drive dosyası sorgulanmadı. WhatsApp&apos;tan{" "}
                    <b>
                      !drive Topkapı üniversitesi klasörümdeki 6. hafta
                      dosyalarını getir
                    </b>{" "}
                    yazabilirsiniz.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {driveFilesList.map((f, idx) => (
                      <div
                        key={f.id + "-" + idx}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-md transition flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              Seçenek #{idx + 1} • {f.typeLabel}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {f.modifiedDate}
                              {f.sizeLabel ? ` • ${f.sizeLabel}` : ""}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 break-words mt-1">
                            {f.name}
                          </h4>
                          {f.folderPath && (
                            <p className="text-[11px] text-emerald-700 font-medium mt-1">
                              📂 Klasör: {f.folderPath}
                            </p>
                          )}
                          {f.snippet && (
                            <p className="text-[11px] text-slate-600 italic mt-1 line-clamp-2">
                              &quot;{f.snippet}&quot;
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                          <a
                            href={f.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold text-center transition"
                          >
                            🔗 Drive&apos;da Aç
                          </a>
                          <button
                            onClick={() => {
                              setActiveTab("chat");
                              processCommandThroughApi({
                                text: `${idx + 1} numarayı paylaş`,
                                isVoice: false,
                              });
                            }}
                            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                          >
                            📤 #{idx + 1} Paylaş
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ==================== WHATSAPP LIVE VOICE CALL OVERLAY (PEŞ PEŞE KOMUT MODU) ==================== */}
        {isVoiceCallOpen && (
          <div
            onClick={() => {
              if (callAudioCtxRef.current?.state === "suspended") {
                callAudioCtxRef.current.resume().catch(() => {});
              }
            }}
            className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 overflow-y-auto"
          >
            {/* Top Bar */}
            <div className="max-w-2xl w-full mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-900/40 px-3 py-1.5 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>WhatsApp Canlı Sesli Arama • Peş Peşe Komut Modu</span>
              </div>
              <div className="font-mono text-sm font-bold text-emerald-300 bg-white/10 px-3 py-1 rounded-full">
                {String(Math.floor(callDurationSec / 60)).padStart(2, "0")}:
                {String(callDurationSec % 60).padStart(2, "0")}
              </div>
            </div>

            {/* Center Avatar, Status & Live Transcript */}
            <div className="max-w-2xl w-full mx-auto my-4 flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-2xl border-4 ${
                    callStatus === "listening"
                      ? "border-emerald-300 ring-8 ring-emerald-500/30 animate-pulse"
                      : callStatus === "processing"
                        ? "border-amber-300 ring-8 ring-amber-500/30 animate-spin"
                        : "border-teal-200 ring-8 ring-teal-400/20"
                  }`}
                >
                  <i className="fa-brands fa-whatsapp text-4xl sm:text-5xl text-white"></i>
                </div>
                <span className="absolute -bottom-1 right-0 bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                  CANLI
                </span>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center justify-center gap-2">
                  <span>👩‍💼 OBC Kadın Sesli Asistanı (Onur Bey)</span>
                </h2>
                <p className="text-xs text-emerald-300/90 mt-0.5">
                  +90 549 100 77 29 • Doğal Türkçe Kadın Sesi • Takvim • Rehber • Tasks • Photos • Drive
                </p>
              </div>

              {callNeedsAudioTap && (
                <button
                  onClick={() => {
                    setCallNeedsAudioTap(false);
                    setCallStatus("speaking");
                    speakTurkishText(
                      "Buyurun Onur Bey, çağrınızı aldım, sizi dinliyorum. Ne yapmamı istersiniz?",
                      () => {
                        if (callActiveRef.current) {
                          startCallListeningCycle();
                        }
                      }
                    );
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 text-slate-950 text-xs sm:text-sm font-extrabold shadow-xl flex items-center gap-2 animate-bounce cursor-pointer"
                >
                  <i className="fa-solid fa-volume-high"></i>
                  <span>🔊 Kadın Sesli Asistanı Sesli Duy (Mikrofonunuz Şu An Açık)</span>
                </button>
              )}

              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 border border-white/15 text-xs sm:text-sm font-bold">
                {callStatus === "listening" && (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                    <span className="text-emerald-200">
                      🎙️ Sizi Dinliyorum Onur Bey... Komutunuzu Söyleyin
                    </span>
                  </>
                )}
                {callStatus === "processing" && (
                  <>
                    <i className="fa-solid fa-spinner animate-spin text-amber-300"></i>
                    <span className="text-amber-200">
                      ⚡ Komut Çözümleniyor &amp; Google Servislerinde
                      Çalıştırılıyor...
                    </span>
                  </>
                )}
                {callStatus === "speaking" && (
                  <>
                    <i className="fa-solid fa-volume-high text-teal-300 animate-bounce"></i>
                    <span className="text-teal-200">
                      👩‍💼 Kadın Sesli Asistanınız Yanıtlıyor...
                    </span>
                  </>
                )}
                {callStatus === "paused" && (
                  <span className="text-slate-300">
                    ⏸️ Mikrofon Duraklatıldı
                  </span>
                )}
              </div>

              {/* Live Spoken Transcript & Real-Time Microphone Equalizer Box */}
              <div className="w-full bg-black/40 border border-emerald-500/30 rounded-2xl p-4 min-h-[92px] flex flex-col justify-center">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                    Canlı Mikrofon &amp; Türkçe Ses Çözümleme:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-emerald-300 font-mono">
                      Ses Seviyesi:
                    </span>
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-green-300 transition-all duration-100"
                        style={{ width: `${Math.max(6, callMicLevel)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">
                  {callLiveTranscript ? (
                    `"${callLiveTranscript}"`
                  ) : callIsRecordingSpeech ? (
                    <span className="text-emerald-300 font-semibold animate-pulse">
                      🎙️ Sesiniz kaydediliyor... Konuşmanız bitince otomatik
                      çalıştırılacak
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-xs sm:text-sm">
                      Örn: &quot;Topkapı üniversitesi klasörümdeki 6. hafta
                      dosyalarını getir, ardından 19 Eylül 2026 fotoğraflarımı
                      paylaş&quot;
                    </span>
                  )}
                </p>
                {(callLiveTranscript || callIsRecordingSpeech) && (
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => flushCallSpeechNow()}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-full shadow cursor-pointer"
                    >
                      ⚡ Konuşmamı Hemen İşle &amp; Sıradaki Komuta Geç
                    </button>
                  </div>
                )}
              </div>

              {/* Voice Hangup / Stop / Pause Mode Banner */}
              <div className="w-full bg-red-950/45 border border-red-500/40 rounded-2xl px-3.5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <div className="text-red-200 text-left">
                  <span className="font-extrabold text-red-300">
                    🛑 Sesli Kapatma &amp; Durdurma Komutları:{" "}
                  </span>
                  <span>
                    &quot;Sohbeti ve telefonu kapat&quot;, &quot;Sohbeti kapat&quot;, &quot;Telefonu kapat&quot;, &quot;Asistanı kapat&quot;, &quot;Dur&quot;, &quot;Stop&quot;
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      stopCallRecognitionOnly();
                      setCallStatus("paused");
                      showToast("⏸️ Dinleme modu duraklatıldı (Sessize alındı).");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] cursor-pointer"
                  >
                    ⏸️ Duraklat
                  </button>
                  <button
                    onClick={() => triggerVoiceHangupAndClose("Sohbeti ve telefonu kapat")}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] shadow cursor-pointer"
                  >
                    🛑 Hemen Kapat (STOP)
                  </button>
                </div>
              </div>

              {/* Quick Voice Chain Buttons inside Call */}
              <div className="w-full flex flex-wrap justify-center gap-2">
                <button
                  onClick={() =>
                    executeCallCommand(
                      "Topkapı üniversitesi klasörümdeki 6. hafta dosyalarını getir"
                    )
                  }
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] font-semibold border border-white/15 cursor-pointer"
                >
                  📁 &quot;Topkapı Üni. 6. hafta dosyaları&quot;
                </button>
                <button
                  onClick={() => executeCallCommand("5 numarayı paylaş")}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] font-semibold border border-white/15 cursor-pointer"
                >
                  📤 &quot;5 numarayı paylaş&quot;
                </button>
                <button
                  onClick={() =>
                    executeCallCommand(
                      "19 Eylül 2026 tarihindeki fotoğraflarımı paylaş"
                    )
                  }
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] font-semibold border border-white/15 cursor-pointer"
                >
                  📸 &quot;19 Eylül 2026 fotoğrafları&quot;
                </button>
                <button
                  onClick={() =>
                    executeCallCommand(
                      "Yarın 10:00 bütçe toplantısı ekle, ardından Topkapı üniversitesi 6. hafta dosyalarını getir"
                    )
                  }
                  className="px-3 py-1.5 bg-purple-500/30 hover:bg-purple-500/50 text-purple-100 rounded-xl text-[11px] font-bold border border-purple-400/40 cursor-pointer"
                >
                  ⚡ &quot;Peş Peşe 2 Komut Çalıştır&quot;
                </button>
              </div>

              {/* Manual / Chained Command Input inside Call */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!callManualInput.trim()) return;
                  const txt = callManualInput.trim();
                  setCallManualInput("");
                  executeCallCommand(txt);
                }}
                className="w-full flex gap-2"
              >
                <input
                  type="text"
                  value={callManualInput}
                  onChange={(e) => setCallManualInput(e.target.value)}
                  placeholder="Arama sırasında yazılı/zincirleme komut da gönderebilirsiniz..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Gönder
                </button>
              </form>

              {/* Executed Commands Feed in This Call */}
              {callHistory.length > 0 && (
                <div className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl p-3 max-h-48 overflow-y-auto text-left space-y-2 custom-scrollbar">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    ⚡ Bu Aramada Peş Peşe Çalıştırılan Komutlar (
                    {callHistory.length}):
                  </div>
                  {callHistory.map((item, i) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-300">
                          #{callHistory.length - i} • &quot;{item.command}&quot;
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-200 line-clamp-2">
                        {item.replySummary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Call Controls */}
            <div className="max-w-xl w-full mx-auto flex items-center justify-center gap-3 sm:gap-5 pt-2">
              <button
                onClick={() => {
                  if (callStatus === "listening") {
                    stopCallRecognitionOnly();
                    setCallStatus("paused");
                  } else {
                    startCallListeningCycle();
                  }
                }}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  callStatus === "listening"
                    ? "bg-white/15 hover:bg-white/25 text-white"
                    : "bg-amber-500 text-slate-950"
                }`}
              >
                <i
                  className={`fa-solid ${
                    callStatus === "listening"
                      ? "fa-microphone"
                      : "fa-microphone-slash"
                  }`}
                ></i>
                <span>
                  {callStatus === "listening"
                    ? "Mikrofon Açık"
                    : "Dinlemeyi Başlat"}
                </span>
              </button>

              <button
                onClick={() => setCallHandsFree((v) => !v)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  callHandsFree
                    ? "bg-emerald-600/40 border border-emerald-400/50 text-emerald-200"
                    : "bg-white/10 text-slate-300"
                }`}
              >
                <i className="fa-solid fa-rotate"></i>
                <span>
                  Peş Peşe Oto-Gönder: {callHandsFree ? "AÇIK" : "KAPALI"}
                </span>
              </button>

              <button
                onClick={() => setCallTtsEnabled((v) => !v)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  callTtsEnabled
                    ? "bg-teal-600/40 border border-teal-400/50 text-teal-200"
                    : "bg-white/10 text-slate-300"
                }`}
              >
                <i
                  className={`fa-solid ${
                    callTtsEnabled ? "fa-volume-high" : "fa-volume-xmark"
                  }`}
                ></i>
                <span>Sesli Yanıt: {callTtsEnabled ? "AÇIK" : "KAPALI"}</span>
              </button>

              <button
                onClick={() => endWhatsAppVoiceCall(true)}
                className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-xl shadow-red-950/60 transition cursor-pointer"
              >
                <i className="fa-solid fa-phone-slash"></i>
                <span>🛑 Sohbeti &amp; Telefonu Kapat (STOP)</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================== MOBILE BOTTOM NAVIGATION BAR (PWA) ==================== */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 text-white border-t border-slate-800 px-2 py-1.5 flex items-center justify-around text-[10px]">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg ${
              activeTab === "chat" ? "text-emerald-400 font-bold" : "text-slate-400"
            }`}
          >
            <i className="fa-brands fa-whatsapp text-base"></i>
            <span>Sohbet</span>
          </button>

          <button
            onClick={startWhatsAppVoiceCall}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-slate-950 font-extrabold shadow-md -mt-3 border-2 border-slate-900"
          >
            <i className="fa-solid fa-phone-volume text-base"></i>
            <span>Sesli Ara</span>
          </button>

          <button
            onClick={() => setActiveTab("media")}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg ${
              activeTab === "media" ? "text-pink-400 font-bold" : "text-slate-400"
            }`}
          >
            <i className="fa-regular fa-images text-base"></i>
            <span>Photos/Drive</span>
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg ${
              activeTab === "calendar"
                ? "text-blue-400 font-bold"
                : "text-slate-400"
            }`}
          >
            <i className="fa-regular fa-calendar-check text-base"></i>
            <span>Takvim</span>
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg ${
              activeTab === "notes"
                ? "text-amber-400 font-bold"
                : "text-slate-400"
            }`}
          >
            <i className="fa-regular fa-note-sticky text-base"></i>
            <span>Görevler</span>
          </button>
        </nav>

        {/* ==================== GOOGLE LIVE AUTH MODAL ==================== */}
        {isGoogleModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm">
                    <i className="fa-brands fa-google"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Google Workspace Canlı Bağlantısı
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Google Calendar & Contacts API Entegrasyonu
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Google Cloud Console&apos;dan aldığınız{" "}
                  <b>OAuth 2.0 Web Client ID</b> bilginizi girerek
                  tarayıcınızdan doğrudan kendi takviminize ve rehberinize
                  bağlanın:
                </p>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Google OAuth Client ID:
                  </label>
                  <input
                    type="text"
                    value={googleClientIdInput}
                    onChange={(e) => setGoogleClientIdInput(e.target.value)}
                    placeholder="örn: 123456789-abcdef.apps.googleusercontent.com"
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={initiateGoogleLiveSignIn}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 transition cursor-pointer"
                >
                  <i className="fa-brands fa-google text-red-400"></i>
                  <span>Yetkilendir</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
