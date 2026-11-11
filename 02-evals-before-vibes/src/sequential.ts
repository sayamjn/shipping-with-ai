export const mapSequential = <T, R>(items: ReadonlyArray<T>, work: (item: T, idx: number) => Promise<R>): Promise<ReadonlyArray<R>> =>
  items.reduce<Promise<ReadonlyArray<R>>>(async (done, item, idx) => {
    const previous = await done;
    return [...previous, await work(item, idx)];
  }, Promise.resolve([]));
