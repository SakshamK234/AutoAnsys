"""Group request and response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GroupCreate(BaseModel):
    name: str
    description: str | None = None


class GroupJoinRequest(BaseModel):
    invite_code: str


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    joined_at: datetime
    user_name: str | None = None
    user_email: str | None = None


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    invite_code: str
    created_by: uuid.UUID
    created_at: datetime
    member_count: int = 0


class GroupDetailResponse(GroupResponse):
    members: list[MemberResponse] = []
