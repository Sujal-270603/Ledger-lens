import { buildApp } from './app';
import { env } from './config/env';
import { prisma } from './database/db';
import { redis } from './database/redis';

import { startAIProcessingWorker } from './workers/ai-processing.worker';
import { documentsService } from './modules/documents/documents.service';

const start = async () => {
  const app = await buildApp();

  // Graceful Shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await app.close();
      await prisma.$disconnect();
      await redis.quit();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);

    // // Start background workers
    if (process.env.RUN_WORKER === 'true') {
      app.log.info('Starting AI processing worker alongside server...');

      // startAIProcessingWorker runs as an infinite async loop
      // It does NOT block the HTTP server
      // We wrap it in a self-restarting loop so if the worker crashes it auto-restarts
      const launchWorker = () => {
        startAIProcessingWorker().catch((err) => {
          app.log.error({ err }, 'AI worker crashed unexpectedly. Restarting in 5 seconds...');
          setTimeout(launchWorker, 5000);
        });
      };
      launchWorker();

      // Launch background cron interval to mark endlessly stalled documents as FAILED
      setInterval(() => {
        documentsService.markStaleDocumentsAsFailed().catch((err) => {
          app.log.error({ err }, 'Failed to execute stale document cron job in server interval.');
        });
      }, 2 * 60 * 1000); // 5 minutes

      app.log.info('AI processing worker started successfully');
    }

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
