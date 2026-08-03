import { mkdirSync, appendFileSync } from "node:fs";

const LOG_DIR = "logs";

function logFile(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${LOG_DIR}/${y}${m}${day}.log`;
}

function timestamp(): string {
  return new Date().toLocaleString("es-ES", { hour12: false });
}

function write(level: string, message: string): void {
  const line = `[${timestamp()}] [${level}] ${message}`;
  console.log(line);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(logFile(), `${line}\n`);
  } catch {
    // El log en fichero no debe impedir continuar.
  }
}

export const logger = {
  info: (message: string) => write("INFO", message),
  warn: (message: string) => write("WARN", message),
  error: (message: string) => write("ERROR", message),
};