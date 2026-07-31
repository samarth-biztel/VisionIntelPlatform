import { fallbackSummary } from "../data/fallback-summary.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export async function fetchDashboardSummary() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/dashboard-summary`);
    if (!response.ok) {
      throw new Error("API unavailable");
    }
    return await response.json();
  } catch {
    return {
      ...fallbackSummary,
      offline: true
    };
  }
}

export async function runLifecycleAction(action) {
  const response = await fetch(`${apiBaseUrl}/api/lifecycle/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requested_by: "operator" })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Lifecycle action failed" }));
    throw new Error(error.message ?? "Lifecycle action failed");
  }

  return response.json();
}