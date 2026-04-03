import { startAIProcessingWorker } from './ai-processing.worker';
import { logger } from '../common/logger/logger';
import { prisma } from '../database/db';
import * as http from 'http';

async function main() {
  logger.info('Starting AI Processing Worker...');

  // --- Render Web Service Workaround ---
  // Render's "Web Service" type requires the process to bind to a port within a timeout.
  // Because this is a headless worker, we start a dummy HTTP server to satisfy the health check.
  const port = process.env.PORT || 10000;
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Worker is running\\n');
  });
  
  server.listen(port, () => {
    logger.info(`Dummy HTTP server listening on port ${port} to satisfy Render health checks`);
  });
  // -------------------------------------

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — shutting down worker');
    server.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received — shutting down worker');
    server.close();
    process.exit(0);
  });

  try {
    await startAIProcessingWorker();
  } catch (error) {
    logger.error({ err: error }, 'Worker crashed');
    await prisma.$disconnect();
    server.close();
    process.exit(1);
  }
}

main();