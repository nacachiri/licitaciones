import type { Config, Tender } from "../config.js";

const DEFAULT_STATUS = "PUB";

const PROCEDURE_TYPE_NAMES: Record<string, string> = {
  "1": "Abierto",
  "2": "Restringido",
  "3": "Negociado sin publicidad",
  "4": "Negociado con publicidad",
  "5": "Diálogo competitivo",
  "6": "Contrato menor",
  "7": "Derivado de acuerdo marco",
  "8": "Concurso de proyectos",
  "9": "Abierto simplificado",
  "10": "Asociación para la innovación",
  "11": "Derivado de asociación para la innovación",
  "12": "Basado en un sistema dinámico de adquisición",
  "13": "Licitación con negociación",
  "100": "Normas internas",
  "999": "Otros",
};

function normalizeName(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesProcedureType(list: string[], code: string | null): boolean {
  if (list.length === 0) return true;
  if (code === null) return false;
  const name = normalizeName(PROCEDURE_TYPE_NAMES[code] ?? "");
  return list.some((item) => {
    const needle = item.toLocaleLowerCase();
    return needle === code.toLocaleLowerCase() || (name.length > 0 && normalizeName(needle) === name);
  });
}

function matchesAny(list: string[], value: string): boolean {
  const needle = value.toLocaleLowerCase();
  return list.some((item) => needle.includes(item.toLocaleLowerCase()));
}

function matchesCpv(list: string[], tenderCpv: string[]): boolean {
  if (list.length === 0) return true;
  const configCpv = list.map((c) => c.replace(/\D/g, ""));
  return tenderCpv.some((cpv) =>
    configCpv.some((c) => cpv.startsWith(c)),
  );
}

function withinBudget(tender: Tender, config: Config): boolean {
  if (tender.budget === null) return true;
  if (tender.budget < config.minimumBudget) return false;
  if (config.maximumBudget !== null && tender.budget > config.maximumBudget) return false;
  return true;
}

function matchesLocation(list: string[], values: string[]): boolean {
  if (list.length === 0) return true;
  return values.some((value) =>
    list.some((item) => value.toLocaleLowerCase().includes(item.toLocaleLowerCase())),
  );
}

function matchesStatus(tender: Tender, statuses: string[]): boolean {
  if (statuses.length === 0) return tender.status === DEFAULT_STATUS;
  return statuses.some((s) => tender.status?.toUpperCase() === s.toUpperCase());
}

function matchesSince(tender: Tender, since: string | null): boolean {
  if (!since) return true;
  if (!tender.publishedAt) return false;
  return tender.publishedAt >= since;
}

export class FilterService {
  constructor(private readonly config: Config) {}

  apply(tenders: Tender[]): Tender[] {
    const { config } = this;

    return tenders.filter((tender) => {
      const title = tender.title ?? "";

      if (!matchesStatus(tender, config.statuses)) return false;
      if (!matchesSince(tender, config.since)) return false;
      if (config.keywords.length > 0 && !matchesAny(config.keywords, title)) return false;
      if (matchesAny(config.excludeKeywords, title)) return false;
      if (!matchesCpv(config.cpv, tender.cpv)) return false;
      if (!withinBudget(tender, config)) return false;
      if (!matchesLocation(config.provinces, tender.locations)) return false;
      if (!matchesLocation(config.regions, tender.locations)) return false;
      if (!matchesLocation(config.contractTypes, [tender.contractType ?? ""])) return false;
      if (!matchesProcedureType(config.procedureTypes, tender.procedureType)) return false;
      if (!matchesLocation(config.contractingAuthorities, [tender.agency])) return false;

      return true;
    });
  }
}