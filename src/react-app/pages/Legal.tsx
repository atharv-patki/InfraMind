import { useEffect } from "react";
import { useLocation } from "react-router";
import { Lock, Scale, ShieldCheck } from "lucide-react";
import Navbar from "@/react-app/components/layout/Navbar";
import Footer from "@/react-app/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";

const legalSections = [
  {
    id: "privacy",
    title: "Privacy",
    icon: Lock,
    content:
      "We collect only the data required to operate monitoring, alerting, and account management. Sensitive data is protected with encryption and access controls.",
  },
  {
    id: "terms",
    title: "Terms",
    icon: Scale,
    content:
      "Use of InfraMind AI is governed by service terms covering acceptable use, plan limits, payment terms, and customer responsibilities.",
  },
  {
    id: "security",
    title: "Security",
    icon: ShieldCheck,
    content:
      "InfraMind follows secure development practices, least-privilege access, audit logs, and incident response procedures for platform protection.",
  },
];

export default function LegalPage() {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.getElementById(hash);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight">Legal</h1>
            <p className="mt-3 text-muted-foreground">
              Privacy, terms, and security information for using InfraMind AI.
            </p>
          </div>

          <div className="mt-10 space-y-6">
            {legalSections.map((section) => (
              <Card key={section.id} id={section.id} className="scroll-mt-28">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="flex items-center gap-2">
                    <section.icon className="w-4 h-4 text-primary" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
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
