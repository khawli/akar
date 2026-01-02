import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

export async function GET(req: Request) {
  const session = await requireSession();

  const url = new URL(req.url);
  const installmentId = url.searchParams.get("installmentId");
  if (!installmentId) {
    return Response.json({ ok: false, error: "MISSING_INSTALLMENT_ID" }, { status: 400 });
  }

  const docs = await prisma.document.findMany({
    where: { orgId: session.orgId, installmentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, pdfUrl: true, createdAt: true },
  });

  return Response.json({ ok: true, documents: docs });
}
