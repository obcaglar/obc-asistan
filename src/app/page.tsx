"use client";

import React, { useState, useEffect, useRef } from "react";
import type {
  CalendarItem,
  ContactItem,
  NoteItem,
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
  const [calendarEvents, setCalendarEvents] = useState<CalendarItem[]>(
    INITIAL_CALENDAR_EVENTS
  );
  const [contactsList, setContactsList] =
    useState<ContactItem[]>(INITIAL_CONTACTS);
  const [notesList, setNotesList] = useState<NoteItem[]>(INITIAL_NOTES);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    INITIAL_CHAT_MESSAGES
  );

  const [userTextInput, setUserTextInput] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [botTypingText, setBotTypingText] = useState(
    "Ses çözümleniyor & Google API çağrılıyor..."
  );

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);

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
  const [wizTestRecipient, setWizTestRecipient] = useState("");
  const [waTestStatus, setWaTestStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  // Toast notification state
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveTranscriptRef = useRef<string>("");

  // Load persisted data from localStorage & fetch server env status
  useEffect(() => {
    try {
      const savedCal = localStorage.getItem("obc_calendar_events");
      if (savedCal) setCalendarEvents(JSON.parse(savedCal));

      const savedCnt = localStorage.getItem("obc_contacts_list");
      if (savedCnt) setContactsList(JSON.parse(savedCnt));

      const savedNot = localStorage.getItem("obc_notes_list");
      if (savedNot) setNotesList(JSON.parse(savedNot));

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

    fetch("/api/assistant")
      .then((r) => r.json())
      .then((data) => {
        if (data?.envStatus) {
          setServerEnvStatus(data.envStatus);
        }
      })
      .catch(() => {});

    const syncInterval = setInterval(() => {
      fetch("/api/assistant")
        .then((r) => r.json())
        .then((data) => {
          if (data?.recentWebhookEvents) {
            const { calendars, contacts, notes } = data.recentWebhookEvents;
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
          }
        })
        .catch(() => {});
    }, 3000);

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
        meta = {
          type: "note",
          id: result.note.id,
          usedGemini: result.usedGemini,
        };
        showToast("📝 Not başarıyla kaydedildi!");
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
    } catch {
      setIsBotTyping(false);
      showToast("İstek işlenirken bir bağlantı hatası oluştu.");
    }
  }

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
    showToast("🎤 Sesli mesaj simüle edildi!");
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

  const isLiveGoogleConnected = Boolean(
    googleAccessToken ||
      serverEnvStatus.hasGoogleOAuth ||
      (wizGClient && wizGSecret && wizGRefresh)
  );

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

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={downloadCompleteProjectZip}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition transform active:scale-95 cursor-pointer"
            >
              <i className="fa-solid fa-file-zipper text-sm"></i>
              <span>📦 Projeyi İndir (.ZIP)</span>
            </button>

            <nav className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs overflow-x-auto">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-brands fa-whatsapp"></i>
                <span>WhatsApp Simülatörü</span>
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
                <span>Google Takvim</span>
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
                <span>Google Kişiler</span>
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
                <span>Not Defteri</span>
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
                <span>Canlı Kurulum</span>
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
                <span>GitHub & Vercel</span>
              </button>

              <button
                onClick={() => setActiveTab("antigravity")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "antigravity"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <i className="fa-solid fa-wand-magic-sparkles text-pink-400"></i>
                <span>Antigravity Aktarım</span>
                <span className="bg-pink-500/20 text-pink-300 text-[9px] px-1.5 py-0.2 rounded-full font-bold border border-pink-500/30">
                  HAZIR
                </span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* TOAST */}
        <div
          className={`fixed bottom-4 right-4 z-50 transform transition-all duration-300 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs pointer-events-none ${
            toastMsg ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
          }`}
        >
          <i className="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
          <span>{toastMsg}</span>
        </div>

        {/* ==================== TAB 1: WHATSAPP SIMULATOR ==================== */}
        {activeTab === "chat" && (
          <section className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
            {/* Left Sidebar */}
            <aside className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-4 space-y-4">
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-microphone-lines text-teal-600"></i>
                  Canlı Sesli Test Senaryoları
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Aşağıdaki butonlara tıklayarak WhatsApp sesli mesajı (PTT)
                  gibi komut verin:
                </p>

                <div className="space-y-2">
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

                  <button
                    onClick={() =>
                      triggerVoiceSample(
                        "Rehbere kaydet: Avukat Selin Arslan, telefon 0532 999 1122, şirket Arslan Hukuk"
                      )
                    }
                    className="w-full text-left p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-user-plus text-emerald-600 group-hover:scale-110 transition"></i>{" "}
                        Ses: Kişi Kaydet
                      </span>
                      <span className="text-[11px] text-emerald-700/90 line-clamp-1">
                        &quot;Rehbere kaydet: Avukat Selin Arslan...&quot;
                      </span>
                    </div>
                    <i className="fa-solid fa-circle-play text-emerald-600 text-sm"></i>
                  </button>

                  <button
                    onClick={() =>
                      triggerVoiceSample(
                        "Not al: Haftalık sunucu yedeklerini kontrol et ve SSL sertifikasını yenile"
                      )
                    }
                    className="w-full text-left p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-note-sticky text-amber-600 group-hover:scale-110 transition"></i>{" "}
                        Ses: Hızlı Not Al
                      </span>
                      <span className="text-[11px] text-amber-700/90 line-clamp-1">
                        &quot;Not al: Haftalık sunucu yedeklerini
                        kontrol...&quot;
                      </span>
                    </div>
                    <i className="fa-solid fa-circle-play text-amber-600 text-sm"></i>
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
                      !toplanti gönder Bütçe Toplantısı ali@ornek.com
                    </code>
                    <code className="text-[10px] text-slate-600 block mt-1 bg-white p-1 rounded border border-slate-200">
                      !toplanti güncelle Bütçe Toplantısı Yarın 16:30
                    </code>
                    <code className="text-[10px] text-slate-600 block mt-1 bg-white p-1 rounded border border-slate-200">
                      !toplanti sil Bütçe Toplantısı
                    </code>
                  </div>

                  <div
                    onClick={() =>
                      setUserTextInput(
                        "!rehber Zeynep Kaya +905331112233 zeynep@firma.com"
                      )
                    }
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition cursor-pointer"
                  >
                    <div className="font-semibold text-emerald-700 flex items-center gap-1">
                      <i className="fa-regular fa-id-badge"></i> Google Kişiler
                      (Ekle / Güncelle / Sil):
                    </div>
                    <code className="text-[10px] text-slate-600 block mt-0.5 bg-white p-1 rounded border border-slate-200">
                      !rehber Ali Kaya 05321112233 ali@kaya.com
                    </code>
                    <code className="text-[10px] text-slate-600 block mt-1 bg-white p-1 rounded border border-slate-200">
                      !rehber güncelle Ali Kaya 05329998877
                    </code>
                    <code className="text-[10px] text-slate-600 block mt-1 bg-white p-1 rounded border border-slate-200">
                      !rehber sil Ali Kaya
                    </code>
                  </div>

                  <div
                    onClick={() =>
                      setUserTextInput(
                        "!not Market: Filtre kahve, çavdar ekmeği ve maden suyu"
                      )
                    }
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition cursor-pointer"
                  >
                    <div className="font-semibold text-amber-700 flex items-center gap-1">
                      <i className="fa-regular fa-file-lines"></i> Not Defteri:
                    </div>
                    <code className="text-[11px] text-slate-600 block mt-0.5 bg-white p-1 rounded border border-slate-200">
                      !not [Not Metniniz]
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
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Kendi kişisel Takvim & Rehberinizle canlı eşleştirmek için
                  OAuth ile yetkilendirin.
                </p>
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
              <div className="bg-wa-teal text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0 z-10">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-white font-bold">
                      <i className="fa-solid fa-robot text-lg"></i>
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-wa-teal rounded-full"></span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-1.5">
                      Google Workspace Asistanı
                      <i
                        className="fa-solid fa-certificate text-teal-300 text-xs"
                        title="Onaylı Bot"
                      ></i>
                    </h3>
                    <p className="text-[11px] text-teal-100 flex items-center gap-1">
                      <span>çevrimiçi</span> •{" "}
                      <span>Takvim / Kişiler / Notlar (Next.js API)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-teal-100">
                  <button
                    onClick={downloadCompleteProjectZip}
                    title="Sunucu Kodlarını İndir"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span className="hidden sm:inline">ZIP İndir</span>
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
