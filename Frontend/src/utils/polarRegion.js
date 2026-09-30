export function getPolarRegion(region = "") {
  const value = String(region).trim().toLowerCase();

  if (value.includes("antarctic") || value.includes("south")) {
    return "south";
  }

  if (value.includes("arctic") || value.includes("north")) {
    return "north";
  }

  return "south";
}

export function getPolarRegionLabel(region = "") {
  return getPolarRegion(region) === "north"
    ? "ARCTIC / NORTH"
    : "ANTARCTIC / SOUTH";
}
