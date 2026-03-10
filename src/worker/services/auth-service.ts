import type { SubscriptionPlan } from "../lib/plan";
import {
  createUserRecord,
  findUserCredentialsByEmail,
  type UserCredentialsRecord,
} from "../repositories/user-repository";

export async function getUserCredentialsByEmail(
  env: Env,
  email: string
): Promise<UserCredentialsRecord | null> {
  return (await findUserCredentialsByEmail(env, email)) ?? null;
}

export async function createUserAccount(
  env: Env,
  input: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    plan: SubscriptionPlan;
    passwordHash: string;
    passwordSalt: string;
    nowIso?: string;
  }
): Promise<void> {
  await createUserRecord(env, {
    id: input.id,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    plan: input.plan,
    passwordHash: input.passwordHash,
    passwordSalt: input.passwordSalt,
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}
