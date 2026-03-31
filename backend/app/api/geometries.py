"""Geometry CRUD endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.geometry import Geometry
from app.models.user import User
from app.schemas.geometry import GeometryCreate, GeometryList, GeometryResponse
from app.services.geometry_service import GeometryService

router = APIRouter(prefix="/api/geometries", tags=["geometries"])


@router.post("", response_model=GeometryResponse, status_code=status.HTTP_201_CREATED)
async def upload_geometry(
    file: UploadFile = File(...),
    component_name: str | None = None,
    description: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Geometry:
    """Upload a new geometry file."""
    service = GeometryService(db)
    geometry = await service.upload(
        user=current_user,
        file=file,
        component_name=component_name,
        description=description,
    )
    return geometry


@router.post("/upload", response_model=GeometryResponse, status_code=status.HTTP_201_CREATED)
async def upload_geometry_alias(
    file: UploadFile = File(...),
    component_name: str | None = None,
    description: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Geometry:
    """Upload a new geometry file (alias for POST /)."""
    return await upload_geometry(file, component_name, description, db, current_user)


@router.get("", response_model=GeometryList)
async def list_geometries(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List geometries owned by the current user."""
    query = (
        select(Geometry)
        .where(Geometry.user_id == current_user.id)
        .order_by(Geometry.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())

    count_query = select(func.count()).select_from(Geometry).where(Geometry.user_id == current_user.id)
    total = (await db.execute(count_query)).scalar() or 0

    return {"items": items, "total": total}


@router.get("/{geometry_id}", response_model=GeometryResponse)
async def get_geometry(
    geometry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Geometry:
    """Get a single geometry by ID."""
    result = await db.execute(
        select(Geometry).where(Geometry.id == geometry_id, Geometry.user_id == current_user.id)
    )
    geometry = result.scalar_one_or_none()
    if geometry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Geometry not found")
    return geometry


@router.get("/{geometry_id}/download")
async def download_geometry(
    geometry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Generate a presigned download URL for a geometry file."""
    result = await db.execute(
        select(Geometry).where(Geometry.id == geometry_id, Geometry.user_id == current_user.id)
    )
    geometry = result.scalar_one_or_none()
    if geometry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Geometry not found")

    service = GeometryService(db)
    url = service.generate_presigned_url(geometry.s3_key)
    return {"url": url, "filename": geometry.original_name}


@router.delete("/{geometry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_geometry(
    geometry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a geometry and its S3 object."""
    result = await db.execute(
        select(Geometry).where(Geometry.id == geometry_id, Geometry.user_id == current_user.id)
    )
    geometry = result.scalar_one_or_none()
    if geometry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Geometry not found")

    service = GeometryService(db)
    await service.delete(geometry)
