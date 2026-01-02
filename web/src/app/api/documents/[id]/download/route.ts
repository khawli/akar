import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: { id, orgId: session.orgId },
    select: { id: true, type: true, storagePath: true },
  });

  if (!doc || !doc.storagePath) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (!fs.existsSync(doc.storagePath)) {
    return Response.json({ ok: false, error: "FILE_MISSING" }, { status: 404 });
  }

  const buf = fs.readFileSync(doc.storagePath);
  const filename = `${doc.type}-${doc.id}.pdf`;

  return new Response(buf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, max-age=0, no-store",
    },
  });
}
