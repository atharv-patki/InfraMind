import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";
import { useWorkspace } from "@/react-app/context/WorkspaceContext";
import type { WorkspaceRole } from "@/react-app/lib/workspace-client";

const roleLabel: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  engineer: "Engineer",
  viewer: "Viewer",
};

type RoleAccessGateProps = {
  allowedRoles: WorkspaceRole[];
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function RoleAccessGate({
  allowedRoles,
  title,
  description,
  children,
}: RoleAccessGateProps) {
  const { role, workspace, isLoading, error, refresh, hasRole } = useWorkspace();

  if (isLoading) {
    return (
      <DataStateCard
        state="loading"
        title="Checking workspace permissions"
        detail="Validating your role access for this section."
      />
    );
  }

  if (error) {
    return (
      <DataStateCard
        state="error"
        title="Unable to verify access"
        detail={error}
        onRetry={() => void refresh()}
      />
    );
  }

  if (!workspace || !role) {
    return (
      <DataStateCard
        state="empty"
        title="Workspace membership unavailable"
        detail="No active workspace membership was found for this account."
        onRetry={() => void refresh()}
      />
    );
  }

  if (hasRole(allowedRoles)) {
    return <>{children}</>;
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <CardTitle className="inline-flex items-center gap-2">
          <Lock className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 py-6">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Current role: {roleLabel[role]}</Badge>
          <Badge variant="secondary">
            Required: {allowedRoles.map((item) => roleLabel[item]).join(" / ")}
          </Badge>
          <Badge variant="outline">Workspace: {workspace.name}</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          Retry Access Check
        </Button>
      </CardContent>
    </Card>
  );
}
