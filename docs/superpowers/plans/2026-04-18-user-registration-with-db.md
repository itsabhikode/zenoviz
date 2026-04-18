# User Registration with Postgres Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Cognito signup by passing all required attributes and persist user profiles to Postgres 17 as the source of truth.

**Architecture:** DB-first dual-write — the service adds the User to the SQLAlchemy session (pending), calls Cognito to get `UserSub`, sets `cognito_sub` on the object, then commits. If Cognito fails the session rolls back cleanly; no partial state. Cognito stores the 4 required attributes to satisfy pool schema; Postgres owns the data.

**Tech Stack:** FastAPI, SQLAlchemy 2.x (async), asyncpg, Alembic, Pydantic v2, boto3, pytest-asyncio, Docker (postgres:17)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `docker-compose.yml` | Postgres 17 service |
| Create | `src/database.py` | Async engine + session factory + `Base` |
| Create | `src/models/user.py` | `User` ORM model |
| Create | `src/repositories/impl/user.py` | `UserRepository` SQLAlchemy impl |
| Create | `alembic/` | Migration scaffolding (via `alembic init`) |
| Create | `alembic/versions/` | Auto-generated migration |
| Create | `tests/repositories/__init__.py` | Package marker |
| Create | `tests/repositories/test_user_repository_abc.py` | ABC contract tests |
| Create | `tests/repositories/test_user_repository.py` | Repo unit tests |
| Modify | `src/domain/user.py` | Add `Gender` enum |
| Modify | `src/models/auth.py` | Extend `RegisterRequest` |
| Modify | `src/clients/base.py` | Update `register` signature, return `str` |
| Modify | `src/clients/impl/cognito.py` | Pass `UserAttributes`, return `UserSub` |
| Modify | `src/repositories/base.py` | Add `AbstractUserRepository` |
| Modify | `src/services/auth_service.py` | Orchestrate DB write + Cognito call |
| Modify | `src/dependencies.py` | Add DB session, user repo, rewire service |
| Modify | `tests/test_domain_and_models.py` | Add Gender + User ORM tests, fix RegisterRequest tests |
| Modify | `tests/clients/test_cognito_client.py` | Update register tests for new signature |
| Modify | `tests/services/test_auth_service.py` | Update fakes + add DB/rollback tests |
| Modify | `tests/routes/test_auth_routes.py` | Add DB overrides, update payloads |

---

### Task 1: Infrastructure — Docker Compose + asyncpg

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env.example`
- Run: `uv add asyncpg`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: zenoviz
      POSTGRES_PASSWORD: zenoviz
      POSTGRES_DB: zenoviz
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Add DATABASE_URL to .env.example**

Append to `.env.example`:
```
DATABASE_URL=postgresql+asyncpg://zenoviz:zenoviz@localhost:5432/zenoviz
```

- [ ] **Step 3: Add DATABASE_URL to your actual .env**

Append to `.env`:
```
DATABASE_URL=postgresql+asyncpg://zenoviz:zenoviz@localhost:5432/zenoviz
```

- [ ] **Step 4: Add asyncpg dependency**

```bash
uv add asyncpg
```

Expected: `pyproject.toml` now contains `asyncpg>=...` and `uv.lock` is updated.

- [ ] **Step 5: Start Postgres**

```bash
docker compose up -d
```

Expected:
```
[+] Running 1/1
 ✔ Container zenoviz-db-1  Started
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example pyproject.toml uv.lock
git commit -m "chore: add Postgres 17 via Docker and asyncpg driver"
```

---

### Task 2: Gender enum in domain layer

**Files:**
- Modify: `src/domain/user.py`
- Modify: `tests/test_domain_and_models.py`

- [ ] **Step 1: Write failing tests for Gender**

In `tests/test_domain_and_models.py`, add after the existing imports:

```python
from src.domain.user import CurrentUser, Gender
```

(Replace the existing `from src.domain.user import CurrentUser` import.)

Add at the end of the file:

```python
# ---------------------------------------------------------------------------
# Gender enum
# ---------------------------------------------------------------------------

def test_gender_enum_values() -> None:
    assert Gender.male.value == "male"
    assert Gender.female.value == "female"
    assert Gender.other.value == "other"


def test_gender_enum_has_three_members() -> None:
    assert len(Gender) == 3
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_domain_and_models.py::test_gender_enum_values -v
```

Expected: `ImportError` — `cannot import name 'Gender'`

- [ ] **Step 3: Add Gender enum to src/domain/user.py**

Replace the entire file:

```python
import enum
from dataclasses import dataclass


class Gender(enum.Enum):
    male = "male"
    female = "female"
    other = "other"


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    email: str
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_domain_and_models.py -v
```

Expected: all existing tests + 2 new Gender tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/user.py tests/test_domain_and_models.py
git commit -m "feat: add Gender enum to domain layer"
```

