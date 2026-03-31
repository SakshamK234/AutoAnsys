"""Group management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.group import Group, GroupMembership
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupDetailResponse,
    GroupJoinRequest,
    GroupResponse,
    MemberResponse,
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    group = Group(
        name=body.name.strip(),
        description=body.description,
        created_by=current_user.id,
    )
    db.add(group)
    await db.flush()

    membership = GroupMembership(
        user_id=current_user.id,
        group_id=group.id,
        role="owner",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(group)

    return {
        **{c.name: getattr(group, c.name) for c in group.__table__.columns},
        "member_count": 1,
    }


@router.get("", response_model=list[GroupResponse])
async def list_my_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all groups the current user is a member of."""
    my_group_ids = select(GroupMembership.group_id).where(
        GroupMembership.user_id == current_user.id
    )
    result = await db.execute(
        select(Group).where(Group.id.in_(my_group_ids)).order_by(Group.created_at.desc())
    )
    groups = list(result.scalars().all())

    out = []
    for g in groups:
        count_q = select(func.count()).select_from(GroupMembership).where(
            GroupMembership.group_id == g.id
        )
        count = (await db.execute(count_q)).scalar() or 0
        out.append({
            **{c.name: getattr(g, c.name) for c in g.__table__.columns},
            "member_count": count,
        })
    return out


@router.get("/{group_id}", response_model=GroupDetailResponse)
async def get_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    await _assert_membership(db, current_user.id, group_id)

    result = await db.execute(
        select(Group)
        .options(selectinload(Group.memberships))
        .where(Group.id == group_id)
    )
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    members = []
    for m in group.memberships:
        user_result = await db.execute(select(User).where(User.id == m.user_id))
        user = user_result.scalar_one_or_none()
        members.append(MemberResponse(
            id=m.id,
            user_id=m.user_id,
            role=m.role,
            joined_at=m.joined_at,
            user_name=user.name if user else None,
            user_email=user.email if user else None,
        ))

    return {
        **{c.name: getattr(group, c.name) for c in group.__table__.columns},
        "member_count": len(members),
        "members": members,
    }


@router.post("/join", response_model=GroupResponse)
async def join_group(
    body: GroupJoinRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(Group).where(Group.invite_code == body.invite_code.strip())
    )
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    existing = await db.execute(
        select(GroupMembership).where(
            GroupMembership.user_id == current_user.id,
            GroupMembership.group_id == group.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already a member of this group")

    membership = GroupMembership(
        user_id=current_user.id,
        group_id=group.id,
        role="member",
    )
    db.add(membership)
    await db.commit()

    count_q = select(func.count()).select_from(GroupMembership).where(
        GroupMembership.group_id == group.id
    )
    count = (await db.execute(count_q)).scalar() or 0

    return {
        **{c.name: getattr(group, c.name) for c in group.__table__.columns},
        "member_count": count,
    }


async def _assert_membership(db: AsyncSession, user_id: uuid.UUID, group_id: uuid.UUID) -> None:
    result = await db.execute(
        select(GroupMembership).where(
            GroupMembership.user_id == user_id,
            GroupMembership.group_id == group_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Not a member of this group")
