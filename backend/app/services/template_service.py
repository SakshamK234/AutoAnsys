"""Template service — business logic for simulation templates."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.template import SimulationTemplate
from app.models.user import User
from app.schemas.template import TemplateCreate


class TemplateService:
    """CRUD operations for simulation templates."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_template(self, user: User, data: TemplateCreate) -> SimulationTemplate:
        template = SimulationTemplate(
            user_id=user.id,
            name=data.name,
            description=data.description,
            config=data.config,
            is_shared=data.is_shared,
        )
        self.db.add(template)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def list_templates(self, user: User) -> list[SimulationTemplate]:
        result = await self.db.execute(
            select(SimulationTemplate).where(
                or_(
                    SimulationTemplate.user_id == user.id,
                    SimulationTemplate.is_shared.is_(True),
                    SimulationTemplate.is_recommended.is_(True),
                )
            )
        )
        return list(result.scalars().all())

    async def get_template(self, template_id: uuid.UUID) -> SimulationTemplate:
        result = await self.db.execute(
            select(SimulationTemplate).where(SimulationTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        if template is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        return template
