import { Header } from "@/components/header";

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="mb-4">By using Dotted, you agree to these Terms of Service. If you do not agree, please do not use the platform.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">2. Description of Service</h2>
          <p className="mb-4">Dotted is a hyperlocal, community-driven daily dish marketplace that connects consumers, restaurants, and local food suppliers through AI-curated daily meal cycles.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">3. User Accounts</h2>
          <p className="mb-4">You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">4. Orders and Payments</h2>
          <p className="mb-4">All orders are subject to availability. Prices are set by participating restaurants through the bidding process. Payments are processed securely through Stripe.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">5. Restaurant Partners</h2>
          <p className="mb-4">Restaurants are responsible for food safety, quality, and timely preparation. Dotted facilitates the connection but is not liable for food quality or safety.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">6. Supplier Partners</h2>
          <p className="mb-4">Suppliers must accurately represent their inventory, including organic certifications and pricing. Misrepresentation may result in account suspension.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">7. Limitation of Liability</h2>
          <p className="mb-4">Dotted is provided &quot;as is&quot; without warranties. We are not liable for any damages arising from use of the platform.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">8. Contact</h2>
          <p className="mb-4">For questions about these terms, contact us at legal@dotted.app.</p>
        </div>
      </div>
    </div>
  );
}
