import { NextRequest } from "next/server";

const FORM_PATH = /^\/form\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export async function GET(request: NextRequest) {
  const targetValue = request.nextUrl.searchParams.get("url");
  if (!targetValue) return new Response("Missing form URL", { status: 400 });

  let target: URL;
  try {
    target = new URL(targetValue);
  } catch {
    return new Response("Invalid form URL", { status: 400 });
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  let publicOrigin = request.nextUrl.origin;
  if (host && protocol && (protocol === "http" || protocol === "https")) {
    try {
      publicOrigin = new URL(`${protocol}://${host}`).origin;
    } catch {
      return new Response("Invalid request host", { status: 400 });
    }
  }

  const match = FORM_PATH.exec(target.pathname);
  if (target.origin !== publicOrigin || !match || target.search || target.hash) {
    return new Response("Invalid form URL", { status: 400 });
  }

  const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
  qrUrl.searchParams.set("data", target.toString());
  qrUrl.searchParams.set("size", "900x900");
  qrUrl.searchParams.set("format", "png");
  qrUrl.searchParams.set("color", "181818");
  qrUrl.searchParams.set("bgcolor", "F4F1EA");
  qrUrl.searchParams.set("qzone", "4");

  try {
    const image = await fetch(qrUrl, { signal: AbortSignal.timeout(15000) });
    if (!image.ok || !image.headers.get("content-type")?.includes("image/png")) {
      return new Response("QR image service is unavailable", { status: 502 });
    }

    return new Response(await image.arrayBuffer(), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="dockett-form-${match[1]}.png"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("QR image service is unavailable", { status: 502 });
  }
}
