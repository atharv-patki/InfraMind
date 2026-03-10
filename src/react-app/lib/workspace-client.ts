export type WorkspaceRole = "owner" | "admin" | "engineer" | "viewer";

export type WorkspaceMembership = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

type WorkspaceResponse = {
  workspace?: WorkspaceMembership | null;
  error?: string;
};

type InviteResponse = {
  success?: boolean;
  invitationToken?: string;
  invitationUrl?: string;
  invitationEmailStatus?: "queued" | "disabled";
  expiresAt?: string;
  error?: string;
};

export async function fetchWorkspaceMembership(): Promise<WorkspaceMembership | null> {
  const response = await fetch("/api/workspaces/me", {
    credentials: "include",
  });

  const data = (await safeJson(response)) as WorkspaceResponse | null;
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(data?.error ?? "Unable to load workspace membership.");
  }
  return data?.workspace ?? null;
}

export async function createWorkspaceInvitation(payload: {
  email: string;
  role: WorkspaceRole;
}): Promise<{
  invitationToken: string;
  invitationUrl: string;
  invitationEmailStatus: "queued" | "disabled";
  expiresAt: string;
}> {
  const response = await fetch("/api/workspaces/invitations", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await safeJson(response)) as InviteResponse | null;
  if (
    !response.ok ||
    !data?.invitationToken ||
    !data?.invitationUrl ||
    !data?.expiresAt
  ) {
    throw new Error(data?.error ?? "Unable to create workspace invitation.");
  }

  return {
    invitationToken: data.invitationToken,
    invitationUrl: data.invitationUrl,
    invitationEmailStatus: data.invitationEmailStatus ?? "disabled",
    expiresAt: data.expiresAt,
  };
}

export async function acceptWorkspaceInvitation(
  token: string
): Promise<WorkspaceMembership | null> {
  const response = await fetch(
    `/api/workspaces/invitations/${encodeURIComponent(token)}/accept`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  const data = (await safeJson(response)) as WorkspaceResponse | null;
  if (!response.ok) {
    throw new Error(data?.error ?? "Unable to accept invitation.");
  }
  return data?.workspace ?? null;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
