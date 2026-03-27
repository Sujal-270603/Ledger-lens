import { startAIProcessingWorker } from './ai-processing.worker';
import { logger } from '../common/logger/logger';
import { prisma } from '../database/db';

async function main() {
  logger.info('Starting AI Processing Worker...');

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — shutting down worker');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received — shutting down worker');
    process.exit(0);
  });

  try {
    await startAIProcessingWorker();
  } catch (error) {
    logger.error({ err: error }, 'Worker crashed');
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();