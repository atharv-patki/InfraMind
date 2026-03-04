import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import Navbar from "@/react-app/components/layout/Navbar";
import Footer from "@/react-app/components/layout/Footer";
import { Check, X, Zap, Building2, Rocket } from "lucide-react";
import { useState } from "react";

export default function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Simple, Transparent
              <span className="block text-gradient">Pricing</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Start free and scale as you grow. No hidden fees, no surprises.
            </p>

            {/* Billing Toggle */}
            <div className="mt-10 flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>
                Monthly
              </span>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  annual ? 'bg-primary' : 'bg-secondary'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                    annual ? 'left-8' : 'left-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
                Annual
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">
                  Save 20%
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <PricingCard
              icon={<Zap className="w-5 h-5" />}
              name="Starter"
              description="Perfect for small teams getting started with monitoring"
              price={annual ? 0 : 0}
              period={annual ? '/year' : '/month'}
              cta="Start Free"
              ctaVariant="outline"
              features={[
                { text: 'Up to 5 servers', included: true },
                { text: '1-day data retention', included: true },
                { text: 'Email alerts', included: true },
                { text: 'Basic dashboards', included: true },
                { text: 'Community support', included: true },
                { text: 'AI anomaly detection', included: false },
                { text: 'Auto-healing rules', included: false },
                { text: 'Custom integrations', included: false },
              ]}
            />

            {/* Pro - Popular */}
            <PricingCard
              icon={<Rocket className="w-5 h-5" />}
              name="Pro"
              description="For growing teams that need advanced features"
              price={annual ? 79 : 99}
              period={annual ? '/month, billed annually' : '/month'}
              cta="Start Free Trial"
              ctaVariant="default"
              popular
              features={[
                { text: 'Up to 50 servers', included: true },
                { text: '30-day data retention', included: true },
                { text: 'Multi-channel alerts', included: true },
                { text: 'Custom dashboards', included: true },
                { text: 'Priority support', included: true },
                { text: 'AI anomaly detection', included: true },
                { text: 'Auto-healing rules', included: true },
                { text: 'Custom integrations', included: false },
              ]}
            />

            {/* Enterprise */}
            <PricingCard
              icon={<Building2 className="w-5 h-5" />}
              name="Enterprise"
              description="For large organizations with complex requirements"
              price="Custom"
              period=""
              cta="Contact Sales"
              ctaVariant="outline"
              features={[
                { text: 'Unlimited servers', included: true },
                { text: '1-year data retention', included: true },
                { text: 'Multi-channel alerts', included: true },
                { text: 'Custom dashboards', included: true },
                { text: 'Dedicated support', included: true },
                { text: 'AI anomaly detection', included: true },
                { text: 'Auto-healing rules', included: true },
                { text: 'Custom integrations', included: true },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Compare Plans</h2>
            <p className="mt-4 text-muted-foreground">
              A detailed breakdown of what's included in each plan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full max-w-4xl mx-auto">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 pr-4 font-medium">Feature</th>
                  <th className="text-center py-4 px-4 font-medium">Starter</th>
                  <th className="text-center py-4 px-4 font-medium text-primary">Pro</th>
                  <th className="text-center py-4 pl-4 font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <ComparisonRow feature="Servers" starter="5" pro="50" enterprise="Unlimited" />
                <ComparisonRow feature="Data Retention" starter="1 day" pro="30 days" enterprise="1 year" />
                <ComparisonRow feature="Users" starter="3" pro="15" enterprise="Unlimited" />
                <ComparisonRow feature="Alert Channels" starter="Email" pro="All channels" enterprise="All + custom" />
                <ComparisonRow feature="Dashboards" starter="3" pro="Unlimited" enterprise="Unlimited" />
                <ComparisonRow feature="API Access" starter={false} pro={true} enterprise={true} />
                <ComparisonRow feature="AI Anomaly Detection" starter={false} pro={true} enterprise={true} />
                <ComparisonRow feature="Auto-Healing" starter={false} pro={true} enterprise={true} />
                <ComparisonRow feature="Predictive Insights" starter={false} pro={true} enterprise={true} />
                <ComparisonRow feature="SSO/SAML" starter={false} pro={false} enterprise={true} />
                <ComparisonRow feature="Custom Integrations" starter={false} pro={false} enterprise={true} />
                <ComparisonRow feature="SLA" starter="99.9%" pro="99.95%" enterprise="99.99%" />
                <ComparisonRow feature="Support" starter="Community" pro="Priority" enterprise="Dedicated" />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 border-t border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-6">
            <FaqItem
              question="Can I try Pro features before committing?"
              answer="Yes! All plans come with a 14-day free trial of Pro features. No credit card required to start."
            />
            <FaqItem
              question="What happens when I exceed my server limit?"
              answer="We'll notify you when you're approaching your limit. You can upgrade your plan at any time, or continue with reduced functionality for additional servers."
            />
            <FaqItem
              question="Can I switch plans at any time?"
              answer="Absolutely. Upgrade instantly or downgrade at the end of your billing period. We'll prorate any differences."
            />
            <FaqItem
              question="Do you offer discounts for startups or non-profits?"
              answer="Yes! We offer 50% off for verified startups and non-profit organizations. Contact our sales team to learn more."
            />
            <FaqItem
              question="What payment methods do you accept?"
              answer="We accept all major credit cards, PayPal, and wire transfers for annual Enterprise plans."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start your free trial today. No credit card required.
          </p>
          <div className="mt-10">
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8 text-base">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

interface PricingCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  price: number | string;
  period: string;
  cta: string;
  ctaVariant: 'default' | 'outline';
  popular?: boolean;
  features: Array<{ text: string; included: boolean }>;
}

function PricingCard({ icon, name, description, price, period, cta, ctaVariant, popular, features }: PricingCardProps) {
  return (
    <div className={`relative rounded-2xl border ${popular ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'} bg-card p-8`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
          Most Popular
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg ${popular ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'} flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-lg">{name}</h3>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{description}</p>

      <div className="mt-6 mb-8">
        <div className="flex items-baseline gap-1">
          {typeof price === 'number' ? (
            <>
              <span className="text-4xl font-bold">${price}</span>
              <span className="text-muted-foreground">{period}</span>
            </>
          ) : (
            <span className="text-4xl font-bold">{price}</span>
          )}
        </div>
      </div>

      <Link to="/signup">
        <Button
          className={`w-full ${ctaVariant === 'default' ? 'bg-primary hover:bg-primary/90' : ''}`}
          variant={ctaVariant}
        >
          {cta}
        </Button>
      </Link>

      <ul className="mt-8 space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            {feature.included ? (
              <Check className="w-4 h-4 text-success shrink-0" />
            ) : (
              <X className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            )}
            <span className={feature.included ? '' : 'text-muted-foreground/50'}>{feature.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComparisonRow({ feature, starter, pro, enterprise }: { 
  feature: string; 
  starter: string | boolean; 
  pro: string | boolean; 
  enterprise: string | boolean;
}) {
  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-4 h-4 text-success mx-auto" />
      ) : (
        <X className="w-4 h-4 text-muted-foreground/50 mx-auto" />
      );
    }
    return <span>{value}</span>;
  };

  return (
    <tr className="border-b border-border/50">
      <td className="py-3 pr-4 text-muted-foreground">{feature}</td>
      <td className="py-3 px-4 text-center">{renderValue(starter)}</td>
      <td className="py-3 px-4 text-center">{renderValue(pro)}</td>
      <td className="py-3 pl-4 text-center">{renderValue(enterprise)}</td>
    </tr>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="p-6 rounded-xl border border-border bg-card">
      <h3 className="font-semibold">{question}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{answer}</p>
    </div>
  );
}
