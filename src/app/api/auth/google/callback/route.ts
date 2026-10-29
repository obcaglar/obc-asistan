import { NextRequest } from "next/server";
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

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return new Response(
      `<html><body style="font-family:sans-serif;background:#0f172a;color:#fff;padding:40px;text-align:center;">
        <h2>❌ Yetkilendirme İptal Edildi veya Hata Oluştu</h2>
        <p>${error || "Kod alınamadı"}</p>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const clientId = getEnvValue("GOOGLE_CLIENT_ID") || "";
  const clientSecret = getEnvValue("GOOGLE_CLIENT_SECRET") || "";
  const redirectUri =
    getEnvValue("GOOGLE_REDIRECT_URI") ||
    "http://localhost:3000/api/auth/google/callback";

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.refresh_token) {
      return new Response(
        `<html><body style="font-family:sans-serif;background:#0f172a;color:#fff;padding:40px;text-align:center;">
          <h2>⚠️ Token Alınamadı</h2>
          <pre style="background:#1e293b;padding:16px;border-radius:12px;display:inline-block;text-align:left;">${JSON.stringify(
            tokenData,
            null,
            2
          )}</pre>
        </body></html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const refreshToken: string = tokenData.refresh_token;
    process.env.GOOGLE_REFRESH_TOKEN = refreshToken;

    // Persist GOOGLE_REFRESH_TOKEN to .env.local automatically
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let envContent = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, "utf-8")
        : "";
      if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
        envContent = envContent.replace(
          /GOOGLE_REFRESH_TOKEN=.*/g,
          `GOOGLE_REFRESH_TOKEN=${refreshToken}`
        );
      } else {
        envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
      }
      fs.writeFileSync(envPath, envContent, "utf-8");
    } catch {
      // Ignore if running in read-only serverless environment
    }

    return new Response(
      `<!DOCTYPE html>
      <html lang="tr">
      <head><meta charset="UTF-8"><title>Google Workspace Bağlandı!</title></head>
      <body style="font-family:sans-serif;background:#020617;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
        <div style="max-width:480px;background:#0f172a;border:1px solid #10b98155;padding:32px;border-radius:24px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
          <div style="font-size:48px;margin-bottom:12px;">🎉</div>
          <h1 style="font-size:20px;color:#34d399;margin:0 0 12px;">Google Takvim, Rehber & Tasks Canlı Olarak Bağlandı!</h1>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.6;">
            <b>GOOGLE_REFRESH_TOKEN</b> otomatik olarak <code>.env.local</code> dosyanıza kaydedildi.<br><br>
            Artık WhatsApp üzerinden göndereceğiniz tüm toplantı, kişi ve not/görev komutları doğrudan gerçek <b>Google Takvim</b>, <b>Google Kişiler</b> ve <b>Google Tasks (Görevler)</b> hesabınıza işlenecektir!
          </p>
          <a href="http://localhost:3000" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#10b981;color:#020617;font-weight:bold;text-decoration:none;border-radius:12px;font-size:13px;">
            Kontrol Paneline Dön →
          </a>
        </div>
      </body>
      </html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err) {
    return new Response(
      `Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`,
      { status: 500 }
    );
  }
}
