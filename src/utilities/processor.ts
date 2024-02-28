interface Coordinates {
  X?: number;
  Y?: number;
  Z?: number;
}

const coordinateRegex = /([XYZ])\s*([-\d.]+)/g;
const baseCoordinate = "C00000=0,15,42,180,57,90";
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

const formatCoordinates = (coordinates: Coordinates[]): string[] => {
  return [
    baseCoordinate,
    ...coordinates.map((coord, index) => {
      const RX = -180.0;
      const RY = -0.0;
      const RZ = 0.0;

      const X = coord.X?.toFixed(3) ?? "0.000";
      const Y = coord.Y?.toFixed(3) ?? "0.000";
      const Z = coord.Z?.toFixed(3) ?? "0.000";

      return `C${(1 + index)
        .toString()
        .padStart(5, "0")}=${X},${Y},${Z},${RX.toFixed(3)},${RY.toFixed(
        3
      )},${RZ.toFixed(3)}`;
    }),
  ];
};

const formatMovements = (
  coordinates: Coordinates[],
  options: { speed: number }
): string[] => {
  return [
    baseMovement,
    ...coordinates.map((_, index) => {
      const speed = options.speed;
      return `MOVL C${(1 + index)
        .toString()
        .padStart(5, "0")} V=${speed.toFixed(1)} PL=0`;
    }),
  ];
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

  const g1g0 = getG1G0(gcodeLines);

  let movementCoordinates: Coordinates[] = g1g0.map((line) => {
    const coordinates: Coordinates = {};
    let match;

    while ((match = coordinateRegex.exec(line)) !== null) {
      const [_, axis, value] = match;
      coordinates[axis as keyof Coordinates] = parseFloat(value);
    }

    return coordinates;
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
  const movementSet = formatMovements(movementCoordinates, { speed });

  const headerLines = header.split("\n");
  const footerLines = footer.split("\n");

  const result: string[] = [...headerLines, ...coordinateSet, "NOP", ...movementSet, ...footerLines];

  return result;
};
