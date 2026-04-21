"""Tests for AbstractStorageRepository and LocalStorageRepository."""
import uuid
from pathlib import Path

import pytest

from src.repositories.storage_repository import AbstractStorageRepository
from src.repositories.impl.local_storage_repository import LocalStorageRepository


# ---------------------------------------------------------------------------
# ABC contract
# ---------------------------------------------------------------------------

def test_abstract_storage_repository_cannot_be_instantiated() -> None:
    with pytest.raises(TypeError):
        AbstractStorageRepository()  # type: ignore[abstract]


# ---------------------------------------------------------------------------
# LocalStorageRepository — save_payment_proof
# ---------------------------------------------------------------------------

def test_save_payment_proof_writes_file(tmp_path: Path) -> None:
    repo = LocalStorageRepository(upload_dir=str(tmp_path / "proofs"), qr_dir=str(tmp_path / "qr"))
    booking_id = uuid.uuid4()
    data = b"fake-image-bytes"

    stored_path = repo.save_payment_proof(booking_id, ".jpg", data)

    assert Path(stored_path).exists()
    assert Path(stored_path).read_bytes() == data


def test_save_payment_proof_uses_booking_id_as_filename(tmp_path: Path) -> None:
    repo = LocalStorageRepository(upload_dir=str(tmp_path / "proofs"), qr_dir=str(tmp_path / "qr"))
    booking_id = uuid.uuid4()

    stored_path = repo.save_payment_proof(booking_id, ".png", b"data")

    assert Path(stored_path).name == f"{booking_id}.png"


def test_save_payment_proof_creates_upload_dir_if_missing(tmp_path: Path) -> None:
    upload_dir = tmp_path / "deep" / "nested" / "proofs"
    repo = LocalStorageRepository(upload_dir=str(upload_dir), qr_dir=str(tmp_path / "qr"))

    repo.save_payment_proof(uuid.uuid4(), ".jpg", b"data")

    assert upload_dir.exists()


# ---------------------------------------------------------------------------
# LocalStorageRepository — save_payment_qr
# ---------------------------------------------------------------------------

def test_save_payment_qr_writes_file(tmp_path: Path) -> None:
    repo = LocalStorageRepository(upload_dir=str(tmp_path / "proofs"), qr_dir=str(tmp_path / "qr"))
    data = b"qr-image-bytes"

    stored_name = repo.save_payment_qr(".png", data)

    stored_path = tmp_path / "qr" / stored_name
    assert stored_path.exists()
    assert stored_path.read_bytes() == data


def test_save_payment_qr_returns_filename(tmp_path: Path) -> None:
    repo = LocalStorageRepository(upload_dir=str(tmp_path / "proofs"), qr_dir=str(tmp_path / "qr"))

    stored_name = repo.save_payment_qr(".jpg", b"data")

    assert stored_name == "qr.jpg"


def test_save_payment_qr_creates_qr_dir_if_missing(tmp_path: Path) -> None:
    qr_dir = tmp_path / "deep" / "qr"
    repo = LocalStorageRepository(upload_dir=str(tmp_path / "proofs"), qr_dir=str(qr_dir))

    repo.save_payment_qr(".png", b"data")

    assert qr_dir.exists()


# ---------------------------------------------------------------------------
# LocalStorageRepository — read_payment_qr
# ---------------------------------------------------------------------------

def test_read_payment_qr_returns_bytes_for_existing_file(tmp_path: Path) -> None:
    qr_dir = tmp_path / "qr"
    qr_dir.mkdir()
    (qr_dir / "qr.png").write_bytes(b"stored-qr")

    repo = LocalStorageRepository(upload_dir=str(tmp_path / "proofs"), qr_dir=str(qr_dir))

    result = repo.read_payment_qr("qr.png")

    assert result == b"stored-qr"


def test_read_payment_qr_returns_none_for_missing_file(tmp_path: Path) -> None:
    repo = LocalStorageRepository(upload_dir=str(tmp_path / "proofs"), qr_dir=str(tmp_path / "qr"))

    result = repo.read_payment_qr("nonexistent.png")

    assert result is None


# ---------------------------------------------------------------------------
# LocalStorageRepository — read_payment_proof
# ---------------------------------------------------------------------------


def test_read_payment_proof_reads_roundtrip_absolute_path(tmp_path: Path) -> None:
    repo = LocalStorageRepository(upload_dir=str(tmp_path / "proofs"), qr_dir=str(tmp_path / "qr"))
    bid = uuid.uuid4()
    stored = repo.save_payment_proof(bid, ".png", b"proof-bytes")
    assert repo.read_payment_proof(stored) == b"proof-bytes"
