import asyncio
import hashlib
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple
import httpx
from dotenv import load_dotenv

from backend.app.config import get_config
from backend.app.db import get_connection

load_dotenv()

DISK_CACHE_DIR = Path("data/cache/edgar")
DISK_CACHE_DIR.mkdir(parents=True, exist_ok=True)

class RateLimiter:
    def __init__(self, max_rps: float = 5.0):
        self.interval = 1.0 / max_rps if max_rps > 0 else 0.2
        self._last_call = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            if elapsed < self.interval:
                await asyncio.sleep(self.interval - elapsed)
            self._last_call = time.monotonic()

_limiter: Optional[RateLimiter] = None

def get_rate_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        cfg = get_config()
        _limiter = RateLimiter(cfg.edgar.max_rps)
    return _limiter

def get_user_agent() -> str:
    # Priority: .env EDGAR_USER_AGENT, then config
    env_ua = os.getenv("EDGAR_USER_AGENT")
    if env_ua and "@" in env_ua:
        return env_ua
    return get_config().edgar.user_agent

def get_cache_key(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()

def get_disk_cached(url: str) -> Optional[str]:
    key = get_cache_key(url)
    cache_file = DISK_CACHE_DIR / f"{key}.cache"
    if cache_file.exists():
        try:
            return cache_file.read_text(encoding="utf-8")
        except Exception:
            return None
    return None

def set_disk_cached(url: str, content: str) -> None:
    key = get_cache_key(url)
    cache_file = DISK_CACHE_DIR / f"{key}.cache"
    try:
        cache_file.write_text(content, encoding="utf-8")
    except Exception:
        pass

async def fetch_edgar(
    url: str,
    max_retries: int = 3,
    use_cache: bool = True
) -> Tuple[int, str]:
    """
    Fetch from SEC EDGAR with rate limiting, exponential backoff, User-Agent, and disk cache.
    RULES.md #17: User-Agent from config, rate limiter, retry/backoff on 429/5xx, disk-cached.
    """
    if use_cache:
        cached = get_disk_cached(url)
        if cached is not None:
            return 200, cached

    limiter = get_rate_limiter()
    ua = get_user_agent()
    headers = {
        "User-Agent": ua,
        "Accept-Encoding": "gzip, deflate"
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
        for attempt in range(1, max_retries + 1):
            await limiter.wait()
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    text = resp.text
                    if use_cache:
                        set_disk_cached(url, text)
                    return 200, text
                elif resp.status_code in (429, 500, 502, 503, 504):
                    backoff = 2 ** attempt
                    await asyncio.sleep(backoff)
                else:
                    return resp.status_code, resp.text
            except Exception as e:
                if attempt == max_retries:
                    raise
                await asyncio.sleep(2 ** attempt)

    return 500, "Max retries exceeded"
