from abc import ABC, abstractmethod
from uuid import UUID


class AbstractStorageRepository(ABC):
    @abstractmethod
    def save_payment_proof(self, booking_id: UUID, ext: str, data: bytes) -> str:
        """Save payment proof image; returns an opaque reference (local path or S3 key)."""

    @abstractmethod
    def save_payment_qr(self, ext: str, data: bytes) -> str:
        """Save QR image; returns the stored filename under the QR prefix (e.g. 'qr.png')."""

    @abstractmethod
    def read_payment_qr(self, filename: str) -> bytes | None:
        """Read QR image bytes; returns None if the file does not exist."""

    @abstractmethod
    def read_payment_proof(self, stored: str) -> bytes | None:
        """Read payment proof bytes using the value returned from save_payment_proof."""

    @abstractmethod
    def save_gallery_image(self, filename: str, data: bytes) -> str:
        """Save a gallery image; returns the storage key."""

    @abstractmethod
    def read_gallery_image(self, storage_key: str) -> bytes | None:
        """Read gallery image bytes by storage key."""

    @abstractmethod
    def delete_gallery_image(self, storage_key: str) -> None:
        """Delete a gallery image by storage key."""
