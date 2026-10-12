import oracledb from 'oracledb';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Defaults match the local test container described in docs/oracle-setup.md.
export const dbConfig: oracledb.ConnectionAttributes = {
  user: process.env.ORACLE_USER ?? 'wealth',
  password: process.env.ORACLE_PASSWORD ?? 'wealth',
  connectString: process.env.ORACLE_CONNECT_STRING ?? 'localhost:1521/FREEPDB1',
};

let pool: oracledb.Pool | undefined;

export async function getPool() {
  pool ??= await oracledb.createPool({ ...dbConfig, poolMin: 1, poolMax: 8 });
  return pool;
}

export async function query<T>(sql: string, binds: oracledb.BindParameters = {}): Promise<T[]> {
  const conn = await (await getPool()).getConnection();
  try {
    const result = await conn.execute<T>(sql, binds);
    return result.rows ?? [];
  } finally {
    await conn.close();
  }
}

export async function closePool() {
  await pool?.close(5);
  pool = undefined;
}
