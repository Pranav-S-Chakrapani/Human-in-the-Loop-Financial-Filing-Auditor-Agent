from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from backend.app.config import get_config, save_config, AppConfig

router = APIRouter(tags=["config"])

@router.get("/config")
def read_config() -> Dict[str, Any]:
    return get_config().model_dump()

@router.put("/config")
def update_config(new_cfg: AppConfig) -> Dict[str, Any]:
    save_config(new_cfg)
    return new_cfg.model_dump()
