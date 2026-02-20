"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface InventoryItem {
  id: string;
  ingredientName: string;
  category: string;
  unit: string;
  pricePerUnit: number;
  quantityAvailable: number;
  isOrganic: boolean;
}

export default function InventoryPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newItem, setNewItem] = useState({
    ingredientName: "",
    category: "",
    unit: "",
    pricePerUnit: "",
    quantityAvailable: "",
    isOrganic: false,
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ data: InventoryItem[] }>("/suppliers/inventory")
      .then((res) => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setNewItem((prev) => ({ ...prev, [e.target.name]: value }));
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const item = {
      ingredientName: newItem.ingredientName,
      category: newItem.category,
      unit: newItem.unit,
      pricePerUnit: parseFloat(newItem.pricePerUnit),
      quantityAvailable: parseFloat(newItem.quantityAvailable),
      isOrganic: newItem.isOrganic,
    };

    if (token) {
      try {
        const res = await apiFetch<{ data: InventoryItem[] }>("/suppliers/inventory", {
          method: "POST",
          body: JSON.stringify({ items: [item] }),
        });
        setItems((prev) => [...prev, ...res.data]);
      } catch (err: any) {
        setError(err.message || "Failed to add item");
        return;
      }
    } else {
      // Fallback to local state for unauthenticated demo
      setItems((prev) => [...prev, { id: crypto.randomUUID(), ...item }]);
    }

    setNewItem({
      ingredientName: "",
      category: "",
      unit: "",
      pricePerUnit: "",
      quantityAvailable: "",
      isOrganic: false,
    });
  }

  async function handleRemoveItem(id: string) {
    if (token) {
      try {
        await apiFetch(`/suppliers/inventory/${id}`, { method: "DELETE" });
      } catch (err: any) {
        setError(err.message || "Failed to remove item");
        return;
      }
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleUpdateItem(id: string, field: string, value: number | boolean) {
    if (token) {
      try {
        await apiFetch(`/suppliers/inventory/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ [field]: value }),
        });
      } catch (err: any) {
        setError(err.message || "Failed to update item");
        return;
      }
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-8">
        <h1 className="mb-2 text-3xl font-bold">Supplier Inventory</h1>
        <p className="mb-8 text-muted-foreground">
          Manage your available ingredients. These are used by the AI to suggest daily dishes.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!token && (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Sign in as a supplier to sync inventory with the server.
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Add Inventory Item</h2>
            <form onSubmit={handleAddItem} className="space-y-4 rounded-lg border p-4">
              <div>
                <label htmlFor="ingredientName" className="mb-1 block text-sm font-medium">
                  Ingredient Name
                </label>
                <input
                  id="ingredientName"
                  name="ingredientName"
                  required
                  value={newItem.ingredientName}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Organic Tomatoes"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="mb-1 block text-sm font-medium">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    required
                    value={newItem.category}
                    onChange={handleChange}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Greens">Greens</option>
                    <option value="Herbs">Herbs</option>
                    <option value="Spices">Spices</option>
                    <option value="Meat">Meat</option>
                    <option value="Poultry">Poultry</option>
                    <option value="Seafood">Seafood</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Grains">Grains</option>
                    <option value="Bakery">Bakery</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="unit" className="mb-1 block text-sm font-medium">
                    Unit
                  </label>
                  <input
                    id="unit"
                    name="unit"
                    required
                    value={newItem.unit}
                    onChange={handleChange}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="lb"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pricePerUnit" className="mb-1 block text-sm font-medium">
                    Price Per Unit ($)
                  </label>
                  <input
                    id="pricePerUnit"
                    name="pricePerUnit"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newItem.pricePerUnit}
                    onChange={handleChange}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="3.50"
                  />
                </div>
                <div>
                  <label htmlFor="quantityAvailable" className="mb-1 block text-sm font-medium">
                    Quantity Available
                  </label>
                  <input
                    id="quantityAvailable"
                    name="quantityAvailable"
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={newItem.quantityAvailable}
                    onChange={handleChange}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isOrganic"
                  name="isOrganic"
                  type="checkbox"
                  checked={newItem.isOrganic}
                  onChange={handleChange}
                  className="rounded border"
                />
                <label htmlFor="isOrganic" className="text-sm">
                  Certified Organic
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add Item
              </button>
            </form>
          </div>

          <div>
            <h2 className="mb-4 text-xl font-semibold">
              Current Inventory ({items.length} items)
            </h2>
            {loading ? (
              <p className="text-muted-foreground">Loading inventory...</p>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No items yet. Add your first inventory item.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.ingredientName}</span>
                        {item.isOrganic && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            Organic
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {item.quantityAvailable} {item.unit} @ ${item.pricePerUnit.toFixed(2)}/{item.unit}
                        <span className="ml-2 text-xs">({item.category})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              "quantityAvailable",
                              Math.max(0, item.quantityAvailable - 10)
                            )
                          }
                          className="rounded border px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          -10
                        </button>
                        <button
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              "quantityAvailable",
                              item.quantityAvailable + 10
                            )
                          }
                          className="rounded border px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          +10
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-sm text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
