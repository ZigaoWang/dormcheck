import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkins, students } from "@/lib/db/schema";
import { and, gte, lt, eq, desc, inArray } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const grade = url.searchParams.get("grade");
  const type = url.searchParams.get("type") as "morning" | "studyhall" | null;
  const requestedHouse = url.searchParams.get("house");
  const house = houseFilter(user, requestedHouse);

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
  }

  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T23:59:59.999");

  // Get active students in house with details
  const studentConditions = [eq(students.isActive, true)];
  if (house) studentConditions.push(eq(students.house, house));
  if (grade) studentConditions.push(eq(students.grade, parseInt(grade, 10)));

  const houseStudents = await db
    .select({
      studentId: students.studentId,
      name: students.name,
      grade: students.grade,
      house: students.house,
    })
    .from(students)
    .where(and(...studentConditions));

  const houseStudentIds = houseStudents.map((s) => s.studentId);

  if (houseStudentIds.length === 0) {
    return NextResponse.json({ checkins: [], students: [] });
  }

  const conditions = [
    gte(checkins.createdAt, startDate),
    lt(checkins.createdAt, endDate),
    inArray(checkins.studentId, houseStudentIds),
  ];
  if (type) conditions.push(eq(checkins.checkType, type));
  if (grade) conditions.push(eq(checkins.grade, parseInt(grade, 10)));

  const results = await db
    .select()
    .from(checkins)
    .where(and(...conditions))
    .orderBy(desc(checkins.createdAt))
    .limit(5000);

  return NextResponse.json({ checkins: results, students: houseStudents });
}
