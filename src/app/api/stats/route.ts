import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkins, students } from "@/lib/db/schema";
import { eq, and, gte, lt, count, inArray } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const requestedHouse = url.searchParams.get("house");
  const house = houseFilter(user, requestedHouse);

  const dayStart = new Date(dateStr + "T00:00:00");
  const dayEnd = new Date(dateStr + "T23:59:59.999");

  const studentConditions = [eq(students.isActive, true)];
  if (house) studentConditions.push(eq(students.house, house));

  const [totalStudents] = await db
    .select({ count: count() })
    .from(students)
    .where(and(...studentConditions));

  const total = totalStudents.count;

  const houseStudents = await db
    .select({ studentId: students.studentId })
    .from(students)
    .where(and(...studentConditions));

  const houseStudentIds = houseStudents.map((s) => s.studentId);

  if (houseStudentIds.length === 0) {
    const empty = { checkedIn: 0, late: 0, fever: 0, absent: 0 };
    return NextResponse.json({
      date: dateStr,
      totalStudents: 0,
      morning: empty,
      studyhall: empty,
      all: empty,
    });
  }

  const dayCheckins = await db
    .select()
    .from(checkins)
    .where(
      and(
        gte(checkins.createdAt, dayStart),
        lt(checkins.createdAt, dayEnd),
        inArray(checkins.studentId, houseStudentIds),
      )
    );

  const byType = (type: string) => dayCheckins.filter((c) => c.checkType === type);
  const stats = (list: typeof dayCheckins) => ({
    checkedIn: list.length,
    late: list.filter((c) => c.isLate).length,
    fever: list.filter((c) => c.isFever).length,
    absent: total - new Set(list.map((c) => c.studentId)).size,
  });

  return NextResponse.json({
    date: dateStr,
    totalStudents: total,
    morning: stats(byType("morning")),
    studyhall: stats(byType("studyhall")),
    all: stats(dayCheckins),
  });
}
