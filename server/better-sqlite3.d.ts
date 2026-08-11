declare module 'better-sqlite3' {
  type RunResult = { changes: number; lastInsertRowid: number | bigint };
  interface Statement {
    run(...params: any[]): RunResult;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }
  class Database {
    constructor(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean });
    pragma(source: string, options?: { simple?: boolean }): unknown;
    exec(source: string): this;
    prepare(source: string): Statement;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }
  export default Database;
}
