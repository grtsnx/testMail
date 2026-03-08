/**
 * NomBox Domain Config
 * One domain. Verified. Infinite food-flavored addresses.
 * Like a restaurant with unlimited fake names on the reservation list.
 */

/** Pull domain from env var or fall back to placeholder. Set NEXT_PUBLIC_EMAIL_DOMAIN in .env.local */
export function getDomain(): string {
  return process.env.NEXT_PUBLIC_EMAIL_DOMAIN?.trim() || "nombox.email"
}

/** Keep for compatibility with any code that calls getDomains() */
export function getDomains(): string[] {
  return [getDomain()]
}

export function isOurDomain(email: string): boolean {
  return email.split("@")[1]?.toLowerCase() === getDomain().toLowerCase()
}

// Food adjectives — the delicious prefix of your temporary identity
const FOOD_ADJECTIVES = [
  "crispy", "soggy", "burnt", "toasted", "smoked", "melted", "frozen",
  "grilled", "fried", "spicy", "cheesy", "crunchy", "gooey", "fluffy",
  "tangy", "zesty", "smoky", "brined", "glazed", "raw", "steamed",
  "stuffed", "battered", "caramelized", "sizzling", "buttered", "salted",
  "peppered", "saucy", "charred",
]

// Food nouns — because your email deserves a name with personality
const FOOD_NOUNS = [
  "ramen", "burrito", "taco", "waffle", "pancake", "dumpling", "croissant",
  "pretzel", "muffin", "donut", "churro", "nacho", "pierogi", "gyoza",
  "baguette", "calzone", "empanada", "falafel", "kimchi", "lasagna",
  "samosa", "risotto", "gnocchi", "tiramisu", "crepe", "brioche",
  "tempura", "udon", "stromboli", "shakshuka", "ceviche", "baklava",
  "poutine", "katsu", "galette",
]

export function generateUsername(): string {
  const adj = FOOD_ADJECTIVES[Math.floor(Math.random() * FOOD_ADJECTIVES.length)]
  const noun = FOOD_NOUNS[Math.floor(Math.random() * FOOD_NOUNS.length)]
  const num = Math.floor(Math.random() * 9000) + 1000   // 4-digit: 1000–9999
  return `${adj}${noun}${num}`
}

export function generateEmail(_domain?: string): string {
  return `${generateUsername()}@${getDomain()}`
}