---

### Task 3: Extend RegisterRequest with profile fields

**Files:**
- Modify: `src/models/auth.py`
- Modify: `tests/test_domain_and_models.py`

- [ ] **Step 1: Write failing tests for extended RegisterRequest**

In `tests/test_domain_and_models.py`, update the existing `RegisterRequest` tests section to:

```python
# ---------------------------------------------------------------------------
# RegisterRequest
# ---------------------------------------------------------------------------

def test_register_request_valid() -> None:
    req = RegisterRequest(
        email="user@example.com",
        password="SecurePass1!",
        given_name="John",
        family_name="Doe",
        phone_number="+1234567890",
        gender=Gender.male,
    )
    assert req.email == "user@example.com"
    assert req.given_name == "John"
    assert req.gender == Gender.male


def test_register_request_rejects_missing_profile_fields() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(email="user@example.com", password="SecurePass1!")  # type: ignore[call-arg]


def test_register_request_rejects_missing_email() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(  # type: ignore[call-arg]
            password="SecurePass1!",
            given_name="John",
            family_name="Doe",
            phone_number="+1234567890",
            gender=Gender.male,
        )


def test_register_request_rejects_invalid_email() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="not-an-email",
            password="SecurePass1!",
            given_name="John",
            family_name="Doe",
            phone_number="+1234567890",
            gender=Gender.male,
        )


def test_register_request_rejects_missing_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(  # type: ignore[call-arg]
            email="user@example.com",
            given_name="John",
            family_name="Doe",
            phone_number="+1234567890",
            gender=Gender.male,
        )


def test_register_request_rejects_invalid_gender() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="user@example.com",
            password="SecurePass1!",
            given_name="John",
            family_name="Doe",
            phone_number="+1234567890",
            gender="invalid",
        )
```

Also add `Gender` to the imports at the top of the test file:
```python
from src.models.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
)
```
(No change needed here — `Gender` is already imported via `src.domain.user`.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_domain_and_models.py -k "register_request" -v
```

Expected: `test_register_request_rejects_missing_profile_fields` FAILS (currently passes because old RegisterRequest doesn't have those fields), and several other tests break.

- [ ] **Step 3: Update src/models/auth.py**

Replace the entire file:

```python
from pydantic import BaseModel, EmailStr

from src.domain.user import Gender


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    given_name: str
    family_name: str
    phone_number: str
    gender: Gender


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_domain_and_models.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/auth.py tests/test_domain_and_models.py
git commit -m "feat: extend RegisterRequest with profile fields"
```

---

### Task 4: SQLAlchemy async engine (src/database.py)

**Files:**
- Create: `src/database.py`

- [ ] **Step 1: Create src/database.py**

```python
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str) -> AsyncEngine:
    return create_async_engine(database_url, echo=False)


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

- [ ] **Step 2: Verify import works**

```bash
uv run python -c "from src.database import Base, make_engine, make_session_factory; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/database.py
git commit -m "feat: add SQLAlchemy async engine and session factory"
```

---

### Task 5: User ORM model

**Files:**
- Create: `src/models/user.py`
- Modify: `tests/test_domain_and_models.py`

- [ ] **Step 1: Write failing test for User model**

Add to `tests/test_domain_and_models.py`:

```python
import uuid as _uuid

from src.models.user import User
```

Add these imports at the top of the file alongside the existing ones. Then add at the end:

```python
# ---------------------------------------------------------------------------
# User ORM model
# ---------------------------------------------------------------------------

def test_user_model_instantiation() -> None:
    user = User(
        id=_uuid.uuid4(),
        email="u@example.com",
        given_name="John",
        family_name="Doe",
        phone_number="+1234567890",
        gender=Gender.male,
    )
    assert user.email == "u@example.com"
    assert user.given_name == "John"
    assert user.cognito_sub is None  # set after Cognito call, before commit
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_domain_and_models.py::test_user_model_instantiation -v
```

Expected: `ImportError` — `cannot import name 'User'`

