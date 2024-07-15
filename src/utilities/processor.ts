// @ts-ignore
import Spline from "spline-interpolator";

// Definição das preferências de processamento constantes para o algoritmo

const SIMPLIFICATION_ERROR_MARGIN = 3; // Margem de erro para simplificação de spline
const MAX_SPLINE_POINT_DISTANCE = 50; // Distância máxima entre pontos de spline
const MAX_SPLINE_TOTAL_DISTANCE = 150; // Distância total máxima de spline
const MIN_SPLINE_POINTS = 4; // Número mínimo de pontos para spline
const MAX_SPLINE_POINTS = 50; // Número máximo de pontos para spline
const MAX_LINES = 50000; // Número máximo de linhas de GCode

interface Coordinates {
  originalIndex: number;
  newIndex: number;
  X?: number;
  Y?: number;
  Z?: number;
}

// Expressão regular para captura de coordenadas de movimento
const coordinateRegex = /([XYZ])\s*([-\d.]+)/g;

// Movimento base para inicialização do programa (consome a coordenada inicial)
const baseMovement = "MOVJ C00000 VJ=50.00 PL=0";

// Função para captura de movimentos G1 e G0 de um conjunto de linhas de GCode
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

// Função para cálculo da distância entre dois pontos
const calculateDistanceBetweenPoints = (
  point1: Coordinates,
  point2: Coordinates
): number => {
  const x = point2.X! - point1.X!;
  const y = point2.Y! - point1.Y!;

  return Math.sqrt(x * x + y * y);
};

// Função para cálculo da distância entre dois pontos através de uma curva definida por uma spline
const calculateDistanceBetweenPointsUsingSpline = (
  point1: Coordinates,
  point2: Coordinates,
  point3: Coordinates
) => {
  const spline = new Spline(
    [point1.X!, point2.X!, point3.X!],
    [point1.Y!, point2.Y!, point3.Y!]
  );

  const subdivision = 30;
  const startXStart = point1.X!;
  const startXData = [];
  const startYData = [];
  const startXDelta = point1.X! - point2.X!;

  const endXStart = point2.X!;
  const endXData = [];
  const endYData = [];
  const endXDelta = point2.X! - point3.X!;

  for (let i = 0; i < subdivision; i++) {
    const currX = startXStart + (startXDelta / subdivision) * i;
    const currY = spline.interpolate(currX);

    startXData.push(currX);
    startYData.push(currY);
  }

  for (let i = 0; i < subdivision; i++) {
    const currX = endXStart + (endXDelta / subdivision) * i;
    const currY = spline.interpolate(currX);

    endXData.push(currX);
    endYData.push(currY);
  }

  let distanceStart = 0;
  let distanceEnd = 0;

  for (let i = 1; i < subdivision; i++) {
    const x = startXData[i] - startXData[i - 1];
    const y = startYData[i] - startYData[i - 1];

    distanceStart += Math.sqrt(x * x + y * y);
  }

  for (let i = 1; i < subdivision; i++) {
    const x = endXData[i] - endXData[i - 1];
    const y = endYData[i] - endYData[i - 1];

    distanceEnd += Math.sqrt(x * x + y * y);
  }

  return {
    distanceStart: Number(distanceStart.toFixed(1)),
    distanceEnd: Number(distanceEnd.toFixed(1)),
  };
};

