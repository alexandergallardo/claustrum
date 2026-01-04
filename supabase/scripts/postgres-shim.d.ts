declare module "postgres" {
  export type PostgresOptions = Record<string, unknown>;

  export type TransactionSql = {
    unsafe(query: string): Promise<unknown>;
  };

  export type Sql = {
    unsafe(query: string): Promise<unknown>;
    begin<T>(fn: (tx: TransactionSql) => Promise<T>): Promise<T>;
    end(opts?: { timeout?: number }): Promise<void>;
  };

  export default function postgres(url: string, options?: PostgresOptions): Sql;
}
