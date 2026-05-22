"""WebSocket endpoint for live job status and data streaming."""

import asyncio
import json
import logging
import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select

from app.auth.jwt import verify_token
from app.config import settings
from app.database import async_session
from app.models.job import Job
from app.models.mesh import Mesh

logger = logging.getLogger(__name__)

router = APIRouter()


async def _authenticate(token: str) -> uuid.UUID | None:
    payload = verify_token(token)
    if payload is None or payload.get("type") != "access":
        return None
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None


@router.websocket("/ws/jobs/{job_id}/live")
async def job_live(
    websocket: WebSocket,
    job_id: str,
    token: str = Query(default=""),
):
    """Stream real-time events for a specific job.

    Authenticates via a ``token`` query parameter, verifies job ownership,
    then subscribes to the Redis pub/sub channel ``job:{id}:events`` and
    forwards every message to the WebSocket client.
    """
    user_id = await _authenticate(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        await websocket.close(code=4002, reason="Invalid job ID")
        return

    async with async_session() as db:
        result = await db.execute(
            select(Job).where(Job.id == job_uuid, Job.user_id == user_id)
        )
        job = result.scalar_one_or_none()
        if job is None:
            await websocket.close(code=4003, reason="Job not found")
            return
        initial_status = job.status.value if hasattr(job.status, "value") else str(job.status)

    await websocket.accept()

    r = aioredis.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    channel = f"job:{job_id}:events"
    await pubsub.subscribe(channel)

    async def _redis_listener():
        """Forward Redis pub/sub messages to the WebSocket."""
        try:
            async for msg in pubsub.listen():
                if msg["type"] == "message":
                    try:
                        payload = json.loads(msg["data"])
                        await websocket.send_json(payload)
                    except Exception:
                        break
        except asyncio.CancelledError:
            pass

    listener_task = asyncio.create_task(_redis_listener())

    try:
        await websocket.send_json({
            "type": "status_update",
            "data": {"status": initial_status},
        })

        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception:
        logger.debug("WebSocket closed for job %s", job_id)
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await r.aclose()


@router.websocket("/ws/meshes/{mesh_id}/live")
async def mesh_live(
    websocket: WebSocket,
    mesh_id: str,
    token: str = Query(default=""),
):
    """Stream real-time events for a specific mesh (split workflow Phase 1)."""
    user_id = await _authenticate(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    try:
        mesh_uuid = uuid.UUID(mesh_id)
    except ValueError:
        await websocket.close(code=4002, reason="Invalid mesh ID")
        return

    async with async_session() as db:
        result = await db.execute(
            select(Mesh).where(Mesh.id == mesh_uuid, Mesh.user_id == user_id)
        )
        mesh = result.scalar_one_or_none()
        if mesh is None:
            await websocket.close(code=4003, reason="Mesh not found")
            return
        initial_status = mesh.status.value if hasattr(mesh.status, "value") else str(mesh.status)

    await websocket.accept()

    r = aioredis.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    channel = f"mesh:{mesh_id}:events"
    await pubsub.subscribe(channel)

    async def _redis_listener():
        try:
            async for msg in pubsub.listen():
                if msg["type"] == "message":
                    try:
                        payload = json.loads(msg["data"])
                        await websocket.send_json(payload)
                    except Exception:
                        break
        except asyncio.CancelledError:
            pass

    listener_task = asyncio.create_task(_redis_listener())

    try:
        await websocket.send_json({
            "type": "status_update",
            "data": {"status": initial_status},
        })
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception:
        logger.debug("WebSocket closed for mesh %s", mesh_id)
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await r.aclose()
