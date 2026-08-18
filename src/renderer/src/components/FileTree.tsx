import { ReactNode, useState } from 'react'
import { buildRows } from '../lib/filetree'

interface Props<T> {
  items: T[]
  getPath: (t: T) => string
  /** Render a file leaf; `indent` is the left padding in px to apply. */
  renderFile: (item: T, indent: number) => ReactNode
}

const BASE = 14
const STEP = 16
const indentFor = (depth: number): number => BASE + depth * STEP
// Guide line sits under the chevron/icon column of each ancestor folder.
const guideLeft = (level: number): number => BASE + level * STEP + 7

function Guides({ depth }: { depth: number }) {
  if (depth === 0) return null
  const lines = []
  for (let i = 0; i < depth; i++) {
    lines.push(<span key={i} className="tree-guide" style={{ left: guideLeft(i) }} />)
  }
  return <>{lines}</>
}

/** Lucide `folder` / `folder-open` outlined icons, inlined. */
function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="folder-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
        <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
      ) : (
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      )}
    </svg>
  )
}

export default function FileTree<T>({ items, getPath, renderFile }: Props<T>) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const rows = buildRows(items, getPath, collapsed)

  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <>
      {rows.map((r) =>
        r.kind === 'folder' ? (
          <div key={`d:${r.path}`} className="tree-row">
            <Guides depth={r.depth} />
            <div
              className="tree-folder"
              style={{ paddingLeft: indentFor(r.depth) }}
              onClick={() => toggle(r.path)}
              title={r.path}
            >
              <span className={`chevron${collapsed.has(r.path) ? ' collapsed' : ''}`}>▾</span>
              <FolderIcon open={!collapsed.has(r.path)} />
              <span className="folder-name">{r.name}</span>
            </div>
          </div>
        ) : (
          <div key={`f:${r.path}`} className="tree-row">
            <Guides depth={r.depth} />
            {renderFile(r.item, indentFor(r.depth))}
          </div>
        )
      )}
    </>
  )
}
