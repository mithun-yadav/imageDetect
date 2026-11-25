
from datetime import datetime, timezone
from threading import Lock
from time import monotonic


class InferenceMetrics:
    """Thread-safe, in-memory inference metrics collector."""

    def __init__(self):
        self._lock = Lock()
        self._started_at = monotonic()

        self._total_attempts = 0
        self._successful_inferences = 0
        self._failed_inferences = 0

        self._total_latency_ms = 0.0
        self._min_latency_ms = None
        self._max_latency_ms = None
        self._last_latency_ms = None
        self._last_inference_at = None

    def _record(self, latency_ms: float, successful: bool) -> None:
        if latency_ms < 0:
            raise ValueError("Latency cannot be negative")

        timestamp = datetime.now(timezone.utc).isoformat()

        with self._lock:
            self._total_attempts += 1

            if successful:
                self._successful_inferences += 1
            else:
                self._failed_inferences += 1

            self._total_latency_ms += latency_ms

            if self._min_latency_ms is None:
                self._min_latency_ms = latency_ms
            else:
                self._min_latency_ms = min(
                    self._min_latency_ms,
                    latency_ms,
                )

            if self._max_latency_ms is None:
                self._max_latency_ms = latency_ms
            else:
                self._max_latency_ms = max(
                    self._max_latency_ms,
                    latency_ms,
                )

            self._last_latency_ms = latency_ms
            self._last_inference_at = timestamp

    def record_success(self, latency_ms: float) -> None:
        """Record a successfully completed inference."""
        self._record(latency_ms, successful=True)

    def record_failure(self, latency_ms: float) -> None:
        """Record a failed inference execution."""
        self._record(latency_ms, successful=False)

    def get_metrics(self) -> dict:
        """Return a consistent snapshot of current metrics."""
        with self._lock:
            total = self._total_attempts

            average_latency = (
                self._total_latency_ms / total
                if total > 0
                else None
            )

            return {
                "totalAttempts": total,
                "successfulInferences": self._successful_inferences,
                "failedInferences": self._failed_inferences,
                "successRate": (
                    round(
                        self._successful_inferences / total * 100,
                        2,
                    )
                    if total > 0
                    else None
                ),
                "averageLatencyMs": (
                    round(average_latency, 2)
                    if average_latency is not None
                    else None
                ),
                "minLatencyMs": (
                    round(self._min_latency_ms, 2)
                    if self._min_latency_ms is not None
                    else None
                ),
                "maxLatencyMs": (
                    round(self._max_latency_ms, 2)
                    if self._max_latency_ms is not None
                    else None
                ),
                "lastLatencyMs": (
                    round(self._last_latency_ms, 2)
                    if self._last_latency_ms is not None
                    else None
                ),
                "lastInferenceAt": self._last_inference_at,
                "uptimeSeconds": round(
                    monotonic() - self._started_at,
                    2,
                ),
            }
