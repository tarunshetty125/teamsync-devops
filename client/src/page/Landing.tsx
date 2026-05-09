import { useEffect, useState } from "react";
import { ChevronRight, CheckCircle2, Zap, Users, BarChart3, Calendar, Clock, Shield, AudioWaveform } from "lucide-react";

type NavigateFn = (path: string, options?: { replace?: boolean }) => void;

type LandingProps = {
  navigateFn?: NavigateFn;
};

const LandingPage = ({ navigateFn }: LandingProps) => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const safeSetShowAuth = () => {
    try {
      sessionStorage.setItem("showAuth", "true");
    } catch (e) {}
  };

  const navigateTo = (path: string, replace = false) => {
    if (typeof navigateFn === "function") {
      navigateFn(path, { replace });
      return;
    }
    replace ? window.location.replace(path) : (window.location.href = path);
  };

  const openAuth = () => {
    safeSetShowAuth();
    navigateTo("/", true);
  };

  const features = [
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Plan sprints and schedule tasks with AI-powered suggestions",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Collaborate seamlessly with your team in real-time",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Track progress with detailed reports and insights",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Built for speed with instant updates across your team",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level security for your project data",
    },
    {
      icon: Clock,
      title: "Time Tracking",
      description: "Monitor time spent on tasks and optimize workflows",
    },
  ];

  const faqs = [
    {
      q: "How do I get started?",
      a: "Sign up for free, create your first workspace, and start managing projects in minutes.",
    },
    {
      q: "Can I import my existing projects?",
      a: "Yes! We support imports from Jira, Asana, Monday.com, and other popular tools.",
    },
    {
      q: "Is there a free plan?",
      a: "Absolutely! Our free plan includes up to 5 team members and unlimited projects.",
    },
    {
      q: "How is my data secured?",
      a: "All data is encrypted in transit and at rest using industry-standard security protocols.",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-96 h-96 bg-green-500/10 rounded-full blur-3xl -top-20 -left-20"
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        ></div>
        <div
          className="absolute w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -bottom-20 -right-20"
          style={{ transform: `translateY(${scrollY * -0.3}px)` }}
        ></div>
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center border border-white/20">
              <AudioWaveform className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-whitesmoke-400">TeamSync</span>
          </div>

          <div className="hidden md:flex gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </div>

          <div className="flex gap-2">
            <button
              onClick={openAuth}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-white/20 hover:bg-white/10 transition"
            >
              Login
            </button>
            <button
              onClick={openAuth}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-black font-semibold hover:bg-green-400 transition"
            >
              Sign up
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-in fade-in duration-1000">
            <div className="inline-block px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 mb-6">
              <span className="text-green-400 text-sm font-medium">✨ Now with AI-powered scheduling</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              Plan. Track.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
                Ship Projects
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              The all-in-one project scheduling platform built for remote teams. Manage sprints, track tasks, and deliver on time.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={openAuth}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-black font-semibold hover:shadow-lg hover:shadow-green-500/50 transition-all flex items-center justify-center gap-2 group"
              >
                Get started free
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
              <button
                onClick={openAuth}
                className="px-8 py-4 rounded-lg border border-white/20 hover:bg-white/10 font-semibold transition-all"
              >
                Schedule demo
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-white/10">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">30K+</p>
                <p className="text-gray-400 text-sm mt-2">Active users</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">99.9%</p>
                <p className="text-gray-400 text-sm mt-2">Uptime SLA</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">200+</p>
                <p className="text-gray-400 text-sm mt-2">Integrations</p>
              </div>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative h-96 rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 via-transparent to-blue-500/10 overflow-hidden mt-20 animate-in fade-in duration-1000 delay-300">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid grid-cols-3 gap-4 p-8 w-full h-full">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-white/5 border border-white/10 animate-pulse"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      height: `${40 + (i % 3) * 20}px`,
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES SECTION */}
      <div id="features" className="relative py-20 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-gray-400 text-lg">Powerful features designed for project teams</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={i}
                  className="p-6 rounded-xl border border-white/10 hover:border-green-500/50 bg-white/5 hover:bg-white/10 transition-all hover:shadow-lg hover:shadow-green-500/10 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition">
                    <IconComponent className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SOCIAL PROOF */}
      <div className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Trusted by leading teams</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-center">
            {["Stripe", "Vercel", "Figma", "Slack"].map((company, i) => (
              <div key={i} className="text-gray-500 font-semibold">{company}</div>
            ))}
          </div>

          <div className="mt-12 p-8 rounded-2xl border border-green-500/20 bg-green-500/5">
            <p className="text-gray-300 text-lg mb-4 italic">
              "TeamSync has transformed how our team manages projects. We ship 40% faster."
            </p>
            <p className="text-green-400 font-semibold">Alex Chen, PM at TechCorp</p>
          </div>
        </div>
      </div>

      {/* PRICING SECTION */}
      <div id="pricing" className="relative py-20 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-400 text-lg">Choose the plan that fits your team</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Free",
                price: "$0",
                description: "For individuals and small teams",
                features: ["Up to 5 team members", "5 projects", "Basic analytics", "Email support"],
                cta: "Get started",
              },
              {
                name: "Pro",
                price: "$29",
                description: "For growing teams",
                features: ["Unlimited team members", "Unlimited projects", "Advanced analytics", "Priority support", "Custom workflows"],
                cta: "Start free trial",
                highlighted: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                description: "For large organizations",
                features: ["Everything in Pro", "SSO & SAML", "Advanced security", "Dedicated support", "SLA guarantee"],
                cta: "Contact sales",
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`p-8 rounded-2xl border transition-all ${
                  plan.highlighted
                    ? "border-green-500 bg-green-500/10 scale-105"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.price !== "Custom" && <span className="text-gray-400">/mo</span>}
                </div>
                <button
                  onClick={openAuth}
                  className={`w-full py-3 rounded-lg font-semibold mb-6 transition-all ${
                    plan.highlighted
                      ? "bg-green-500 text-black hover:bg-green-400"
                      : "border border-white/20 hover:bg-white/10"
                  }`}
                >
                  {plan.cta}
                </button>
                <div className="space-y-3">
                  {plan.features.map((feature, j) => (
                    <div key={j} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ SECTION */}
      <div id="faq" className="relative py-20 px-6 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Frequently asked questions</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group border border-white/10 rounded-lg p-6 cursor-pointer hover:border-green-500/50 transition-all">
                <summary className="flex items-center justify-between font-semibold">
                  {faq.q}
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-gray-400 text-sm">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* CTA SECTION */}
      <div className="relative py-20 px-6 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to transform your workflow?</h2>
          <p className="text-gray-400 text-lg mb-8">Join thousands of teams already using TeamSync</p>
          <button
            onClick={openAuth}
            className="px-8 py-4 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-black font-semibold hover:shadow-lg hover:shadow-green-500/50 transition-all inline-flex items-center gap-2 group"
          >
            Get started free today
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="relative py-12 px-6 border-t border-white/10 text-center text-gray-500 text-sm">
        <div className="max-w-7xl mx-auto">
          <p>&copy; 2026 TeamSync. All rights reserved.</p>
          <div className="flex gap-6 justify-center mt-4">
            <a href="#" className="hover:text-white transition">Privacy</a>
            <a href="#" className="hover:text-white transition">Terms</a>
            <a href="#" className="hover:text-white transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
