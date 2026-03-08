import { useEffect } from "react";
import { useLocation } from "react-router";
import { Building2, MessageSquareText, Newspaper, Users } from "lucide-react";
import Navbar from "@/react-app/components/layout/Navbar";
import Footer from "@/react-app/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";

const sections = [
  {
    id: "about",
    title: "About InfraMind",
    icon: Building2,
    content:
      "InfraMind AI helps engineering teams reduce downtime with intelligent monitoring, incident workflows, and automated recovery.",
  },
  {
    id: "blog",
    title: "Blog",
    icon: Newspaper,
    content:
      "Engineering write-ups, product announcements, and best practices for cloud reliability and operational excellence.",
  },
  {
    id: "careers",
    title: "Careers",
    icon: Users,
    content:
      "We are building the future of self-healing infrastructure. Open roles are published here with role expectations and hiring updates.",
  },
  {
    id: "contact",
    title: "Contact",
    icon: MessageSquareText,
    content:
      "Reach our team for sales, support, and partnerships at contact@inframind.ai. Enterprise teams can request a guided demo.",
  },
];

export default function CompanyPage() {
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
            <h1 className="text-4xl font-bold tracking-tight">Company</h1>
            <p className="mt-3 text-muted-foreground">
              Learn more about InfraMind AI, our updates, careers, and contact channels.
            </p>
          </div>

          <div className="mt-10 space-y-6">
            {sections.map((section) => (
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
