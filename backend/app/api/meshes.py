"""Mesh management endpoints (split workflow Phase 1)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.geometry import Geometry
from app.models.group import Group, GroupMembership
from app.models.job import Job
from app.models.mesh import Mesh
from app.models.user import User
from app.schemas.mesh import (
    MeshCreate,
    MeshListResponse,
    MeshResponse,
    MeshStatusResponse,
)
from app.services.mesh_service import MeshService

router = APIRouter(prefix="/api/meshes", tags=["meshes"])


async def _enrich(db: AsyncSession, mesh: Mesh) -> dict:
    d = {c.name: getattr(mesh, c.name) for c in mesh.__table__.columns}
    if mesh.geometry_id:
        gr = await db.execute(
            select(Geometry.original_name).where(Geometry.id == mesh.geometry_id)
        )
        d["geometry_name"] = gr.scalar_one_or_none()
    if mesh.group_id:
        gn = await db.execute(select(Group.name).where(Group.id == mesh.group_id))
        d["group_name"] = gn.scalar_one_or_none()
    if mesh.user_id:
        un = await db.execute(select(User.name).where(User.id == mesh.user_id))
        d["owner_name"] = un.scalar_one_or_none()
    count_res = await db.execute(
        select(func.count()).select_from(Job).where(Job.mesh_id == mesh.id)
    )
    d["jobs_using_count"] = count_res.scalar_one()
    return d


@router.post("", response_model=MeshResponse, status_code=status.HTTP_201_CREATED)
async def create_mesh(
    body: MeshCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a draft mesh record. Submit later via POST /{id}/submit."""
    service = MeshService(db)
    mesh = await service.create_mesh(user=current_user, data=body)
    return await _enrich(db, mesh)


@router.get("", response_model=MeshListResponse)
async def list_meshes(
    skip: int = 0,
    limit: int = 50,
    status_filter: str | None = None,
    geometry_id: uuid.UUID | None = None,
    group_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List the current user's meshes, or meshes shared with a group."""
    if group_id:
        mem = await db.execute(
            select(GroupMembership).where(
                GroupMembership.user_id == current_user.id,
                GroupMembership.group_id == group_id,
            )
        )
        if mem.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Not a member of this group")
        base_filter = Mesh.group_id == group_id
    else:
        base_filter = Mesh.user_id == current_user.id

    query = select(Mesh).where(base_filter)
    count_query = select(func.count()).select_from(Mesh).where(base_filter)

    if status_filter:
        query = query.where(Mesh.status == status_filter)
        count_query = count_query.where(Mesh.status == status_filter)

    if geometry_id:
        query = query.where(Mesh.geometry_id == geometry_id)
        count_query = count_query.where(Mesh.geometry_id == geometry_id)

    query = query.order_by(Mesh.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = list(result.scalars().all())
    total = (await db.execute(count_query)).scalar() or 0

    enriched = [await _enrich(db, m) for m in items]
    return {"items": enriched, "total": total}


@router.get("/{mesh_id}", response_model=MeshResponse)
async def get_mesh(
    mesh_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    result = await db.execute(select(Mesh).where(Mesh.id == mesh_id))
    mesh = result.scalar_one_or_none()
    if mesh is None:
        raise HTTPException(status_code=404, detail="Mesh not found")

    allowed = mesh.user_id == current_user.id
    if not allowed and mesh.group_id:
        mem = await db.execute(
            select(GroupMembership).where(
                GroupMembership.user_id == current_user.id,
                GroupMembership.group_id == mesh.group_id,
            )
        )
        allowed = mem.scalar_one_or_none() is not None

    if not allowed:
        raise HTTPException(status_code=404, detail="Mesh not found")

    return await _enrich(db, mesh)


@router.get("/{mesh_id}/status", response_model=MeshStatusResponse)
async def get_mesh_status(
    mesh_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Mesh:
    result = await db.execute(
        select(Mesh).where(Mesh.id == mesh_id, Mesh.user_id == current_user.id)
    )
    mesh = result.scalar_one_or_none()
    if mesh is None:
        raise HTTPException(status_code=404, detail="Mesh not found")
    return mesh


@router.post("/{mesh_id}/submit", response_model=MeshResponse)
async def submit_mesh(
    mesh_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    service = MeshService(db)
    mesh = await service.submit_mesh(user=current_user, mesh_id=mesh_id)
    return await _enrich(db, mesh)


@router.post("/{mesh_id}/sync", response_model=MeshResponse)
async def sync_mesh(
    mesh_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    service = MeshService(db)
    mesh = await service.sync_mesh_status(user=current_user, mesh_id=mesh_id)
    return await _enrich(db, mesh)


@router.post("/{mesh_id}/cancel", response_model=MeshResponse)
async def cancel_mesh(
    mesh_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    service = MeshService(db)
    mesh = await service.cancel_mesh(user=current_user, mesh_id=mesh_id)
    return await _enrich(db, mesh)


@router.delete("/{mesh_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mesh(
    mesh_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    service = MeshService(db)
    await service.delete_mesh(user=current_user, mesh_id=mesh_id)


@router.post("/find_reusable", response_model=MeshResponse | None)
async def find_reusable_mesh(
    body: MeshCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict | None:
    """Given a MeshCreate payload, return a completed mesh that matches the
    config hash (if any) — lets the wizard propose reuse before submitting."""
    service = MeshService(db)
    mesh_dict = body.mesh_config.model_dump()
    mesh = await service.find_reusable_mesh(
        user=current_user,
        geometry_id=body.geometry_id,
        mesh_config=mesh_dict,
        cfd_mode=body.cfd_mode,
    )
    if mesh is None:
        return None
    return await _enrich(db, mesh)
