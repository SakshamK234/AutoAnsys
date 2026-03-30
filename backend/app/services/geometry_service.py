"""Business logic for geometry upload, download, and deletion."""

import uuid

import boto3
from fastapi import UploadFile

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.geometry import Geometry
from app.models.user import User


class GeometryService:
    """Handles geometry lifecycle: upload to S3, persist metadata, delete."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
        )

    async def upload(
        self,
        user: User,
        file: UploadFile,
        component_name: str | None = None,
        description: str | None = None,
    ) -> Geometry:
        """Upload a geometry file to S3 and create a database record."""
        file_bytes = await file.read()
        file_size = len(file_bytes)

        stored_filename = f"{uuid.uuid4().hex}_{file.filename}"
        s3_key = f"geometries/{user.id}/{stored_filename}"

        # Upload to S3
        self.s3.put_object(
            Bucket=settings.S3_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=file.content_type or "application/octet-stream",
        )

        geometry = Geometry(
            user_id=user.id,
            filename=stored_filename,
            original_name=file.filename or "unknown",
            component_name=component_name,
            description=description,
            file_size=file_size,
            s3_key=s3_key,
        )
        self.db.add(geometry)
        await self.db.flush()
        await self.db.refresh(geometry)
        return geometry

    async def delete(self, geometry: Geometry) -> None:
        """Remove the S3 object and database record."""
        try:
            self.s3.delete_object(Bucket=settings.S3_BUCKET, Key=geometry.s3_key)
        except Exception:
            # Log but don't fail if S3 cleanup errors
            pass

        await self.db.delete(geometry)

    def generate_presigned_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """Generate a presigned download URL for a geometry file."""
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": s3_key},
            ExpiresIn=expires_in,
        )
