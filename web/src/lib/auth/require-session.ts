import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/auth/session";

export async function requireSession() {
  const c = await cookies(); // Next 16: cookies() async
  const token = c.get(sessionCookieName())?.value;
  if (!token) throw new Error("UNAUTHORIZED");

  return verifySession(token); // { userId, orgId, email }
}
