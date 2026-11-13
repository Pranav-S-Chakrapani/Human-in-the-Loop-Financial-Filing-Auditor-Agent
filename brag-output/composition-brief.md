# Hyperframes Composition Brief: VantageAudit

## Objective
Create a short, polished, 20-second launch brag video for VantageAudit showcasing its autonomous financial filing audit capabilities, dual consensus extraction, 4-way validation, and crash-resilient LangGraph checkpointing.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080 (16:9)
- Duration: 20 seconds (600 frames at 30fps)

## Source Material
- Project root: `c:\Users\chakr\Downloads\MINEARENA`
- Primary files read: `frontend/src/App.tsx`, `frontend/src/screens/IntroScreen.tsx`, `frontend/src/screens/MissionControlScreen.tsx`, `frontend/src/screens/ReviewWorkbenchScreen.tsx`, `SPEC.md`, `CONTRACT.md`, `RULES.md`
- Product name: VantageAudit
- Tagline / strongest claim: "Two extractors. One truth. Four checks, every time. Killed mid-run, nothing lost."
- Key UI or visual moment to recreate:
  - Dual Extractor corroboration cards (Rules vs Visual LLM)
  - 4-Tier Invariant equation badges
  - Hard kill / resume checkpointer proof badge (0 duplicate network LLM calls)
  - Cryptographic SHA-256 chained audit ledger
- Copy that must appear verbatim:
  - "VantageAudit v2.0"
  - "Two extractors. One truth."
  - "Four checks, every time."
  - "Killed mid-run. Nothing lost."
  - "100% POST-REVIEW ACCURACY"

## Creative Direction
- Tone preset: `cinematic`
- Creative direction: "High-precision regulatory financial intelligence film"
- Interpretation: Deep obsidian atmosphere (`#080B11`), glowing gold/amber micro-hairlines (`#E8B339`), verified emerald badges (`#10B981`), tabular JetBrains Mono metrics, and rhythmic pacing synchronized to electronic music beats.
- Angle: Modern financial models hallucinate; VantageAudit delivers regulatory-grade truth through consensus extraction, balance sheet invariant validation, and crash-resilient checkpointer durability.
- Hook: "10-K FILINGS ARE MESSY. HALLUCINATING THEM COSTS BILLIONS."
- Outro / punchline: "AUDIT AT MACHINE SPEED. CERTIFY WITH HUMAN TRUTH."
- Avoid:
  - Generic SaaS phrases ("streamline workflow", "all-in-one AI platform")
  - Abstract spinning shapes or ungrounded 3D objects
  - Low-contrast unreadable text

## Visual Identity
- Background: `#080B11`
- Surface / Cards: `#141822` with `border border-white/10`
- Accent / Signal: `#E8B339`
- Success / Verified: `#10B981`
- Text: `#FFFFFF` and `#94A3B8`
- Display font: Space Grotesk
- Body / Code font: JetBrains Mono

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract:
1. Scene 1 (0.0s - 3.0s): The Hook — Stark typographic challenge on obsidian background.
2. Scene 2 (3.0s - 7.5s): Dual Consensus — Rules Extractor vs Vision LLM side-by-side with corroboration score rolling up to 100%.
3. Scene 3 (7.5s - 11.5s): 4-Point Invariants — 4 mathematical cards popping in to verify Balance Sheet equations.
4. Scene 4 (11.5s - 16.0s): Crash Resilience — Process kill simulation, immediate instant recovery from SQLite checkpointer with 0 duplicate LLM calls.
5. Scene 5 (16.0s - 20.0s): Outro — VantageAudit brand lockup, regulatory verification seal, and SEC compliance tags.

## Audio
- Audio role: Cinematic electronic groove with rhythmic momentum
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: Low atmospheric opening, rhythmic beat drop at 3.0s, high energy through feature reveals, sharp punchout under final brand logo.
- SFX posture: Subtle tactical clicks on card reveals and keystrokes.
- Audio files:
  - Music copied to `brag-output/composition/assets/music/`
  - SFX copied to `brag-output/composition/assets/sfx/`

## Hyperframes Instructions
Build a standalone HTML/CSS/JS Hyperframes composition in `brag-output/composition/` with `index.html`.
- Canvas dimensions: 1920x1080.
- Duration: 20 seconds (`data-duration="20"`).
- Implement scenes using clear timeline timing attributes or seek-safe GSAP keyframes.
- Ensure all text passes WCAG contrast.
- Run `npx hyperframes check` to validate with 0 errors before rendering.
