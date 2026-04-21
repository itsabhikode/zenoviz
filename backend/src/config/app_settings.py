from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite+aiosqlite:///./zenoviz.db"
    payment_upload_dir: str = "./data/payment_proofs"
    payment_qr_dir: str = "./data/payment_qr"
    max_payment_qr_bytes: int = 5 * 1024 * 1024
    booking_expiry_interval_seconds: int = 60
    max_payment_proof_bytes: int = 5 * 1024 * 1024

    cognito_admin_group: str = "Admin"
    """Cognito user pool group name that maps to API role `admin`."""

    s3_uploads_bucket: str | None = None
    """When set, payment proofs and QR images are stored in this S3 bucket."""

    s3_uploads_prefix: str = "zenoviz"
    """Key prefix inside the uploads bucket."""

    s3_zonal_endpoint: str | None = None
    """Optional override for S3 Express directory buckets (zonal API endpoint URL).

    If unset and ``S3_UPLOADS_BUCKET`` matches the directory-bucket name pattern
    (``*--{azId}--x-s3``), the client uses the matching ``s3express-…`` endpoint automatically.
    """

    payment_qr_public_base_url: str | None = None
    """HTTPS URL prefix for the uploads prefix (no trailing slash).

    When set and a QR exists, payment settings responses include ``qr_public_url`` built as
    ``{payment_qr_public_base_url}/payment-qr/{qr_filename}``, matching S3 keys under
    ``{S3_UPLOADS_PREFIX}/payment-qr/``. Use the bucket URL form that matches your public ACL
    or bucket policy (virtual-hosted style, website endpoint, or CloudFront origin path).
    """
