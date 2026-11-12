import os
from typing import Any, Dict, Optional, TypedDict, Literal
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
from backend.app.graph.nodes.enqueue_reviews import enqueue_reviews_node
from backend.app.graph.nodes.human_review import human_review_node
from backend.app.graph.nodes.apply_decisions import apply_decisions_node
from backend.app.graph.nodes.revalidate import revalidate_node
from backend.app.graph.nodes.verify import ground_truth_verify_node
from backend.app.graph.nodes.report import report_node

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
    current_review_id: Optional[str]
    reviewed_id: Optional[str]
    review_queue: list
    human_decision: Any
    needs_revalidate: bool
    step_a_count: int
    step_b_count: int
    located_statements: Dict[str, Any]
    rules_metrics: Dict[str, Any]
    llm_metrics: Dict[str, Any]
    scored_metrics: Dict[str, Any]
    validations: list
    pending_reviews: list
    ground_truth_results: Dict[str, Any]
    final_accuracy: float
    escalated_count: int

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

def route_after_enqueue(state: GraphState) -> Literal["human_review", "ground_truth_verify"]:
    """If there are pending reviews in the queue, route to human_review, else skip to verify."""
    queue = state.get("review_queue") or []
    if len(queue) > 0 and state.get("current_review_id"):
        return "human_review"
    return "ground_truth_verify"

def route_after_apply_decisions(state: GraphState) -> Literal["revalidate", "human_review", "ground_truth_verify"]:
    """
    If correction requires revalidate -> revalidate.
    Else if more reviews remain in queue -> human_review loop.
    Else -> ground_truth_verify.
    """
    if state.get("needs_revalidate"):
        return "revalidate"
    queue = state.get("review_queue") or []
    if len(queue) > 0 and state.get("current_review_id"):
        return "human_review"
    return "ground_truth_verify"

def route_after_revalidate(state: GraphState) -> Literal["human_review", "ground_truth_verify"]:
    queue = state.get("review_queue") or []
    if len(queue) > 0 and state.get("current_review_id"):
        return "human_review"
    return "ground_truth_verify"

def build_pipeline_graph(checkpointer: AsyncSqliteSaver):
    """
    Full G3 Pipeline:
    fetch -> locate -> (extract_rules || extract_llm) -> score -> validate -> triage
    -> enqueue_reviews -> [route: human_review loop <-> apply_decisions <-> revalidate]
    -> ground_truth_verify -> report -> END
    """
    builder = StateGraph(GraphState)

    builder.add_node("fetch", fetch_node)
    builder.add_node("locate", locate_node)
    builder.add_node("extract_rules", extract_rules_node)
    builder.add_node("extract_llm", extract_llm_node)
    builder.add_node("score", score_node)
    builder.add_node("validate", validate_node)
    builder.add_node("triage", triage_node)
    builder.add_node("enqueue_reviews", enqueue_reviews_node)
    builder.add_node("human_review", human_review_node)
    builder.add_node("apply_decisions", apply_decisions_node)
    builder.add_node("revalidate", revalidate_node)
    builder.add_node("ground_truth_verify", ground_truth_verify_node)
    builder.add_node("report", report_node)

    builder.add_edge(START, "fetch")
    builder.add_edge("fetch", "locate")

    # Parallel extraction branches joining at score
    builder.add_edge("locate", "extract_rules")
    builder.add_edge("locate", "extract_llm")
    builder.add_edge("extract_rules", "score")
    builder.add_edge("extract_llm", "score")

    builder.add_edge("score", "validate")
    builder.add_edge("validate", "triage")
    builder.add_edge("triage", "enqueue_reviews")

    # Human review routing
    builder.add_conditional_edges("enqueue_reviews", route_after_enqueue)
    builder.add_edge("human_review", "apply_decisions")
    builder.add_conditional_edges("apply_decisions", route_after_apply_decisions)
    builder.add_conditional_edges("revalidate", route_after_revalidate)

    builder.add_edge("ground_truth_verify", "report")
    builder.add_edge("report", END)

    return builder.compile(checkpointer=checkpointer)
