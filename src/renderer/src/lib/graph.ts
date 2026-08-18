import type { Commit } from '../../../shared/types'

export interface GraphLayout {
  /** Column (lane) each commit's node sits in. */
  colByHash: Map<string, number>
  /** Row index each commit sits in (its position in the input array). */
  rowByHash: Map<string, number>
  maxCol: number
}

/**
 * Assign each commit to a column using the classic lane-reservation algorithm.
 *
 * A parent hash reserves a column the moment a child first references it, and
 * keeps that column until the parent commit itself is reached. That invariant
 * lets edges be drawn purely from (childCol,childRow) -> (parentCol,parentRow).
 */
export function computeGraph(commits: Commit[]): GraphLayout {
  const colByHash = new Map<string, number>()
  const rowByHash = new Map<string, number>()
  const lanes: (string | null)[] = [] // reserved hash per column, or null if free
  let maxCol = 0

  const hashSet = new Set(commits.map((c) => c.hash))

  const firstFree = (): number => {
    for (let i = 0; i < lanes.length; i++) if (lanes[i] === null) return i
    lanes.push(null)
    return lanes.length - 1
  }

  commits.forEach((c, row) => {
    rowByHash.set(c.hash, row)

    let col = lanes.indexOf(c.hash)
    if (col === -1) {
      col = firstFree()
    }
    colByHash.set(c.hash, col)
    if (col > maxCol) maxCol = col

    // This commit consumes its lane; hand the lane down to its first parent
    // and open new lanes for any additional (merge) parents.
    lanes[col] = null
    const parents = c.parents.filter((p) => hashSet.has(p))
    parents.forEach((p, idx) => {
      if (lanes.indexOf(p) !== -1) return // already reserved by an earlier child
      if (idx === 0) {
        lanes[col] = p
      } else {
        lanes[firstFree()] = p
      }
    })
  })

  return { colByHash, rowByHash, maxCol }
}

/** A palette that repeats; column index picks the colour of a lane. */
export const LANE_COLORS = [
  '#4c9aff',
  '#f78c6c',
  '#c792ea',
  '#7fd1b9',
  '#f2c94c',
  '#eb5e7c',
  '#56c8d8',
  '#b0bec5'
]

export function laneColor(col: number): string {
  return LANE_COLORS[col % LANE_COLORS.length]
}
