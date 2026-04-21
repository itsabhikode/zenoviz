"""S3 Express directory bucket endpoint helper."""

from src.repositories.s3_directory_endpoint import zonal_https_endpoint_for_directory_bucket


def test_general_purpose_bucket_returns_none() -> None:
    assert zonal_https_endpoint_for_directory_bucket("my-app-uploads", "us-east-1") is None


def test_directory_bucket_pattern_returns_zonal_endpoint() -> None:
    url = zonal_https_endpoint_for_directory_bucket(
        "zenoviz--use1-az4--x-s3",
        "us-east-1",
    )
    assert url == "https://s3express-use1-az4.us-east-1.amazonaws.com"


def test_directory_bucket_case_insensitive_az() -> None:
    url = zonal_https_endpoint_for_directory_bucket(
        "demo--USE1-AZ5--x-s3",
        "us-east-1",
    )
    assert url == "https://s3express-use1-az5.us-east-1.amazonaws.com"
