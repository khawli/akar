import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { renderNoticeHtml } from "@/lib/documents/notice-template";
import { chromium } from "playwright";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getDocumentsDir } from "@/lib/documents/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  installmentId: z.string().min(1),
  graceDays: z.number().int().min(1).max(60).optional(),
});

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const inst = await prisma.rentInstallment.findFirst({
    where: { id: parsed.data.installmentId, lease: { orgId: session.orgId } },
    include: {
      lease: { include: { tenant: true, unit: { include: { property: true } } } },
    },
  });

  if (!inst) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (inst.status !== "UNPAID") {
    return Response.json({ ok: false, error: "INSTALLMENT_NOT_UNPAID" }, { status: 409 });
  }

  // Idempotence: 1 notice per installment (storagePath)
  const existing = await prisma.document.findFirst({
    where: { orgId: session.orgId, installmentId: inst.id, type: "NOTICE" },
    select: { id: true, storagePath: true },
  });

  if (existing?.storagePath && fs.existsSync(existing.storagePath)) {
    const downloadUrl = `/api/documents/${existing.id}/download`;
    return Response.json({ ok: true, downloadUrl, document: { id: existing.id } });
  }

  const org = await prisma.organization.findUnique({ where: { id: session.orgId } });
  const landlordName = (org?.landlordProfileJson as any)?.name ?? session.email;
  const landlordAddress = (org?.landlordProfileJson as any)?.address ?? "";
  const landlordIdNumber = (org?.landlordProfileJson as any)?.idNumber ?? "";

  const noticeNo = `MD-${inst.period.replace("-", "")}-${inst.id.slice(-6).toUpperCase()}`;
  const issuedAt = ymd(new Date());
  const graceDays = parsed.data.graceDays ?? 8;

  const html = renderNoticeHtml({
    noticeNo,
    issuedAt,
    landlordName,
    landlordAddress,
    tenantName: inst.lease.tenant.fullName,
    tenantAddress: inst.lease.tenant.address ?? "",
    propertyLabel: inst.lease.unit.property.label,
    unitLabel: inst.lease.unit.label,
    period: inst.period,
    dueDate: ymd(inst.dueDate),
    amount: inst.amount,
    currency: inst.lease.currency,
    graceDays,
  });

  const outDir = getDocumentsDir();

  const filename = `${noticeNo}.pdf`;
  const filePath = path.join(outDir, filename);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: filePath, format: "A4", printBackground: true });
  await browser.close();

  const doc = existing
  ? await prisma.document.update({
      where: { id: existing.id },
      data: {
        version: "1.0",
        payloadJson: {
          noticeNo,
          installmentId: inst.id,
          leaseId: inst.leaseId,
          graceDays,
        },
        storagePath: filePath,
        leaseId: inst.leaseId,
        installmentId: inst.id,
      },
    })
  : await prisma.document.create({
      data: {
        orgId: session.orgId,
        type: "NOTICE",
        version: "1.0",
        payloadJson: {
          noticeNo,
          installmentId: inst.id,
          leaseId: inst.leaseId,
          graceDays,
        },
        storagePath: filePath,
        leaseId: inst.leaseId,
        installmentId: inst.id,
      },
    });

  const downloadUrl = `/api/documents/${doc.id}/download`;
  return Response.json({ ok: true, downloadUrl, document: doc });
}
