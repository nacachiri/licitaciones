import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import type { Tender } from "../config.js";

const parser: XMLParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  isArray: (tag, _jpath, _isLeaf) => ["entry", "link", "RequiredCommodityClassification"].includes(tag),
});

type Obj = Record<string, unknown>;

function asArray(value: unknown): Obj[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? (value as Obj[]) : [value as Obj];
}

function first(value: unknown): Obj | undefined {
  const list = asArray(value);
  return list.length > 0 ? list[0] : undefined;
}

function textContent(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const v = value as Obj;
    if ("#text" in v) return String(v["#text"]);
    if ("@_value" in v) return String(v["@_value"]);
  }
  return undefined;
}

function hrefOf(value: unknown): string | undefined {
  const obj = first(value);
  if (!obj) return undefined;
  const href = obj["@_href"];
  return href === undefined ? undefined : String(href);
}

function normalizeCpv(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.padStart(8, "0");
}

function partyDisplayName(node: Obj | undefined): string | undefined {
  if (!node) return undefined;
  const partyName = first(node["PartyName"]);
  const name = partyName ? textContent(partyName["Name"]) : undefined;
  if (name) return name;
  const direct = textContent(node["Name"]);
  if (direct) return direct;
  const party = first(node["Party"]);
  return party ? partyDisplayName(party) : undefined;
}

function extractLocations(located: Obj | undefined): string[] {
  const names: string[] = [];

  const city = textContent(
    (first(located?.["Party"])?.["PostalAddress"] as Obj | undefined)?.["CityName"],
  );
  if (city) names.push(city);

  let parent = first(located?.["ParentLocatedParty"]);
  while (parent) {
    const name = partyDisplayName(parent);
    if (name) names.push(name);
    parent = first(parent["ParentLocatedParty"]);
  }

  return names;
}

function extractCpv(procurement: Obj | undefined): string[] {
  const nodes = asArray(procurement?.["RequiredCommodityClassification"]);
  const codes: string[] = [];
  for (const node of nodes) {
    const raw = textContent(node["ItemClassificationCode"]);
    if (raw) codes.push(normalizeCpv(raw));
  }
  return [...new Set(codes)];
}

function extractBudget(procurement: Obj | undefined): number | null {
  const budget = first(procurement?.["BudgetAmount"]);
  if (!budget) return null;
  const raw = textContent(budget["TaxExclusiveAmount"])
    ?? textContent(budget["EstimatedOverallContractAmount"])
    ?? textContent(budget["TotalAmount"]);
  if (raw === undefined) return null;
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function extractEstimatedAmount(procurement: Obj | undefined): number | null {
  const budget = first(procurement?.["BudgetAmount"]);
  if (!budget) return null;
  const raw = textContent(budget["EstimatedOverallContractAmount"])
    ?? textContent(budget["TotalAmount"])
    ?? textContent(budget["TaxExclusiveAmount"]);
  if (raw === undefined) return null;
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function entryUrl(entry: Obj): string {
  const links = asArray(entry["link"]);
  for (const link of links) {
    const href = link["@_href"];
    if (href !== undefined) return String(href);
  }
  return "";
}

function nextLink(feed: Obj | undefined): string | undefined {
  const links = asArray(feed?.["link"]);
  for (const link of links) {
    if (link["@_rel"] === "next") {
      const href = link["@_href"];
      if (href !== undefined) return String(href);
    }
  }
  return undefined;
}

function mapEntry(entry: Obj): Tender | null {
  const folderStatus = first(entry["ContractFolderStatus"]);
  if (!folderStatus) return null;

  const status = textContent(folderStatus["ContractFolderStatusCode"]);

  const idRaw = textContent(entry["id"]);
  const id = idRaw?.split("/").pop() ?? null;
  if (!id) return null;

  const located = first(folderStatus["LocatedContractingParty"]);
  const procurement = first(folderStatus["ProcurementProject"]);
  const tenderingProcess = first(folderStatus["TenderingProcess"]);

  const deadlineInfo = tenderingProcess ? first(tenderingProcess["TenderSubmissionDeadlinePeriod"]) : undefined;
  const deadlineRaw = deadlineInfo ? textContent(deadlineInfo["EndDate"]) : undefined;
  const deadline = deadlineRaw && !Number.isNaN(new Date(deadlineRaw).getTime())
    ? new Date(deadlineRaw).toISOString().slice(0, 10)
    : null;

  const title = textContent(entry["title"])
    ?? textContent(procurement?.["Name"])
    ?? "(Sin título)";

  const locations = extractLocations(located);

  const publishedRaw = entry["updated"];
  const publishedAt = publishedRaw && !Number.isNaN(new Date(String(publishedRaw)).getTime())
    ? new Date(String(publishedRaw)).toISOString()
    : null;

  return {
    id,
    title,
    url: entryUrl(entry),
    contractFolderId: textContent(folderStatus["ContractFolderID"]) ?? "",
    agency: partyDisplayName(located) ?? "",
    cpv: extractCpv(procurement),
    budget: extractBudget(procurement),
    estimatedAmount: extractEstimatedAmount(procurement),
    deadline,
    locations,
    status: status ?? null,
    contractType: textContent(procurement?.["TypeCode"]) ?? null,
    publishedAt,
  };
}

export class TenderService {
  constructor(
    private readonly apiBase: string,
    private readonly maxPages: number = 20,
  ) {}

  async fetchTenders(): Promise<Tender[]> {
    const tenders: Tender[] = [];
    const seenPages = new Set<string>();

    let url: string | undefined = this.apiBase;
    let pages = 0;

    while (url && pages < this.maxPages) {
      if (seenPages.has(url)) break;
      seenPages.add(url);

      const xml = await this.fetchPage(url);
      const doc = parser.parse(xml) as Obj;
      const feed = doc["feed"] as Obj | undefined;
      const entries = asArray(feed?.["entry"]);

      for (const entry of entries) {
        const tender = mapEntry(entry);
        if (tender) tenders.push(tender);
      }

      url = nextLink(feed);
      pages += 1;

      if (url) await this.delay(500);
    }

    return tenders;
  }

  private async fetchPage(url: string): Promise<string> {
    const response = await axios.get<string>(url, {
      responseType: "text",
      timeout: 180000,
      maxContentLength: 50 * 1024 * 1024,
      headers: { Accept: "application/atom+xml" },
    });
    return response.data;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}