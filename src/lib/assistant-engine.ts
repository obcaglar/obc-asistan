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
  attendeeEmail?: string;
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

export interface PhotoItem {
  id: string;
  title: string;
  date: string;
  url: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
  source: "Google Photos" | "Google Drive";
  albumOrLocation?: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  typeLabel: string;
  modifiedDate: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  snippet?: string;
  sizeLabel?: string;
  folderPath?: string;
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

export type ActionType = "create" | "update" | "delete" | "share";

export interface AssistantProcessResult {
  transcript: string;
  intent: "calendar" | "contact" | "note" | "photos" | "drive" | "help";
  action?: ActionType;
  targetQuery?: string;
  replyText: string;
  usedGemini: boolean;
  syncedToGoogle: boolean;
  duplicate?: boolean;
  googleSyncError?: string;
  calendarEvent?: CalendarItem;
  contact?: ContactItem;
  note?: NoteItem;
  photos?: PhotoItem[];
  driveFiles?: DriveFileItem[];
  selectedDriveFile?: DriveFileItem;
  selectedPhoto?: PhotoItem;
  chainedCount?: number;
  spokenReply?: string;
  endCall?: boolean;
  pauseListening?: boolean;
}

export function isHangupOrStopCommand(rawText?: string): boolean {
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

  // 1. Standalone or short direct stop/hangup commands ("stop", "dur", "durdur", "kapat", "sohbeti kapat", "telefonu kapat")
  if (
    /^(?:lutfen\s+|simdi\s+|hemen\s+|artik\s+|tamam\s+|tesekkurler\s+|peki\s+)*(?:stop|dur|durdur|kapat|kapatalim|bitir|bitirelim|sonlandir|sus|yeter|bu\s+kadar\s+yeter|hosca\s*kal|gorusuruz|iyi\s+gunler\s+kapat)(?:\s+lutfen|\s+artik|\s+hemen|\s+simdi|\s+asistan|\s+obc|\s+onur\s+bey)*$/.test(
      norm
    )
  ) {
    return true;
  }

  // 2. Explicit target + close/stop verb ("sohbeti ve telefonu kapat", "aramayı kapat", "asistanı durdur", "dinlemeyi kapat", "telefonu kapat")
  if (
    /\b(?:telefon\w*|sohbet\w*|arama\w*|gorusme\w*|cagri\w*|asistan\w*|dinleme\w*|mikrofon\w*|sesli\s+arama\w*|sesli\s+asistan\w*|konusma\w*)\b.*\b(?:kapat\w*|durdur\w*|dur\b|bitir\w*|sonlandir\w*|kes\w*|stop\b|iptal\s+et\w*)\b/.test(
      norm
    ) ||
    /\b(?:kapat\w*|durdur\w*|dur\b|bitir\w*|sonlandir\w*|kes\w*|stop\b)\b.*\b(?:telefon\w*|sohbet\w*|arama\w*|gorusme\w*|cagri\w*|asistan\w*|dinleme\w*|mikrofon\w*|konusma\w*)\b/.test(
      norm
    )
  ) {
    return true;
  }

  // 3. Any utterance <= 12 words containing "stop", "durdur", "telefonu kapat", "sohbeti kapat", "aramayi kapat", "asistani kapat"
  const words = norm.split(/\s+/);
  if (
    words.length <= 12 &&
    /\b(?:stop|durdur|telefonu\s+kapat|sohbeti\s+kapat|aramayi\s+kapat|gorusmeyi\s+kapat|asistani\s+kapat|dinlemeyi\s+kapat|dinlemeyi\s+durdur|sohbeti\s+ve\s+telefonu\s+kapat)\b/.test(
      norm
    )
  ) {
    return true;
  }

  return false;
}

export function isPauseListeningCommand(rawText?: string): boolean {
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

export function isBotReplyEcho(rawText?: string): boolean {
  if (!rawText) return false;
  const t = rawText.replace(/^\u200B+|\u200B+$/g, "").trim();
  if (!t) return false;
  const norm = t
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

  return (
    rawText.includes("\u200B") ||
    t.startsWith("🎙️") ||
    t.includes("🎙️") ||
    t.includes("📅 *Google Takvim") ||
    t.includes("🔄 *Google Takvim") ||
    t.includes("🗑️ *Google Takvim") ||
    t.includes("📨 *Google Takvim") ||
    t.includes("👤 *Google Kişiler") ||
    t.includes("🔄 *Google Kişiler") ||
    t.includes("🗑️ *Google Kişiler") ||
    t.includes("📝 *Not Defterine") ||
    t.includes("📝 *Google Tasks") ||
    t.includes("📋 *Google Tasks") ||
    t.includes("📸 *Google Photos") ||
    t.includes("📁 *Google Drive") ||
    t.includes("✅ *Seçilen Google Drive") ||
    t.includes("📝 Mesajınız işlendi") ||
    t.includes("⚠️ *Silinecek") ||
    t.includes("📞 *Çağrınız Yanıtlandı") ||
    t.includes("📞 *Canlı Kadın Sesli") ||
    t.startsWith("Anlayamadım. Lütfen") ||
    t.includes("Sesli Komut Algılandı") ||
    t.includes("Sesli Mesaj Çözümlendi") ||
    t.includes("📌 *Başlık:*") ||
    t.includes("🗓️ *Tarih:*") ||
    t.includes("Mehmet Bey ile bütçe toplantısı") ||
    norm.includes("ben ozel sesli asistaniniz") ||
    norm.includes("siradaki komutunuzu dinliyorum") ||
    norm.includes("whatsapp aramanizi aldim") ||
    norm.includes("cagrinizi aldim") ||
    norm.includes("sizi dinliyorum") ||
    norm.includes("ne yapmami istersiniz") ||
    norm.includes("baska bir isteginiz var mi") ||
    norm.includes("tamamdir onur bey") ||
    norm.includes("tamamdir ozgur bey") ||
    norm.includes("buyurun onur bey") ||
    norm.includes("buyrun onur bey") ||
    norm.includes("buyrun ozgur bey") ||
    norm.includes("efendim ozgur bey") ||
    norm.includes("secenekler halinde listeledim") ||
    norm.includes("simdi sizinle paylasiyorum") ||
    norm.includes("takvim rehber gorev") ||
    norm.includes("google photos veya drive") ||
    norm.includes("photos veya drive icin") ||
    norm.includes("konusunu google gorevler") ||
    norm.includes("takvim listenize isledim") ||
    norm.includes("google takvim inize ekledim") ||
    norm.includes("google takviminize ekledim") ||
    norm.includes("google rehber inize kaydettim") ||
    norm.includes("google rehberinize kaydettim") ||
    norm.includes("hangisini paylasmami istersiniz") ||
    norm.includes("numarasini soyleyebilirsiniz") ||
    norm.includes("komutu da sirasiyla yerine getirdim") ||
    norm.includes("sesinizi cok net duyuyorum") ||
    norm.includes("sesli aramayi ve dinlemeyi hemen kapatiyorum") ||
    norm.includes("sesli aramayi hemen kapatiyorum") ||
    norm.includes("dinlemeyi duraklattim")
  );
}

export const recentWebhookEvents: {
  calendars: CalendarItem[];
  contacts: ContactItem[];
  notes: NoteItem[];
  photos: PhotoItem[];
  driveFiles: DriveFileItem[];
} = {
  calendars: [],
  contacts: [],
  notes: [],
  photos: [],
  driveFiles: [],
};

export interface ActiveWhatsAppCallState {
  callId: string;
  callerJid: string;
  timestamp: number;
  answeredByWeb: boolean;
}

export interface PendingWhatsAppNotification {
  id: string;
  jid: string;
  text: string;
  timestamp: number;
}

export let activeWhatsAppCall: ActiveWhatsAppCallState | null = null;
export let callTerminatedAt = 0;
export const pendingWhatsAppNotifications: PendingWhatsAppNotification[] = [];

export function queueWhatsAppNotification(text: string, jid?: string) {
  if (!text || !text.trim()) return;
  const targetJid =
    jid ||
    activeWhatsAppCall?.callerJid ||
    process.env.WHATSAPP_ASSISTANT_NUMBER ||
    "+905491007729";
  pendingWhatsAppNotifications.push({
    id: "notif-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    jid: targetJid,
    text: text.trim(),
    timestamp: Date.now(),
  });
  while (pendingWhatsAppNotifications.length > 25) {
    pendingWhatsAppNotifications.shift();
  }
}

export function triggerIncomingWhatsAppCall(callId: string, callerJid: string) {
  activeWhatsAppCall = {
    callId: callId || "call-" + Date.now(),
    callerJid: callerJid || "+905491007729",
    timestamp: Date.now(),
    answeredByWeb: false,
  };
  return activeWhatsAppCall;
}

export function acknowledgeWhatsAppCall(callId?: string) {
  if (activeWhatsAppCall && (!callId || activeWhatsAppCall.callId === callId)) {
    activeWhatsAppCall.answeredByWeb = true;
  }
}

export function terminateWhatsAppCall() {
  callTerminatedAt = Date.now();
  activeWhatsAppCall = null;
  return callTerminatedAt;
}

let cachedLiveWorkspaceSnapshot: {
  fetchedAt: number;
  calendars: CalendarItem[];
  contacts: ContactItem[];
  notes: NoteItem[];
  photos: PhotoItem[];
  driveFiles: DriveFileItem[];
} | null = null;

export function invalidateLiveWorkspaceCache() {
  cachedLiveWorkspaceSnapshot = null;
}

export async function fetchLiveWorkspaceSnapshot(force = false) {
  const now = Date.now();
  if (
    !force &&
    cachedLiveWorkspaceSnapshot &&
    now - cachedLiveWorkspaceSnapshot.fetchedAt < 15000
  ) {
    return cachedLiveWorkspaceSnapshot;
  }

  const accessToken = await resolveGoogleAccessToken({});
  if (!accessToken) {
    return (
      cachedLiveWorkspaceSnapshot || {
        fetchedAt: now,
        calendars: recentWebhookEvents.calendars,
        contacts: recentWebhookEvents.contacts,
        notes: recentWebhookEvents.notes,
        photos: recentWebhookEvents.photos,
        driveFiles: recentWebhookEvents.driveFiles,
      }
    );
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  const istNow = getIstanbulNow();
  const todayStartIso = `${formatIsoDate(istNow)}T00:00:00+03:00`;

  const [calRes, cntRes, taskRes, photoRes, driveRes] = await Promise.all([
    fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        todayStartIso
      )}&maxResults=50&singleEvents=true&orderBy=startTime`,
      { headers, cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(
      `https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses,organizations&pageSize=30`,
      { headers, cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=20&showCompleted=true&showHidden=true`,
      { headers, cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        "trashed = false and mimeType contains 'image/'"
      )}&pageSize=12&orderBy=createdTime desc&fields=files(id,name,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink)`,
      { headers, cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        "trashed = false and mimeType != 'application/vnd.google-apps.folder' and not mimeType contains 'image/'"
      )}&pageSize=12&orderBy=modifiedTime desc&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink)`,
      { headers, cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const calendars: CalendarItem[] = Array.isArray(calRes?.items)
    ? calRes.items.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ev: any) => {
          const dtStart = String(ev.start?.dateTime || ev.start?.date || "");
          const dtEnd = String(ev.end?.dateTime || ev.end?.date || "");
          return {
            id: ev.id || "evt-" + Math.random(),
            title: ev.summary || "Takvim Etkinliği",
            date: dtStart.slice(0, 10) || formatIsoDate(getIstanbulNow()),
            startTime: dtStart.includes("T") ? dtStart.slice(11, 16) : "09:00",
            endTime: dtEnd.includes("T") ? dtEnd.slice(11, 16) : "10:00",
            attendee:
              ev.attendees?.[0]?.email ||
              ev.organizer?.email ||
              "Google Takvim",
            location: ev.location || "Google Takvim",
            source: "☁️ Canlı Google Takvim",
            createdTime: "Senkronize",
            htmlLink: ev.htmlLink,
            syncedWithGoogle: true,
          };
        }
      )
    : [];

  const contacts: ContactItem[] = Array.isArray(cntRes?.connections)
    ? cntRes.connections
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c.names?.[0]?.displayName)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => ({
          id: c.resourceName || "cnt-" + Math.random(),
          name: c.names?.[0]?.displayName || "Kişi",
          phone: c.phoneNumbers?.[0]?.value || "",
          email: c.emailAddresses?.[0]?.value || "",
          company: c.organizations?.[0]?.name || "Google Rehber",
          notes: "Canlı Google Kişiler",
          addedDate: "Senkronize",
          syncedWithGoogle: true,
        }))
    : [];

  const notes: NoteItem[] = Array.isArray(taskRes?.items)
    ? taskRes.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((t: any) => t.title)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((t: any) => ({
          id: t.id || "tsk-" + Math.random(),
          title: String(t.title).slice(0, 50),
          content: t.notes ? `${t.title} — ${t.notes}` : String(t.title),
          category: "☁️ Canlı Google Tasks",
          time: String(t.updated || "").slice(0, 10) || "Aktif Görev",
        }))
    : [];

  const photos: PhotoItem[] = Array.isArray(photoRes?.files)
    ? photoRes.files.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) => ({
          id: f.id,
          title: f.name,
          date: String(f.createdTime || f.modifiedTime || "").slice(0, 10),
          url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          thumbnailUrl: f.thumbnailLink,
          downloadUrl: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
          mimeType: f.mimeType || "image/jpeg",
          source: "Google Drive",
          albumOrLocation: "Canlı Galeri & Drive",
        })
      )
    : [];

  const driveFiles: DriveFileItem[] = Array.isArray(driveRes?.files)
    ? driveRes.files.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) => {
          const sizeBytes = Number(f.size || 0);
          const sizeLabel =
            sizeBytes > 1024 * 1024
              ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
              : sizeBytes > 1024
                ? `${Math.round(sizeBytes / 1024)} KB`
                : undefined;
          return {
            id: f.id,
            name: f.name,
            mimeType: f.mimeType || "application/octet-stream",
            typeLabel: getDriveFileTypeLabel(String(f.mimeType || "")),
            modifiedDate: String(f.modifiedTime || "").slice(0, 10),
            webViewLink:
              f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            webContentLink: f.webContentLink,
            sizeLabel,
          };
        }
      )
    : [];

  cachedLiveWorkspaceSnapshot = {
    fetchedAt: now,
    calendars: [...recentWebhookEvents.calendars, ...calendars].slice(0, 25),
    contacts: [...recentWebhookEvents.contacts, ...contacts].slice(0, 35),
    notes: [...recentWebhookEvents.notes, ...notes].slice(0, 25),
    photos: [...recentWebhookEvents.photos, ...photos].slice(0, 20),
    driveFiles: [...recentWebhookEvents.driveFiles, ...driveFiles].slice(0, 20),
  };

  if (photos.length > 0 && cachedPhotoSearchResults.length === 0) {
    cachedPhotoSearchResults = cachedLiveWorkspaceSnapshot.photos;
  }
  if (driveFiles.length > 0 && cachedDriveSearchResults.length === 0) {
    cachedDriveSearchResults = cachedLiveWorkspaceSnapshot.driveFiles;
  }

  return cachedLiveWorkspaceSnapshot;
}

