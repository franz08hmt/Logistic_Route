type Coordinates = {
  latitude: number;
  longitude: number;
};

const POSITION_EPSILON = 0.000001;

export function shouldRecenterMap(
  current: Coordinates,
  target: Coordinates,
): boolean {
  return (
    Math.abs(current.latitude - target.latitude) > POSITION_EPSILON
    || Math.abs(current.longitude - target.longitude) > POSITION_EPSILON
  );
}
