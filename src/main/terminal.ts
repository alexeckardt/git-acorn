import { spawn, ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { getRepoPath } from './git'

// A lightweight shell session: each command runs in a fresh shell that starts
// in the tracked working directory and reports its final directory back, so
// `cd` persists between commands without needing a real PTY.

let cwd: string | null = null
let current: ChildProcess | null = null

const MARK = '\x1e__ACORN_CWD__:'

function shellPath(): string {
  return process.env.SHELL || '/bin/bash'
}

function quote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export function terminalCwd(): string {
  return cwd ?? getRepoPath() ?? process.env.HOME ?? '/'
}

export function resetTerminal(): void {
  cwd = null
  if (current) {
    try {
      if (current.pid) process.kill(-current.pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
    current = null
  }
}

export function interruptTerminal(): void {
  if (current?.pid) {
    try {
      process.kill(-current.pid, 'SIGINT')
    } catch {
      /* already gone */
    }
  }
}

export function runCommand(
  command: string,
  onData: (chunk: string) => void,
  onExit: (code: number, cwd: string) => void
): void {
  const dir = terminalCwd()
  const script =
    `cd ${quote(dir)} 2>/dev/null\n` +
    `${command}\n` +
    `__acorn_code=$?\n` +
    `printf '${MARK}%s\\n' "$(pwd)"\n` +
    `exit $__acorn_code\n`

  let child: ChildProcess
  try {
    child = spawn(shellPath(), ['-c', script], { detached: true })
  } catch (e) {
    onData(`\n${(e as Error).message}\n`)
    onExit(1, dir)
    return
  }
  current = child

  let buf = ''
  const append = (d: Buffer): void => {
    buf += d.toString()
  }
  child.stdout?.on('data', append)
  child.stderr?.on('data', append)
  child.on('error', (e) => {
    buf += `\n${e.message}\n`
  })

  child.on('close', (code) => {
    let newCwd = cwd ?? dir
    const i = buf.indexOf(MARK)
    if (i !== -1) {
      const after = buf.slice(i + MARK.length)
      const nl = after.indexOf('\n')
      const p = (nl === -1 ? after : after.slice(0, nl)).trim()
      buf = buf.slice(0, i) // strip the marker line from displayed output
      if (p && existsSync(p)) newCwd = p
    }
    cwd = newCwd
    current = null
    onData(buf)
    onExit(code ?? 0, newCwd)
  })
}
