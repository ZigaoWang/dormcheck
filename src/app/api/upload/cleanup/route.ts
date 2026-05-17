import { NextRequest, NextResponse } from "next/server";
import { readdir, rm, stat } from "fs/promises";
import { join } from "path";

const RETENTION_DAYS = 30;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uploadsDir = join(process.cwd(), "uploads", "tech-handin");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  let deleted = 0;

  try {
    const dirs = await readdir(uploadsDir);
    for (const dir of dirs) {
      const match = dir.match(/^(\d{4}-\d{2}-\d{2})$/);
      if (!match) continue;

      const dirDate = new Date(match[1] + "T00:00:00");
      if (dirDate < cutoff) {
        await rm(join(uploadsDir, dir), { recursive: true });
        deleted++;
      }
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  return NextResponse.json({ ok: true, deleted, retention_days: RETENTION_DAYS });
}
