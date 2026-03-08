/**
 * Poof — SSE Manager
 * Publishes email events via Redis pub/sub so any server instance
 * (webhook handler or SSE stream) can communicate regardless of where
 * the request lands. The SSE stream route subscribes directly via Redis.
 */

import { getPublisher, emailChannel } from "./redis"

export async function broadcastToAddress(address: string, data: object): Promise<void> {
  const publisher = getPublisher()
  await publisher.publish(emailChannel(address), JSON.stringify(data))
}
