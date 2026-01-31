// SpicyMatch brukernavn validation according to nda-rules.md
export function validateSmUsername(username: string): { valid: boolean; error?: string } {
  if (!username) {
    return { valid: false, error: 'SpicyMatch brukernavn er påkrevd' }
  }

  // Normalize
  const normalized = username.trim().toLowerCase()

  // Length check
  if (normalized.length < 3 || normalized.length > 32) {
    return { valid: false, error: 'SpicyMatch brukernavn må være 3–32 tegn' }
  }

  // Must start with letter
  if (!/^[a-z]/.test(normalized)) {
    return { valid: false, error: 'SpicyMatch brukernavn må starte med en bokstav (a–z)' }
  }

  // Allowed characters only
  if (!/^[a-z][a-z0-9._-]*$/.test(normalized)) {
    return { valid: false, error: 'Bruk kun bokstaver (a–z), tall, punktum, bindestrek eller underscore. Ingen mellomrom.' }
  }

  // No double separators
  if (/\.\./.test(normalized) || /--/.test(normalized) || /__/.test(normalized)) {
    return { valid: false, error: 'Ingen doble separatorer (.., --, __) tillatt' }
  }

  // Cannot end with separator
  if (/[._-]$/.test(normalized)) {
    return { valid: false, error: 'SpicyMatch brukernavn kan ikke slutte med punktum, bindestrek eller underscore' }
  }

  // Reserved usernames
  const reserved = ['admin', 'crew', 'guest', 'root', 'system', 'support', 'kiosk', 'test', 'null', 'staff', 'event', 'security']
  if (reserved.includes(normalized)) {
    return { valid: false, error: 'Dette SpicyMatch brukernavnet er reservert' }
  }

  return { valid: true }
}

export function normalizeSmUsername(username: string): string {
  return username.trim().toLowerCase()
}

// Phone validation - must be digits only, 8-15 chars (country code + number)
export function validatePhone(phone: string): { valid: boolean; error?: string; normalized?: string } {
  if (!phone) {
    return { valid: false, error: 'Mobilnummer er påkrevd' }
  }

  // Remove any spaces, dashes, or + signs for normalization
  const normalized = phone.replace(/[\s\-+]/g, '')

  // Must be digits only
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, error: 'Mobilnummer kan kun inneholde tall' }
  }

  // Length check (8-15 digits for international format)
  if (normalized.length < 8 || normalized.length > 15) {
    return { valid: false, error: 'Mobilnummer må være 8–15 siffer (inkl. landskode)' }
  }

  return { valid: true, normalized }
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-+]/g, '')
}
