import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  fetchWorkspaceMembership,
  type WorkspaceMembership,
  type WorkspaceRole,
} from "@/react-app/lib/workspace-client";

type WorkspaceContextValue = {
  workspace: WorkspaceMembership | null;
  role: WorkspaceRole | null;
  isLoading: boolean;
  error: string;
  refresh: () => Promise<void>;
  hasRole: (allowedRoles: WorkspaceRole[]) => boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isPending: isAuthPending } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspace(null);
      setError("");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const membership = await fetchWorkspaceMembership();
      setWorkspace(membership);
    } catch (err) {
      setWorkspace(null);
      setError(err instanceof Error ? err.message : "Unable to load workspace access.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthPending) return;
    void refresh();
  }, [isAuthPending, refresh]);

  const role = workspace?.role ?? null;

  const hasRole = useCallback(
    (allowedRoles: WorkspaceRole[]) => {
      if (!role) return false;
      return allowedRoles.includes(role);
    },
    [role]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      role,
      isLoading,
      error,
      refresh,
      hasRole,
    }),
    [error, hasRole, isLoading, refresh, role, workspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider.");
  }
  return context;
}
