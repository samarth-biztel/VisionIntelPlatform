import { fallbackSummary } from "../data/fallback-summary.js";

export async function fetchDashboardSummary() {
  try {
    const response = await fetch("/api/dashboard-summary");
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
