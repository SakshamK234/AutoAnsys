"""Simulation template request and response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    config: dict = {}
    is_shared: bool = False


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None
    config: dict | None
    is_shared: bool
    is_recommended: bool
    version: int
    created_at: datetime
