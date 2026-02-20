import { Header } from "@/components/header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p className="mb-4">We collect information you provide directly: name, email, and role. For restaurants and suppliers, we also collect business information including address, certifications, and licensing details.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <p className="mb-4">We use your information to operate the Dotted platform, process orders, match suppliers with restaurants, and send notifications about cycle updates and order status.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">3. Data Sharing</h2>
          <p className="mb-4">We share limited information between platform participants as needed: restaurant names and addresses with consumers, order details with restaurants, and purchase orders with suppliers.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">4. Payment Data</h2>
          <p className="mb-4">Payment processing is handled by Stripe. We do not store credit card numbers or sensitive payment information on our servers.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">5. Data Security</h2>
          <p className="mb-4">We use industry-standard security measures including encrypted connections (HTTPS), hashed passwords (bcrypt), and JWT-based authentication.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">6. Data Retention</h2>
          <p className="mb-4">We retain your data as long as your account is active. You can request account deletion by contacting privacy@dotted.app.</p>

          <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">7. Contact</h2>
          <p className="mb-4">For privacy-related inquiries, contact us at privacy@dotted.app.</p>
        </div>
      </div>
    </div>
  );
}
