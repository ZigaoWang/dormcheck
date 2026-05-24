import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { students, devices, config, users } from "./schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = postgres(url);
  const db = drizzle(client);

  const houses = ["A", "B", "C", "D", "E", "F", "G", "H"];

  console.log("Seeding config (one per house)...");
  for (const h of houses) {
    await db
      .insert(config)
      .values({
        house: h,
        feverThreshold: 37.3,
        lateGraceMinutes: 5,
        morningStart: "06:30",
        morningEnd: "08:00",
        morningDeadlineJunior: "07:15",
        morningDeadlineSenior: "07:30",
        studyhallEnd: "19:15",
      })
      .onConflictDoNothing();
  }

  console.log("\nSeeding devices (one per house)...");
  for (const h of houses) {
    const apiKey = `dk_${crypto.randomBytes(24).toString("hex")}`;
    await db
      .insert(devices)
      .values({
        id: `pda-house-${h.toLowerCase()}`,
        name: `PDA House ${h}`,
        house: h,
        apiKey,
      })
      .onConflictDoNothing();
    console.log(`  House ${h} PDA: ${apiKey}`);
  }

  console.log("\nSeeding user accounts...");
  const passwordHash = await bcrypt.hash("admin123", 10);

  // Admin account (can see all houses)
  await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      email: "admin@tally.local",
      name: "Admin",
      passwordHash,
      house: null,
      isAdmin: true,
    })
    .onConflictDoNothing();
  console.log("  Admin: admin@tally.local / admin123 (all houses)");

  // One head-of-house account per house
  for (const h of houses) {
    await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: `house${h.toLowerCase()}@tally.local`,
        name: `Head of House ${h}`,
        passwordHash,
        house: h,
        isAdmin: false,
      })
      .onConflictDoNothing();
    console.log(`  House ${h}: house${h.toLowerCase()}@tally.local / admin123`);
  }

  console.log("\nSeed complete!");
  await client.end();
}

seed().catch(console.error);
