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
