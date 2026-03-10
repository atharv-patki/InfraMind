import type { SubscriptionPlan } from "../lib/plan";

export type UserCredentialsRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  plan: SubscriptionPlan;
  email_verified?: number;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
};

export async function findUserCredentialsByEmail(env: Env, email: string) {
  return env.DB.prepare(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        plan,
        email_verified,
        password_hash,
        password_salt,
        created_at,
        updated_at
      FROM users
      WHERE email = ?1
      LIMIT 1
    `
  )
    .bind(email)
    .first<UserCredentialsRecord>();
}

export async function createUserRecord(
  env: Env,
  input: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    plan: SubscriptionPlan;
    passwordHash: string;
    passwordSalt: string;
    nowIso: string;
  }
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO users (
        id,
        first_name,
        last_name,
        email,
        plan,
        password_hash,
        password_salt,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `
  )
    .bind(
      input.id,
      input.firstName,
      input.lastName,
      input.email,
      input.plan,
      input.passwordHash,
      input.passwordSalt,
      input.nowIso,
      input.nowIso
    )
    .run();
}
