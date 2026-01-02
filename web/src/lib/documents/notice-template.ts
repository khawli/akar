type NoticeInput = {
  noticeNo: string;
  issuedAt: string; // YYYY-MM-DD
  landlordName: string;
  landlordAddress?: string;
  tenantName: string;
  tenantAddress?: string;
  propertyLabel: string;
  unitLabel: string;
  period: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  graceDays: number;
};

export function renderNoticeHtml(d: NoticeInput) {
  const deadline = (() => {
    const dt = new Date(`${d.issuedAt}T12:00:00.000Z`);
    dt.setUTCDate(dt.getUTCDate() + d.graceDays);
    return dt.toISOString().slice(0, 10);
  })();

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Mise en demeure ${d.noticeNo}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; line-height: 1.35; }
    h1 { margin:0; font-size:20px; }
    .muted { color:#444; font-size:12px; }
    .box { border:1px solid #222; padding:16px; border-radius:8px; margin-top:16px; }
    .row { display:flex; justify-content:space-between; gap:16px; }
    .k { font-weight:bold; }
    .sig { margin-top:48px; border-top:1px solid #222; padding-top:8px; width:320px; font-size:12px; }
  </style>
</head>
<body>
  <div class="row">
    <div>
      <h1>MISE EN DEMEURE DE PAYER</h1>
      <div class="muted">N° ${d.noticeNo} · Émise le ${d.issuedAt}</div>
    </div>
    <div class="muted" style="text-align:right">
      ${d.propertyLabel} — ${d.unitLabel}<br/>
      Période concernée: ${d.period}
    </div>
  </div>

  <div class="box">
    <div class="row">
      <div>
        <div class="k">Bailleur</div>
        <div>${d.landlordName}</div>
        ${d.landlordAddress ? `<div class="muted">${d.landlordAddress}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div class="k">Locataire</div>
        <div>${d.tenantName}</div>
        ${d.tenantAddress ? `<div class="muted">${d.tenantAddress}</div>` : ""}
      </div>
    </div>

    <div style="margin-top:14px">
      <p>
        Par la présente, je vous mets <span class="k">formellement en demeure</span> de procéder au règlement du loyer
        relatif à la période <span class="k">${d.period}</span>, échéance du <span class="k">${d.dueDate}</span>,
        pour un montant de <span class="k">${d.amount} ${d.currency}</span>.
      </p>

      <p>
        Vous disposez d’un délai de <span class="k">${d.graceDays} jours</span> à compter de la date d’émission
        de la présente pour régulariser, soit jusqu’au <span class="k">${deadline}</span>.
      </p>

      <p class="muted">
        À défaut de paiement dans le délai indiqué, le bailleur se réserve le droit d’engager toute procédure utile.
      </p>
    </div>
  </div>

  <div class="sig">Signature bailleur</div>

  <p class="muted" style="margin-top:24px">
    Document généré automatiquement. Version 1.0.
  </p>
</body>
</html>`;
}
