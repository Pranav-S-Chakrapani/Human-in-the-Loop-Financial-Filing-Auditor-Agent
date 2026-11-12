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
  ShieldCheck
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
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>Human Review Workbench</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Resolve extraction anomalies, verify accounting equations, and sign durable decisions.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
          <span>Shortcuts:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400 font-bold">A</kbd> Approve
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-400 font-bold">E</kbd> Edit
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-rose-400 font-bold">R</kbd> Reject
        </div>
      </div>

      {/* 3-Column Layout: Left Queue, Center Statement HTML, Right Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Review Queue (3 cols) */}
        <div className="lg:col-span-3 border border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden backdrop-blur flex flex-col h-[700px]">
          {/* Tab selector */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 p-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'pending' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending ({reviews.filter((r) => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('decided')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'decided' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              Decided ({reviews.filter((r) => r.status !== 'pending').length})
            </button>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredReviews.length === 0 ? (
              <div className="text-center text-slate-600 text-xs py-10">No {activeTab} reviews</div>
            ) : (
              filteredReviews.map((r) => {
                const isSelected = r.review_id === selectedReviewId;
                return (
                  <div
                    key={r.review_id}
                    onClick={() => setSelectedReviewId(r.review_id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/10 shadow-md shadow-sky-500/10'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold font-mono text-slate-200">{r.company}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    <div className="text-slate-300 font-medium capitalize mb-2">
                      {r.metric.replace(/_/g, ' ')}
                    </div>

                    {/* Reason chips */}
                    <div className="flex flex-wrap gap-1">
                      {r.reasons?.map((reason: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-300"
                        >
                          {reason.code || reason}
                        </span>
                      ))}
                    </div>

                    {!r.actionable && r.status === 'pending' && (
                      <div className="mt-2 text-[10px] text-slate-500 italic flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Queued behind head
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Statement HTML Viewer (5 cols) */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/40 rounded-xl p-5 flex flex-col h-[700px] backdrop-blur">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              10-K Located Statement Table
            </h3>
            {detail?.metric?.source_ref?.edgar_url && (
              <a
                href={detail.metric.source_ref.edgar_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1"
              >
                <span>Open on EDGAR</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div
            className="flex-1 overflow-auto bg-slate-950 p-4 rounded-lg border border-slate-800 font-sans text-xs leading-relaxed text-slate-300"
            dangerouslySetInnerHTML={{ __html: detail?.statement_html || '<div class="text-slate-500">No statement HTML available</div>' }}
          />
        </div>

        {/* Right Column: Review Inspector & Decision Box (4 cols) */}
        <div className="lg:col-span-4 border border-slate-800 bg-slate-900/40 rounded-xl p-5 flex flex-col h-[700px] backdrop-blur overflow-y-auto space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Metric Inspection & Decision
            </h3>
          </div>

          {detail?.metric ? (
            <div className="space-y-4">
              {/* Metric & Confidence Ring */}
              <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Metric</div>
                  <div className="text-base font-bold text-white capitalize">
                    {detail.metric.metric.replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Confidence</div>
                  <div className={`text-base font-mono font-extrabold ${
                    detail.metric.confidence >= 0.75 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {(detail.metric.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Both Extractor Values Comparison */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="text-slate-400 font-semibold mb-1">Dual Extractor Comparison</div>
                <div className="flex justify-between items-center py-1 border-b border-slate-900">
                  <span className="text-slate-400">Rules Extractor:</span>
                  <span className="font-mono text-slate-200 font-bold">
                    {detail.other_extractor?.rules != null ? `$${detail.other_extractor.rules.toLocaleString()}` : 'null'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">LLM Extractor:</span>
                  <span className="font-mono text-slate-200 font-bold">
                    {detail.other_extractor?.llm != null ? `$${detail.other_extractor.llm.toLocaleString()}` : 'null'}
                  </span>
                </div>
              </div>

              {/* Reasons & Anomaly explanations */}
              <div className="space-y-2 text-xs">
                <div className="text-slate-400 font-semibold">Triage Reasons</div>
                {detail.reasons?.map((reason: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
                    <strong className="block font-mono text-[11px] mb-0.5">{reason.code}</strong>
                    <span>{reason.text}</span>
                  </div>
                ))}
              </div>

              {/* Decision Section */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                  Reviewer Decision
                </div>

                {/* Inline Editing */}
                {isEditing ? (
                  <div className="space-y-3 p-3 rounded-lg bg-slate-950 border border-amber-500/40">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Corrected Value ($)</label>
                      <input
                        type="number"
                        value={correctedValue}
                        onChange={(e) => setCorrectedValue(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                        placeholder="Enter corrected dollars"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Reviewer Note (required)</label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                        placeholder="e.g. Corrected to column 2"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecision('correct')}
                        className="flex-1 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        Submit Correction
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Value Display with Strike-through animation on correction */}
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center mb-3">
                      <div className="text-xs text-slate-500 mb-0.5">Current Dollar Value</div>
                      <div className="text-xl font-mono font-bold text-white">
                        {detail.metric.value_dollars != null
                          ? `$${detail.metric.value_dollars.toLocaleString()}`
                          : 'null'}
                      </div>
                    </div>

                    {/* Action buttons with Magnetic Pull (20px radius per prompt) */}
                    <div className="flex gap-2">
                      <MagneticButton
                        radius={20}
                        onClick={() => handleDecision('approve')}
                        disabled={!detail.actionable || isSubmitting}
                        className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Approve (A)</span>
                      </MagneticButton>

                      <MagneticButton
                        radius={20}
                        onClick={() => setIsEditing(true)}
                        disabled={!detail.actionable || isSubmitting}
                        className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit (E)</span>
                      </MagneticButton>

                      <MagneticButton
                        radius={20}
                        onClick={() => handleDecision('reject')}
                        disabled={!detail.actionable || isSubmitting}
                        className="flex-1 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-rose-500/20"
                      >
                        <X className="w-4 h-4 stroke-[3]" />
                        <span>Reject (R)</span>
                      </MagneticButton>
                    </div>

                    {!detail.actionable && (
                      <div className="mt-3 text-center text-xs text-slate-500 italic">
                        This item is queued behind the head review. Actionable after earlier reviews are resolved.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-600 text-xs py-20">Select a review item to inspect</div>
          )}
        </div>
      </div>
    </div>
  );
};
