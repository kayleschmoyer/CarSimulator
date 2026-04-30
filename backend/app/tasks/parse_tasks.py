import json
import redis

from app.config import settings
from app.tasks.celery_app import celery_app
from app.services.parse_pipeline.orchestrator import run_parse_pipeline

_redis = redis.from_url(settings.redis_url)


def _publish_progress(level_id: str, stage: str, message: str):
    _redis.publish(f"parse:{level_id}", json.dumps({"stage": stage, "message": message}))


@celery_app.task(bind=True, name="parse_floor_plan")
def parse_floor_plan(self, source_file_path: str, level_id: str, floor_elevation: float, upload_dir: str):
    """Celery task: run the full parse pipeline for a floor plan image."""
    try:
        def progress(stage, msg):
            _publish_progress(level_id, stage, msg)
            self.update_state(state="PROGRESS", meta={"stage": stage, "message": msg})

        result = run_parse_pipeline(
            source_file_path=source_file_path,
            level_id=level_id,
            floor_elevation=floor_elevation,
            upload_dir=upload_dir,
            progress_callback=progress,
        )

        _publish_progress(level_id, "complete", "Parse complete")
        return {"status": "complete", "level_id": level_id, "result": result}

    except Exception as exc:
        _publish_progress(level_id, "failed", str(exc))
        raise
