import type {
  RecurringExecutionStatus,
  RecurringRuleStatus,
} from '../types/finance';

type FriendlyRecurringReasonInput = {
  issueType?: 'FAILED_EXECUTION' | 'PAUSED_RULE';
  executionStatus?: RecurringExecutionStatus;
  errorType?: 'STRUCTURAL' | 'TRANSIENT' | null;
  errorMessage?: string | null;
  ruleStatus?: RecurringRuleStatus | null;
  pausedReason?: string | null;
};

export type FriendlyRecurringReason = {
  label: string;
  details: string | null;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
};

function normalizeOptionalMessage(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getFriendlyRecurringReason(
  input: FriendlyRecurringReasonInput,
): FriendlyRecurringReason {
  const pausedReason = normalizeOptionalMessage(input.pausedReason);
  const errorMessage = normalizeOptionalMessage(input.errorMessage);

  if (input.issueType === 'PAUSED_RULE' || input.ruleStatus === 'PAUSED') {
    return {
      label: 'Rule is paused',
      details: pausedReason ?? errorMessage,
      tone: 'warning',
    };
  }

  if (input.executionStatus === 'SUCCESS') {
    return {
      label: 'Executed successfully',
      details: null,
      tone: 'success',
    };
  }

  if (input.executionStatus === 'SKIPPED') {
    return {
      label: 'Execution skipped',
      details: errorMessage,
      tone: 'neutral',
    };
  }

  if (input.executionStatus === 'FAILED') {
    if (input.errorType === 'STRUCTURAL') {
      return {
        label: 'Structural issue',
        details: pausedReason ?? errorMessage,
        tone: 'warning',
      };
    }

    if (input.errorType === 'TRANSIENT') {
      return {
        label: 'Temporary failure',
        details: errorMessage,
        tone: 'danger',
      };
    }

    return {
      label: 'Execution failed',
      details: errorMessage,
      tone: 'danger',
    };
  }

  if (errorMessage) {
    return {
      label: 'Needs attention',
      details: errorMessage,
      tone: 'warning',
    };
  }

  return {
    label: 'No additional details',
    details: null,
    tone: 'neutral',
  };
}

export function getRecurringExecutionStatusBadgeClass(status: RecurringExecutionStatus): string {
  if (status === 'SUCCESS') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }

  if (status === 'FAILED') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  }

  return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
}

export function getRecurringRuleStatusBadgeClass(status: RecurringRuleStatus): string {
  if (status === 'ACTIVE') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }

  if (status === 'PAUSED') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }

  if (status === 'COMPLETED') {
    return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
  }

  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
}

export function getRecurringReasonToneClass(
  tone: FriendlyRecurringReason['tone'],
): string {
  if (tone === 'success') {
    return 'text-emerald-700 dark:text-emerald-300';
  }

  if (tone === 'warning') {
    return 'text-amber-700 dark:text-amber-300';
  }

  if (tone === 'danger') {
    return 'text-rose-700 dark:text-rose-300';
  }

  return 'text-slate-600 dark:text-slate-300';
}
