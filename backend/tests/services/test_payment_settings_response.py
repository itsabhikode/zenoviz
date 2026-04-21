"""Payment settings API mapping including optional public QR URL."""

import uuid
from datetime import datetime, timezone

from src.config.app_settings import AppSettings
from src.models.orm.study_room import PaymentSettings
from src.services.booking_service import payment_settings_to_response


def test_qr_public_url_when_base_configured() -> None:
    settings = AppSettings(
        payment_qr_public_base_url="https://bucket.s3.us-east-1.amazonaws.com/zenoviz/",
    )
    row = PaymentSettings(
        id=uuid.uuid4(),
        upi_vpa="x@y",
        payee_name=None,
        instructions=None,
        qr_filename="qr.png",
        qr_content_type="image/png",
        updated_at=datetime.now(timezone.utc),
        updated_by=None,
    )
    out = payment_settings_to_response(row, settings=settings)
    assert out.qr_public_url == (
        "https://bucket.s3.us-east-1.amazonaws.com/zenoviz/payment-qr/qr.png"
    )


def test_qr_public_url_none_without_base() -> None:
    settings = AppSettings()
    row = PaymentSettings(
        id=uuid.uuid4(),
        upi_vpa=None,
        payee_name=None,
        instructions=None,
        qr_filename="qr.png",
        qr_content_type=None,
        updated_at=datetime.now(timezone.utc),
        updated_by=None,
    )
    out = payment_settings_to_response(row, settings=settings)
    assert out.qr_public_url is None
