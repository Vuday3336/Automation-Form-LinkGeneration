// PGlite = real PostgreSQL compiled to WebAssembly, running inside Node.
// Used by the automated tests (in memory) and by `npm run dev:local` (saved to a folder),
// so you can run the whole app without internet or a Supabase project.
// Same query()/transaction() interface as the Supabase driver in db.js.

const normalise = (result) => ({ rows: result.rows, rowCount: result.affectedRows ?? result.rows.length });

export async function createPgliteDriver(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  const pglite = new PGlite(dataDir);
  await pglite.waitReady;

  return {
    query: async (text, params) => normalise(await pglite.query(text, params)),
    exec: (text) => pglite.exec(text),
    transaction: (fn) =>
      pglite.transaction((tx) =>
        fn({
          query: async (text, params) => normalise(await tx.query(text, params)),
          exec: (text) => tx.exec(text),
        })
      ),
    close: () => pglite.close(),
  };
}
