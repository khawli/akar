import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

export async function GET() {
  const session = await requireSession();

  const properties = await prisma.property.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "desc" },
    include: { units: true },
  });

  const tenants = await prisma.tenant.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ ok: true, properties, tenants });
}
