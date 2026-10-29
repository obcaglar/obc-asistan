import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getEnvValue(key: string): string | undefined {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${key}=`)) {
          return trimmed.slice(key.length + 1).trim();
        }
      }
    }
  } catch {}
  return process.env[key];
}

export async function GET() {
  const clientId = getEnvValue("GOOGLE_CLIENT_ID");
  const redirectUri =
    getEnvValue("GOOGLE_REDIRECT_URI") ||
    "http://localhost:3000/api/auth/google/callback";

  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_CLIENT_ID henüz .env.local dosyasında tanımlanmadı. Lütfen önce Client ID bilgisini paylaşın.",
      },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/contacts",
      "https://www.googleapis.com/auth/tasks",
    ].join(" "),
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
