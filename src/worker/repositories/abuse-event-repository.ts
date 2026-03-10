export async function recordAbuseEvent(
  env: Env,
  input: {
    scope: "signup" | "invite" | "mail";
    actorKey: string;
    email: string;
    ipAddress: string;
    reason: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `
      INSERT INTO abuse_events (
        id,
        scope,
        actor_key,
        email,
        ip_address,
        reason,
        metadata,
        created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `
  )
    .bind(
      id,
      input.scope,
      input.actorKey,
      input.email,
      input.ipAddress,
      input.reason,
      JSON.stringify(input.metadata ?? {}),
      now
    )
    .run();
}
