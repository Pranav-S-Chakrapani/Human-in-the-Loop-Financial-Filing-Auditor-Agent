# LLM Provider Verification & Model Notes

Generated from live API probes on November 12, 2026.

---

## 1. Provider Status & Available Models

### Groq
- **API Status:** Operational.
- **Available Models Found:**
  - `openai/gpt-oss-120b` (Active, Tested & Responding)
  - `openai/gpt-oss-20b` (Active, Tested & Responding)
  - `qwen/qwen3.8-27b` (Active, Tested & Responding)
  - `allam-2-7b`
  - Safeguard & Whisper models
- **Deprecated / Retired Models:**
  - `llama-3.3-70b-versatile` (deprecated 2026-08-16, not in models list)
- **JSON Mode Support:** Supported via `response_format={"type": "json_object"}`.

#### Successful 1-Line Test Call:
- **`openai/gpt-oss-120b`:**
  ```json
  {"status":"ok"}
  ```
- **`openai/gpt-oss-20b`:**
  ```json
  {"status":"ok"}
  ```
- **`qwen/qwen3.8-27b`:**
  ```json
  {"status":"ok"}
  ```

---

### Google Gemini (`google-genai` SDK)
- **API Status:** Operational.
- **Available Models Probe:**
  - `gemini-2.5-flash`: **RETIRED / NOT AVAILABLE** (Returns 404: *"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements."*)
  - `gemini-2.0-flash`: **RETIRED** (Returns 404)
  - `gemini-1.5-flash`: **RETIRED** (Returns 404)
  - `gemini-3.5-flash`: **ACTIVE & RESPONDING**
  - `gemini-3.5-flash-lite`: **ACTIVE & RESPONDING**
  - `gemini-3.8-flash`: Available in model catalog, but currently intermittently experiencing 503 high demand spikes.
- **JSON Mode Support:** Supported via `config={"response_mime_type": "application/json", "temperature": 0}`.

#### Successful 1-Line Test Call:
- **`gemini-3.5-flash`:**
  ```json
  {"status": "ok"}
  ```
- **`gemini-3.5-flash-lite`:**
  ```json
  {"status": "ok"}
  ```

---

## 2. Rate Limits & Free Tier Specs

| Provider | Model | Free Tier RPM | Free Tier RPD | Free Tier TPM | Context Window |
|---|---|---|---|---|---|
| **Groq** | `openai/gpt-oss-120b` | 30 RPM | 14,400 RPD | 6,000 TPM | 128k |
| **Groq** | `openai/gpt-oss-20b` | 30 RPM | 14,400 RPD | 6,000 TPM | 128k |
| **Google** | `gemini-3.5-flash` | 15 RPM | 1,500 RPD | 1,000,000 TPM | 1M+ |
| **Google** | `gemini-3.5-flash-lite`| 30 RPM | 1,500 RPD | 1,000,000 TPM | 1M+ |

---

## 3. Best Choices for Fast JSON-Mode Financial Table Extraction

1. **Primary LLM: Groq `openai/gpt-oss-120b`**
   - **Why:** Ultra-fast inference on Groq LPU, strong instruction and structured JSON-following capability on tabulated data, natively supports `response_format={"type": "json_object"}`.
   - **Speed / Latency:** Sub-second response time (~200–400ms for statement table JSON output).
   - *Alternative fast Groq model:* `openai/gpt-oss-20b` (if 120b encounters token rate limit bursts).

2. **Fallback LLM: Gemini `gemini-3.5-flash` (or `gemini-3.5-flash-lite`)**
   - **Why:** Large context window, reliable JSON schema parsing, 1M token/min ceiling.
   - Recommended fallback if Groq returns 429 or during secondary extraction verification.

---

## 4. Discrepancies with SPEC.md §3 & Proposed `config.yaml` Settings

### Flagged Differences:
1. **Groq Model:**
   - SPEC / earlier templates referenced `llama-3.3-70b-versatile` (deprecated).
   - Verified active model: `openai/gpt-oss-120b`.
2. **Gemini Fallback Model:**
   - Prompt / earlier notes referenced `gemini-2.5-flash` (now returns 404 / retired).
   - Verified active and responding model: `gemini-3.5-flash` (or `gemini-3.5-flash-lite`).

### Recommended `config.yaml` Pin:
```yaml
llm:
  concurrency: 3
  primary:
    provider: "groq"
    model: "openai/gpt-oss-120b"
    temperature: 0
  fallback:
    provider: "gemini"
    model: "gemini-3.5-flash"
    temperature: 0
```
