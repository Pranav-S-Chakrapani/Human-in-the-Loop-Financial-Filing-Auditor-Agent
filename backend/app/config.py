import os
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from pydantic import BaseModel, Field

CONFIG_PATH = Path("config.yaml")

class ScoringWeights(BaseModel):
    agree: float = 0.5
    label: float = 0.3
    cross: float = 0.2

class LLMConfig(BaseModel):
    concurrency: int = 3
    model: str = "openai/gpt-oss-120b"
    fallback_model: str = "gemini-3.5-flash"

class EdgarConfig(BaseModel):
    max_rps: float = 5.0
    user_agent: str = "FilingAuditor your_real_email@example.com"

class AppConfig(BaseModel):
    confidence_threshold: float = 0.75
    yoy_threshold_pct: float = 50.0
    equation_tolerance_pct: float = 0.5
    disagree_cap: float = 0.4
    scoring_weights: ScoringWeights = Field(default_factory=ScoringWeights)
    max_review_rounds: int = 2
    llm: LLMConfig = Field(default_factory=LLMConfig)
    edgar: EdgarConfig = Field(default_factory=EdgarConfig)

_current_config: Optional[AppConfig] = None

def load_config() -> AppConfig:
    global _current_config
    if not CONFIG_PATH.exists():
        _current_config = AppConfig()
        save_config(_current_config)
        return _current_config
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    _current_config = AppConfig(**data)
    return _current_config

def save_config(cfg: AppConfig) -> None:
    global _current_config
    _current_config = cfg
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg.model_dump(), f, sort_keys=False)

def get_config() -> AppConfig:
    global _current_config
    if _current_config is None:
        return load_config()
    return _current_config
