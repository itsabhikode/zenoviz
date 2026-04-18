# Zenoviz

Monorepo for the Zenoviz study-room booking system.

```
.
├── backend/        FastAPI + SQLAlchemy + AWS Cognito (Python 3.13, uv)
├── frontend/       Angular 19 + Angular Material (Node 20, npm)
├── docs/           Design docs, plans, specs
├── .claude/        Claude Code skills and commands
└── CLAUDE.md       Project constitution (applies to the whole repo)
```

## Backend — quick start

```bash
cd backend
uv sync
cp .env.example .env            # fill in Cognito + DB values
uv run uvicorn src.main:app --reload
```

API docs: http://localhost:8000/docs — tests: `cd backend && uv run pytest`

See [`backend/README.md`](backend/README.md) for full details.

## Frontend — quick start

```bash
cd frontend
npm install
npm start                       # serves at http://localhost:4200
```

The frontend expects the backend at `http://localhost:8000` (configurable in
`frontend/src/environments/environment.ts`).

## End-to-end dev loop

In two terminals:

```bash
# Terminal 1
cd backend && uv run uvicorn src.main:app --reload

# Terminal 2
cd frontend && npm start
```

Log in via the UI at http://localhost:4200/login using a user registered
through Cognito (or use `/register` in the app).

## Monorepo conventions

- **Independent tooling per folder.** Backend uses `uv`; frontend uses `npm`. No Nx / workspace root.
- **Each folder carries its own `README.md`** with stack-specific commands.
- **Docs, Claude skills, and OpenSpec live at the repo root** (or inside the stack they target).
- **Secrets never leave `backend/.env`** — the frontend only needs the backend URL.
