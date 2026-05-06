import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!user.isAdmin && user.house !== student.house) {
    return NextResponse.json({ error: "Cannot bind students from another house" }, { status: 403 });
  }

  await db
    .update(students)
    .set({ uid })
    .where(eq(students.studentId, student_id));

  return NextResponse.json({ ok: true, student_id, uid });
}
