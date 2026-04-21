import logging
import mimetypes
from typing import Any
from uuid import UUID

import boto3
from botocore.exceptions import ClientError

from src.repositories.s3_directory_endpoint import (
    zonal_https_endpoint_for_directory_bucket,
)
from src.repositories.storage_repository import AbstractStorageRepository

logger = logging.getLogger(__name__)


class S3StorageRepository(AbstractStorageRepository):
    """Stores payment proofs and QR images under a prefix in a single bucket."""

    def __init__(
        self,
        bucket: str,
        prefix: str,
        *,
        region: str,
        aws_access_key_id: str | None,
        aws_secret_access_key: str | None,
        aws_session_token: str | None,
        zonal_endpoint_override: str | None = None,
    ) -> None:
        self._bucket = bucket
        self._prefix = prefix.strip().strip("/")
        session_kw: dict[str, Any] = {"region_name": region}
        if aws_access_key_id and aws_secret_access_key:
            session_kw["aws_access_key_id"] = aws_access_key_id
            session_kw["aws_secret_access_key"] = aws_secret_access_key
            if aws_session_token:
                session_kw["aws_session_token"] = aws_session_token
        session = boto3.Session(**session_kw)

        endpoint_url = (zonal_endpoint_override or "").strip() or None
        if endpoint_url is None:
            endpoint_url = zonal_https_endpoint_for_directory_bucket(bucket, region)
        client_kw: dict[str, Any] = {"region_name": region}
        if endpoint_url:
            client_kw["endpoint_url"] = endpoint_url
            logger.info(
                "S3 boto client endpoint_url=%s for bucket=%s",
                endpoint_url,
                bucket,
            )
        self._client = session.client("s3", **client_kw)

    def _key(self, *segments: str) -> str:
        parts = [self._prefix, *segments] if self._prefix else list(segments)
        return "/".join(parts)

    def save_payment_proof(self, booking_id: UUID, ext: str, data: bytes) -> str:
        key = self._key("payment-proofs", f"{booking_id}{ext}")
        content_type, _ = mimetypes.guess_type(f"x{ext}")
        extra: dict[str, Any] = {"Bucket": self._bucket, "Key": key, "Body": data}
        if content_type:
            extra["ContentType"] = content_type
        self._client.put_object(**extra)
        return key

    def save_payment_qr(self, ext: str, data: bytes) -> str:
        filename = f"qr{ext}"
        key = self._key("payment-qr", filename)
        content_type, _ = mimetypes.guess_type(filename)
        extra: dict[str, Any] = {"Bucket": self._bucket, "Key": key, "Body": data}
        if content_type:
            extra["ContentType"] = content_type
        self._client.put_object(**extra)
        return filename

    def read_payment_qr(self, filename: str) -> bytes | None:
        key = self._key("payment-qr", filename)
        return self._get_bytes(key)

    def read_payment_proof(self, stored: str) -> bytes | None:
        return self._get_bytes(stored)

    def _get_bytes(self, key: str) -> bytes | None:
        try:
            resp = self._client.get_object(Bucket=self._bucket, Key=key)
            return resp["Body"].read()
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchKey"):
                return None
            raise
