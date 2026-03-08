/**
 * GET /api/email/stream/[address]
 * Server-Sent Events endpoint for real-time email delivery.
 * Your inbox, getting updates faster than your therapist responds.
 */

import { NextRequest } from "next/server"
import { addClient, removeClient } from "@/lib/sse-manager"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  const normalizedAddress = decodeURIComponent(address).toLowerCase()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial keepalive comment
      controller.enqueue(encoder.encode(": connected\n\n"))

      // Register this client
      addClient(normalizedAddress, controller)

      // Heartbeat every 25s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(heartbeat)
        }
      }, 25000)

      // Cleanup on client disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        removeClient(normalizedAddress, controller)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
