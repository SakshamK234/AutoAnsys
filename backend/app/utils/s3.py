"""Shared S3/MinIO client helpers."""

from __future__ import annotations

import boto3

from app.config import settings


def s3_client():
    """Client for backend-side S3 operations (uploads, downloads, deletes)."""
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )


def s3_presign_client():
    """Client whose presigned URLs are reachable FROM A BROWSER.

    Inside docker-compose the backend reaches MinIO at ``http://minio:9000``,
    a hostname browsers cannot resolve; presigned URLs must be signed against
    the host-visible endpoint instead (S3_PUBLIC_ENDPOINT). The signature is
    endpoint-dependent, so rewriting the host after signing would 403.
    """
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_PUBLIC_ENDPOINT or settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )
