import Link from "next/link";
import {
  Briefcase,
  TrendingUp,
  Shield,
  BarChart3,
  Zap,
  Globe,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Real-Time Tracking",
    description: "Monitor your crypto, forex, and commodity investments with live price feeds powered by market data.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data stays yours. Read-only API keys, encrypted storage, and optional two-factor authentication.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Performance charts, P/L breakdowns by asset class, and AI-powered portfolio insights.",
  },
  {
    icon: Zap,
    title: "Smart Signals",
    description: "Technical analysis signals with buy/sell recommendations and risk-optimized allocation profiles.",
  },
  {
    icon: Globe,
    title: "Multi-Exchange",
    description: "Connect Binance, OKX, Bybit, KuCoin, and MEXC. All your holdings in one unified view.",
  },
  {
    icon: Briefcase,
    title: "Portfolio Management",
    description: "Add, sell, and transfer assets. CSV/JSON import. Full transaction history with undo support.",
  },
];

const stats = [
  { value: "5+", label: "Exchanges Supported" },
  { value: "3", label: "Asset Classes" },
  { value: "24/7", label: "Live Monitoring" },
  { value: "100%", label: "Free to Use" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 via-transparent to-accent-secondary/5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              Professional Multi-Asset Portfolio Tracker
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-foreground tracking-tight leading-tight">
              Track Every Asset.
              <br />
              <span className="text-accent-primary">One Dashboard.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-foreground-muted max-w-2xl mx-auto leading-relaxed">
              Crypto, forex, and commodities - all in one place. Connect your exchanges,
              get AI-powered insights, and make smarter investment decisions.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent-primary text-background rounded-xl font-semibold text-lg hover:bg-accent-primary/90 transition-colors shadow-lg shadow-accent-primary/20"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 border border-border text-foreground rounded-xl font-semibold text-lg hover:border-accent-primary hover:text-accent-primary transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section id="stats" className="border-y border-border bg-background-secondary/50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-accent-primary">{stat.value}</div>
                <div className="mt-1 text-sm text-foreground-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 scroll-mt-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Everything You Need</h2>
          <p className="mt-4 text-lg text-foreground-muted max-w-2xl mx-auto">
            A complete toolkit for serious investors who want full visibility into their portfolio.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-border bg-background-card hover:border-accent-primary/40 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-primary/10 flex items-center justify-center mb-4 group-hover:bg-accent-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-accent-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-foreground-muted text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-background-secondary/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready to Take Control?
          </h2>
          <p className="text-lg text-foreground-muted mb-8 max-w-xl mx-auto">
            Join and start tracking your portfolio in under a minute. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            {["Free forever", "No credit card", "Unlimited assets", "Multi-exchange support"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-foreground-muted text-sm">
                <CheckCircle2 className="w-4 h-4 text-accent-success" />
                {item}
              </div>
            ))}
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-10 py-4 bg-accent-primary text-background rounded-xl font-semibold text-lg hover:bg-accent-primary/90 transition-colors shadow-lg shadow-accent-primary/20"
          >
            Create Your Free Account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent-primary/20 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-accent-primary" />
            </div>
            <span className="font-semibold text-foreground text-sm">Portfolio Tracker</span>
          </div>
          <p className="text-sm text-foreground-muted">&copy; {new Date().getFullYear()} Portfolio Tracker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
