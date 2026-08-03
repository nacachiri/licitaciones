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

function formatDeadline(deadline: string): string {
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function cardTemplate(tender: Tender): string {
  const cpv = tender.cpv.length > 0 ? tender.cpv.join(", ") : "—";
  const deadline = tender.deadline ? formatDeadline(tender.deadline) : "—";
  const importe = formatBudget(tender.budget);
  const estimated = formatBudget(tender.estimatedAmount);
  const statusLabel = tender.status === "PUB" ? "Publicada" : tender.status ?? "—";
  const pubDate = tender.publishedAt ? formatDeadline(tender.publishedAt.slice(0, 10)) : "—";

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:12px;background-color:#ffffff;border:1px solid #e4e7eb;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:14px 16px 10px;font-size:14px;line-height:1.4;">
        <a href="${tender.url}" style="color:#1f6feb;text-decoration:none;font-weight:600;">${escapeHtml(tender.title)}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 16px 10px;font-size:12px;color:#52606d;line-height:1.4;">${escapeHtml(tender.agency)}</td>
    </tr>
    <tr>
      <td style="padding:0 16px 12px;font-size:12px;color:#7b8794;line-height:1.4;">
        CPV ${escapeHtml(cpv)} &middot; L&iacute;mite ${escapeHtml(deadline)}
      </td>
    </tr>
    <tr>
      <td style="padding:0 16px 12px;font-size:12px;color:#7b8794;line-height:1.4;">
        Presupuesto ${escapeHtml(importe)} &middot; Valor estimado ${escapeHtml(estimated)}
      </td>
    </tr>
    <tr>
      <td style="padding:0 16px 12px;font-size:12px;color:#7b8794;line-height:1.4;">
        L&iacute;mite: ${escapeHtml(deadline)} &middot; Estado: <strong>${escapeHtml(statusLabel)}</strong> &middot; Publicada: ${escapeHtml(pubDate)}
      </td>
    </tr>
    <tr>
      <td style="padding:0 16px 14px;">
        <a href="${tender.url}" style="display:inline-block;background-color:#1f6feb;color:#ffffff;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">Ver licitacion &rarr;</a>
      </td>
    </tr>
  </table>`;
}

function rowsHtml(tenders: Tender[]): string {
  if (tenders.length === 0) {
    return `
    <div style="padding:16px 20px;background-color:#f8fafc;border:1px solid #e4e7eb;border-radius:8px;font-size:14px;color:#52606d;line-height:1.5;">
      No se ha encontrado ninguna licitacion nueva que cumpla los filtros configurados.
    </div>`;
  }

  return tenders.map(cardTemplate).join("");
}

export class EmailService {
  constructor(private readonly appConfig: AppConfig) {}

  async send(tenders: Tender[], includeEmpty: boolean): Promise<void> {
    if (tenders.length === 0 && !includeEmpty) return;

    if (!this.appConfig.smtpHost || this.appConfig.emailTo.length === 0) {
      logger.warn("Configuración SMTP incompleta (SMTP_HOST o EMAIL_TO). Correo no enviado.");
      return;
    }

    const html = this.render(tenders);
    const subject = tenders.length > 0
      ? `Licitaciones: ${tenders.length} licitación(es) nuevas`
      : "Licitaciones: sin licitaciones nuevas hoy";

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