// Função para cálculo do ponto médio de uma spline
const calculateMidArcPoint = (
  point1: Coordinates,
  point2: Coordinates,
  point3: Coordinates
): {
  X?: number;
  Y?: number;
  Z?: number;
} => {
  const spline = new Spline(
    [point1.X!, point2.X!, point3.X!],
    [point1.Y!, point2.Y!, point3.Y!]
  );

  const subdivision = 150;
  const startXStart = point1.X!;
  const startXData = [];
  const startYData = [];
  const startXDelta = point1.X! - point3.X!;

  for (let i = 0; i < subdivision; i++) {
    const currX = startXStart - (startXDelta / subdivision) * i;
    const currY = spline.interpolate(currX);

    startXData.push(currX);
    startYData.push(currY);
  }

  let distanceDelta = Infinity;
  let minimumDistanceIndex: number | null = null;

  for (let i = 0; i < subdivision; i++) {
    const x = startXData[i];
    const y = startYData[i];

    /*const { distanceStart, distanceEnd } =
      calculateDistanceBetweenPointsUsingSpline(
        point1,
        { X: x, Y: y, Z: point1.Z, originalIndex: 0, newIndex: 0 },
        point3
      );*/

    const distanceStart = calculateDistanceBetweenPoints(point1, {
      X: x,
      Y: y,
      Z: point1.Z,
      newIndex: 0,
      originalIndex: 0,
    });
    const distanceEnd = calculateDistanceBetweenPoints(
      { X: x, Y: y, Z: point1.Z, newIndex: 0, originalIndex: 0 },
      point3
    );

    const delta = Math.abs(distanceStart - distanceEnd);

    if (delta < distanceDelta) {
      distanceDelta = delta;
      minimumDistanceIndex = i;
    }
  }

  if (minimumDistanceIndex === null) {
    return point2;
  }

  return {
    X: startXData[minimumDistanceIndex],
    Y: startYData[minimumDistanceIndex],
    Z: point1.Z,
  };
};

// Função para cálculo da distância total entre múltiplos pontos
const calculateDistanceBetweenMultiplePoints = (
  points: Coordinates[]
): number => {
  let distance = 0;

  for (let i = 1; i < points.length; i++) {
    distance += calculateDistanceBetweenPoints(points[i - 1], points[i]);
  }

  return distance;
};

// Função para formatação de coordenadas para o formato de arquivo de movimento
// Ex.: C00000=X,Y,Z,-180.00,0.00,0.00
// Aqui os ângulos de rotação são fixos em -180.00, 0.00 e 0.00

const formatCoordinates = (
  coordinates: Coordinates[],
  initialCoordinates: { x: number; y: number; z: number },
  offsetCoordinates: { x: number; y: number; z: number }
): string[] => {
  return [
    `C00000=${initialCoordinates.x.toFixed(3)},${initialCoordinates.y.toFixed(
      3
    )},${initialCoordinates.z.toFixed(3)},-180.00,0.00,0.00`,
    ...coordinates.map((coord) => {
      const RX = -180.0;
      const RY = -0.0;
      const RZ = 0.0;

      const X = ((coord.X || 0) + offsetCoordinates.x)?.toFixed(3) ?? "0.000";
      const Y = ((coord.Y || 0) + offsetCoordinates.y)?.toFixed(3) ?? "0.000";
      const Z = ((coord.Z || 0) + offsetCoordinates.z)?.toFixed(3) ?? "0.000";

      return `C${(1 + coord.newIndex)
        .toString()
        .padStart(5, "0")}=${X},${Y},${Z},${RX.toFixed(2)},${RY.toFixed(
        2
      )},${RZ.toFixed(2)}`;
    }),
  ];
};

// Função para formatação de movimento linear entre coordenadas de movimento
// Ex.: MOVL C00001 V=50.0 PL=0
// Aqui a velocidade de movimento é baseada nas preferências do usuário

const formatLinearMovement = (
  coordinate: Coordinates,
  options: { speed: number }
): string => {
  const speed = options.speed;

  return `MOVL C${(1 + coordinate.newIndex)
    .toString()
    .padStart(5, "0")} V=${speed.toFixed(1)} PL=0`;
};

// Função para formatação de movimento de spline entre coordenadas de movimento
// Ex.: MOVS C00001 V=50.0 PL=0
// Ex.: MOVS C00002 V=50.0 PL=0
// Aqui a velocidade de movimento é baseada nas preferências do usuário
// O movimento de spline é utilizado para simplificação de movimentos lineares em curvas suaves

const formatSplineMovement = (
  coordinate: Coordinates,
  options: { speed: number }
): string => {
  const speed = options.speed;

  return `MOVS C${(1 + coordinate.newIndex)
    .toString()
    .padStart(5, "0")} V=${speed.toFixed(1)} PL=0`;
};

// Função para avaliação da possibilidade de simplificação de spline entre coordenadas de movimento

