import type { IncidentTimelineEvent } from "@/react-app/lib/aws-contracts";
import { OpsStatusBadge } from "@/react-app/components/dashboard/OpsStatusBadge";

export function TimelineList({ events }: { events: IncidentTimelineEvent[] }) {
  return (
    <div className="space-y-3">
      {events.map((event) => (
        <article
          key={event.id}
          className="rounded-xl border border-border bg-secondary/30 px-3 py-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{event.title}</p>
            <OpsStatusBadge status={event.state} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{event.detail}</p>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {new Date(event.at).toLocaleString()}
          </p>
        </article>
      ))}
    </div>
  );
}
