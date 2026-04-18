from abc import ABC, abstractmethod


class AbstractCognitoClient(ABC):
    @abstractmethod
    async def register(self, email: str, password: str) -> None: ...

    @abstractmethod
    async def login(self, email: str, password: str) -> dict[str, str]: ...

    @abstractmethod
    async def logout(self, access_token: str) -> None: ...

    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> dict[str, str]: ...
