## Backend Sync Structure

This workspace is not the deploy repo.

- Working product repo here: `xq`
- Deploy-oriented backend repo: `jozkr88/my-backend`
- Render should follow backend-safe pushes, not random workspace state

### Rule

Build and verify in `xq`.
Publish only backend-safe files to `jozkr88/my-backend`.

Do not mix in:

- frontend files under `src/`
- root build output under `build/`
- local screenshots, GLB experiments, caches, or `.DS_Store`
- unrelated git noise from the mixed workspace

### Backend-safe scope

The canonical allowlist lives in:

- [`server/BACKEND_SYNC_ALLOWLIST.txt`](/Users/jozzox/Downloads/xq/server/BACKEND_SYNC_ALLOWLIST.txt)

Typical backend-safe paths:

- `server/index.js`
- `server/shared/**`
- `server/tools/**`
- `server/*.test.js`
- `server/package.json`
- `server/package-lock.json`
- `server/RENDER_SETUP.md`
- `render.yaml`
- `data/joz/**`
- `data/meetjoz/**`

### Standard flow

1. Implement changes in `xq`.
2. Verify locally:

```bash
cd /Users/jozzox/Downloads/xq/server
npm run build:joz-knowledge
npm run build:meetjoz-world
npm test
```

3. Review backend-only diff:

```bash
cd /Users/jozzox/Downloads/xq
bash scripts/prepare-my-backend-sync.sh
```

4. Push to `jozkr88/my-backend` on a dedicated backend branch.
5. Merge or fast-forward that repo's deploy branch.
6. Let Render deploy from the backend repo, not from this mixed workspace.

### Branch discipline

Use explicit backend branches, for example:

- `codex-backend-progressive-sync`
- `codex-meetjoz-world-routing`

Avoid pushing backend work to ambiguous branches from this repo's `origin`, because
`origin` here is not the deploy repo.

### Remote discipline

In this workspace:

- `origin` may continue to point somewhere else
- backend publishing should always target `https://github.com/jozkr88/my-backend.git`

That avoids accidental pushes to the wrong repo.
