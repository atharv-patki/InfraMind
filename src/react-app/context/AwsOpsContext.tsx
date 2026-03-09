import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AwsOpsConfig, OpsConnectionStatus } from "@/react-app/lib/aws-contracts";
import {
  connectAws,
  disconnectAws,
  getOpsConfig,
  updateOpsConfig,
} from "@/react-app/lib/aws-api";
import { useAuth } from "@/react-app/context/AuthContext";

type AwsOpsContextValue = {
  config: AwsOpsConfig | null;
  isLoading: boolean;
  error: string;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  updateConfig: (patch: Partial<Omit<AwsOpsConfig, "iamPermissions">>) => Promise<void>;
  setConnectionStatus: (status: OpsConnectionStatus) => Promise<void>;
};

const AwsOpsContext = createContext<AwsOpsContextValue | null>(null);

const fallbackConfig: AwsOpsConfig = {
  accountId: "123456789012",
  region: "us-east-1",
  environment: "prod",
  connectionStatus: "disconnected",
  autoRecoveryEnabled: true,
  alertChannels: {
    email: true,
    sms: false,
    slack: true,
    teams: false,
  },
  iamPermissions: [
    {
      name: "cloudwatch:GetMetricData",
      status: "unknown",
      detail: "Waiting for AWS connectivity checks.",
    },
    {
      name: "ecs:UpdateService",
      status: "unknown",
      detail: "Waiting for AWS connectivity checks.",
    },
  ],
};

export function AwsOpsProvider({ children }: { children: React.ReactNode }) {
  const { user, isPending: isAuthPending } = useAuth();
  const [config, setConfig] = useState<AwsOpsConfig | null>(fallbackConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) {
      setConfig(fallbackConfig);
      setError("");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const next = await getOpsConfig();
      setConfig(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load AWS settings.";
      setError(message);
      setConfig((current) => current ?? fallbackConfig);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthPending) return;
    void refresh();
  }, [isAuthPending, refresh]);

  const connect = useCallback(async () => {
    try {
      setError("");
      const next = await connectAws();
      setConfig(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to connect AWS.";
      setError(message);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setError("");
      const next = await disconnectAws();
      setConfig(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to disconnect AWS.";
      setError(message);
    }
  }, []);

  const applyConfigPatch = useCallback(
    async (patch: Partial<Omit<AwsOpsConfig, "iamPermissions">>) => {
      try {
        setError("");
        const next = await updateOpsConfig(patch);
        setConfig(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update AWS config.";
        setError(message);
      }
    },
    []
  );

  const setConnectionStatus = useCallback(
    async (status: OpsConnectionStatus) => {
      await applyConfigPatch({ connectionStatus: status });
    },
    [applyConfigPatch]
  );

  const value = useMemo<AwsOpsContextValue>(
    () => ({
      config,
      isLoading,
      error,
      refresh,
      connect,
      disconnect,
      updateConfig: applyConfigPatch,
      setConnectionStatus,
    }),
    [
      applyConfigPatch,
      config,
      connect,
      disconnect,
      error,
      isLoading,
      refresh,
      setConnectionStatus,
    ]
  );

  return <AwsOpsContext.Provider value={value}>{children}</AwsOpsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAwsOps() {
  const context = useContext(AwsOpsContext);
  if (!context) {
    throw new Error("useAwsOps must be used within AwsOpsProvider.");
  }
  return context;
}
