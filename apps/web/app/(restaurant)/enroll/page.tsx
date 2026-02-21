"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { ZonePicker } from "@/components/zone-picker";
import { apiFetch } from "@/lib/api";

const CUISINE_OPTIONS = [
  "American",
  "Italian",
  "Mexican",
  "Chinese",
  "Japanese",
  "Indian",
  "Thai",
  "Mediterranean",
  "French",
  "Korean",
  "Vietnamese",
  "BBQ/Grill",
  "Seafood",
  "Vegetarian/Vegan",
  "Fusion",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function EnrollPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    businessLicenseNumber: "",
    taxId: "",
    yearsInOperation: "",
    ownerFullName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    cuisineTypes: [] as string[],
    seatingCapacity: "",
    kitchenCapacity: "",
    healthPermitNumber: "",
    insurancePolicyNumber: "",
    description: "",
    zoneId: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleCuisineToggle(cuisine: string) {
    setFormData((prev) => {
      const exists = prev.cuisineTypes.includes(cuisine);
      return {
        ...prev,
        cuisineTypes: exists
          ? prev.cuisineTypes.filter((c) => c !== cuisine)
          : [...prev.cuisineTypes, cuisine],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const token = localStorage.getItem("token");
    if (!token) {
      setError("You must be signed in to enroll.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        yearsInOperation: Number(formData.yearsInOperation),
        seatingCapacity: Number(formData.seatingCapacity),
        kitchenCapacity: Number(formData.kitchenCapacity),
        website: formData.website || undefined,
        description: formData.description || undefined,
      };

      await apiFetch("/restaurants/enroll", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      router.push("/bids");
    } catch (err: any) {
      setError(err.message || "Enrollment failed. Please check your details.");
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelClass = "mb-1 block text-sm font-medium";

  return (
    <div className="min-h-screen">
      <Header />
    <div className="container max-w-3xl py-8">
      <h1 className="mb-2 text-3xl font-bold">Restaurant Enrollment</h1>
      <p className="mb-8 text-muted-foreground">
        Complete this form to register your restaurant on Dotted. All fields are
        required unless marked optional.
      </p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* 1. Business Identity */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Business Identity</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="businessName" className={labelClass}>
                Business Name
              </label>
              <input
                id="businessName"
                name="businessName"
                required
                value={formData.businessName}
                onChange={handleChange}
                className={inputClass}
                placeholder="Joe's Kitchen"
              />
            </div>
            <div>
              <label htmlFor="businessLicenseNumber" className={labelClass}>
                Business License Number
              </label>
              <input
                id="businessLicenseNumber"
                name="businessLicenseNumber"
                required
                value={formData.businessLicenseNumber}
                onChange={handleChange}
                className={inputClass}
                placeholder="BL-12345"
              />
            </div>
            <div>
              <label htmlFor="taxId" className={labelClass}>
                Tax ID (EIN)
              </label>
              <input
                id="taxId"
                name="taxId"
                required
                value={formData.taxId}
                onChange={handleChange}
                className={inputClass}
                placeholder="12-3456789"
                pattern="\d{2}-\d{7}"
              />
              <p className="mt-1 text-xs text-muted-foreground">Format: XX-XXXXXXX</p>
            </div>
            <div>
              <label htmlFor="yearsInOperation" className={labelClass}>
                Years in Operation
              </label>
              <input
                id="yearsInOperation"
                name="yearsInOperation"
                type="number"
                min="0"
                max="200"
                required
                value={formData.yearsInOperation}
                onChange={handleChange}
                className={inputClass}
                placeholder="5"
              />
            </div>
          </div>
        </fieldset>

        {/* 2. Contact Information */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Contact Information</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ownerFullName" className={labelClass}>
                Owner Full Name
              </label>
              <input
                id="ownerFullName"
                name="ownerFullName"
                required
                value={formData.ownerFullName}
                onChange={handleChange}
                className={inputClass}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                className={inputClass}
                placeholder="5551234567"
              />
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={inputClass}
                placeholder="owner@restaurant.com"
              />
            </div>
            <div>
              <label htmlFor="website" className={labelClass}>
                Website (optional)
              </label>
              <input
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className={inputClass}
                placeholder="https://joeskitchen.com"
              />
            </div>
          </div>
        </fieldset>

        {/* 3. Location */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Location</legend>
          <div>
            <label htmlFor="address" className={labelClass}>
              Street Address
            </label>
            <input
              id="address"
              name="address"
              required
              value={formData.address}
              onChange={handleChange}
              className={inputClass}
              placeholder="123 Main St"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="city" className={labelClass}>
                City
              </label>
              <input
                id="city"
                name="city"
                required
                value={formData.city}
                onChange={handleChange}
                className={inputClass}
                placeholder="Austin"
              />
            </div>
            <div>
              <label htmlFor="state" className={labelClass}>
                State
              </label>
              <select
                id="state"
                name="state"
                required
                value={formData.state}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Select...</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="zipCode" className={labelClass}>
                Zip Code
              </label>
              <input
                id="zipCode"
                name="zipCode"
                required
                value={formData.zipCode}
                onChange={handleChange}
                className={inputClass}
                placeholder="78701"
              />
            </div>
          </div>
        </fieldset>

        {/* 4. Kitchen Details */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Kitchen Details</legend>
          <div>
            <label className={labelClass}>Cuisine Types (select up to 10)</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {CUISINE_OPTIONS.map((cuisine) => (
                <label
                  key={cuisine}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    formData.cuisineTypes.includes(cuisine)
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.cuisineTypes.includes(cuisine)}
                    onChange={() => handleCuisineToggle(cuisine)}
                    className="sr-only"
                  />
                  {cuisine}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="seatingCapacity" className={labelClass}>
                Seating Capacity
              </label>
              <input
                id="seatingCapacity"
                name="seatingCapacity"
                type="number"
                min="1"
                max="2000"
                required
                value={formData.seatingCapacity}
                onChange={handleChange}
                className={inputClass}
                placeholder="50"
              />
            </div>
            <div>
              <label htmlFor="kitchenCapacity" className={labelClass}>
                Kitchen Capacity (plates/hour)
              </label>
              <input
                id="kitchenCapacity"
                name="kitchenCapacity"
                type="number"
                min="1"
                max="5000"
                required
                value={formData.kitchenCapacity}
                onChange={handleChange}
                className={inputClass}
                placeholder="100"
              />
            </div>
          </div>
        </fieldset>

        {/* 5. Compliance & Licensing */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Compliance &amp; Licensing</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="healthPermitNumber" className={labelClass}>
                Health Permit Number
              </label>
              <input
                id="healthPermitNumber"
                name="healthPermitNumber"
                required
                value={formData.healthPermitNumber}
                onChange={handleChange}
                className={inputClass}
                placeholder="HP-9876"
              />
            </div>
            <div>
              <label htmlFor="insurancePolicyNumber" className={labelClass}>
                Insurance Policy Number
              </label>
              <input
                id="insurancePolicyNumber"
                name="insurancePolicyNumber"
                required
                value={formData.insurancePolicyNumber}
                onChange={handleChange}
                className={inputClass}
                placeholder="INS-2024-00123"
              />
            </div>
          </div>
        </fieldset>

        {/* 6. About Your Restaurant */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">About Your Restaurant</legend>
          <div>
            <label htmlFor="description" className={labelClass}>
              Description (optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={1000}
              value={formData.description}
              onChange={handleChange}
              className={inputClass}
              placeholder="Tell us about your restaurant, specialties, and what makes you unique..."
            />
          </div>
        </fieldset>

        {/* Zone Selection */}
        <div>
          <label htmlFor="zoneId" className={labelClass}>
            Zone
          </label>
          <ZonePicker
            id="zoneId"
            value={formData.zoneId}
            onChange={(id) => setFormData((prev) => ({ ...prev, zoneId: id }))}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Select the zone your restaurant operates in.
          </p>
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
