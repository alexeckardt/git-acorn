// Text search over a diff2html-rendered DOM subtree. We can't search React state
// here — the diff is injected as HTML — so we walk the live text nodes, wrap
// matches in <mark>, and let the caller step through them.

const MARK_CLASS = 'diff-search-hit'

// Line-number gutters and file headers aren't code; skip them so a search for
// "12" doesn't light up every line number.
const SKIP_SELECTOR = '.d2h-code-linenumber, .d2h-code-side-linenumber, .d2h-file-header'

export type DiffScopes =
  | { split: false; single: HTMLElement[] }
  | { split: true; left: HTMLElement[]; right: HTMLElement[] }

/**
 * Resolve the searchable regions of a rendered diff. In split (side-by-side)
 * mode each file has two columns — left (old) and right (new) — so searching is
 * scoped per side; inline mode is a single region.
 */
export function getScopes(wrap: HTMLElement, split: boolean): DiffScopes {
  if (!split) return { split: false, single: [wrap] }
  const left: HTMLElement[] = []
  const right: HTMLElement[] = []
  wrap.querySelectorAll('.d2h-files-diff').forEach((fd) => {
    const sides = fd.querySelectorAll<HTMLElement>(':scope > .d2h-file-side-diff')
    if (sides[0]) left.push(sides[0])
    if (sides[1]) right.push(sides[1])
  })
  return { split: true, left, right }
}

/** Remove any highlight marks previously added within `root`. */
export function clearMarks(root: HTMLElement): void {
  root.querySelectorAll(`mark.${MARK_CLASS}`).forEach((m) => {
    m.replaceWith(document.createTextNode(m.textContent ?? ''))
  })
  // Re-join the text nodes we split, so subsequent searches see whole strings.
  root.normalize()
}

/**
 * Wrap every case-insensitive occurrence of `term` inside the given roots in a
 * <mark>, returning the marks in document order for navigation.
 */
export function applyMarks(roots: HTMLElement[], term: string): HTMLElement[] {
  const hits: HTMLElement[] = []
  const needle = term.toLowerCase()
  if (!needle) return hits

  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const v = node.nodeValue
        if (!v || !v.toLowerCase().includes(needle)) return NodeFilter.FILTER_REJECT
        if (node.parentElement?.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })

    const targets: Text[] = []
    let n: Node | null
    while ((n = walker.nextNode())) targets.push(n as Text)

    for (const tn of targets) {
      const text = tn.nodeValue as string
      const lower = text.toLowerCase()
      const frag = document.createDocumentFragment()
      let last = 0
      let idx = lower.indexOf(needle)
      while (idx !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)))
        const mark = document.createElement('mark')
        mark.className = MARK_CLASS
        mark.textContent = text.slice(idx, idx + term.length)
        frag.appendChild(mark)
        hits.push(mark)
        last = idx + term.length
        idx = lower.indexOf(needle, last)
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
      tn.parentNode?.replaceChild(frag, tn)
    }
  }
  return hits
}

/** Mark one hit as current (styled + scrolled into view), clearing the rest. */
export function focusHit(hits: HTMLElement[], index: number): void {
  hits.forEach((h, i) => h.classList.toggle('current', i === index))
  hits[index]?.scrollIntoView({ block: 'center', inline: 'nearest' })
}
