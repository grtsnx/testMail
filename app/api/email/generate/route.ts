/**
 * POST /api/email/generate
 * Returns a fresh email address. One per request.
 * Like a fortune cookie, but with less wisdom and more spam protection.
 */

import { NextRequest, NextResponse } from "next/server"
import { generateEmail, getDomains } from "@/lib/domains"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const domain = typeof body.domain === "string" ? body.domain : undefined

  const availableDomains = getDomains()

  // Validate domain if provided
  if (domain && !availableDomains.includes(domain)) {
    return NextResponse.json({ error: "Invalid domain. Nice try." }, { status: 400 })
  }

  const email = generateEmail(domain)

  return NextResponse.json({
    email: email.toLowerCase(),
    domain: email.split("@")[1],
    availableDomains,
    generatedAt: Date.now(),
  })
}
