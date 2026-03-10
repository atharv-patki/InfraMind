export type TenantViolation =
  | {
      type: "duplicate_membership";
      workspaceId: string;
      userId: string;
      count: number;
    }
  | {
      type: "orphan_sessions";
      count: number;
    }
  | {
      type: "high_fanout_user";
      userId: string;
      workspaceCount: number;
      threshold: number;
    };

export function evaluateTenantIsolation(input: {
  duplicateMemberships: Array<{ workspace_id: string; user_id: string; count: number }>;
  orphanSessionCount: number;
  highFanoutUsers: Array<{ user_id: string; workspace_count: number }>;
  highFanoutThreshold: number;
}): TenantViolation[] {
  const violations: TenantViolation[] = [];

  for (const row of input.duplicateMemberships) {
    violations.push({
      type: "duplicate_membership",
      workspaceId: row.workspace_id,
      userId: row.user_id,
      count: Number(row.count),
    });
  }

  if (input.orphanSessionCount > 0) {
    violations.push({
      type: "orphan_sessions",
      count: input.orphanSessionCount,
    });
  }

  for (const row of input.highFanoutUsers) {
    violations.push({
      type: "high_fanout_user",
      userId: row.user_id,
      workspaceCount: Number(row.workspace_count),
      threshold: input.highFanoutThreshold,
    });
  }

  return violations;
}
