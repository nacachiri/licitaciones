import cron from "node-cron";
import { loadAppConfig, loadConfig, type Tender } from "./config.js";
import { logger } from "./utils/logger.js";
import { TenderService } from "./services/tender.service.js";
import { FilterService } from "./services/filter.service.js";
import { StorageService } from "./services/storage.service.js";
import { EmailService } from "./services/email.service.js";

export async function runDailySearch(): Promise<void> {
  const startedAt = Date.now();
  logger.info("Inicio de la búsqueda diaria");

  try {
    const config = loadConfig();
    const appConfig = loadAppConfig();

    const tenderService = new TenderService(appConfig.apiBase);
    const filterService = new FilterService(config);
    const storage = new StorageService("seen_tenders.json");
    const email = new EmailService(appConfig);

    const downloaded = await tenderService.fetchTenders();
    logger.info(`Licitaciones descargadas: ${downloaded.length}`);

    const filtered = filterService.apply(downloaded);
    logger.info(`Licitaciones tras filtros: ${filtered.length}`);

    const seen = storage.loadProcessed();
    const fresh = filtered.filter((tender) => !seen.has(tender.id));
    logger.info(`Licitaciones nuevas (no enviadas antes): ${fresh.length}`);

    await email.send(fresh, config.sendEmailIfEmpty);

    storage.addProcessed(fresh.map((tender: Tender) => tender.id));
    logger.info(`Licitaciones enviadas/marcadas: ${fresh.length}`);
  } catch (error) {
    logger.error(`Error en la búsqueda diaria: ${(error as Error).message}`);
  } finally {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    logger.info(`Fin de la búsqueda (${elapsed}s)`);
  }
}

export function startScheduler(): void {
  const schedule = loadAppConfig().schedule;
  if (!cron.validate(schedule)) {
    logger.error(`Expresión cron inválida en SCHEDULE: "${schedule}"`);
    process.exit(1);
  }
  cron.schedule(schedule, () => {
    void runDailySearch();
  });
  logger.info(`Scheduler iniciado con cron: "${schedule}"`);
}

// Permite la ejecución manual: npm run run (--run)
if (process.argv.includes("--run")) {
  runDailySearch().then(() => process.exit(0));
} else {
  startScheduler();
  runDailySearch(); // ejecución inmediata al arrancar
}
