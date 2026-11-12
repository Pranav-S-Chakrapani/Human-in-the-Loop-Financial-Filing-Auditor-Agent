import os
from typing import Any, Dict, Optional, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from backend.app.graph.nodes.toy import toy_step_a, toy_human_review, toy_step_b
from backend.app.graph.nodes.fetch import fetch_node
from backend.app.graph.nodes.locate import locate_node
from backend.app.graph.nodes.extract_rules import extract_rules_node
from backend.app.graph.nodes.extract_llm import extract_llm_node
from backend.app.graph.nodes.score import score_node
from backend.app.graph.nodes.validate import validate_node
from backend.app.graph.nodes.triage import triage_node

os.environ["LANGGRAPH_STRICT_MSGPACK"] = "true"

class GraphState(TypedDict, total=False):
    run_id: str
    ticker: str
    company: str
    cik: str
    accession: str
    fiscal_year: int
    doc_html_path: str
    fault_mode: Optional[str]
    current_review_id: str
    step_a_count: int
    step_b_count: int
    human_decision: Any
    reviewed: bool
    located_statements: Dict[str, Any]
    rules_metrics: Dict[str, Any]
    llm_metrics: Dict[str, Any]
    scored_metrics: Dict[str, Any]
    validations: list
    pending_reviews: list

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
    """
    G2 pipeline:
    fetch -> locate -> (extract_rules || extract_llm) -> score -> validate -> triage -> END
    """
    builder = StateGraph(GraphState)

    builder.add_node("fetch", fetch_node)
    builder.add_node("locate", locate_node)
    builder.add_node("extract_rules", extract_rules_node)
    builder.add_node("extract_llm", extract_llm_node)
    builder.add_node("score", score_node)
    builder.add_node("validate", validate_node)
    builder.add_node("triage", triage_node)

    builder.add_edge(START, "fetch")
    builder.add_edge("fetch", "locate")

    # Parallel extraction branches
    builder.add_edge("locate", "extract_rules")
    builder.add_edge("locate", "extract_llm")

    # Join at score
    builder.add_edge("extract_rules", "score")
    builder.add_edge("extract_llm", "score")

    builder.add_edge("score", "validate")
    builder.add_edge("validate", "triage")
    builder.add_edge("triage", END)

    return builder.compile(checkpointer=checkpointer)
