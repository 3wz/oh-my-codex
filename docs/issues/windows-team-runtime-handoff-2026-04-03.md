# Windows Team Runtime Handoff

## Scope

This handoff covers the Windows-native `omx team` fixes ported into this fork on 2026-04-03.

Repo root:
- `D:\_ai\oh-my-codex`

Primary source change:
- `src/team/tmux-session.ts`

Primary test change:
- `src/team/__tests__/tmux-session.test.ts`

## What Was Fixed

### 1. HUD resize best-effort shell on native Windows

Problem:
- Team startup used POSIX-only `>/dev/null 2>&1 || true` shell fragments inside tmux `run-shell`.
- In the reporter's Windows + tmux + PowerShell environment this failed during HUD resize reconciliation before workers could start.

Fix:
- On native Windows (`process.platform === "win32"` and not MSYS/Git Bash), `buildBestEffortShellCommand()` now emits a PowerShell-safe best-effort command:
  - suppresses output with `*> $null`
  - keeps failures non-fatal
  - clears `$LASTEXITCODE` back to `0`

### 2. Worker pane startup command on native Windows

Problem:
- Team workers still launched through the POSIX path:
  - `env ... /bin/sh -lc ...`
- In the reporter's environment worker panes either exited immediately or hit PowerShell execution-policy failures when trying to invoke `codex.ps1`.

Fix:
- On native Windows, `buildWorkerStartupCommand()` now emits:
  - `powershell.exe -ExecutionPolicy Bypass -NoLogo -NoExit -EncodedCommand ...`
- The encoded command:
  - sets the required team env vars
  - invokes the resolved worker CLI path directly
  - preserves the existing worker launch args, including Codex bypass flags

## Tests Added

`src/team/__tests__/tmux-session.test.ts` now covers:
- native-Windows HUD reconcile command generation
- native-Windows worker startup command generation

These tests are intended to catch regressions if future tmux/team refactors drift back to POSIX-only startup behavior.

## Manual Validation Performed

Validation environment:
- native Windows
- `psmux`/tmux session
- PowerShell leader shell
- team runtime exercised through the installed OMX package before porting the fix into this fork

Observed before fix:
- team startup failed at HUD resize reconciliation
- worker startup failed due to POSIX launch assumptions
- worker startup later failed on PowerShell execution policy when invoking `codex.ps1`

Observed after fix:
- `omx team` launched successfully
- worker pane started as a real `codex` process
- worker ACK reached leader mailbox
- task advanced to `in_progress` and then `completed`
- worker commit was merged back to leader
- team state cleaned to `missing`

## Remaining Gaps / Known Risks

These were still flaky in the reporter's environment and should be treated as follow-up work, not solved scope:

1. Codex trust prompt auto-dismiss
- Worker panes could stop at:
  - `Do you trust the contents of this directory?`
- Runtime auto-trust did not reliably clear this in the tested Windows tmux setup.
- Manual pane interaction was required once to continue.

2. Shutdown pane cleanup
- `omx team shutdown` completed and team state was eventually removed.
- Some HUD / worker panes still required manual `tmux kill-pane` cleanup afterward.

3. This repo change is source-level only
- The installed global package used during live validation was patched separately during investigation.
- Rebuild and reinstall this fork before assuming the local global CLI now contains the source changes from this repo.

## Recommended Next Session Checklist

### Build + verify this fork

From `D:\_ai\oh-my-codex`:

```powershell
npm run build
npm run lint
node --test dist/team/__tests__/tmux-session.test.js
```

Optional broader validation:

```powershell
npm run test:node:cross-platform
```

### Prepare a local install artifact

Dry run:

```powershell
npm pack --dry-run
```

Actual tarball:

```powershell
npm pack
```

### Install your fork locally

Example:

```powershell
npm install -g .\oh-my-codex-<version>.tgz
```

If you want to keep upstream and forked installs distinct, consider either:
- bumping `package.json` version first
- or publishing under your own npm scope/name before global install

### Re-run the smoke path

Recommended smoke target:
- disposable git repo
- inside tmux / psmux
- one worker only
- trivial file edit plus commit

Suggested command shape:

```powershell
omx team 1:executor "append one PASS line to README.md, commit it, report success, and complete the task"
```

### Watch for these specific checkpoints

Startup:
- team start line appears
- worker pane is a real `codex` process

Progress:
- leader mailbox gets `ACK: worker-1 initialized`
- task moves `pending -> in_progress -> completed`

Shutdown:
- `omx team status <name> --json` eventually returns `missing`
- tmux pane count returns to the pre-run baseline

## If You Want To Finish The Windows Path Properly

Highest-value follow-up items:

1. Fix trust-prompt auto-dismiss on native Windows tmux
- likely in `sendToWorker()` / `dismissTrustPromptIfPresent()` / ready-wait logic

2. Fix shutdown pane cleanup reliability
- likely in the shutdown / teardown worker-pane path rather than task completion logic

3. Add a true native-Windows team smoke test harness
- current unit coverage only locks command generation
- the remaining failures are interaction/runtime-level, not pure string-generation bugs
