import { auth } from "@/lib/auth";

export interface SessionUser {
  house: string | null;
  isAdmin: boolean;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as unknown as Record<string, unknown>;
  return {
    house: (user.house as string) ?? null,
    isAdmin: (user.isAdmin as boolean) ?? false,
  };
}

export function houseFilter(sessionUser: SessionUser, requestedHouse?: string | null): string | null {
  if (sessionUser.isAdmin) {
    return requestedHouse ?? null;
  }
  return sessionUser.house;
}
