import { Card, CardContent } from "@/react-app/components/ui/card";
import { Separator } from "@/react-app/components/ui/separator";

export default function Docs() {
  return (
    <div className="min-h-screen px-8 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold mb-6">InfraMind AI Documentation</h1>

      <Separator className="mb-8" />

      <section className="space-y-6">

        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-3">📘 Platform Overview</h2>
            <p>
              InfraMind AI is an intelligent cloud infrastructure monitoring
              platform that tracks system health, detects anomalies, and predicts
              potential failures using AI-driven insights.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-3">🧠 How It Works</h2>
            <ul className="list-disc ml-6 space-y-2">
              <li>Collects real-time system metrics (CPU, Memory, Disk, Network).</li>
              <li>Analyzes patterns using anomaly detection algorithms.</li>
              <li>Generates AI-based risk scores.</li>
              <li>Sends intelligent alerts before failures occur.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-3">🔌 API Endpoints</h2>
            <ul className="space-y-2 font-mono text-sm">
              <li>GET /api/metrics</li>
              <li>GET /api/alerts</li>
              <li>POST /api/login</li>
              <li>POST /api/signup</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-3">⚙ Deployment Guide</h2>
            <p>
              InfraMind AI runs on Cloudflare Workers with a React frontend
              powered by Vite. Deploy using:
            </p>
            <pre className="bg-muted p-4 rounded mt-4 text-sm">
              npm run build
              <br />
              wrangler deploy
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-3">📊 Monitoring Architecture</h2>
            <p>
              The system follows a microservice-based architecture where
              monitoring agents collect data and send it to the AI analysis
              engine for real-time decision making.
            </p>
          </CardContent>
        </Card>

      </section>
    </div>
  );
}