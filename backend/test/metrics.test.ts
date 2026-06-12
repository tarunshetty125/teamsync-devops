import { describe, expect, it } from "vitest";
import {
  getMetricsSnapshot,
  getPrometheusMetrics,
  recordHttpMetric,
} from "../src/services/metrics.service";

describe("metrics service", () => {
  it("aggregates HTTP metrics and emits Prometheus output", () => {
    recordHttpMetric({
      method: "get",
      path: "/v1/task/workspace/:workspaceId/all",
      statusCode: 200,
      durationMs: 24.5,
    });
    recordHttpMetric({
      method: "GET",
      path: "/v1/task/workspace/:workspaceId/all",
      statusCode: 503,
      durationMs: 100,
    });

    const snapshot = getMetricsSnapshot();
    const successRoute = snapshot.routes.find(
      (route) => route.key === "GET /v1/task/workspace/:workspaceId/all 2xx"
    );
    const errorRoute = snapshot.routes.find(
      (route) => route.key === "GET /v1/task/workspace/:workspaceId/all 5xx"
    );

    expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(snapshot.memory.heapUsed).toBeGreaterThan(0);
    expect(successRoute).toMatchObject({
      count: 1,
      errors: 0,
      averageDurationMs: 24.5,
      maxDurationMs: 24.5,
    });
    expect(errorRoute).toMatchObject({
      count: 1,
      errors: 1,
      averageDurationMs: 100,
      maxDurationMs: 100,
    });

    const prometheus = getPrometheusMetrics();

    expect(prometheus).toContain("teamsync_process_uptime_seconds");
    expect(prometheus).toContain("teamsync_http_requests_total");
    expect(prometheus).toContain(
      'method="GET",path="/v1/task/workspace/:workspaceId/all",status_class="2xx"'
    );
    expect(prometheus).toContain(
      'method="GET",path="/v1/task/workspace/:workspaceId/all",status_class="5xx"'
    );
  });
});
