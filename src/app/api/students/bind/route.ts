import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("X-Device-API-Key");
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.apiKey, apiKey), eq(devices.isActive, true)))
    .limit(1);

  if (!device) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const { student_id, uid } = await req.json();

  if (!student_id || !uid) {
    return NextResponse.json({ error: "Missing student_id or uid" }, { status: 400 });
  }

  if (!/^\d{5}$/.test(student_id)) {
    return NextResponse.json({ error: "student_id must be 5 digits" }, { status: 400 });
  }

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, student_id))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await db
    .update(students)
    .set({ uid })
    .where(eq(students.studentId, student_id));

  return NextResponse.json({ ok: true, student_id, uid });
}
