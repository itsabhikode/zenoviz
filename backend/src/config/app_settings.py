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

    bootstrap_admins: str = ""
    """Comma-separated list of Cognito emails or subs that get the `admin`
    role on their first authenticated request. Empty = no bootstrap."""

    def bootstrap_admin_identities(self) -> frozenset[str]:
        return frozenset(
            part.strip().lower()
            for part in self.bootstrap_admins.split(",")
            if part.strip()
        )
