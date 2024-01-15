import { scale, sample } from './helpers';

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
