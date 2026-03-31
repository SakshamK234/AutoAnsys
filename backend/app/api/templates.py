"""Simulation template CRUD endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.template import SimulationTemplate
from app.models.user import User
from app.schemas.template import TemplateCreate, TemplateResponse

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SimulationTemplate:
    """Create a new simulation template."""
    template = SimulationTemplate(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        config=body.config,
        is_shared=body.is_shared,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SimulationTemplate]:
    """List templates visible to the current user (own + shared + recommended)."""
    result = await db.execute(
        select(SimulationTemplate).where(
            or_(
                SimulationTemplate.user_id == current_user.id,
                SimulationTemplate.is_shared.is_(True),
                SimulationTemplate.is_recommended.is_(True),
            )
        )
    )
    return list(result.scalars().all())


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SimulationTemplate:
    """Get a single template by ID."""
    result = await db.execute(
        select(SimulationTemplate).where(SimulationTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SimulationTemplate:
    """Update an existing template (owner only)."""
    result = await db.execute(
        select(SimulationTemplate).where(
            SimulationTemplate.id == template_id,
            SimulationTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    template.name = body.name
    template.description = body.description
    template.config = body.config
    template.is_shared = body.is_shared
    template.version += 1
    await db.flush()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a template (owner only)."""
    result = await db.execute(
        select(SimulationTemplate).where(
            SimulationTemplate.id == template_id,
            SimulationTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    await db.delete(template)
