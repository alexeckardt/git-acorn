import { spawn, ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { getRepoPath } from './git'

// A lightweight shell session: each command runs in a fresh shell that starts
// in the tracked working directory and reports its final directory back, so
// `cd` persists between commands without needing a real PTY.
//
// The shell and its scripting differ per platform: a POSIX shell on macOS/Linux
// and PowerShell on Windows (which has no /bin/bash and doesn't understand the
// POSIX syntax below). Process termination also differs — POSIX signals a
// process group, Windows kills the tree with taskkill.

const isWin = process.platform === 'win32'

let cwd: string | null = null
let current: ChildProcess | null = null

const MARK = '\x1e__ACORN_CWD__:'

function shellPath(): string {
  if (isWin) return 'powershell.exe'
  return process.env.SHELL || '/bin/bash'
}

/** Single-quote for POSIX shells. */
function posixQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/** Single-quote for PowerShell (doubling embedded single quotes). */
function psQuote(s: string): string {
  return `'${s.replace(/'/g, `''`)}'`
}

/**
 * Build the shell invocation that cd's into `dir`, runs the user's command,
 * then prints a marker line with the final working directory so `cd` can
 * persist across commands, and exits with the command's status code.
 */
function buildInvocation(command: string, dir: string): { file: string; args: string[] } {
  if (isWin) {
    const script =
      `Set-Location -LiteralPath ${psQuote(dir)}\n` +
      `${command}\n` +
      `$__acorn_code = $LASTEXITCODE\n` +
      `Write-Output ('${MARK}' + (Get-Location).Path)\n` +
      `if ($null -eq $__acorn_code) { exit 0 } else { exit $__acorn_code }\n`
    return { file: shellPath(), args: ['-NoProfile', '-NonInteractive', '-Command', script] }
  }
  const script =
    `cd ${posixQuote(dir)} 2>/dev/null\n` +
    `${command}\n` +
    `__acorn_code=$?\n` +
    `printf '${MARK}%s\\n' "$(pwd)"\n` +
    `exit $__acorn_code\n`
  return { file: shellPath(), args: ['-c', script] }
}

/** Force-kill a running child and everything it spawned. */
function killTree(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid
  if (!pid) return
  try {
    if (isWin) {
      // No process-group signals on Windows; taskkill /T walks the child tree.
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'])
    } else {
      process.kill(-pid, signal)
    }
  } catch {
    /* already gone */
  }
}

export function terminalCwd(): string {
  return cwd ?? getRepoPath() ?? process.env.HOME ?? process.env.USERPROFILE ?? '/'
}

export function resetTerminal(): void {
  cwd = null
  if (current) {
    killTree(current, 'SIGKILL')
    current = null
  }
}

export function interruptTerminal(): void {
  // On Windows there's no clean per-process SIGINT to a detached child, so the
  // interrupt force-kills the command tree (matching the "one command at a
  // time" model); POSIX sends SIGINT to the process group.
  if (current) killTree(current, 'SIGINT')
}

export function runCommand(
  command: string,
  onData: (chunk: string) => void,
  onExit: (code: number, cwd: string) => void
): void {
  const dir = terminalCwd()
  const { file, args } = buildInvocation(command, dir)

  let child: ChildProcess
  try {
    child = spawn(file, args, { detached: !isWin, windowsHide: true })
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
