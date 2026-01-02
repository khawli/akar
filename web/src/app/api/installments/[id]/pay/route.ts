import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await ctx.params;

  const inst = await prisma.rentInstallment.findFirst({
    where: { id, lease: { orgId: session.orgId } },
    include: { lease: true },
  });
  if (!inst) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const updated = await prisma.rentInstallment.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() },
  });

  return Response.json({ ok: true, installment: updated });
}
