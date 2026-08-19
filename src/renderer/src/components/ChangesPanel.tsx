import { useState } from "react";
import type { ChangedFile, RepoStatus } from "../../../shared/types";
import CommitBox from "./CommitBox";
import ContextMenu, { MenuItem } from "./ContextMenu";
import FileRow from "./FileRow";
import FileTree from "./FileTree";

interface Props {
  status: RepoStatus;
  selected: { path: string; staged: boolean } | null;
  onSelectFile: (file: ChangedFile) => void;
  onRefresh: () => void;
  onFileHistory: (path: string) => void;
  onSync: () => void;
  syncing: boolean;
}

export default function ChangesPanel({
  status,
  selected,
  onSelectFile,
  onRefresh,
  onFileHistory,
  onSync,
  syncing,
}: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(
    null,
  );

  async function run(op: Promise<{ ok: boolean; error?: string }>) {
    const res = await op;
    if (!res.ok) alert(res.error);
    onRefresh();
  }

  const historyAction = (f: ChangedFile) => ({
    label: "🕘",
    title: "View file history",
    onClick: () => onFileHistory(f.path),
  });

  function discard(f: ChangedFile) {
    if (confirm(`Discard changes to ${f.path}?`)) {
      run(window.gitApi.discard([f.path]));
    }
  }

  /** The right-click menu mirrors the row's quick actions, plus ignore options. */
  function buildMenu(f: ChangedFile): MenuItem[] {
    const items: MenuItem[] = [];
    if (f.staged) {
      items.push({ label: "Unstage", onClick: () => run(window.gitApi.unstage([f.path])) });
    } else {
      items.push({ label: "Stage", onClick: () => run(window.gitApi.stage([f.path])) });
      items.push({
        label: "Discard changes",
        danger: true,
        onClick: () => discard(f),
      });
    }
    if (f.status !== "untracked") {
      items.push({ label: "View file history", onClick: () => onFileHistory(f.path) });
    }
    items.push({
      label: "Add to .gitignore",
      divider: true,
      onClick: () => run(window.gitApi.addToGitignore([f.path])),
    });
    items.push({
      label: "Hide from changes (local)",
      onClick: () => run(window.gitApi.hideLocally([f.path])),
    });
    return items;
  }

  function openMenu(e: React.MouseEvent, f: ChangedFile) {
    e.preventDefault();
    onSelectFile(f);
    setMenu({ x: e.clientX, y: e.clientY, items: buildMenu(f) });
  }

  return (
    <div className="changes-panel">
      <section className="file-section">
        <header className="section-head">
          <span>
            Staged <span className="count">{status.staged.length}</span>
          </span>
          {status.staged.length > 0 && (
            <button
              className="text-btn"
              onClick={() => run(window.gitApi.unstageAll())}
            >
              Unstage all
            </button>
          )}
        </header>
        <div className="file-list">
          <FileTree
            items={status.staged}
            getPath={(f) => f.path}
            renderFile={(f, indent) => (
              <FileRow
                file={f}
                indent={indent}
                nameOnly
                selected={selected?.path === f.path && selected.staged === true}
                onSelect={() => onSelectFile(f)}
                onContextMenu={(e) => openMenu(e, f)}
                actions={[
                  historyAction(f),
                  {
                    label: "−",
                    title: "Unstage file",
                    onClick: () => run(window.gitApi.unstage([f.path])),
                  },
                ]}
              />
            )}
          />
          {status.staged.length === 0 && (
            <div className="empty-hint">Nothing staged</div>
          )}
        </div>
      </section>

      <section className="file-section">
        <header className="section-head">
          <span>
            Changes <span className="count">{status.unstaged.length}</span>
          </span>
          {status.unstaged.length > 0 && (
            <button
              className="text-btn"
              onClick={() => run(window.gitApi.stageAll())}
            >
              Stage all
            </button>
          )}
        </header>
        <div className="file-list">
          <FileTree
            items={status.unstaged}
            getPath={(f) => f.path}
            renderFile={(f, indent) => (
              <FileRow
                file={f}
                indent={indent}
                nameOnly
                selected={selected?.path === f.path && selected.staged === false}
                onSelect={() => onSelectFile(f)}
                onContextMenu={(e) => openMenu(e, f)}
                actions={[
                  historyAction(f),
                  {
                    label: "↩",
                    title: "Discard changes",
                    danger: true,
                    onClick: () => discard(f),
                  },
                  {
                    label: "+",
                    title: "Stage file",
                    onClick: () => run(window.gitApi.stage([f.path])),
                  },
                ]}
              />
            )}
          />
          {status.unstaged.length === 0 && (
            <div className="empty-hint">No unstaged changes</div>
          )}
        </div>
      </section>

      <CommitBox status={status} onCommitted={onRefresh} onSync={onSync} syncing={syncing} />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
