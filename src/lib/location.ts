export function coarsenCoordinates(
  longitude: number,
  latitude: number,
): [number, number] {
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  )
    throw Error("Invalid location");
  return [Math.round(longitude * 100) / 100, Math.round(latitude * 100) / 100];
}
