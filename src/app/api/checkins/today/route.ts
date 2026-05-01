import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkins, students } from "@/lib/db/schema";
import { eq, and, gte, lt, inArray, desc } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const type = url.searchParams.get("type") as "morning" | "studyhall" | null;
  const requestedHouse = url.searchParams.get("house");
  const house = houseFilter(user, requestedHouse);

  const dayStart = new Date(dateStr + "T00:00:00");
  const dayEnd = new Date(dateStr + "T23:59:59.999");

  const studentConditions = [eq(students.isActive, true)];
  if (house) studentConditions.push(eq(students.house, house));

  const houseStudents = await db
    .select()
    .from(students)
    .where(and(...studentConditions))
    .orderBy(students.grade, students.name);

  const houseStudentIds = houseStudents.map((s) => s.studentId);

  if (houseStudentIds.length === 0) {
    return NextResponse.json({ checkins: [], missing: [] });
  }

  const checkinConditions = [
    gte(checkins.createdAt, dayStart),
    lt(checkins.createdAt, dayEnd),
    inArray(checkins.studentId, houseStudentIds),
  ];
  if (type) checkinConditions.push(eq(checkins.checkType, type));

  const dayCheckins = await db
    .select()
    .from(checkins)
    .where(and(...checkinConditions))
    .orderBy(desc(checkins.createdAt));

  const checkedInIds = new Set(dayCheckins.map((c) => c.studentId));
  const missingStudents = houseStudents.filter((s) => !checkedInIds.has(s.studentId));

  return NextResponse.json({
    checkins: dayCheckins,
    missing: missingStudents,
  });
}