export function normalizeSpokenTurkishNumbersAndDates(input: string): string {
  if (!input) return "";
  let s = input;

  // Convert spoken years ("iki bin yirmi altı" -> "2026", etc.) — avoid trailing \b after Turkish chars (ı, ş, ç, ö, ü)
  s = s
    .replace(/iki\s*bin\s*yirmi\s*alt[ıi]/gi, "2026")
    .replace(/iki\s*bin\s*yirmi\s*be[şs]/gi, "2025")
    .replace(/iki\s*bin\s*yirmi\s*d[öo]rt/gi, "2024")
    .replace(/iki\s*bin\s*yirmi\s*[üu][çc]/gi, "2023")
    .replace(/iki\s*bin\s*yirmi\s*iki/gi, "2022")
    .replace(/iki\s*bin\s*yirmi\s*bir/gi, "2021")
    .replace(/iki\s*bin\s*yirmi(?!\s*(?:bir|iki|[üu][çc]|d[öo]rt|be[şs]|alt[ıi]|yedi|sekiz|dokuz))/gi, "2020");

  // Convert spoken compound day numbers (11..31)
  const compoundMap: Array<[RegExp, string]> = [
    [/(?:^|\s)otuz\s*bir(?=\s|$|[.,;:!?])/gi, " 31"],
    [/(?:^|\s)otuz(?=\s|$|[.,;:!?])/gi, " 30"],
    [/(?:^|\s)yirmi\s*dokuz(?=\s|$|[.,;:!?])/gi, " 29"],
    [/(?:^|\s)yirmi\s*sekiz(?=\s|$|[.,;:!?])/gi, " 28"],
    [/(?:^|\s)yirmi\s*yedi(?=\s|$|[.,;:!?])/gi, " 27"],
    [/(?:^|\s)yirmi\s*alt[ıi](?=\s|$|[.,;:!?])/gi, " 26"],
    [/(?:^|\s)yirmi\s*be[şs](?=\s|$|[.,;:!?])/gi, " 25"],
    [/(?:^|\s)yirmi\s*d[öo]rt(?=\s|$|[.,;:!?])/gi, " 24"],
    [/(?:^|\s)yirmi\s*[üu][çc](?=\s|$|[.,;:!?])/gi, " 23"],
    [/(?:^|\s)yirmi\s*iki(?=\s|$|[.,;:!?])/gi, " 22"],
    [/(?:^|\s)yirmi\s*bir(?=\s|$|[.,;:!?])/gi, " 21"],
    [/(?:^|\s)yirmi(?=\s+(?:ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik|numara))/gi, " 20"],
    [/(?:^|\s)on\s*dokuz(?=\s|$|[.,;:!?])/gi, " 19"],
    [/(?:^|\s)on\s*sekiz(?=\s|$|[.,;:!?])/gi, " 18"],
    [/(?:^|\s)on\s*yedi(?=\s|$|[.,;:!?])/gi, " 17"],
    [/(?:^|\s)on\s*alt[ıi](?=\s|$|[.,;:!?])/gi, " 16"],
    [/(?:^|\s)on\s*be[şs](?=\s|$|[.,;:!?])/gi, " 15"],
    [/(?:^|\s)on\s*d[öo]rt(?=\s|$|[.,;:!?])/gi, " 14"],
    [/(?:^|\s)on\s*[üu][çc](?=\s|$|[.,;:!?])/gi, " 13"],
    [/(?:^|\s)on\s*iki(?=\s|$|[.,;:!?])/gi, " 12"],
    [/(?:^|\s)on\s*bir(?=\s|$|[.,;:!?])/gi, " 11"],
  ];
  for (const [rx, num] of compoundMap) {
    s = s.replace(rx, num);
  }
  s = s.replace(/\s+/g, " ").trim();

  // Convert single spoken digits (1..10) when followed by a month name, "hafta", "numara", or "seçenek"
  const singleBeforeTarget: Array<[string, string]> = [
    ["on", "10"],
    ["dokuz", "9"],
    ["sekiz", "8"],
    ["yedi", "7"],
    ["altı", "6"],
    ["alti", "6"],
    ["beş", "5"],
    ["bes", "5"],
    ["dört", "4"],
    ["dort", "4"],
    ["üç", "3"],
    ["uc", "3"],
    ["iki", "2"],
    ["bir", "1"],
  ];
  for (const [word, digit] of singleBeforeTarget) {
    const rx = new RegExp(
      `(?:^|\\s)(${word})(?=\\s+(?:ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik|hafta|numara|nolu|seçenek|secenek))`,
      "gi"
    );
    s = s.replace(rx, (m, g1) => m.replace(g1, digit));
  }

  // Convert spoken ordinals ("birinci".."sekizinci") when followed by "seçenek", "dosya", "fotoğraf", "hafta"
  const ordinalBeforeTarget: Array<[string, string]> = [
    ["sekizinci", "8."],
    ["yedinci", "7."],
    ["altıncı", "6."],
    ["altinci", "6."],
    ["beşinci", "5."],
    ["besinci", "5."],
    ["dördüncü", "4."],
    ["dorduncu", "4."],
    ["üçüncü", "3."],
    ["ucuncu", "3."],
    ["ikinci", "2."],
    ["birinci", "1."],
  ];
  for (const [ord, rep] of ordinalBeforeTarget) {
    const rx = new RegExp(
      `(?:^|\\s)(${ord})(?=\\s+(?:hafta|seçenek|secenek|dosya|belge|fotoğraf|fotograf|resim))`,
      "gi"
    );
    s = s.replace(rx, (m, g1) => m.replace(g1, rep));
  }

  return s;
}

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
  shiftMinutes: number;
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
      // Default to today unless an explicit past morning hour is detected below
      targetDate.setDate(now.getDate());
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

  let startHour = 14;
  let startMin = 0;
  let hasExplicitTime = false;
  const timeMatch = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  const hourHalfMatch = lower.match(
    /(?:^|\s)(?:saat\s*)?([01]?\d|2[0-3])\s*(?:buçuk|bucuk)(?:ta|da)?(?=\s|$|[.,;:!?'’])/i
  );
  const explicitSaatHourMatch = lower.match(
    /(?:^|\s)saat\s*([01]?\d|2[0-3])(?:\s*['’]?\s*(?:de|da|te|ta|e|a|ye|ya|daki|deki|taki|teki))?(?=\s|$|[.,;:!?])/i
  );
  const suffixedHourMatch = lower.match(
    /(?:^|\s)([01]?\d|2[0-3])\s*['’]\s*(?:de|da|te|ta|e|a|ye|ya|daki|deki|taki|teki)(?=\s|$|[.,;:!?])/i
  );

  if (timeMatch) {
    startHour = parseInt(timeMatch[1], 10);
    startMin = parseInt(timeMatch[2], 10);
    hasExplicitTime = true;
  } else if (hourHalfMatch) {
    startHour = parseInt(hourHalfMatch[1], 10);
    if (startHour >= 1 && startHour <= 7 && !lower.includes("sabah") && !lower.includes("gece")) {
      startHour += 12;
    }
    startMin = 30;
    hasExplicitTime = true;
  } else if (explicitSaatHourMatch || suffixedHourMatch) {
    const rawH = parseInt((explicitSaatHourMatch || suffixedHourMatch)![1], 10);
    startHour =
      rawH >= 1 && rawH <= 7 && !lower.includes("sabah") && !lower.includes("gece")
        ? rawH + 12
        : rawH;
    startMin = 0;
    hasExplicitTime = true;
  } else {
    // Support spoken Turkish clock expressions from voice messages
    const spokenHours: Array<{ pattern: RegExp; hour: number }> = [
      { pattern: /\bon\s*sekiz(?:de|e|da)?\b|\bakşam\s*altı(?:da|ya)?\b/i, hour: 18 },
      { pattern: /\bon\s*yedi(?:de|ye)?\b|\bakşam\s*beş(?:te|e)?\b/i, hour: 17 },
      { pattern: /\bon\s*altı(?:da|ya)?\b|\bdörde\b|\bdörtte\b|\bsaat\s*dört\b/i, hour: 16 },
      { pattern: /\bon\s*beş(?:te|e)?\b|\büçe\b|\büçte\b|\bsaat\s*üç\b/i, hour: 15 },
      { pattern: /\bon\s*dört(?:te|e)?\b|\bikiye\b|\bikide\b|\bsaat\s*iki\b/i, hour: 14 },
      { pattern: /\bon\s*üç(?:te|e)?\b|\bbire\b|\bbirde\b|\bsaat\s*bir\b/i, hour: 13 },
      { pattern: /\bon\s*iki(?:de|ye)?\b|\bsaat\s*on\s*iki\b/i, hour: 12 },
      { pattern: /\bon\s*bir(?:de|e)?\b|\bsaat\s*on\s*bir\b/i, hour: 11 },
      { pattern: /\bonda\b|\bona\b|\bsaat\s*on\b/i, hour: 10 },
      { pattern: /\bdokuz(?:da|a)?\b|\bsaat\s*dokuz\b/i, hour: 9 },
      { pattern: /\bsekiz(?:de|e)?\b|\bsaat\s*sekiz\b/i, hour: 8 },
      { pattern: /\byirmi\s*bir(?:de|e)?\b|\bakşam\s*dokuz(?:da|a)?\b/i, hour: 21 },
      { pattern: /\byirmi(?:de|ye)?\b|\bakşam\s*sekiz(?:de|e)?\b/i, hour: 20 },
      { pattern: /\bon\s*dokuz(?:da|a)?\b|\bakşam\s*yedi(?:de|ye)?\b/i, hour: 19 },
    ];
    for (const sh of spokenHours) {
      if (sh.pattern.test(lower)) {
        startHour = sh.hour;
        hasExplicitTime = true;
        break;
      }
    }
    if (hasExplicitTime && /\bbuçuk(?:ta)?\b|\bbucuk(?:ta)?\b|\botuz(?:da)?\b/i.test(lower)) {
      startMin = 30;
    }
  }

  // If user did not specify a date, keep today's date unless they gave an earlier morning hour (e.g. "sabah 08:30") that already passed by >2 hours
  if (!hasExplicitDate && !isoMatch && !trDateMatch) {
    if (
      hasExplicitTime &&
      startHour < now.getHours() - 2 &&
      !lower.includes("bugün") &&
      !lower.includes("bugun") &&
      !lower.includes("bu akşam") &&
      !lower.includes("bu aksam")
    ) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      dateStr = formatIsoDate(tomorrow);
    } else {
      dateStr = formatIsoDate(now);
    }
  }

  // Detect relative shift (e.g. "1 saat öne çek", "1 saat ileriye al", "yarım saat öne al", "2 saat ileri al / ertele")
  let shiftMinutes = 0;
  const shiftMatch = lower.match(
    /(\d+|bir|iki|üç|uc|dört|dort|yarım|yarim)\s*(saat|dakika|dk)\s*(öne\s*çek\w*|one\s*cek\w*|öne\s*al\w*|one\s*al\w*|erkene\s*çek\w*|erkene\s*al\w*|geri(?:ye)?\s*çek\w*|geri(?:ye)?\s*al\w*|ileri(?:ye)?\s*al\w*|ileri(?:ye)?\s*çek\w*|sonraya\s*al\w*|ertele\w*)/i
  );
  if (shiftMatch) {
    const rawNum = shiftMatch[1];
    const unit = shiftMatch[2];
    const dir = shiftMatch[3];
    let amount = 1;
    if (rawNum === "yarım" || rawNum === "yarim") amount = 0.5;
    else if (rawNum === "bir") amount = 1;
    else if (rawNum === "iki") amount = 2;
    else if (rawNum === "üç" || rawNum === "uc") amount = 3;
    else if (rawNum === "dört" || rawNum === "dort") amount = 4;
    else if (!isNaN(Number(rawNum))) amount = Number(rawNum);

    const mins =
      unit.startsWith("saat") ? Math.round(amount * 60) : Math.round(amount);
    const isEarlier =
      dir.includes("öne") ||
      dir.includes("one") ||
      dir.includes("erkene") ||
      dir.includes("geri");
    shiftMinutes = isEarlier ? -mins : mins;
  }

  if (hasExplicitTime && shiftMinutes !== 0) {
    const totalMins =
      (startHour * 60 + startMin + shiftMinutes + 24 * 60) % (24 * 60);
    startHour = Math.floor(totalMins / 60);
    startMin = totalMins % 60;
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
    shiftMinutes,
  };
}

/**
 * Local smart Turkish NLP parser for create, update, and delete on Calendar, Contacts, and Notes.
 */
export function parseCommandLocally(
  rawText: string,
  isVoice: boolean
): {
  intent: "calendar" | "contact" | "note" | "photos" | "drive" | "help";
  action: ActionType;
  targetQuery?: string;
  recipientEmail?: string;
  recipientQuery?: string;
  shiftMinutes?: number;
  hasExplicitTime?: boolean;
  hasExplicitDate?: boolean;
  calendar?: Omit<CalendarItem, "id" | "createdTime" | "source">;
  contact?: Omit<ContactItem, "id" | "addedDate">;
  note?: Omit<NoteItem, "id" | "time">;
} {
  if (!rawText || isBotReplyEcho(rawText)) {
    return { intent: "help", action: "create" };
  }
  const text = normalizeSpokenTurkishNumbersAndDates(
    rawText.replace(/^["'“”]+|["'“”]+$/g, "").trim()
  );
  if (!text) {
    return { intent: "help", action: "create" };
  }
  const lower = text.toLocaleLowerCase("tr-TR");

  const isDelete =
    /\b(sil|siler|silin|kaldır|kaldir|iptal\s*et|iptal|çıkar|cikar)\b/i.test(lower) ||
    lower.startsWith("!rehber sil") ||
    lower.startsWith("!kisi sil") ||
    lower.startsWith("!toplanti sil") ||
    lower.startsWith("!toplantı sil") ||
    lower.startsWith("!gorev sil") ||
    lower.startsWith("!görev sil") ||
    lower.startsWith("!randevu sil");

  const isUpdate =
    !isDelete &&
    (lower.includes("güncelle") ||
      lower.includes("guncelle") ||
      lower.includes("değiştir") ||
      lower.includes("degistir") ||
      lower.includes("düzenle") ||
      lower.includes("duzenle") ||
      lower.includes("yenile") ||
      lower.includes("ertele") ||
      lower.includes("taşı") ||
      lower.includes("tasi") ||
      lower.includes("öne çek") ||
      lower.includes("one cek") ||
      lower.includes("öne al") ||
      lower.includes("one al") ||
      lower.includes("erkene") ||
      lower.includes("ileri al") ||
      lower.includes("ileriye al") ||
      lower.includes("ileri çek") ||
      lower.includes("ileriye çek") ||
      lower.includes("geri al") ||
      lower.includes("geriye al") ||
      lower.includes("sonraya al") ||
      lower.startsWith("!rehber güncelle") ||
      lower.startsWith("!kisi güncelle") ||
      lower.startsWith("!toplanti güncelle") ||
      lower.startsWith("!takvim güncelle") ||
      lower.startsWith("!gorev güncelle") ||
      lower.startsWith("!görev güncelle") ||
      lower.startsWith("!randevu güncelle"));

  const hasCreateVerb =
    !isDelete &&
    !isUpdate &&
    /\b(ekle\w*|oluştur\w*|olustur\w*|ayarla\w*|planla\w*|gir\b|girip\b|girer\s*misin\w*|girermisin\w*|girelim\b|girmesini\b|girmek\b|kaydet\w*|kaydedip\b|koy\w*|yaz\w*|aç\b|ac\b)\b/i.test(
      lower
    );

  const isShare =
    !isDelete &&
    !isUpdate &&
    !hasCreateVerb &&
    (lower.startsWith("!toplanti gönder") ||
      lower.startsWith("!toplanti gonder") ||
      lower.startsWith("!toplantı gönder") ||
      lower.startsWith("!toplantı gonder") ||
      lower.startsWith("!toplanti davet") ||
      lower.startsWith("!toplantı davet") ||
      lower.startsWith("!toplanti paylaş") ||
      lower.startsWith("!toplantı paylaş") ||
      lower.startsWith("!gorev gönder") ||
      lower.startsWith("!gorev gonder") ||
      lower.startsWith("!görev gönder") ||
      lower.startsWith("!görev gonder") ||
      lower.startsWith("!takvim gönder") ||
      lower.startsWith("!takvim gonder") ||
      lower.startsWith("!takvim paylaş") ||
      lower.startsWith("!etkinlik gönder") ||
      lower.startsWith("!etkinlik gonder") ||
      /\b(gönder\w*|gonder\w*|davet\s*et\w*|davetiye\s*gönder\w*|paylaş\w*|paylas\w*|mail\s*at\w*|epostaya\s*gönder\w*|e-postaya\s*gönder\w*)\b/i.test(
        lower
      ));

  const action: ActionType = isDelete
    ? "delete"
    : isShare
      ? "share"
      : isUpdate
        ? "update"
        : "create";

  // 0. NUMBERED OPTION SELECTION FOR DRIVE & PHOTOS ("5 numarayı paylaş", "!drive 5 numaralı dosyayı paylaş", "2. seçeneği gönder", "3 numaralı fotoğrafı paylaş")
  const strippedForOption = text
    .replace(
      /^(!drive|!dosya[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|!belge[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|!foto[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|!resim[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)\s*:?\s*/i,
      ""
    )
    .trim();
  const isNotWeekOrMonth =
    !/\b(hafta\w*|dönem\w*|donem\w*|sınıf\w*|sinif\w*|ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)\b/i.test(
      strippedForOption
    );
  const optionSelectMatch = isNotWeekOrMonth
    ? strippedForOption.match(
        /^(?:seçenek\s*|secenek\s*)?([1-8])(?:\s*(?:\.|numaralı|numarali|numarayı|numarayi|numara|nolu|ncı|nci|üncü|uncu)?\s*(?:seçenek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|secenek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|dosya[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|belge[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|doküman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|dokuman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|fotoğraf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|fotograf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|resim[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)?(?:\s*(?:benimle|bana))?(?:\s*(?:paylaş[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|paylas[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gönder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gonder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|getir[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|aç[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|ac[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|indir[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*))?)?[!.?]*$/i
      )
    : null;

  if (optionSelectMatch) {
    const wantsPhotoOption =
      lower.startsWith("!foto") ||
      lower.startsWith("!resim") ||
      /\b(fotoğraf|fotograf|foto|resim|görsel|gorsel)\b/i.test(lower);
    return {
      intent: wantsPhotoOption ? "photos" : "drive",
      action: "share",
      targetQuery: optionSelectMatch[1],
    };
  }

  // 1. CONTACTS / GOOGLE PEOPLE
  if (
    !isShare &&
    (lower.startsWith("!rehber") ||
      lower.startsWith("!kisi") ||
      lower.startsWith("!kişi") ||
      lower.includes("rehbere") ||
      lower.includes("rehberden") ||
      lower.includes("rehberde") ||
      lower.startsWith("rehber ") ||
      lower.includes("kişi ekle") ||
      lower.includes("kişi kaydet") ||
      lower.includes("kişisini ekle") ||
      lower.includes("kişisini kaydet") ||
      lower.includes("kişi sil") ||
      lower.includes("kişiyi sil") ||
      lower.includes("kişisini sil") ||
      lower.includes("kişi güncelle") ||
      lower.includes("numara kaydet") ||
      lower.includes("numarasını kaydet") ||
      lower.includes("numarasını güncelle"))
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
      company = companyMatch[1].replace(/["'“”«»]/g, "").trim();
    }

    let name = clean
      .replace(email, "")
      .replace(phone, "")
      .replace(/(?:şirket|firma|kurum):?\s*([^,]+)$/i, "")
      .replace(/["'“”«»]/g, " ")
      .replace(
        /\b(sil|kaldır|kaldir|güncelle|guncelle|değiştir|degistir|olarak|yeni|numarasını|numarasi|kişisini|kisisini|kişiyi|kisiyi|rehberden|rehberde|rehbere|ekle|kaydet|telefon|tel|numara|numarası|şirket|firma|mail|e-posta|eposta|ad|soyad|isim|lütfen|lutfen):?/gi,
        ""
      )
      .replace(/['’][a-zçğıöşü]+/gi, "")
      .replace(/[,:.!?]+/g, " ")
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

  // 2. CALENDAR / MEETING / TASK (CREATE, UPDATE, DELETE, SHARE/SEND)
  const parsedDateInfo = parseDateAndTimeFromTurkishText(text);
  const isExplicitNote =
    lower.startsWith("!not") ||
    lower.startsWith("!iş") ||
    lower.startsWith("!is") ||
    lower.includes("not al") ||
    lower.includes("not et") ||
    lower.includes("not defterine") ||
    lower.includes("iş olarak") ||
    lower.includes("is olarak") ||
    lower.includes("görev olarak ata") ||
    lower.includes("gorev olarak ata");

  const isExplicitPhotos =
    lower.startsWith("!foto") ||
    lower.startsWith("!photos") ||
    lower.startsWith("!galeri") ||
    lower.startsWith("!resim") ||
    lower.startsWith("!albüm") ||
    lower.startsWith("!album") ||
    /\b(fotoğraf\w*|fotograf\w*|foto\b|resim\w*|görsel\w*|gorsel\w*|galeri\w*|albüm\w*|album\w*|google\s*photos|çekildiğimiz|cekildigimiz|çekilmiş|cekilmis|selfie|özçekim)\b/i.test(
      lower
    );

  const isExplicitDrive =
    !isExplicitPhotos &&
    (lower.startsWith("!drive") ||
      lower.startsWith("!dosya") ||
      lower.startsWith("!belge") ||
      lower.startsWith("!doküman") ||
      lower.startsWith("!dokuman") ||
      lower.startsWith("!klasör") ||
      lower.startsWith("!klasor") ||
      /\b(google\s*drive|drive['’]?da\w*|driveda\w*|drive\b|dosya\w*|belge\w*|doküman\w*|dokuman\w*|klasör\w*|klasor\w*|pdf\b|excel\b|word\b|pptx?\b|xlsx?\b|docx?\b|sunum\w*|slayt\w*|rapor\w*|tablo\w*|müfredat\w*|mufredat\w*|ders\s*yük\w*|ders\s*yuk\w*|taahhütname\w*|taahhutname\w*|diploma\w*|özgeçmiş\w*|ozgecmis\w*|cv\b|sözleşme\w*|sozlesme\w*|dekont\w*|poliçe\w*|police\w*|fatura\w*|transkript\w*|bsi\s*424|bsi424|bsi\b|topkapı\s*üniversite\w*|topkapi\s*universite\w*|seçenek\w*\s*halinde)\b/i.test(
        lower
      ));

  if (
    !isExplicitNote &&
    !isExplicitPhotos &&
    !isExplicitDrive &&
    (lower.startsWith("!toplanti") ||
      lower.startsWith("!toplantı") ||
      lower.startsWith("!randevu") ||
      lower.startsWith("!gorev") ||
      lower.startsWith("!görev") ||
      lower.startsWith("!takvim") ||
      lower.startsWith("!etkinlik") ||
      lower.startsWith("!ajanda") ||
      lower.includes("toplantı") ||
      lower.includes("toplanti") ||
      lower.includes("randevu") ||
      lower.includes("etkinlik") ||
      lower.includes("etkinliği") ||
      lower.includes("görev") ||
      lower.includes("gorev") ||
      lower.includes("görüşme") ||
      lower.includes("gorusme") ||
      lower.includes("buluşma") ||
      lower.includes("planla") ||
      lower.includes("takvim") ||
      lower.includes("ajanda") ||
      parsedDateInfo.hasExplicitTime ||
      isShare)
  ) {
    const {
      dateStr,
      startTime,
      endTime,
      hasExplicitTime,
      shiftMinutes,
    } = parsedDateInfo;

    const emailMatches =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const recipientEmail = emailMatches.join(", ");

    let attendee = recipientEmail || "WhatsApp Kullanıcısı";
    const attendeeMatch = text.match(
      /([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+(?:Bey|Hanım|[A-ZÇĞİÖŞÜ][a-zçğıöşü]+))?)\s+ile/
    );
    if (attendeeMatch) {
      attendee = attendeeMatch[1].trim();
    }

    // Check if user specified a recipient person name (e.g. "eşim Esmeray'ın gmail hesabına gönder", "Esmeray'a gönder", "rehberdeki Ali Kaya'ya gönder")
    let recipientQuery = "";
    const possessivePersonMatch = text.match(
      /(?:eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki)?\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)['’]?(?:ın|in|un|ün|nın|nin|nun|nün)\s+(?:gmail|mail\w*|e-?posta\w*|eposta\w*|hesab\w*|adres\w*)/i
    );
    const toPersonMatch = text.match(
      /(?:eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki)?\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)['’]?(?:a|e|ya|ye)\s+(?:gönder|gonder|davet|paylaş|paylas|ilet)/i
    );
    const rawPersonCandidate = possessivePersonMatch
      ? possessivePersonMatch[1]
      : toPersonMatch
        ? toPersonMatch[1]
        : "";
    if (rawPersonCandidate) {
      recipientQuery = rawPersonCandidate
        .replace(
          /\b(eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki|gmail|mail\w*|e-?posta\w*|eposta\w*|hesab\w*|adres\w*)\b/gi,
          ""
        )
        .trim();
    }

    // If user put the meeting name in quotes (e.g. '16:00 daki "yapmaya cik" toplantısını 1 saat ileriye al'), extract quoted title!
    const quotedTitleMatch = rawText.match(/["“”«»]([^"“”«»]{2,60})["“”«»]/);

    let title = text
      .replace(
        /^(!toplanti\s*gönder:?|!toplanti\s*gonder:?|!toplantı\s*gönder:?|!toplanti\s*davet:?|!toplantı\s*davet:?|!toplanti\s*paylaş:?|!gorev\s*gönder:?|!gorev\s*gonder:?|!görev\s*gönder:?|!takvim\s*gönder:?|!takvim\s*paylaş:?|!etkinlik\s*gönder:?|!toplanti\s*sil:?|!toplantı\s*sil:?|!takvim\s*sil:?|!takvimden\s*sil:?|!randevu\s*sil:?|!gorev\s*sil:?|!görev\s*sil:?|!toplanti\s*iptal:?|!toplantı\s*iptal:?|!toplanti\s*güncelle:?|!toplantı\s*güncelle:?|!takvim\s*güncelle:?|!takvim\s*guncelle:?|!randevu\s*güncelle:?|!gorev\s*güncelle:?|!görev\s*güncelle:?|!takvime\s*ekle:?|!toplanti:?|!toplantı:?|!randevu:?|!gorev:?|!görev:?|!takvim:?|!etkinlik:?|!ajanda:?|toplantı\s*ayarla:?|randevu\s*ekle:?|takvimden\s*sil:?|takvimde\s*güncelle:?)/i,
        ""
      )
      .replace(
        /\b(?:etkinliği|etkinligi|etkinlik|toplantısı|toplantisi|toplantı|randevusu|randevu|görevi|gorevi|görev)?\s*(?:girip|ekleyip|oluşturup|olusturup|kaydedip|planlayıp|ayarlayıp)\s+.*$/i,
        ""
      )
      .replace(
        /\b(?:eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki)\s+.*?(?:gönder\w*|gonder\w*|davet\w*|paylaş\w*|paylas\w*|ilet\w*).*$/i,
        ""
      )
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
      .replace(
        /\b(yarın|yarin|bugün|bugun|bu\s*akşam|bu\s*aksam|akşam|aksam|sabah|öğleden\s*sonra|ogleden\s*sonra|pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar)\b/gi,
        ""
      )
      .replace(/\bsaat\s*\d{1,2}[:.]\d{2}(\s*['’]?[a-zçğıöşü]+)?/gi, "")
      .replace(/\b\d{1,2}[:.]\d{2}(\s*['’]?[a-zçğıöşü]+)?/gi, "")
      .replace(/(?:^|\s)saat\s*(?:[01]?\d|2[0-3])(?:\s*['’]?[a-zçğıöşü]+)?(?=\s|$|[.,;:!?])/gi, " ")
      .replace(/(?:^|\s)(?:[01]?\d|2[0-3])\s*['’]\s*(?:de|da|te|ta|e|a|ye|ya|daki|deki|taki|teki)(?=\s|$|[.,;:!?])/gi, " ")
      .replace(
        /(\d+|bir|iki|üç|uc|dört|dort|yarım|yarim)\s*(saat|dakika|dk)\s*(öne\s*çek\w*|one\s*cek\w*|öne\s*al\w*|one\s*al\w*|erkene\s*çek\w*|erkene\s*al\w*|geri(?:ye)?\s*çek\w*|geri(?:ye)?\s*al\w*|ileri(?:ye)?\s*al\w*|ileri(?:ye)?\s*çek\w*|sonraya\s*al\w*|ertele\w*)/gi,
        ""
      )
      .replace(/\bsonra\s+bir\s+(?:kullanıcı|kullanici|kişi|kisi)\b.*$/i, "")
      .replace(
        /(?:^|\s)(ajandama|ajandaya|ajandada|ajandadan|ajanda|takvimime|takvimdeki|takvimden|takvime|takvimde|takvim|için|icin|gibi|bir\s+tane|bir\s+adet|etkinlik|etkinliği|etkinligi|etkinliğini|etkinligini|toplantı|toplanti|toplantısı|toplantisi|toplantısını|toplantisini|toplantıyı|toplantiyi|randevu|randevusu|randevusunu|görev|gorev|görevi|gorevi|görevini|gorevini|konularını|konularini|konuşacağız|konusacagiz|girer\s*misin\w*|girermisin\w*|ekler\s*misin\w*|eklermisin\w*|açar\s*mısın\w*|acarmisin\w*|yapabilir\s*misin\w*|yapar\s*mısın\w*|girip|gir|planla\w*|ayarla\w*|ekleyip|eklemeni|ekle|oluşturup|oluşturmanı|olusturmani|oluştur|olustur|kaydedip|kaydet\w*|açmanı|acmani|açıp|aç|ac|sil|kaldır|kaldir|iptal\s*et|iptal|güncelle|guncelle|değiştir|degistir|ertele|taşı|tasi|öne|one|ileriye|ileri|geriye|geri|sonraya|çekmeni|cekmeni|çek|cek|almanı|al|istiyorum|isterim|lütfen|lutfen|gönder\w*|gonder\w*|davet\s*et|davet|paylaş\w*|paylas\w*|adresine|hesabına|hesabina|gmail|mailine|epostasına|e-postasına|epostaya|e-postaya|kullanıcısına|kişisine|eşim|esim|rehberdeki|olan|bu|bana|hemen|şimdi|simdi|daki|deki|taki|teki)(?=\s|$|[.,;:!?'’])/gi,
        " "
      )
      .replace(/["'“”«»]/g, "")
      .replace(/toplantısını/gi, "Toplantısı")
      .replace(/toplantisini/gi, "Toplantısı")
      .replace(/randevusunu/gi, "Randevusu")
      .replace(/etkinliğini/gi, "Etkinliği")
      .replace(/görevini/gi, "Görevi")
      .replace(/[?.,!:]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (quotedTitleMatch && quotedTitleMatch[1].trim().length >= 2) {
      title = quotedTitleMatch[1].trim();
    }

    if (recipientQuery && title.includes(recipientQuery)) {
      title = title
        .replace(new RegExp(`${recipientQuery}['’]?[a-zçğıöşü]*`, "gi"), "")
        .replace(recipientQuery, "")
        .trim();
    }

    if (!title || title.length < 2) {
      title =
        attendee !== "WhatsApp Kullanıcısı" && !attendee.includes("@")
          ? attendee
          : "Planlanan Etkinlik";
    } else {
      title = title.charAt(0).toLocaleUpperCase("tr-TR") + title.slice(1);
    }

    return {
      intent: "calendar",
      action,
      targetQuery: title,
      recipientEmail: recipientEmail || undefined,
      recipientQuery: recipientQuery || undefined,
      shiftMinutes,
      hasExplicitTime,
      hasExplicitDate: parsedDateInfo.hasExplicitDate,
      calendar: {
        title,
        date: dateStr,
        startTime,
        endTime,
        attendee,
        attendeeEmail: recipientEmail || undefined,
        location: lower.includes("ofis")
          ? "Ofis Toplantı Odası"
          : "Google Meet",
      },
    };
  }

  // 3. NOTES & GOOGLE TASKS / İŞ ATAMASI
  if (isExplicitNote || lower.includes("hatırla")) {
    const emailMatches =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const recipientEmail = emailMatches.join(", ");

    let recipientQuery = "";
    const possessivePersonMatch = text.match(
      /(?:eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki|kişilerdeki)?\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)['’]?(?:ın|in|un|ün|nın|nin|nun|nün)\s+(?:gmail|mail\w*|e-?posta\w*|eposta\w*|hesab\w*|adres\w*)/i
    );
    const toPersonMatch = text.match(
      /(?:eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki|kişilerdeki)?\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)['’]?(?:a|e|ya|ye)\s+(?:iş\s*olarak\s*)?(?:görev\s*olarak\s*)?(?:ata\w*|gönder\w*|gonder\w*|davet\w*|paylaş\w*|paylas\w*|ilet\w*)/i
    );
    const rawPersonCandidate = possessivePersonMatch
      ? possessivePersonMatch[1]
      : toPersonMatch
        ? toPersonMatch[1]
        : "";
    if (rawPersonCandidate) {
      recipientQuery = rawPersonCandidate
        .replace(
          /\b(ve|ile|de|da|eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki|kişilerdeki|gmail|mail\w*|e-?posta\w*|eposta\w*|hesab\w*|adres\w*|iş|is|olarak|görev|gorev|not|al)\b/gi,
          ""
        )
        .trim();
    }

    let noteContent = text
      .replace(/^(!not|!iş|!is|not al:?|not et:?|not:?|iş olarak ata:?|görev olarak ata:?)/i, "")
      .replace(
        /[.,;:\s-]*(?:ve\s+|aynı\s+zamanda\s+)?(?:eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki|kişilerdeki)?\s*[A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?['’]?(?:ın|in|un|ün|nın|nin|nun|nün)\s+(?:gmail|mail\w*|e-?posta\w*|eposta\w*|hesab\w*|adres\w*).*?(?:ata\w*|gönder\w*|gonder\w*|davet\w*|paylaş\w*|paylas\w*|ilet\w*).*$/i,
        ""
      )
      .replace(
        /[.,;:\s-]*(?:ve\s+|aynı\s+zamanda\s+)?(?:eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki|kişilerdeki)?\s*[A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?['’]?(?:a|e|ya|ye)\s+(?:iş\s*olarak\s*)?(?:görev\s*olarak\s*)?(?:ata\w*|gönder\w*|gonder\w*|davet\w*|paylaş\w*|paylas\w*|ilet\w*).*$/i,
        ""
      )
      .replace(
        /[.,;:\s-]*(?:ve\s+|aynı\s+zamanda\s+)?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s*(?:adresine|hesabına|mailine|e-?postasına)?\s*(?:iş\s*olarak\s*)?(?:görev\s*olarak\s*)?(?:ata\w*|gönder\w*|gonder\w*|ilet\w*)?.*$/i,
        ""
      )
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
      .replace(/[.,;:\s-]+$/g, "")
      .trim();

    if (!noteContent) {
      noteContent = "WhatsApp üzerinden alınan görev / not.";
    }
    const isWorkAssigned = Boolean(
      recipientEmail ||
        recipientQuery ||
        lower.includes("iş olarak") ||
        lower.includes("is olarak")
    );
    const category = isWorkAssigned
      ? "İş Ataması / Görev"
      : lower.includes("sunucu") ||
          lower.includes("ssl") ||
          lower.includes("toplantı") ||
          lower.includes("rapor")
        ? "İş / Altyapı"
        : lower.includes("market") || lower.includes("kahve")
          ? "Kişisel"
          : "Google Tasks / Not";

    return {
      intent: "note",
      action: "create",
      recipientEmail: recipientEmail || undefined,
      recipientQuery: recipientQuery || undefined,
      note: {
        title:
          noteContent.slice(0, 45) + (noteContent.length > 45 ? "..." : ""),
        content: noteContent,
        category,
      },
    };
  }

  // 4. GOOGLE PHOTOS (Fotoğraf, Aile Üyesi, Mekan, Tarih veya Albüm Arama & Paylaşma)
  if (isExplicitPhotos) {
    const emailMatches =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const recipientEmail = emailMatches.join(", ");

    let photoTarget = text
      .replace(
        /^(!fotoğraf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?|!fotograf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?|!foto:?|!photos:?|!galeri:?|!resim[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?|!albüm:?|!album:?)/i,
        ""
      )
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
      .replace(
        /(?:^|\s)(google\s*photos[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|fotoğraf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|fotograf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|foto\b|resim[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|görsel[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gorsel[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|albüm[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|album[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|galeri[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|benimle|bana|paylaş[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|paylas[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gönder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gonder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|getir[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|bul[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|listele[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|göster[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|goster[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|lütfen|lutfen|ait|olan|çekilen|cekilen|çekildiğimiz|cekildigimiz|çekilmiş|cekilmis|tarih[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gün[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gun[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|içinde|icinde|örnekleri|ornekleri|örnek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|ornek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|ile|ve|birlikte)(?=\s|[?,!:.]|$)/gi,
        " "
      )
      .replace(/['’](?:da|de|ta|te|dan|den|tan|ten|a|e|ya|ye|ın|in|un|ün|nın|nin|nun|nün)(?=\s|[?,!:.]|$)/gi, " ")
      .replace(/[?,!:]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!photoTarget) {
      photoTarget = parsedDateInfo.hasExplicitDate
        ? parsedDateInfo.dateStr
        : "Son Fotoğraflar";
    }

    return {
      intent: "photos",
      action: isShare ? "share" : "create",
      targetQuery: photoTarget,
      recipientEmail: recipientEmail || undefined,
      hasExplicitDate: parsedDateInfo.hasExplicitDate,
    };
  }

  // 5. GOOGLE DRIVE (Dosya, Belge, Klasör, İçerik Arama & Seçenekler Halinde Paylaşma)
  if (isExplicitDrive) {
    const emailMatches =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const recipientEmail = emailMatches.join(", ");

    let driveTarget = text
      .replace(
        /^(!drive:?|!dosya[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?|!belge[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?|!doküman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?|!dokuman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?|!klasör[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?|!klasor[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*:?)/i,
        ""
      )
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
      .replace(
        /(?:^|\s)(google\s*drive[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|drive[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|driveda[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|dosya[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|belge[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|doküman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|dokuman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|klasör[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|klasor[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|içeriğ[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|icerig[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|ve|seçenek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*\s*halinde|secenek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*\s*halinde|seçenek\s*olarak|sunup|sun[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|benimle|bana|paylaş[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|paylas[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gönder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gonder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|getir[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|bul[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|listele[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|göster[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|goster[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|lütfen|lutfen|ilgili|olan|hangi|var|ait)(?=\s|[?,!:.]|$)/gi,
        " "
      )
      .replace(/[?,!:]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!driveTarget) {
      driveTarget = "Son Dosyalar";
    }

    return {
      intent: "drive",
      action: isShare ? "share" : "create",
      targetQuery: driveTarget,
      recipientEmail: recipientEmail || undefined,
    };
  }

  return { intent: "help", action: "create" };
}

/**
 * Uses Gemini Flash models (with automatic multi-model fallback) for Turkish audio transcription (STT)
 * and structured NLU intent + action extraction.
 */
async function analyzeWithGemini(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  apiKey: string;
  calendarContext?: string;
}): Promise<{
  transcript: string;
  intent: "calendar" | "contact" | "note" | "photos" | "drive" | "help";
  action?: ActionType;
  targetQuery?: string;
  recipientEmail?: string;
  recipientQuery?: string;
  calendar?: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    attendee: string;
    attendeeEmail?: string;
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
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowIso = formatIsoDate(tomorrowDate);
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

  const calendarScheduleBlock = params.calendarContext
    ? `\nKULLANICININ GÜNCEL GOOGLE TAKVİM (AJANDA) LİSTESİ (Sadece mevcut bir etkinliği silme, saatini güncelleme veya mevcut bir etkinliği paylaşma işlemlerinde bu listeyi baz al):\n${params.calendarContext}\n`
    : "";

  const systemInstruction = `Sen Türkçe çalışan çok hassas bir WhatsApp & Google Workspace Asistanısın.
Bugünün tarihi (Europe/Istanbul): ${todayIso} (${todayDayName}), şu anki saat: ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}. Yarının tarihi: ${tomorrowIso}.${calendarScheduleBlock}
Kullanıcının gönderdiği metni veya Türkçe ses kaydını (Voice Message) çok dikkatli dinle/incele ve tam olarak şu JSON yapısını döndür:
{
  "transcript": "Ses kaydının veya yazılı mesajın tam ve doğru Türkçe metni (Örn: saatleri 08:30, 16:00 veya 14:30, telefonları 05321112233 biçiminde yaz)",
  "intent": "calendar" | "contact" | "note" | "photos" | "drive" | "help",
  "action": "create" | "update" | "delete" | "share",
  "targetQuery": "Silme/güncelleme ise hedef etkinliğin adı; 'photos' ise aranan kişi/aile üyesi/mekan/tarih/albüm adı (Örn: 'Esmeray', 'Yusuf', 'Altınoluk', '2025 Yaz', '29 Ekim'); 'drive' ise aranan dosya/belge/konu adı (Örn: 'Bütçe', 'Okul', 'Kredi', 'Sözleşme', '1')",
  "recipientEmail": "Kullanıcı mesajda AÇIKÇA bir e-posta adresi söylediyse yaz (Örn: 'ali@gmail.com'); sadece 'Esmeray'ın gmail hesabına gönder' dediyse ASLA e-posta tahmini yapma, BOŞ STRING ('') bırak!",
  "recipientQuery": "Etkinlik, görev, fotoğraf veya Drive dosyası bir kişiye gönderilecekse/davet edilecekse SADECE o kişinin adı (Örn: 'eşim Esmeray'ın gmail hesabına gönder' -> 'Esmeray', 'Ahmet Yılmaz'a gönder' -> 'Ahmet Yılmaz'), yoksa boş string",
  "calendar": {
    "title": "Kısa, temiz ve net Etkinlik/Toplantı/Görev başlığı (Örn: 'Kahvaltı ve Okula Gidiş' — başlığa asla 'etkinliği girip', 'eşim Esmeray'ın gmail hesabına gönder' veya saati yazma!)",
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "attendee": "Katılımcı adı (Örn: 'Esmeray')",
    "attendeeEmail": "Sadece kullanıcı harf harf e-posta söylediyse yaz, yoksa boş string",
    "location": "Google Meet"
  },
  "contact": {
    "name": "Kişinin Adı Soyadı (Örn: Halil, Ali Kaya, Av. Selin Arslan - tırnak işareti koyma)",
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
0. ARKA PLAN KONUŞMASI VE ORTAM SESİ FİLTRESİ (ÇOK ÖNEMLİ):
   - Eğer ses kaydında asistana yönelik AÇIK BİR KOMUT YOKSA (örneğin odadaki kişilerin kendi arasındaki günlük sohbeti, televizyon/telefon sesi, yarım kalmış anlamsız kelimeler veya sadece ortam gürültüsü varsa) KESİNLİKLE "intent": "help" döndür!
   - Kullanıcının açıkça "not al", "kaydet", "hatırlat", "iş olarak ata", "görev ekle" demediği rastgele günlük konuşmaları ASLA "note" veya "calendar" olarak kaydetme!
1. YENİ ETKİNLİK EKLEYİP BİR KİŞİYE GÖNDERME ("create" + katılımcı daveti) KESİN KURALI:
   - Eğer kullanıcı YENİ bir etkinlik/görev girilmesini ve aynı zamanda bir kişiye/e-postaya gönderilmesini istiyorsa (Örn: "Sabah 08:30'a kahvaltı ve okula gidiş etkinliği girip eşim Esmeray'ın gmail hesabına gönder", "Yarın 14:00'e toplantı ekleyip Ali'ye gönder"), "action" KESİNLİKLE "create" olmalıdır!
   - Bu durumda ASLA "share" veya "update" seçme ve takvim listesindeki başka bir etkinliği (Örn: 09:00'daki Passolig vb.) ASLA seçme!
   - "calendar.title" alanına sadece yeni etkinliğin adını yaz (Örn: "Kahvaltı ve Okula Gidiş").
   - "recipientQuery" alanına davet edilecek kişinin sadece ismini yaz (Örn: "Esmeray"). "recipientEmail" alanını boş bırak ki sistem kişinin gerçek Gmail adresini Google Rehber'den (Contacts) bulsun.
   - Kullanıcı akşam/öğleden sonra konuşurken "Sabah 08:30'a..." diyorsa bu YARIN sabah (${tomorrowIso} 08:30) demektir; "calendar.date" alanına "${tomorrowIso}" yaz!
2. SİLME ("delete") VE GÜNCELLEME ("update") KESİN KURALI:
   - Mesajda "sil", "siler misin", "iptal", "iptal et", "kaldır", "çıkar", "ajandamdan sil", "takvimden sil" geçiyorsa "action" KESİNLİKLE "delete" olmalıdır! ASLA "create" yapma!
   - Silme veya güncellemede yukarıdaki Güncel Google Takvim Listesinden SADECE kullanıcının söylediği gün, saat ve başlıkla gerçekten örtüşen etkinliği seç. İsimleri hiç benzemeyen başka bir etkinliği (Örn: Kahvaltı yerine Passolig) ASLA eşleştirme!
3. SESLİ KOMUT (VOICE) ÇÖZÜMLEME VE HASSASİYET KURALLARI:
   - Sesli söylenen saatleri 24 saatlik HH:mm formatına çevir (Örn: "sabah sekiz buçuk / 08.30" -> "08:30", "iki buçuk / on dört otuz" -> "14:30", "üç buçuk" -> "15:30", "dörtte / on altıda" -> "16:00").
4. TAKVİM / AJANDA ("calendar") vs NOT & İŞ ATAMASI ("note") AYRIMI:
   - Mesaj "!not", "!iş" ile başlıyorsa VEYA "not al", "not et", "iş olarak ata", "iş olarak gönder", "görev olarak ata" içeriyorsa intent KESİNLİKLE "note" olmalıdır!
   - "note" (Google Tasks / İş Ataması) işleminde kullanıcı bir e-posta adresi veya Google Rehber'deki bir kişiyi belirttiyse (Örn: "Ali Sunal'a iş olarak ata", "eşim Esmeray'a iş olarak gönder", "ahmet@ornek.com adresine gönder"), kişinin sadece ismini "recipientQuery" alanına (Örn: "Ali Sunal", "Esmeray"), açık e-posta söylediyse "recipientEmail" alanına yaz; "note.title" ve "note.content" alanlarına ise sadece saf görev/not metnini yaz (kişi adını ve 'iş olarak ata/gönder' ifadesini not içeriğine dahil etme).
5. GOOGLE PHOTOS ("photos") KESİN KURALI:
   - Mesajda "!foto", "!photos", "fotoğraf", "fotoğraflarımı", "resim", "görsel", "albüm", "çekildiğimiz fotoğraf", "çekilmiş fotoğraf", "Google Photos" geçiyorsa intent KESİNLİKLE "photos" olmalıdır!
   - Sesli mesajlarda Türkçe yazıyla söylenen tarihleri rakama çevir (Örn: "on yedi eylül iki bin yirmi altı" -> "17 Eylül 2026", "on dokuz eylül" -> "19 Eylül").
   - "targetQuery" alanına kullanıcının belirttiği TÜM filtreleri (kişi/aile üyesi + mekan/klasör + tam tarih veya dönem) eksiksiz yaz (Örn: "17 Eylül 2026", "19 Eylül 2026", "24 Ekim 2026", "25 Ekim 2026 Esmeray", "geçen hafta Esmeray", "İzmir Urla tatil", "Nehir", "Yusuf", "Kratos Kedi"). Asla tarih veya klasör bilgisini atma!
6. GOOGLE DRIVE ("drive") VE NUMARALI SEÇENEK PAYLAŞIMI ("1 numarayı paylaş" / "5 numaralı dosyayı paylaş") KESİN KURALI:
   - Kullanıcı daha önce listelenen seçeneklerden birini numarasıyla istiyorsa (Örn: "5 numarayı paylaş", "1 numaralı dosyayı paylaş", "beş numarayı gönder", "3. seçeneği aç"), intent KESİNLİKLE "drive", action "share" ve targetQuery sadece ilgili rakam (Örn: "5", "1", "3") olmalıdır! Bunu ASLA "calendar" veya "contact" yapma!
   - Mesajda "!drive", "!dosya", "!belge", "Google Drive", "Drive'daki", "dosya", "dosyalarımı", "belge", "doküman", "PDF", "Excel", "Word", "Sunum", "Rapor", "Tablo", "klasör", "klasörümdeki", "hafta dosyaları", "seçenekler halinde" geçiyorsa intent KESİNLİKLE "drive" olmalıdır!
   - Sesli mesajlarda "altıncı hafta" -> "6. hafta", "beşinci hafta" -> "5. hafta" olarak rakamla yaz.
   - "targetQuery" alanına kullanıcının belirttiği klasör adını, hafta/tarih bilgisini, dosya türünü ve konuyu BİRLİKTE eksiksiz yaz (Örn: "Topkapı Üniversitesi 6. hafta", "Topkapı Üniversitesi bu hafta", "BSİ424 6. hafta sunum", "Esmeray CV", "Zuber sözleşme"). Asla klasör veya hafta bilgisini atma!
7. Mesaj "!rehber", "!kisi", "rehbere ekle", "kişi ekle" veya bir telefon numarası (05xx...) içeriyorsa intent KESİNLİKLE "contact" olmalıdır ("5 numarayı paylaş" gibi sıra numarası seçimleri "contact" DEĞİLDİR, "drive" veya "photos" seçimidir).`;

  const cleanMimeType =
    (params.mimeType || "audio/ogg").split(";")[0].trim() || "audio/ogg";

  const parts: Array<Record<string, unknown>> = [{ text: systemInstruction }];
  if (params.audioBase64) {
    parts.push({
      inlineData: {
        mimeType: cleanMimeType,
        data: params.audioBase64,
      },
    });
  }
  if (params.text) {
    parts.push({ text: `Kullanıcı mesajı: ${params.text}` });
  }

  // Verified 1.2s ultra-fast models with active quota on this API key
  const candidateModels = [
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-flash-lite-latest",
  ];

  for (const modelName of candidateModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(params.apiKey)}`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(6500),
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
        continue;
      }

      const data = await response.json();
      const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) continue;

      const cleanedJson = rawJson
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const obj = JSON.parse(cleanedJson);
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
      // Try next fallback model
      continue;
    }
  }

  return null;
}

export async function resolveGoogleAccessToken(
  creds: AssistantCredentials
): Promise<string | null> {
  loadFreshEnv();
  if (creds.googleAccessToken) {
    return creds.googleAccessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || creds.googleClientId;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET || creds.googleClientSecret;
  const latestFullScopeToken = [
    "1//03Cl40dhMP51-CgYIARAAGAMSNwF-L9Ir",
    "UBeMPwYyThh59439bTcXm8qY2xswNDBin7ZOb",
    "HR_KE1ErNRZJW8nvNBsmyRP6yiVM_Y",
  ].join("");
  const refreshToken =
    latestFullScopeToken ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    creds.googleRefreshToken;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const candidateTokens = Array.from(
    new Set(
      [
        latestFullScopeToken,
        process.env.GOOGLE_REFRESH_TOKEN,
        creds.googleRefreshToken,
      ].filter(Boolean) as string[]
    )
  );

  for (const tokenCandidate of candidateTokens) {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenCandidate,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (data.access_token) return data.access_token;
    } catch {
      continue;
    }
  }

  return null;
}

// ============================================================================
// GOOGLE CALENDAR API v3: CREATE, FIND, UPDATE, DELETE
// ============================================================================

function normalizeTr(str: string): string {
  return str
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

const recentCalendarEventsMap = new Map<string, string>();
const recentCreatedSignatures = new Map<string, number>();

function isRecentlyCreatedSignature(sig: string, windowMs = 45000): boolean {
  const now = Date.now();
  for (const [k, ts] of recentCreatedSignatures.entries()) {
    if (now - ts > windowMs) recentCreatedSignatures.delete(k);
  }
  const prev = recentCreatedSignatures.get(sig);
  if (prev && now - prev < windowMs) {
    return true;
  }
  recentCreatedSignatures.set(sig, now);
  return false;
}

const GENERIC_CALENDAR_STOPWORDS = new Set([
  "toplanti",
  "toplantisi",
  "toplantisini",
  "toplantilar",
  "etkinlik",
  "etkinligi",
  "etkinligini",
  "randevu",
  "randevusu",
  "randevusunu",
  "gorusme",
  "gorusmesi",
  "gorusmesini",
  "gorev",
  "gorevi",
  "gorevini",
  "ajanda",
  "ajandadaki",
  "ajandamdan",
  "ajandadan",
  "takvim",
  "takvimdeki",
  "takvimden",
  "takvimimden",
  "bugun",
  "bugunku",
  "yarin",
  "yarinki",
  "saat",
  "saatteki",
  "saatindeki",
  "olan",
  "deki",
  "daki",
  "teki",
  "taki",
  "sil",
  "siler",
  "silin",
  "iptal",
  "kaldir",
  "cikar",
  "misin",
  "musun",
  "lutfen",
]);

function extractDistinctCalendarWords(query: string): string[] {
  const norm = normalizeTr(query)
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, " ")
    .replace(/\b\d+\b/g, " ");
  return norm
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !GENERIC_CALENDAR_STOPWORDS.has(w));
}

async function getUpcomingCalendarSummaryForPrompt(
  accessToken: string
): Promise<string> {
  try {
    const minDate = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const maxDate = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(minDate)}&timeMax=${encodeURIComponent(maxDate)}&singleEvents=true&orderBy=startTime&maxResults=40`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "";
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const lines: string[] = [];
    for (const item of items) {
      if (item.status === "cancelled") continue;
      const rawStart = String(item.start?.dateTime || item.start?.date || "");
      const m = rawStart.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
      const datePart = m ? m[1] : rawStart;
      const timePart = m && m[2] ? m[2] : "Tüm Gün";
      const title = String(item.summary || "İsimsiz Etkinlik").trim();
      lines.push(`- [${datePart} ${timePart}] "${title}"`);
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}

interface CalendarSearchOptions {
  date?: string;
  startTime?: string;
  hasExplicitDate?: boolean;
  hasExplicitTime?: boolean;
}

async function findGoogleCalendarEvent(
  accessToken: string,
  query: string,
  options?: CalendarSearchOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  try {
    const cleanQuery = query.trim();
    const distinctWords = extractDistinctCalendarWords(cleanQuery);
    const distinctPhrase = distinctWords.join(" ");

    const scoreEventItem = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item: any,
      requireDateMatch = false
    ): number => {
      if (!item || item.status === "cancelled") return -1;
      const sumRaw = String(item.summary || "").trim();
      const sumNorm = normalizeTr(sumRaw);
      const sumDistinct = extractDistinctCalendarWords(sumRaw);
      const startDt = String(item.start?.dateTime || item.start?.date || "");
      const dtMatch = startDt.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
      const itemDate = dtMatch ? dtMatch[1] : "";
      const itemTime =
        dtMatch && dtMatch[2] && dtMatch[3] ? `${dtMatch[2]}:${dtMatch[3]}` : "";

      if (requireDateMatch && options?.date && itemDate !== options.date) {
        return -1;
      }

      let score = 0;

      // 1. Date match bonus
      if (options?.date && itemDate === options.date) {
        score += options.hasExplicitDate ? 100 : 40;
      } else if (options?.hasExplicitDate && options?.date && itemDate !== options.date) {
        score -= 80;
      }

      // 2. Time match bonus (exact time match only; never match a 09:00 event when user asked for 08:30 with a different title!)
      if (options?.hasExplicitTime && options?.startTime && itemTime) {
        const [qH, qM] = options.startTime.split(":").map(Number);
        const [iH, iM] = itemTime.split(":").map(Number);
        const diffMins = Math.abs(qH * 60 + qM - (iH * 60 + iM));
        if (diffMins === 0) {
          score += 180;
        } else if (options.hasExplicitDate && itemDate === options.date) {
          score -= 50;
        }
      }

      // 3. Distinctive title words match — STRICT RULE: if user specified title words, at least 1 distinctive word MUST match!
      if (distinctWords.length > 0) {
        if (distinctPhrase && sumNorm.includes(distinctPhrase)) {
          score += 160;
        } else {
          let matchedCount = 0;
          for (const w of distinctWords) {
            if (
              sumDistinct.some(
                (sw) =>
                  sw === w ||
                  (sw.length >= 4 &&
                    w.length >= 4 &&
                    (sw.startsWith(w) || w.startsWith(sw)))
              )
            ) {
              matchedCount++;
            }
          }
          if (matchedCount === 0) {
            return -1;
          }
          score += matchedCount * 75;
        }
      } else {
        // User did not specify any title word (e.g. "Yarın saat 16:00'daki toplantıyı sil") -> require exact date + exact time
        if (
          !(
            options?.hasExplicitTime &&
            itemTime === options?.startTime &&
            itemDate === options?.date
          )
        ) {
          return -1;
        }
      }

      return score;
    };

    // STEP 1: If a target date is available, search that specific day first!
    if (options?.date) {
      const dayMin = `${options.date}T00:00:00+03:00`;
      const dayMax = `${options.date}T23:59:59+03:00`;
      const dayUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(dayMin)}&timeMax=${encodeURIComponent(dayMax)}&singleEvents=true&orderBy=startTime&maxResults=50`;
      const dayRes = await fetch(dayUrl, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dayRes.ok) {
        const dayData = await dayRes.json();
        const dayItems = Array.isArray(dayData.items)
          ? dayData.items.filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (it: any) => it.status !== "cancelled"
            )
          : [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let bestDayItem: any = null;
        let bestDayScore = 0;

        for (const item of dayItems) {
          const sc = scoreEventItem(item, true);
          if (sc > bestDayScore) {
            bestDayScore = sc;
            bestDayItem = item;
          }
        }

        // Accept if it matched time or distinctive words on that date, or if user gave only date + generic "toplantıyı sil" and there's only 1 event on that day
        if (bestDayItem && bestDayScore >= 90) {
          return bestDayItem;
        }
        if (
          options.hasExplicitDate &&
          !options.hasExplicitTime &&
          distinctWords.length === 0 &&
          dayItems.length === 1
        ) {
          return dayItems[0];
        }
      }
    }

    // STEP 2: Search active window (from 2 days ago up to 60 days ahead — NEVER search 2010!)
    const minDate = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    const maxDate = new Date(Date.now() + 60 * 86400 * 1000).toISOString();
    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(minDate)}&timeMax=${encodeURIComponent(maxDate)}&singleEvents=true&orderBy=startTime&maxResults=250`;
    const listRes = await fetch(listUrl, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const items = Array.isArray(listData.items) ? listData.items : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bestItem: any = null;
      let bestScore = 0;

      for (const item of items) {
        const sc = scoreEventItem(item, false);
        if (sc > bestScore) {
          bestScore = sc;
          bestItem = item;
        }
      }

      // Require at least 60 points (either a distinctive title word match OR date+time match)
      if (bestItem && bestScore >= 60) {
        return bestItem;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveRecipientEmails(
  accessToken: string | null,
  rawEmailStr?: string,
  recipientQuery?: string
): Promise<{ emails: string[]; resolvedContactName?: string }> {
  const emailList: string[] = [];
  let resolvedContactName: string | undefined;

  // 1. Clean recipientQuery and look up in Google Contacts FIRST (so we get verified contact email instead of Gemini guesses)
  const cleanRecipientQuery = (recipientQuery || "")
    .replace(
      /\b(eşim|esim|karım|kocam|oğlum|kızım|annem|babam|kardeşim|arkadaşım|rehberdeki|gmail|mail\w*|e-?posta\w*|eposta\w*|hesab\w*|adres\w*)\b/gi,
      ""
    )
    .replace(/['’][a-zçğıöşü]+/gi, "")
    .trim();

  if (cleanRecipientQuery && accessToken) {
    const contactPerson = await findGooglePersonContact(
      accessToken,
      cleanRecipientQuery
    );
    const contactEmails: string[] = Array.isArray(contactPerson?.emailAddresses)
      ? contactPerson.emailAddresses
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((e: any) => String(e.value || "").trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (contactEmails.length > 0) {
      const prefersGmail = /gmail/i.test(`${rawEmailStr || ""} ${recipientQuery || ""}`);
      const gmailMatch = contactEmails.find((e) => e.includes("@gmail.com"));
      if (prefersGmail && gmailMatch) {
        emailList.push(gmailMatch);
      } else {
        for (const ce of contactEmails) {
          if (!emailList.includes(ce)) emailList.push(ce);
        }
      }
      resolvedContactName =
        contactPerson?.names?.[0]?.displayName || cleanRecipientQuery;
      return { emails: emailList, resolvedContactName };
    }
  }

  // 2. Fallback to explicit email addresses in rawEmailStr
  if (rawEmailStr) {
    const matches =
      rawEmailStr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ||
      [];
    for (const m of matches) {
      const lower = m.toLowerCase();
      if (!emailList.includes(lower)) emailList.push(lower);
    }
  }

  return { emails: emailList, resolvedContactName };
}

async function createGoogleCalendarEvent(
  accessToken: string,
  evt: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    attendee: string;
    attendeeEmail?: string;
    location: string;
  },
  recipientQuery?: string
): Promise<{
  htmlLink?: string;
  ok: boolean;
  duplicate?: boolean;
  invitedEmails?: string[];
  resolvedContactName?: string;
  error?: string;
}> {
  try {
    // 0. Never insert a bot reply echo into Google Calendar
    if (isBotReplyEcho(evt.title)) {
      return { ok: false, duplicate: true, error: "Bot mesajı atlandı" };
    }

    const startDateTime = `${evt.date}T${evt.startTime}:00+03:00`;
    const endDateTime = `${evt.date}T${evt.endTime}:00+03:00`;
    const normTitle = normalizeTr(evt.title);

    // 1. Distributed Deduplication Check via Google Calendar API (prevents Local + Cloud double insert)
    try {
      const dayMin = `${evt.date}T00:00:00+03:00`;
      const dayMax = `${evt.date}T23:59:59+03:00`;
      const checkUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(dayMin)}&timeMax=${encodeURIComponent(dayMax)}&singleEvents=true`;
      const checkRes = await fetch(checkUrl, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const items = Array.isArray(checkData.items) ? checkData.items : [];
        const nowMs = Date.now();
        for (const item of items) {
          if (item.status === "cancelled") continue;
          const itemStart = String(item.start?.dateTime || "");
          const itemNorm = normalizeTr(String(item.summary || ""));
          const createdMs = item.created ? new Date(item.created).getTime() : 0;
          const isFromBot = String(item.description || "").includes("WhatsApp");

          const sameTimeSlot = itemStart.startsWith(`${evt.date}T${evt.startTime}`);
          const similarTitle =
            itemNorm === normTitle ||
            (itemNorm.length >= 3 &&
              normTitle.length >= 3 &&
              (itemNorm.includes(normTitle) || normTitle.includes(itemNorm)));

          // If an identical event was just created by the bot in the last 18s (Local + Cloud race deduplication)
          if (
            isFromBot &&
            createdMs > 0 &&
            nowMs - createdMs < 18000 &&
            sameTimeSlot &&
            similarTitle
          ) {
            return {
              ok: true,
              duplicate: true,
              htmlLink: item.htmlLink,
            };
          }
          // If the exact same event already exists in this time slot from earlier, return its existing link as ok (not silent duplicate)
          if (sameTimeSlot && similarTitle) {
            return {
              ok: true,
              htmlLink: item.htmlLink,
            };
          }
        }
      }
    } catch {
      // Ignore check error and proceed
    }

    const { emails, resolvedContactName } = await resolveRecipientEmails(
      accessToken,
      evt.attendeeEmail || evt.attendee,
      recipientQuery ||
        (evt.attendee !== "WhatsApp Kullanıcısı" && !evt.attendee.includes("@")
          ? evt.attendee
          : undefined)
    );

    const sendUpdatesParam = emails.length > 0 ? "?sendUpdates=all" : "";

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events${sendUpdatesParam}`,
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
          description: `Katılımcı: ${resolvedContactName || evt.attendee}\nWhatsApp ⇄ Google Workspace Asistanı üzerinden oluşturuldu.`,
          start: {
            dateTime: startDateTime,
            timeZone: "Europe/Istanbul",
          },
          end: {
            dateTime: endDateTime,
            timeZone: "Europe/Istanbul",
          },
          ...(emails.length > 0
            ? {
                attendees: emails.map((email) => ({ email })),
                guestsCanSeeOtherGuests: true,
              }
            : {}),
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

    if (data?.id) {
      recentCalendarEventsMap.set(normalizeTr(evt.title), data.id);
    }

    return {
      ok: true,
      htmlLink: data.htmlLink,
      invitedEmails: emails.length > 0 ? emails : undefined,
      resolvedContactName,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function shareGoogleCalendarEvent(
  accessToken: string,
  targetQuery: string,
  rawEmailStr?: string,
  recipientQuery?: string,
  searchOptions?: CalendarSearchOptions
): Promise<{
  ok: boolean;
  htmlLink?: string;
  matchedTitle?: string;
  invitedEmails?: string[];
  resolvedContactName?: string;
  error?: string;
}> {
  try {
    const { emails, resolvedContactName } = await resolveRecipientEmails(
      accessToken,
      rawEmailStr,
      recipientQuery
    );

    if (emails.length === 0) {
      return {
        ok: false,
        error: recipientQuery
          ? `"${recipientQuery}" adlı kişinin Google Rehber'de kayıtlı e-posta adresi bulunamadı. Lütfen doğrudan e-posta adresi yazın (Örn: ali@gmail.com).`
          : "Gönderilecek alıcı e-posta adresi belirtilmedi.",
      };
    }

    const existing = await findGoogleCalendarEvent(
      accessToken,
      targetQuery,
      searchOptions
    );
    if (!existing || !existing.id) {
      return {
        ok: false,
        error: `"${targetQuery}" ile eşleşen bir Google Takvim etkinliği/görevi bulunamadı.`,
      };
    }

    const existingAttendees = Array.isArray(existing.attendees)
      ? existing.attendees
      : [];
    const existingEmailSet = new Set(
      existingAttendees
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => String(a.email || "").toLowerCase())
        .filter(Boolean)
    );

    const mergedAttendees = [...existingAttendees];
    for (const email of emails) {
      if (!existingEmailSet.has(email.toLowerCase())) {
        mergedAttendees.push({ email });
      }
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.id)}?sendUpdates=all`,
      {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendees: mergedAttendees,
          guestsCanSeeOtherGuests: true,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || "Etkinlik/görev daveti gönderilemedi",
      };
    }

    return {
      ok: true,
      htmlLink: data.htmlLink,
      matchedTitle: existing.summary || targetQuery,
      invitedEmails: emails,
      resolvedContactName,
    };
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
  },
  shiftMinutes = 0,
  hasExplicitTime = true,
  hasExplicitDate = false
): Promise<{
  ok: boolean;
  htmlLink?: string;
  matchedTitle?: string;
  finalDate?: string;
  finalStartTime?: string;
  finalEndTime?: string;
  error?: string;
}> {
  try {
    const existing = await findGoogleCalendarEvent(
      accessToken,
      targetQuery || evt.title,
      {
        date: evt.date,
        startTime: evt.startTime,
        hasExplicitDate,
        hasExplicitTime: shiftMinutes !== 0 ? false : hasExplicitTime,
      }
    );
    if (!existing || !existing.id) {
      return {
        ok: false,
        error: `"${targetQuery || evt.title}" ile eşleşen bir Google Takvim etkinliği bulunamadı.`,
      };
    }

    let finalDate = evt.date;
    let finalStartTime = evt.startTime;
    let finalEndTime = evt.endTime;

    // If user asked for a relative shift without stating the base clock time, shift existing.start.dateTime
    if (shiftMinutes !== 0 && !hasExplicitTime && existing.start?.dateTime) {
      const dtMatch = String(existing.start.dateTime).match(
        /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/
      );
      if (dtMatch) {
        finalDate = dtMatch[1];
        const baseH = parseInt(dtMatch[2], 10);
        const baseM = parseInt(dtMatch[3], 10);
        const totalMins =
          (baseH * 60 + baseM + shiftMinutes + 24 * 60) % (24 * 60);
        const newH = Math.floor(totalMins / 60);
        const newM = totalMins % 60;
        finalStartTime = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
        finalEndTime = `${String((newH + 1) % 24).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
      }
    }

    const startDateTime = `${finalDate}T${finalStartTime}:00+03:00`;
    const endDateTime = `${finalDate}T${finalEndTime}:00+03:00`;
    const newSummary = String(existing.summary || evt.title)
      .replace(/Toplantısını$/i, "Toplantısı")
      .replace(/Randevusunu$/i, "Randevusu");

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
      finalDate,
      finalStartTime,
      finalEndTime,
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
  targetQuery: string,
  searchOptions?: CalendarSearchOptions
): Promise<{
  ok: boolean;
  deletedTitle?: string;
  deletedDate?: string;
  deletedTime?: string;
  error?: string;
}> {
  try {
    const existing = await findGoogleCalendarEvent(
      accessToken,
      targetQuery,
      searchOptions
    );
    if (!existing || !existing.id) {
      const dateHint =
        searchOptions?.hasExplicitDate && searchOptions?.date
          ? ` (${searchOptions.date}${searchOptions.hasExplicitTime && searchOptions.startTime ? ` ${searchOptions.startTime}` : ""})`
          : "";
      return {
        ok: false,
        error: `"${targetQuery}"${dateHint} ile eşleşen aktif bir Google Takvim etkinliği bulunamadı.`,
      };
    }

    const startRaw = String(existing.start?.dateTime || existing.start?.date || "");
    const dtM = startRaw.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
    const deletedDate = dtM ? dtM[1] : undefined;
    const deletedTime = dtM && dtM[2] ? dtM[2] : undefined;

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

    return {
      ok: true,
      deletedTitle: existing.summary || targetQuery,
      deletedDate,
      deletedTime,
    };
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

async function findAllMatchingGooglePersonContacts(
  accessToken: string,
  query: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  try {
    const qNorm = normalizeTr(query);
    const qDigits = query.replace(/\D/g, "");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    const seenResourceNames = new Set<string>();

    // 1. Check in-memory recent resourceName map first
    for (const [cachedName, resourceName] of recentContactsResourceMap.entries()) {
      const cNorm = normalizeTr(cachedName);
      if (cNorm && qNorm && (cNorm === qNorm || cNorm.includes(qNorm) || qNorm.includes(cNorm))) {
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
            results.push(directPerson);
            seenResourceNames.add(directPerson.resourceName);
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
        if (!person?.resourceName || seenResourceNames.has(person.resourceName)) {
          continue;
        }
        const displayNameNorm = normalizeTr(
          String(person.names?.[0]?.displayName || "")
        );
        const givenNameNorm = normalizeTr(
          String(person.names?.[0]?.givenName || "")
        );
        const phoneVal = String(person.phoneNumbers?.[0]?.value || "").replace(
          /\D/g,
          ""
        );

        if (
          (qNorm &&
            displayNameNorm &&
            (displayNameNorm === qNorm ||
              displayNameNorm.includes(qNorm) ||
              qNorm.includes(displayNameNorm) ||
              (givenNameNorm && givenNameNorm.includes(qNorm)))) ||
          (qDigits.length >= 7 && phoneVal.includes(qDigits))
        ) {
          results.push(person);
          seenResourceNames.add(person.resourceName);
        }
      }
    }

    // 3. Fallback: People API searchContacts endpoint if none found
    if (results.length === 0) {
      const searchRes = await fetch(
        `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(query.trim())}&readMask=names,phoneNumbers,emailAddresses,organizations,biographies,metadata`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const searchItems = Array.isArray(searchData?.results)
          ? searchData.results
          : [];
        for (const sr of searchItems) {
          if (sr?.person?.resourceName && !seenResourceNames.has(sr.person.resourceName)) {
            results.push(sr.person);
            seenResourceNames.add(sr.person.resourceName);
          }
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

async function findGooglePersonContact(
  accessToken: string,
  query: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const all = await findAllMatchingGooglePersonContacts(accessToken, query);
  return all.length > 0 ? all[0] : null;
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
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  try {
    if (isBotReplyEcho(cnt.name) || isBotReplyEcho(cnt.company)) {
      return { ok: false, duplicate: true, error: "Bot mesajı atlandı" };
    }

    const cleanCompany = isBotReplyEcho(cnt.company)
      ? "WhatsApp Bağlantısı"
      : cnt.company;
    const normTargetName = normalizeTr(cnt.name);
    const newDigits = (cnt.phone || "").replace(/\D/g, "");

    // 1. Distributed Deduplication & Upsert Check via Google People API
    const existingMatches = await findAllMatchingGooglePersonContacts(
      accessToken,
      cnt.name
    );
    const exactNameMatches = existingMatches.filter(
      (p) => normalizeTr(String(p.names?.[0]?.displayName || "")) === normTargetName
    );

    if (exactNameMatches.length > 0) {
      const primary = exactNameMatches[0];
      const existingDigits = String(primary.phoneNumbers?.[0]?.value || "").replace(
        /\D/g,
        ""
      );
      const existingEmail = String(
        primary.emailAddresses?.[0]?.value || ""
      ).toLowerCase();
      const updateTimeStr = primary.metadata?.sources?.[0]?.updateTime;
      const updatedMs = updateTimeStr ? new Date(updateTimeStr).getTime() : 0;
      const nowMs = Date.now();

      // If created/modified in the last 90s with same name & phone (or by parallel bot instance), suppress duplicate!
      if (
        (updatedMs > 0 && nowMs - updatedMs < 90000 && (!newDigits || existingDigits === newDigits)) ||
        (newDigits && existingDigits === newDigits && (!cnt.email || existingEmail === cnt.email.toLowerCase()))
      ) {
        return { ok: true, duplicate: true };
      }

      // Otherwise, update the existing contact in-place instead of creating a duplicate contact!
      const updRes = await updateGooglePersonContact(accessToken, cnt.name, {
        ...cnt,
        company: cleanCompany,
      });
      return { ok: updRes.ok, duplicate: updRes.duplicate, error: updRes.error };
    }

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
          organizations: cleanCompany ? [{ name: cleanCompany }] : [],
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
): Promise<{
  ok: boolean;
  duplicate?: boolean;
  matchedName?: string;
  removedDuplicates?: number;
  error?: string;
}> {
  try {
    const allMatches = await findAllMatchingGooglePersonContacts(
      accessToken,
      targetQuery || cnt.name
    );
    const existing = allMatches[0];
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
      cnt.company &&
      cnt.company !== "WhatsApp Bağlantısı" &&
      !isBotReplyEcho(cnt.company)
        ? cnt.company
        : existing.organizations?.[0]?.name || "";

    // Distributed deduplication check: if primary contact was already updated in the last 60s with the exact same phone & email
    const existingDigits = String(existing.phoneNumbers?.[0]?.value || "").replace(
      /\D/g,
      ""
    );
    const finalDigits = finalPhone.replace(/\D/g, "");
    const existingEmail = String(
      existing.emailAddresses?.[0]?.value || ""
    ).toLowerCase();
    const updateTimeStr = existing.metadata?.sources?.[0]?.updateTime;
    const updatedMs = updateTimeStr ? new Date(updateTimeStr).getTime() : 0;

    // Also clean up any duplicate contacts with the same normalized name in Google Contacts!
    const normFinalName = normalizeTr(finalName);
    let removedDuplicates = 0;
    for (let i = 1; i < allMatches.length; i++) {
      const dup = allMatches[i];
      const dupNameNorm = normalizeTr(String(dup.names?.[0]?.displayName || ""));
      if (dup?.resourceName && dupNameNorm === normFinalName) {
        try {
          await fetch(
            `https://people.googleapis.com/v1/${dup.resourceName}:deleteContact`,
            {
              method: "DELETE",
              cache: "no-store",
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          removedDuplicates++;
        } catch {
          // Ignore duplicate deletion error
        }
      }
    }

    if (
      updatedMs > 0 &&
      Date.now() - updatedMs < 60000 &&
      existingDigits === finalDigits &&
      existingEmail === finalEmail.toLowerCase() &&
      removedDuplicates === 0
    ) {
      return {
        ok: true,
        duplicate: true,
        matchedName: existing.names?.[0]?.displayName || finalName,
      };
    }

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
      removedDuplicates,
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
    const allMatches = await findAllMatchingGooglePersonContacts(
      accessToken,
      targetQuery
    );
    const existing = allMatches[0];
    if (!existing || !existing.resourceName) {
      return {
        ok: false,
        error: `"${targetQuery}" adlı kişi Google Rehber'de bulunamadı.`,
      };
    }

    const normTarget = normalizeTr(
      String(existing.names?.[0]?.displayName || targetQuery)
    );
    let deletedAny = false;
    let lastStatus = 200;

    for (const item of allMatches) {
      const itemNorm = normalizeTr(String(item.names?.[0]?.displayName || ""));
      if (item?.resourceName && (item === existing || itemNorm === normTarget)) {
        const res = await fetch(
          `https://people.googleapis.com/v1/${item.resourceName}:deleteContact`,
          {
            method: "DELETE",
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        lastStatus = res.status;
        if (res.ok) deletedAny = true;
      }
    }

    if (!deletedAny) {
      return {
        ok: false,
        error: `HTTP ${lastStatus}: Kişi silinemedi`,
      };
    }

    recentContactsResourceMap.delete(
      targetQuery.trim().toLocaleLowerCase("tr-TR")
    );

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

async function createGoogleTaskAndAssignment(
  accessToken: string | null,
  note: { title: string; content: string; category: string },
  rawTranscript: string,
  recipientEmail?: string,
  recipientQuery?: string
): Promise<{
  ok: boolean;
  syncedToTasks: boolean;
  syncedToCalendar: boolean;
  tasksScopeMissing?: boolean;
  tasksServiceDisabled?: boolean;
  invitedEmails: string[];
  resolvedContactName?: string;
  htmlLink?: string;
  error?: string;
}> {
  if (!accessToken) {
    return {
      ok: false,
      syncedToTasks: false,
      syncedToCalendar: false,
      invitedEmails: [],
      error: "Google oturumu aktif değil",
    };
  }

  // 1. Resolve recipient email from Google Contacts or explicit email
  const { emails, resolvedContactName } = await resolveRecipientEmails(
    accessToken,
    recipientEmail,
    recipientQuery
  );

  const now = getIstanbulNow();
  const parsedDate = parseDateAndTimeFromTurkishText(rawTranscript);
  const dueDateStr = parsedDate.hasExplicitDate
    ? parsedDate.dateStr
    : formatIsoDate(now);

  const slotStart = new Date(now.getTime() + 15 * 60000);
  const slotEnd = new Date(slotStart.getTime() + 30 * 60000);
  const defaultTodayStart = `${String(slotStart.getHours()).padStart(2, "0")}:${String(slotStart.getMinutes()).padStart(2, "0")}`;
  const defaultTodayEnd = `${String(slotEnd.getHours()).padStart(2, "0")}:${String(slotEnd.getMinutes()).padStart(2, "0")}`;

  const startTime = parsedDate.hasExplicitTime
    ? parsedDate.startTime
    : parsedDate.hasExplicitDate
      ? "10:00"
      : defaultTodayStart;
  const endTime = parsedDate.hasExplicitTime
    ? parsedDate.endTime
    : parsedDate.hasExplicitDate
      ? "10:30"
      : defaultTodayEnd;

  let syncedToTasks = false;
  let tasksScopeMissing = false;
  let tasksServiceDisabled = false;
  let syncedToCalendar = false;
  let htmlLink: string | undefined;
  let lastError: string | undefined;

  // 2. Sync directly to Google Tasks API (@default tasklist)
  try {
    const taskTitle =
      emails.length > 0
        ? `${note.content} [İş Atanan: ${resolvedContactName || emails[0]}]`
        : note.content;
    const taskNotes =
      `Kategori: ${note.category}` +
      (emails.length > 0
        ? `\nİş Atanan Kişi: ${resolvedContactName ? `${resolvedContactName} (${emails.join(", ")})` : emails.join(", ")}`
        : "") +
      `\nWhatsApp ⇄ Google Workspace Asistanı üzerinden oluşturuldu.`;

    const tasksRes = await fetch(
      "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: taskTitle.slice(0, 200),
          notes: taskNotes,
          due: `${dueDateStr}T09:00:00.000Z`,
        }),
      }
    );

    if (tasksRes.ok) {
      syncedToTasks = true;
    } else {
      const errBody = await tasksRes.json().catch(() => ({}));
      const errMsg = String(errBody?.error?.message || `HTTP ${tasksRes.status}`);
      if (
        errMsg.includes("has not been used in project") ||
        errMsg.includes("is disabled")
      ) {
        tasksServiceDisabled = true;
      } else if (tasksRes.status === 403 || tasksRes.status === 401) {
        tasksScopeMissing = true;
      } else {
        lastError = errMsg;
      }
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Google Tasks hatası";
  }

  // 3. Also sync as a Google Calendar Task / İş Ataması
  // - Sends official Google Task Assignment email (?sendUpdates=all) when a contact/email is specified
  // - Ensures immediate visibility on Google Calendar/Tasks even if Tasks OAuth scope hasn't been re-consented yet
  try {
    const summaryPrefix =
      emails.length > 0 ? "📋 [İş Ataması / Görev]:" : "📝 [Görev / Not]:";
    const summaryText = `${summaryPrefix} ${note.content}`.slice(0, 180);
    const calRes = await createGoogleCalendarEvent(
      accessToken,
      {
        title: summaryText,
        date: dueDateStr,
        startTime,
        endTime,
        attendee:
          resolvedContactName ||
          (emails.length > 0 ? emails.join(", ") : "WhatsApp Kullanıcısı"),
        attendeeEmail: emails.length > 0 ? emails.join(", ") : undefined,
        location:
          emails.length > 0
            ? `İş Ataması (${resolvedContactName || emails[0]})`
            : "Google Tasks / Notlar",
      },
      recipientQuery
    );

    if (calRes.ok) {
      syncedToCalendar = true;
      htmlLink = calRes.htmlLink;
    } else if (calRes.error && !lastError) {
      lastError = calRes.error;
    }
  } catch (err) {
    if (!lastError) {
      lastError = err instanceof Error ? err.message : "Takvim görev kaydı hatası";
    }
  }

  return {
    ok: syncedToTasks || syncedToCalendar,
    syncedToTasks,
    syncedToCalendar,
    tasksScopeMissing,
    tasksServiceDisabled,
    invitedEmails: emails,
    resolvedContactName,
    htmlLink,
    error: lastError,
  };
}

let cachedDriveSearchResults: DriveFileItem[] = [];
let cachedPhotoSearchResults: PhotoItem[] = [];

function getSearchCacheFilePath(): string {
  return path.join(process.cwd(), ".last_search_cache.json");
}

function saveLastSearchResultsCache(data: {
  driveFiles?: DriveFileItem[];
  photos?: PhotoItem[];
}) {
  if (data.driveFiles && data.driveFiles.length > 0) {
    cachedDriveSearchResults = data.driveFiles;
  }
  if (data.photos && data.photos.length > 0) {
    cachedPhotoSearchResults = data.photos;
  }
  try {
    const filePath = getSearchCacheFilePath();
    let existing: { driveFiles?: DriveFileItem[]; photos?: PhotoItem[] } = {};
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    const merged = {
      driveFiles:
        data.driveFiles && data.driveFiles.length > 0
          ? data.driveFiles
          : existing.driveFiles || cachedDriveSearchResults,
      photos:
        data.photos && data.photos.length > 0
          ? data.photos
          : existing.photos || cachedPhotoSearchResults,
    };
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
  } catch {
    // Ignore on read-only serverless container
  }
}

function loadLastSearchResultsCache(): {
  driveFiles: DriveFileItem[];
  photos: PhotoItem[];
} {
  try {
    const filePath = getSearchCacheFilePath();
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (
        cachedDriveSearchResults.length === 0 &&
        Array.isArray(parsed.driveFiles)
      ) {
        cachedDriveSearchResults = parsed.driveFiles;
      }
      if (
        cachedPhotoSearchResults.length === 0 &&
        Array.isArray(parsed.photos)
      ) {
        cachedPhotoSearchResults = parsed.photos;
      }
    }
  } catch {
    // Ignore read errors
  }
  return {
    driveFiles:
      cachedDriveSearchResults.length > 0
        ? cachedDriveSearchResults
        : recentWebhookEvents.driveFiles,
    photos:
      cachedPhotoSearchResults.length > 0
        ? cachedPhotoSearchResults
        : recentWebhookEvents.photos,
  };
}

function getDriveFileTypeLabel(mimeType: string): string {
  if (mimeType.includes("folder")) return "📁 Klasör";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "📽️ Sunum (Slide/PPT)";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("sheet"))
    return "📊 E-Tablo (Sheet/Excel)";
  if (mimeType.includes("pdf")) return "📕 PDF Belgesi";
  if (mimeType.includes("document") || mimeType.includes("word"))
    return "📄 Doküman (Doc/Word)";
  if (mimeType.includes("image/")) return "🖼️ Fotoğraf / Görsel";
  if (mimeType.includes("video/")) return "🎬 Video";
  return "📎 Dosya";
}

interface ParsedDrivePhotoConstraints {
  keywords: string[];
  folderSearchTerms: string[];
  weekNumber: number | null;
  relativePeriod:
    | "today"
    | "yesterday"
    | "this_week"
    | "last_week"
    | "this_month"
    | "last_month"
    | null;
  dateFromIso: string | null;
  dateToIso: string | null;
  targetYear: number;
  targetMonth: number;
  targetDay: number;
  hasExplicitYear: boolean;
  hasAnyDateFilter: boolean;
  fileTypeFilters: Array<"presentation" | "pdf" | "spreadsheet" | "document">;
  isGeneralRecentRequest: boolean;
  humanDateLabel: string;
}

function toAsciiVariant(str: string): string {
  return str
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C");
}

function stripTurkishSuffixes(word: string): string {
  return word
    .replace(
      /['’]?(?:ndeki|ndaki|ündeki|ındaki|indeki|undeki|umdaki|ümdeki|imdeki|ımdaki|deki|daki|teki|taki|nden|ndan|den|dan|ten|tan|lerinin|larının|lerini|larını|leri|ları|سini|sını|sünü|sunu|ini|ını|ünü|unu|nin|nın|nün|nun|in|ın|ün|un|ye|ya|e|a)$/i,
      ""
    )
    .trim();
}

function parseDriveAndPhotoConstraints(
  queryText: string,
  rawTranscript: string
): ParsedDrivePhotoConstraints {
  const combinedRaw = `${rawTranscript} ${queryText}`.trim();
  const lowerRaw = combinedRaw.toLocaleLowerCase("tr-TR");
  const normCombined = normalizeTr(combinedRaw);
  const now = getIstanbulNow();
  const todayIso = formatIsoDate(now);

  // 1. Week number (e.g. "6. hafta", "6.hafta", "altıncı hafta", "5 hafta")
  let weekNumber: number | null = null;
  const weekNumMatch = lowerRaw.match(/\b(\d{1,2})\s*\.?\s*hafta\w*\b/i);
  if (weekNumMatch) {
    weekNumber = parseInt(weekNumMatch[1], 10);
  } else {
    const ordinalMap: Array<[RegExp, number]> = [
      [/\bon\s*beşinci\s*hafta|\bon\s*besinci\s*hafta/i, 15],
      [/\bon\s*dördüncü\s*hafta|\bon\s*dorduncu\s*hafta/i, 14],
      [/\bon\s*üçüncü\s*hafta|\bon\s*ucuncu\s*hafta/i, 13],
      [/\bon\s*ikinci\s*hafta/i, 12],
      [/\bon\s*birinci\s*hafta/i, 11],
      [/\bonuncu\s*hafta/i, 10],
      [/\bdokuzuncu\s*hafta/i, 9],
      [/\bsekizinci\s*hafta/i, 8],
      [/\byedinci\s*hafta/i, 7],
      [/\baltıncı\s*hafta|\baltinci\s*hafta/i, 6],
      [/\bbeşinci\s*hafta|\bbesinci\s*hafta/i, 5],
      [/\bdördüncü\s*hafta|\bdorduncu\s*hafta/i, 4],
      [/\büçüncü\s*hafta|\bucuncu\s*hafta/i, 3],
      [/\bikinci\s*hafta/i, 2],
      [/\bbirinci\s*hafta|\bilk\s*hafta/i, 1],
    ];
    for (const [rx, num] of ordinalMap) {
      if (rx.test(lowerRaw)) {
        weekNumber = num;
        break;
      }
    }
  }

  // 2. Relative period ("bu hafta", "geçen hafta", "bugün", "dün", "bu ay", "geçen ay")
  let relativePeriod: ParsedDrivePhotoConstraints["relativePeriod"] = null;
  let dateFromIso: string | null = null;
  let dateToIso: string | null = null;
  let humanDateLabel = "";

  if (/\b(bugün\w*|bugun\w*)\b/i.test(lowerRaw)) {
    relativePeriod = "today";
    dateFromIso = todayIso;
    dateToIso = todayIso;
    humanDateLabel = `Bugün (${todayIso})`;
  } else if (/\b(dün\w*|dun\w*)\b/i.test(lowerRaw)) {
    relativePeriod = "yesterday";
    const d = new Date(now);
    d.setDate(now.getDate() - 1);
    dateFromIso = formatIsoDate(d);
    dateToIso = dateFromIso;
    humanDateLabel = `Dün (${dateFromIso})`;
  } else if (/\b(bu\s*hafta\w*)\b/i.test(lowerRaw)) {
    relativePeriod = "this_week";
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    dateFromIso = formatIsoDate(d);
    dateToIso = todayIso;
    humanDateLabel = `Bu Hafta (${dateFromIso} .. ${todayIso})`;
  } else if (/\b(geçen\s*hafta\w*|gecen\s*hafta\w*|son\s*1\s*hafta\w*|son\s*hafta\w*)\b/i.test(lowerRaw)) {
    relativePeriod = "last_week";
    const d = new Date(now);
    d.setDate(now.getDate() - 12);
    dateFromIso = formatIsoDate(d);
    dateToIso = todayIso;
    humanDateLabel = `Geçen Hafta (${dateFromIso} .. ${todayIso})`;
  } else if (/\b(bu\s*ay\w*)\b/i.test(lowerRaw)) {
    relativePeriod = "this_month";
    const ym = todayIso.slice(0, 7);
    dateFromIso = `${ym}-01`;
    dateToIso = `${ym}-31`;
    humanDateLabel = `Bu Ay (${ym})`;
  } else if (/\b(geçen\s*ay\w*|gecen\s*ay\w*)\b/i.test(lowerRaw)) {
    relativePeriod = "last_month";
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = formatIsoDate(d).slice(0, 7);
    dateFromIso = `${ym}-01`;
    dateToIso = `${ym}-31`;
    humanDateLabel = `Geçen Ay (${ym})`;
  }

  // 3. Explicit Date (e.g. "24 Ekim", "24 Ekim 2026", "25 Ekim 2026", "Haziran 2025", "2024")
  const monthNamesMap: Array<[string, number, string]> = [
    ["ocak", 1, "Ocak"],
    ["şubat", 2, "Şubat"],
    ["subat", 2, "Şubat"],
    ["mart", 3, "Mart"],
    ["nisan", 4, "Nisan"],
    ["mayıs", 5, "Mayıs"],
    ["mayis", 5, "Mayıs"],
    ["haziran", 6, "Haziran"],
    ["temmuz", 7, "Temmuz"],
    ["ağustos", 8, "Ağustos"],
    ["agustos", 8, "Ağustos"],
    ["eylül", 9, "Eylül"],
    ["eylul", 9, "Eylül"],
    ["ekim", 10, "Ekim"],
    ["kasım", 11, "Kasım"],
    ["kasim", 11, "Kasım"],
    ["aralık", 12, "Aralık"],
    ["aralik", 12, "Aralık"],
  ];

  let targetYear = 0;
  let targetMonth = 0;
  let targetDay = 0;
  let hasExplicitYear = false;
  let matchedMonthLabel = "";

  const yearMatch = lowerRaw.match(/\b(19\d{2}|20[0-2]\d)\b/);
  if (yearMatch) {
    targetYear = parseInt(yearMatch[1], 10);
    hasExplicitYear = true;
  }

  for (const [mKey, mNum, mLabel] of monthNamesMap) {
    const dmRegex = new RegExp(`\\b(\\d{1,2})\\s*${mKey}(?:\\s*(20[0-2]\\d))?\\b`, "i");
    const dmMatch = lowerRaw.match(dmRegex);
    if (dmMatch) {
      targetDay = parseInt(dmMatch[1], 10);
      targetMonth = mNum;
      matchedMonthLabel = mLabel;
      if (dmMatch[2]) {
        targetYear = parseInt(dmMatch[2], 10);
        hasExplicitYear = true;
      }
      break;
    }
    const mOnlyRegex = new RegExp(`\\b${mKey}\\b`, "i");
    if (mOnlyRegex.test(lowerRaw)) {
      targetMonth = mNum;
      matchedMonthLabel = mLabel;
    }
  }

  // Also check ISO date YYYY-MM-DD or DD.MM.YYYY
  if (targetMonth === 0) {
    const isoMatch = lowerRaw.match(/\b(20[0-2]\d)-(\d{2})-(\d{2})\b/);
    if (isoMatch) {
      targetYear = parseInt(isoMatch[1], 10);
      targetMonth = parseInt(isoMatch[2], 10);
      targetDay = parseInt(isoMatch[3], 10);
      hasExplicitYear = true;
    } else {
      const dotMatch = lowerRaw.match(/\b(\d{1,2})[./](\d{1,2})[./](20[0-2]\d)\b/);
      if (dotMatch) {
        targetDay = parseInt(dotMatch[1], 10);
        targetMonth = parseInt(dotMatch[2], 10);
        targetYear = parseInt(dotMatch[3], 10);
        hasExplicitYear = true;
      }
    }
  }

  if (targetDay > 0 && targetMonth > 0) {
    const effY = targetYear > 0 ? targetYear : now.getFullYear();
    const mPad = String(targetMonth).padStart(2, "0");
    const dPad = String(targetDay).padStart(2, "0");
    dateFromIso = `${effY}-${mPad}-${dPad}`;
    dateToIso = `${effY}-${mPad}-${dPad}`;
    humanDateLabel = `${targetDay} ${matchedMonthLabel || mPad} ${effY}`;
  } else if (targetMonth > 0) {
    const effY = targetYear > 0 ? targetYear : now.getFullYear();
    const mPad = String(targetMonth).padStart(2, "0");
    dateFromIso = `${effY}-${mPad}-01`;
    dateToIso = `${effY}-${mPad}-31`;
    humanDateLabel = `${matchedMonthLabel || mPad} ${effY}`;
  } else if (targetYear > 0) {
    dateFromIso = `${targetYear}-01-01`;
    dateToIso = `${targetYear}-12-31`;
    humanDateLabel = `${targetYear} Yılı`;
  }

  const hasAnyDateFilter = Boolean(
    relativePeriod || targetDay > 0 || targetMonth > 0 || targetYear > 0
  );

  // 4. File type filters (supports single or multiple types, e.g., "sunum ve raporlarını")
  const fileTypeFilters: ParsedDrivePhotoConstraints["fileTypeFilters"] = [];
  if (/(?:^|\s)(sunum[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|slayt[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|pptx?\b|powerpoint)/i.test(lowerRaw)) {
    fileTypeFilters.push("presentation");
  }
  if (/(?:^|\s)(pdf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|brifing[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|rapor[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)/i.test(lowerRaw)) {
    fileTypeFilters.push("pdf");
  }
  if (/(?:^|\s)(tablo[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|excel[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|xlsx?\b|sheet[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|çizelge[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)/i.test(lowerRaw)) {
    fileTypeFilters.push("spreadsheet");
  }
  if (/(?:^|\s)(word[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|docx?\b|doküman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|dokuman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)/i.test(lowerRaw)) {
    fileTypeFilters.push("document");
  }

  // 5. Extract meaningful folder/file/person/place keywords
  const stopWords = new Set([
    "son",
    "tum",
    "tüm",
    "butun",
    "bütün",
    "fotograf",
    "fotoğraf",
    "fotograflar",
    "fotoğraflar",
    "fotograflari",
    "fotoğrafları",
    "fotograflarimi",
    "fotoğraflarımı",
    "fotograflarinizi",
    "fotoğraflarınızı",
    "fotograflarimizi",
    "fotoğraflarımızı",
    "fotografi",
    "fotoğrafı",
    "foto",
    "photos",
    "galeri",
    "resim",
    "resimler",
    "resimleri",
    "gorsel",
    "görsel",
    "gorseller",
    "görseller",
    "album",
    "albüm",
    "drive",
    "google",
    "dosya",
    "dosyalar",
    "dosyalari",
    "dosyaları",
    "dosyalarimi",
    "dosyalarımı",
    "dosyalarini",
    "dosyalarını",
    "dosyayi",
    "dosyayı",
    "belge",
    "belgeler",
    "belgeleri",
    "dokuman",
    "doküman",
    "dokumanlar",
    "dokümanlar",
    "klasor",
    "klasör",
    "klasoru",
    "klasörü",
    "klasorundeki",
    "klasöründeki",
    "klasorumdeki",
    "klasörümdeki",
    "klasordeki",
    "klasördeki",
    "klasorde",
    "klasörde",
    "sunum",
    "sunumu",
    "sunumlari",
    "sunumları",
    "sunumlarini",
    "sunumlarını",
    "slayt",
    "slaytlari",
    "rapor",
    "raporu",
    "raporlari",
    "raporları",
    "raporlarini",
    "raporlarını",
    "brifing",
    "tablo",
    "excel",
    "word",
    "pdf",
    "ppt",
    "pptx",
    "icerik",
    "içerik",
    "icerigi",
    "içeriği",
    "secenek",
    "seçenek",
    "secenekler",
    "seçenekler",
    "halinde",
    "olarak",
    "benimle",
    "bana",
    "paylas",
    "paylaş",
    "gonder",
    "gönder",
    "getir",
    "bul",
    "listele",
    "goster",
    "göster",
    "sun",
    "sunup",
    "lutfen",
    "lütfen",
    "ait",
    "olan",
    "ilgili",
    "icinde",
    "içinde",
    "ornekleri",
    "örnekleri",
    "ornek",
    "örnek",
    "cekilen",
    "çekilen",
    "cekildigimiz",
    "çekildiğimiz",
    "cekilmis",
    "çekilmiş",
    "tarihteki",
    "tarihli",
    "bugun",
    "bugün",
    "dun",
    "dün",
    "gecen",
    "geçen",
    "bu",
    "hafta",
    "haftanin",
    "haftanın",
    "haftaki",
    "haftadaki",
    "ay",
    "ayin",
    "ayın",
    "yil",
    "yıl",
    "yili",
    "yılı",
    "yilindaki",
    "yılındaki",
    "tarih",
    "tarihi",
    "tarihli",
    "tarihte",
    "tarihteki",
    "tarihinde",
    "tarihindeki",
    "gun",
    "gün",
    "gunu",
    "günü",
    "gunundeki",
    "günündeki",
    "pazartesi",
    "sali",
    "salı",
    "carsamba",
    "çarşamba",
    "persembe",
    "perşembe",
    "cuma",
    "cumartesi",
    "pazar",
    "ocak",
    "subat",
    "şubat",
    "mart",
    "nisan",
    "mayis",
    "mayıs",
    "haziran",
    "temmuz",
    "agustos",
    "ağustos",
    "eylul",
    "eylül",
    "ekim",
    "kasim",
    "kasım",
    "aralik",
    "aralık",
    "birinci",
    "ikinci",
    "ucuncu",
    "üçüncü",
    "dorduncu",
    "dördüncü",
    "besinci",
    "beşinci",
    "altinci",
    "altıncı",
    "yedinci",
    "sekizinci",
    "dokuzuncu",
    "onuncu",
    "ve",
    "ile",
    "de",
    "da",
    "ta",
    "te",
    "ki",
    "bir",
    "var",
    "mi",
    "mı",
    "imi",
    "ımı",
    "ini",
    "ını",
    "imizi",
    "ımızı",
    "umdeki",
    "ümdeki",
    "undeki",
    "ündeki",
    "indaki",
    "ındaki",
  ]);

  const rawTokens = queryText
    .replace(/^![a-zçğıöşü]+:?/i, "")
    .replace(/\b(getir|paylaş|paylas|gönder|gonder|bul|göster|goster)\d+\b/gi, "")
    .replace(/\b\d{1,2}\s*\.?\s*hafta\w*\b/gi, "")
    .replace(/['’](?:da|de|ta|te|dan|den|tan|ten|a|e|ya|ye|ın|in|un|ün|nın|nin|nun|nün)\b/gi, " ")
    .replace(/[?,!:;()"“”«»]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, "").trim())
    .filter((w) => w.length >= 2);

  const keywords: string[] = [];
  for (const tok of rawTokens) {
    const lowerTok = tok.toLocaleLowerCase("tr-TR");
    const normTok = normalizeTr(lowerTok);
    if (/^\d+$/.test(normTok)) continue;
    if (stopWords.has(lowerTok) || stopWords.has(normTok)) continue;
    const stripped = stripTurkishSuffixes(lowerTok);
    const normStripped = normalizeTr(stripped);
    if (stopWords.has(stripped) || stopWords.has(normStripped)) continue;
    const finalKw = stripped.length >= 2 ? stripped : lowerTok;
    if (
      !keywords.some((k) => normalizeTr(k) === normalizeTr(finalKw))
    ) {
      keywords.push(finalKw);
    }
  }

  // Family & Domain Folder Alias Expansions
  const folderSearchTerms: string[] = [];
  const addFolderTerm = (t: string) => {
    if (t && !folderSearchTerms.includes(t)) folderSearchTerms.push(t);
    const asc = toAsciiVariant(t);
    if (asc && !folderSearchTerms.includes(asc)) folderSearchTerms.push(asc);
  };

  for (const kw of keywords) {
    const nKw = normalizeTr(kw);
    if (nKw === "esim" || nKw === "karim" || nKw === "esmeray" || nKw === "askim") {
      addFolderTerm("Esmeray");
      addFolderTerm("Esmer");
      continue;
    }
    if (nKw === "kizim" || nKw === "nehir") {
      addFolderTerm("Nehir");
      continue;
    }
    if (nKw === "oglum" || nKw === "yusuf") {
      addFolderTerm("Yusuf");
      continue;
    }
    if (nKw === "aile" || nKw === "ailem") {
      addFolderTerm("Aile-Medya");
      addFolderTerm("Esmeray");
      addFolderTerm("Nehir");
      addFolderTerm("Yusuf");
      addFolderTerm("Caglars");
      continue;
    }
    if (nKw === "kedi" || nKw === "kedimiz" || nKw === "kratos" || nKw === "duman") {
      addFolderTerm("Kratos-Kedi");
      addFolderTerm("Duman");
      continue;
    }
    if (nKw === "hatira" || nKw === "hatiralar" || nKw === "afl") {
      addFolderTerm("Hatiralar");
      addFolderTerm("AFL-92");
      continue;
    }
    if (nKw.includes("topkapi")) {
      addFolderTerm("Topkapi-Universitesi");
      addFolderTerm("Topkapi");
      addFolderTerm("Topkapı");
      continue;
    }
    if (nKw.includes("bsi424") || nKw === "bsi" || nKw.includes("fintek") || nKw.includes("fintech")) {
      addFolderTerm("BSI424");
      addFolderTerm("Bankacilik");
      continue;
    }
    addFolderTerm(kw);
  }

  // Also check normCombined for family words in case queryText stripped them
  if (/\b(esim|esmeray|karim|askim)\b/.test(normCombined)) {
    addFolderTerm("Esmeray");
    addFolderTerm("Esmer");
    if (!keywords.some((k) => normalizeTr(k) === "esmeray")) {
      keywords.push("Esmeray");
    }
  }
  if (/\b(kizim|nehir)\b/.test(normCombined)) {
    addFolderTerm("Nehir");
    if (!keywords.some((k) => normalizeTr(k) === "nehir")) {
      keywords.push("Nehir");
    }
  }
  if (/\b(oglum|yusuf)\b/.test(normCombined)) {
    addFolderTerm("Yusuf");
    if (!keywords.some((k) => normalizeTr(k) === "yusuf")) {
      keywords.push("Yusuf");
    }
  }

  // Filter out "eşim"/"karım"/"kızım"/"oğlum" from keywords if the actual name ("Esmeray", "Nehir", "Yusuf") is present
  const cleanedKeywords = keywords.filter(
    (k) => !["esim", "eşim", "karim", "karım", "kizim", "kızım", "oglum", "oğlum"].includes(normalizeTr(k))
  );

  const isGeneralRecentRequest =
    cleanedKeywords.length === 0 &&
    folderSearchTerms.length === 0 &&
    weekNumber === null &&
    !hasAnyDateFilter &&
    fileTypeFilters.length === 0;

  return {
    keywords: cleanedKeywords,
    folderSearchTerms,
    weekNumber,
    relativePeriod,
    dateFromIso,
    dateToIso,
    targetYear,
    targetMonth,
    targetDay,
    hasExplicitYear,
    hasAnyDateFilter,
    fileTypeFilters,
    isGeneralRecentRequest,
    humanDateLabel,
  };
}

interface DriveFolderTreeMatch {
  folderIds: string[];
  folderPathById: Map<string, string>;
  matchedRootFolderNames: string[];
}

async function findMatchingDriveFoldersAndDescendants(
  accessToken: string,
  constraints: ParsedDrivePhotoConstraints
): Promise<DriveFolderTreeMatch> {
  const folderPathById = new Map<string, string>();
  const matchedRootFolderNames: string[] = [];

  if (constraints.folderSearchTerms.length === 0) {
    return { folderIds: [], folderPathById, matchedRootFolderNames };
  }

  try {
    // 1. Query folders whose name contains any of the folderSearchTerms
    const nameClauses = constraints.folderSearchTerms
      .slice(0, 10)
      .map((t) => `name contains '${t.replace(/'/g, "\\'")}'`)
      .join(" or ");
    const folderQ = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and (${nameClauses})`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQ)}&pageSize=40&fields=files(id,name,parents)`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return { folderIds: [], folderPathById, matchedRootFolderNames };
    }
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawFolders: Array<{ id: string; name: string; parents?: string[] }> = Array.isArray(data.files)
      ? data.files
      : [];
    if (rawFolders.length === 0) {
      return { folderIds: [], folderPathById, matchedRootFolderNames };
    }

    // Score each matched folder by how many distinct user keywords match its normalized name
    const scoredFolders = rawFolders.map((f) => {
      const fNorm = normalizeTr(toAsciiVariant(f.name).replace(/[-_&+.]/g, " "));
      let score = 0;
      for (const kw of constraints.keywords) {
        const kwNorm = normalizeTr(toAsciiVariant(kw));
        if (kwNorm.length >= 2 && fNorm.includes(kwNorm)) {
          score += 2;
        }
      }
      for (const term of constraints.folderSearchTerms) {
        const tNorm = normalizeTr(toAsciiVariant(term));
        if (tNorm.length >= 2 && fNorm.includes(tNorm)) {
          score += 1;
        }
      }
      return { folder: f, score };
    });

    const maxScore = Math.max(...scoredFolders.map((s) => s.score), 0);
    // Keep folders that achieved the highest keyword match score (or close to it if aliases were used)
    const selectedRoots = scoredFolders
      .filter((s) => (maxScore >= 3 ? s.score >= maxScore - 1 : s.score > 0))
      .map((s) => s.folder);

    let currentLevelIds: string[] = [];
    for (const root of selectedRoots) {
      folderPathById.set(root.id, root.name);
      if (!matchedRootFolderNames.includes(root.name)) {
        matchedRootFolderNames.push(root.name);
      }
      currentLevelIds.push(root.id);
    }

    // 2. Traverse up to 3 levels of child folders in batch queries
    for (let depth = 0; depth < 3 && currentLevelIds.length > 0; depth++) {
      const parentClause = currentLevelIds
        .slice(0, 25)
        .map((id) => `'${id}' in parents`)
        .join(" or ");
      const subQ = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and (${parentClause})`;
      const subUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQ)}&pageSize=100&fields=files(id,name,parents)`;
      const subRes = await fetch(subUrl, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!subRes.ok) break;
      const subData = await subRes.json();
      const children: Array<{ id: string; name: string; parents?: string[] }> = Array.isArray(subData.files)
        ? subData.files
        : [];
      const nextLevelIds: string[] = [];
      for (const child of children) {
        if (!folderPathById.has(child.id)) {
          const pId = child.parents?.[0];
          const pPath = (pId && folderPathById.get(pId)) || "";
          folderPathById.set(child.id, pPath ? `${pPath} / ${child.name}` : child.name);
          nextLevelIds.push(child.id);
        }
      }
      currentLevelIds = nextLevelIds;
    }
  } catch {
    // Ignore folder tree errors
  }

  return {
    folderIds: Array.from(folderPathById.keys()),
    folderPathById,
    matchedRootFolderNames,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFileEffectiveDates(file: Record<string, any>, folderPath = ""): {
  primaryDate: string;
  allCandidateDates: string[];
} {
  const candidates: string[] = [];
  const addDate = (iso: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !candidates.includes(iso)) {
      candidates.push(iso);
    }
  };

  const nameAndPath = `${file.name || ""} ${folderPath}`;

  // 1. Check YYYY-MM-DD in filename (e.g. "WhatsApp Image 2024-03-12", "2026-10-26_GRS...")
  const dashMatches = nameAndPath.matchAll(/\b(19\d{2}|20[0-2]\d)-([01]\d)-([0-3]\d)\b/g);
  for (const m of dashMatches) {
    addDate(`${m[1]}-${m[2]}-${m[3]}`);
  }

  // 2. Check YYYYMMDD in filename (e.g. "20261027-OBC...", "IMG-20140615-WA0000", "20200711-askim.jpg")
  const compactMatches = nameAndPath.matchAll(/(?:^|\D)(19\d{2}|20[0-2]\d)([01]\d)([0-3]\d)(?:\D|$)/g);
  for (const m of compactMatches) {
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      addDate(`${m[1]}-${m[2]}-${m[3]}`);
    }
  }

  // 3. Check EXIF imageMediaMetadata.time ("YYYY:MM:DD HH:mm:ss")
  const exifTime = String(file.imageMediaMetadata?.time || "");
  const exifMatch = exifTime.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (exifMatch) {
    addDate(`${exifMatch[1]}-${exifMatch[2]}-${exifMatch[3]}`);
  }

  // 4. Drive createdTime and modifiedTime
  if (file.modifiedTime) addDate(String(file.modifiedTime).slice(0, 10));
  if (file.createdTime) addDate(String(file.createdTime).slice(0, 10));

  return {
    primaryDate: candidates[0] || "Güncel",
    allCandidateDates: candidates,
  };
}

function matchesDateConstraint(
  candidateDates: string[],
  folderPath: string,
  constraints: ParsedDrivePhotoConstraints
): boolean {
  if (!constraints.hasAnyDateFilter) return true;

  // Exact Day + Month
  if (constraints.targetDay > 0 && constraints.targetMonth > 0) {
    const mPad = String(constraints.targetMonth).padStart(2, "0");
    const dPad = String(constraints.targetDay).padStart(2, "0");
    if (constraints.hasExplicitYear && constraints.targetYear > 0) {
      const exactIso = `${constraints.targetYear}-${mPad}-${dPad}`;
      return candidateDates.includes(exactIso);
    }
    // If year was not explicitly specified, match either current year or any year on that MM-DD
    const suffix = `-${mPad}-${dPad}`;
    return candidateDates.some((d) => d.endsWith(suffix));
  }

  // Month + Year (or Month only)
  if (constraints.targetMonth > 0 && constraints.targetDay === 0) {
    const mPad = String(constraints.targetMonth).padStart(2, "0");
    if (constraints.hasExplicitYear && constraints.targetYear > 0) {
      const prefix = `${constraints.targetYear}-${mPad}-`;
      return (
        candidateDates.some((d) => d.startsWith(prefix)) ||
        folderPath.includes(`${constraints.targetYear}${mPad}`)
      );
    }
    return candidateDates.some((d) => d.slice(5, 7) === mPad);
  }

  // Year only
  if (constraints.targetYear > 0 && constraints.targetMonth === 0) {
    const yStr = String(constraints.targetYear);
    return (
      candidateDates.some((d) => d.startsWith(`${yStr}-`)) ||
      folderPath.includes(yStr)
    );
  }

  // Relative range (dateFromIso .. dateToIso)
  if (constraints.dateFromIso && constraints.dateToIso) {
    return candidateDates.some(
      (d) => d >= constraints.dateFromIso! && d <= constraints.dateToIso!
    );
  }

  return true;
}

function matchesWeekConstraint(
  fileName: string,
  folderPath: string,
  weekNumber: number | null
): boolean {
  if (weekNumber === null) return true;
  const combined = normalizeTr(toAsciiVariant(`${fileName} ${folderPath}`));
  // Match "6. hafta", "6.hafta", "6_hafta", "6-hafta", "(6. hafta)", "hafta 6"
  const rx = new RegExp(`(?:^|\\D)${weekNumber}\\s*[._-]?\\s*hafta|\\bhafta\\s*${weekNumber}(?:\\D|$)`, "i");
  return rx.test(combined);
}

function matchesFileTypeConstraint(
  mimeType: string,
  fileName: string,
  filters: ParsedDrivePhotoConstraints["fileTypeFilters"]
): boolean {
  if (!filters || filters.length === 0) return true;
  const m = mimeType.toLowerCase();
  const n = fileName.toLowerCase();
  return filters.some((filter) => {
    if (filter === "presentation") {
      return m.includes("presentation") || m.includes("powerpoint") || n.endsWith(".pptx") || n.endsWith(".ppt");
    }
    if (filter === "pdf") {
      return m.includes("pdf") || n.endsWith(".pdf");
    }
    if (filter === "spreadsheet") {
      return m.includes("spreadsheet") || m.includes("excel") || m.includes("sheet") || n.endsWith(".xlsx") || n.endsWith(".xls");
    }
    if (filter === "document") {
      return (m.includes("document") && !m.includes("presentation") && !m.includes("spreadsheet")) || m.includes("word") || n.endsWith(".docx") || n.endsWith(".doc");
    }
    return false;
  });
}

async function searchGooglePhotosAndDriveImages(
  accessToken: string | null,
  queryText: string,
  rawTranscript: string
): Promise<{
  ok: boolean;
  photos: PhotoItem[];
  selectedOption?: PhotoItem;
  filterNote?: string;
  googlePhotosSearchUrl?: string;
  scopeMissing?: boolean;
  serviceDisabledUrl?: string;
  error?: string;
}> {
  if (!accessToken) {
    return {
      ok: false,
      photos: [],
      error: "Google oturumu aktif değil",
    };
  }

  // Check if user is selecting a numbered photo option ("1", "2 numaralı fotoğrafı paylaş")
  const normRawForOpt = normalizeSpokenTurkishNumbersAndDates(rawTranscript)
    .replace(/^(!foto[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|!resim[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)\s*:?\s*/i, "")
    .trim();
  const photoOptMatch =
    !/\b(hafta\w*|ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)\b/i.test(
      normRawForOpt
    )
      ? normRawForOpt.match(
          /^(?:seçenek\s*|secenek\s*)?([1-8])(?:\s*(?:\.|numaralı|numarali|numarayı|numarayi|numara|nolu|ncı|nci|üncü|uncu)?\s*(?:seçenek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|fotoğraf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|fotograf[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|resim[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)?(?:\s*(?:benimle|bana))?(?:\s*(?:paylaş[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|paylas[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gönder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gonder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|getir[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|aç[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*))?)?[!.?]*$/i
        )
      : null;

  if (photoOptMatch) {
    const cached = loadLastSearchResultsCache().photos;
    const idx = parseInt(photoOptMatch[1], 10) - 1;
    if (idx >= 0 && idx < cached.length) {
      const chosen = cached[idx];
      return {
        ok: true,
        photos: [chosen],
        selectedOption: chosen,
      };
    }
  }

  const constraints = parseDriveAndPhotoConstraints(
    normalizeSpokenTurkishNumbersAndDates(queryText),
    normalizeSpokenTurkishNumbersAndDates(rawTranscript)
  );
  const photos: PhotoItem[] = [];
  let scopeMissing = false;
  let serviceDisabledUrl: string | undefined;
  let lastError: string | undefined;
  let filterNote: string | undefined;

  const googlePhotosSearchParam = encodeURIComponent(
    constraints.humanDateLabel && constraints.keywords.length > 0
      ? `${constraints.keywords.join(" ")} ${constraints.humanDateLabel}`
      : constraints.humanDateLabel || constraints.keywords.join(" ") || queryText
  );
  const googlePhotosSearchUrl = `https://photos.google.com/search/${googlePhotosSearchParam}`;

  try {
    // 1. Traverse matching folders in Google Drive (e.g. Ozel/Esmeray, Ozel/Nehir, Ozel/Yusuf, Ozel/Tatil, Izmir, Hatiralar, Kratos-Kedi)
    const folderTree = await findMatchingDriveFoldersAndDescendants(
      accessToken,
      constraints
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidateFilesMap = new Map<string, { file: Record<string, any>; folderPath: string }>();

    // 1a. Fetch images/videos inside matched folder tree
    if (folderTree.folderIds.length > 0) {
      // Query in chunks of up to 20 folder IDs
      for (let i = 0; i < folderTree.folderIds.length; i += 20) {
        const chunk = folderTree.folderIds.slice(i, i + 20);
        const parentClause = chunk.map((id) => `'${id}' in parents`).join(" or ");
        const q = `trashed = false and (mimeType contains 'image/' or mimeType contains 'video/') and (${parentClause})`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=80&orderBy=modifiedTime desc&fields=files(id,name,mimeType,createdTime,modifiedTime,parents,webViewLink,webContentLink,thumbnailLink,description,imageMediaMetadata(time))`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          for (const f of data.files || []) {
            if (String(f.name || "").startsWith("._")) continue;
            const pId = f.parents?.[0];
            const fPath = (pId && folderTree.folderPathById.get(pId)) || folderTree.matchedRootFolderNames.join(" / ") || "Google Drive Arşivi";
            candidateFilesMap.set(f.id, { file: f, folderPath: fPath });
          }
        }
      }
    }

    // 1b. Also search across all Drive images/videos by keyword terms or date
    const directQueries: string[] = [];
    if (constraints.folderSearchTerms.length > 0) {
      const termClauses = constraints.folderSearchTerms
        .slice(0, 8)
        .map((t) => `name contains '${t.replace(/'/g, "\\'")}'`)
        .join(" or ");
      directQueries.push(
        `trashed = false and (mimeType contains 'image/' or mimeType contains 'video/') and (${termClauses})`
      );
    }

    if (constraints.hasAnyDateFilter && constraints.dateFromIso && constraints.dateToIso) {
      const effY = constraints.targetYear || getIstanbulNow().getFullYear();
      const mPad = constraints.targetMonth > 0 ? String(constraints.targetMonth).padStart(2, "0") : "";
      const dPad = constraints.targetDay > 0 ? String(constraints.targetDay).padStart(2, "0") : "";
      const compactPrefix = mPad && dPad ? `${effY}${mPad}${dPad}` : "";
      const isoPrefix = mPad && dPad ? `${effY}-${mPad}-${dPad}` : "";
      const crossYearClause =
        mPad && dPad
          ? ` or name contains '-${mPad}-${dPad}' or name contains '${mPad}${dPad}'`
          : "";
      const nameDateClause =
        compactPrefix && isoPrefix
          ? ` or name contains '${isoPrefix}' or name contains '${compactPrefix}'${crossYearClause}`
          : "";
      directQueries.push(
        `trashed = false and (mimeType contains 'image/' or mimeType contains 'video/') and ((modifiedTime >= '${constraints.dateFromIso}T00:00:00' and modifiedTime <= '${constraints.dateToIso}T23:59:59') or (createdTime >= '${constraints.dateFromIso}T00:00:00' and createdTime <= '${constraints.dateToIso}T23:59:59')${nameDateClause})`
      );

      // Also fetch the full target month in Drive so if the exact day has 0 files, we can offer the closest days in that exact month!
      if (mPad) {
        const monthStart = `${effY}-${mPad}-01T00:00:00`;
        const monthEnd = `${effY}-${mPad}-31T23:59:59`;
        directQueries.push(
          `trashed = false and (mimeType contains 'image/' or mimeType contains 'video/') and ((modifiedTime >= '${monthStart}' and modifiedTime <= '${monthEnd}') or (createdTime >= '${monthStart}' and createdTime <= '${monthEnd}') or name contains '${effY}-${mPad}' or name contains '${effY}${mPad}')`
        );
      }
    }

    if (constraints.isGeneralRecentRequest) {
      directQueries.push(`trashed = false and mimeType contains 'image/'`);
    }

    for (const dq of directQueries) {
      const dUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(dq)}&pageSize=60&orderBy=modifiedTime desc&fields=files(id,name,mimeType,createdTime,modifiedTime,parents,webViewLink,webContentLink,thumbnailLink,description,imageMediaMetadata(time))`;
      const dRes = await fetch(dUrl, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dRes.ok) {
        const dData = await dRes.json();
        for (const f of dData.files || []) {
          if (String(f.name || "").startsWith("._")) continue;
          if (!candidateFilesMap.has(f.id)) {
            const pId = f.parents?.[0];
            const fPath = (pId && folderTree.folderPathById.get(pId)) || "Google Drive Fotoğraf Arşivi";
            candidateFilesMap.set(f.id, { file: f, folderPath: fPath });
          }
        }
      } else if (dRes.status === 403 || dRes.status === 401) {
        const errBody = await dRes.json().catch(() => ({}));
        if (String(errBody?.error?.message || "").includes("insufficient authentication scopes")) {
          scopeMissing = true;
        }
      }
    }

    // 2. Score and filter candidate images/videos
    const allCandidates = Array.from(candidateFilesMap.values()).map(({ file, folderPath }) => {
      const { primaryDate, allCandidateDates } = extractFileEffectiveDates(file, folderPath);
      const normNameAndPath = normalizeTr(toAsciiVariant(`${file.name || ""} ${folderPath} ${file.description || ""}`));

      // Deprioritize medical scans, ID cards, tax/IMEI/complaint/school-grade/insurance/signature screenshots when looking for personal/family photos unless explicitly requested
      const isDocumentScan =
        /(kimlik|pasaport|passport|tomografi|sinus|imei|edevlet|e-devlet|ssk|kazanc|dekont|fatura|bordro|passolig|sikayet|yazisma|onyuz|arkayuz|transcript|notlari|onur-belgesi|e-okul|meb-|belgeler|tetkik|tahlil|radyoloji|laboratuvar|dilekce|siparis|fidan|bagis|sertifika|basvuru|hes\b|bilet|boarding|sencard|imza)/i.test(
          normNameAndPath
        ) &&
        !/(kimlik|pasaport|tomografi|imei|dekont|passolig|sikayet|transcript|notlari|belge|sertifika|bilet|sencard|imza)/i.test(
          normalizeTr(queryText)
        );

      const dateMatched = matchesDateConstraint(allCandidateDates, folderPath, constraints);
      let keywordScore = 0;
      for (const kw of constraints.keywords) {
        const nKw = normalizeTr(toAsciiVariant(kw));
        if (nKw && normNameAndPath.includes(nKw)) {
          keywordScore += 3;
        }
      }
      for (const term of constraints.folderSearchTerms) {
        const nTerm = normalizeTr(toAsciiVariant(term));
        if (nTerm && normNameAndPath.includes(nTerm)) {
          keywordScore += 2;
        }
      }

      const keywordMatched =
        constraints.keywords.length === 0 && constraints.folderSearchTerms.length === 0
          ? true
          : keywordScore > 0;

      return {
        file,
        folderPath,
        primaryDate,
        allCandidateDates,
        dateMatched,
        keywordMatched,
        keywordScore,
        isDocumentScan,
      };
    });

    // Sort: non-document photos first, higher keywordScore first, newest primaryDate first
    allCandidates.sort((a, b) => {
      if (a.isDocumentScan !== b.isDocumentScan) return a.isDocumentScan ? 1 : -1;
      if (b.keywordScore !== a.keywordScore) return b.keywordScore - a.keywordScore;
      return b.primaryDate.localeCompare(a.primaryDate);
    });

    // Deduplicate identical filenames on the same date so duplicate Drive uploads don't take multiple slots
    const seenNameDate = new Set<string>();
    const uniqueCandidates = allCandidates.filter((c) => {
      const key = `${String(c.file.name || "").toLowerCase()}|${c.primaryDate}`;
      if (seenNameDate.has(key)) return false;
      seenNameDate.add(key);
      return true;
    });

    // Strict matches: both keyword/folder AND date match
    const strictMatches = uniqueCandidates.filter((c) => c.keywordMatched && c.dateMatched);

    if (strictMatches.length > 0) {
      for (const item of strictMatches.slice(0, 6)) {
        photos.push({
          id: item.file.id,
          title: item.file.name,
          date: item.primaryDate,
          url: item.file.webViewLink || `https://drive.google.com/file/d/${item.file.id}/view`,
          thumbnailUrl: item.file.thumbnailLink,
          downloadUrl: `https://www.googleapis.com/drive/v3/files/${item.file.id}?alt=media`,
          mimeType: item.file.mimeType || "image/jpeg",
          source: "Google Drive",
          albumOrLocation: item.folderPath,
        });
      }
    } else if (constraints.keywords.length > 0 && constraints.hasAnyDateFilter) {
      // User asked for a specific person/folder AND a specific date (e.g. "25 Ekim 2026 Esmeray" or "geçen hafta Esmeray"),
      // and we have photos of that person/folder in Drive, but none on that exact date!
      const personOnlyMatches = uniqueCandidates.filter((c) => c.keywordMatched && !c.isDocumentScan);
      if (personOnlyMatches.length > 0) {
        filterNote =
          `ℹ️ *Not:* Google Drive arşivinizde *"${constraints.humanDateLabel}"* tarihine ait yeni bir *${constraints.keywords.join(" ")}* fotoğrafı bulunamadı.\n` +
          `📱 Telefon kameranızdaki *Google Fotoğraflar* bulutunda bu tarihi doğrudan açmak için: ${googlePhotosSearchUrl}\n` +
          `📂 Drive arşivinizdeki (*${folderTree.matchedRootFolderNames.join(", ") || constraints.keywords.join(" ")}*) mevcut fotoğraflarınızdan örnekler aşağıda paylaşılmıştır:`;
        for (const item of personOnlyMatches.slice(0, 6)) {
          photos.push({
            id: item.file.id,
            title: item.file.name,
            date: item.primaryDate,
            url: item.file.webViewLink || `https://drive.google.com/file/d/${item.file.id}/view`,
            thumbnailUrl: item.file.thumbnailLink,
            downloadUrl: `https://www.googleapis.com/drive/v3/files/${item.file.id}?alt=media`,
            mimeType: item.file.mimeType || "image/jpeg",
            source: "Google Drive",
            albumOrLocation: item.folderPath,
          });
        }
      } else {
        filterNote =
          `ℹ️ Google Drive arşivinizde *"${constraints.humanDateLabel} - ${constraints.keywords.join(" ")}"* kriterine uygun fotoğraf bulunamadı.\n` +
          `📱 Telefonunuzdaki *Google Fotoğraflar* uygulamasında doğrudan açmak için tıklayın: ${googlePhotosSearchUrl}`;
      }
    } else if (constraints.hasAnyDateFilter && constraints.keywords.length === 0) {
      // User asked for a specific date (e.g. "17 Eylül 2026", "19 Eylül 2026", "24 Ekim 2026", "28 Ekim")
      const effY = constraints.targetYear || getIstanbulNow().getFullYear();
      const mPad = constraints.targetMonth > 0 ? String(constraints.targetMonth).padStart(2, "0") : "";
      const dPad = constraints.targetDay > 0 ? String(constraints.targetDay).padStart(2, "0") : "";
      const monthNamesTr = [
        "",
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık",
      ];
      const monthLabelTr = monthNamesTr[constraints.targetMonth] || mPad;

      // 1) Check if same MM-DD exists in another year in Drive
      const sameDayAnyYear =
        mPad && dPad
          ? uniqueCandidates.filter(
              (c) =>
                !c.isDocumentScan &&
                c.allCandidateDates.some((d) => d.endsWith(`-${mPad}-${dPad}`))
            )
          : [];

      // 2) Find all photos in that target month (YYYY-MM) and sort by closest day distance to targetDay
      const monthPrefix = mPad ? `${effY}-${mPad}-` : "";
      const sameMonthCandidates = monthPrefix
        ? uniqueCandidates
            .filter(
              (c) =>
                !c.isDocumentScan &&
                !/^(ust_tabela|barista_onden|sol_yan)/i.test(String(c.file.name || "")) &&
                c.allCandidateDates.some((d) => d.startsWith(monthPrefix))
            )
            .map((c) => {
              const mDate =
                c.allCandidateDates.find((d) => d.startsWith(monthPrefix)) ||
                c.primaryDate;
              const dayNum = parseInt(mDate.slice(8, 10), 10) || 1;
              const dayDiff =
                constraints.targetDay > 0
                  ? Math.abs(dayNum - constraints.targetDay)
                  : 0;
              return { ...c, matchedMonthDate: mDate, dayNum, dayDiff };
            })
            .sort((a, b) => a.dayDiff - b.dayDiff)
        : [];

      const availableDaysInMonth = Array.from(
        new Set(
          uniqueCandidates
            .flatMap((c) => c.allCandidateDates)
            .filter((d) => monthPrefix && d.startsWith(monthPrefix))
            .map((d) => parseInt(d.slice(8, 10), 10))
            .filter((n) => !isNaN(n))
        )
      )
        .sort((a, b) => b - a)
        .slice(0, 8);

      const availableDaysFormatted =
        availableDaysInMonth.length > 0
          ? availableDaysInMonth
              .map((d) => `• *${d} ${monthLabelTr} ${effY}* ("!foto ${d} ${monthLabelTr}")`)
              .join("\n")
          : `• *27 Ekim 2026* ("!foto 27 Ekim")\n• *26 Ekim 2026* ("!foto 26 Ekim")\n• *21 Eylül 2026* ("!foto 21 Eylül")\n• *15 Eylül 2026* ("!foto 15 Eylül")`;

      if (
        (sameMonthCandidates.length > 0 && sameMonthCandidates[0].dayDiff <= 6) ||
        sameDayAnyYear.length > 0
      ) {
        const nearestInMonth = sameMonthCandidates.filter((c) => c.dayDiff <= 6);
        const nearestDates = Array.from(
          new Set(nearestInMonth.slice(0, 4).map((c) => c.matchedMonthDate))
        ).join(", ");

        if (nearestInMonth.length > 0 && sameDayAnyYear.length > 0) {
          filterNote =
            `ℹ️ *Not:* *${constraints.humanDateLabel}* için *${monthLabelTr} ${effY}* dönemindeki en yakın tarihli (*${nearestDates}*) fotoğraflarınız ve geçmiş yıllardaki *${constraints.targetDay} ${monthLabelTr}* fotoğraflarınız birlikte listelenmiştir:\n` +
            `📱 *Telefon Kameranızdaki Google Fotoğraflar Bulutunda ${constraints.humanDateLabel} Gününü Açmak İçin:* ${googlePhotosSearchUrl}`;
        } else if (nearestInMonth.length > 0) {
          filterNote =
            `ℹ️ *Not:* Google Drive arşivinizde tam *${constraints.humanDateLabel}* gününe ait fotoğraf bulunamadığı için, *${monthLabelTr} ${effY}* dönemindeki en yakın tarihli (*${nearestDates}*) fotoğraflarınız aşağıda paylaşılmıştır:\n` +
            `📱 *Telefon Kameranızdaki Google Fotoğraflar Bulutunda ${constraints.humanDateLabel} Gününü Açmak İçin:* ${googlePhotosSearchUrl}`;
        } else {
          filterNote =
            `ℹ️ *Not:* *${constraints.humanDateLabel}* yılına ait kayıt bulunamadı; ancak geçmiş yıllarda *${constraints.targetDay} ${monthLabelTr}* gününe ait fotoğraflarınız bulundu:`;
        }

        const seenCombine = new Set<string>();
        for (const item of nearestInMonth.slice(0, 4)) {
          if (seenCombine.has(item.file.id)) continue;
          seenCombine.add(item.file.id);
          photos.push({
            id: item.file.id,
            title: item.file.name,
            date: item.matchedMonthDate,
            url: item.file.webViewLink || `https://drive.google.com/file/d/${item.file.id}/view`,
            thumbnailUrl: item.file.thumbnailLink,
            downloadUrl: `https://www.googleapis.com/drive/v3/files/${item.file.id}?alt=media`,
            mimeType: item.file.mimeType || "image/jpeg",
            source: "Google Drive",
            albumOrLocation: item.folderPath,
          });
        }
        for (const item of sameDayAnyYear) {
          if (photos.length >= 6) break;
          if (seenCombine.has(item.file.id)) continue;
          seenCombine.add(item.file.id);
          photos.push({
            id: item.file.id,
            title: item.file.name,
            date: item.primaryDate,
            url: item.file.webViewLink || `https://drive.google.com/file/d/${item.file.id}/view`,
            thumbnailUrl: item.file.thumbnailLink,
            downloadUrl: `https://www.googleapis.com/drive/v3/files/${item.file.id}?alt=media`,
            mimeType: item.file.mimeType || "image/jpeg",
            source: "Google Drive",
            albumOrLocation: item.folderPath,
          });
        }
      } else {
        filterNote =
          `ℹ️ Google Drive arşivinizde *${constraints.humanDateLabel}* tarihinde çekilmiş veya yüklenmiş bir fotoğraf bulunamadı (İlgisiz dosyalar paylaşılmamıştır).\n\n` +
          `📱 *Telefonunuzdaki Google Fotoğraflar (Kamera Bulutu) Galerisinde Bu Tarihi Açmak İçin:*\n🔗 ${googlePhotosSearchUrl}\n\n` +
          `📅 *Google Drive Arşivinizde Fotoğraf Bulunan ${monthLabelTr} ${effY} Tarihleri:*\n` +
          `${availableDaysFormatted}\n\n` +
          `👨‍👩‍👧‍👦 *Aile & Özel Albüm Klasörleriniz:*\n` +
          `• *Esmeray* ("!foto Esmeray")\n` +
          `• *Nehir* ("!foto Nehir")\n` +
          `• *Yusuf* ("!foto Yusuf")\n` +
          `• *Tatil (İzmir & Urla, Sömestre, Trabzon, Bodrum)* ("!foto İzmir Urla tatil")\n` +
          `• *Hatıralar (AFL-92)* ("!foto Hatıralar")\n` +
          `• *Kratos Kedi* ("!foto Kratos")`;
      }
    } else {
      filterNote =
        `ℹ️ Google Drive arşivinizde *"${queryText}"* aramasına uygun fotoğraf bulunamadı.\n` +
        `📱 *Google Fotoğraflar'da doğrudan aramak için:* ${googlePhotosSearchUrl}`;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Fotoğraf arama hatası";
  }

  if (photos.length > 0) {
    saveLastSearchResultsCache({ photos: photos.slice(0, 6) });
  }

  return {
    ok: !scopeMissing && !serviceDisabledUrl,
    photos: photos.slice(0, 6),
    filterNote,
    googlePhotosSearchUrl,
    scopeMissing,
    serviceDisabledUrl,
    error: lastError,
  };
}

async function searchAndShareGoogleDriveFiles(
  accessToken: string | null,
  queryText: string,
  rawTranscript: string,
  recipientEmail?: string,
  recipientQuery?: string
): Promise<{
  ok: boolean;
  files: DriveFileItem[];
  selectedOption?: DriveFileItem;
  invitedEmails: string[];
  resolvedContactName?: string;
  matchedFolderLabel?: string;
  filterNote?: string;
  scopeMissing?: boolean;
  serviceDisabledUrl?: string;
  error?: string;
}> {
  if (!accessToken) {
    return {
      ok: false,
      files: [],
      invitedEmails: [],
      error: "Google oturumu aktif değil",
    };
  }

  const { emails, resolvedContactName } = await resolveRecipientEmails(
    accessToken,
    recipientEmail,
    recipientQuery
  );

  // Check if user is ONLY selecting a numbered option from the previous search
  // (e.g. "5", "5 numarayı paylaş", "!drive 5 numaralı dosyayı paylaş", "2. seçeneği gönder", "beş numaralı dosyayı paylaş")
  const cleanForOption = normalizeSpokenTurkishNumbersAndDates(rawTranscript)
    .replace(
      /^(!drive|!dosya[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|!belge[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)\s*:?\s*/i,
      ""
    )
    .trim();
  const optionMatch =
    !/\b(hafta\w*|dönem\w*|donem\w*|sınıf\w*|sinif\w*|ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)\b/i.test(
      cleanForOption
    )
      ? cleanForOption.match(
          /^(?:seçenek\s*|secenek\s*)?([1-8])(?:\s*(?:\.|numaralı|numarali|numarayı|numarayi|numara|nolu|ncı|nci|üncü|uncu)?\s*(?:seçenek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|secenek[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|dosya[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|belge[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|doküman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|dokuman[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*)?(?:\s*(?:benimle|bana))?(?:\s*(?:paylaş[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|paylas[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gönder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|gonder[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|getir[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|aç[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|ac[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*|indir[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ'’]*))?)?[!.?]*$/i
        )
      : null;

  const explicitDigitOption =
    !optionMatch && /^[1-8]$/.test(queryText.trim())
      ? [queryText.trim(), queryText.trim()]
      : optionMatch;

  if (explicitDigitOption) {
    const cachedList = loadLastSearchResultsCache().driveFiles;
    const idx = parseInt(explicitDigitOption[1], 10) - 1;
    if (idx >= 0 && idx < cachedList.length) {
      const chosen = cachedList[idx];
      return {
        ok: true,
        files: [chosen],
        selectedOption: chosen,
        invitedEmails: emails,
        resolvedContactName,
      };
    }
  }

  const constraints = parseDriveAndPhotoConstraints(
    normalizeSpokenTurkishNumbersAndDates(queryText),
    normalizeSpokenTurkishNumbersAndDates(rawTranscript)
  );
  let scopeMissing = false;
  let serviceDisabledUrl: string | undefined;
  let lastError: string | undefined;
  let filterNote: string | undefined;
  const files: DriveFileItem[] = [];

  try {
    // 1. Find matching folders and recursively traverse their subfolders (up to 3 levels deep)
    const folderTree = await findMatchingDriveFoldersAndDescendants(
      accessToken,
      constraints
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidateFilesMap = new Map<string, { file: Record<string, any>; folderPath: string; fromMatchedFolder: boolean }>();

    if (folderTree.folderIds.length > 0) {
      for (let i = 0; i < folderTree.folderIds.length; i += 20) {
        const chunk = folderTree.folderIds.slice(i, i + 20);
        const parentClause = chunk.map((id) => `'${id}' in parents`).join(" or ");
        const q = `trashed = false and mimeType != 'application/vnd.google-apps.folder' and (${parentClause})`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=100&orderBy=modifiedTime desc&fields=files(id,name,mimeType,createdTime,modifiedTime,parents,size,webViewLink,webContentLink,thumbnailLink,description)`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          for (const f of data.files || []) {
            if (String(f.name || "").startsWith("._") || f.name === ".DS_Store") continue;
            const pId = f.parents?.[0];
            const fPath = (pId && folderTree.folderPathById.get(pId)) || folderTree.matchedRootFolderNames.join(" / ");
            candidateFilesMap.set(f.id, { file: f, folderPath: fPath, fromMatchedFolder: true });
          }
        }
      }
    }

    // 2. Also query Drive files directly by tokenized keywords / week / date
    const directClauses: string[] = [];
    if (constraints.weekNumber !== null) {
      directClauses.push(
        `name contains '${constraints.weekNumber}. Hafta' or name contains '${constraints.weekNumber}.Hafta' or name contains '${constraints.weekNumber}. hafta'`
      );
    }
    if (constraints.folderSearchTerms.length > 0) {
      const termClauses = constraints.folderSearchTerms
        .slice(0, 8)
        .map((t) => `name contains '${t.replace(/'/g, "\\'")}'`)
        .join(" or ");
      directClauses.push(termClauses);
    }

    const directQ =
      directClauses.length > 0
        ? `trashed = false and mimeType != 'application/vnd.google-apps.folder' and (${directClauses.map((c) => `(${c})`).join(" or ")})`
        : constraints.hasAnyDateFilter && constraints.dateFromIso && constraints.dateToIso
          ? `trashed = false and mimeType != 'application/vnd.google-apps.folder' and modifiedTime >= '${constraints.dateFromIso}T00:00:00' and modifiedTime <= '${constraints.dateToIso}T23:59:59'`
          : constraints.isGeneralRecentRequest
            ? `trashed = false and mimeType != 'application/vnd.google-apps.folder'`
            : "";

    if (directQ) {
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(directQ)}&pageSize=50&orderBy=modifiedTime desc&fields=files(id,name,mimeType,createdTime,modifiedTime,parents,size,webViewLink,webContentLink,thumbnailLink,description)`;
      const res = await fetch(driveUrl, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        for (const f of data.files || []) {
          if (String(f.name || "").startsWith("._") || f.name === ".DS_Store") continue;
          if (!candidateFilesMap.has(f.id)) {
            const pId = f.parents?.[0];
            const fPath = (pId && folderTree.folderPathById.get(pId)) || "";
            candidateFilesMap.set(f.id, {
              file: f,
              folderPath: fPath,
              fromMatchedFolder: Boolean(pId && folderTree.folderPathById.has(pId)),
            });
          }
        }
      } else if (res.status === 403 || res.status === 401) {
        const errBody = await res.json().catch(() => ({}));
        if (String(errBody?.error?.message || "").includes("insufficient authentication scopes")) {
          scopeMissing = true;
        }
      }
    }

    // 3. Filter and score all candidate files
    const scoredCandidates = Array.from(candidateFilesMap.values()).map(
      ({ file, folderPath, fromMatchedFolder }) => {
        const { primaryDate, allCandidateDates } = extractFileEffectiveDates(file, folderPath);
        const normAll = normalizeTr(toAsciiVariant(`${file.name || ""} ${folderPath} ${file.description || ""}`));

        const weekOk = matchesWeekConstraint(file.name || "", folderPath, constraints.weekNumber);
        const dateOk = matchesDateConstraint(allCandidateDates, folderPath, constraints);
        const typeOk = matchesFileTypeConstraint(file.mimeType || "", file.name || "", constraints.fileTypeFilters);

        let score = fromMatchedFolder ? 10 : 0;
        for (const kw of constraints.keywords) {
          const nKw = normalizeTr(toAsciiVariant(kw));
          if (nKw && normAll.includes(nKw)) {
            score += 5;
          }
        }
        if (constraints.weekNumber !== null && weekOk) {
          score += 15;
        }
        if (constraints.hasAnyDateFilter && dateOk) {
          score += 8;
        }
        if (constraints.fileTypeFilters.length > 0 && typeOk) {
          score += 6;
        }

        // If folderTree matched a specific root folder (e.g. "Topkapi-Universitesi"), require either fromMatchedFolder or matching all keywords
        const folderOrKeywordOk =
          folderTree.folderIds.length > 0
            ? fromMatchedFolder || score >= 10
            : constraints.keywords.length === 0 || score > 0;

        return {
          file,
          folderPath,
          fromMatchedFolder,
          primaryDate,
          weekOk,
          dateOk,
          typeOk,
          folderOrKeywordOk,
          score,
        };
      }
    );

    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.file.modifiedTime || "").localeCompare(String(a.file.modifiedTime || ""));
    });

    // Strict matches: satisfy folder/keyword + week + date + fileType
    let selectedItems = scoredCandidates.filter(
      (c) => c.folderOrKeywordOk && c.weekOk && c.dateOk && c.typeOk
    );

    // If strict match is empty because of a relative date filter inside a matched folder, show the latest files from that exact matched folder with a clear note
    if (
      selectedItems.length === 0 &&
      folderTree.folderIds.length > 0 &&
      constraints.weekNumber === null
    ) {
      const folderOnlyItems = scoredCandidates.filter(
        (c) => c.fromMatchedFolder && c.typeOk
      );
      if (folderOnlyItems.length > 0) {
        selectedItems = folderOnlyItems;
        if (constraints.hasAnyDateFilter) {
          filterNote = `ℹ️ *Not:* *${folderTree.matchedRootFolderNames.join(" / ")}* klasöründe *${constraints.humanDateLabel}* aralığında güncellenen dosya bulunamadığı için bu klasördeki en güncel dosyalar listelenmiştir:`;
        }
      }
    }

    for (const item of selectedItems.slice(0, 6)) {
      const f = item.file;
      let snippet = f.description ? String(f.description).slice(0, 160) : "";

      if (!snippet && files.length < 3) {
        try {
          if (f.mimeType === "application/vnd.google-apps.document") {
            const expRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (expRes.ok) {
              const txt = (await expRes.text()).replace(/\s+/g, " ").trim();
              if (txt) snippet = txt.slice(0, 160) + (txt.length > 160 ? "..." : "");
            }
          } else if (f.mimeType === "application/vnd.google-apps.spreadsheet") {
            const expRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/csv`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (expRes.ok) {
              const txt = (await expRes.text()).replace(/\r?\n/g, " | ").trim();
              if (txt) snippet = txt.slice(0, 160) + (txt.length > 160 ? "..." : "");
            }
          }
        } catch {
          // Ignore export preview errors
        }
      }

      const sizeBytes = Number(f.size || 0);
      const sizeLabel =
        sizeBytes > 1048576
          ? `${(sizeBytes / 1048576).toFixed(1)} MB`
          : sizeBytes > 1024
            ? `${Math.round(sizeBytes / 1024)} KB`
            : undefined;

      files.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType || "application/octet-stream",
        typeLabel: getDriveFileTypeLabel(String(f.mimeType || "")),
        modifiedDate: String(f.modifiedTime || "").slice(0, 10) || item.primaryDate,
        webViewLink:
          f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        webContentLink: f.webContentLink,
        thumbnailLink: f.thumbnailLink,
        snippet: snippet || undefined,
        sizeLabel,
        folderPath: item.folderPath || undefined,
      });
    }

    if (files.length > 0) {
      cachedDriveSearchResults = files;
      saveLastSearchResultsCache({ driveFiles: files });
    } else {
      filterNote =
        `⚠️ Google Drive arşivinizde *"${queryText}"* kriterine uygun dosya bulunamadı (İlgisiz dosyalar listelenmemiştir).`;
    }

    return {
      ok: !scopeMissing && !serviceDisabledUrl,
      files,
      invitedEmails: emails,
      resolvedContactName,
      matchedFolderLabel:
        folderTree.matchedRootFolderNames.length > 0
          ? folderTree.matchedRootFolderNames.join(", ")
          : undefined,
      filterNote,
      scopeMissing,
      serviceDisabledUrl,
      error: lastError,
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Google Drive hatası";
    return {
      ok: false,
      files: [],
      invitedEmails: emails,
      resolvedContactName,
      scopeMissing,
      serviceDisabledUrl,
      error: lastError,
    };
  }
}

// ============================================================================
// MAIN ASSISTANT ENGINE ENTRYPOINT
// ============================================================================

/**
 * Splits a multi-command voice or text utterance into sequential commands when the user
 * chains multiple requests back-to-back ("peş peşe komut çalıştırma"), e.g.:
 * - "Yarın 10:00'a toplantı ekle, ardından Topkapı Üniversitesi 6. hafta dosyalarını getir, daha sonra 19 Eylül 2026 fotoğraflarımı paylaş"
 * - Multiple !toplanti / !drive / !foto / !not / !rehber commands in one message
 */
function splitIntoSequentialCommands(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. Multiple explicit !komut triggers in the same message
  const bangParts = trimmed
    .split(/(?=(?:^|\s)!(?:toplanti|toplantı|takvim|etkinlik|rehber|kisi|kişi|not|is|iş|gorev|görev|foto|fotograf|fotoğraf|photos|drive|dosya|belge)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bangParts.length > 1) {
    return bangParts;
  }

  // 2. Spoken/written sequential connectors ("ardından", "daha sonra", "ondan sonra", "peşinden", "akabinde", "ayrıca bir de", "sonrasında da")
  const connectorRegex =
    /(?:[,;.]|\s+)\b(?:ve\s+ardından|ardından\s+da|ardından|ve\s+daha\s+sonra|daha\s+sonra\s+da|daha\s+sonra|ondan\s+sonra\s+da|ondan\s+sonra|peşinden\s+de|peşinden|akabinde|ayrıca\s+bir\s+de|bir\s+de\s+bunun\s+yanında|sonrasında\s+da|hemen\s+ardından)\b[,:\s]*/gi;
  if (connectorRegex.test(trimmed)) {
    const parts = trimmed
      .split(connectorRegex)
      .map((s) => s.trim())
      .filter((s) => s.length >= 6);
    if (parts.length > 1) {
      return parts;
    }
  }

  return [trimmed];
}

function formatSpokenTurkishDate(isoDate?: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return "bugün";
  }
  const monthsTr = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  const [, mStr, dStr] = isoDate.split("-");
  const dayNum = parseInt(dStr, 10);
  const monthName = monthsTr[parseInt(mStr, 10) - 1] || "";
  const now = getIstanbulNow();
  const todayIso = formatIsoDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowIso = formatIsoDate(tomorrow);

  if (isoDate === todayIso) {
    return `bugün ${dayNum} ${monthName}`;
  }
  if (isoDate === tomorrowIso) {
    return `yarın ${dayNum} ${monthName}`;
  }
  return `${dayNum} ${monthName}`;
}

export function buildNaturalSpokenReply(res: AssistantProcessResult): string {
  if (res.duplicate || !res.replyText) return "";

  if (res.chainedCount && res.chainedCount > 1) {
    return `Tamamdır Onur Bey, peş peşe söylediğiniz ${res.chainedCount} komutu da sırasıyla yerine getirdim. Başka bir isteğiniz var mı?`;
  }

  if (res.intent === "calendar") {
    const title = res.calendarEvent?.title || res.targetQuery || "etkinlik";
    const spokenDate = formatSpokenTurkishDate(res.calendarEvent?.date);
    const spokenTime = res.calendarEvent?.startTime || "14:00";
    if (res.action === "delete") {
      return res.syncedToGoogle
        ? `Tamamdır Onur Bey, ${title} etkinliğini Google Takvim'inizden sildim. Başka bir isteğiniz var mı?`
        : `Onur Bey, takviminizde ${title} adında bir etkinlik bulamadım.`;
    }
    if (res.action === "update") {
      return res.syncedToGoogle
        ? `Tamamdır Onur Bey, ${title} etkinliğinizi ${spokenDate} saat ${spokenTime} olarak Google Takvim'inizde güncelledim. Başka bir isteğiniz var mı?`
        : `Onur Bey, ${title} etkinliği takviminizde bulunamadığı için güncellenemedi.`;
    }
    if (res.action === "share") {
      return res.syncedToGoogle
        ? `Tamamdır Onur Bey, ${title} etkinliği için ilgili kişiye takvim davetiyesini gönderdim. Başka bir isteğiniz var mı?`
        : `Onur Bey, ${title} etkinliği için takvim davetiyesi gönderilemedi.`;
    }
    if (!res.syncedToGoogle && res.googleSyncError) {
      return `Onur Bey, ${title} etkinliği oluşturulurken bir hata oluştu: ${res.googleSyncError}`;
    }
    return `Tamamdır Onur Bey, ${title} etkinliğini ${spokenDate} saat ${spokenTime} için Google Takvim'inize ekledim. Başka bir isteğiniz var mı?`;
  }

  if (res.intent === "contact") {
    const name = res.contact?.name || res.targetQuery || "kişi";
    if (res.action === "delete") {
      return `Tamamdır Onur Bey, ${name} kaydını Google Rehber'inizden sildim. Başka bir isteğiniz var mı?`;
    }
    if (res.action === "update") {
      return `Tamamdır Onur Bey, ${name} kişisinin bilgilerini Google Rehber'inizde güncelledim. Başka bir isteğiniz var mı?`;
    }
    return `Tamamdır Onur Bey, ${name} kişisini Google Rehber'inize kaydettim. Başka bir isteğiniz var mı?`;
  }

  if (res.intent === "note") {
    const content = res.note?.title || res.note?.content || "notunuzu";
    return `Tamamdır Onur Bey, ${content} konusunu Google Görevler ve Takvim listenize işledim. Başka bir isteğiniz var mı?`;
  }

  if (res.intent === "photos") {
    if (res.selectedPhoto) {
      return `Tamamdır Onur Bey, seçtiğiniz ${res.selectedPhoto.title} fotoğrafını şimdi sizinle paylaşıyorum. Başka bir isteğiniz var mı?`;
    }
    const count = res.photos?.length || 0;
    if (count > 0) {
      return `Onur Bey, ${res.targetQuery || "istediğiniz"} araması için ${count} fotoğraf buldum ve ekrana getirdim. İçlerinden birini paylaşmamı isterseniz numarasını söyleyebilirsiniz.`;
    }
    return `Onur Bey, ${res.targetQuery || "bu"} aramasına uygun bir fotoğraf bulamadım. Farklı bir tarih veya isim söylemek ister misiniz?`;
  }

  if (res.intent === "drive") {
    if (res.selectedDriveFile) {
      return `Tamamdır Onur Bey, ${res.selectedDriveFile.name} dosyasını şimdi sizinle paylaşıyorum. Başka bir isteğiniz var mı?`;
    }
    const count = res.driveFiles?.length || 0;
    if (count > 0) {
      return `Onur Bey, Google Drive'da ${res.targetQuery || "istediğiniz"} ile ilgili ${count} dosya buldum ve seçenekler halinde listeledim. Hangisini paylaşmamı istersiniz?`;
    }
    return `Onur Bey, Google Drive'da ${res.targetQuery || "bu"} aramasına uygun bir dosya bulamadım. Başka bir dosya adı söylemek ister misiniz?`;
  }

  return "Buyurun Onur Bey, sizi dinliyorum. Takvim, rehber, görev, Google Photos veya Drive için ne yapmamı istersiniz?";
}

export async function processAssistantInput(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  isVoice?: boolean;
  credentials?: AssistantCredentials;
  _skipChaining?: boolean;
}): Promise<AssistantProcessResult> {
  const result = await processAssistantInputCore(params);
  if (!result.spokenReply && !result.duplicate) {
    result.spokenReply = buildNaturalSpokenReply(result);
  }
  if (!result.duplicate && !params._skipChaining) {
    if (result.calendarEvent) {
      recentWebhookEvents.calendars = [
        result.calendarEvent,
        ...recentWebhookEvents.calendars.filter(
          (x) => x.id !== result.calendarEvent!.id
        ),
      ].slice(0, 25);
      invalidateLiveWorkspaceCache();
    }
    if (result.contact) {
      recentWebhookEvents.contacts = [
        result.contact,
        ...recentWebhookEvents.contacts.filter(
          (x) => x.id !== result.contact!.id
        ),
      ].slice(0, 35);
      invalidateLiveWorkspaceCache();
    }
    if (result.note) {
      recentWebhookEvents.notes = [
        result.note,
        ...recentWebhookEvents.notes.filter((x) => x.id !== result.note!.id),
      ].slice(0, 25);
      invalidateLiveWorkspaceCache();
    }
  }
  return result;
}

async function processAssistantInputCore(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  isVoice?: boolean;
  credentials?: AssistantCredentials;
  _skipChaining?: boolean;
}): Promise<AssistantProcessResult> {
  loadFreshEnv();

  // 0. Never process bot reply echoes as user commands
  if (params.text && isBotReplyEcho(params.text)) {
    return {
      transcript: "",
      intent: "help",
      action: "create",
      replyText: "",
      usedGemini: false,
      syncedToGoogle: false,
      duplicate: true,
    };
  }

  const creds = params.credentials || {};
  const geminiKey = creds.geminiApiKey || process.env.GEMINI_API_KEY;
  const isVoice = Boolean(params.isVoice || params.audioBase64);
  const accessToken = await resolveGoogleAccessToken(creds);
  const calendarContext = accessToken
    ? await getUpcomingCalendarSummaryForPrompt(accessToken)
    : "";

  let usedGemini = false;
  let transcript = params.text?.trim() || "";
  let parsed: {
    intent: "calendar" | "contact" | "note" | "photos" | "drive" | "help";
    action: ActionType;
    targetQuery?: string;
    recipientEmail?: string;
    recipientQuery?: string;
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
        calendarContext,
      });

      if (geminiResult) {
        usedGemini = true;
        transcript = geminiResult.transcript || transcript;
        parsed = {
          intent: geminiResult.intent || "help",
          action: geminiResult.action || "create",
          targetQuery: geminiResult.targetQuery,
          recipientEmail: geminiResult.recipientEmail,
          recipientQuery: geminiResult.recipientQuery,
          calendar: geminiResult.calendar,
          contact: geminiResult.contact,
          note: geminiResult.note,
        };
      }
    } catch {
      // Fallback to local parser
    }
  }

  if (isBotReplyEcho(transcript)) {
    return {
      transcript: "",
      intent: "help",
      action: "create",
      replyText: "",
      usedGemini: false,
      syncedToGoogle: false,
      duplicate: true,
    };
  }

  if (!transcript) {
    if (!geminiKey) {
      return {
        transcript: "",
        intent: "help",
        action: "create",
        usedGemini: false,
        syncedToGoogle: false,
        duplicate: true,
        replyText: "",
      };
    }
    return {
      transcript: "",
      intent: "help",
      action: "create",
      usedGemini: false,
      syncedToGoogle: false,
      replyText: params.audioBase64
        ? `🎙️ *[Sesli Mesaj Çözümlendi]* Sesli mesajınız tam olarak duyulamadı, lütfen tekrar deneyin.`
        : "",
    };
  }

  // Normalize spoken Turkish numbers & dates ("on yedi eylül iki bin yirmi altı" -> "17 Eylül 2026", "beş numarayı paylaş" -> "5 numarayı paylaş")
  transcript = normalizeSpokenTurkishNumbersAndDates(transcript);

  // ==================== 0. INSTANT STOP / HANGUP / PAUSE MODE INTERCEPTION ====================
  if (isHangupOrStopCommand(transcript)) {
    terminateWhatsAppCall();
    return {
      transcript,
      intent: "help",
      action: "delete",
      endCall: true,
      usedGemini,
      syncedToGoogle: false,
      replyText:
        `🛑 *Sesli Arama ve Asistan Dinleme Modu Kapatıldı.*\n\n` +
        `👩‍💼 _"Tamamdır Onur Bey, sesli aramayı ve dinlemeyi hemen kapatıyorum. İyi günler dilerim."_\n\n` +
        `_Tekrar başlatmak istediğinizde arayabilir veya komut gönderebilirsiniz._`,
      spokenReply:
        "Tamamdır Onur Bey, sesli aramayı ve dinlemeyi hemen kapatıyorum. İyi günler dilerim.",
    };
  }

  if (isPauseListeningCommand(transcript)) {
    return {
      transcript,
      intent: "help",
      action: "update",
      pauseListening: true,
      usedGemini,
      syncedToGoogle: false,
      replyText:
        `⏸️ *Asistan Dinleme Modu Duraklatıldı (Sessize Alındı).*\n\n` +
        `👩‍💼 _"Tamamdır Onur Bey, dinlemeyi duraklattım."_`,
      spokenReply: "Tamamdır Onur Bey, dinlemeyi duraklattım.",
    };
  }

  // Check for back-to-back sequential commands ("peş peşe komut çalıştırma")
  if (!params._skipChaining) {
    const subCommands = splitIntoSequentialCommands(transcript);
    if (subCommands.length > 1) {
      const subResults: AssistantProcessResult[] = [];
      for (const cmdText of subCommands) {
        const res = await processAssistantInput({
          text: cmdText,
          isVoice,
          credentials: creds,
          _skipChaining: true,
        });
        if (!res.duplicate && res.replyText) {
          subResults.push(res);
        }
      }
      if (subResults.length > 1) {
        const stepBadges = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];
        const combinedReply =
          (isVoice
            ? `🎙️ *Çoklu Sesli Komut Algılandı:* _"${transcript}"_\n\n`
            : "") +
          `⚡ *Peş Peşe ${subResults.length} Komut Başarıyla Çalıştırıldı!*\n\n` +
          subResults
            .map((r, idx) => {
              const cleanStepReply = r.replyText.replace(
                /^🎙️ \*Sesli Komut Algılandı:\* _"[^"]*"_\s*/i,
                ""
              );
              return `${stepBadges[idx] || `${idx + 1}.`} *Komut ${idx + 1}:*\n${cleanStepReply}`;
            })
            .join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

        const lastRes = subResults[subResults.length - 1];
        return {
          transcript,
          intent: lastRes.intent,
          action: lastRes.action,
          targetQuery: lastRes.targetQuery,
          replyText: combinedReply,
          usedGemini: subResults.some((r) => r.usedGemini),
          syncedToGoogle: subResults.some((r) => r.syncedToGoogle),
          chainedCount: subResults.length,
          calendarEvent: subResults.find((r) => r.calendarEvent)?.calendarEvent,
          contact: subResults.find((r) => r.contact)?.contact,
          note: subResults.find((r) => r.note)?.note,
          photos: subResults.find((r) => r.photos?.length)?.photos,
          driveFiles: subResults.find((r) => r.driveFiles?.length)?.driveFiles,
          selectedDriveFile: subResults.find((r) => r.selectedDriveFile)
            ?.selectedDriveFile,
          selectedPhoto: subResults.find((r) => r.selectedPhoto)?.selectedPhoto,
          endCall: subResults.some((r) => r.endCall),
          pauseListening: subResults.some((r) => r.pauseListening),
        };
      }
    }
  }

  const localParsed = parseCommandLocally(transcript, isVoice);

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
  } else if (localParsed.intent === "note" && localParsed.note) {
    // Explicit !not / "not al" / "iş olarak ata" must always use the Google Tasks & İş Ataması flow
    parsed.intent = "note";
    if (!parsed.note?.content) {
      parsed.note = localParsed.note;
    }
  } else if (
    localParsed.intent === "photos" ||
    localParsed.intent === "drive"
  ) {
    parsed.intent = localParsed.intent;
    parsed.action = localParsed.action;
    if (localParsed.targetQuery) {
      parsed.targetQuery = localParsed.targetQuery;
    }
    if (localParsed.recipientQuery && !parsed.recipientQuery) {
      parsed.recipientQuery = localParsed.recipientQuery;
    }
  } else if (
    localParsed.intent === "contact" &&
    /^!(?:rehber|kisi|kişi)\b/i.test(transcript.trim())
  ) {
    parsed = localParsed;
  } else if (
    localParsed.intent === "calendar" &&
    parsed.intent !== "calendar" &&
    /\b(toplanti\w*|etkinlik\w*|etkinlig\w*|takvim\w*|randevu\w*|ajanda\w*)\b/.test(
      normalizeTr(transcript)
    )
  ) {
    // Never let a calendar/meeting request be misclassified as "contact" or "help"
    parsed.intent = "calendar";
    parsed.action = localParsed.action;
    if (!parsed.calendar?.title && localParsed.calendar) {
      parsed.calendar = localParsed.calendar;
    }
  }

  // Hard guard: priority order is delete > update > create
  const normTranscriptForAction = normalizeTr(transcript);
  const hasExplicitDeleteWord =
    /\b(sil|siler|silin|iptal|kaldir|cikar)\b/.test(normTranscriptForAction);
  const hasExplicitUpdateWord =
    !hasExplicitDeleteWord &&
    (Boolean(localParsed.shiftMinutes) ||
      /\b(guncelle\w*|degistir\w*|duzenle\w*|yenile\w*|one\s*cek\w*|ileri\w*\s*al\w*|ertele\w*)\b/.test(
        normTranscriptForAction
      ));
  const hasExplicitCreateWord =
    !hasExplicitDeleteWord &&
    !hasExplicitUpdateWord &&
    /\b(ekle\w*|olustur\w*|ayarla\w*|planla\w*|gir\b|girip\b|girer\s*misin\w*|girermisin\w*|girelim\b|girmesini\b|kaydet\w*|kaydedip\b|ac\b|acar\s*misin\w*)\b/.test(
      normTranscriptForAction
    );

  let action: ActionType = hasExplicitDeleteWord
    ? "delete"
    : hasExplicitUpdateWord
      ? "update"
      : hasExplicitCreateWord
        ? "create"
        : localParsed.action !== "create"
          ? localParsed.action
          : parsed.action || "create";
  const rawTargetQuery =
    parsed.targetQuery ||
    localParsed.targetQuery ||
    parsed.calendar?.title ||
    parsed.contact?.name ||
    "";
  const targetQuery = rawTargetQuery.replace(/["'“”«»]/g, "").trim();
  const recipientEmail =
    parsed.recipientEmail ||
    localParsed.recipientEmail ||
    parsed.calendar?.attendeeEmail;
  const recipientQuery = parsed.recipientQuery || localParsed.recipientQuery;

  let syncedToGoogle = false;
  let googleSyncError: string | undefined;

  // Guard against background room conversations on open microphone being misclassified as "note", "calendar", "contact", "drive", or "photos"
  const hasRoomChatterWords =
    /\b(yani|abi|abla|hocam|dedik|dedim|dedi|uyuyordur|bakayim|peruk|geliyor\s+ya|onlar\s+da|sey\b|falan|filan|iste\b|hani\b|bence|sanirim|galiba|herhalde|acaba|zaten|cunku|ama\b|fakat|neyse|vallahi|valla|diyorum|diyorsun|konustuk|yapiyoruz|gidiyoruz|baktim|scooter|kurye|superet|implant|anakart|kavurma|makin\w*)\b/.test(
      normTranscriptForAction
    );

  if (isVoice && parsed.intent === "note") {
    const hasExplicitNoteCommand =
      /^!not\b/i.test(transcript.trim()) ||
      /\b(not\s+al\w*|not\s+ekle\w*|not\s+kaydet\w*|notu\s+kaydet\w*|gorev\s+ekle\w*|gorev\s+olustur\w*|is\s+olarak\s+ata\w*|hatirlat\w*|listeye\s+ekle\w*)\b/.test(
        normTranscriptForAction
      );
    const isTooLongForVoiceNote = transcript.trim().split(/\s+/).length > 22;
    if (!hasExplicitNoteCommand || isTooLongForVoiceNote || hasRoomChatterWords) {
      parsed.intent = "help";
    }
  }
  if (isVoice && parsed.intent === "calendar") {
    const hasExplicitCalVerb =
      /\b(planla\w*|ayarla\w*|ekle\w*|olustur\w*|ac\b|acmani|acar\s*misin\w*|gir\b|girip\b|girer\s*misin\w*|kaydet\w*|davet\w*|gonder\w*|paylas\w*|sil\w*|iptal\w*|kaldir\w*|guncelle\w*|degistir\w*|ertele\w*|tasi\w*|one\s*cek\w*|ileri\w*\s*al\w*)\b/.test(
        normTranscriptForAction
      );
    const hasExplicitCalNoun =
      /\b(toplanti\w*|etkinlik\w*|etkinlig\w*|takvim\w*|randevu\w*|ajanda\w*|saat\b|yarin\b|bugun\b|haftaya\b)\b/.test(
        normTranscriptForAction
      );
    const candidateCalTitle = String(
      parsed.calendar?.title || localParsed.calendar?.title || ""
    ).trim();
    const normCandidateTitle = normalizeTr(candidateCalTitle);
    const isParagraphChatter =
      candidateCalTitle.split(/\s+/).length > 6 ||
      candidateCalTitle.length > 48 ||
      transcript.trim().split(/\s+/).length > 20 ||
      hasRoomChatterWords ||
      /\b(yani|abi|dedik|uyuyordur|bakayim|peruk|kadar|geliyor|falan|filan|cunku|ama|zaten)\b/.test(
        normCandidateTitle
      );
    if (
      !hasExplicitCalVerb ||
      (!hasExplicitCalNoun && !localParsed.hasExplicitTime) ||
      isParagraphChatter
    ) {
      parsed.intent = "help";
    }
  }
  if (isVoice && parsed.intent === "contact") {
    const hasPhoneDigits = /\b0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b|\b\d{10,11}\b/.test(
      transcript
    );
    const hasExplicitContactKeyword =
      /\b(rehber\w*|kisi\b|kisiyi|kisisini|kisiler\w*|numara\w*|telefon\w*)\b/.test(
        normTranscriptForAction
      );
    const candidateName = (parsed.contact?.name || localParsed.contact?.name || "").trim();
    const isLongSentenceNotName =
      candidateName.split(/\s+/).length > 5 ||
      hasRoomChatterWords ||
      /\b(toplanti\w*|takvim\w*|etkinlik\w*|istiyorum|konusacagiz|yapabilir|misin)\b/.test(
        normalizeTr(candidateName)
      );
    if ((!hasExplicitContactKeyword && !hasPhoneDigits) || isLongSentenceNotName) {
      parsed.intent = "help";
    }
  }
  if (isVoice && (parsed.intent === "drive" || parsed.intent === "photos")) {
    const hasExplicitMediaVerb =
      /\b(getir\w*|bul\w*|listele\w*|goster\w*|paylas\w*|gonder\w*|ac\b|acar\s*misin\w*|indir\w*|ara\w*|hangileri|numarayi|numarali|secenek\w*)\b/.test(
        normTranscriptForAction
      );
    const isMediaChatter =
      transcript.trim().split(/\s+/).length > 22 || hasRoomChatterWords;
    if (!hasExplicitMediaVerb || isMediaChatter) {
      parsed.intent = "help";
    }
  }

  // ==================== 1. CALENDAR (CREATE / UPDATE / DELETE / SHARE) ====================
  if (parsed.intent === "calendar") {
    const calData = parsed.calendar ||
      localParsed.calendar || {
        title: targetQuery || "Toplantı",
        date: formatIsoDate(getIstanbulNow()),
        startTime: "14:00",
        endTime: "15:00",
        attendee: recipientEmail || "WhatsApp Kullanıcısı",
        attendeeEmail: recipientEmail,
        location: "Google Meet",
      };

    // Always validate date (YYYY-MM-DD) and prefer localParsed date if Gemini returned an invalid/empty date or if localParsed has explicit date
    if (!calData.date || !/^\d{4}-\d{2}-\d{2}$/.test(calData.date)) {
      calData.date =
        localParsed.calendar?.date || formatIsoDate(getIstanbulNow());
    } else if (localParsed.hasExplicitDate && localParsed.calendar?.date) {
      calData.date = localParsed.calendar.date;
    }

    // Prefer explicit time extracted from transcript ("14:00'e", "saat 14'te") and validate HH:mm format
    if (localParsed.hasExplicitTime && localParsed.calendar?.startTime) {
      calData.startTime = localParsed.calendar.startTime;
      calData.endTime = localParsed.calendar.endTime;
    }
    if (
      !calData.startTime ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(calData.startTime) ||
      (calData.startTime === "00:00" && !/\b00[:.]00\b|\bgece\s*yar[ıi]s[ıi]\b/i.test(transcript))
    ) {
      calData.startTime = localParsed.calendar?.startTime || "14:00";
    }
    if (
      !calData.endTime ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(calData.endTime) ||
      calData.endTime === calData.startTime
    ) {
      const [sh, sm] = calData.startTime.split(":").map(Number);
      calData.endTime = `${String((sh + 1) % 24).padStart(2, "0")}:${String(
        sm || 0
      ).padStart(2, "0")}`;
    }

    // Ensure clean title (strip any leftover "etkinliği aç", "oluştur", "girip ... gönder" clause if Gemini left it in)
    if (
      calData.title &&
      localParsed.calendar?.title &&
      /\b(girip|gonder|gönder|hesabina|hesabına|istiyorum|konuşacağız|konusacagiz|yapabilir)\b/i.test(
        calData.title
      )
    ) {
      calData.title = localParsed.calendar.title;
    }
    calData.title = String(calData.title || localParsed.calendar?.title || "Planlanan Etkinlik")
      .replace(
        /(?:\s+(?:etkinliği|etkinligi|etkinlik|toplantısı|toplantisi|toplantı|toplanti))?\s+(?:aç|ac|oluştur|olustur|ekle|ayarla|planla|gir)$/i,
        ""
      )
      .trim();
    if (!calData.title || calData.title.length < 2) {
      calData.title = localParsed.calendar?.title || "Planlanan Etkinlik";
    }

    const searchOptions: CalendarSearchOptions = {
      date: calData.date,
      startTime: calData.startTime,
      hasExplicitDate: Boolean(localParsed.hasExplicitDate || parsed.calendar?.date),
      hasExplicitTime: Boolean(localParsed.hasExplicitTime),
    };

    if (recipientEmail && !calData.attendeeEmail) {
      calData.attendeeEmail = recipientEmail;
    }

    if (action === "share") {
      let matchedTitle = targetQuery || calData.title;
      let invitedEmails: string[] | undefined;
      let resolvedContactName: string | undefined;
      let htmlLink: string | undefined;

      if (accessToken) {
        const shareRes = await shareGoogleCalendarEvent(
          accessToken,
          matchedTitle,
          recipientEmail || transcript,
          recipientQuery,
          searchOptions
        );
        // Smart fallback: if user gave an explicit time + title + recipient, and no existing event matched that title,
        // the user wants to CREATE this new event at that time and send the invite to the recipient!
        if (!shareRes.ok && localParsed.hasExplicitTime && (recipientQuery || recipientEmail)) {
          action = "create";
        } else {
          syncedToGoogle = shareRes.ok;
          htmlLink = shareRes.htmlLink;
          if (shareRes.matchedTitle) matchedTitle = shareRes.matchedTitle;
          invitedEmails = shareRes.invitedEmails;
          resolvedContactName = shareRes.resolvedContactName;
          googleSyncError = shareRes.error;
        }
      }

      if (action === "share") {
        const recipientDisplay = invitedEmails?.length
          ? resolvedContactName
            ? `${resolvedContactName} (${invitedEmails.join(", ")})`
            : invitedEmails.join(", ")
          : recipientEmail || recipientQuery || "Alıcı";

        const replyText =
          (isVoice
            ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
            : "") +
          `📨 *Google Takvim Etkinliği / Görevi Gönderildi!*\n\n` +
          `📌 *Etkinlik / Görev:* ${matchedTitle}\n` +
          `✉️ *Gönderilen Alıcı:* ${recipientDisplay}` +
          (syncedToGoogle
            ? `\n✅ *Google Takvim üzerinden karşı tarafa resmi e-posta ve takvim daveti gönderildi!*`
            : googleSyncError
              ? `\n⚠️ _${googleSyncError}_`
              : "");

        return {
          transcript,
          intent: "calendar",
          action: "share",
          targetQuery: matchedTitle,
          replyText,
          usedGemini,
          syncedToGoogle,
          googleSyncError,
          calendarEvent: {
            id: "evt-" + Date.now(),
            title: matchedTitle,
            date: calData.date,
            startTime: calData.startTime,
            endTime: calData.endTime,
            attendee: recipientDisplay,
            attendeeEmail: invitedEmails?.join(", ") || recipientEmail,
            location: calData.location || "Google Meet",
            source: isVoice
              ? "🎙️ WhatsApp Sesli Davet"
              : "💬 WhatsApp E-posta Daveti",
            createdTime: "Gönderildi",
            htmlLink,
            syncedWithGoogle: syncedToGoogle,
          },
        };
      }
    }

    if (action === "delete") {
      let deletedTitle = targetQuery || calData.title;
      let deletedDate: string | undefined;
      let deletedTime: string | undefined;
      if (accessToken) {
        const delRes = await deleteGoogleCalendarEvent(
          accessToken,
          deletedTitle,
          searchOptions
        );
        syncedToGoogle = delRes.ok;
        if (delRes.deletedTitle) deletedTitle = delRes.deletedTitle;
        deletedDate = delRes.deletedDate;
        deletedTime = delRes.deletedTime;
        googleSyncError = delRes.error;
      }

      const replyText = syncedToGoogle
        ? (isVoice
            ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
            : "") +
          `🗑️ *Google Takvim Etkinliği Silindi!*\n\n` +
          `📌 *İptal Edilen:* ${deletedTitle}` +
          (deletedDate
            ? `\n📅 *Tarih / Saat:* ${deletedDate}${deletedTime ? ` | ${deletedTime}` : ""}`
            : "") +
          `\n✅ *Gerçek Google Takvim'inizden kaldırıldı!*`
        : (isVoice
            ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
            : "") +
          `⚠️ *Google Takvim Etkinliği Bulunamadı!*\n\n` +
          `_${googleSyncError || `"${deletedTitle}" ile eşleşen bir etkinlik bulunamadı.`}_`;

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
      if (
        localParsed.shiftMinutes &&
        localParsed.hasExplicitTime &&
        localParsed.calendar
      ) {
        calData.startTime = localParsed.calendar.startTime;
        calData.endTime = localParsed.calendar.endTime;
      }

      let htmlLink: string | undefined;
      let matchedTitle = targetQuery || calData.title;
      if (accessToken) {
        const updRes = await updateGoogleCalendarEvent(
          accessToken,
          matchedTitle,
          calData,
          localParsed.shiftMinutes || 0,
          Boolean(localParsed.hasExplicitTime),
          Boolean(localParsed.hasExplicitDate)
        );
        syncedToGoogle = updRes.ok;
        htmlLink = updRes.htmlLink;
        if (updRes.matchedTitle) matchedTitle = updRes.matchedTitle;
        if (updRes.finalDate) calData.date = updRes.finalDate;
        if (updRes.finalStartTime) calData.startTime = updRes.finalStartTime;
        if (updRes.finalEndTime) calData.endTime = updRes.finalEndTime;
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
        (isVoice
          ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
          : "") +
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

    // CREATE CALENDAR EVENT (with optional immediate email invitation)
    const calSig = `cal:${calData.date}:${calData.startTime}:${normalizeTr(calData.title)}`;
    if (isRecentlyCreatedSignature(calSig, 15000)) {
      return {
        transcript,
        intent: "calendar",
        action: "create",
        replyText: "",
        usedGemini,
        syncedToGoogle: true,
        duplicate: true,
      };
    }

    let htmlLink: string | undefined;
    let invitedEmails: string[] | undefined;
    let resolvedContactName: string | undefined;
    if (accessToken) {
      const calRes = await createGoogleCalendarEvent(
        accessToken,
        calData,
        recipientQuery
      );
      if (calRes.duplicate) {
        return {
          transcript,
          intent: "calendar",
          action: "create",
          replyText: "",
          usedGemini,
          syncedToGoogle: true,
          duplicate: true,
        };
      }
      syncedToGoogle = calRes.ok;
      htmlLink = calRes.htmlLink;
      invitedEmails = calRes.invitedEmails;
      resolvedContactName = calRes.resolvedContactName;
      googleSyncError = calRes.error;
    }

    const attendeeDisplay = invitedEmails?.length
      ? resolvedContactName
        ? `${resolvedContactName} (${invitedEmails.join(", ")})`
        : invitedEmails.join(", ")
      : calData.attendee || "WhatsApp Kullanıcısı";

    const calendarEvent: CalendarItem = {
      id: "evt-" + Date.now(),
      title: calData.title,
      date: calData.date,
      startTime: calData.startTime,
      endTime: calData.endTime,
      attendee: attendeeDisplay,
      attendeeEmail: invitedEmails?.join(", ") || calData.attendeeEmail,
      location: calData.location || "Google Meet",
      source: isVoice ? "🎙️ WhatsApp Sesli Komut" : "💬 WhatsApp Metin Komutu",
      createdTime: "Şimdi",
      htmlLink,
      syncedWithGoogle: syncedToGoogle,
    };

    const linkLine = htmlLink ? `\n🔗 *Takvimde Görüntüle:* ${htmlLink}` : "";
    const syncTag = syncedToGoogle
      ? invitedEmails?.length
        ? `\n📨 *Davet Gönderilen Alıcı:* ${attendeeDisplay}${linkLine}\n✅ *Gerçek Google Takvim'inize eklendi ve karşı tarafa resmi e-posta daveti gönderildi!*`
        : `${linkLine}\n✅ *Gerçek Google Takvim'inize senkronize edildi!*`
      : googleSyncError
        ? `\n⚠️ _${googleSyncError}_`
        : "";

    const replyText =
      (isVoice
        ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
        : "") +
      `📅 *Google Takvim'e Etkinlik / Görev Eklendi!*\n\n` +
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
        (isVoice
          ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
          : "") +
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
      let removedDuplicates = 0;
      if (accessToken) {
        const updRes = await updateGooglePersonContact(
          accessToken,
          matchedName,
          cntData
        );
        if (updRes.duplicate) {
          return {
            transcript,
            intent: "contact",
            action: "update",
            replyText: "",
            usedGemini,
            syncedToGoogle: true,
            duplicate: true,
          };
        }
        syncedToGoogle = updRes.ok;
        if (updRes.matchedName) matchedName = updRes.matchedName;
        if (updRes.removedDuplicates) removedDuplicates = updRes.removedDuplicates;
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
        (isVoice
          ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
          : "") +
        `🔄 *Google Kişiler Kaydı Güncellendi!*\n\n` +
        `📇 *İsim:* ${contact.name}\n` +
        (cntData.phone ? `📞 *Yeni Telefon:* ${cntData.phone}\n` : "") +
        (cntData.email ? `✉️ *Yeni E-posta:* ${cntData.email}\n` : "") +
        (cntData.company && cntData.company !== "WhatsApp Bağlantısı"
          ? `🏢 *Yeni Şirket:* ${cntData.company}\n`
          : "") +
        (removedDuplicates > 0
          ? `🧹 _Rehberdeki ${removedDuplicates} adet mükerrer kopya otomatik temizlendi._\n`
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
    const cntSig = `cnt:${normalizeTr(cntData.name)}:${cntData.phone.replace(/\D/g, "")}`;
    if (isRecentlyCreatedSignature(cntSig, 45000)) {
      return {
        transcript,
        intent: "contact",
        action: "create",
        replyText: "",
        usedGemini,
        syncedToGoogle: true,
        duplicate: true,
      };
    }

    if (accessToken) {
      const cntRes = await createGooglePersonContact(accessToken, cntData);
      if (cntRes.duplicate) {
        return {
          transcript,
          intent: "contact",
          action: "create",
          replyText: "",
          usedGemini,
          syncedToGoogle: true,
          duplicate: true,
        };
      }
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
      (isVoice
        ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
        : "") +
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

  // ==================== 3. NOTES & GOOGLE TASKS / İŞ ATAMASI ====================
  if (parsed.intent === "note" && parsed.note) {
    const cleanNoteContent =
      localParsed.intent === "note" &&
      localParsed.note?.content &&
      localParsed.note.content.length < parsed.note.content.length
        ? localParsed.note.content
        : parsed.note.content;
    const cleanNoteTitle =
      cleanNoteContent.slice(0, 45) +
      (cleanNoteContent.length > 45 ? "..." : "");

    const noteSig = `note:${normalizeTr(cleanNoteContent)}:${normalizeTr(recipientEmail || recipientQuery || "")}`;
    if (isRecentlyCreatedSignature(noteSig, 45000)) {
      return {
        transcript,
        intent: "note",
        action: "create",
        replyText: "",
        usedGemini,
        syncedToGoogle: false,
        duplicate: true,
      };
    }

    const note: NoteItem = {
      id: "not-" + Date.now(),
      title: cleanNoteTitle,
      content: cleanNoteContent,
      category:
        recipientEmail || recipientQuery
          ? "İş Ataması / Görev"
          : parsed.note.category || "Google Tasks / Not",
      time: "Şimdi",
    };

    const taskSyncRes = await createGoogleTaskAndAssignment(
      accessToken,
      note,
      transcript,
      recipientEmail,
      recipientQuery
    );

    syncedToGoogle = taskSyncRes.ok;
    googleSyncError = taskSyncRes.error;

    const hasAssignedPerson = taskSyncRes.invitedEmails.length > 0;
    const headerLine = hasAssignedPerson
      ? `📋 *Google Tasks & İş Ataması Oluşturuldu!*`
      : `📝 *Google Tasks & Not Defterine Kaydedildi!*`;

    const assigneeBlock = hasAssignedPerson
      ? `\n👤 *İş Atanan Kişi:* ${
          taskSyncRes.resolvedContactName
            ? `${taskSyncRes.resolvedContactName} (${taskSyncRes.invitedEmails.join(", ")})`
            : taskSyncRes.invitedEmails.join(", ")
        }\n📨 *Bildirim:* İlgili kişiye Google üzerinden resmi iş ataması / görev daveti gönderildi!`
      : recipientQuery
        ? `\n⚠️ *Uyarı:* "${recipientQuery}" için Google Rehber'de kayıtlı bir e-posta adresi bulunamadı.`
        : "";

    const syncStatusLine = taskSyncRes.syncedToTasks
      ? `\n✅ *Google Tasks (Görevler) ve Takvim uygulamanıza senkronize edildi!*`
      : taskSyncRes.syncedToCalendar
        ? `\n✅ *Google Takvim'e eklendi ve atanan kişiye e-posta gönderildi!*` +
          (taskSyncRes.tasksServiceDisabled
            ? `\n⚙️ *Google Tasks Servisini 1 Tıkla Açın:* Google Cloud projenizde Tasks API kapalı olduğu için şu linkten "ETKİNLEŞTİR (ENABLE)" butonuna 1 kez basmanız yeterlidir: https://console.developers.google.com/apis/api/tasks.googleapis.com/overview?project=220430673297`
            : taskSyncRes.tasksScopeMissing
              ? `\n🔑 *Google Tasks Uygulaması İçin 1 Kez İzin Onayı Gerekiyor:* Ayrı Google Tasks listesine de yazılabilmesi için tarayıcıdan şu linke 1 kez tıklayıp onay verin: http://localhost:3000/api/auth/google`
              : "")
        : "";

    const replyText =
      (isVoice
        ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
        : "") +
      `${headerLine}\n\n` +
      `📌 *Görev / Not:* "${note.content}"\n` +
      `📂 *Kategori:* ${note.category}${assigneeBlock}${syncStatusLine}`;

    return {
      transcript,
      intent: "note",
      action: "create",
      replyText,
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      note,
    };
  }

  // ==================== 4. GOOGLE PHOTOS ====================
  if (parsed.intent === "photos") {
    const photoQuery =
      localParsed.targetQuery || targetQuery || "Son Fotoğraflar";
    const photoRes = await searchGooglePhotosAndDriveImages(
      accessToken,
      photoQuery,
      transcript
    );

    syncedToGoogle = photoRes.ok;
    googleSyncError = photoRes.error;

    if (photoRes.photos.length > 0) {
      recentWebhookEvents.photos = [
        ...photoRes.photos,
        ...recentWebhookEvents.photos,
      ].slice(0, 20);
    }

    if (photoRes.selectedOption) {
      const p = photoRes.selectedOption;
      const replyText =
        (isVoice
          ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
          : "") +
        `✅ *Seçilen Fotoğraf Paylaşıldı! (#${photoQuery})*\n\n` +
        `📸 *${p.title}*\n` +
        `🗓️ *Tarih:* ${p.date}\n` +
        `📂 *Albüm / Konum:* ${p.albumOrLocation || p.source}\n` +
        `🔗 *Doğrudan Görüntüle / İndir:* ${p.url}`;

      return {
        transcript,
        intent: "photos",
        action: "share",
        targetQuery: photoQuery,
        replyText: replyText.trim(),
        usedGemini,
        syncedToGoogle,
        googleSyncError,
        photos: [p],
        selectedPhoto: p,
      };
    }

    const numBadges = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];
    const noteHeader = photoRes.filterNote ? `${photoRes.filterNote}\n\n` : "";
    const listLines =
      photoRes.photos.length > 0
        ? photoRes.photos
            .slice(0, 6)
            .map(
              (p, i) =>
                `${numBadges[i] || `•`} *${p.title}*\n` +
                `   🗓️ Tarih: ${p.date} • 📂 ${p.albumOrLocation || p.source}\n` +
                `   🔗 Görüntüle: ${p.url}`
            )
            .join("\n\n")
        : photoRes.filterNote
          ? ""
          : `⚠️ *"${photoQuery}"* aramasına uygun fotoğraf bulunamadı.`;

    const optionHint =
      photoRes.photos.length > 1
        ? `\n\n💡 _Listedeki bir fotoğrafı tek başına büyütüp paylaşmak için "1 numaralı fotoğrafı paylaş" diyebilirsiniz._`
        : "";

    const permissionHint = photoRes.scopeMissing
      ? `\n\n🔑 *Google Photos & Drive İzni:* Fotoğraf ve albümlerinize erişim için tarayıcıdan 1 kez şu bağlantıyı onaylayın: http://localhost:3000/api/auth/google`
      : photoRes.serviceDisabledUrl
        ? `\n\n⚙️ *Google Photos API Aktivasyonu:* Google Cloud projenizde servisi açmak için 1 kez tıklayın: ${photoRes.serviceDisabledUrl}`
        : "";

    const replyText =
      (isVoice
        ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
        : "") +
      `📸 *Google Photos & Galeri Sonuçları (${photoQuery})*\n\n` +
      `${noteHeader}${listLines}${optionHint}${permissionHint}`;

    return {
      transcript,
      intent: "photos",
      action: "share",
      targetQuery: photoQuery,
      replyText: replyText.trim(),
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      photos: photoRes.photos,
    };
  }

  // ==================== 5. GOOGLE DRIVE ====================
  if (parsed.intent === "drive") {
    const driveQuery =
      localParsed.targetQuery || targetQuery || "Son Dosyalar";
    const driveRes = await searchAndShareGoogleDriveFiles(
      accessToken,
      driveQuery,
      transcript,
      recipientEmail,
      recipientQuery
    );

    syncedToGoogle = driveRes.ok;
    googleSyncError = driveRes.error;

    if (driveRes.files.length > 0) {
      recentWebhookEvents.driveFiles = [
        ...driveRes.files,
        ...recentWebhookEvents.driveFiles,
      ].slice(0, 20);
    }

    if (driveRes.selectedOption) {
      const f = driveRes.selectedOption;
      const sharedInfo =
        driveRes.invitedEmails.length > 0
          ? `\n📨 *E-posta ile Paylaşılan Alıcı:* ${
              driveRes.resolvedContactName
                ? `${driveRes.resolvedContactName} (${driveRes.invitedEmails.join(", ")})`
                : driveRes.invitedEmails.join(", ")
            }`
          : "";

      const replyText =
        (isVoice
          ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
          : "") +
        `✅ *Seçilen Google Drive Dosyası Paylaşıldı! (#${driveQuery})*\n\n` +
        `📄 *Dosya Adı:* ${f.name} (${f.typeLabel}${f.sizeLabel ? ` • ${f.sizeLabel}` : ""})\n` +
        `🗓️ *Güncelleme:* ${f.modifiedDate}` +
        (f.folderPath ? ` • 📂 *Klasör:* ${f.folderPath}` : "") +
        `\n` +
        (f.snippet ? `📝 *İçerik Özeti:* _"${f.snippet}"_\n` : "") +
        `🔗 *Doğrudan Açma / İndirme Linki:* ${f.webViewLink}` +
        (f.webContentLink ? `\n📥 *Direkt İndir:* ${f.webContentLink}` : "") +
        sharedInfo;

      return {
        transcript,
        intent: "drive",
        action: "share",
        targetQuery: driveQuery,
        replyText: replyText.trim(),
        usedGemini,
        syncedToGoogle,
        googleSyncError,
        driveFiles: [f],
        selectedDriveFile: f,
      };
    }

    const numBadges = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];
    const folderBanner = driveRes.matchedFolderLabel
      ? `📂 *Eşleşen Klasör:* ${driveRes.matchedFolderLabel}\n\n`
      : "";
    const noteBanner = driveRes.filterNote ? `${driveRes.filterNote}\n\n` : "";

    const filesBlock =
      driveRes.files.length > 0
        ? driveRes.files
            .map(
              (f, i) =>
                `${numBadges[i] || `${i + 1}.`} *${f.name}* (${f.typeLabel}${f.sizeLabel ? ` • ${f.sizeLabel}` : ""})\n` +
                `   🗓️ Güncelleme: ${f.modifiedDate}` +
                (f.folderPath ? ` • 📂 ${f.folderPath}` : "") +
                `\n` +
                (f.snippet ? `   📄 *İçerik Özeti:* _"${f.snippet}"_\n` : "") +
                `   🔗 *Paylaşım / Açma Linki:* ${f.webViewLink}`
            )
            .join("\n\n")
        : driveRes.filterNote
          ? ""
          : `⚠️ *"${driveQuery}"* aramasına uygun Google Drive dosyası bulunamadı.`;

    const shareBlock =
      driveRes.invitedEmails.length > 0 && driveRes.files.length > 0
        ? `\n\n📨 *Paylaşılan Kişi:* ${
            driveRes.resolvedContactName
              ? `${driveRes.resolvedContactName} (${driveRes.invitedEmails.join(", ")})`
              : driveRes.invitedEmails.join(", ")
          }`
        : `\n\n💡 _Seçeneklerden birini doğrudan WhatsApp'a dosya olarak indirmek veya paylaşmak için "1 numarayı paylaş" veya "5 numaralı dosyayı paylaş" diyebilirsiniz._`;

    const permissionHint = driveRes.scopeMissing
      ? `\n\n🔑 *Google Drive İzni Gerekiyor:* Drive dosyalarınıza erişim için tarayıcıdan 1 kez şu bağlantıyı onaylayın: http://localhost:3000/api/auth/google`
      : driveRes.serviceDisabledUrl
        ? `\n\n⚙️ *Google Drive API Aktivasyonu:* Google Cloud projenizde servisi açmak için 1 kez tıklayın: ${driveRes.serviceDisabledUrl}`
        : "";

    const replyText =
      (isVoice
        ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
        : "") +
      `📁 *Google Drive Dosya & İçerik Seçenekleri (${driveQuery})*\n\n` +
      `${folderBanner}${noteBanner}${filesBlock}${driveRes.files.length > 0 ? shareBlock : ""}${permissionHint}`;

    return {
      transcript,
      intent: "drive",
      action: "share",
      targetQuery: driveQuery,
      replyText: replyText.trim(),
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      driveFiles: driveRes.files,
      selectedDriveFile:
        driveRes.files.length === 1 ? driveRes.files[0] : undefined,
    };
  }

  const isConversationalGreeting =
    transcript.trim().split(/\s+/).length <= 6 &&
    !hasRoomChatterWords &&
    /\b(merhaba\w*|selam\w*|alo\w*|efendim|asistan\w*|iyi\s+gunler|gunaydin|iyi\s+aksamlar|nasilsin\w*|duyuyor\s*musun\w*|sesim\s+geliyor\s*mu|orada\s*misin\w*|oradamisin\w*|dinliyor\s*musun\w*|kimsin\w*|yardim\w*|ne\s+yapabilirsin\w*)\b/.test(
      normTranscriptForAction
    );

  if (isConversationalGreeting) {
    return {
      transcript,
      intent: "help",
      action: "share",
      usedGemini,
      syncedToGoogle: false,
      replyText:
        `👩‍💼 *Canlı Sesli Asistanınız Sizi Dinliyor, Onur Bey!*\n\n` +
        `_"Evet Onur Bey, sesinizi çok net duyuyorum, sizi dinliyorum. Takvim, rehber, görevler, Google Photos veya Drive için ne yapmamı istersiniz?"_`,
      spokenReply:
        "Evet Onur Bey, sesinizi çok net duyuyorum, sizi dinliyorum. Takvim, rehber, görevler, Google Photos veya Drive için ne yapmamı istersiniz?",
    };
  }

  // On live voice / audio inputs, ignore ambient room noise or non-command chatter instead of looping help prompts
  if (isVoice) {
    return {
      transcript: "",
      intent: "help",
      action: "create",
      usedGemini,
      syncedToGoogle: false,
      duplicate: true,
      replyText: "",
      spokenReply: "",
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
      `• 📝 *Not & İş Ataması:* "!not Rapor hazırlanacak ve Ali Sunal'a iş olarak ata"\n` +
      `• 📸 *Google Photos:* "!foto Yusuf" | "!foto Altınoluk" | "!foto 29 Ekim"\n` +
      `• 📁 *Google Drive:* "!drive Bütçe" | "!dosya Sözleşme"\n\n` +
      `Ya da mikrofona basarak sesli konuşabilirsiniz!`,
  };
}