const evaluateSplinePossibility = (index: number, coordinates: Coordinates[]): boolean => {
  // Verifica se todas as coordenadas possuem valores de X e Y
  if (!coordinates.every((c) => c.X !== undefined && c.Y !== undefined)) {
    return false;
  }

  // Se o valor de Z for diferente entre as coordenadas, a simplificação não é possível
  if (coordinates.some((c) => Math.abs((coordinates[0]?.Z || 0) - (c?.Z || 0)) > 0.5)) {
    return false;
  }

  // Obtém o índice do ponto médio das coordenadas
  const middleIndex = Math.floor(coordinates.length / 2);

  // Simplifica as coordenadas utilizando os pontos inicial, médio e final
  // A spline é calculada a partir destes pontos, uma vez que a definição mínima
  // de uma spline é através de três pontos no GP88
  const simplifiedCoordinates = [
    coordinates[0],
    coordinates[middleIndex],
    coordinates[coordinates.length - 1],
  ];

  // Calcula a distância entre os pontos inicial e final
  const distance = calculateDistanceBetweenPoints(
    coordinates[coordinates.length - 2],
    coordinates[coordinates.length - 1]
  );

  // Calcula a distância entre os pontos de spline
  const distancePointByPoint = coordinates.map((c, index) => {
    if (index === 0) {
      return 0;
    }

    return calculateDistanceBetweenPoints(coordinates[index - 1], c);
  });

  // Verifica se a distância entre os pontos de spline é menor que o limite
  if (distancePointByPoint.some((d) => d > MAX_SPLINE_POINT_DISTANCE)) {
    return false;
  }

  const totalDistance = calculateDistanceBetweenMultiplePoints(coordinates);

  // Verifica se a distância total entre os pontos de spline é menor que o limite
  if (totalDistance > MAX_SPLINE_TOTAL_DISTANCE) {
    return false;
  }

  // Verifica se a distância entre os pontos de spline é menor que o limite
  if (distance > MAX_SPLINE_POINT_DISTANCE || Number.isNaN(distance)) {
    return false;
  }

  // Isola os valores de X e Y das coordenadas em arrays separados
  // Contempla todas as coordenadas dos parâmetros
  const x = coordinates.map((c) => c.X!);
  const y = coordinates.map((c) => c.Y!);

  const x_ = coordinates.map((c) => c.Y!);
  const y_ = coordinates.map((c) => c.X!);

  // Isola os valores de X e Y das coordenadas simplificadas em arrays separados
  // Contempla todas as coordenadas dos parâmetros
  const simplifiedX = simplifiedCoordinates.map((c) => c.X!);
  const simplifiedY = simplifiedCoordinates.map((c) => c.Y!);

  const simplifiedX_ = simplifiedCoordinates.map((c) => c.Y!);
  const simplifiedY_ = simplifiedCoordinates.map((c) => c.X!);

  // Cria uma nova spline a partir dos valores simplificados, utilizando a biblioteca spline-interpolator
  const simplifiedSpline = new Spline(simplifiedX, simplifiedY);
  const simplifiedSpline_ = new Spline(simplifiedX_, simplifiedY_);

  let errorFailedOnStandard = false;
  let errorFailedOnInverted = false;

  // Itera sobre todos os valores de X e Y das coordenadas
  for (let i = 0; i < x.length; i++) {
    const xValue = x[i];
    const yValue = y[i];

    // Calcula o valor de Y da spline simplificada para o valor de X atual
    const simplifiedSplineY = simplifiedSpline.interpolate(xValue);

    // Verifica se o valor de Y da spline simplificada é diferente do valor de Y atual
    // Se a diferença for maior que a margem de erro, a simplificação não é possível
    // A margem de erro é definida pelas preferências do usuário
    if (Math.abs(simplifiedSplineY - yValue) > SIMPLIFICATION_ERROR_MARGIN) {
      errorFailedOnStandard = true;
    }
  }


  for (let i = 0; i < x_.length; i++) {
    const xValue = x_[i];
    const yValue = y_[i];

    // Calcula o valor de Y da spline simplificada para o valor de X atual
    const simplifiedSplineY = simplifiedSpline_.interpolate(xValue);

    // Verifica se o valor de Y da spline simplificada é diferente do valor de Y atual
    // Se a diferença for maior que a margem de erro, a simplificação não é possível
    // A margem de erro é definida pelas preferências do usuário
    if (Math.abs(simplifiedSplineY - yValue) > SIMPLIFICATION_ERROR_MARGIN) {
      errorFailedOnInverted = true;
    }
  }
  // Se todas as verificações passarem, a simplificação é possível

  if (errorFailedOnStandard && errorFailedOnInverted) {
    return false;
  }
  
  return true;
};

