<div align="center">
<img src="./davaforce/public/assets/gitlabs_logo_transparent-v2.png" alt="DavaForce logo" width="400" />
</div>

# DavaForce


DavaForce is an AI-assisted workforce planning app that turns uploaded workforce data into evidence-backed staffing, supply, demand, risk, and approval insights.

The active application lives in `davaforce/`. The repository root holds shared ignore rules, local agent assets, and project-level documentation entry points.

## Project Layout

```text
  davaforce/
    frontend/   UI pages, feature components, shell components, hooks, and assets
    backend/    Next route handlers, import/verify logic, Mastra agents, tools, and scripts
    src/app/    Thin Next.js bridge for app routes and API routing
    docs/       Requirements, MVP architecture, API contracts, and agent contracts
  skills/       Local planning/documentation helper skills
```

## Run Locally

```powershell
cd davaforce
npm install
npm run dev
```

Build:

```powershell
cd davaforce
npm run build
```

Useful scripts:

```powershell
npm run db:import
npm run db:verify
npm run report
```

## Main Routes

- `/` - sign in and upload a workbook
- `/ask` - enter the first workforce question
- `/workspace` - chat workspace with agent-specific evidence UI
- `/dashboard` - static dashboard from uploaded dataset snapshots
- `/api/...` - backend routes for auth, datasets, chat, dashboard, and conversations

## Key Docs

- `davaforce/docs/requirements.md`
- `davaforce/docs/mvp.md`
- `davaforce/docs/team-structure.md`
- `davaforce/docs/contracts/api-contracts.md`
- `davaforce/docs/agent-contracts/`
