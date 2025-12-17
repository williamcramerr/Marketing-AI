import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Marketing Pilot AI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            Autonomous Marketing
            <br />
            <span className="text-primary">That Never Sleeps</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            Marketing Pilot AI plans, executes, monitors, and optimizes your marketing 24/7.
            Set your goals and guardrails. Let the AI do the rest.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/signup">
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                View Demo
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t bg-muted/50">
          <div className="container mx-auto px-4 py-24">
            <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-4 text-4xl">1</div>
                <h3 className="mb-2 text-xl font-semibold">Configure Goals</h3>
                <p className="text-muted-foreground">
                  Define your marketing goals, target audience, and brand guidelines.
                  Set guardrails and approval rules.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-4 text-4xl">2</div>
                <h3 className="mb-2 text-xl font-semibold">AI Creates & Executes</h3>
                <p className="text-muted-foreground">
                  The AI generates content, schedules campaigns, and executes across
                  email, blog, and social channels.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-4 text-4xl">3</div>
                <h3 className="mb-2 text-xl font-semibold">Monitor & Optimize</h3>
                <p className="text-muted-foreground">
                  Track performance metrics, review AI decisions, and watch as the
                  system continuously improves.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-24">
          <h2 className="mb-12 text-center text-3xl font-bold">Key Features</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Always On',
                description: 'Runs 24/7 with minimal human input. Your marketing never stops.',
              },
              {
                title: 'Safe by Default',
                description:
                  'Comprehensive policy engine with rate limits, banned phrases, and claim verification.',
              },
              {
                title: 'Human Oversight',
                description:
                  'Flexible approval workflows. Auto-approve safe content, review sensitive material.',
              },
              {
                title: 'Multi-Channel',
                description: 'Email campaigns, blog content, landing pages, and social posts.',
              },
              {
                title: 'Performance Tracking',
                description: 'Focus on metrics that matter: conversions, qualified leads, revenue.',
              },
              {
                title: 'Continuous Learning',
                description: 'A/B testing and optimization that improves results over time.',
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-lg border p-6">
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Marketing Pilot AI - Autonomous Marketing for SaaS</p>
        </div>
      </footer>
    </div>
  );
}
