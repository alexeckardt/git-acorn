import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { addAcorns } from '../lib/acorns'
import foundImg from '../assets/found.png'

// One little pixel-art character hides at a single predetermined spot — which
// may be a seam in the main view, or tucked inside a specific modal/menu that
// you have to open to find it. It only moves (to a new random spot) when you
// catch it; tabbing away or refreshing never relocates it. The current spot and
// image persist across sessions.
//
// Drop new artwork (png/gif) into ../assets/critters and it joins the rotation.
const IMAGE_MAP = import.meta.glob('../assets/critters/*.{png,gif}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>
const IMAGES = Object.values(IMAGE_MAP)

const CRITTER = 34 // rendered size (px); source art is pixel-scaled up
const GRAVITY = 1500 // px/s², the "increasing vspeed"
const ACORN_LIFE = 1000 // ms before a dropped acorn fully fades
const FOUND_MS = 900 // "found!" image: ~0.5s hold, then ~0.4s fade-out

interface Projectile {
  id: number
  x: number
  y: number
  vx: number // constant horizontal speed
  vy: number // grows under gravity
  born: number
  age: number
}

type Pos = { left: number; top: number }

/** Viewport rect of a selector, or null when it's absent/invisible. */
function rectOf(sel: string): DOMRect | null {
  const el = document.querySelector(sel) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return null
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null
  return r
}

/** Whether any dimming modal backdrop is currently covering the app. */
function anyModalOpen(): boolean {
  for (const o of document.querySelectorAll('.modal-overlay')) {
    const el = o as HTMLElement
    const cs = getComputedStyle(el)
    if (cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetWidth > 0) return true
  }
  return false
}

/** Perch on a component's box: straddling its top-right corner, or just inside. */
function perch(sel: string, inside = false): Pos | null {
  const r = rectOf(sel)
  if (!r) return null
  return inside
    ? { left: r.right - CRITTER - 6, top: r.top + 3 }
    : { left: r.right - CRITTER - 8, top: r.top - CRITTER + 10 }
}

/** A main-view spot hides while a modal covers (and dims) the app. */
function main(fn: () => Pos | null): () => Pos | null {
  return () => (anyModalOpen() ? null : fn())
}

interface Spot {
  id: string
  resolve: () => Pos | null
}

// The full hiding-spot roster. A spot returns null whenever its component isn't
// on screen, so a critter tucked in (say) Preferences can't be found until you
// actually open Preferences.
const SPOTS: Spot[] = [
  // --- Main view seams -------------------------------------------------
  {
    id: 'titlebar',
    resolve: main(() => {
      const r = rectOf('.titlebar')
      return r ? { left: r.right - 220, top: r.bottom - CRITTER + 4 } : null
    })
  },
  {
    id: 'divider',
    resolve: main(() => {
      const r = rectOf('.divider')
      return r ? { left: r.left + r.width * 0.62, top: r.top - CRITTER + 3 } : null
    })
  },
  {
    id: 'graph-toolbar',
    resolve: main(() => {
      const r = rectOf('.graph-toolbar')
      return r ? { left: r.right - CRITTER - 12, top: r.top - CRITTER + 7 } : null
    })
  },
  {
    id: 'sidebar-seam',
    resolve: main(() => {
      const r = rectOf('.right-pane')
      return r ? { left: r.left - CRITTER / 2, top: r.top + 10 } : null
    })
  },
  {
    id: 'sidebar-bottom',
    resolve: main(() => {
      const r = rectOf('.sidebar')
      return r ? { left: r.left + 14, top: r.bottom - CRITTER - 76 } : null
    })
  },
  {
    id: 'welcome',
    resolve: () => {
      const r = rectOf('.welcome-card')
      return r ? { left: r.right - CRITTER, top: r.top - CRITTER + 8 } : null
    }
  },
  // --- Hidden inside specific components -------------------------------
  { id: 'preferences', resolve: () => perch('.prefs-modal') },
  { id: 'commit-wizard', resolve: () => perch('.wizard-modal') },
  { id: 'branch-modal', resolve: () => perch('.branch-modal') },
  { id: 'switch-repo', resolve: () => perch('.switch-repo-modal') },
  { id: 'small-modal', resolve: () => perch('.small-modal') },
  { id: 'context-menu', resolve: () => perch('.context-menu', true) }
]
const SPOT_IDS = new Set(SPOTS.map((s) => s.id))

interface Saved {
  spot: string
  img: number
}
const STORE_KEY = 'git-acorn.critter'

function randomSpot(exclude?: string): string {
  let id = SPOTS[(Math.random() * SPOTS.length) | 0].id
  if (SPOTS.length > 1 && exclude) {
    while (id === exclude) id = SPOTS[(Math.random() * SPOTS.length) | 0].id
  }
  return id
}
function randomImg(): number {
  return IMAGES.length ? (Math.random() * IMAGES.length) | 0 : 0
}
function loadSaved(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || '')
    if (s && SPOT_IDS.has(s.spot) && typeof s.img === 'number') return s
  } catch {
    /* fall through */
  }
  return { spot: randomSpot(), img: randomImg() }
}
function save(s: Saved): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

