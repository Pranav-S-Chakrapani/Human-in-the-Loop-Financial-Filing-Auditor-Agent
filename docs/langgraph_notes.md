# LangGraph Reference & Verified Call Signatures

Verified against installed package versions:
- `langgraph` == 1.2.20
- `langgraph-checkpoint-sqlite` == 3.1.3
- `langgraph-checkpoint` == 4.3.1

---

## 1. `interrupt()` and `Command(resume=...)`

### Import Path
```python
from langgraph.types import interrupt, Command
```

### Call Signatures
- **`interrupt(value: Any, *, response_schema: dict[str, Any] | type | None = None) -> Any`**
- **`Command(*, graph: str | None = None, update: Any | None = None, resume: dict[str, Any] | Any | None = None, goto: Send | Sequence[Send | N] | N = ()) -> None`**

### Verified Behavior & Usage
Per RULES.md #6:
- `interrupt()` must be the very first statement of its node, with no prior side effects.
- The node re-runs from the top upon resume.
- The value passed to `interrupt()` and `Command(resume=...)` must be JSON-serializable (dict/list/str/int/float/bool).

```python
# In the human_review node:
async def human_review(state: GraphState):
    # interrupt() is the FIRST statement:
    human_decision = interrupt({
        "type": "review_required",
        "review_id": state["current_review_id"],
        "metric": state["current_metric"],
        "original_value": state["current_value"],
        "reasons": state["current_reasons"],
    })
    # Execution resumes here with human_decision holding the resume value
    return {
        "decision": human_decision["decision"],
        "corrected_value": human_decision.get("corrected_value"),
        "reviewer_note": human_decision.get("note"),
    }
```

---

## 2. `AsyncSqliteSaver`

### Import Path
```python
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
```

### Instantiation from Connection String & FastAPI Lifespan Context Manager
`AsyncSqliteSaver.from_conn_string(conn_string: str) -> AsyncIterator[AsyncSqliteSaver]` is an asynchronous context manager.

RULES.md #11 requires:
- `checkpoints.db` separate from `app.db`
- `LANGGRAPH_STRICT_MSGPACK=true` in the environment

```python
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

# Enforce strict msgpack serialization per RULES #11
os.environ["LANGGRAPH_STRICT_MSGPACK"] = "true"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # AsyncSqliteSaver.from_conn_string yields an AsyncSqliteSaver instance
    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
        # Checkpointer setup: creates checkpoint tables in checkpoints.db
        await checkpointer.setup()
        app.state.checkpointer = checkpointer
        
        # Compile your graph using the checkpointer
        app.state.graph = workflow.compile(checkpointer=checkpointer)
        yield
```

---

## 3. Detecting Paused State and Resuming Runs

### Detecting Paused Runs (`__interrupt__` / `state.next`)
When a thread hits `interrupt()`:
1. `state = await graph.aget_state(config)`
2. `state.next` is a tuple containing the name of the interrupted node (e.g., `('human_review',)`).
3. `state.tasks` contains tasks with pending interrupts:
   ```python
   is_interrupted = bool(state.next) and any(len(t.interrupts) > 0 for t in state.tasks)
   ```
4. Interrupt details are accessible via `state.tasks[0].interrupts[0].value`.

### Resuming an Interrupted Thread with `Command(resume=...)`
```python
config = {"configurable": {"thread_id": run_id}}
# Resume passing plain JSON payload
resume_payload = {
    "decision": "approved",
    "note": "Audited and verified against source footnote",
}
result = await graph.ainvoke(Command(resume=resume_payload), config)
```

### Resuming an Unfinished / Crashed Run with `ainvoke(None, config)`
Per RULES.md #10 (Startup Reconciler for interrupted/crashed `running` runs):
```python
config = {"configurable": {"thread_id": run_id}}
# Calling ainvoke with None resumes execution from the latest durable checkpoint
result = await graph.ainvoke(None, config)
```

---

## 4. Declaring Parallel Branches Joining at One Node

In SPEC.md §3, `extract_rules` and `extract_llm` run in parallel and join at `score`:
`locate -> extract_rules || extract_llm -> score`

In `StateGraph`, parallel fan-out and join are declared with directed edges:
```python
from langgraph.graph import StateGraph, START, END

builder = StateGraph(State)

builder.add_node("locate", locate_node)
builder.add_node("extract_rules", extract_rules_node)
builder.add_node("extract_llm", extract_llm_node)
builder.add_node("score", score_node)

# Fan-out: locate fans out to both extractors
builder.add_edge("locate", "extract_rules")
builder.add_edge("locate", "extract_llm")

# Join / Fan-in: both extractors point to score
# LangGraph waits for all incoming branches to complete before executing score
builder.add_edge("extract_rules", "score")
builder.add_edge("extract_llm", "score")
```
When state fields are updated concurrently by parallel branches, define appropriate reducer annotations in `State` (e.g., `Annotated[dict, merge_dicts]` or distinct keys like `rules_metrics` and `llm_metrics`) so updates merge cleanly without collisions.
