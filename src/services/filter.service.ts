import type { Config, Tender } from "../config.js";

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

export class FilterService {
  constructor(private readonly config: Config) {}

  apply(tenders: Tender[]): Tender[] {
    const { config } = this;

    return tenders.filter((tender) => {
      const title = tender.title ?? "";

      if (config.keywords.length > 0 && !matchesAny(config.keywords, title)) return false;
      if (matchesAny(config.excludeKeywords, title)) return false;
      if (!matchesCpv(config.cpv, tender.cpv)) return false;
      if (!withinBudget(tender, config)) return false;
      if (!matchesLocation(config.provinces, tender.locations)) return false;
      if (!matchesLocation(config.regions, tender.locations)) return false;
      if (!matchesLocation(config.contractTypes, [tender.contractType ?? ""])) return false;
      if (!matchesLocation(config.contractingAuthorities, [tender.agency])) return false;

      return true;
    });
  }
}