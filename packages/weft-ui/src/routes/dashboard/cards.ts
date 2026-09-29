import type { Component } from 'svelte';

import ReviewsDashboardCard from '../reviews/cards/dashboard-card.svelte';
import SchedulesDashboardCard from '../schedules/cards/dashboard-card.svelte';
import WorkersDashboardCard from '../workers/cards/dashboard-card.svelte';

/**
 * Card-slot contract (plan §13.0, PROJECT-BRIEF "Shared contracts"): each
 * track that contributes a dashboard card owns its card component under its
 * own `src/routes/<domain>/cards/` directory and registers it here. This is
 * the ONE shared file every dashboard-card-owning track touches — keep each
 * entry to a one-line import + registration so concurrent tracks rarely
 * conflict on the same lines.
 *
 * No `workflows` entry: the design reference (`Weft UI.dc.html`
 * dashboard screen) shows exactly one "Workflows by status" treatment — the
 * dashboard track's own full-width `workflow-status-card.svelte`, which
 * also feeds the page-level empty-state gate (`index.svelte`). A second,
 * identically-titled registry card duplicated that exact data in a second
 * box; removed during the surface-phase integration gate.
 */
export interface DashboardCardEntry {
  id: string;
  component: Component;
}

export const dashboardCards: readonly DashboardCardEntry[] = [
  { id: 'schedules', component: SchedulesDashboardCard },
  { id: 'workers', component: WorkersDashboardCard },
  { id: 'reviews', component: ReviewsDashboardCard },
];
