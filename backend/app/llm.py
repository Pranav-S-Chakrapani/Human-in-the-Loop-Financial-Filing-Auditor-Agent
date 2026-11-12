import asyncio
import hashlib
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from dotenv import load_dotenv

from backend.app.config import get_config
from backend.app.db import get_connection

load_dotenv()

# Real network call counters per RULES #9
_UNIQUE_NETWORK_CALLS: int = 0
_DUPLICATE_CACHED_CALLS: int = 0
_SEMAPHORE: Optional[asyncio.Semaphore] = None

def get_semaphore() -> asyncio.Semaphore:
    global _SEMAPHORE
    if _SEMAPHORE is None:
        cfg = get_config()
        _SEMAPHORE = asyncio.Semaphore(cfg.llm.concurrency)
    return _SEMAPHORE

def get_llm_counters() -> Dict[str, int]:
    return {
        "unique_llm_calls": _UNIQUE_NETWORK_CALLS,
        "duplicate_llm_calls": _DUPLICATE_CACHED_CALLS
    }

def compute_cache_key(model: str, prompt: str) -> str:
    """sha256(model + prompt) per RULES.md #9."""
    to_hash = (model + prompt).encode("utf-8")
    return hashlib.sha256(to_hash).hexdigest()

def get_cached_response(cache_key: str, db_path: Optional[Path] = None) -> Optional[str]:
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT response FROM llm_calls WHERE cache_key = ?", (cache_key,))
        row = cursor.fetchone()
        return row["response"] if row else None
    finally:
        conn.close()

def store_cached_response(cache_key: str, model: str, response: str, db_path: Optional[Path] = None) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO llm_calls (cache_key, model, response, ts) VALUES (?, ?, ?, ?)",
            (cache_key, model, response, now_iso)
        )
        conn.commit()
    finally:
        conn.close()

async def call_groq(model: str, prompt: str, system: Optional[str] = None, json_mode: bool = True) -> str:
    """Execute Groq call asynchronously."""
    import groq
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise ValueError("GROQ_API_KEY missing in environment")

    client = groq.AsyncGroq(api_key=groq_api_key)
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": 0
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    resp = await client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""

async def call_gemini_fallback(model: str, prompt: str, system: Optional[str] = None, json_mode: bool = True) -> str:
    """Fallback to Gemini using google-genai SDK per docs/llm_notes.md."""
    from google import genai
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise ValueError("GEMINI_API_KEY missing in environment")

    client = genai.Client(api_key=gemini_api_key)
    config = {"temperature": 0}
    if json_mode:
        config["response_mime_type"] = "application/json"
    if system:
        config["system_instruction"] = system

    loop = asyncio.get_event_loop()
    # google-genai Client.models.generate_content in thread pool
    resp = await loop.run_in_executor(
        None,
        lambda: client.models.generate_content(
            model=model,
            contents=prompt,
            config=config
        )
    )
    return resp.text or ""

async def completion(
    prompt: str,
    system: Optional[str] = None,
    model: Optional[str] = None,
    json_mode: bool = True,
    db_path: Optional[Path] = None
) -> str:
    """
    Central LLM call with caching, bounded concurrency, counters, and fallback.
    RULES.md #9: all LLM calls go through llm.py, cached in llm_calls BEFORE returning.
    """
    global _UNIQUE_NETWORK_CALLS, _DUPLICATE_CACHED_CALLS
    cfg = get_config()
    target_model = model or cfg.llm.model

    full_prompt_sig = f"{system or ''}\n{prompt}"
    cache_key = compute_cache_key(target_model, full_prompt_sig)

    # 1. Check cache first
    cached = get_cached_response(cache_key, db_path)
    if cached is not None:
        _DUPLICATE_CACHED_CALLS += 1
        return cached

    # 2. Bounded concurrency call
    semaphore = get_semaphore()
    async with semaphore:
        # Re-check cache inside semaphore to avoid race conditions
        cached = get_cached_response(cache_key, db_path)
        if cached is not None:
            _DUPLICATE_CACHED_CALLS += 1
            return cached

        try:
            res = await call_groq(target_model, prompt, system, json_mode)
        except Exception as e:
            # Fallback to Gemini
            fallback_model = cfg.llm.fallback_model
            res = await call_gemini_fallback(fallback_model, prompt, system, json_mode)

        # Cache before returning (RULES.md #9)
        store_cached_response(cache_key, target_model, res, db_path)
        _UNIQUE_NETWORK_CALLS += 1
        return res
