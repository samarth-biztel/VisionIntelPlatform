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
