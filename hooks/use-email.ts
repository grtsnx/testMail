"use client"

/**
 * FLARE useEmail Hook
 * The brain of the operation. Manages your temp email lifecycle.
 * One email per computer. Like a social security number, but for chaos.
 */

import { useState, useEffect, useCallback } from "react"
import {
  DeviceConfig,
  StoredEmail,
  getDeviceConfig,
  saveDeviceConfig,
  getEmails,
  deleteAllEmailsForAddress,
  markEmailRead,
  deleteEmail,
  getUnreadCount,
} from "@/lib/db"
import { generateEmail } from "@/lib/domains"

export type BurnDuration = "10min" | "1hour" | "24hours" | "never"

const BURN_DURATIONS: Record<BurnDuration, number | null> = {
  "10min": 10 * 60 * 1000,
  "1hour": 60 * 60 * 1000,
  "24hours": 24 * 60 * 60 * 1000,
  never: null,
}

interface UseEmailReturn {
  config: DeviceConfig | null
  emails: StoredEmail[]
  selectedEmail: StoredEmail | null
  unreadCount: number
  isLoading: boolean
  isBurned: boolean
  generateNewEmail: (domain?: string) => Promise<void>
  setBurnDuration: (duration: BurnDuration) => Promise<void>
  selectEmail: (email: StoredEmail) => void
  removeEmail: (id: string) => Promise<void>
  burnNow: () => Promise<void>
  refreshEmails: () => Promise<void>
  addEmailFromSSE: (raw: RawIncomingEmail) => Promise<void>
}

export interface RawIncomingEmail {
  id: string
  from: string
  subject: string
  html: string
  text: string
  receivedAt: number
  attachments?: Array<{ filename: string; mimeType: string; size: number; dataUrl: string }>
}

export function useEmail(): UseEmailReturn {
  const [config, setConfig] = useState<DeviceConfig | null>(null)
  const [emails, setEmails] = useState<StoredEmail[]>([])
  const [selectedEmail, setSelectedEmail] = useState<StoredEmail | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isBurned, setIsBurned] = useState(false)

  const refreshEmails = useCallback(async () => {
    if (!config) return
    const list = await getEmails(config.email)
    setEmails(list)
    const count = await getUnreadCount(config.email)
    setUnreadCount(count)
  }, [config])

  // Check if the current address has burned
  const checkBurn = useCallback(
    (cfg: DeviceConfig) => {
      if (!cfg.burnAt) return false
      const burned = Date.now() > cfg.burnAt
      if (burned) setIsBurned(true)
      return burned
    },
    []
  )

  // Initialize: load or create device config
  useEffect(() => {
    const init = async () => {
      try {
        let cfg = await getDeviceConfig()

        if (!cfg) {
          cfg = await createConfig()
        } else if (cfg.burnAt && Date.now() > cfg.burnAt) {
          // Address burned — clear emails and generate new one
          await deleteAllEmailsForAddress(cfg.email)
          cfg = await createConfig()
        }

        setConfig(cfg)
        checkBurn(cfg)

        const list = await getEmails(cfg.email)
        setEmails(list)
        const count = await getUnreadCount(cfg.email)
        setUnreadCount(count)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [checkBurn])

  // Periodic burn check
  useEffect(() => {
    if (!config?.burnAt) return
    const interval = setInterval(() => {
      if (config.burnAt && Date.now() > config.burnAt) {
        setIsBurned(true)
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [config])

  const generateNewEmail = useCallback(async (domain?: string) => {
    setIsLoading(true)
    try {
      const current = await getDeviceConfig()
      if (current) await deleteAllEmailsForAddress(current.email)
      const cfg = await createConfig(domain)
      setConfig(cfg)
      setEmails([])
      setUnreadCount(0)
      setSelectedEmail(null)
      setIsBurned(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setBurnDuration = useCallback(async (duration: BurnDuration) => {
    if (!config) return
    const ms = BURN_DURATIONS[duration]
    const updated: DeviceConfig = {
      ...config,
      burnDuration: duration,
      burnAt: ms ? config.createdAt + ms : null,
    }
    await saveDeviceConfig(updated)
    setConfig(updated)
  }, [config])

  const selectEmail = useCallback(
    async (email: StoredEmail) => {
      setSelectedEmail(email)
      if (!email.read) {
        await markEmailRead(email.id)
        setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, read: true } : e)))
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    },
    []
  )

  const removeEmail = useCallback(async (id: string) => {
    await deleteEmail(id)
    setEmails((prev) => prev.filter((e) => e.id !== id))
    setSelectedEmail((prev) => (prev?.id === id ? null : prev))
  }, [])

  const burnNow = useCallback(async () => {
    if (!config) return
    await deleteAllEmailsForAddress(config.email)
    const updated: DeviceConfig = { ...config, burnAt: Date.now() - 1 }
    await saveDeviceConfig(updated)
    setConfig(updated)
    setIsBurned(true)
    setEmails([])
    setSelectedEmail(null)
  }, [config])

  const addEmailFromSSE = useCallback(
    async (raw: RawIncomingEmail) => {
      if (!config) return

      const { extractOTPs, extractVerifyLinks } = await import("@/lib/email-utils")
      const { saveEmail } = await import("@/lib/db")

      const otps = extractOTPs(raw.text || raw.html)
      const verifyLinks = extractVerifyLinks(raw.html)

      const stored = {
        id: raw.id,
        address: config.email.toLowerCase(),
        from: raw.from,
        subject: raw.subject,
        htmlContent: raw.html || `<p>${raw.text}</p>`,
        textContent: raw.text || "",
        receivedAt: raw.receivedAt,
        read: false,
        hasOtp: otps.length > 0,
        hasVerifyLink: verifyLinks.length > 0,
        attachments: (raw.attachments ?? []).map((a) => ({
          id: crypto.randomUUID(),
          ...a,
        })),
      }

      await saveEmail(stored)
      await refreshEmails()
    },
    [config, refreshEmails]
  )

  return {
    config,
    emails,
    selectedEmail,
    unreadCount,
    isLoading,
    isBurned,
    generateNewEmail,
    setBurnDuration,
    selectEmail: (email: StoredEmail) => {
      selectEmail(email)
    },
    removeEmail,
    burnNow,
    refreshEmails,
    addEmailFromSSE,
  }
}

async function createConfig(domain?: string): Promise<DeviceConfig> {
  const email = generateEmail(domain)
  const now = Date.now()
  const burnMs = BURN_DURATIONS["1hour"]
  const config: DeviceConfig = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    domain: email.split("@")[1],
    createdAt: now,
    burnAt: burnMs ? now + burnMs : null,
    burnDuration: "1hour",
  }
  await saveDeviceConfig(config)
  return config
}
