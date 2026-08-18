import { parseBranchName } from '../lib/branchDisplay'
import Icon from './Icon'

/** Render a branch/ref name with `origin/` as a cloud and prefixes as icons. */
export default function BranchLabel({ name }: { name: string }) {
  const { origin, prefixIcon, text } = parseBranchName(name)
  return (
    <span className="branch-label">
      {origin && <Icon name="cloud" size={13} className="branch-label-icon" />}
      {prefixIcon && <Icon name={prefixIcon} size={13} className="branch-label-icon" />}
      <span className="branch-label-text">{text}</span>
    </span>
  )
}
