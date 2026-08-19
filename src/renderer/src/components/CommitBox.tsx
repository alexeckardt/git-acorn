import { useEffect, useRef, useState } from "react";
import type { RepoStatus } from "../../../shared/types";
import DescriptionWriter, { DescEntry } from "./DescriptionWriter";
import CommitWizard from "./CommitWizard";
import Icon from "./Icon";
import { registerCommand } from "../lib/commands";
import { usePrefs } from "../lib/prefs";

interface Props {
  status: RepoStatus;
  onCommitted: () => void;
  onSync: () => void;
  syncing: boolean;
}

export default function CommitBox({ status, onCommitted, onSync, syncing }: Props) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showWriter, setShowWriter] = useState(false);
  const [writerMode, setWriterMode] = useState<"commit" | "manual">("manual");
  const [showWizard, setShowWizard] = useState(false);

  const { autoDescribe, commitWorkflow } = usePrefs();

  const stagedCount = status.staged.length;
  const changeCount = stagedCount + status.unstaged.length;
  const hasChanges = changeCount > 0;
  // Files that will actually be committed (staged, or everything if none staged).
  const toCommit = stagedCount > 0 ? stagedCount : status.unstaged.length;

  const canCommitDesktop = summary.trim().length > 0 && hasChanges && !busy;

  // The describer works on the staged files, or the working changes if none staged.
  const describeFiles = stagedCount > 0 ? status.staged : status.unstaged;

  function openWriter(mode: "commit" | "manual") {
    if (describeFiles.length === 0) return;
    setWriterMode(mode);
    setShowWriter(true);
  }

  function openWizard() {
    if (hasChanges) setShowWizard(true);
  }

  // Ctrl/Cmd+Enter runs whatever the bottom-left button does (Sync if the
  // button is currently a Sync button, otherwise commit / wizard).
  function handleCommitShortcut() {
    if (showSync) {
      onSync();
    } else if (commitWorkflow === "wizard") {
      openWizard();
    } else {
      doCommit();
    }
  }

  // Expose commit / describe as app commands (menu + shortcuts). Refs keep the
  // handlers current without re-registering on every render.
  const commitRef = useRef<() => void>(() => {});
  const describeRef = useRef<() => void>(() => {});
  commitRef.current = handleCommitShortcut;
  describeRef.current = () => openWriter("manual");
  useEffect(() => {
    const unsubs = [
      registerCommand("commit", () => commitRef.current()),
      registerCommand("describe-changes", () => describeRef.current()),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  async function performCommit(desc: string) {
    setBusy(true);
    setError(null);
    // If nothing is staged, stage everything first.
    if (status.staged.length === 0 && status.unstaged.length > 0) {
      const s = await window.gitApi.stageAll();
      if (!s.ok) {
        setBusy(false);
        setError(s.error ?? "Could not stage changes");
        return;
      }
    }
    const res = await window.gitApi.commit(summary.trim(), desc);
    setBusy(false);
    if (res.ok) {
      setSummary("");
      setDescription("");
      onCommitted();
    } else {
      setError(res.error ?? "Commit failed");
    }
  }

  function doCommit() {
    if (!canCommitDesktop) return;
    if (!description.trim() && autoDescribe && describeFiles.length > 0) {
      openWriter("commit");
      return;
    }
    performCommit(description);
  }

  function handleWriterFinish(entries: DescEntry[], completed: boolean) {
    setShowWriter(false);
    const bullets = entries
      .filter((e) => e.text.trim())
      .map((e) => `- ${e.text.trim()}`)
      .join("\n");
    const newDesc = bullets
      ? description.trim() ? `${description.trimEnd()}\n${bullets}` : bullets
      : description;
    if (bullets) setDescription(newDesc);
    if (writerMode === "commit" && completed) {
      performCommit(newDesc);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleCommitShortcut();
    }
  }

  const commitLabel = busy
    ? "Committing…"
    : `${commitWorkflow === "wizard" ? "Commit…" : "Commit"}${
      toCommit > 0 ? ` ${toCommit} file${toCommit === 1 ? "" : "s"}` : ""
    }`;
  const commitDisabled = commitWorkflow === "wizard"
    ? !hasChanges || busy
    : !canCommitDesktop;

  // With nothing to commit but commits to push/pull, the commit button becomes Sync.
  const showSync = !hasChanges && (status.ahead > 0 || status.behind > 0);

  return (
    <div className="commit-box" onKeyDown={onKeyDown}>
      {commitWorkflow !== "wizard" &&
        (
          <input
            className="commit-summary"
            placeholder="Summary (required)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        )}
      {commitWorkflow !== "wizard" &&
        (
          <textarea
            className="commit-description"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        )}

      <div className="commit-tools">
        <button
          className="text-btn"
          onClick={() => openWriter("manual")}
          disabled={describeFiles.length === 0}
          title="Describe changes file-by-file (⌘.)"
        >
          ✎ Describe changes
        </button>
        <button
          className="text-btn"
          onClick={openWizard}
          disabled={!hasChanges}
          title="Step-by-step commit wizard"
        >
          ⚡ Commit wizard
        </button>
      </div>

      {error && <div className="commit-error">{error}</div>}
      {showSync ? (
        <button
          className="sync-btn commit-sync-btn"
          disabled={syncing}
          onClick={onSync}
          title="Pull then push to origin"
        >
          {syncing ? (
            <span className="ring-spinner light" aria-hidden="true" />
          ) : (
            <Icon name="sync" size={15} />
          )}
          <span>Sync</span>
          {status.ahead > 0 && <span className="sync-count">↑{status.ahead}</span>}
          {status.behind > 0 && <span className="sync-count">↓{status.behind}</span>}
        </button>
      ) : (
        <button
          className="commit-btn"
          disabled={commitDisabled}
          onClick={commitWorkflow === "wizard" ? openWizard : doCommit}
        >
          {commitLabel}
          <span className="commit-branch">{status.branch}</span>
        </button>
      )}

      {showWriter && describeFiles.length > 0 && (
        <DescriptionWriter
          files={describeFiles}
          onFinish={handleWriterFinish}
        />
      )}
      <CommitWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onDone={onCommitted}
      />
    </div>
  );
}
