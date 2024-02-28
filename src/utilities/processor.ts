// @ts-ignore
import Spline from "spline-interpolator";

const SIMPLIFICATION_ERROR_MARGIN = 0.5;
const MAX_SPLINE_POINT_DISTANCE = 2;
const MAX_SPLINE_TOTAL_DISTANCE = 20;
const MIN_SPLINE_POINTS = 3;
const MAX_SPLINE_POINTS = 12;
const MAX_LINES = 50000;
const VERTICAL_OFFSET = 700;

interface Coordinates {
  originalIndex: number;
  newIndex: number;
  X?: number;
  Y?: number;
  Z?: number;
}

const coordinateRegex = /([XYZ])\s*([-\d.]+)/g;
const baseCoordinate = "C00000=455.277,520.116,-433.365,-180.00,0.00,0.00";
const baseMovement = "MOVJ C00000 VJ=50.00 PL=0";

export const getG1G0 = (gcodeLines: string[]): string[] => {
  let result: string[] = [];

  for (let i = 0; i < gcodeLines.length; i++) {
    const line = gcodeLines[i];
    if (line.startsWith("G1") || line.startsWith("G0")) {
      result.push(line);
    }
  }

  return result;
};

const calculateDistanceBetweenPoints = (
  point1: Coordinates,
  point2: Coordinates
): number => {
  const x = point2.X! - point1.X!;
  const y = point2.Y! - point1.Y!;

  return Math.sqrt(x * x + y * y);
};

const calculateDistanceBetweenMultiplePoints = (
  points: Coordinates[]
): number => {
  let distance = 0;

  for (let i = 1; i < points.length; i++) {
    distance += calculateDistanceBetweenPoints(points[i - 1], points[i]);
  }

  return distance;
};

const formatCoordinates = (coordinates: Coordinates[]): string[] => {
  return [
    baseCoordinate,
    ...coordinates.map((coord) => {
      const RX = -180.0;
      const RY = -0.0;
      const RZ = 0.0;

      const X = coord.X?.toFixed(3) ?? "0.000";
      const Y = coord.Y?.toFixed(3) ?? "0.000";
      const Z = ((coord.Z || 0) - VERTICAL_OFFSET)?.toFixed(3) ?? "0.000";

      return `C${(1 + coord.newIndex)
        .toString()
        .padStart(5, "0")}=${X},${Y},${Z},${RX.toFixed(2)},${RY.toFixed(
        2
      )},${RZ.toFixed(2)}`;
    }),
  ];
};

const formatLinearMovement = (
  coordinate: Coordinates,
  options: { speed: number }
): string => {
  const speed = options.speed;

  return `MOVL C${(1 + coordinate.newIndex)
    .toString()
    .padStart(5, "0")} V=${speed.toFixed(1)} PL=0`;
};

const formatSplineMovement = (
  coordinate: Coordinates,
  options: { speed: number }
): string => {
  const speed = options.speed;

  return `MOVS C${(1 + coordinate.newIndex)
    .toString()
    .padStart(5, "0")} V=${speed.toFixed(1)} PL=0`;
};

const evaluateSplinePossibility = (coordinates: Coordinates[]): boolean => {
  if (!coordinates.every((c) => c.X !== undefined && c.Y !== undefined)) {
    return false;
  }

  const middleIndex = Math.floor(coordinates.length / 2);
  const simplifiedCoordinates = [
    coordinates[0],
    coordinates[middleIndex],
    coordinates[coordinates.length - 1],
  ];

  const distance = calculateDistanceBetweenPoints(
    coordinates[coordinates.length - 2],
    coordinates[coordinates.length - 1]
  );

  const distancePointByPoint = coordinates.map((c, index) => {
    if (index === 0) {
      return 0;
    }

    return calculateDistanceBetweenPoints(coordinates[index - 1], c);
  });

  if (distancePointByPoint.some((d) => d > MAX_SPLINE_POINT_DISTANCE)) {
    return false;
  }

  const totalDistance = calculateDistanceBetweenMultiplePoints(coordinates);

  if (totalDistance > MAX_SPLINE_TOTAL_DISTANCE) {
    return false;
  }

  if (distance > MAX_SPLINE_POINT_DISTANCE || Number.isNaN(distance)) {
    return false;
  }

  const x = coordinates.map((c) => c.X!);
  const y = coordinates.map((c) => c.Y!);

  const simplifiedX = simplifiedCoordinates.map((c) => c.X!);
  const simplifiedY = simplifiedCoordinates.map((c) => c.Y!);

  const simplifiedSpline = new Spline(simplifiedX, simplifiedY);

  for (let i = 0; i < x.length; i++) {
    const xValue = x[i];
    const yValue = y[i];

    const simplifiedSplineY = simplifiedSpline.interpolate(xValue);

    if (Math.abs(simplifiedSplineY - yValue) > SIMPLIFICATION_ERROR_MARGIN) {
      return false;
    }
  }

  return true;
};