- [ ] **Step 3: Create src/models/user.py**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.domain.user import Gender


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cognito_sub: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    given_name: Mapped[str] = mapped_column(String, nullable=False)
    family_name: Mapped[str] = mapped_column(String, nullable=False)
    phone_number: Mapped[str] = mapped_column(String, nullable=False)
    gender: Mapped[Gender] = mapped_column(
        Enum(Gender, name="gender_enum"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

> Note: `cognito_sub` is typed `uuid.UUID | None` in Python so it can be `None` before the Cognito call. The DB column is `NOT NULL` — SQLAlchemy only enforces this at flush/commit time, by which point `cognito_sub` will have been set.

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_domain_and_models.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/user.py tests/test_domain_and_models.py
git commit -m "feat: add User ORM model"
```

---

### Task 6: Alembic setup + initial migration

**Files:**
- Create: `alembic/` (via `alembic init`)
- Modify: `alembic/env.py`
- Create: `alembic/versions/001_create_users_table.py` (via autogenerate)

- [ ] **Step 1: Initialise Alembic with async template**

```bash
uv run alembic init -t async alembic
```

Expected: `alembic/` directory with `env.py`, `script.py.mako`, `versions/`; and `alembic.ini` at project root.

- [ ] **Step 2: Replace alembic/env.py**

```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from src.database import Base
import src.models.user  # noqa: F401 — registers User with Base.metadata
from src.dependencies import get_database_settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_database_settings().database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Autogenerate migration**

```bash
uv run alembic revision --autogenerate -m "create_users_table"
```

Expected: a new file appears in `alembic/versions/` named something like `xxxx_create_users_table.py`.

- [ ] **Step 4: Inspect the generated migration**

Open the generated file and verify it contains:
- `op.create_table("users", ...)` with all 9 columns
- `sa.Enum("male", "female", "other", name="gender_enum")` for the gender column
- `downgrade()` that drops the table

If columns are missing, ensure `import src.models.user` is present in `alembic/env.py` and re-run step 3.

- [ ] **Step 5: Run migration**

```bash
uv run alembic upgrade head
```

Expected:
```
INFO  [alembic.runtime.migration] Running upgrade  -> xxxx, create_users_table
```

- [ ] **Step 6: Verify table exists**

```bash
docker exec -it $(docker compose ps -q db) psql -U zenoviz -d zenoviz -c "\d users"
```

Expected: table description showing all 9 columns with correct types.

- [ ] **Step 7: Commit**

```bash
git add alembic/ alembic.ini
git commit -m "chore: initialise Alembic and add create_users_table migration"
```

---

### Task 7: AbstractUserRepository ABC

**Files:**
- Modify: `src/repositories/base.py`
- Create: `tests/repositories/__init__.py`
- Create: `tests/repositories/test_user_repository_abc.py`

- [ ] **Step 1: Write failing ABC contract test**

Create `tests/repositories/__init__.py` (empty).

Create `tests/repositories/test_user_repository_abc.py`:

```python
import inspect
import pytest

from src.repositories.base import AbstractUserRepository


def test_abstract_user_repository_cannot_be_instantiated() -> None:
    with pytest.raises(TypeError):
        AbstractUserRepository()  # type: ignore[abstract]


def test_abstract_user_repository_has_create_method() -> None:
    assert hasattr(AbstractUserRepository, "create")
    assert getattr(AbstractUserRepository.create, "__isabstractmethod__", False)


def test_create_is_coroutine() -> None:
    assert inspect.iscoroutinefunction(AbstractUserRepository.create)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/repositories/test_user_repository_abc.py -v
```

Expected: FAIL — `AbstractUserRepository` has no abstract methods yet.

- [ ] **Step 3: Implement AbstractUserRepository in src/repositories/base.py**

```python
from abc import ABC, abstractmethod

from src.models.user import User


class AbstractUserRepository(ABC):
    @abstractmethod
    async def create(self, user: User) -> None: ...
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/repositories/test_user_repository_abc.py -v
```

Expected: all 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/base.py tests/repositories/__init__.py tests/repositories/test_user_repository_abc.py
git commit -m "feat: add AbstractUserRepository ABC"
```

---

### Task 8: UserRepository SQLAlchemy implementation

**Files:**
- Create: `src/repositories/impl/user.py`
- Create: `tests/repositories/test_user_repository.py`

- [ ] **Step 1: Write failing tests**

Create `tests/repositories/test_user_repository.py`:

```python
import uuid
from unittest.mock import MagicMock

import pytest

from src.domain.user import Gender
from src.models.user import User
from src.repositories.base import AbstractUserRepository
from src.repositories.impl.user import UserRepository


def test_user_repository_is_abstract_subclass() -> None:
    assert issubclass(UserRepository, AbstractUserRepository)


async def test_create_adds_user_to_session() -> None:
    session = MagicMock()
    repo = UserRepository(session)
    user = User(
        id=uuid.uuid4(),
        email="u@example.com",
        given_name="John",
        family_name="Doe",
        phone_number="+1234567890",
        gender=Gender.male,
    )

    await repo.create(user)

    session.add.assert_called_once_with(user)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/repositories/test_user_repository.py -v
```

Expected: `ImportError` — `cannot import name 'UserRepository'`

- [ ] **Step 3: Create src/repositories/impl/user.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.user import User
from src.repositories.base import AbstractUserRepository


class UserRepository(AbstractUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, user: User) -> None:
        self._session.add(user)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/repositories/ -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/impl/user.py tests/repositories/test_user_repository.py
git commit -m "feat: add UserRepository SQLAlchemy implementation"
```

---

### Task 9: Update CognitoClient — new signature + UserAttributes

**Files:**
- Modify: `src/clients/base.py`
- Modify: `src/clients/impl/cognito.py`
- Modify: `tests/clients/test_cognito_client.py`

- [ ] **Step 1: Write failing tests for new register signature**

In `tests/clients/test_cognito_client.py`, replace the three `register` tests with:

```python
# ---------------------------------------------------------------------------
# register
# ---------------------------------------------------------------------------

async def test_register_calls_sign_up_with_user_attributes() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.sign_up = MagicMock(return_value={"UserSub": "00000000-0000-0000-0000-000000000001"})

    with patch.object(client, "_boto_client", mock_boto):
        result = await client.register(
            "user@example.com", "SecurePass1!", "John", "Doe", "+1234567890", "male"
        )

    assert result == "00000000-0000-0000-0000-000000000001"
    mock_boto.sign_up.assert_called_once_with(
        ClientId="CLIENTID",
        Username="user@example.com",
        Password="SecurePass1!",
        UserAttributes=[
            {"Name": "email", "Value": "user@example.com"},
            {"Name": "given_name", "Value": "John"},
            {"Name": "family_name", "Value": "Doe"},
            {"Name": "phone_number", "Value": "+1234567890"},
            {"Name": "gender", "Value": "male"},
        ],
    )


async def test_register_raises_value_error_on_username_exists() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.sign_up = MagicMock(side_effect=_client_error("UsernameExistsException"))

    with patch.object(client, "_boto_client", mock_boto):
        with pytest.raises(ValueError, match="already registered"):
            await client.register(
                "user@example.com", "SecurePass1!", "J", "D", "+1234567890", "male"
            )


async def test_register_raises_value_error_on_invalid_password() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.sign_up = MagicMock(side_effect=_client_error("InvalidPasswordException"))

    with patch.object(client, "_boto_client", mock_boto):
        with pytest.raises(ValueError, match="password"):
            await client.register(
                "user@example.com", "weak", "J", "D", "+1234567890", "male"
            )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/clients/test_cognito_client.py -k "register" -v
```

Expected: FAIL — old signature doesn't accept the extra args.

- [ ] **Step 3: Update src/clients/base.py**

```python
from abc import ABC, abstractmethod


class AbstractCognitoClient(ABC):
    @abstractmethod
    async def register(
        self,
        email: str,
        password: str,
        given_name: str,
        family_name: str,
        phone_number: str,
        gender: str,
    ) -> str: ...
    """Returns the Cognito UserSub (a UUID string)."""

    @abstractmethod
    async def login(self, email: str, password: str) -> dict[str, str]: ...

    @abstractmethod
    async def logout(self, access_token: str) -> None: ...

    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> dict[str, str]: ...
```

- [ ] **Step 4: Update register method in src/clients/impl/cognito.py**

Replace only the `register` method (lines 15–29):

```python
    async def register(
        self,
        email: str,
        password: str,
        given_name: str,
        family_name: str,
        phone_number: str,
        gender: str,
    ) -> str:
        try:
            response = await asyncio.to_thread(
                self._boto_client.sign_up,
                ClientId=self._app_client_id,
                Username=email,
                Password=password,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "given_name", "Value": given_name},
                    {"Name": "family_name", "Value": family_name},
                    {"Name": "phone_number", "Value": phone_number},
                    {"Name": "gender", "Value": gender},
                ],
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "UsernameExistsException":
                raise ValueError("Email already registered") from exc
            if code == "InvalidPasswordException":
                raise ValueError(
                    f"Invalid password: {exc.response['Error']['Message']}"
                ) from exc
            raise
        return response["UserSub"]
```

- [ ] **Step 5: Run all client tests**

```bash
uv run pytest tests/clients/ -v
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/clients/base.py src/clients/impl/cognito.py tests/clients/test_cognito_client.py
git commit -m "feat: update CognitoClient.register to pass UserAttributes and return UserSub"
```

---

### Task 10: Update AuthService — DB-first dual-write

**Files:**
- Modify: `src/services/auth_service.py`
- Modify: `tests/services/test_auth_service.py`

- [ ] **Step 1: Write failing tests for updated service**

Replace the entire `tests/services/test_auth_service.py`:

```python
"""Unit tests for AuthService."""
import uuid
from unittest.mock import AsyncMock

import pytest

from src.clients.base import AbstractCognitoClient
from src.domain.user import Gender
from src.models.auth import LoginRequest, RefreshRequest, RegisterRequest
from src.models.user import User
from src.repositories.base import AbstractUserRepository
from src.services.auth_service import AuthService

FAKE_COGNITO_SUB = "00000000-0000-0000-0000-000000000001"

VALID_REGISTER_REQUEST = RegisterRequest(
    email="u@example.com",
    password="Pass1!",
    given_name="John",
    family_name="Doe",
    phone_number="+1234567890",
    gender=Gender.male,
)


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

class FakeCognitoClient(AbstractCognitoClient):
    def __init__(self) -> None:
        self.registered: list[tuple[str, ...]] = []
        self.logged_in: list[tuple[str, str]] = []
        self.logged_out: list[str] = []
        self.refreshed: list[str] = []
        self.register_error: Exception | None = None
        self.login_tokens: dict[str, str] = {
            "access_token": "fake_access",
            "refresh_token": "fake_refresh",
        }
        self.login_error: Exception | None = None
        self.refresh_tokens: dict[str, str] = {"access_token": "new_fake_access"}
        self.refresh_error: Exception | None = None

    async def register(
        self,
        email: str,
        password: str,
        given_name: str,
        family_name: str,
        phone_number: str,
        gender: str,
    ) -> str:
        if self.register_error:
            raise self.register_error
        self.registered.append((email, password, given_name, family_name, phone_number, gender))
        return FAKE_COGNITO_SUB

    async def login(self, email: str, password: str) -> dict[str, str]:
        if self.login_error:
            raise self.login_error
        self.logged_in.append((email, password))
        return self.login_tokens

    async def logout(self, access_token: str) -> None:
        self.logged_out.append(access_token)

    async def refresh_token(self, refresh_token: str) -> dict[str, str]:
        if self.refresh_error:
            raise self.refresh_error
        self.refreshed.append(refresh_token)
        return self.refresh_tokens


class FakeUserRepository(AbstractUserRepository):
    def __init__(self) -> None:
        self.created: list[User] = []

    async def create(self, user: User) -> None:
        self.created.append(user)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _service() -> tuple[AuthService, FakeCognitoClient, FakeUserRepository, AsyncMock]:
    fake_cognito = FakeCognitoClient()
    fake_repo = FakeUserRepository()
    fake_session = AsyncMock()
    svc = AuthService(cognito=fake_cognito, user_repo=fake_repo, session=fake_session)
    return svc, fake_cognito, fake_repo, fake_session


# ---------------------------------------------------------------------------
# register
# ---------------------------------------------------------------------------

async def test_register_success_returns_message() -> None:
    svc, _, fake_repo, fake_session = _service()

    response = await svc.register(VALID_REGISTER_REQUEST)

    assert "successful" in response.message.lower()
    assert len(fake_repo.created) == 1
    fake_session.commit.assert_called_once()


async def test_register_sets_cognito_sub_before_commit() -> None:
    svc, _, fake_repo, fake_session = _service()

    await svc.register(VALID_REGISTER_REQUEST)

    user = fake_repo.created[0]
    assert user.cognito_sub == uuid.UUID(FAKE_COGNITO_SUB)


async def test_register_rollback_on_cognito_failure() -> None:
    svc, fake_cognito, _, fake_session = _service()
    fake_cognito.register_error = ValueError("Email already registered")

    with pytest.raises(ValueError, match="already registered"):
        await svc.register(VALID_REGISTER_REQUEST)

    fake_session.rollback.assert_called_once()
    fake_session.commit.assert_not_called()


async def test_register_db_write_happens_before_cognito_call() -> None:
    """Repo.create must be called before Cognito.register."""
    call_order: list[str] = []

    class OrderedRepo(AbstractUserRepository):
        async def create(self, user: User) -> None:
            call_order.append("db")

    class OrderedCognito(FakeCognitoClient):
        async def register(self, **kwargs: str) -> str:  # type: ignore[override]
            call_order.append("cognito")
            return FAKE_COGNITO_SUB

    session = AsyncMock()
    svc = AuthService(cognito=OrderedCognito(), user_repo=OrderedRepo(), session=session)
    await svc.register(VALID_REGISTER_REQUEST)

    assert call_order == ["db", "cognito"]


async def test_register_propagates_value_error() -> None:
    svc, fake_cognito, _, _ = _service()
    fake_cognito.register_error = ValueError("Email already registered")

    with pytest.raises(ValueError, match="already registered"):
        await svc.register(VALID_REGISTER_REQUEST)


# ---------------------------------------------------------------------------
# login
# ---------------------------------------------------------------------------

async def test_login_success_returns_tokens() -> None:
    svc, _, _, _ = _service()
    response = await svc.login(LoginRequest(email="u@example.com", password="Pass1!"))
    assert response.access_token == "fake_access"
    assert response.refresh_token == "fake_refresh"
    assert response.token_type == "bearer"


async def test_login_propagates_value_error() -> None:
    svc, fake_cognito, _, _ = _service()
    fake_cognito.login_error = ValueError("Invalid credentials")
    with pytest.raises(ValueError, match="Invalid credentials"):
        await svc.login(LoginRequest(email="u@example.com", password="wrong"))


async def test_login_propagates_permission_error() -> None:
    svc, fake_cognito, _, _ = _service()
    fake_cognito.login_error = PermissionError("not verified")
    with pytest.raises(PermissionError):
        await svc.login(LoginRequest(email="u@example.com", password="Pass1!"))


# ---------------------------------------------------------------------------
# logout
# ---------------------------------------------------------------------------

async def test_logout_success_returns_message() -> None:
    svc, fake_cognito, _, _ = _service()
    response = await svc.logout("access_tok")
    assert "success" in response.message.lower()
    assert fake_cognito.logged_out == ["access_tok"]


# ---------------------------------------------------------------------------
# refresh
# ---------------------------------------------------------------------------

async def test_refresh_success_returns_new_token() -> None:
    svc, _, _, _ = _service()
    response = await svc.refresh(RefreshRequest(refresh_token="ref_tok"))
    assert response.access_token == "new_fake_access"
    assert response.token_type == "bearer"


async def test_refresh_propagates_value_error() -> None:
    svc, fake_cognito, _, _ = _service()
    fake_cognito.refresh_error = ValueError("Invalid or expired refresh token")
    with pytest.raises(ValueError, match="refresh token"):
        await svc.refresh(RefreshRequest(refresh_token="bad_tok"))
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/services/test_auth_service.py -v
```

Expected: FAIL — `AuthService.__init__` doesn't accept `user_repo` or `session` yet.

- [ ] **Step 3: Replace src/services/auth_service.py**

```python
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.clients.base import AbstractCognitoClient
from src.models.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
)
from src.models.user import User
from src.repositories.base import AbstractUserRepository


class AuthService:
    def __init__(
        self,
        cognito: AbstractCognitoClient,
        user_repo: AbstractUserRepository,
        session: AsyncSession,
    ) -> None:
        self.cognito = cognito
        self.user_repo = user_repo
        self.session = session

    async def register(self, request: RegisterRequest) -> MessageResponse:
        user = User(
            id=uuid.uuid4(),
            email=request.email,
            given_name=request.given_name,
            family_name=request.family_name,
            phone_number=request.phone_number,
            gender=request.gender,
        )
        try:
            await self.user_repo.create(user)
            cognito_sub = await self.cognito.register(
                email=request.email,
                password=request.password,
                given_name=request.given_name,
                family_name=request.family_name,
                phone_number=request.phone_number,
                gender=request.gender.value,
            )
            user.cognito_sub = uuid.UUID(cognito_sub)
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ValueError("Email already registered") from exc
        except Exception:
            await self.session.rollback()
            raise
        return MessageResponse(
            message="Registration successful. Please check your email to verify your account."
        )

    async def login(self, request: LoginRequest) -> LoginResponse:
        tokens = await self.cognito.login(request.email, request.password)
        return LoginResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
        )

    async def logout(self, access_token: str) -> MessageResponse:
        await self.cognito.logout(access_token)
        return MessageResponse(message="Logged out successfully")

    async def refresh(self, request: RefreshRequest) -> RefreshResponse:
        tokens = await self.cognito.refresh_token(request.refresh_token)
        return RefreshResponse(access_token=tokens["access_token"])
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/services/test_auth_service.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth_service.py tests/services/test_auth_service.py
git commit -m "feat: update AuthService to orchestrate DB write and Cognito registration"
```

---

### Task 11: Wire dependencies

**Files:**
- Modify: `src/dependencies.py`

- [ ] **Step 1: Replace src/dependencies.py with the complete updated file**

```python
from collections.abc import AsyncGenerator
from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from src.database import make_engine, make_session_factory
from src.domain.user import CurrentUser

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


class CognitoSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    cognito_user_pool_id: str
    cognito_app_client_id: str
    cognito_region: str
    cognito_jwks_url: str


@lru_cache
def get_cognito_settings() -> CognitoSettings:
    return CognitoSettings()


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str


@lru_cache
def get_database_settings() -> DatabaseSettings:
    return DatabaseSettings()


# ---------------------------------------------------------------------------
# JWKS cache (module-level; replaced in tests via patch)
# ---------------------------------------------------------------------------

_jwks_cache: dict[str, Any] | None = None


def _fetch_jwks() -> dict[str, Any]:
    settings = get_cognito_settings()
    response = httpx.get(settings.cognito_jwks_url)
    response.raise_for_status()
    return response.json()


def _get_jwks() -> dict[str, Any]:
    global _jwks_cache
    if _jwks_cache is None:
        _jwks_cache = _fetch_jwks()
    return _jwks_cache


def _decode_token(token: str, jwks: dict[str, Any]) -> dict[str, Any]:
    settings = get_cognito_settings()
    issuer = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
        f"{settings.cognito_user_pool_id}"
    )
    return jwt.decode(
        token,
        jwks,
        algorithms=["RS256"],
        audience=settings.cognito_app_client_id,
        issuer=issuer,
        options={"verify_aud": False},  # Cognito access tokens use client_id, not aud
    )


# ---------------------------------------------------------------------------
# FastAPI dependency — current user
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    jwks = _get_jwks()

    try:
        payload = _decode_token(token, jwks)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        global _jwks_cache
        new_jwks = _fetch_jwks()
        _jwks_cache = new_jwks
        try:
            payload = _decode_token(token, new_jwks)
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return CurrentUser(user_id=payload["sub"], email=payload.get("email", ""))


# ---------------------------------------------------------------------------
# DB session factory (module-level lazy init)
# ---------------------------------------------------------------------------

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _engine, _session_factory
    if _session_factory is None:
        settings = get_database_settings()
        _engine = make_engine(settings.database_url)
        _session_factory = make_session_factory(_engine)
    return _session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    factory = _get_session_factory()
    async with factory() as session:
        yield session


# ---------------------------------------------------------------------------
# DI providers
# ---------------------------------------------------------------------------


def get_cognito_client() -> Any:
    from src.clients.impl.cognito import CognitoClient

    settings = get_cognito_settings()
    return CognitoClient(
        user_pool_id=settings.cognito_user_pool_id,
        app_client_id=settings.cognito_app_client_id,
        region=settings.cognito_region,
    )


def get_user_repository(
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    from src.repositories.impl.user import UserRepository

    return UserRepository(session)


def get_auth_service(
    cognito: Any = Depends(get_cognito_client),
    user_repo: Any = Depends(get_user_repository),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    from src.services.auth_service import AuthService

    return AuthService(cognito=cognito, user_repo=user_repo, session=session)
```

- [ ] **Step 2: Verify the app starts without errors**

```bash
uv run python -c "from src.dependencies import get_auth_service, get_db_session, get_user_repository; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/dependencies.py
git commit -m "feat: wire DB session and UserRepository into DI container"
```

---

### Task 12: Update route tests

**Files:**
- Modify: `tests/routes/test_auth_routes.py`

- [ ] **Step 1: Run existing route tests to see what breaks**

```bash
uv run pytest tests/routes/test_auth_routes.py -v
```

Expected: several FAIL — `FakeCognitoClient.register` has wrong signature; `RegisterRequest` now requires profile fields; `get_auth_service` needs `user_repo` and `session`.

- [ ] **Step 2: Replace tests/routes/test_auth_routes.py**

```python
"""Integration tests for auth routes using TestClient and dependency overrides."""
from collections.abc import AsyncGenerator, Generator
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.clients.base import AbstractCognitoClient
from src.dependencies import get_cognito_client, get_current_user, get_db_session, get_user_repository
from src.domain.user import CurrentUser
from src.main import app
from src.models.user import User
from src.repositories.base import AbstractUserRepository

FAKE_COGNITO_SUB = "00000000-0000-0000-0000-000000000001"

VALID_REGISTER_PAYLOAD: dict[str, Any] = {
    "email": "u@example.com",
    "password": "Pass1!",
    "given_name": "John",
    "family_name": "Doe",
    "phone_number": "+1234567890",
    "gender": "male",
}


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

class FakeCognitoClient(AbstractCognitoClient):
    def __init__(self) -> None:
        self.register_error: Exception | None = None
        self.login_tokens: dict[str, str] = {
            "access_token": "fake_access",
            "refresh_token": "fake_refresh",
        }
        self.login_error: Exception | None = None
        self.refresh_tokens: dict[str, str] = {"access_token": "new_fake_access"}
        self.refresh_error: Exception | None = None

    async def register(
        self,
        email: str,
        password: str,
        given_name: str,
        family_name: str,
        phone_number: str,
        gender: str,
    ) -> str:
        if self.register_error:
            raise self.register_error
        return FAKE_COGNITO_SUB

    async def login(self, email: str, password: str) -> dict[str, str]:
        if self.login_error:
            raise self.login_error
        return self.login_tokens

    async def logout(self, access_token: str) -> None:
        pass

    async def refresh_token(self, refresh_token: str) -> dict[str, str]:
        if self.refresh_error:
            raise self.refresh_error
        return self.refresh_tokens


class FakeUserRepository(AbstractUserRepository):
    async def create(self, user: User) -> None:
        pass


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def fake_cognito() -> FakeCognitoClient:
    return FakeCognitoClient()


@pytest.fixture()
def mock_session() -> AsyncMock:
    return AsyncMock(spec=AsyncSession)


@pytest.fixture()
def client(
    fake_cognito: FakeCognitoClient,
    mock_session: AsyncMock,
) -> Generator[TestClient, None, None]:
    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session  # type: ignore[misc]

    app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
    app.dependency_overrides[get_user_repository] = lambda: FakeUserRepository()
    app.dependency_overrides[get_db_session] = _session_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

def test_register_success(client: TestClient) -> None:
    resp = client.post("/auth/register", json=VALID_REGISTER_PAYLOAD)
    assert resp.status_code == 201
    assert "successful" in resp.json()["message"].lower()


def test_register_duplicate_returns_409(
    client: TestClient, fake_cognito: FakeCognitoClient
) -> None:
    fake_cognito.register_error = ValueError("Email already registered")
    resp = client.post("/auth/register", json=VALID_REGISTER_PAYLOAD)
    assert resp.status_code == 409


def test_register_weak_password_returns_400(
    client: TestClient, fake_cognito: FakeCognitoClient
) -> None:
    fake_cognito.register_error = ValueError("Invalid password: too short")
    payload = {**VALID_REGISTER_PAYLOAD, "password": "short"}
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400


def test_register_invalid_email_returns_422(client: TestClient) -> None:
    payload = {**VALID_REGISTER_PAYLOAD, "email": "not-an-email"}
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 422


def test_register_missing_fields_returns_422(client: TestClient) -> None:
    resp = client.post("/auth/register", json={"email": "u@example.com"})
    assert resp.status_code == 422


def test_register_invalid_gender_returns_422(client: TestClient) -> None:
    payload = {**VALID_REGISTER_PAYLOAD, "gender": "unknown"}
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

def test_login_success(client: TestClient) -> None:
    resp = client.post("/auth/login", json={"email": "u@example.com", "password": "Pass1!"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"] == "fake_access"
    assert body["refresh_token"] == "fake_refresh"
    assert body["token_type"] == "bearer"


def test_login_wrong_password_returns_401(
    client: TestClient, fake_cognito: FakeCognitoClient
) -> None:
    fake_cognito.login_error = ValueError("Invalid credentials")
    resp = client.post("/auth/login", json={"email": "u@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unregistered_returns_401(
    client: TestClient, fake_cognito: FakeCognitoClient
) -> None:
    fake_cognito.login_error = ValueError("Invalid credentials")
    resp = client.post(
        "/auth/login", json={"email": "nobody@example.com", "password": "Pass1!"}
    )
    assert resp.status_code == 401
    assert "Invalid credentials" in resp.json()["detail"]


def test_login_unverified_returns_403(
    client: TestClient, fake_cognito: FakeCognitoClient
) -> None:
    fake_cognito.login_error = PermissionError("Account not verified")
    resp = client.post("/auth/login", json={"email": "u@example.com", "password": "Pass1!"})
    assert resp.status_code == 403


def test_login_missing_fields_returns_422(client: TestClient) -> None:
    resp = client.post("/auth/login", json={"email": "u@example.com"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

def test_logout_success(fake_cognito: FakeCognitoClient, mock_session: AsyncMock) -> None:
    fake_user = CurrentUser(user_id="u-1", email="user@example.com")

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session  # type: ignore[misc]

    app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
    app.dependency_overrides[get_user_repository] = lambda: FakeUserRepository()
    app.dependency_overrides[get_db_session] = _session_override
    app.dependency_overrides[get_current_user] = lambda: fake_user
    with TestClient(app) as c:
        resp = c.post("/auth/logout", headers={"Authorization": "Bearer fake_tok"})
    app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert "success" in resp.json()["message"].lower()


def test_logout_missing_token_returns_401(client: TestClient) -> None:
    resp = client.post("/auth/logout")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------

def test_refresh_success(client: TestClient) -> None:
    resp = client.post("/auth/refresh", json={"refresh_token": "ref_tok"})
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "new_fake_access"


def test_refresh_invalid_token_returns_401(
    client: TestClient, fake_cognito: FakeCognitoClient
) -> None:
    fake_cognito.refresh_error = ValueError("Invalid or expired refresh token")
    resp = client.post("/auth/refresh", json={"refresh_token": "bad"})
    assert resp.status_code == 401


def test_refresh_missing_field_returns_422(client: TestClient) -> None:
    resp = client.post("/auth/refresh", json={})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def test_health_check_accessible_without_token(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
```

- [ ] **Step 3: Run all tests**

```bash
uv run pytest -v
```

Expected: all tests PASS. If any test fails, fix the failure before proceeding.

- [ ] **Step 4: Commit**

```bash
git add tests/routes/test_auth_routes.py
git commit -m "test: update route tests for new registration flow with DB overrides"
```

---

### Final Verification

- [ ] **Run the full test suite one last time**

```bash
uv run pytest -v
```

Expected: all tests PASS, zero failures.

- [ ] **Smoke-test the running app (optional)**

```bash
# In one terminal:
uv run uvicorn src.main:app --reload

# In another:
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass1!","given_name":"Test","family_name":"User","phone_number":"+1234567890","gender":"male"}' | jq .
```

Expected: `{"message": "Registration successful. Please check your email to verify your account."}`
