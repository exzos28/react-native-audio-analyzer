"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sample = sample;
exports.scale = scale;
function scale(arr) {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const diff = max - min;
  return arr.map(_ => (_ - min) / diff);
}
function sample(arr, newSize) {
  const originalSize = arr.length;
  const ratio = originalSize / newSize;
  const result = [];
  for (let i = 0; i < newSize; i++) {
    const startIndex = Math.floor(i * ratio);
    const endIndex = Math.floor((i + 1) * ratio);
    let sum = 0;
    for (let j = startIndex; j < endIndex; j++) {
      sum += arr[j];
    }
    const average = sum / (endIndex - startIndex);
    result.push(average);
  }
  return result;
}
//# sourceMappingURL=helpers.js.map