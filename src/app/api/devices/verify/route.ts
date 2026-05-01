import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json();
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: "Missing API key" }, { status: 400 });
  }

  const [device] = await db
    .select({ id: devices.id, name: devices.name, house: devices.house })
    .from(devices)
    .where(and(eq(devices.apiKey, apiKey), eq(devices.isActive, true)))
    .limit(1);

  if (!device) {
    return NextResponse.json({ ok: false, message: "Invalid API key" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, device });
}
