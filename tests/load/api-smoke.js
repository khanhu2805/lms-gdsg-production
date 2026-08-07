import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    health: {
      executor: "constant-vus",
      vus: 20,
      duration: "30s",
      exec: "health",
    },
    protectedApi: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        { target: 100, duration: "30s" },
        { target: 300, duration: "60s" },
        { target: 0, duration: "15s" },
      ],
      exec: "protectedApi",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://localhost";

export function health() {
  const response = http.get(`${baseUrl}/healthz`);
  check(response, { "health is 200": (result) => result.status === 200 });
  sleep(0.2);
}

export function protectedApi() {
  const response = http.get(`${baseUrl}/api/v1/classes`);
  check(response, {
    "anonymous is rejected": (result) => result.status === 401,
    "JSON envelope": (result) =>
      result.headers["Content-Type"]?.includes("application/json"),
  });
}
