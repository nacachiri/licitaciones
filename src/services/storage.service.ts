import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

interface SeenFile {
  processed: string[];
}

const DEFAULT_FILE: SeenFile = { processed: [] };

export class StorageService {
  constructor(private readonly filePath: string) {}

  loadProcessed(): Set<string> {
    if (!existsSync(this.filePath)) return new Set();

    try {
      const raw = readFileSync(this.filePath, "utf8");
      const data = JSON.parse(raw) as Partial<SeenFile>;
      return new Set(data.processed ?? []);
    } catch {
      return new Set();
    }
  }

  saveProcessed(ids: Set<string>): void {
    const dir = this.filePath.split("/").slice(0, -1).join("/");
    if (dir) mkdirSync(dir, { recursive: true });

    const data: SeenFile = { processed: [...ids] };
    writeFileSync(this.filePath, JSON.stringify(data, null, 4), "utf8");
  }

  /** Añade nuevos IDs al registro sin devolver nada. */
  addProcessed(ids: string[]): void {
    const processed = this.loadProcessed();
    for (const id of ids) processed.add(id);
    this.saveProcessed(processed);
  }
}