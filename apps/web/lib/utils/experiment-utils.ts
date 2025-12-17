export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

/**
 * Get status display info
 */
export function getStatusInfo(status: ExperimentStatus): {
  label: string;
  variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info';
} {
  const statusMap: Record<
    ExperimentStatus,
    { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' }
  > = {
    draft: { label: 'Draft', variant: 'secondary' },
    running: { label: 'Running', variant: 'success' },
    paused: { label: 'Paused', variant: 'warning' },
    completed: { label: 'Completed', variant: 'info' },
    cancelled: { label: 'Cancelled', variant: 'destructive' },
  };
  return statusMap[status];
}
