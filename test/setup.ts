import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * httpbin.org rejects body-echo traffic above 2 requests per second per IP.
 * Vitest runs each file in a fresh module environment, so the gap has to live
 * on disk to survive from one file to the next.
 *
 * @see {@link https://httpbin.org}
 */
const MIN_GAP_MS = 700;
const stampFile = path.join(os.tmpdir(), 'fetch-har-httpbin-rate-limit');

const originalFetch = globalThis.fetch.bind(globalThis);
let queue: Promise<void> = Promise.resolve();

function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function isHttpbin(input: Parameters<typeof fetch>[0]) {
  let url: string;
  if (input instanceof URL) url = input.href;
  else if (input instanceof Request) url = input.url;
  else url = String(input);

  return url.startsWith('https://httpbin.org/') || url.startsWith('http://httpbin.org/');
}

/**
 * A consumed stream cannot be sent again. Strings, blobs, and form data can.
 */
function canReplay(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) {
  if (input instanceof Request) return false;

  const body = init?.body;
  if (body == null) return true;
  if (typeof body === 'string') return true;
  if (body instanceof URLSearchParams || body instanceof Blob || body instanceof FormData) return true;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return true;

  return false;
}

function reserveSlot(minDelay = 0) {
  let last = 0;
  try {
    last = Number(fs.readFileSync(stampFile, 'utf8'));
  } catch {
    last = 0;
  }

  if (!Number.isFinite(last)) last = 0;

  const startAt = Math.max(Date.now() + minDelay, last + MIN_GAP_MS);
  fs.writeFileSync(stampFile, String(startAt));
  return Math.max(0, startAt - Date.now());
}

function enqueue<T>(task: () => Promise<T>) {
  const run = queue.then(async () => {
    await delay(reserveSlot());
    return task();
  });

  queue = run.then(
    () => {},
    () => {},
  );

  return run;
}

async function limitedFetch(args: Parameters<typeof fetch>, attempt = 0): Promise<Response> {
  if (attempt > 0) await delay(reserveSlot(1000));

  const response = await originalFetch(...args);
  if (response.status !== 429 || attempt >= 4 || !canReplay(args[0], args[1])) return response;

  // Mocked 429s, like the nock and fetch-mock tests, do not carry this body.
  const detail = await response.clone().text();
  if (!detail.includes('rate limit')) return response;

  return limitedFetch(args, attempt + 1);
}

globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
  if (!isHttpbin(args[0])) return originalFetch(...args);
  return enqueue(() => limitedFetch(args));
}) as typeof fetch;
