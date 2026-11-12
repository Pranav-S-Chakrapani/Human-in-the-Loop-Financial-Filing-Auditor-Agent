import os
from typing import Any, Dict, Optional, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from backend.app.graph.nodes.toy import toy_step_a, toy_human_review, toy_step_b
from backend.app.graph.nodes.fetch import fetch_node

os.environ["LANGGRAPH_STRICT_MSGPACK"] = "true"

class GraphState(TypedDict, total=False):
    run_id: str
    ticker: str
    company: str
    cik: str
    accession: str
    fiscal_year: int
    doc_html_path: str
    current_review_id: str
    step_a_count: int
    step_b_count: int
    human_decision: Any
    reviewed: bool

def build_toy_graph(checkpointer: AsyncSqliteSaver):
    builder = StateGraph(GraphState)
    builder.add_node("step_a", toy_step_a)
    builder.add_node("human_review", toy_human_review)
    builder.add_node("step_b", toy_step_b)

    builder.add_edge(START, "step_a")
    builder.add_edge("step_a", "human_review")
    builder.add_edge("human_review", "step_b")
    builder.add_edge("step_b", END)

    return builder.compile(checkpointer=checkpointer)

def build_pipeline_graph(checkpointer: AsyncSqliteSaver):
    builder = StateGraph(GraphState)
    builder.add_node("fetch", fetch_node)
    # G1 wires fetch
    builder.add_edge(START, "fetch")
    builder.add_edge("fetch", END)

    return builder.compile(checkpointer=checkpointer)
