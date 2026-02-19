import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary" />
            <span className="text-xl font-bold">Dotted</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/vote"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Today&apos;s Vote
            </Link>
            <Link
              href="/cycle"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Daily Cycle
            </Link>
            <Link
              href="/reviews"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Reviews
            </Link>
            <Link
              href="/api/auth/signin"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container flex flex-col items-center justify-center gap-8 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Your Neighborhood&apos;s
            <br />
            <span className="text-primary">Dish of the Day</span>
          </h1>
          <p className="max-w-[600px] text-lg text-muted-foreground">
            AI suggests dishes from local supplier inventory. Your community votes.
            Restaurants compete to cook it. Fresh ingredients delivered. Dinner served.
          </p>
          <div className="flex gap-4">
            <Link
              href="/vote"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Vote Today
            </Link>
            <Link
              href="/bids"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              I&apos;m a Restaurant
            </Link>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t bg-muted/50 py-20">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold">How Dotted Works</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "1",
                  title: "AI Suggests",
                  desc: "Every morning, our AI chef creates dishes from local supplier inventory.",
                },
                {
                  step: "2",
                  title: "Community Votes",
                  desc: "Your neighborhood votes for today's dish. The community decides what to eat.",
                },
                {
                  step: "3",
                  title: "Restaurants Bid",
                  desc: "Local restaurants compete to cook the winning dish at the best price.",
                },
                {
                  step: "4",
                  title: "Fresh & Served",
                  desc: "Ingredients sourced from local suppliers. Restaurant prepares. You enjoy.",
                },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="py-20">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold">Join as...</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  role: "Consumer",
                  desc: "Vote on dishes, order dinner, support your local food community.",
                  href: "/vote",
                },
                {
                  role: "Restaurant",
                  desc: "Bid to cook the dish of the day. Ingredients delivered to your door.",
                  href: "/bids",
                },
                {
                  role: "Supplier",
                  desc: "List your inventory. Get automatic orders from the daily cycle.",
                  href: "/inventory",
                },
              ].map((item) => (
                <Link
                  key={item.role}
                  href={item.href}
                  className="group rounded-lg border p-6 transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <h3 className="mb-2 text-xl font-semibold group-hover:text-primary">
                    {item.role}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          Dotted — Hyperlocal community food, powered by AI.
        </div>
      </footer>
    </div>
  );
}
