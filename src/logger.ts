import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty', options: { colorize: true } },
});

// Transient network errors (e.g. grammY Happy Eyeballs AggregateError from a
// timer callback) should not crash the process — the library will retry.
const TRANSIENT_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);
function isTransientNetworkError(err: unknown): boolean {
  if (err instanceof AggregateError) {
    return (err as AggregateError & { code?: string }).code !== undefined ||
      (err.errors ?? []).every((e: unknown) =>
        e instanceof Error && TRANSIENT_CODES.has((e as NodeJS.ErrnoException).code ?? ''),
      );
  }
  return TRANSIENT_CODES.has((err as NodeJS.ErrnoException).code ?? '');
}

// Route uncaught errors through pino so they get timestamps in stderr
process.on('uncaughtException', (err) => {
  if (isTransientNetworkError(err)) {
    logger.warn({ err }, 'Transient network error (uncaught) — continuing');
    return;
  }
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
});
