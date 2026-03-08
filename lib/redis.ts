/**
 * Poof — Redis Client
 * Singleton publisher + per-subscriber factory for SSE pub/sub.
 * Required for multi-instance deployments where the in-process Map can't
 * share state between the webhook handler and SSE stream instances.
 */

import Redis from "ioredis"

const url = process.env.REDIS_URL

if (!url) {
  throw new Error("REDIS_URL environment variable is not set")
}

// Singleton publisher — reused across requests
let _publisher: Redis | null = null

export function getPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(url!, { lazyConnect: false, maxRetriesPerRequest: null })
  }
  return _publisher
}

/** Create a fresh subscriber connection (each SSE client needs its own) */
export function createSubscriber(): Redis {
  return new Redis(url!, { lazyConnect: false, maxRetriesPerRequest: null })
}

export function emailChannel(address: string): string {
  return `poof:email:${address.toLowerCase()}`
}
