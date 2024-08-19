import { scale, sample, robustScale, trimmedScale } from './helpers';

describe('scale function', () => {
  it('should scale the array values between 0 and 1', () => {
    const inputArray = [1, 2, 3, 4, 5];
    const scaledArray = scale(inputArray);

    expect(scaledArray).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('should handle an empty array', () => {
    const inputArray: number[] = [];
    const scaledArray = scale(inputArray);

    expect(scaledArray).toEqual([]);
  });

  it('should handle an array with one element', () => {
    const inputArray = [42];
    const scaledArray = scale(inputArray);

    expect(scaledArray).toEqual([0]);
  });
});

describe('sample function', () => {
  it('should sample the array to the specified size', () => {
    const inputArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const newSize = 5;
    const sampledArray = sample(inputArray, newSize);

    expect(sampledArray.length).toBe(newSize);
    expect(sampledArray).toEqual([1, 3, 5, 7, 9]);
  });

  it('should handle an empty array', () => {
    const inputArray: number[] = [];
    const newSize = 0;
    const sampledArray = sample(inputArray, newSize);

    expect(sampledArray).toEqual([]);
  });

  it('should handle an array with one element', () => {
    const inputArray = [42];
    const newSize = 5;
    const sampledArray = sample(inputArray, newSize);

    expect(sampledArray).toEqual([42, 42, 42, 42, 42]); // The result will be an array with the same element repeated
  });

  it('should handle newSize greater than the original size', () => {
    const inputArray = [1, 2, 3];
    const newSize = 5;
    const sampledArray = sample(inputArray, newSize);

    expect(sampledArray).toEqual([1, 1, 2, 2, 3]); // The result will include elements from the original array with repetition
  });
});

describe('robustScale', () => {
  test('should return empty array for empty input', () => {
    expect(robustScale([])).toEqual([]);
  });

  test('should return array of zeros for array with identical elements', () => {
    expect(robustScale([1, 1, 1, 1])).toEqual([0, 0, 0, 0]);
  });

  test('should scale values correctly for a simple array', () => {
    const input = [1, 2, 3, 4, 5];
    const output = robustScale(input);

    expect(output[0]).toEqual(0);
    expect(output[1]).toEqual(0.3333333333333333);
    expect(output[2]).toBeGreaterThan(0);
    expect(output[4]).toEqual(1);
  });

  test('should handle arrays with outliers', () => {
    const input = [1, 2, 3, 4, 100];
    const output = robustScale(input);

    expect(output[0]).toEqual(0);
    expect(output[1]).toEqual(0.3333333333333333);
    expect(output[2]).toBeGreaterThan(0);
    expect(output[3]).toBeLessThanOrEqual(1);
    expect(output[4]).toEqual(1);
  });

  test('should handle small arrays', () => {
    const input = [1, 2];
    const output = robustScale(input);

    expect(output[0]).toBeLessThanOrEqual(0);
    expect(output[1]).toBeGreaterThanOrEqual(0);
  });
});

describe('trimmedScale function', () => {
  test('should return empty array for empty input', () => {
    expect(trimmedScale([])).toEqual([]);
  });

  test('should return array of zeros for array with identical elements', () => {
    expect(trimmedScale([5, 5, 5, 5])).toEqual([0, 0, 0, 0]);
  });

  test('should scale values correctly for a simple array', () => {
    const input = [10, 20, 30, 40, 50];
    const output = trimmedScale(input);
    expect(output).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  test('should handle arrays with outliers', () => {
    const input = [1, 2, 3, 4, 100];
    const output = trimmedScale(input);
    expect(output).toEqual([
      0,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      1,
    ]);
  });

  test('should handle custom percentiles', () => {
    const input = [1, 2, 3, 4, 5, 100];
    const output = trimmedScale(input, 0.1, 0.9);
    expect(output).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      1,
    ]);
  });

  test('should handle small arrays', () => {
    const input = [2, 8];
    expect(trimmedScale(input)).toEqual([0, 1]);
  });
});
