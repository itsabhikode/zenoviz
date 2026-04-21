from pathlib import Path
from uuid import UUID

from src.repositories.storage_repository import AbstractStorageRepository


class LocalStorageRepository(AbstractStorageRepository):
    def __init__(self, upload_dir: str, qr_dir: str) -> None:
        self._upload_dir = Path(upload_dir)
        self._qr_dir = Path(qr_dir)

    def save_payment_proof(self, booking_id: UUID, ext: str, data: bytes) -> str:
        self._upload_dir.mkdir(parents=True, exist_ok=True)
        path = self._upload_dir / f"{booking_id}{ext}"
        path.write_bytes(data)
        return str(path.resolve())

    def save_payment_qr(self, ext: str, data: bytes) -> str:
        self._qr_dir.mkdir(parents=True, exist_ok=True)
        filename = f"qr{ext}"
        (self._qr_dir / filename).write_bytes(data)
        return filename

    def read_payment_qr(self, filename: str) -> bytes | None:
        path = self._qr_dir / filename
        if not path.exists():
            return None
        return path.read_bytes()

    def read_payment_proof(self, stored: str) -> bytes | None:
        path = Path(stored)
        if path.is_absolute():
            if not path.exists():
                return None
            return path.read_bytes()
        candidate = self._upload_dir / stored
        if not candidate.exists():
            return None
        return candidate.read_bytes()
