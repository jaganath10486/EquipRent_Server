export interface BaseRepositoryInterface<T> {
  getAll: (query: any) => Promise<T[]>;
}
