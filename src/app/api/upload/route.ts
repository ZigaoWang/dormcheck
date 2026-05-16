import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-device-api-key");
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: "Missing API key" }, { status: 401 });
  }

  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.apiKey, apiKey), eq(devices.isActive, true)))
    .limit(1);

  if (!device) {
    return NextResponse.json({ ok: false, message: "Invalid API key" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const studentId = formData.get("student_id") as string | null;

  if (!file) {
    return NextResponse.json({ ok: false, message: "Missing photo" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ ok: false, message: "Invalid file type. Use JPEG or PNG." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, message: "File too large. Max 5MB." }, { status: 400 });
  }

  const date = new Date().toISOString().split("T")[0];
  const timestamp = Date.now();
  const ext = file.type === "image/png" ? "png" : "jpg";
  const filename = `${studentId || "unknown"}_${timestamp}.${ext}`;

  const dir = join(process.cwd(), "uploads", "tech-handin", date);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);

  const url = `/api/upload/tech-handin/${date}/${filename}`;

  return NextResponse.json({ ok: true, url });
}
