/**
 * POST /api/email/receive
 * Resend inbound email webhook handler.
 * Emails arrive here, get a UUID, and are broadcast to waiting SSE clients.
 *
 * Setup in Resend dashboard:
 *   Domains → your domain → Inbound → Webhook URL → this endpoint
 *
 * Optional: set WEBHOOK_SECRET in .env for signature validation.
 */

import { NextRequest, NextResponse } from "next/server"
import { broadcastToAddress } from "@/lib/sse-manager"
import { isOurDomain } from "@/lib/domains"

export async function POST(req: NextRequest) {
  // Optional webhook secret validation
  const secret = process.env.WEBHOOK_SECRET
  if (secret) {
    const sig = req.headers.get("x-resend-signature") ?? req.headers.get("x-webhook-secret")
    if (sig !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 })
  }

  // Resend wraps inbound emails in { type, data } or sends flat payload
  const payload = body.data ?? body

  const to: string[] = Array.isArray(payload.to) ? payload.to : [payload.to].filter(Boolean)
  const from: string = payload.from ?? "unknown@sender.com"
  const subject: string = payload.subject ?? "(no subject)"
  const html: string = payload.html ?? ""
  const text: string = payload.text ?? ""
  const attachments = (payload.attachments ?? []).map(
    (a: { filename?: string; content_type?: string; size?: number; content?: string }) => ({
      filename: a.filename ?? "attachment",
      mimeType: a.content_type ?? "application/octet-stream",
      size: a.size ?? 0,
      dataUrl: a.content
        ? `data:${a.content_type ?? "application/octet-stream"};base64,${a.content}`
        : "",
    })
  )

  const receivedAt = Date.now()
  const id = crypto.randomUUID()

  // Broadcast to all matching recipient addresses
  let delivered = 0
  for (const recipient of to) {
    const address = recipient.toLowerCase().split(/[<>]/)[1] ?? recipient.toLowerCase()

    if (!isOurDomain(address)) continue

    broadcastToAddress(address, {
      type: "email",
      email: {
        id,
        from,
        subject,
        html,
        text,
        receivedAt,
        attachments,
      },
    })
    delivered++
  }

  return NextResponse.json({ ok: true, delivered, id })
}
