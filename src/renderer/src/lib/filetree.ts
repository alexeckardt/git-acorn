// Build a collapsible directory tree out of a flat list of paths.

export interface FolderRow {
  kind: 'folder'
  /** Display name — may be a compacted chain like "src/renderer". */
  name: string
  /** Full folder path (used as the collapse key). */
  path: string
  depth: number
}

export interface FileRowNode<T> {
  kind: 'file'
  name: string
  path: string
  depth: number
  item: T
}

export type FlatRow<T> = FolderRow | FileRowNode<T>

interface RawNode<T> {
  name: string
  path: string
  children: Map<string, RawNode<T>>
  item?: T
}

function insert<T>(root: Map<string, RawNode<T>>, item: T, path: string): void {
  const parts = path.split('/')
  let level = root
  let acc = ''
  parts.forEach((seg, i) => {
    acc = acc ? `${acc}/${seg}` : seg
    let node = level.get(seg)
    if (!node) {
      node = { name: seg, path: acc, children: new Map() }
      level.set(seg, node)
    }
    if (i === parts.length - 1) node.item = item
    level = node.children
  })
}

/** Collapse chains of single-child folders into one row (VSCode-style). */
function compact<T>(node: RawNode<T>): void {
  for (const child of node.children.values()) compact(child)
  while (node.children.size === 1 && node.item === undefined) {
    const only = [...node.children.values()][0]
    // Only merge when the sole child is itself a folder.
    if (only.children.size === 0 || only.item !== undefined) break
    node.name = `${node.name}/${only.name}`
    node.path = only.path
    node.children = only.children
  }
}

const isFolder = <T>(n: RawNode<T>): boolean => n.children.size > 0
const byName = <T>(a: RawNode<T>, b: RawNode<T>): number => a.name.localeCompare(b.name)

function flatten<T>(
  nodes: RawNode<T>[],
  depth: number,
  collapsed: Set<string>,
  out: FlatRow<T>[]
): void {
  const folders = nodes.filter(isFolder).sort(byName)
  const files = nodes.filter((n) => !isFolder(n)).sort(byName)
  for (const f of folders) {
    out.push({ kind: 'folder', name: f.name, path: f.path, depth })
    if (!collapsed.has(f.path)) {
      flatten([...f.children.values()], depth + 1, collapsed, out)
    }
  }
  for (const f of files) {
    out.push({ kind: 'file', name: f.name, path: f.path, depth, item: f.item as T })
  }
}

export function buildRows<T>(
  items: T[],
  getPath: (t: T) => string,
  collapsed: Set<string>
): FlatRow<T>[] {
  const root = new Map<string, RawNode<T>>()
  for (const it of items) insert(root, it, getPath(it))
  const roots = [...root.values()]
  roots.forEach(compact)
  const out: FlatRow<T>[] = []
  flatten(roots, 0, collapsed, out)
  return out
}
