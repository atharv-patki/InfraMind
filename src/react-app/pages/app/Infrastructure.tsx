import { useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/react-app/components/ui/table";

type ServerStatus = "Healthy" | "Warning" | "Critical";
type FilterStatus = "All" | ServerStatus;

type ServerItem = {
  id: string;
  name: string;
  ip: string;
  region: string;
  uptime: string;
  cpu: number;
  memory: number;
  status: ServerStatus;
  lastHeartbeat: string;
};

const initialServers: ServerItem[] = [
  {
    id: "srv-01",
    name: "prod-api-01",
    ip: "10.0.1.12",
    region: "us-east-1",
    uptime: "28d 14h",
    cpu: 41,
    memory: 62,
    status: "Healthy",
    lastHeartbeat: "8s ago",
  },
  {
    id: "srv-02",
    name: "prod-api-02",
    ip: "10.0.1.13",
    region: "us-east-1",
    uptime: "23d 08h",
    cpu: 69,
    memory: 78,
    status: "Warning",
    lastHeartbeat: "12s ago",
  },
  {
    id: "srv-03",
    name: "prod-worker-01",
    ip: "10.0.2.21",
    region: "eu-west-1",
    uptime: "16d 21h",
    cpu: 52,
    memory: 58,
    status: "Healthy",
    lastHeartbeat: "11s ago",
  },
  {
    id: "srv-04",
    name: "db-primary-01",
    ip: "10.0.3.10",
    region: "ap-south-1",
    uptime: "61d 02h",
    cpu: 88,
    memory: 91,
    status: "Critical",
    lastHeartbeat: "4s ago",
  },
  {
    id: "srv-05",
    name: "cache-node-01",
    ip: "10.0.4.16",
    region: "us-west-2",
    uptime: "34d 19h",
    cpu: 46,
    memory: 49,
    status: "Healthy",
    lastHeartbeat: "9s ago",
  },
];

const selectClassName =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function InfrastructurePage() {
  const [servers, setServers] = useState<ServerItem[]>(initialServers);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("All");
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [error, setError] = useState("");

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      const search = query.trim().toLowerCase();
      const matchesSearch =
        search.length === 0 ||
        server.name.toLowerCase().includes(search) ||
        server.ip.includes(search) ||
        server.region.toLowerCase().includes(search);
      const matchesStatus = statusFilter === "All" || server.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [query, servers, statusFilter]);

  const totals = useMemo(() => {
    const healthy = servers.filter((server) => server.status === "Healthy").length;
    const warning = servers.filter((server) => server.status === "Warning").length;
    const critical = servers.filter((server) => server.status === "Critical").length;
    return { healthy, warning, critical };
  }, [servers]);

  const handleAddServer = () => {
    const trimmedName = name.trim();
    const trimmedIp = ip.trim();
    if (!trimmedName || !trimmedIp) {
      setError("Server name and IP address are required.");
      return;
    }

    const cpu = randomInt(22, 86);
    const memory = randomInt(28, 92);

    const newServer: ServerItem = {
      id: `srv-${Date.now()}`,
      name: trimmedName,
      ip: trimmedIp,
      region,
      uptime: "0d 00h",
      cpu,
      memory,
      status: cpu > 85 || memory > 88 ? "Warning" : "Healthy",
      lastHeartbeat: "just now",
    };

    setServers((prev) => [newServer, ...prev]);
    setName("");
    setIp("");
    setRegion("us-east-1");
    setError("");
  };

  const handleDelete = (id: string) => {
    setServers((prev) => prev.filter((server) => server.id !== id));
  };

  const refreshStatuses = () => {
    setServers((prev) =>
      prev.map((server) => {
        const cpu = clamp(server.cpu + randomInt(-8, 8), 15, 98);
        const memory = clamp(server.memory + randomInt(-6, 7), 20, 97);
        let status: ServerStatus = "Healthy";
        if (cpu >= 90 || memory >= 92) status = "Critical";
        else if (cpu >= 78 || memory >= 82) status = "Warning";

        return {
          ...server,
          cpu,
          memory,
          status,
          lastHeartbeat: `${randomInt(3, 16)}s ago`,
        };
      })
    );
  };

  return (
    <div className="space-y-6">
      <section className="grid sm:grid-cols-3 gap-4">
        <StatusCard label="Healthy" value={totals.healthy} tone="success" />
        <StatusCard label="Warning" value={totals.warning} tone="warning" />
        <StatusCard label="Critical" value={totals.critical} tone="critical" />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Add Server</CardTitle>
          <p className="text-sm text-muted-foreground">
            Register a new host to include it in infrastructure monitoring.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input
              placeholder="Server name (e.g., prod-web-03)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="IP address (e.g., 10.0.5.30)"
              value={ip}
              onChange={(event) => setIp(event.target.value)}
            />
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className={selectClassName}
            >
              <option value="us-east-1">us-east-1</option>
              <option value="us-west-2">us-west-2</option>
              <option value="eu-west-1">eu-west-1</option>
              <option value="ap-south-1">ap-south-1</option>
              <option value="ap-southeast-1">ap-southeast-1</option>
            </select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center gap-2">
            <Button onClick={handleAddServer}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Server
            </Button>
            <Button variant="outline" onClick={refreshStatuses}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Server Inventory</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Search and filter by status, region, or host name.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Search server, IP, or region"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="sm:w-64"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
                className={`${selectClassName} sm:w-40`}
              >
                <option value="All">All statuses</option>
                <option value="Healthy">Healthy</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Server</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Heartbeat</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServers.map((server) => (
                <TableRow key={server.id}>
                  <TableCell className="font-medium">{server.name}</TableCell>
                  <TableCell>{server.ip}</TableCell>
                  <TableCell>{server.region}</TableCell>
                  <TableCell>
                    <StatusBadge status={server.status} />
                  </TableCell>
                  <TableCell>{server.uptime}</TableCell>
                  <TableCell>{server.cpu}%</TableCell>
                  <TableCell>{server.memory}%</TableCell>
                  <TableCell>{server.lastHeartbeat}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleDelete(server.id)}
                      aria-label={`Delete ${server.name}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredServers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No servers match the current filters.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "critical";
}) {
  const toneClass: Record<typeof tone, string> = {
    success: "text-success bg-success/15",
    warning: "text-warning bg-warning/20",
    critical: "text-destructive bg-destructive/15",
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className={`h-8 px-3 rounded-lg text-sm font-medium inline-flex items-center ${toneClass[tone]}`}>
          {label}
        </span>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ServerStatus }) {
  if (status === "Healthy") {
    return <Badge className="bg-success/15 text-success hover:bg-success/20">{status}</Badge>;
  }
  if (status === "Warning") {
    return <Badge className="bg-warning/20 text-warning hover:bg-warning/25">{status}</Badge>;
  }
  return <Badge variant="destructive">{status}</Badge>;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
