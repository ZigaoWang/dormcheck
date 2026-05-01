import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkins, students, devices, config } from "@/lib/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { sse } from "@/lib/sse";

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

  const body = await req.json();
  const { uid, student_id, temperature, check_type, device_id, client_timestamp } = body;

  if (!uid && !student_id) {
    return NextResponse.json(
      { ok: false, message: "Missing uid or student_id" },
      { status: 400 }
    );
  }

  if (!check_type) {
    return NextResponse.json(
      { ok: false, message: "Missing check_type" },
      { status: 400 }
    );
  }

  if (!["morning", "evening", "studyhall"].includes(check_type)) {
    return NextResponse.json(
      { ok: false, message: "Invalid check_type" },
      { status: 400 }
    );
  }

  let student;
  if (student_id) {
    const [s] = await db
      .select()
      .from(students)
      .where(eq(students.studentId, student_id))
      .limit(1);
    student = s;
  } else {
    const [s] = await db
      .select()
      .from(students)
      .where(eq(students.uid, uid))
      .limit(1);
    student = s;
  }

  if (!student) {
    return NextResponse.json(
      { ok: false, message: student_id ? "Student not found" : "Unknown card. Student not bound.", uid },
      { status: 404 }
    );
  }

  // Auto-bind: if we looked up by student_id and a uid was provided, bind it
  if (student_id && uid && !student.uid) {
    await db
      .update(students)
      .set({ uid })
      .where(eq(students.studentId, student_id));
  }

  const [cfg] = await db.select().from(config).where(eq(config.house, student.house)).limit(1);
  const feverThreshold = cfg?.feverThreshold ?? 37.3;
  const graceMinutes = cfg?.lateGraceMinutes ?? 5;

  const isFever = temperature != null && temperature >= feverThreshold;

  let isLate = false;
  const now = client_timestamp ? new Date(client_timestamp) : new Date();

  if (check_type === "morning") {
    const deadlineStr = student.grade <= 10
      ? (cfg?.morningDeadlineJunior ?? "07:15")
      : (cfg?.morningDeadlineSenior ?? "07:30");
    const [h, m] = deadlineStr.split(":").map(Number);
    const deadline = new Date(now);
    deadline.setHours(h, m + graceMinutes, 0, 0);
    isLate = now > deadline;
  }

  if (check_type === "studyhall") {
    const studyhallEnd = cfg?.studyhallEnd ?? "19:15";
    const [h, m] = studyhallEnd.split(":").map(Number);
    const deadline = new Date(now);
    deadline.setHours(h, m, 0, 0);
    isLate = now > deadline;
  }

  // One check-in per student per type per day — update if exists
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const [existing] = await db
    .select({ id: checkins.id })
    .from(checkins)
    .where(
      and(
        eq(checkins.studentId, student.studentId),
        eq(checkins.checkType, check_type),
        gte(checkins.createdAt, dayStart),
        lt(checkins.createdAt, new Date(dayEnd.getTime() + 1)),
      )
    )
    .limit(1);

  let row;
  if (existing) {
    const [updated] = await db
      .update(checkins)
      .set({
        uid: uid ?? student.uid,
        temperature: temperature ?? null,
        isLate,
        isFever,
        deviceId: device_id ?? device.id,
        createdAt: now,
      })
      .where(eq(checkins.id, existing.id))
      .returning();
    row = updated;
  } else {
    const [inserted] = await db
      .insert(checkins)
      .values({
        studentId: student.studentId,
        uid: uid ?? student.uid,
        name: student.name,
        grade: student.grade,
        temperature: temperature ?? null,
        checkType: check_type,
        isLate,
        isFever,
        deviceId: device_id ?? device.id,
        createdAt: now,
      })
      .returning();
    row = inserted;
  }

  await db
    .update(devices)
    .set({ lastSeen: new Date() })
    .where(eq(devices.id, device.id));

  sse.broadcast("checkin", {
    id: row.id,
    studentId: row.studentId,
    name: row.name,
    grade: row.grade,
    house: student.house,
    temperature: row.temperature,
    checkType: row.checkType,
    isLate: row.isLate,
    isFever: row.isFever,
    createdAt: row.createdAt,
  });

  const statusMsg = isFever
    ? "High temperature detected"
    : isLate
      ? "Late check-in"
      : "OK";

  return NextResponse.json({
    ok: true,
    student_id: student.studentId,
    name: student.name,
    grade: student.grade,
    is_late: isLate,
    is_fever: isFever,
    is_update: !!existing,
    message: existing ? `${statusMsg} (updated)` : statusMsg,
  });
}
