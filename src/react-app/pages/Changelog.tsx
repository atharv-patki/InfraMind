import Navbar from "@/react-app/components/layout/Navbar";
import Footer from "@/react-app/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";

const releases = [
  {
    version: "v1.4.0",
    date: "March 2026",
    type: "Feature",
    notes: "Added AWS operations dashboard updates, incident lifecycle UI, and playbook builder improvements.",
  },
  {
    version: "v1.3.0",
    date: "February 2026",
    type: "Feature",
    notes: "Introduced account-based authentication flow, protected routes, and in-app documentation area.",
  },
  {
    version: "v1.2.1",
    date: "January 2026",
    type: "Fix",
    notes: "Improved signup/login validation and session handling with cleaner error states.",
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
            <p className="mt-3 text-muted-foreground">
              Product updates and release notes for InfraMind AI.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {releases.map((release) => (
              <Card key={release.version}>
                <CardHeader className="border-b border-border/70">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{release.version}</CardTitle>
                    <Badge variant="outline">{release.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{release.date}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{release.notes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
