import { PrismaClient, UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return hashSync(password, 12);
}

async function main() {
  console.log("Seeding database...");

  // --- Create Zones ---
  const zoneConfigs = [
    { slug: "downtown-demo", name: "Downtown Demo District", city: "San Francisco", state: "CA" },
    { slug: "mission-district", name: "Mission District", city: "San Francisco", state: "CA" },
    { slug: "east-austin", name: "East Austin", city: "Austin", state: "TX" },
    { slug: "williamsburg", name: "Williamsburg", city: "Brooklyn", state: "NY" },
    { slug: "silver-lake", name: "Silver Lake", city: "Los Angeles", state: "CA" },
    { slug: "wicker-park", name: "Wicker Park", city: "Chicago", state: "IL" },
    { slug: "hyde-park-tampa", name: "Hyde Park", city: "Tampa", state: "FL" },
    { slug: "capitol-hill", name: "Capitol Hill", city: "Seattle", state: "WA" },
    { slug: "downtown-raleigh", name: "Downtown Raleigh", city: "Raleigh", state: "NC" },
    { slug: "back-bay", name: "Back Bay", city: "Boston", state: "MA" },
    { slug: "midtown-atlanta", name: "Midtown", city: "Atlanta", state: "GA" },
    { slug: "wynwood", name: "Wynwood", city: "Miami", state: "FL" },
    { slug: "dupont-circle", name: "Dupont Circle", city: "Washington", state: "DC" },
  ];

  const zones = [];
  for (const zc of zoneConfigs) {
    const z = await prisma.zone.upsert({
      where: { slug: zc.slug },
      update: {},
      create: {
        id: randomUUID(),
        name: zc.name,
        slug: zc.slug,
        city: zc.city,
        state: zc.state,
        isActive: true,
        dailyCycleConfig: {
          votingStartHour: 6,
          votingEndHour: 12,
          biddingEndHour: 14,
          orderingStartHour: 17,
          orderingEndHour: 21,
        },
      },
    });
    zones.push(z);
    console.log(`Zone created: ${z.name}`);
  }
  const zone = zones[0];

  // --- Create Admin User ---
  const admin = await prisma.user.upsert({
    where: { email: "admin@dotted.local" },
    update: {},
    create: {
      email: "admin@dotted.local",
      name: "Admin User",
      role: UserRole.ADMIN,
      passwordHash: hashPassword("admin123"),
    },
  });

  // --- Create Consumer Users ---
  const consumers = [];
  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.upsert({
      where: { email: `consumer${i}@dotted.local` },
      update: {},
      create: {
        email: `consumer${i}@dotted.local`,
        name: `Consumer ${i}`,
        role: UserRole.CONSUMER,
        passwordHash: hashPassword("password123"),
      },
    });
    consumers.push(user);
  }
  console.log(`Created ${consumers.length} consumers`);

  // --- Create Restaurant Owners + Restaurants ---
  const restaurantData = [
    { name: "Bay Bites Kitchen", capacity: 80, address: "123 Market St, SF" },
    { name: "Golden Gate Grill", capacity: 60, address: "456 Mission St, SF" },
    { name: "Fog City Flavors", capacity: 100, address: "789 Howard St, SF" },
    { name: "Pier 7 Plates", capacity: 50, address: "321 Embarcadero, SF" },
    { name: "SoMa Supper Club", capacity: 120, address: "555 Folsom St, SF" },
  ];

  for (let i = 0; i < restaurantData.length; i++) {
    const owner = await prisma.user.upsert({
      where: { email: `restaurant${i + 1}@dotted.local` },
      update: {},
      create: {
        email: `restaurant${i + 1}@dotted.local`,
        name: `Chef ${restaurantData[i].name.split(" ")[0]}`,
        role: UserRole.RESTAURANT_OWNER,
        passwordHash: hashPassword("password123"),
      },
    });

    await prisma.restaurant.upsert({
      where: { ownerId: owner.id },
      update: {},
      create: {
        ownerId: owner.id,
        name: restaurantData[i].name,
        address: restaurantData[i].address,
        capacity: restaurantData[i].capacity,
        rating: 3.5 + Math.random() * 1.5,
        isVerified: true,
        zoneId: zone.id,
        latitude: 37.78 + Math.random() * 0.02,
        longitude: -122.41 + Math.random() * 0.02,
      },
    });
  }
  console.log(`Created ${restaurantData.length} restaurants`);

  // --- Create Supplier Owners + Suppliers + Inventory ---
  const supplierData = [
    { name: "Fresh Fields Farm", certs: ["Organic", "Local"] },
    { name: "Bay Area Produce Co", certs: ["GAP Certified"] },
    { name: "Pacific Seafood Direct", certs: ["MSC Certified"] },
    { name: "Valley Meats & Poultry", certs: ["USDA Inspected", "Humane Certified"] },
    { name: "Artisan Dairy Collective", certs: ["Organic"] },
    { name: "Golden Grain Mill", certs: ["Non-GMO"] },
    { name: "Herb & Spice Traders", certs: ["Fair Trade"] },
    { name: "Mission Street Bakery Supply", certs: [] },
  ];

  const inventoryItems: { supplierIdx: number; items: { name: string; category: string; unit: string; price: number; qty: number; organic: boolean }[] }[] = [
    {
      supplierIdx: 0,
      items: [
        { name: "Organic Tomatoes", category: "Vegetables", unit: "lb", price: 3.5, qty: 200, organic: true },
        { name: "Baby Spinach", category: "Greens", unit: "lb", price: 4.0, qty: 100, organic: true },
        { name: "Bell Peppers", category: "Vegetables", unit: "lb", price: 2.8, qty: 150, organic: true },
        { name: "Sweet Potatoes", category: "Vegetables", unit: "lb", price: 2.0, qty: 300, organic: true },
        { name: "Zucchini", category: "Vegetables", unit: "lb", price: 2.5, qty: 120, organic: true },
      ],
    },
    {
      supplierIdx: 1,
      items: [
        { name: "Romaine Lettuce", category: "Greens", unit: "head", price: 1.5, qty: 200, organic: false },
        { name: "Yellow Onions", category: "Vegetables", unit: "lb", price: 1.2, qty: 400, organic: false },
        { name: "Garlic", category: "Vegetables", unit: "lb", price: 5.0, qty: 80, organic: false },
        { name: "Carrots", category: "Vegetables", unit: "lb", price: 1.8, qty: 300, organic: false },
        { name: "Mushrooms (Cremini)", category: "Vegetables", unit: "lb", price: 4.5, qty: 100, organic: false },
      ],
    },
    {
      supplierIdx: 2,
      items: [
        { name: "Wild Salmon Fillet", category: "Seafood", unit: "lb", price: 18.0, qty: 50, organic: false },
        { name: "Pacific Shrimp", category: "Seafood", unit: "lb", price: 14.0, qty: 80, organic: false },
        { name: "Sea Bass", category: "Seafood", unit: "lb", price: 22.0, qty: 30, organic: false },
      ],
    },
    {
      supplierIdx: 3,
      items: [
        { name: "Chicken Breast", category: "Poultry", unit: "lb", price: 6.5, qty: 200, organic: false },
        { name: "Ground Beef (80/20)", category: "Meat", unit: "lb", price: 8.0, qty: 150, organic: false },
        { name: "Pork Tenderloin", category: "Meat", unit: "lb", price: 9.0, qty: 80, organic: false },
        { name: "Lamb Chops", category: "Meat", unit: "lb", price: 16.0, qty: 40, organic: false },
      ],
    },
    {
      supplierIdx: 4,
      items: [
        { name: "Fresh Mozzarella", category: "Dairy", unit: "lb", price: 7.0, qty: 60, organic: true },
        { name: "Heavy Cream", category: "Dairy", unit: "quart", price: 4.5, qty: 100, organic: true },
        { name: "Butter (Unsalted)", category: "Dairy", unit: "lb", price: 5.0, qty: 200, organic: true },
        { name: "Parmesan Cheese", category: "Dairy", unit: "lb", price: 12.0, qty: 40, organic: false },
      ],
    },
    {
      supplierIdx: 5,
      items: [
        { name: "Arborio Rice", category: "Grains", unit: "lb", price: 3.0, qty: 200, organic: false },
        { name: "Penne Pasta", category: "Grains", unit: "lb", price: 2.0, qty: 300, organic: false },
        { name: "All-Purpose Flour", category: "Grains", unit: "lb", price: 1.0, qty: 500, organic: false },
        { name: "Quinoa", category: "Grains", unit: "lb", price: 5.5, qty: 100, organic: false },
      ],
    },
    {
      supplierIdx: 6,
      items: [
        { name: "Fresh Basil", category: "Herbs", unit: "bunch", price: 2.5, qty: 80, organic: true },
        { name: "Cilantro", category: "Herbs", unit: "bunch", price: 1.5, qty: 100, organic: false },
        { name: "Cumin (Ground)", category: "Spices", unit: "oz", price: 1.0, qty: 200, organic: false },
        { name: "Smoked Paprika", category: "Spices", unit: "oz", price: 1.2, qty: 150, organic: false },
        { name: "Saffron", category: "Spices", unit: "gram", price: 8.0, qty: 20, organic: false },
      ],
    },
    {
      supplierIdx: 7,
      items: [
        { name: "Sourdough Bread", category: "Bakery", unit: "loaf", price: 5.0, qty: 60, organic: false },
        { name: "Pizza Dough", category: "Bakery", unit: "ball", price: 3.0, qty: 80, organic: false },
        { name: "Brioche Buns", category: "Bakery", unit: "pack", price: 4.5, qty: 50, organic: false },
      ],
    },
  ];

  for (let i = 0; i < supplierData.length; i++) {
    const owner = await prisma.user.upsert({
      where: { email: `supplier${i + 1}@dotted.local` },
      update: {},
      create: {
        email: `supplier${i + 1}@dotted.local`,
        name: `${supplierData[i].name} Owner`,
        role: UserRole.SUPPLIER,
        passwordHash: hashPassword("password123"),
      },
    });

    const supplier = await prisma.supplier.upsert({
      where: { ownerId: owner.id },
      update: {},
      create: {
        ownerId: owner.id,
        businessName: supplierData[i].name,
        address: `${100 + i * 100} Produce Ave, SF`,
        certifications: supplierData[i].certs,
        rating: 3.5 + Math.random() * 1.5,
        isVerified: true,
        zoneId: zone.id,
        latitude: 37.77 + Math.random() * 0.03,
        longitude: -122.42 + Math.random() * 0.03,
      },
    });

    // Add inventory items for matching suppliers
    const match = inventoryItems.find((inv) => inv.supplierIdx === i);
    if (match) {
      for (const item of match.items) {
        await prisma.supplierInventory.create({
          data: {
            supplierId: supplier.id,
            ingredientName: item.name,
            category: item.category,
            unit: item.unit,
            pricePerUnit: item.price,
            quantityAvailable: item.qty,
            isOrganic: item.organic,
          },
        });
      }
    }
  }
  console.log(`Created ${supplierData.length} suppliers with inventory`);

  // --- Add Zone Memberships ---
  const allUsers = await prisma.user.findMany();
  for (const user of allUsers) {
    await prisma.zoneMembership.upsert({
      where: {
        userId_zoneId: { userId: user.id, zoneId: zone.id },
      },
      update: {},
      create: {
        userId: user.id,
        zoneId: zone.id,
      },
    });
  }
  console.log(`All ${allUsers.length} users added to zone`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
