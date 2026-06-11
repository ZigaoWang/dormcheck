import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deviceExemptions, students } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id");
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const conditions = [
    lte(deviceExemptions.startDate, date),
    gte(deviceExemptions.endDate, date),
  ];
  if (studentId) conditions.push(eq(deviceExemptions.studentId, studentId));

  const rows = await db.select().from(deviceExemptions).where(and(...conditions));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, deviceType, startDate, endDate, note } = await req.json();

  if (!studentId || !deviceType || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!["phone", "laptop", "ipad"].includes(deviceType)) {
    return NextResponse.json({ error: "Invalid device type" }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
  }

  const [student] = await db.select().from(students).where(eq(students.studentId, studentId)).limit(1);
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (!user.isAdmin && student.house !== user.house) {
    return NextResponse.json({ error: "Cannot edit students from another house" }, { status: 403 });
  }

  const [row] = await db.insert(deviceExemptions).values({
    studentId,
    deviceType,
    startDate,
    endDate,
    note: note || null,
  }).returning();

  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const [existing] = await db.select().from(deviceExemptions).where(eq(deviceExemptions.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [student] = await db.select().from(students).where(eq(students.studentId, existing.studentId)).limit(1);
  if (!user.isAdmin && student && student.house !== user.house) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(deviceExemptions).where(eq(deviceExemptions.id, id));
  return NextResponse.json({ ok: true });
}
