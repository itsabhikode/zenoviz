# Architecture specification

## Requirement: Layered architecture
WHEN any feature is implemented
THEN it must follow the layer order: routes → services → repositories/clients → models → domain
AND no layer may import from a layer above it
AND domain layer must have zero external dependencies

## Requirement: Dependency injection
WHEN a service, repository, or client is needed
THEN it must be injected via __init__ constructor
AND never instantiated inline
AND wired together only in src/dependencies.py

## Requirement: Repository abstraction
WHEN data access is needed
THEN an ABC must exist in repositories/base.py
AND the SQLAlchemy implementation lives in repositories/impl/
AND services only call ABC methods, never SQLAlchemy Session directly

## Requirement: Client abstraction
WHEN a 3rd party API is called
THEN an ABC must exist in clients/base.py
AND the httpx implementation lives in clients/impl/
AND services only call ods, never httpx directly

## Requirement: TDD
WHEN any code is written
THEN a failing test must exist first
AND the test must live in tests/ mirroring the src/ structure
AND all tests must pass before the task is marked complete

## Non-goals
- Do NOT put business logic in routes
- Do NOT put SQL queries in services
- Do NOT call external APIs from routes or repositories
- Do NOT use sync def — always async def
