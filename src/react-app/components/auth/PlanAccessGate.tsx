import type { ReactNode } from "react";
import { Link } from "react-router";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  getPlanLabel,
  hasPlanAccess,
  type SubscriptionPlan,
} from "@/react-app/lib/plans";

export default function PlanAccessGate({
  minimumPlan,
  title,
  description,
  children,
}: {
  minimumPlan: SubscriptionPlan;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const plan = user?.plan ?? "starter";

  if (hasPlanAccess(plan, minimumPlan)) {
    return <>{children}</>;
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-sm">
          Current plan:{" "}
          <span className="font-medium">{getPlanLabel(plan)}</span> · Required:{" "}
          <span className="font-medium">{getPlanLabel(minimumPlan)}</span>
        </p>
        <Button asChild>
          <Link to="/pricing">Upgrade Plan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
