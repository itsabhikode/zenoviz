"""Helpers for S3 Express One Zone (directory) buckets vs general-purpose buckets."""

from __future__ import annotations

import re

# S3 directory bucket naming: <base>--<AZ-id>--x-s3  e.g. myapp--use1-az4--x-s3
_DIRECTORY_BUCKET = re.compile(
    r"^.+--(?P<az>[a-z0-9]+-az[0-9]+)--x-s3$",
    re.IGNORECASE,
)


def zonal_https_endpoint_for_directory_bucket(bucket: str, region: str) -> str | None:
    """Return the zonal data-plane endpoint for PutObject/GetObject, or None for general buckets.

    Directory buckets require zonal hosts such as
    ``https://s3express-use1-az4.us-east-1.amazonaws.com``, not the default regional S3 endpoint.
    """
    m = _DIRECTORY_BUCKET.match(bucket.strip())
    if not m:
        return None
    az = m.group("az").lower()
    region = region.strip()
    return f"https://s3express-{az}.{region}.amazonaws.com"
