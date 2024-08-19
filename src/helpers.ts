export function scale(arr: number[]) {
  if (arr.length === 0) {
    return [];
  }

  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const diff = max - min;

  if (diff === 0) {
    // If diff is 0, all elements in the array are the same.
    // To avoid division by zero, return an array of the same length with 0 values.
    return arr.map(() => 0);
  }

  return arr.map((value) => (value - min) / diff);
}

export function sample(arr: number[], newSize: number) {
  const originalSize = arr.length;

  if (newSize === 0) {
    return [];
  }

  const result: number[] = [];

  for (let i = 0; i < newSize; i++) {
    const index = Math.floor((i / newSize) * originalSize);
    result.push(arr[index] ?? 0);
  }

  return result;
}

export function robustScale(arr: number[], q1 = 0.05, q3 = 0.75) {
  if (arr.length === 0) {
    return [];
  }

  const sortedArr = [...arr].sort((a, b) => a - b);

  const q1Index = Math.floor((sortedArr.length - 1) * q1);
  const q3Index = Math.floor((sortedArr.length - 1) * q3);

  const q1_ = sortedArr[q1Index];
  const q3_ = sortedArr[q3Index];

  if (q1_ === undefined || q3_ === undefined || q1_ === q3_) {
    return arr.map(() => 0);
  }

  const iqr = q3_ - q1_; // Interquartile Range

  return arr.map((value) => {
    const scaledValue = (value - q1_) / iqr;

    if (scaledValue < 0) return 0;
    if (scaledValue > 1) return 1;
    return scaledValue;
  });
}

export function trimmedScale(
  arr: number[],
  lowerPercentile = 0.03,
  upperPercentile = 0.95
) {
  if (arr.length === 0) {
    return [];
  }

  const sortedArr = [...arr].sort((a, b) => a - b);

  const lowerIndex = Math.floor((sortedArr.length - 1) * lowerPercentile);
  const upperIndex = Math.ceil((sortedArr.length - 1) * upperPercentile);

  const min = sortedArr[lowerIndex];
  const max = sortedArr[upperIndex];

  if (min === undefined || max === undefined || min === max) {
    return arr.map(() => 0);
  }

  const diff = max - min;

  return arr.map((value) => (value - min) / diff);
}
