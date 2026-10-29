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

export type ActionType = "create" | "update" | "delete";

export interface AssistantProcessResult {
  transcript: string;
  intent: "calendar" | "contact" | "note" | "help";
  action?: ActionType;
  targetQuery?: string;
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

function parseDateAndTimeFromTurkishText(text: string): {
  dateStr: string;
  startTime: string;
  endTime: string;
  hasExplicitTime: boolean;
  hasExplicitDate: boolean;
} {
  const lower = text.toLocaleLowerCase("tr-TR");
  const now = getIstanbulNow();
  const targetDate = new Date(now);
  let hasExplicitDate = false;

  if (lower.includes("yarın") || lower.includes("yarin")) {
    targetDate.setDate(now.getDate() + 1);
    hasExplicitDate = true;
  } else if (lower.includes("öbür gün") || lower.includes("ertesi gün")) {
    targetDate.setDate(now.getDate() + 2);
    hasExplicitDate = true;
  } else if (lower.includes("bugün") || lower.includes("bugun")) {
    hasExplicitDate = true;
  } else {
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
    for (const [dayName, dayIdx] of Object.entries(daysMap)) {
      if (lower.includes(dayName)) {
        const currentDay = now.getDay();
        let diff = (dayIdx - currentDay + 7) % 7;
        if (diff === 0) diff = 7;
        targetDate.setDate(now.getDate() + diff);
        hasExplicitDate = true;
        break;
      }
    }
    if (!hasExplicitDate) {
      targetDate.setDate(now.getDate() + 1);
    }
  }

  let dateStr = formatIsoDate(targetDate);
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const trDateMatch = text.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  if (isoMatch) {
    dateStr = isoMatch[0];
    hasExplicitDate = true;
  } else if (trDateMatch) {
    dateStr = `${trDateMatch[3]}-${trDateMatch[2].padStart(2, "0")}-${trDateMatch[1].padStart(2, "0")}`;
    hasExplicitDate = true;
  }

  let startHour = 15;
  let startMin = 0;
  let hasExplicitTime = false;
  const timeMatch = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (timeMatch) {
    startHour = parseInt(timeMatch[1], 10);
    startMin = parseInt(timeMatch[2], 10);
    hasExplicitTime = true;
  } else if (lower.includes("üçe") || lower.includes("üçte")) {
    startHour = 15;
    hasExplicitTime = true;
  } else if (lower.includes("ikiye") || lower.includes("ikide")) {
    startHour = 14;
    hasExplicitTime = true;
  } else if (lower.includes("dörde") || lower.includes("dörtte")) {
    startHour = 16;
    hasExplicitTime = true;
  }

  const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
  const endHour = (startHour + 1) % 24;
  const endTime = `${String(endHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;

  return {
    dateStr,
    startTime,
    endTime,
    hasExplicitTime,
    hasExplicitDate,
  };
}

/**
 * Local smart Turkish NLP parser for create, update, and delete on Calendar, Contacts, and Notes.
 */
export function parseCommandLocally(
  rawText: string,
  isVoice: boolean
): {
  intent: "calendar" | "contact" | "note" | "help";
  action: ActionType;
  targetQuery?: string;
  calendar?: Omit<CalendarItem, "id" | "createdTime" | "source">;
  contact?: Omit<ContactItem, "id" | "addedDate">;
  note?: Omit<NoteItem, "id" | "time">;
} {
  const text = rawText.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  const lower = text.toLocaleLowerCase("tr-TR");

  const isDelete =
    /\b(sil|kaldır|kaldir|iptal\s*et|iptal)\b/i.test(lower) ||
    lower.startsWith("!rehber sil") ||
    lower.startsWith("!kisi sil") ||
    lower.startsWith("!toplanti sil") ||
    lower.startsWith("!toplantı sil") ||
    lower.startsWith("!randevu sil");

  const isUpdate =
    !isDelete &&
    (/\b(güncelle|guncelle|değiştir|degistir|düzenle|duzenle|ertele|taşı|tasi)\b/i.test(
      lower
    ) ||
      lower.startsWith("!rehber güncelle") ||
      lower.startsWith("!kisi güncelle") ||
      lower.startsWith("!toplanti güncelle") ||
      lower.startsWith("!randevu güncelle"));

  const action: ActionType = isDelete
    ? "delete"
    : isUpdate
      ? "update"
      : "create";

  // 1. CONTACTS / GOOGLE PEOPLE
  if (
    lower.startsWith("!rehber") ||
    lower.startsWith("!kisi") ||
    lower.startsWith("!kişi") ||
    lower.includes("rehbere") ||
    lower.includes("rehberden") ||
    lower.includes("rehberde") ||
    lower.includes("rehber") ||
    lower.includes("kişi ekle") ||
    lower.includes("kişi kaydet") ||
    lower.includes("kişi sil") ||
    lower.includes("kişiyi sil") ||
    lower.includes("kişi güncelle") ||
    lower.includes("numara kaydet") ||
    lower.includes("numarasını güncelle")
  ) {
    const clean = text
      .replace(
        /^(!rehbere\s*ekle:?|!rehberden\s*sil:?|!rehber\s*sil:?|!rehber\s*güncelle:?|!rehber\s*guncelle:?|!rehber:?|!kisi\s*sil:?|!kişi\s*sil:?|!kisi\s*güncelle:?|!kişi\s*güncelle:?|!kisi:?|!kişi:?|rehberden\s*sil:?|rehberde\s*güncelle:?|rehbere\s*kaydet:?|rehbere\s*ekle:?|kişi\s*ekle:?|kişi\s*kaydet:?|kişiyi\s*sil:?|kişi\s*sil:?|numara\s*kaydet:?)/i,
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
    const phone = phoneMatch ? phoneMatch[0].trim() : "";

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
        /\b(sil|kaldır|kaldir|güncelle|guncelle|değiştir|degistir|olarak|yeni|numarasını|numarasi|kişisini|kisisini|kişiyi|kisiyi|rehberden|rehberde|telefon|tel|numara|numarası|şirket|firma|mail|e-posta|eposta|ad|soyad|isim):?/gi,
        ""
      )
      .replace(/['’][a-zçğıöşü]+/gi, "")
      .replace(/[,]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!name || name.length < 2) {
      name = "Yeni Kişi";
    }

    return {
      intent: "contact",
      action,
      targetQuery: name,
      contact: {
        name,
        phone: phone || "+90 530 000 0000",
        email,
        company: company || "WhatsApp Bağlantısı",
        notes: isVoice
          ? "WhatsApp sesli mesaj ile Google Kişiler'de işlendi"
          : "WhatsApp yazılı komut ile Google Kişiler'de işlendi",
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
    lower.includes("takvim")
  ) {
    const { dateStr, startTime, endTime } =
      parseDateAndTimeFromTurkishText(text);

    let attendee = "WhatsApp Kullanıcısı";
    const attendeeMatch = text.match(
      /([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+(?:Bey|Hanım|[A-ZÇĞİÖŞÜ][a-zçğıöşü]+))?)\s+ile/
    );
    if (attendeeMatch) {
      attendee = attendeeMatch[1].trim();
    }

    let title = text
      .replace(
        /^(!toplanti\s*sil:?|!toplantı\s*sil:?|!randevu\s*sil:?|!toplanti\s*iptal:?|!toplantı\s*iptal:?|!toplanti\s*güncelle:?|!toplantı\s*güncelle:?|!randevu\s*güncelle:?|!toplanti:?|!toplantı:?|!randevu:?|toplantı\s*ayarla:?|randevu\s*ekle:?|takvimden\s*sil:?)/i,
        ""
      )
      .replace(
        /\b(yarın|yarin|bugün|bugun|pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar)\b/gi,
        ""
      )
      .replace(/\bsaat\s*\d{1,2}[:.]\d{2}('[a-zçğıöşü]+)?/gi, "")
      .replace(/\b\d{1,2}[:.]\d{2}('[a-zçğıöşü]+)?/g, "")
      .replace(
        /\b(planla|ayarla|ekle|sil|kaldır|kaldir|iptal\s*et|iptal|güncelle|guncelle|değiştir|degistir|ertele|taşı|tasi|toplantısını|toplantisini|randevusunu|etkinliğini|olan|toplantıyı|toplantiyi|takvimden)\b/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

    if (!title || title.length < 2) {
      title =
        attendee !== "WhatsApp Kullanıcısı"
          ? attendee
          : "WhatsApp Üzerinden Planlanan Görüşme";
    }

    return {
      intent: "calendar",
      action,
      targetQuery: title,
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
      action: "create",
      note: {
        title:
          noteContent.slice(0, 35) + (noteContent.length > 35 ? "..." : ""),
        content: noteContent,
        category,
      },
    };
  }

  return { intent: "help", action: "create" };
}

/**
 * Uses Gemini 3 Flash Preview for audio transcription (STT) and structured NLU intent + action extraction.
 */
async function analyzeWithGemini(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  apiKey: string;
}): Promise<{
  transcript: string;
  intent: "calendar" | "contact" | "note" | "help";
  action?: ActionType;
  targetQuery?: string;
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
  "action": "create" | "update" | "delete",
  "targetQuery": "Güncellenecek veya silinecek toplantının/kişinin aranacağı anahtar kelime veya kişi adı (Örn: 'Ahmet Bey', 'Eşimi ara', 'Ali K')",
  "calendar": {
    "title": "Toplantı/Etkinlik başlığı",
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "attendee": "Katılımcı adı",
    "location": "Google Meet"
  },
  "contact": {
    "name": "Kişinin Adı Soyadı (Örn: Ali K, Av. Selin Arslan)",
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
1. "action" alanı:
   - Yeni ekleme/kaydetme/planlama ise: "create"
   - Mevcut bir toplantıyı veya kişiyi güncelleme/değiştirme/erteleme/saatini değiştirme ise: "update"
   - Mevcut bir toplantıyı veya kişiyi silme/kaldırma/iptal etme ise: "delete"
2. "targetQuery" alanı: "update" veya "delete" işlemlerinde Google Takvim veya Google Rehber'de aranacak mevcut toplantı başlığı veya kişi ismidir (Örn: "Ahmet Bey ile olan toplantıyı sil" -> targetQuery: "Ahmet Bey").
3. Mesaj "!rehber", "!kisi", "rehber", "kişi", "numara" içeriyorsa intent KESİNLİKLE "contact" olmalıdır.
4. Mesaj "!toplanti", "!randevu", "toplantı", "randevu", "etkinlik", "takvim" içeriyorsa intent KESİNLİKLE "calendar" olmalıdır.`;

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
      cache: "no-store",
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
    if (
      (obj.intent === "contact" || obj.intent === "rehber") &&
      !obj.contact &&
      (obj.name || obj.phone || obj.targetQuery)
    ) {
      obj.intent = "contact";
      obj.contact = {
        name: obj.name || obj.targetQuery || "Kişi",
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
      cache: "no-store",
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

// ============================================================================
// GOOGLE CALENDAR API v3: CREATE, FIND, UPDATE, DELETE
// ============================================================================

async function findGoogleCalendarEvent(
  accessToken: string,
  query: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  try {
    const cleanQuery = query.trim();
    // 1. Search with q parameter
    const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(cleanQuery)}&singleEvents=true&orderBy=startTime&maxResults=15`;
    const res = await fetch(searchUrl, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items[data.items.length - 1];
      }
    }

    // 2. Fallback: fetch recent & upcoming events and fuzzy-match Turkish summary
    const minDate = new Date(Date.now() - 7 * 86400000).toISOString();
    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(minDate)}&singleEvents=true&orderBy=startTime&maxResults=50`;
    const listRes = await fetch(listUrl, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const items = Array.isArray(listData.items) ? listData.items : [];
      const qLower = cleanQuery.toLocaleLowerCase("tr-TR");
      const words = qLower.split(/\s+/).filter((w) => w.length >= 3);

      for (const item of items) {
        const sumLower = String(item.summary || "").toLocaleLowerCase("tr-TR");
        if (
          sumLower.includes(qLower) ||
          qLower.includes(sumLower) ||
          words.some((w) => sumLower.includes(w))
        ) {
          return item;
        }
      }
    }
    return null;
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
        cache: "no-store",
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

async function updateGoogleCalendarEvent(
  accessToken: string,
  targetQuery: string,
  evt: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    attendee: string;
    location: string;
  }
): Promise<{
  ok: boolean;
  htmlLink?: string;
  matchedTitle?: string;
  error?: string;
}> {
  try {
    const existing = await findGoogleCalendarEvent(
      accessToken,
      targetQuery || evt.title
    );
    if (!existing || !existing.id) {
      return {
        ok: false,
        error: `"${targetQuery || evt.title}" ile eşleşen bir Google Takvim etkinliği bulunamadı.`,
      };
    }

    const startDateTime = `${evt.date}T${evt.startTime}:00+03:00`;
    const endDateTime = `${evt.date}T${evt.endTime}:00+03:00`;
    const newSummary =
      evt.title && evt.title.length > 2 ? evt.title : existing.summary;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.id)}`,
      {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: newSummary,
          location: evt.location || existing.location || "Google Meet",
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
        error: data?.error?.message || "Takvim güncellenemedi",
      };
    }

    return {
      ok: true,
      htmlLink: data.htmlLink,
      matchedTitle: existing.summary || newSummary,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function deleteGoogleCalendarEvent(
  accessToken: string,
  targetQuery: string
): Promise<{ ok: boolean; deletedTitle?: string; error?: string }> {
  try {
    const existing = await findGoogleCalendarEvent(accessToken, targetQuery);
    if (!existing || !existing.id) {
      return {
        ok: false,
        error: `"${targetQuery}" ile eşleşen bir Google Takvim etkinliği bulunamadı.`,
      };
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.id)}`,
      {
        method: "DELETE",
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok && res.status !== 204) {
      return { ok: false, error: `Silme hatası (HTTP ${res.status})` };
    }

    return { ok: true, deletedTitle: existing.summary || targetQuery };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

// ============================================================================
// GOOGLE PEOPLE (CONTACTS) API v1: CREATE, FIND, UPDATE, DELETE
// ============================================================================

// Cache recently created/updated resourceNames for instant 0-latency lookup
const recentContactsResourceMap = new Map<string, string>();

async function findGooglePersonContact(
  accessToken: string,
  query: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  try {
    const qLower = query.trim().toLocaleLowerCase("tr-TR");
    const qDigits = query.replace(/\D/g, "");

    // 1. Check in-memory recent resourceName map first (handles 0ms immediate updates/deletes)
    for (const [cachedName, resourceName] of recentContactsResourceMap.entries()) {
      if (
        cachedName.includes(qLower) ||
        qLower.includes(cachedName)
      ) {
        const directRes = await fetch(
          `https://people.googleapis.com/v1/${resourceName}?personFields=names,phoneNumbers,emailAddresses,organizations,biographies,metadata`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (directRes.ok) {
          const directPerson = await directRes.json();
          if (directPerson && directPerson.resourceName) {
            return directPerson;
          }
        }
      }
    }

    // 2. List connections sorted by LAST_MODIFIED_DESCENDING (up to 1000 contacts)
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses,organizations,biographies,metadata&sortOrder=LAST_MODIFIED_DESCENDING&pageSize=1000",
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const connections = Array.isArray(data.connections) ? data.connections : [];

      for (const person of connections) {
        const displayName = String(
          person.names?.[0]?.displayName || ""
        ).toLocaleLowerCase("tr-TR");
        const givenName = String(
          person.names?.[0]?.givenName || ""
        ).toLocaleLowerCase("tr-TR");
        const phoneVal = String(person.phoneNumbers?.[0]?.value || "").replace(
          /\D/g,
          ""
        );

        if (
          (qLower &&
            (displayName.includes(qLower) ||
              qLower.includes(displayName) ||
              givenName.includes(qLower))) ||
          (qDigits.length >= 7 && phoneVal.includes(qDigits))
        ) {
          return person;
        }
      }
    }

    // 3. Fallback: People API searchContacts endpoint
    const searchRes = await fetch(
      `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(query.trim())}&readMask=names,phoneNumbers,emailAddresses,organizations,biographies,metadata`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const firstMatch = searchData?.results?.[0]?.person;
      if (firstMatch && firstMatch.resourceName) {
        return firstMatch;
      }
    }

    return null;
  } catch {
    return null;
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

    const createdPerson = await res.json();
    if (createdPerson?.resourceName) {
      recentContactsResourceMap.set(
        cnt.name.trim().toLocaleLowerCase("tr-TR"),
        createdPerson.resourceName
      );
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function updateGooglePersonContact(
  accessToken: string,
  targetQuery: string,
  cnt: {
    name: string;
    phone: string;
    email: string;
    company: string;
    notes: string;
  }
): Promise<{ ok: boolean; matchedName?: string; error?: string }> {
  try {
    const existing = await findGooglePersonContact(
      accessToken,
      targetQuery || cnt.name
    );
    if (!existing || !existing.resourceName) {
      return {
        ok: false,
        error: `"${targetQuery || cnt.name}" adlı kişi Google Rehber'de bulunamadı.`,
      };
    }

    const finalName =
      cnt.name && cnt.name !== "Yeni Kişi"
        ? cnt.name
        : existing.names?.[0]?.displayName || targetQuery;
    const nameParts = finalName.trim().split(/\s+/);
    const givenName =
      nameParts.length > 1
        ? nameParts.slice(0, -1).join(" ")
        : nameParts[0] || finalName;
    const familyName =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

    const finalPhone =
      cnt.phone && cnt.phone !== "+90 530 000 0000"
        ? cnt.phone
        : existing.phoneNumbers?.[0]?.value || "";
    const finalEmail = cnt.email || existing.emailAddresses?.[0]?.value || "";
    const finalCompany =
      cnt.company && cnt.company !== "WhatsApp Bağlantısı"
        ? cnt.company
        : existing.organizations?.[0]?.name || "";

    const res = await fetch(
      `https://people.googleapis.com/v1/${existing.resourceName}:updateContact?updatePersonFields=names,phoneNumbers,emailAddresses,organizations,biographies&personFields=names,phoneNumbers,emailAddresses,organizations,biographies`,
      {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          etag: existing.etag,
          names: [{ givenName, familyName }],
          phoneNumbers: finalPhone
            ? [{ value: finalPhone, type: "mobile" }]
            : [],
          emailAddresses: finalEmail
            ? [{ value: finalEmail, type: "work" }]
            : [],
          organizations: finalCompany ? [{ name: finalCompany }] : [],
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

    return {
      ok: true,
      matchedName: existing.names?.[0]?.displayName || finalName,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function deleteGooglePersonContact(
  accessToken: string,
  targetQuery: string
): Promise<{ ok: boolean; deletedName?: string; error?: string }> {
  try {
    const existing = await findGooglePersonContact(accessToken, targetQuery);
    if (!existing || !existing.resourceName) {
      return {
        ok: false,
        error: `"${targetQuery}" adlı kişi Google Rehber'de bulunamadı.`,
      };
    }

    const res = await fetch(
      `https://people.googleapis.com/v1/${existing.resourceName}:deleteContact`,
      {
        method: "DELETE",
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const rawText = await res.text();
      return {
        ok: false,
        error: `HTTP ${res.status}: ${rawText.slice(0, 200)}`,
      };
    }

    return {
      ok: true,
      deletedName: existing.names?.[0]?.displayName || targetQuery,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

// ============================================================================
// MAIN ASSISTANT ENGINE ENTRYPOINT
// ============================================================================

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
    action: ActionType;
    targetQuery?: string;
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
          action: geminiResult.action || "create",
          targetQuery: geminiResult.targetQuery,
          calendar: geminiResult.calendar,
          contact: geminiResult.contact,
          note: geminiResult.note,
        };
      }
    } catch {
      // Fallback to local parser
    }
  }

  const localParsed = parseCommandLocally(
    transcript || "Yarın saat 15:30'da Mehmet Bey ile bütçe toplantısı ayarla",
    isVoice
  );

  if (
    !parsed ||
    parsed.intent === "help" ||
    (parsed.intent === "calendar" &&
      parsed.action === "create" &&
      !parsed.calendar?.title) ||
    (parsed.intent === "contact" &&
      parsed.action === "create" &&
      !parsed.contact?.name) ||
    (parsed.intent === "note" && !parsed.note?.content)
  ) {
    parsed = localParsed;
  }

  const action: ActionType = parsed.action || localParsed.action || "create";
  const targetQuery =
    parsed.targetQuery ||
    localParsed.targetQuery ||
    parsed.calendar?.title ||
    parsed.contact?.name ||
    "";

  const accessToken = await resolveGoogleAccessToken(creds);
  let syncedToGoogle = false;
  let googleSyncError: string | undefined;

  // ==================== 1. CALENDAR (CREATE / UPDATE / DELETE) ====================
  if (parsed.intent === "calendar") {
    const calData = parsed.calendar ||
      localParsed.calendar || {
        title: targetQuery || "Toplantı",
        date: formatIsoDate(getIstanbulNow()),
        startTime: "15:00",
        endTime: "16:00",
        attendee: "WhatsApp Kullanıcısı",
        location: "Google Meet",
      };

    if (action === "delete") {
      let deletedTitle = targetQuery || calData.title;
      if (accessToken) {
        const delRes = await deleteGoogleCalendarEvent(
          accessToken,
          deletedTitle
        );
        syncedToGoogle = delRes.ok;
        if (delRes.deletedTitle) deletedTitle = delRes.deletedTitle;
        googleSyncError = delRes.error;
      }

      const replyText =
        `🗑️ *Google Takvim Etkinliği Silindi!*\n\n` +
        `📌 *İptal Edilen:* ${deletedTitle}` +
        (syncedToGoogle
          ? `\n✅ *Gerçek Google Takvim'inizden kaldırıldı!*`
          : googleSyncError
            ? `\n⚠️ _${googleSyncError}_`
            : "");

      return {
        transcript,
        intent: "calendar",
        action: "delete",
        targetQuery: deletedTitle,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
      };
    }

    if (action === "update") {
      let htmlLink: string | undefined;
      let matchedTitle = targetQuery || calData.title;
      if (accessToken) {
        const updRes = await updateGoogleCalendarEvent(
          accessToken,
          matchedTitle,
          calData
        );
        syncedToGoogle = updRes.ok;
        htmlLink = updRes.htmlLink;
        if (updRes.matchedTitle) matchedTitle = updRes.matchedTitle;
        googleSyncError = updRes.error;
      }

      const calendarEvent: CalendarItem = {
        id: "evt-" + Date.now(),
        title: matchedTitle,
        date: calData.date,
        startTime: calData.startTime,
        endTime: calData.endTime,
        attendee: calData.attendee || "WhatsApp Kullanıcısı",
        location: calData.location || "Google Meet",
        source: isVoice
          ? "🎙️ WhatsApp Sesli Güncelleme"
          : "💬 WhatsApp Metin Güncelleme",
        createdTime: "Güncellendi",
        htmlLink,
        syncedWithGoogle: syncedToGoogle,
      };

      const replyText =
        `🔄 *Google Takvim Etkinliği Güncellendi!*\n\n` +
        `📌 *Başlık:* ${calendarEvent.title}\n` +
        `🗓️ *Yeni Tarih/Saat:* ${calendarEvent.date}, ${calendarEvent.startTime} - ${calendarEvent.endTime}\n` +
        `📍 *Konum:* ${calendarEvent.location}` +
        (syncedToGoogle
          ? `\n✅ *Gerçek Google Takvim'inizde güncellendi!*`
          : googleSyncError
            ? `\n⚠️ _${googleSyncError}_`
            : "");

      return {
        transcript,
        intent: "calendar",
        action: "update",
        targetQuery: matchedTitle,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
        calendarEvent,
      };
    }

    // CREATE CALENDAR EVENT
    let htmlLink: string | undefined;
    if (accessToken) {
      const calRes = await createGoogleCalendarEvent(accessToken, calData);
      syncedToGoogle = calRes.ok;
      htmlLink = calRes.htmlLink;
      googleSyncError = calRes.error;
    }

    const calendarEvent: CalendarItem = {
      id: "evt-" + Date.now(),
      title: calData.title,
      date: calData.date,
      startTime: calData.startTime,
      endTime: calData.endTime,
      attendee: calData.attendee || "WhatsApp Kullanıcısı",
      location: calData.location || "Google Meet",
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
      action: "create",
      replyText,
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      calendarEvent,
    };
  }

  // ==================== 2. CONTACTS (CREATE / UPDATE / DELETE) ====================
  if (parsed.intent === "contact") {
    const cntData = parsed.contact ||
      localParsed.contact || {
        name: targetQuery || "Yeni Kişi",
        phone: "",
        email: "",
        company: "WhatsApp Bağlantısı",
        notes: "",
      };

    if (action === "delete") {
      let deletedName = targetQuery || cntData.name;
      if (accessToken) {
        const delRes = await deleteGooglePersonContact(
          accessToken,
          deletedName
        );
        syncedToGoogle = delRes.ok;
        if (delRes.deletedName) deletedName = delRes.deletedName;
        googleSyncError = delRes.error;
      }

      const replyText =
        `🗑️ *Google Kişiler'den Silindi!*\n\n` +
        `👤 *Silinen Kişi:* ${deletedName}` +
        (syncedToGoogle
          ? `\n✅ *Gerçek Google Rehberinizden kaldırıldı!*`
          : googleSyncError
            ? `\n⚠️ _${googleSyncError}_`
            : "");

      return {
        transcript,
        intent: "contact",
        action: "delete",
        targetQuery: deletedName,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
      };
    }

    if (action === "update") {
      let matchedName = targetQuery || cntData.name;
      if (accessToken) {
        const updRes = await updateGooglePersonContact(
          accessToken,
          matchedName,
          cntData
        );
        syncedToGoogle = updRes.ok;
        if (updRes.matchedName) matchedName = updRes.matchedName;
        googleSyncError = updRes.error;
      }

      const contact: ContactItem = {
        id: "cnt-" + Date.now(),
        name: matchedName,
        phone: cntData.phone || "Güncellendi",
        email: cntData.email || "",
        company: cntData.company || "WhatsApp Bağlantısı",
        notes: "WhatsApp üzerinden güncellendi",
        addedDate: "Güncellendi",
        syncedWithGoogle: syncedToGoogle,
      };

      const replyText =
        `🔄 *Google Kişiler Kaydı Güncellendi!*\n\n` +
        `📇 *İsim:* ${contact.name}\n` +
        (cntData.phone ? `📞 *Yeni Telefon:* ${cntData.phone}\n` : "") +
        (cntData.email ? `✉️ *Yeni E-posta:* ${cntData.email}\n` : "") +
        (cntData.company && cntData.company !== "WhatsApp Bağlantısı"
          ? `🏢 *Yeni Şirket:* ${cntData.company}\n`
          : "") +
        (syncedToGoogle
          ? `✅ *Gerçek Google Kişiler (Contacts) hesabınızda güncellendi!*`
          : googleSyncError
            ? `⚠️ _${googleSyncError}_`
            : "");

      return {
        transcript,
        intent: "contact",
        action: "update",
        targetQuery: matchedName,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
        contact,
      };
    }

    // CREATE CONTACT
    if (accessToken) {
      const cntRes = await createGooglePersonContact(accessToken, cntData);
      syncedToGoogle = cntRes.ok;
      googleSyncError = cntRes.error;
    }

    const contact: ContactItem = {
      id: "cnt-" + Date.now(),
      name: cntData.name,
      phone: cntData.phone,
      email: cntData.email || "",
      company: cntData.company || "WhatsApp Bağlantısı",
      notes:
        cntData.notes ||
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
      action: "create",
      replyText,
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      contact,
    };
  }

  // ==================== 3. NOTES ====================
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
      action: "create",
      replyText,
      usedGemini,
      syncedToGoogle: false,
      note,
    };
  }

  return {
    transcript,
    intent: "help",
    action: "create",
    usedGemini,
    syncedToGoogle: false,
    replyText:
      `Anlayamadım. Lütfen şu formatları deneyin:\n\n` +
      `• 📅 *Toplantı Ekle/Güncelle/Sil:* "!toplanti Yarın 14:00 Bütçe" | "!toplanti güncelle Bütçe Cuma 16:00" | "!toplanti sil Bütçe"\n` +
      `• 👤 *Kişi Ekle/Güncelle/Sil:* "!rehber Ali Kaya 05441234567" | "!rehber güncelle Ali Kaya 05329998877" | "!rehber sil Ali Kaya"\n` +
      `• 📝 *Not:* "!not Marketten süt alınacak"\n\n` +
      `Ya da mikrofona basarak sesli konuşabilirsiniz!`,
  };
}
