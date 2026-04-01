"""Celery application configuration."""

from celery import Celery

from app.config import settings

celery_app = Celery(
    "autoansys",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.job_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "poll-active-jobs": {
            "task": "app.tasks.job_tasks.poll_active_jobs",
            "schedule": float(settings.JOB_POLL_INTERVAL),
        },
    },
)
