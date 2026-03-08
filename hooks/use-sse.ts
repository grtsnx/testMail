"use client"

/**
 * FLARE SSE Hook
 * Keeps a persistent connection open so emails land instantly.
 * Your inbox. But fast. Disturbingly fast.
 */

import { useEffect, useRef, useCallback } from "react"
import { RawIncomingEmail } from "./use-email"

interface UseSSEOptions {
  address: string | null
  onEmail: (email: RawIncomingEmail) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export function useSSE({ address, onEmail, onConnected, onDisconnected }: UseSSEOptions) {
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMounted = useRef(true)

  const connect = useCallback(() => {
    if (!address || !isMounted.current) return

    const es = new EventSource(`/api/email/stream/${encodeURIComponent(address)}`)
    esRef.current = es

    es.onopen = () => {
      onConnected?.()
      // Clear any pending reconnect
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === "email") {
          onEmail(data.email as RawIncomingEmail)
        }
      } catch {
        // Malformed event — ignore
      }
    }

    es.onerror = () => {
      es.close()
      onDisconnected?.()
      // Auto-reconnect after 3s
      if (isMounted.current) {
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }
  }, [address, onEmail, onConnected, onDisconnected])

  useEffect(() => {
    isMounted.current = true
    connect()
    return () => {
      isMounted.current = false
      esRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])
}
