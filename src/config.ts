import { readFileSync } from "node:fs";
import "dotenv/config";

export interface Tender {
  id: string;
  title: string;
  url: string;
  contractFolderId: string;
  agency: string;
  cpv: string[];
  budget: number | null;
  estimatedAmount: number | null;
  deadline: string | null;
  locations: string[];
  status: string | null;
  contractType: string | null;
  procedureType: string | null;
  publishedAt: string | null;
}

export interface Config {
  cpv: string[];
  keywords: string[];
  excludeKeywords: string[];
  minimumBudget: number;
  maximumBudget: number | null;
  regions: string[];
  provinces: string[];
  excludeRegions: string[];
  contractTypes: string[];
  procedureTypes: string[];
  contractingAuthorities: string[];
  statuses: string[];
  since: string | null;
  maxPages: number;
  sendEmailIfEmpty: boolean;
}

export interface AppConfig {
  apiBase: string;
  schedule: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  emailTo: string[];
}

export const CONFIG_PATH = process.env.CONFIG_FILE ?? "configs/javier.json";

export function loadConfig(): Config {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      cpv: parsed.cpv ?? [],
      keywords: parsed.keywords ?? [],
      excludeKeywords: parsed.excludeKeywords ?? [],
      minimumBudget: parsed.minimumBudget ?? 0,
      maximumBudget: parsed.maximumBudget ?? null,
      regions: parsed.regions ?? [],
      provinces: parsed.provinces ?? [],
      excludeRegions: parsed.excludeRegions ?? [],
      contractTypes: parsed.contractTypes ?? [],
      procedureTypes: parsed.procedureTypes ?? [],
      contractingAuthorities: parsed.contractingAuthorities ?? [],
      statuses: parsed.statuses ?? [],
      since: parsed.since ?? null,
      maxPages: parsed.maxPages ?? 20,
      sendEmailIfEmpty: parsed.sendEmailIfEmpty ?? true,
    };
  } catch (error) {
    throw new Error(`No se pudo leer config.json: ${(error as Error).message}`);
  }
}

export function loadAppConfig(): AppConfig {
  return {
    apiBase:
      process.env.API_BASE ??
      "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom",
    schedule: process.env.SCHEDULE ?? "0 8 * * *",
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpSecure: (process.env.SMTP_SECURE ?? "false") === "true",
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",
    emailFrom: process.env.EMAIL_FROM ?? "",
    emailTo: (process.env.EMAIL_TO ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  };
}