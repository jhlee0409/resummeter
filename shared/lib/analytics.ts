/**
 * Analytics abstraction layer.
 * Currently stores events in localStorage + console.
 * Replace sendEvent internals with Amplitude/Mixpanel/Posthog SDK when ready.
 */

export type AnalyticsEvent =
  | { type: 'analysis_start'; resumeLength: number; jdLength: number; hasGithub: boolean }
  | { type: 'analysis_complete'; matchScore: number; durationMs: number }
  | { type: 'tab_switch'; from: string; to: string }
  | { type: 'coaching_apply'; actionId: string; accepted: boolean }
  | { type: 'pipeline_run'; pipelineType: string }
  | { type: 'pipeline_complete'; pipelineType: string; durationMs: number }
  | { type: 'narrative_generate'; sectionCount: number; framework: string }
  | { type: 'ats_analyze' }
  | { type: 'detailed_score_analyze' }
  | { type: 'template_select'; templateId: string; industry: string }
  | { type: 'narrative_insert_resume'; title: string }
  | { type: 'resume_download'; format: string }
  | { type: 'resume_copy' }
  | { type: 'example_view'; exampleId: string; industry: string }
  | { type: 'version_save' }
  | { type: 'session_start' }
  | { type: 'restart' };

interface StoredEvent {
  event: AnalyticsEvent;
  timestamp: string;
  sessionId: string;
}

const STORAGE_KEY = 'resummeter_analytics';
const MAX_STORED_EVENTS = 500;

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return sessionId;
}

function getStoredEvents(): StoredEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeEvent(event: StoredEvent) {
  try {
    const events = getStoredEvents();
    events.push(event);
    // Keep only the latest events
    const trimmed = events.slice(-MAX_STORED_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function track(event: AnalyticsEvent) {
  const stored: StoredEvent = {
    event,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
  };

  storeEvent(stored);

  // Debug logging in development
  if (import.meta.env.DEV) {
    console.debug('[analytics]', event.type, event);
  }

  // TODO: Replace with real analytics SDK call
  // amplitude.track(event.type, event);
  // posthog.capture(event.type, event);
}

/** Get analytics summary for debugging / admin panel */
export function getAnalyticsSummary() {
  const events = getStoredEvents();
  const sessions = new Set(events.map(e => e.sessionId)).size;
  const typeCounts: Record<string, number> = {};
  for (const e of events) {
    typeCounts[e.event.type] = (typeCounts[e.event.type] || 0) + 1;
  }
  return {
    totalEvents: events.length,
    totalSessions: sessions,
    eventCounts: typeCounts,
    latestEvents: events.slice(-10),
  };
}

/** Clear all stored analytics data */
export function clearAnalytics() {
  localStorage.removeItem(STORAGE_KEY);
}

// Auto-track session start
track({ type: 'session_start' });
