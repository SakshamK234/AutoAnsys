"""Geometry request and response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GeometryCreate(BaseModel):
    component_name: str | None = None
    description: str | None = None
    tags: list[str] = []


class GeometryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    filename: str
    original_name: str
    component_name: str | None
    description: str | None
    tags: list[str] | None
    version: int
    file_size: int
    s3_key: str
    created_at: datetime


class GeometryList(BaseModel):
    items: list[GeometryResponse]
    total: int
