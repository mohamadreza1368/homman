"""Clinical drill assessment and grading tool registration.

Exposes the `record_case_verdict` tool solely during case drill sessions, allowing
the AI tutor to file structured numerical evaluations and clinical reasoning feedback
into the user's local study journal.
"""

from __future__ import annotations

from pydantic_ai import Agent, ModelRetry, RunContext

from hoomaan_engine.scene_tools import SceneContext

MIN_VERDICT_CHARS = 40
MAX_VERDICT_CHARS = 4000


def register_case_tools(agent: Agent[SceneContext, str]) -> None:
    """Binds the case scoring tool to the provided Pydantic AI agent instance."""

    @agent.tool
    def record_case_verdict(
        ctx: RunContext[SceneContext], score: int, verdict: str
    ) -> str:
        """Record the numerical grade and diagnostic evaluation for a case scenario attempt.

        Invoked once following clinical evaluation.
        `score` spans 0 to 100 based on standard assessment rubrics.
        `verdict` provides actionable feedback detailing accurate deductions and missed differentials.
        """
        verdict_sink = ctx.deps.emit_verdict
        if verdict_sink is None:
            raise ModelRetry(
                "Grades can only be recorded during a case drill. "
                "Answer the question directly instead."
            )

        if not 0 <= score <= 100:
            raise ModelRetry(
                f"score must be between 0 and 100, got {score}. "
                "Use the bands in your instructions."
            )

        normalized_verdict = " ".join(verdict.split())
        if len(normalized_verdict) < MIN_VERDICT_CHARS:
            raise ModelRetry(
                "The verdict is too short to be useful later. Say what the "
                "student got right, what they missed, and why it matters."
            )

        verdict_sink(score, normalized_verdict[:MAX_VERDICT_CHARS])
        return f"Recorded {score}/100 in the study journal."
