import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileClock, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import { Textarea } from "@/react-app/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/react-app/components/ui/table";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";
import { TimelineList } from "@/react-app/components/dashboard/TimelineList";
import { PageSkeleton } from "@/react-app/components/dashboard/PageSkeleton";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import { useToast } from "@/react-app/context/ToastContext";
import {
  appendIncidentNote,
  exportIncidentReport,
  getIncidentAuditRecords,
} from "@/react-app/lib/aws-mock-service";
import type { IncidentAuditRecord } from "@/react-app/lib/aws-contracts";

export default function IncidentHistoryPage() {
  const { config, isLoading: isConfigLoading } = useAwsOps();
  const { pushToast } = useToast();

  const [records, setRecords] = useState<IncidentAuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await getIncidentAuditRecords();
      setRecords(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load incident history.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!config) return;
    if (config.connectionStatus === "disconnected" || config.connectionStatus === "permission_denied") {
      return;
    }
    void loadRecords();
  }, [config, loadRecords]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId]
  );

  useEffect(() => {
    setNotesDraft(selectedRecord?.humanNotes ?? "");
  }, [selectedRecord]);

  const saveNotes = useCallback(async () => {
    if (!selectedRecord) return;
    try {
      setIsSavingNote(true);
      const updated = await appendIncidentNote({ recordId: selectedRecord.id, note: notesDraft });
      setRecords((prev) => prev.map((record) => (record.id === updated.id ? updated : record)));
      pushToast("Incident notes saved.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save notes.";
      setError(message);
      pushToast(message, "error");
    } finally {
      setIsSavingNote(false);
    }
  }, [notesDraft, pushToast, selectedRecord]);

  const downloadReport = useCallback(async () => {
    if (!selectedRecord) return;
    try {
      setIsExporting(true);
      const content = await exportIncidentReport(selectedRecord.id);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedRecord.incidentId}-report.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
      pushToast("Incident report exported.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to export report.";
      setError(message);
      pushToast(message, "error");
    } finally {
      setIsExporting(false);
    }
  }, [pushToast, selectedRecord]);

  if (isConfigLoading || !config) {
    return (
      <DataStateCard
        state="loading"
        title="Loading incident history"
        detail="Checking AWS integration for audit records."
      />
    );
  }

  if (config.connectionStatus === "disconnected") {
    return (
      <DataStateCard
        state="disconnected"
        title="AWS account is disconnected"
        detail="Connect AWS account to access incident audit history."
      />
    );
  }

  if (config.connectionStatus === "permission_denied") {
    return (
      <DataStateCard
        state="permission"
        title="Audit permission denied"
        detail="IAM permissions are required to read incident history."
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton cards={2} rows={8} />;
  }

  if (error) {
    return (
      <DataStateCard
        state="error"
        title="Incident history unavailable"
        detail={error}
        onRetry={() => void loadRecords()}
      />
    );
  }

  if (records.length === 0) {
    return (
      <DataStateCard
        state="empty"
        title="No incident history records"
        detail="Audit records will appear after incident workflows run."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Incident History / Audit Trail</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Timeline of incidents, executed actions, and verification outcomes.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow
                  key={record.id}
                  className={selectedId === record.id ? "bg-primary/5" : undefined}
                  onClick={() => setSelectedId(record.id)}
                >
                  <TableCell>
                    <p className="font-medium">{record.incidentId}</p>
                    <p className="text-xs text-muted-foreground">{record.id}</p>
                  </TableCell>
                  <TableCell className="max-w-sm truncate">{record.summary}</TableCell>
                  <TableCell>
                    {record.verificationResult === "passed" ? (
                      <Badge className="bg-success/15 text-success hover:bg-success/20">
                        Passed
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(record.updatedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRecord ? (
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{selectedRecord.incidentId}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{selectedRecord.summary}</p>
              </div>
              <Button size="sm" variant="outline" disabled={isExporting} onClick={() => void downloadReport()}>
                <Download className="mr-1.5 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <article className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Verification Result</p>
                {selectedRecord.verificationResult === "passed" ? (
                  <Badge className="bg-success/15 text-success hover:bg-success/20">Passed</Badge>
                ) : (
                  <Badge variant="destructive">Failed</Badge>
                )}
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Executed Actions</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {selectedRecord.executedActions.map((action, index) => (
                    <Badge key={`${selectedRecord.id}-${action}-${index}`} variant="outline" className="capitalize">
                      {action}
                    </Badge>
                  ))}
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2">
                <FileClock className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Event Timeline</p>
              </div>
              <div className="mt-3">
                <TimelineList events={selectedRecord.timeline} />
              </div>
            </article>

            <article className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="text-sm font-medium">Human Notes</p>
              <Textarea
                className="mt-2 min-h-28"
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                placeholder="Add post-incident notes and follow-up actions."
              />
              <Button size="sm" className="mt-3" disabled={isSavingNote} onClick={() => void saveNotes()}>
                <Save className="mr-1.5 h-4 w-4" />
                {isSavingNote ? "Saving..." : "Save Notes"}
              </Button>
            </article>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
