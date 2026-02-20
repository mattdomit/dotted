import { describe, it, expect } from "vitest";
import { haversineDistance } from "../../../lib/geo";

describe("Geo lib", () => {
  describe("haversineDistance", () => {
    it("should return 0 for identical points", () => {
      const d = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(d).toBe(0);
    });

    it("should calculate correct distance between NYC and LA (~3944 km)", () => {
      // NYC: 40.7128, -74.0060
      // LA:  34.0522, -118.2437
      const d = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(d).toBeGreaterThan(3900);
      expect(d).toBeLessThan(4000);
    });

    it("should calculate short distances accurately", () => {
      // Two points ~1km apart in Manhattan
      const d = haversineDistance(40.7128, -74.006, 40.7218, -74.006);
      expect(d).toBeGreaterThan(0.9);
      expect(d).toBeLessThan(1.1);
    });

    it("should be symmetric", () => {
      const d1 = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      const d2 = haversineDistance(34.0522, -118.2437, 40.7128, -74.006);
      expect(d1).toBeCloseTo(d2, 5);
    });
  });
});
