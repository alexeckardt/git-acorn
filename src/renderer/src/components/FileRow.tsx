import type { ChangedFile } from '../../../shared/types'
import { splitPath, statusBadge } from '../lib/util'

interface Action {
  label: string
  title: string
  onClick: () => void
  danger?: boolean
}

interface Props {
  file: ChangedFile
  selected: boolean
  onSelect: () => void
  actions?: Action[]
  /** Left padding in px (used for tree indentation). */
  indent?: number
  /** Show only the filename, not the directory prefix (for tree mode). */
  nameOnly?: boolean
}

export default function FileRow({
  file,
  selected,
  onSelect,
  actions = [],
  indent,
  nameOnly
}: Props) {
  const badge = statusBadge(file.status)
  const { dir, name } = splitPath(file.path)
  return (
    <div
      className={`file-row${selected ? ' selected' : ''}`}
      style={indent != null ? { paddingLeft: indent } : undefined}
      onClick={onSelect}
      title={file.path}
    >
      <span className={`status-badge ${badge.cls}`}>{badge.letter}</span>
      <span className="file-path">
        {!nameOnly && dir && <span className="file-dir">{dir}</span>}
        <span className="file-name">{name}</span>
      </span>
      <span className="file-actions" onClick={(e) => e.stopPropagation()}>
        {actions.map((a) => (
          <button
            key={a.label}
            className={`icon-btn${a.danger ? ' danger' : ''}`}
            title={a.title}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
      </span>
    </div>
  )
}
