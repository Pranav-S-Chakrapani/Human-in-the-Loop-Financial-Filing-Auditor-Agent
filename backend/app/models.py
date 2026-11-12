from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

# --- Enums from CONTRACT.md ---

class RunStatus(str, Enum):
    queued = "queued"
    running = "running"
    paused = "paused"
    completed = "completed"
    failed = "failed"

class DecisionStatus(str, Enum):
    auto_approved = "auto_approved"
    pending_review = "pending_review"
    approved = "approved"
    corrected = "corrected"
    rejected = "rejected"
    not_reported = "not_reported"
    unresolved = "unresolved"

class Method(str, Enum):
    agree = "agree"
    rules_only = "rules_only"
    llm_only = "llm_only"
    derived = "derived"
    disagree = "disagree"

class ReasonCode(str, Enum):
    LOW_CONF = "LOW_CONF"
    EQ_FAIL = "EQ_FAIL"
    YOY_ANOMALY = "YOY_ANOMALY"
    CROSS_STATEMENT = "CROSS_STATEMENT"
    SEGMENT_MISMATCH = "SEGMENT_MISMATCH"
    NOT_FOUND = "NOT_FOUND"
    EXTRACTOR_DISAGREE = "EXTRACTOR_DISAGREE"

class CheckType(str, Enum):
    equation = "equation"
    yoy = "yoy"
    segment = "segment"
    cross_statement = "cross_statement"

class CheckStatus(str, Enum):
    passed = "passed"
    failed = "failed"
    skipped = "skipped"

class DecisionType(str, Enum):
    approve = "approve"
    correct = "correct"
    reject = "reject"

class PipelineNode(str, Enum):
    fetch = "fetch"
    locate = "locate"
    extract_rules = "extract_rules"
    extract_llm = "extract_llm"
    score = "score"
    validate = "validate"
    triage = "triage"
    enqueue_reviews = "enqueue_reviews"
    human_review = "human_review"
    apply_decisions = "apply_decisions"
    revalidate = "revalidate"
    ground_truth_verify = "ground_truth_verify"
    report = "report"

class FaultMode(str, Enum):
    wrong_column = "wrong_column"
    wrong_scale = "wrong_scale"
    wrong_row = "wrong_row"
    llm_hallucination = "llm_hallucination"

# --- Models ---

class ConfidenceBreakdown(BaseModel):
    agree: float = 0.0
    label: float = 0.0
    cross: float = 0.0
    sanity: float = 1.0
    cap_applied: bool = False

class SourceRef(BaseModel):
    table_id: Optional[str] = None
    row: Optional[int] = None
    col: Optional[int] = None
    edgar_url: Optional[str] = None

class MetricGroundTruth(BaseModel):
    value: Optional[float] = None
    correct: Optional[bool] = None

class Metric(BaseModel):
    metric_id: str
    run_id: str
    metric: str
    period_label: str
    period_end: str
    is_current: bool
    unit_label: str
    scale: int
    value_a: Optional[float] = None
    value_b: Optional[float] = None
    value_dollars: Optional[float] = None
    snippet_text: Optional[str] = None
    snippet_html: Optional[str] = None
    source_ref: Optional[Union[SourceRef, Dict[str, Any]]] = None
    confidence: float
    confidence_breakdown: Optional[Union[ConfidenceBreakdown, Dict[str, Any]]] = None
    method: Method
    decision_status: DecisionStatus
    final_value: Optional[float] = None
    fault_injected: bool = False
    ground_truth: Optional[Union[MetricGroundTruth, Dict[str, Any]]] = None

class Validation(BaseModel):
    validation_id: str
    check_type: CheckType
    metric: str
    status: CheckStatus
    phase: str
    detail: Optional[Dict[str, Any]] = None
    explanation: Optional[str] = None

class ReasonItem(BaseModel):
    code: ReasonCode
    text: str

class NodeRunSummary(BaseModel):
    node: str
    status: str
    finished_at: Optional[str] = None

class RunCreateRequest(BaseModel):
    companies: List[str]
    fault_mode: Optional[FaultMode] = None

class RunCreatedItem(BaseModel):
    run_id: str
    ticker: str
    status: RunStatus

class RunCreateResponse(BaseModel):
    runs: List[RunCreatedItem]

class RunCounts(BaseModel):
    metrics: int = 0
    auto_approved: int = 0
    pending: int = 0
    decided: int = 0

class RunSummary(BaseModel):
    run_id: str
    company: str
    ticker: str
    fiscal_year: int
    status: RunStatus
    current_node: Optional[str] = None
    counts: RunCounts
    created_at: str
    updated_at: str

class RunDetail(BaseModel):
    run_id: str
    company: str
    ticker: str
    cik: str
    accession: str
    fiscal_year: int
    status: RunStatus
    current_node: Optional[str] = None
    fault_mode: Optional[FaultMode] = None
    nodes: List[NodeRunSummary] = Field(default_factory=list)
    metrics: List[Metric] = Field(default_factory=list)
    validations: List[Validation] = Field(default_factory=list)
    last_checkpoint_at: Optional[str] = None

class ReviewSummary(BaseModel):
    review_id: str
    run_id: str
    company: str
    metric: str
    period_label: str
    round: int
    status: str
    actionable: bool
    reasons: List[ReasonItem] = Field(default_factory=list)
    confidence: float
    created_at: str

class HighlightRef(BaseModel):
    row: Optional[int] = None
    col: Optional[int] = None

class ExtractorComparison(BaseModel):
    rules: Optional[float] = None
    llm: Optional[float] = None

class ReviewDetail(BaseModel):
    review_id: str
    status: str
    actionable: bool
    round: int
    metric: Metric
    reasons: List[ReasonItem] = Field(default_factory=list)
    validations: List[Validation] = Field(default_factory=list)
    statement_html: Optional[str] = None
    highlight: Optional[HighlightRef] = None
    other_extractor: Optional[ExtractorComparison] = None
    decision: Optional[str] = None

class ReviewDecisionRequest(BaseModel):
    decision: DecisionType
    corrected_value: Optional[float] = None
    reviewer: str
    note: Optional[str] = ""

class ReviewDecisionResponse(BaseModel):
    review_id: str
    decision: DecisionType
    audit_seq: int
    audit_hash: str
    run_status: str
    duplicate: bool = False

class AuditLogRow(BaseModel):
    seq: int
    review_id: Optional[str] = None
    run_id: str
    company: str
    metric: str
    period: str
    original_value: Optional[float] = None
    corrected_value: Optional[float] = None
    decision: str
    reviewer: str
    note: Optional[str] = ""
    reasons: Union[List[str], str]
    confidence: float
    ts: str
    prev_hash: Optional[str] = None
    row_hash: str

class AuditVerifyResponse(BaseModel):
    ok: bool
    rows: int
    head_hash: Optional[str] = None
    first_bad_seq: Optional[int] = None

class AdminTamperResponse(BaseModel):
    update_blocked: bool
    delete_blocked: bool
    errors: List[str]

class AdminInjectFaultRequest(BaseModel):
    ticker: str
    mode: FaultMode

class HealthResponse(BaseModel):
    ok: bool
    checkpointer: str
    llm_calls: int
    audit_rows: int
    recovered_runs: List[str] = Field(default_factory=list)

class CountersResponse(BaseModel):
    llm_calls: int
    audit_rows: int
    events: int

class EventEnvelope(BaseModel):
    seq: int
    ts: str
    run_id: Optional[str] = None
    type: str
    payload: Dict[str, Any] = Field(default_factory=dict)
