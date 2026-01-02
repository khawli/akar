import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const docsDir = process.env.DOCUMENTS_DIR || path.join(process.cwd(), "storage", "docs");

  try {
    const db = await prisma.$queryRaw`select now()`;
    fs.mkdirSync(docsDir, { recursive: true });
    fs.accessSync(docsDir, fs.constants.R_OK | fs.constants.W_OK);

    return Response.json({ ok: true, db, docsDir });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "HEALTH_ERROR" }, { status: 500 });
  }
}
