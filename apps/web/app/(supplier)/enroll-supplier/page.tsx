"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { ZonePicker } from "@/components/zone-picker";
import { apiFetch } from "@/lib/api";

export default function SupplierEnrollPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    address: "",
    certifications: [] as string[],
    zoneId: "",
  });

  const CERT_OPTIONS = [
    "USDA Organic",
    "Non-GMO",
    "Fair Trade",
    "Rainforest Alliance",
    "GAP Certified",
    "Local Farm Verified",
  ];

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleCertToggle(cert: string) {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter((c) => c !== cert)
        : [...prev.certifications, cert],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("You must be signed in to enroll.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/suppliers/enroll", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      router.push("/inventory");
    } catch (err: any) {
      setError(err.message || "Enrollment failed.");
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Supplier Enrollment</h1>
        <p className="mb-8 text-muted-foreground">
          Register as a supplier to list your inventory on Dotted.
        </p>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="businessName" className="mb-1 block text-sm font-medium">
              Business Name
            </label>
            <input
              id="businessName"
              name="businessName"
              required
              value={formData.businessName}
              onChange={handleChange}
              className={inputClass}
              placeholder="Green Valley Farms"
            />
          </div>

          <div>
            <label htmlFor="supplier-address" className="mb-1 block text-sm font-medium">
              Full Address
            </label>
            <input
              id="supplier-address"
              name="address"
              required
              value={formData.address}
              onChange={handleChange}
              className={inputClass}
              placeholder="123 Farm Road, Austin, TX 78701"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Include street, city, state, and zip code.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Certifications</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CERT_OPTIONS.map((cert) => (
                <label
                  key={cert}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    formData.certifications.includes(cert)
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.certifications.includes(cert)}
                    onChange={() => handleCertToggle(cert)}
                    className="sr-only"
                  />
                  {cert}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Zone</label>
            <ZonePicker
              value={formData.zoneId}
              onChange={(id) => setFormData((prev) => ({ ...prev, zoneId: id }))}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Enrolling..." : "Complete Enrollment"}
          </button>
        </form>
      </div>
    </div>
  );
}
