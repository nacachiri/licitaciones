import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import type { AppConfig, Tender } from "../config.js";
import { logger } from "../utils/logger.js";

const TEMPLATE_PATH = "src/templates/email.html";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBudget(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function rowTemplate(tender: Tender): string {
  const cpv = tender.cpv.length > 0 ? tender.cpv.join(", ") : "—";
  const deadline = tender.deadline ?? "—";

  return `
  <tr>
    <td style="padding:10px 8px;border-bottom:1px solid #e4e7eb;font-size:13px;color:#102a43;line-height:1.4;"><a href="${tender.url}" style="color:#1f6feb;text-decoration:none;font-weight:600;">${escapeHtml(tender.title)}</a></td>
    <td style="padding:10px 8px;border-bottom:1px solid #e4e7eb;font-size:12px;color:#52606d;line-height:1.4;">${escapeHtml(tender.agency)}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #e4e7eb;font-size:12px;color:#7b8794;white-space:nowrap;line-height:1.4;">${escapeHtml(cpv)}</td>
    <td align="right" style="padding:10px 8px;border-bottom:1px solid #e4e7eb;font-size:13px;color:#102a43;white-space:nowrap;line-height:1.4;">${formatBudget(tender.budget)}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #e4e7eb;font-size:13px;color:#52606d;white-space:nowrap;line-height:1.4;">${escapeHtml(deadline)}</td>
    <td align="center" style="padding:10px 8px;border-bottom:1px solid #e4e7eb;font-size:13px;line-height:1.4;"><a href="${tender.url}" style="color:#1f6feb;text-decoration:none;font-weight:600;white-space:nowrap;">Ver →</a></td>
  </tr>`;
}

function rowsHtml(tenders: Tender[]): string {
  if (tenders.length === 0) {
    return `
    <div style="padding:16px 20px;background-color:#f8fafc;border:1px solid #e4e7eb;border-radius:8px;font-size:14px;color:#52606d;line-height:1.5;">
      No se ha encontrado ninguna licitación nueva que cumpla los filtros configurados.
    </div>`;
  }

  const header = `
  <div style="overflow-x:auto;width:100%;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;min-width:560px;border-collapse:collapse;">
      <thead>
        <tr style="background-color:#f0f4f8;">
          <th align="left" style="padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#52606d;line-height:1.3;">Título</th>
          <th align="left" style="padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#52606d;line-height:1.3;">Organismo</th>
          <th align="left" style="padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#52606d;line-height:1.3;">CPV</th>
          <th align="right" style="padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#52606d;line-height:1.3;">Importe</th>
          <th align="left" style="padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#52606d;line-height:1.3;">Límite</th>
          <th align="center" style="padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#52606d;line-height:1.3;">Enlace</th>
        </tr>
      </thead>
      <tbody>${tenders.map(rowTemplate).join("")}</tbody>
    </table>
  </div>`;

  return header;
}

export class EmailService {
  constructor(private readonly appConfig: AppConfig) {}

  async send(tenders: Tender[], includeEmpty: boolean): Promise<void> {
    if (tenders.length === 0 && !includeEmpty) return;

    if (!this.appConfig.smtpHost || !this.appConfig.emailTo) {
      logger.warn("Configuración SMTP incompleta (SMTP_HOST o EMAIL_TO). Correo no enviado.");
      return;
    }

    const html = this.render(tenders);
    const subject = tenders.length > 0
      ? `TenderWatch: ${tenders.length} licitación(es) nuevas`
      : "TenderWatch: sin licitaciones nuevas hoy";

    const transporter = nodemailer.createTransport({
      host: this.appConfig.smtpHost,
      port: this.appConfig.smtpPort,
      secure: this.appConfig.smtpSecure,
      auth: {
        user: this.appConfig.smtpUser,
        pass: this.appConfig.smtpPass,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: this.appConfig.emailFrom,
        to: this.appConfig.emailTo,
        subject,
        html,
      });
      logger.info(`Correo enviado: ${info.messageId}`);
    } finally {
      transporter.close();
    }
  }

  private render(tenders: Tender[]): string {
    const template = readFileSync(TEMPLATE_PATH, "utf8");
    const date = new Date().toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return template
      .replace("{{DATE}}", date)
      .replace("{{COUNT}}", String(tenders.length))
      .replace("{{ROWS}}", rowsHtml(tenders));
  }
}