export const processGCode = (
  gcodeLines: string[],
  header: string,
  footer: string,
  preferences: {
    useCircleOptimization: boolean;
    useNearPointsOptimization: boolean;
    speed: number;
  }
): string[] => {
  const { useCircleOptimization, useNearPointsOptimization, speed } =
    preferences;

  const g1g0 = getG1G0(gcodeLines.splice(0, MAX_LINES));

  let movementCoordinates: Coordinates[] = g1g0.map((line, index) => {
    const coordinates: Coordinates = {
      originalIndex: index,
      newIndex: index,
    };
    let match;

    while ((match = coordinateRegex.exec(line)) !== null) {
      const [_, axis, value] = match;
      coordinates[axis as keyof Coordinates] = parseFloat(value);
    }

    return coordinates;
  });

  let splines: [number, number, number][] = [];

  if (useCircleOptimization) {
    for (
      let i = 0;
      i < movementCoordinates.length && i < 2000;
      () => undefined
    ) {
      let splineLength = 0;

      for (let j = MIN_SPLINE_POINTS - 1; j <= MAX_SPLINE_POINTS; j = j + 1) {
        const next = movementCoordinates[i + j];

        if (next === undefined) {
          break;
        }

        const subSet = JSON.parse(JSON.stringify(movementCoordinates)).slice(
          i,
          i + j + 1
        );

        if (!evaluateSplinePossibility(subSet)) {
          break;
        }

        splineLength = j;
      }

      if (splineLength > 1) {
        i += splineLength;

        const middlePoint = Math.floor((i + i + splineLength) / 2);

        splines.push([i, middlePoint, i + splineLength]);
      } else {
        i++;
      }
    }
  }

  const coordinatesContainedInSpline = movementCoordinates.filter(
    (_, index) => {
      return splines.some((s) => index >= s[0] && index <= s[2]);
    }
  );

  const coordinatesContainedInSplineToKill = movementCoordinates.filter(
    (_, index) => {
      return splines.some(
        (s) =>
          index >= s[0] &&
          index <= s[2] &&
          index !== s[0] &&
          index !== s[2] &&
          index !== s[1]
      );
    }
  );

  movementCoordinates = movementCoordinates.filter(
    (coord) => !coordinatesContainedInSplineToKill.includes(coord)
  );

  movementCoordinates = movementCoordinates.map((coord, index) => {
    return {
      ...coord,
      newIndex: index,
    };
  });

  for (let i = 0; i < movementCoordinates.length; i++) {
    const current = movementCoordinates[i];
    const previous = movementCoordinates[i - 1];

    if (current.X === undefined) {
      current.X = previous?.X;
    }

    if (current.Y === undefined) {
      current.Y = previous?.Y;
    }

    if (current.Z === undefined) {
      current.Z = previous?.Z;
    }
  }

  const coordinateSet = formatCoordinates(movementCoordinates);
  let movementSet: string[] = [];

  for (const movementCoordinate of movementCoordinates) {
    if (
      coordinatesContainedInSpline.find(
        (item) => item.originalIndex === movementCoordinate.originalIndex
      )
    ) {
      movementSet.push(
        formatSplineMovement(movementCoordinate, { speed: speed })
      );
    } else {
      movementSet.push(
        formatLinearMovement(movementCoordinate, { speed: speed })
      );
    }
  }

  const headerLines = header.split("\n");
  const footerLines = footer.split("\n");

  let result: string[] = [
    ...headerLines,
    ...coordinateSet,
    "NOP",
    baseMovement,
    ...movementSet,
    ...footerLines,
  ];

  return result;
};
