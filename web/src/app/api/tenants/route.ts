import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { z } from "zod";

const CreateTenantSchema = z.object({
  fullName: z.string().min(2),
  idNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
});

export async function GET() {
  const session = await requireSession();

  const tenants = await prisma.tenant.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ ok: true, tenants });
}

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);

  const parsed = CreateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const tenant = await prisma.tenant.create({
    data: {
      orgId: session.orgId,
      ...parsed.data,
    },
  });

  return Response.json({ ok: true, tenant });
}
