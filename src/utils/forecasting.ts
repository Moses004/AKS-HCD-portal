/**
 * Linear Regression Forecasting Utilities for HCD Analytics
 * Implements Ordinary Least Squares (OLS) regression to estimate future participant growth
 */

export interface DataPoint {
  x: number; // Time index (0, 1, 2, ...)
  y: number; // Metric value (e.g. participant count)
  label: string; // Time label (e.g. 'May 2025')
}

export interface RegressionResult {
  slope: number; // m in y = mx + b
  intercept: number; // b in y = mx + b
  rSquared: number; // Coefficient of determination (0 to 1)
  standardError: number; // Standard error of the estimate (Se)
  meanX: number;
  meanY: number;
  sumSquaresX: number; // Sum of (x - meanX)^2
  predict: (x: number) => number;
  confidenceInterval: (x: number, confidenceLevel?: number) => { lower: number; upper: number };
}

export interface ForecastPoint {
  index: number;
  label: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  isForecast: true;
}

/**
 * Calculates Ordinary Least Squares (OLS) linear regression for a set of data points
 */
export function calculateLinearRegression(points: DataPoint[]): RegressionResult {
  const n = points.length;
  if (n < 2) {
    const defaultVal = points[0]?.y ?? 0;
    return {
      slope: 0,
      intercept: defaultVal,
      rSquared: 0,
      standardError: 0,
      meanX: 0,
      meanY: defaultVal,
      sumSquaresX: 1,
      predict: () => defaultVal,
      confidenceInterval: () => ({ lower: defaultVal, upper: defaultVal }),
    };
  }

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let sumSquaresX = 0;
  let totalSS = 0;

  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    numerator += dx * dy;
    sumSquaresX += dx * dx;
    totalSS += dy * dy;
  }

  const slope = sumSquaresX === 0 ? 0 : numerator / sumSquaresX;
  const intercept = meanY - slope * meanX;

  // Residual sum of squares
  let residualSS = 0;
  for (const p of points) {
    const pred = slope * p.x + intercept;
    const residual = p.y - pred;
    residualSS += residual * residual;
  }

  // R-squared
  const rSquared = totalSS === 0 ? 1 : Math.max(0, Math.min(1, 1 - residualSS / totalSS));

  // Standard error of regression
  const degreesOfFreedom = Math.max(1, n - 2);
  const standardError = Math.sqrt(residualSS / degreesOfFreedom);

  const predict = (x: number): number => {
    return Math.max(0, Math.round(slope * x + intercept));
  };

  // Prediction interval (95% default t ≈ 1.96 / 2.0)
  const confidenceInterval = (x: number, tValue: number = 1.96) => {
    const distanceTerm = sumSquaresX === 0 ? 0 : Math.pow(x - meanX, 2) / sumSquaresX;
    const marginOfError = tValue * standardError * Math.sqrt(1 + 1 / n + distanceTerm);
    const center = slope * x + intercept;
    return {
      lower: Math.max(0, Math.round(center - marginOfError)),
      upper: Math.max(0, Math.round(center + marginOfError)),
    };
  };

  return {
    slope,
    intercept,
    rSquared,
    standardError,
    meanX,
    meanY,
    sumSquaresX,
    predict,
    confidenceInterval,
  };
}

/**
 * Projects next quarter (3 future months) based on historical dataset
 */
export function generateNextQuarterForecast(
  historicalPoints: DataPoint[],
  quarterMonthLabels: string[] = ['May 2026', 'Jun 2026', 'Jul 2026']
): {
  regression: RegressionResult;
  forecastPoints: ForecastPoint[];
  nextQuarterTotal: number;
  monthlyAverageGrowthRate: number;
} {
  const regression = calculateLinearRegression(historicalPoints);
  const n = historicalPoints.length;

  const forecastPoints: ForecastPoint[] = quarterMonthLabels.map((label, idx) => {
    const futureX = n + idx;
    const predicted = regression.predict(futureX);
    const ci = regression.confidenceInterval(futureX);
    return {
      index: futureX,
      label,
      predicted,
      lowerBound: ci.lower,
      upperBound: ci.upper,
      isForecast: true,
    };
  });

  const nextQuarterTotal = forecastPoints.reduce((acc, p) => acc + p.predicted, 0);
  const monthlyAverageGrowthRate = regression.slope;

  return {
    regression,
    forecastPoints,
    nextQuarterTotal,
    monthlyAverageGrowthRate,
  };
}
