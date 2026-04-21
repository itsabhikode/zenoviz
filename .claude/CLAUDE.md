# Zenoviz — Project Constitution

## Stack
- Python 3.13, FastAPI, SQLAlchemy 2.x, Pydantic v2
- pytest + pytest-asyncio for all tests
- Alembic for migrations

## Workflow (non-negotiable order)
1. New feature → /opsx:propose "idea" FIRST — no code before approval
2. Implementation → Superpowers writing-plans skill breaks tasks down
3. Every task → TDD: red (failing test) → green (implement) → refactor
4. Done → /opsx:archive to save specs

### Cursor agents
When working under `backend/`, **`.cursor/rules/backend-openspec-superpowers.mdc`** turns on OpenSpec paths (`backend/openspec/…`), opsx workflow triggers, and Superpowers-equivalent steps (brainstorm → TDD → verify). Read that rule whenever backend files are in context.

## Superpowers skills (always required)
- **brainstorming** — invoke before ANY code change, including small modifications and refactors, not just new features
- **test-driven-development** — invoke before writing any implementation code; "too simple to test" is never a valid reason to skip
- **verification-before-completion** — invoke before claiming work is done

## Folder structure
src/
  routes/        # FastAPI APIRouter only — no business logic here
  services/      # Orchestration — calls repos and clients
  repositories/  # All DB access via ABCs + SQLAlchemy impls
  clients/       # All 3rd party API calls via ABCs + httpx impls
  models/        # SQLAlchemy ORM models + Pydantic request/response schemas
  domain/        # Pure Python — entities, value objects, no I/O
  dependencies.py  # FastAPI Depends() wiring — the DI container
tests/           # Mirrors src/ struccture patterns (strictly enforced)

### Dependency Injection
- ALL dependencies injected via __init__ constructors
- NEVER instantiate services/repos/clients inside another class
- Use FastAPI Depends() in routes to wire everything together
- Example:
    class UserService:
        def __init__(self, repo: AbstractUserRepository, client: AbstractEmailClient):
            self.repo = repo
            self.client = client

### Repository pattern
- Every repo has an ABC in repositories/base.py using abc.ABC + @abstractmethod
- SQLAlchemy implementation in repositories/impl/
- Services ONLY call repo methods — never touch Session directly
- Example:
    class AbstractUserRepository(ABC):
        @abstractmethod
        async def get_by_id(self, id: UUID) -> User | None: ...

### Client pattern (3rd party APIs)
- Every external API has an ABC in clients/base.py
- httpx implementation in clients/impl/
- NEVER call httpx/requests directly from services
- Example:
    class AbstractEmailClient(ABC):
        @abstctmethod
        async def send(self, to: str, subject: str, body: str) -> None: ...

### Domain layer
- Pure Python classes only — no SQLAlchemy, no Pydantic, no FastAPI
- Contains business entities and value objects
- No I/O of any kind

### Routes
- Only validate input (Pydantic) and call one service method
- Return Pydantic response schemas — never ORM models directly
- All dependency injection via FastAPI Depends()

## Code standards
- Type hints required on ALL functions and methods
- No global mutable state
- No inline imports inside functions
- Async everywhere (async def for all routes, services, repos, clients)
