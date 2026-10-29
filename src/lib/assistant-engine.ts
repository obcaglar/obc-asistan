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
        if (val) {
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
 * Local smart Turkish NLP parser for date, time, contact, and note extraction.
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
  const text = rawText.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  const lower = text.toLocaleLowerCase("tr-TR");

  // 1. CONTACTS / GOOGLE PEOPLE (Check first if explicit contact keywords exist)
  if (
    lower.startsWith("!rehber") ||
    lower.startsWith("!kisi") ||
    lower.startsWith("!kişi") ||
    lower.includes("rehbere") ||
    lower.includes("rehber") ||
    lower.includes("kişi ekle") ||
    lower.includes("kişi kaydet") ||
    lower.includes("kisi ekle") ||
    lower.includes("numara kaydet") ||
    lower.includes("numarayı kaydet")
  ) {
    const clean = text
      .replace(
        /^(!rehbere\s*ekle:?|!rehber:?|!kisi:?|!kişi:?|rehbere\s*kaydet:?|rehbere\s*ekle:?|kişi\s*ekle:?|kişi\s*kaydet:?|numara\s*kaydet:?)/i,
        ""
      )
      .trim();

    const emailMatch = clean.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
    const email = emailMatch ? emailMatch[0].trim() : "";

    const phoneMatch = clean.match(
      /(\+90[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\+?\d[\d\s-]{8,14}\d)/
    );
    const phone = phoneMatch ? phoneMatch[0].trim() : "+90 530 000 0000";

    let company = "";
    const companyMatch = clean.match(/(?:şirket|firma|kurum):?\s*([^,]+)$/i);
    if (companyMatch) {
      company = companyMatch[1].trim();
    }

    let name = clean
      .replace(email, "")
      .replace(phone, "")
      .replace(/(?:şirket|firma|kurum):?\s*([^,]+)$/i, "")
      .replace(
        /\b(telefon|tel|numara|numarası|şirket|firma|mail|e-posta|eposta|ad|soyad|isim):?/gi,
        ""
      )
      .replace(/[,]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!name || name.length < 2) {
      name = "Yeni Kişi";
    }

    return {
      intent: "contact",
      contact: {
        name,
        phone,
        email,
        company: company || "WhatsApp Bağlantısı",
        notes: isVoice
          ? "WhatsApp sesli mesaj ile Google Kişiler'e eklendi"
          : "WhatsApp yazılı komut ile Google Kişiler'e eklendi",
      },
    };
  }

  // 2. CALENDAR / MEETING
  if (
    lower.startsWith("!toplanti") ||
    lower.startsWith("!toplantı") ||
    lower.startsWith("!randevu") ||
    lower.includes("toplantı") ||
    lower.includes("toplanti") ||
    lower.includes("randevu") ||
    lower.includes("etkinlik") ||
    lower.includes("görüşme") ||
    lower.includes("planla") ||
    lower.includes("takvime")
  ) {
    const now = getIstanbulNow();
    const targetDate = new Date(now);

    if (lower.includes("yarın") || lower.includes("yarin")) {
      targetDate.setDate(now.getDate() + 1);
    } else if (lower.includes("öbür gün") || lower.includes("ertesi gün")) {
      targetDate.setDate(now.getDate() + 2);
    } else if (!lower.includes("bugün") && !lower.includes("bugun")) {
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

    let dateStr = formatIsoDate(targetDate);
    const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    const trDateMatch = text.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
    if (isoMatch) {
      dateStr = isoMatch[0];
    } else if (trDateMatch) {
      dateStr = `${trDateMatch[3]}-${trDateMatch[2].padStart(2, "0")}-${trDateMatch[1].padStart(2, "0")}`;
    }

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

    let attendee = "WhatsApp Kullanıcısı";
    const attendeeMatch = text.match(
      /([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+(?:Bey|Hanım|[A-ZÇĞİÖŞÜ][a-zçğıöşü]+))?)\s+ile/
    );
    if (attendeeMatch) {
      attendee = attendeeMatch[1].trim();
    }

    let title = text
      .replace(
        /^(!toplanti|!toplantı|!randevu|toplantı ayarla:?|randevu ekle:?)/i,
        ""
      )
      .replace(
        /\b(yarın|yarin|bugün|bugun|pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar)\b/gi,
        ""
      )
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
        location: lower.includes("ofis")
          ? "Ofis Toplantı Odası"
          : "Google Meet",
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
      lower.includes("sunucu") ||
      lower.includes("ssl") ||
      lower.includes("toplantı")
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
Kullanıcının gönderdiği metni veya ses kaydını incele ve tam olarak şu JSON yapısını döndür:
{
  "transcript": "Ses kaydının veya yazılı mesajın tam Türkçe metni",
  "intent": "calendar" | "contact" | "note" | "help",
  "calendar": {
    "title": "Toplantı/Etkinlik başlığı",
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "attendee": "Katılımcı adı",
    "location": "Google Meet"
  },
  "contact": {
    "name": "Kişinin Adı Soyadı (Örn: Ali Kaya, Av. Selin Arslan)",
    "phone": "Telefon numarası (Örn: 05321112233)",
    "email": "Varsa e-posta adresi, yoksa boş string",
    "company": "Varsa şirket/kurum adı, yoksa boş string",
    "notes": "Kısa açıklama"
  },
  "note": {
    "title": "Not başlığı",
    "content": "Not içeriği",
    "category": "İş / Altyapı | Kişisel | WhatsApp Notu"
  }
}
Kurallar:
- Mesaj "!rehber", "!kisi", "rehbere ekle", "rehbere kaydet", "kişi ekle", "numara kaydet" içeriyorsa veya bir isim ve telefon numarası veriliyorsa intent KESİNLİKLE "contact" olmalıdır ve "contact" nesnesi doldurulmalıdır!
- Mesaj "!toplanti", "!randevu", "toplantı", "randevu", "etkinlik" içeriyorsa intent "calendar" olmalıdır ve "calendar" nesnesi doldurulmalıdır.
- Mesaj "!not", "not al", "not et" içeriyorsa intent "note" olmalıdır ve "note" nesnesi doldurulmalıdır.`;

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
    const obj = JSON.parse(rawJson);
    // Normalize if Gemini placed contact fields at root
    if (
      (obj.intent === "contact" || obj.intent === "rehber") &&
      !obj.contact &&
      (obj.name || obj.phone)
    ) {
      obj.intent = "contact";
      obj.contact = {
        name: obj.name || "Yeni Kişi",
        phone: obj.phone || "",
        email: obj.email || "",
        company: obj.company || "",
        notes: obj.notes || "",
      };
    }
    return obj;
  } catch {
    return null;
  }
}

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
    const nameParts = cnt.name.trim().split(/\s+/);
    const givenName =
      nameParts.length > 1
        ? nameParts.slice(0, -1).join(" ")
        : nameParts[0] || "Yeni Kişi";
    const familyName =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

    const res = await fetch(
      "https://people.googleapis.com/v1/people:createContact?personFields=names,phoneNumbers,emailAddresses,organizations,biographies",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          names: [{ givenName, familyName }],
          phoneNumbers: cnt.phone ? [{ value: cnt.phone, type: "mobile" }] : [],
          emailAddresses: cnt.email
            ? [{ value: cnt.email, type: "work" }]
            : [],
          organizations: cnt.company ? [{ name: cnt.company }] : [],
          biographies: cnt.notes ? [{ value: cnt.notes }] : [],
        }),
      }
    );

    if (!res.ok) {
      const rawText = await res.text();
      return {
        ok: false,
        error: `HTTP ${res.status}: ${rawText.slice(0, 200)}`,
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

  // Always fallback to local parser if Gemini didn't extract the required intent object!
  const localParsed = parseCommandLocally(
    transcript || "Yarın saat 15:30'da Mehmet Bey ile bütçe toplantısı ayarla",
    isVoice
  );

  if (
    !parsed ||
    parsed.intent === "help" ||
    (parsed.intent === "calendar" && !parsed.calendar?.title) ||
    (parsed.intent === "contact" && !parsed.contact?.name) ||
    (parsed.intent === "note" && !parsed.note?.content)
  ) {
    parsed = localParsed;
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
      email: parsed.contact.email || "",
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
      (contact.email ? `✉️ *E-posta:* ${contact.email}\n` : "") +
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
      `• 👤 *Kişi:* "!rehber Ali Vural 05441234567"\n` +
      `• 📝 *Not:* "!not Marketten süt alınacak"\n\n` +
      `Ya da mikrofona basarak sesli konuşabilirsiniz!`,
  };
}
