// Cryptographically secure random number in [0, 1)
export function secureRandom() {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] / (0xFFFFFFFF + 1)
}

// Secure random integer in [0, max)
export function secureRandomInt(max) {
  if (max <= 0) return 0
  // Rejection sampling to avoid modulo bias
  const limit = Math.floor(0x100000000 / max) * max
  let val
  do {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    val = arr[0]
  } while (val >= limit)
  return val % max
}

// Pick a random element from an array
export function pickRandom(arr) {
  if (arr.length === 0) return undefined
  return arr[secureRandomInt(arr.length)]
}

// Fisher-Yates shuffle (in-place, returns same array)
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
