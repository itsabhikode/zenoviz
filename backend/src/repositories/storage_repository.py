from abc import ABC, abstractmethod
from uuid import UUID


class AbstractStorageRepository(ABC):
    @abstractmethod
    def save_payment_proof(self, booking_id: UUID, ext: str, data: bytes) -> str:
        """Save payment proof image; returns the absolute stored path string."""

    @abstractmethod
    def save_payment_qr(self, ext: str, data: bytes) -> str:
        """Save QR image; returns the stored filename (e.g. 'qr.png')."""

    @abstractmethod
    def read_payment_qr(self, filename: str) -> bytes | None:
        """Read QR image bytes; returns None if the file does not exist."""
