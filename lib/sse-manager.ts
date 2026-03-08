/**
 * FLARE SSE Manager
 * Server-side registry of live SSE connections.
 * Real-time email delivery — like telepathy, but with more HTTP headers.
 *
 * NOTE: This uses a global in-process Map. For multi-instance deployments,
 * swap for Redis pub/sub. For now: single server, zero regrets.
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>

// Global Map: email address -> Set of connected SSE controllers
const clients = new Map<string, Set<SSEController>>()

export function addClient(address: string, controller: SSEController): void {
  const key = address.toLowerCase()
  if (!clients.has(key)) clients.set(key, new Set())
  clients.get(key)!.add(controller)
}

export function removeClient(address: string, controller: SSEController): void {
  const key = address.toLowerCase()
  clients.get(key)?.delete(controller)
  if (clients.get(key)?.size === 0) clients.delete(key)
}

export function broadcastToAddress(address: string, data: object): void {
  const key = address.toLowerCase()
  const addressClients = clients.get(key)
  if (!addressClients || addressClients.size === 0) return

  const message = `data: ${JSON.stringify(data)}\n\n`
  const encoder = new TextEncoder()
  const encoded = encoder.encode(message)

  for (const controller of addressClients) {
    try {
      controller.enqueue(encoded)
    } catch {
      // Dead connection — remove it
      addressClients.delete(controller)
    }
  }
}

export function getConnectedCount(address: string): number {
  return clients.get(address.toLowerCase())?.size ?? 0
}
