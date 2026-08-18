import type { ChangedFile, RepoStatus } from "../../../shared/types";
import CommitBox from "./CommitBox";
import FileRow from "./FileRow";
import FileTree from "./FileTree";

interface Props {
  status: RepoStatus;
  selected: { path: string; staged: boolean } | null;
  onSelectFile: (file: ChangedFile) => void;
  onRefresh: () => void;
  onFileHistory: (path: string) => void;
}

export default function ChangesPanel({
  status,
  selected,
  onSelectFile,
  onRefresh,
  onFileHistory,
}: Props) {
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
                actions={[
                  historyAction(f),
                  {
                    label: "↩",
                    title: "Discard changes",
                    danger: true,
                    onClick: () => {
                      if (confirm(`Discard changes to ${f.path}?`)) {
                        run(window.gitApi.discard([f.path]));
                      }
                    },
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

      <CommitBox status={status} onCommitted={onRefresh} />
    </div>
  );
}
