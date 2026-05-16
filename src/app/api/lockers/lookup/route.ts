import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lockers, devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
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

  const studentId = req.nextUrl.searchParams.get("student_id");
  if (!studentId) {
    return NextResponse.json({ ok: false, message: "Missing student_id" }, { status: 400 });
  }

  const [locker] = await db
    .select()
    .from(lockers)
    .where(eq(lockers.studentId, studentId))
    .limit(1);

  if (!locker) {
    return NextResponse.json({ ok: false, message: "No locker assigned" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    studentId: locker.studentId,
    hasPhone: locker.hasPhone,
    hasLaptop: locker.hasLaptop,
    hasIpad: locker.hasIpad,
  });
}
