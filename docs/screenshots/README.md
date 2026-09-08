# Screenshots

The main [README](../../README.md) references the images below. Drop PNGs with
these exact filenames into this folder and they'll appear automatically.

| Filename | What to capture |
| --- | --- |
| `hero.png` | The full app window — changes panel on the left, commit graph, and diff. This is the banner shot; make it wide (~1400px). |
| `commit-graph.png` | A close-up of the commit graph with a few branch/tag chips visible. |
| `diff.png` | The diff viewer in side-by-side mode on a file with real changes. |
| `branches.png` | A right-click context menu open on a branch or commit (showing checkout / create-branch actions). |
| `terminal.png` | The built-in terminal open with a git command run. |

## Capturing on macOS

Use the built-in window screenshot — it captures a single window with a clean
drop shadow:

1. Press **⌘⇧4**, then **Space** (the cursor becomes a camera).
2. Click the git-acorn window.
3. The PNG lands on your Desktop — rename and move it here.

Or from the terminal, capture the frontmost window after a short delay:

```bash
screencapture -o -w docs/screenshots/hero.png
```

## Capturing on Windows

Use **Win + Shift + S** (Snipping Tool) → **Window** mode, click the git-acorn
window, then save the result into this folder with the filename from the table.

## Tips

- Open the app against a repo with some history so the graph looks alive.
- Keep the window a consistent size across shots (e.g. 1400×900) so the gallery
  images line up.
