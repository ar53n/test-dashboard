export const BACKOFF_BASE_MS = 1_000
export const BACKOFF_MAX_MS = 30_000

/**
 * Экспоненциальный backoff с «equal jitter»: задержка случайна в [cap/2, cap],
 * где cap = min(max, base·2ⁿ). Половина задержки гарантирована — интервалы растут
 * от попытки к попытке; случайная половина разносит переподключения клиентов после
 * рестарта сервера, чтобы они не пришли одной волной.
 *
 * @param attempt номер повтора, начиная с 0
 */
export function getBackoffDelay(attempt: number, random: () => number = Math.random): number {
  const cap = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt))
  return Math.round(cap / 2 + random() * (cap / 2))
}
