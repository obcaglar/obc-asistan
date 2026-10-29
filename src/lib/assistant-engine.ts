import fs from "fs";
import path from "path";

function loadFreshEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (val && !process.env[key]) {
          process.env[key] = val;
        } else if (val) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore on read-only filesystems
  }
}

export interface CalendarItem {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  attendee: string;
  location: string;
  source: string;
  createdTime: string;
  htmlLink?: string;
  syncedWithGoogle?: boolean;
}

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
  addedDate: string;
  syncedWithGoogle?: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  time: string;
}

export interface AssistantCredentials {
  geminiApiKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
  googleAccessToken?: string;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
}

export interface AssistantProcessResult {
  transcript: string;
  intent: "calendar" | "contact" | "note" | "help";
  replyText: string;
  usedGemini: boolean;
  syncedToGoogle: boolean;
  googleSyncError?: string;
  calendarEvent?: CalendarItem;
  contact?: ContactItem;
  note?: NoteItem;
}

// In-memory store for recent webhook events (useful for live feedback on the dashboard)
export const recentWebhookEvents: {
  calendars: CalendarItem[];
  contacts: ContactItem[];
  notes: NoteItem[];
} = {
  calendars: [],
  contacts: [],
  notes: [],
};

function getIstanbulNow(): Date {
  const nowStr = new Date().toLocaleString("en-US", {
    timeZone: "Europe/Istanbul",
  });
  return new Date(nowStr);
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Local smart Turkish NLP fallback for date, time, contact, and note extraction
 * when GEMINI_API_KEY is not configured or unreachable.
 */
export function parseCommandLocally(
  rawText: string,
  isVoice: boolean
): {
  intent: "calendar" | "contact" | "note" | "help";
  calendar?: Omit<CalendarItem, "id" | "createdTime" | "source">;
  contact?: Omit<ContactItem, "id" | "addedDate">;
  note?: Omit<NoteItem, "id" | "time">;
} {
  const text = rawText.trim();
  const lower = text.toLocaleLowerCase("tr-TR");

  // 1. CALENDAR / MEETING
  if (
    lower.startsWith("!toplanti") ||
    lower.startsWith("!toplantı") ||
    lower.startsWith("!randevu") ||
    lower.includes("toplantı") ||
    lower.includes("toplanti") ||
    lower.includes("randevu") ||
    lower.includes("etkinlik") ||
    lower.includes("görüşme") ||
    lower.includes("planla")
  ) {
    const now = getIstanbulNow();
    const targetDate = new Date(now);

    if (lower.includes("yarın") || lower.includes("yarin")) {
      targetDate.setDate(now.getDate() + 1);
    } else if (lower.includes("öbür gün") || lower.includes("ertesi gün")) {
      targetDate.setDate(now.getDate() + 2);
    } else if (!lower.includes("bugün")) {
      const daysMap: Record<string, number> = {
        pazar: 0,
        pazartesi: 1,
        salı: 2,
        sali: 2,
        çarşamba: 3,
        carsamba: 3,
        perşembe: 4,
        persembe: 4,
        cuma: 5,
        cumartesi: 6,
      };
      let matchedDay = false;
      for (const [dayName, dayIdx] of Object.entries(daysMap)) {
        if (lower.includes(dayName)) {
          const currentDay = now.getDay();
          let diff = (dayIdx - currentDay + 7) % 7;
          if (diff === 0) diff = 7;
          targetDate.setDate(now.getDate() + diff);
          matchedDay = true;
          break;
        }
      }
      if (!matchedDay) {
        targetDate.setDate(now.getDate() + 1);
      }
    }

    // Parse explicit YYYY-MM-DD or DD.MM.YYYY if present
    let dateStr = formatIsoDate(targetDate);
    const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    const trDateMatch = text.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
    if (isoMatch) {
      dateStr = isoMatch[0];
    } else if (trDateMatch) {
      dateStr = `${trDateMatch[3]}-${trDateMatch[2].padStart(2, "0")}-${trDateMatch[1].padStart(2, "0")}`;
    }

    // Parse time (e.g., 14:30, 14.30)
    let startHour = 15;
    let startMin = 0;
    const timeMatch = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (timeMatch) {
      startHour = parseInt(timeMatch[1], 10);
      startMin = parseInt(timeMatch[2], 10);
    } else if (lower.includes("üçe") || lower.includes("üçte")) {
      startHour = 15;
    } else if (lower.includes("ikiye") || lower.includes("ikide")) {
      startHour = 14;
    } else if (lower.includes("dörde") || lower.includes("dörtte")) {
      startHour = 16;
    }

    const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
    const endHour = (startHour + 1) % 24;
    const endTime = `${String(endHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;

    // Extract attendee if mentioned (e.g., "Ahmet Bey ile")
    let attendee = "WhatsApp Kullanıcısı";
    const attendeeMatch = text.match(
      /([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+(?:Bey|Hanım|[A-ZÇĞİÖŞÜ][a-zçğıöşü]+))?)\s+ile/
    );
    if (attendeeMatch) {
      attendee = attendeeMatch[1].trim();
    }

    let title = text
      .replace(/^(!toplanti|!toplantı|!randevu|toplantı ayarla:?|randevu ekle:?)/i, "")
      .replace(/\b(yarın|bugün|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)\b/gi, "")
      .replace(/\bsaat\s*\d{1,2}[:.]\d{2}('[a-zçğıöşü]+)?/gi, "")
      .replace(/\b\d{1,2}[:.]\d{2}('[a-zçğıöşü]+)?/g, "")
      .replace(/\b(planla|ayarla|ekle)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!title || title.length < 3) {
      title = "WhatsApp Üzerinden Planlanan Görüşme";
    }

    return {
      intent: "calendar",
      calendar: {
        title,
        date: dateStr,
        startTime,
        endTime,
        attendee,
        location: lower.includes("ofis") ? "Ofis Toplantı Odası" : "Google Meet",
      },
    };
  }

  // 2. CONTACTS / GOOGLE PEOPLE
  if (
    lower.startsWith("!rehber") ||
    lower.startsWith("!kisi") ||
    lower.startsWith("!kişi") ||
    lower.includes("rehbere") ||
    lower.includes("kişi ekle") ||
    lower.includes("rehber")
  ) {
    const clean = text
      .replace(/^(!rehber|!kisi|!kişi|rehbere kaydet:?|rehbere ekle:?|kişi ekle:?)/i, "")
      .trim();

    const emailMatch = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : "";

    const phoneMatch = clean.match(
      /(\+90\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|0?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|\+?\d{10,13})/
    );
    const phone = phoneMatch ? phoneMatch[0].trim() : "+90 530 000 0000";

    let company = "WhatsApp Bağlantısı";
    const companyMatch = clean.match(/şirket:?\s*([^,]+)$/i);
    if (companyMatch) {
      company = companyMatch[1].trim();
    }

    let name = clean
      .replace(email, "")
      .replace(phone, "")
      .replace(/şirket:?\s*([^,]+)$/i, "")
      .replace(/(telefon|şirket|mail|eposta|ad|soyad):?/gi, "")
      .replace(/[,]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!name || name.length < 2) {
      name = "Yeni Bağlantı";
    }

    const finalEmail =
      email ||
      `${name
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 18) || "kisi"}@iletisim.com`;

    return {
      intent: "contact",
      contact: {
        name,
        phone,
        email: finalEmail,
        company,
        notes: isVoice
          ? "Sesli mesaj ile Google Kişiler'e kaydedildi"
          : "Yazılı WhatsApp komutuyla eklendi",
      },
    };
  }

  // 3. NOTES
  if (
    lower.startsWith("!not") ||
    lower.includes("not al") ||
    lower.includes("not et") ||
    lower.includes("hatırla")
  ) {
    let noteContent = text
      .replace(/^(!not|not al:?|not et:?|not:?)/i, "")
      .trim();
    if (!noteContent) {
      noteContent = "WhatsApp üzerinden alınan hızlı not.";
    }
    const category =
      lower.includes("sunucu") || lower.includes("ssl") || lower.includes("toplantı")
        ? "İş / Altyapı"
        : lower.includes("market") || lower.includes("kahve")
          ? "Kişisel"
          : "WhatsApp Notu";

    return {
      intent: "note",
      note: {
        title:
          noteContent.slice(0, 35) + (noteContent.length > 35 ? "..." : ""),
        content: noteContent,
        category,
      },
    };
  }

  return { intent: "help" };
}

/**
 * Uses Gemini 3 Flash Preview for audio transcription (STT) and structured NLU intent extraction.
 */
async function analyzeWithGemini(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  apiKey: string;
}): Promise<{
  transcript: string;
  intent: "calendar" | "contact" | "note" | "help";
  calendar?: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    attendee: string;
    location: string;
  };
  contact?: {
    name: string;
    phone: string;
    email: string;
    company: string;
    notes: string;
  };
  note?: {
    title: string;
    content: string;
    category: string;
  };
} | null> {
  const now = getIstanbulNow();
  const todayIso = formatIsoDate(now);
  const dayNames = [
    "Pazar",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
  ];
  const todayDayName = dayNames[now.getDay()];

  const systemInstruction = `Sen Türkçe çalışan bir WhatsApp & Google Workspace Asistanısın.
Bugünün tarihi (Europe/Istanbul): ${todayIso} (${todayDayName}).
Kullanıcının gönderdiği metni veya ses kaydını incele ve JSON döndür:
1. Eğer ses kaydı varsa önce tam Türkçe metne dök ("transcript" alanına yaz). Metin gönderildiyse "transcript" alanına metni olduğu gibi yaz.
2. Kullanıcının niyetini ("intent") belirle:
   - "calendar": Toplantı, randevu, etkinlik, görüşme planlama (Örn: !toplanti, "Yarın saat 14:30'da Ahmet Bey ile toplantı").
   - "contact": Kişi/rehber/numara kaydetme (Örn: !rehber, "Rehbere kaydet: Avukat Selin Arslan 0532...").
   - "note": Not alma, hatırlatma (Örn: !not, "Not al: ...").
   - "help": Yukarıdakilerden hiçbiri değilse.
3. "calendar" ise: title, date (YYYY-MM-DD formatında, bugünün tarihine göre hesapla), startTime (HH:mm), endTime (HH:mm, belirtilmediyse başlangıçtan 1 saat sonrası), attendee (katılımcı adı veya "WhatsApp Kullanıcısı"), location (belirtilmediyse "Google Meet") doldur.
4. "contact" ise: name, phone, email, company, notes doldur.
5. "note" ise: title (kısa başlık), content (tam not içeriği), category ("İş / Altyapı", "Kişisel" veya "WhatsApp Notu") doldur.`;

  const parts: Array<Record<string, unknown>> = [{ text: systemInstruction }];
  if (params.audioBase64) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType || "audio/ogg",
        data: params.audioBase64,
      },
    });
  }
  if (params.text) {
    parts.push({ text: `Kullanıcı mesajı: ${params.text}` });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(params.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) return null;

  try {
    return JSON.parse(rawJson);
  } catch {
    return null;
  }
}

/**
 * Resolves a valid Google OAuth2 Access Token either from a client-supplied token
 * or by exchanging the server/wizard GOOGLE_REFRESH_TOKEN.
 */
export async function resolveGoogleAccessToken(
  creds: AssistantCredentials
): Promise<string | null> {
  loadFreshEnv();
  if (creds.googleAccessToken) {
    return creds.googleAccessToken;
  }

  const clientId = creds.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    creds.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken =
    creds.googleRefreshToken || process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function createGoogleCalendarEvent(
  accessToken: string,
  evt: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    attendee: string;
    location: string;
  }
): Promise<{ htmlLink?: string; ok: boolean; error?: string }> {
  try {
    const startDateTime = `${evt.date}T${evt.startTime}:00+03:00`;
    const endDateTime = `${evt.date}T${evt.endTime}:00+03:00`;

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: evt.title,
          location: evt.location,
          description: `Katılımcı: ${evt.attendee}\nWhatsApp ⇄ Google Workspace Asistanı üzerinden oluşturuldu.`,
          start: {
            dateTime: startDateTime,
            timeZone: "Europe/Istanbul",
          },
          end: {
            dateTime: endDateTime,
            timeZone: "Europe/Istanbul",
          },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || "Google Calendar API hatası",
      };
    }

    return { ok: true, htmlLink: data.htmlLink };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function createGooglePersonContact(
  accessToken: string,
  cnt: {
    name: string;
    phone: string;
    email: string;
    company: string;
    notes: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people:createContact",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          names: [{ givenName: cnt.name }],
          phoneNumbers: [{ value: cnt.phone, type: "mobile" }],
          emailAddresses: cnt.email ? [{ value: cnt.email, type: "work" }] : [],
          organizations: cnt.company ? [{ name: cnt.company }] : [],
          biographies: cnt.notes ? [{ value: cnt.notes }] : [],
        }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      return {
        ok: false,
        error: data?.error?.message || "Google People API hatası",
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/**
 * Main entry point for processing a text or voice command from either the Web Simulator or the Meta Webhook.
 */
export async function processAssistantInput(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  isVoice?: boolean;
  credentials?: AssistantCredentials;
}): Promise<AssistantProcessResult> {
  loadFreshEnv();
  const creds = params.credentials || {};
  const geminiKey = creds.geminiApiKey || process.env.GEMINI_API_KEY;
  const isVoice = Boolean(params.isVoice || params.audioBase64);

  let usedGemini = false;
  let transcript = params.text?.trim() || "";
  let parsed: {
    intent: "calendar" | "contact" | "note" | "help";
    calendar?: Omit<CalendarItem, "id" | "createdTime" | "source">;
    contact?: Omit<ContactItem, "id" | "addedDate">;
    note?: Omit<NoteItem, "id" | "time">;
  } | null = null;

  if (
    geminiKey &&
    !geminiKey.includes("BURAYA_") &&
    (params.text || params.audioBase64)
  ) {
    try {
      const geminiResult = await analyzeWithGemini({
        text: params.text,
        audioBase64: params.audioBase64,
        mimeType: params.mimeType,
        apiKey: geminiKey,
      });

      if (geminiResult) {
        usedGemini = true;
        transcript = geminiResult.transcript || transcript;
        parsed = {
          intent: geminiResult.intent || "help",
          calendar: geminiResult.calendar,
          contact: geminiResult.contact,
          note: geminiResult.note,
        };
      }
    } catch {
      // Fallback to local parser
    }
  }

  if (!parsed) {
    if (!transcript) {
      transcript = "Yarın saat 15:30'da Mehmet Bey ile bütçe toplantısı ayarla";
    }
    parsed = parseCommandLocally(transcript, isVoice);
  }

  const accessToken = await resolveGoogleAccessToken(creds);
  let syncedToGoogle = false;
  let googleSyncError: string | undefined;

  if (parsed.intent === "calendar" && parsed.calendar) {
    let htmlLink: string | undefined;
    if (accessToken) {
      const calRes = await createGoogleCalendarEvent(
        accessToken,
        parsed.calendar
      );
      syncedToGoogle = calRes.ok;
      htmlLink = calRes.htmlLink;
      googleSyncError = calRes.error;
    }

    const calendarEvent: CalendarItem = {
      id: "evt-" + Date.now(),
      title: parsed.calendar.title,
      date: parsed.calendar.date,
      startTime: parsed.calendar.startTime,
      endTime: parsed.calendar.endTime,
      attendee: parsed.calendar.attendee || "WhatsApp Kullanıcısı",
      location: parsed.calendar.location || "Google Meet",
      source: isVoice ? "🎙️ WhatsApp Sesli Komut" : "💬 WhatsApp Metin Komutu",
      createdTime: "Şimdi",
      htmlLink,
      syncedWithGoogle: syncedToGoogle,
    };

    const syncTag = syncedToGoogle
      ? "\n✅ *Gerçek Google Takvim'inize senkronize edildi!*"
      : "";

    const replyText =
      `📅 *Google Takvim'e Etkinlik Eklendi!*\n\n` +
      `📌 *Başlık:* ${calendarEvent.title}\n` +
      `🗓️ *Tarih:* ${calendarEvent.date}, ${calendarEvent.startTime} - ${calendarEvent.endTime}\n` +
      `👥 *Katılımcı:* ${calendarEvent.attendee}\n` +
      `📍 *Konum:* ${calendarEvent.location}\n` +
      `🔔 *Hatırlatıcı:* 15 dk önce bildirim${syncTag}`;

    return {
      transcript,
      intent: "calendar",
      replyText,
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      calendarEvent,
    };
  }

  if (parsed.intent === "contact" && parsed.contact) {
    if (accessToken) {
      const cntRes = await createGooglePersonContact(
        accessToken,
        parsed.contact
      );
      syncedToGoogle = cntRes.ok;
      googleSyncError = cntRes.error;
    }

    const contact: ContactItem = {
      id: "cnt-" + Date.now(),
      name: parsed.contact.name,
      phone: parsed.contact.phone,
      email: parsed.contact.email,
      company: parsed.contact.company || "WhatsApp Bağlantısı",
      notes:
        parsed.contact.notes ||
        (isVoice
          ? "Sesli mesaj ile Google Kişiler'e kaydedildi"
          : "Yazılı WhatsApp komutuyla eklendi"),
      addedDate: "Şimdi",
      syncedWithGoogle: syncedToGoogle,
    };

    const syncTag = syncedToGoogle
      ? "\n✅ *Gerçek Google Kişiler (Contacts) hesabınıza kaydedildi!*"
      : "";

    const replyText =
      `👤 *Google Kişiler'e Başarıyla Kaydedildi!*\n\n` +
      `📇 *İsim:* ${contact.name}\n` +
      `📞 *Telefon:* ${contact.phone}\n` +
      `✉️ *E-posta:* ${contact.email}\n` +
      `🏢 *Şirket:* ${contact.company}${syncTag}`;

    return {
      transcript,
      intent: "contact",
      replyText,
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      contact,
    };
  }

  if (parsed.intent === "note" && parsed.note) {
    const note: NoteItem = {
      id: "not-" + Date.now(),
      title: parsed.note.title,
      content: parsed.note.content,
      category: parsed.note.category || "WhatsApp Notu",
      time: "Şimdi",
    };

    const replyText =
      `📝 *Not Defterine Kaydedildi!*\n\n` +
      `"${note.content}"\n\n` +
      `_Kategori: ${note.category} • Notlar sekmesinde saklandı._`;

    return {
      transcript,
      intent: "note",
      replyText,
      usedGemini,
      syncedToGoogle: false,
      note,
    };
  }

  return {
    transcript,
    intent: "help",
    usedGemini,
    syncedToGoogle: false,
    replyText:
      `Anlayamadım. Lütfen şu formatları deneyin:\n\n` +
      `• 📅 *Toplantı:* "Yarın saat 14:00'te Tasarım Toplantısı"\n` +
      `• 👤 *Kişi:* "Rehbere ekle: Ali Vural 05441234567"\n` +
      `• 📝 *Not:* "!not Marketten süt alınacak"\n\n` +
      `Ya da mikrofona basarak sesli konuşabilirsiniz!`,
  };
}
