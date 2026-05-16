import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  const apiKey = req.headers.get("x-device-api-key");
  if (!apiKey) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.apiKey, apiKey), eq(devices.isActive, true)))
      .limit(1);
    if (!device) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const safePath = path.join("/").replace(/\.\./g, "");
  const filepath = join(process.cwd(), "uploads", safePath);

  try {
    await stat(filepath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await readFile(filepath);
  const ext = filepath.split(".").pop()?.toLowerCase();
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
