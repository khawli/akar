import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/auth/session";

export default async function Home() {
  const token = cookies().get(sessionCookieName())?.value;

  if (!token) redirect("/login");

  try {
    await verifySession(token);
    redirect("/app/dashboard");
  } catch {
    redirect("/login");
  }
}
