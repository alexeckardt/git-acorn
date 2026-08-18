import { ReactNode, useState } from 'react'
import { buildRows } from '../lib/filetree'

interface Props<T> {
  items: T[]
  getPath: (t: T) => string
  /** Render a file leaf; `indent` is the left padding in px to apply. */
  renderFile: (item: T, indent: number) => ReactNode
}

const indentFor = (depth: number): number => 12 + depth * 13

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
          <div
            key={`d:${r.path}`}
            className="tree-folder"
            style={{ paddingLeft: indentFor(r.depth) }}
            onClick={() => toggle(r.path)}
            title={r.path}
          >
            <span className={`chevron${collapsed.has(r.path) ? ' collapsed' : ''}`}>▾</span>
            <span className="folder-name">{r.name}</span>
          </div>
        ) : (
          <div key={`f:${r.path}`}>{renderFile(r.item, indentFor(r.depth))}</div>
        )
      )}
    </>
  )
}
