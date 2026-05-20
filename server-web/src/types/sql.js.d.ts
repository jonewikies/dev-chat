declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): QueryExecResult[];  // exec() doesn't support parameters in sql.js
    close(): void;
    export(): Uint8Array;
    prepare(sql: string): Statement;
  }

  export interface Statement {
    bind(values?: any[]): boolean;
    step(): boolean;
    get(params?: never): any[];
    getAsObject(params?: never): any;
    free(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer) => Database;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
}