let nextId = 1

export default function CritterOverlay() {
  const saved = useRef<Saved>(loadSaved())
  const [critter, setCritter] = useState<Pos | null>(null)
  const [found, setFound] = useState(false)
  const foundRef = useRef(false)
  const projRef = useRef<Projectile[]>([])
  const [, force] = useReducer((x: number) => x + 1, 0)
  const loopRef = useRef<number | null>(null)

  // Recompute where (if anywhere) the current spot puts the critter. Frozen
  // while a "found!" animation is playing so the little guy stays put.
  const resolve = useCallback(() => {
    if (foundRef.current) return
    const spot = SPOTS.find((s) => s.id === saved.current.spot)
    const pos = spot ? spot.resolve() : null
    setCritter((prev) => {
      if (!pos) return prev === null ? prev : null
      if (prev && prev.left === pos.left && prev.top === pos.top) return prev
      return pos
    })
  }, [])

  // Re-resolve whenever the DOM changes (a modal/menu opening reveals the spot),
  // on resize, and on app refresh — but the spot itself never changes here.
  useEffect(() => {
    let raf = 0
    const schedule = (): void => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          resolve()
        })
    }
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })
    window.addEventListener('resize', schedule)
    window.addEventListener('critter:refresh', schedule)
    schedule()
    return () => {
      mo.disconnect()
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('critter:refresh', schedule)
      if (loopRef.current != null) cancelAnimationFrame(loopRef.current)
    }
  }, [resolve])

  function ensureLoop(): void {
    if (loopRef.current != null) return
    let last = performance.now()
    const step = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const H = window.innerHeight
      const W = window.innerWidth
      projRef.current = projRef.current
        .map((p) => {
          const vy = p.vy + GRAVITY * dt
          return { ...p, vy, x: p.x + p.vx * dt, y: p.y + vy * dt, age: now - p.born }
        })
        .filter((p) => p.age < ACORN_LIFE && p.y < H + 120 && p.x > -120 && p.x < W + 120)
      force()
      loopRef.current = projRef.current.length ? requestAnimationFrame(step) : null
    }
    loopRef.current = requestAnimationFrame(step)
  }

  function poke(e: React.MouseEvent): void {
    e.stopPropagation()
    if (!critter || foundRef.current) return
    const now = performance.now()
    // The acorn pops out of the little guy and falls away.
    projRef.current.push({
      id: nextId++,
      x: critter.left + CRITTER / 2 - 9,
      y: critter.top + CRITTER / 2 - 6,
      vx: (Math.random() - 0.5) * 150,
      vy: -150,
      born: now,
      age: 0
    })
    ensureLoop()
    addAcorns(1)
    // Flip to "found!", hold+fade, then move on to a fresh hiding spot.
    foundRef.current = true
    setFound(true)
    window.setTimeout(() => {
      saved.current = { spot: randomSpot(saved.current.spot), img: randomImg() }
      save(saved.current)
      foundRef.current = false
      setFound(false)
      resolve() // usually null now — hidden until you open its new home
    }, FOUND_MS)
  }

  const src = found ? foundImg : IMAGES[saved.current.img % Math.max(1, IMAGES.length)]

  return (
    <div className="critter-overlay">
      {critter && IMAGES.length > 0 && (
        <img
          className={`critter${found ? ' found' : ''}`}
          src={src}
          style={{ left: critter.left, top: critter.top, width: CRITTER, height: CRITTER }}
          onMouseDown={poke}
          draggable={false}
          alt=""
        />
      )}
      {projRef.current.map((p) => (
        <span
          key={p.id}
          className="critter-acorn"
          style={{
            transform: `translate(${p.x}px, ${p.y}px)`,
            opacity: Math.max(0, 1 - p.age / ACORN_LIFE)
          }}
        >
          🌰
        </span>
      ))}
    </div>
  )
}