// Função para processamento de GCode
export const processGCode = (
  gcodeLines: string[],
  header: string,
  footer: string,
  preferences: {
    useCircleOptimization: boolean;
    initialCoordinates: { x: number; y: number; z: number };
    offsetCoordinates: { x: number; y: number; z: number };
    speed: number;
  }
): string[] => {
  // Desestruturação das preferências de processamento
  const {
    useCircleOptimization,
    initialCoordinates,
    offsetCoordinates,
    speed,
  } = preferences;

  // Criação de um conjunto de coordenadas de movimento a partir das linhas de GCode
  const g1g0 = getG1G0(gcodeLines.splice(0, MAX_LINES));

  // Criação de um conjunto de coordenadas de movimento a partir das linhas de GCode
  let movementCoordinates: Coordinates[] = g1g0.map((line, index) => {
    const coordinates: Coordinates = {
      originalIndex: index,
      newIndex: index,
    };
    let match;

    // Itera sobre todas as coordenadas de movimento da linha de GCode
    // Utiliza uma expressão regular para captura de coordenadas
    while ((match = coordinateRegex.exec(line)) !== null) {
      const [_, axis, value] = match;
      coordinates[axis as keyof Coordinates] = parseFloat(value);
    }

    // Retorna as coordenadas de movimento (objeto com chaves X, Y e Z)
    return coordinates;
  });

  // Como o GCode pode não conter algumas coordenadas, preenche as lacunas
  // com os valores das coordenadas anteriores e posteriores
  for (let i = 0; i < movementCoordinates.length; i++) {
    const current = movementCoordinates[i];

    if (current.X === undefined) {
      for (let j = i; j >= 0; j--) {
        const previous = movementCoordinates[j];

        if (previous.X !== undefined) {
          current.X = previous.X;
          break;
        }
      }
      for (let j = i; j < movementCoordinates.length; j++) {
        const next = movementCoordinates[j];

        if (next.X !== undefined) {
          current.X = next.X;
          break;
        }
      }
    }

    if (current.Y === undefined) {
      for (let j = i; j >= 0; j--) {
        const previous = movementCoordinates[j];

        if (previous.Y !== undefined) {
          current.Y = previous.Y;
          break;
        }
      }
      for (let j = i; j < movementCoordinates.length; j++) {
        const next = movementCoordinates[j];

        if (next.Y !== undefined) {
          current.Y = next.Y;
          break;
        }
      }
    }

    if (current.Z === undefined) {
      for (let j = i; j >= 0; j--) {
        const previous = movementCoordinates[j];

        if (previous.Z !== undefined) {
          current.Z = previous.Z;
          break;
        }
      }
      for (let j = i; j < movementCoordinates.length; j++) {
        const next = movementCoordinates[j];

        if (next.Z !== undefined) {
          current.Z = next.Z;
          break;
        }
      }
    }
  }

  // Remove quaisquer coordenadas que podem ter ficado com algum nulo
  movementCoordinates = movementCoordinates.filter(
    (coord) =>
      coord.X !== undefined &&
      coord.Y !== undefined &&
      coord.Z !== undefined &&
      coord.X !== 0 &&
      coord.Y !== 0 &&
      coord.Z !== 0 &&
      !Number.isNaN(coord.X) &&
      !Number.isNaN(coord.Y) &&
      !Number.isNaN(coord.Z)
  );

  // Inicializa um conjunto de splines vazio
  let splines: [number, number, number][] = [];

  // Verifica se a otimização de círculos está habilitada
  if (useCircleOptimization) {
    // Itera sobre todas as coordenadas de movimento
    for (
      let i = 0;
      i < movementCoordinates.length && i < MAX_LINES;
      () => undefined
    ) {
      let splineLength = 0;

      // Itera sobre todas as possíveis combinações de pontos de spline
      // Verifica se a simplificação de spline é possível
      // A simplificação de spline é utilizada para reduzir a quantidade de movimentos lineares
      // em curvas suaves
      for (let j = MIN_SPLINE_POINTS - 1; j <= MAX_SPLINE_POINTS; j = j + 1) {
        // Obtém o próximo ponto do conjunto de coordenadas de movimento, vamos de i até i + j
        const next = movementCoordinates[i + j];

        // Verifica se o próximo ponto é indefinido
        if (next === undefined) {
          break;
        }

        // Cria um subconjunto de coordenadas de movimento a partir do conjunto principal
        const subSet = JSON.parse(JSON.stringify(movementCoordinates)).slice(
          i,
          i + j + 1
        );

        // Verifica se a simplificação de spline é possível
        if (!evaluateSplinePossibility(i, subSet)) {
          break;
        }

        // Se a simplificação de spline for possível, atualiza o comprimento da spline,
        // continua até encontrar o maior comprimento possível de spline (em número de pontos)
        splineLength = j;
      }

      // Se o comprimento da spline for maior que 1, adiciona a spline ao conjunto de splines
      if (splineLength > 1) {
        const middlePoint = Math.floor((i + i + splineLength) / 2);

        splines.push([i, middlePoint, i + splineLength]);

        i += splineLength + 2;
      } else {
        // Se a simplificação de spline não for possível, continua para o próximo ponto
        i++;
      }
    }
  }

  // Filtra as coordenadas de movimento contidas nas splines
  const coordinatesContainedInSpline = movementCoordinates.filter(
    (_, index) => {
      return splines.some((s) => index >= s[0] && index <= s[2]);
    }
  );

  // Filtra as coordenadas de movimento contidas nas splines para remoção
  // Mantém apenas os pontos inicial, final e médio das splines
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

  // Erro 4411 YRC1000 - Pontos médios das splines devem ser equidistante dos pontos inicial e final
  movementCoordinates = movementCoordinates.map((coord, index) => {
    const splineMiddlePoint = splines.find((s) => index === s[1]);
    const splineMiddlePointIndex = splines.findIndex((s) => index === s[1]);

    if (splineMiddlePoint) {
      const splineStartPoint = movementCoordinates[splineMiddlePoint[0]];
      const splineEndPoint = movementCoordinates[splineMiddlePoint[2]];

      const midArcPoint = calculateMidArcPoint(
        splineStartPoint,
        coord,
        splineEndPoint
      );

      const distances = calculateDistanceBetweenPointsUsingSpline(
        splineStartPoint,
        { ...midArcPoint, originalIndex: 0, newIndex: 0 },
        splineEndPoint
      );

      return {
        ...midArcPoint,
        originalIndex: coord.originalIndex,
        newIndex: coord.newIndex,
      };
    } else {
      return coord;
    }
  });

  // Remove as coordenadas de movimento contidas nas splines para remoção
  movementCoordinates = movementCoordinates.filter(
    (coord) => !coordinatesContainedInSplineToKill.includes(coord)
  );

  // Atualiza os índices das coordenadas de movimento após a remoção
  movementCoordinates = movementCoordinates.map((coord, index) => {
    return {
      ...coord,
      newIndex: index,
    };
  });

  // Formata as coordenadas de movimento para o formato de arquivo de movimento
  // Formata os movimentos lineares e de spline
  const coordinateSet = formatCoordinates(
    movementCoordinates,
    initialCoordinates,
    offsetCoordinates
  );
  let movementSet: string[] = [];

  for (const movementCoordinate of movementCoordinates) {
    // Verifica se a coordenada de movimento está contida nas splines
    if (
      coordinatesContainedInSpline.find(
        (item) => item.originalIndex === movementCoordinate.originalIndex
      )
    ) {
      // Se estiver contida, adiciona um movimento de spline
      movementSet.push(
        formatSplineMovement(movementCoordinate, { speed: speed })
      );
    } else {
      // Se não estiver contida, adiciona um movimento linear
      movementSet.push(
        formatLinearMovement(movementCoordinate, { speed: speed })
      );
    }
  }

  // Formata o cabeçalho e o rodapé do arquivo de movimento
  const headerLines = header.split("\n");
  const footerLines = footer.split("\n");

  // Concatena todas as partes do arquivo de movimento
  let result: string[] = [
    ...headerLines,
    ...coordinateSet,
    "NOP",
    baseMovement,
    ...movementSet,
    ...footerLines,
  ];

  // Retorna uma lista de strings contendo o arquivo de movimento
  return result;
};
