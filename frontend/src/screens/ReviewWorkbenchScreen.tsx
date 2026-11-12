import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchReviews,
  fetchReviewDetail,
  postReviewDecision,
  subscribeToEvents
} from '../api';
import {
  Check,
  Edit2,
  X,
  ExternalLink,
  Clock,
  ShieldCheck,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { MagneticButton } from '../components/MagneticButton';

export const ReviewWorkbenchScreen: React.FC = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'decided'>('pending');
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  // Decision editing states
  const [isEditing, setIsEditing] = useState(false);
  const [correctedValue, setCorrectedValue] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const reviewer = 'pranav';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReviews = useCallback(() => {
    fetchReviews('all').then((data) => {
      setReviews(data);
      if (data.length > 0 && !selectedReviewId) {
        setSelectedReviewId(data[0].review_id);
      }
    });
  }, [selectedReviewId]);

  useEffect(() => {
    loadReviews();
    const unsub = subscribeToEvents(() => {
      loadReviews();
    });
    return () => unsub();
  }, [loadReviews]);

  useEffect(() => {
    if (selectedReviewId) {
      fetchReviewDetail(selectedReviewId).then((res) => {
        setDetail(res);
        setIsEditing(false);
        setNote('');
        if (res && res.metric) {
          setCorrectedValue(res.metric.value_dollars?.toString() || '');
        }
      });
    }
  }, [selectedReviewId]);

  const handleDecision = async (decision: 'approve' | 'correct' | 'reject') => {
    if (!selectedReviewId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        decision,
        reviewer,
        note: note || (decision === 'approve' ? 'Approved in workbench' : 'Corrected in workbench')
      };
      if (decision === 'correct') {
        payload.corrected_value = parseFloat(correctedValue);
      }
      await postReviewDecision(selectedReviewId, payload);
      loadReviews();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcuts: A / E / R (RULES §15)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;
      if (!detail?.actionable) return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleDecision('approve');
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setIsEditing(true);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleDecision('reject');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detail, handleDecision]);

  const filteredReviews = reviews.filter((r) =>
    activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending'
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Screen Title & Keyboard shortcuts helper */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.08] pb-4 gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[rgba(232,179,57,0.1)] border border-[rgba(232,179,57,0.25)] text-[var(--signal,#E8B339)] text-[10px] font-mono uppercase tracking-wider mb-2">
            <span>DURABLE TRIAGE & INTERRUPTS</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-white tracking-[-0.02em] flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[var(--signal,#E8B339)]" />
            <span>Human Review Workbench</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Resolve extraction anomalies, verify accounting equations, and sign durable decisions backed by SQLite checkpointers.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono bg-[#141822]/80 border border-white/[0.08] px-3.5 py-2 rounded-xl text-slate-300 backdrop-blur-md shadow-sm">
          <span className="text-slate-500">Shortcuts:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#0B0E14] border border-white/[0.08] text-emerald-400 font-bold">A</kbd> Approve
          <kbd className="px-1.5 py-0.5 rounded bg-[#0B0E14] border border-white/[0.08] text-[var(--signal,#E8B339)] font-bold">E</kbd> Edit
          <kbd className="px-1.5 py-0.5 rounded bg-[#0B0E14] border border-white/[0.08] text-rose-400 font-bold">R</kbd> Reject
        </div>
      </div>

      {/* 3-Column Layout: Left Queue, Center Statement HTML, Right Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Review Queue (3 cols) */}
        <div className="lg:col-span-3 border border-white/[0.08] bg-[#141822]/85 rounded-2xl overflow-hidden backdrop-blur-xl flex flex-col h-[720px] shadow-xl">
          {/* Tab selector */}
          <div className="flex border-b border-white/[0.06] bg-[#0B0E14]/60 p-1.5">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-[var(--signal,#E8B339)] text-[#090C12] shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Pending ({reviews.filter((r) => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('decided')}
              className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'decided'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Decided ({reviews.filter((r) => r.status !== 'pending').length})
            </button>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredReviews.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-16 font-mono">No {activeTab} reviews</div>
            ) : (
              filteredReviews.map((r) => {
                const isSelected = r.review_id === selectedReviewId;
                return (
                  <div
                    key={r.review_id}
                    onClick={() => setSelectedReviewId(r.review_id)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[var(--signal,#E8B339)] border-l-4 border-l-[var(--signal,#E8B339)] bg-[var(--signal,#E8B339)]/10 shadow-[0_0_20px_rgba(232,179,57,0.2)]'
                        : 'border-white/[0.05] bg-[#0B0E14]/60 hover:border-white/[0.12] hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-md bg-[#1B1F28] border border-white/[0.08] flex items-center justify-center font-mono font-bold text-white text-[11px]">
                          {r.company?.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-bold font-mono text-white text-xs">{r.company}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        r.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    <div className="text-slate-200 font-semibold font-sans capitalize mb-2 pl-8">
                      {r.metric.replace(/_/g, ' ')}
                    </div>

                    {/* Reason chips */}
                    <div className="flex flex-wrap gap-1">
                      {r.reasons?.map((reason: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-[10px] font-mono text-rose-300"
                        >
                          {reason.code || reason}
                        </span>
                      ))}
                    </div>

                    {!r.actionable && r.status === 'pending' && (
                      <div className="mt-2 text-[10px] text-slate-500 italic flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-600" /> Queued behind head review
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Statement HTML Viewer (5 cols) */}
        <div className="lg:col-span-5 border border-white/[0.08] bg-[#141822]/85 rounded-2xl p-5 flex flex-col h-[720px] backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2 font-mono">
              <FileText className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>SEC 10-K Located Statement Table</span>
            </h3>
            {detail?.metric?.source_ref?.edgar_url && (
              <a
                href={detail.metric.source_ref.edgar_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--signal,#E8B339)] hover:brightness-110 flex items-center space-x-1 font-mono"
              >
                <span>EDGAR Source</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div
            className="flex-1 overflow-auto bg-[#0B0E14] p-4 rounded-xl border border-white/[0.06] font-sans text-xs leading-relaxed text-slate-300 shadow-inner [&_table]:w-full [&_table]:border-collapse [&_th]:p-2.5 [&_th]:bg-[#121622] [&_th]:text-slate-400 [&_th]:font-mono [&_th]:text-[11px] [&_td]:p-2 [&_td]:border-b [&_td]:border-white/[0.04] [&_tr:hover]:bg-white/[0.03]"
            dangerouslySetInnerHTML={{
              __html: detail?.statement_html
                ? (detail.statement_html.trim().startsWith('<table')
                    ? detail.statement_html
                    : `<table class="w-full text-xs text-left border-collapse"><tbody>${detail.statement_html}</tbody></table>`)
                : '<div class="text-slate-500 p-8 text-center font-mono">No statement HTML available for this review record</div>'
            }}
          />
        </div>

        {/* Right Column: Review Inspector & Decision Box (4 cols) */}
        <div className="lg:col-span-4 border border-white/[0.08] bg-[#141822]/85 rounded-2xl p-5 flex flex-col h-[720px] backdrop-blur-xl overflow-y-auto space-y-4 shadow-xl">
          <div className="border-b border-white/[0.06] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center space-x-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>Inspection & Decision Station</span>
            </h3>
          </div>

          {detail?.metric ? (
            <div className="space-y-4">
              {/* Metric & Confidence Ring */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Target Metric</div>
                  <div className="text-base font-bold text-white capitalize font-display">
                    {detail.metric.metric.replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Confidence Score</div>
                  <div className={`text-base font-mono font-extrabold ${
                    detail.metric.confidence >= 0.75 ? 'text-emerald-400' : 'text-[var(--signal,#E8B339)]'
                  }`}>
                    {(detail.metric.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Both Extractor Values Comparison */}
              <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.06] space-y-2 text-xs">
                <div className="text-slate-400 font-mono text-[11px] uppercase tracking-wider mb-1">
                  Corroboration Breakdown
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                  <span className="text-slate-400 font-sans">Rules Extractor:</span>
                  <span className="font-mono text-slate-200 font-bold">
                    {detail.other_extractor?.rules != null ? `$${detail.other_extractor.rules.toLocaleString()}` : 'null'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-400 font-sans">LLM Visual Extractor:</span>
                  <span className="font-mono text-slate-200 font-bold">
                    {detail.other_extractor?.llm != null ? `$${detail.other_extractor.llm.toLocaleString()}` : 'null'}
                  </span>
                </div>
              </div>

              {/* Reasons & Anomaly explanations */}
              <div className="space-y-2 text-xs">
                <div className="text-slate-400 font-mono text-[11px] uppercase tracking-wider">Triage Flag Reasons</div>
                {detail.reasons?.map((reason: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                    <strong className="block font-mono text-[11px] mb-0.5">{reason.code}</strong>
                    <span className="font-sans text-xs">{reason.text}</span>
                  </div>
                ))}
              </div>

              {/* Decision Section */}
              <div className="pt-3 border-t border-white/[0.06] space-y-3">
                <div className="text-xs text-slate-300 font-mono uppercase tracking-wider font-bold">
                  Decision Controls
                </div>

                {/* Inline Editing */}
                {isEditing ? (
                  <div className="space-y-3 p-4 rounded-xl bg-[#0B0E14] border border-[var(--signal,#E8B339)]/40">
                    <div>
                      <label className="text-[11px] text-slate-400 font-mono block mb-1">Corrected Value ($)</label>
                      <input
                        type="number"
                        value={correctedValue}
                        onChange={(e) => setCorrectedValue(e.target.value)}
                        className="w-full bg-[#141822] border border-white/[0.12] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[var(--signal,#E8B339)]"
                        placeholder="Enter corrected dollars"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-mono block mb-1">Reviewer Note (Audit Log)</label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full bg-[#141822] border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--signal,#E8B339)] font-sans"
                        placeholder="e.g. Corrected to consolidated line item"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecision('correct')}
                        className="flex-1 py-2 rounded-lg bg-[var(--signal,#E8B339)] hover:brightness-110 text-[#090C12] font-bold text-xs cursor-pointer font-sans"
                      >
                        Submit Correction
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs cursor-pointer font-sans"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Value Display */}
                    <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.06] text-center mb-3">
                      <div className="text-[10px] text-slate-500 font-mono mb-0.5 uppercase tracking-wider">Current Extracted Figure</div>
                      <div className="text-2xl font-mono font-bold text-white">
                        {detail.metric.value_dollars != null
                          ? `$${detail.metric.value_dollars.toLocaleString()}`
                          : 'null'}
                      </div>
                    </div>

                    {/* Action buttons with Magnetic Pull */}
                    <div className="flex gap-2">
                      <MagneticButton
                        radius={20}
                        onClick={() => handleDecision('approve')}
                        disabled={!detail.actionable || isSubmitting}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:brightness-110 active:scale-[0.98] disabled:opacity-30 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all font-sans"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Approve (A)</span>
                      </MagneticButton>

                      <MagneticButton
                        radius={20}
                        onClick={() => setIsEditing(true)}
                        disabled={!detail.actionable || isSubmitting}
                        className="flex-1 py-2.5 rounded-xl bg-[var(--signal,#E8B339)] hover:brightness-110 active:scale-[0.98] disabled:opacity-30 text-[#090C12] font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-[0_0_15px_rgba(232,179,57,0.3)] transition-all font-sans"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit (E)</span>
                      </MagneticButton>

                      <MagneticButton
                        radius={20}
                        onClick={() => handleDecision('reject')}
                        disabled={!detail.actionable || isSubmitting}
                        className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:brightness-110 active:scale-[0.98] disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all font-sans"
                      >
                        <X className="w-4 h-4 stroke-[3]" />
                        <span>Reject (R)</span>
                      </MagneticButton>
                    </div>

                    {!detail.actionable && (
                      <div className="mt-3 text-center text-xs text-slate-500 italic font-mono">
                        Item queued behind head review · Active after earlier items commit
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 text-xs py-24 font-mono">Select a review item on the left to inspect</div>
          )}
        </div>
      </div>
    </div>
  );
};
