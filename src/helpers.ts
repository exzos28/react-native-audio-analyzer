export function scale(arr: number[]) {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const diff = max - min;

  return arr.map((_) => (_ - min) / diff);
}

export function sample(arr: number[], newSize: number) {
  const originalSize = arr.length;
  const ratio = originalSize / newSize;
  const result = [];

  for (let i = 0; i < newSize; i++) {
    const startIndex = Math.floor(i * ratio);
    const endIndex = Math.floor((i + 1) * ratio);
    let sum = 0;

    for (let j = startIndex; j < endIndex; j++) {
      sum += arr[j]!;
    }

    const average = sum / (endIndex - startIndex);
    result.push(average);
  }

  return result;
}
