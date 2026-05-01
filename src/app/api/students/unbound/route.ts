import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { isNull, eq, and } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const house = houseFilter(user);

  const conditions = [isNull(students.uid), eq(students.isActive, true)];
  if (house) conditions.push(eq(students.house, house));

  const unbound = await db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.grade, students.name);

  return NextResponse.json(unbound);
}
