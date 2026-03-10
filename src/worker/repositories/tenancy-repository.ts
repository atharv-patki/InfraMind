export async function getMembershipsForUser(env: Env, userId: string) {
  const result = await env.DB.prepare(
    `
      SELECT workspace_id, user_id
      FROM memberships
      WHERE user_id = ?1 AND status = 'active'
    `
  )
    .bind(userId)
    .all<{ workspace_id: string; user_id: string }>();

  return (result.results ?? []) as Array<{ workspace_id: string; user_id: string }>;
}

export async function getDuplicateMembershipRows(env: Env) {
  const result = await env.DB.prepare(
    `
      SELECT workspace_id, user_id, COUNT(*) AS count
      FROM memberships
      GROUP BY workspace_id, user_id
      HAVING COUNT(*) > 1
      LIMIT 50
    `
  ).all<{ workspace_id: string; user_id: string; count: number }>();

  return (result.results ?? []) as Array<{ workspace_id: string; user_id: string; count: number }>;
}

export async function getOrphanSessionCount(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `
      SELECT COUNT(*) as count
      FROM sessions s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE u.id IS NULL
    `
  ).first<{ count: number }>();

  return Number(row?.count ?? 0);
}

export async function getHighFanoutUsers(env: Env, threshold: number) {
  const result = await env.DB.prepare(
    `
      SELECT user_id, COUNT(DISTINCT workspace_id) AS workspace_count
      FROM memberships
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(DISTINCT workspace_id) > ?1
      LIMIT 50
    `
  )
    .bind(threshold)
    .all<{ user_id: string; workspace_count: number }>();

  return (result.results ?? []) as Array<{ user_id: string; workspace_count: number }>;
}
