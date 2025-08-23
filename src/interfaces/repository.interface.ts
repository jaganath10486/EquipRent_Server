export interface BaseRepositoryInterface<T> {
//   getById: (id: string) => Promise<T | null>;
//   exists: (query: any) => Promise<boolean>;
  getAll: (query: any) => Promise<T[]>;
//   create: (data: any) => Promise<T | null>;
}
