import { buildDataSourceOptions } from './database.config';

const base = { DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'd' };

describe('buildDataSourceOptions', () => {
  it('DB_SOCKET_PATH가 없으면 TCP로 붙는다', () => {
    const options = buildDataSourceOptions({ ...base, DB_HOST: 'localhost', DB_PORT: '5433' });
    expect(options).toMatchObject({ host: 'localhost', port: 5433, ssl: false });
  });

  it('DB_SOCKET_PATH가 있으면 소켓 경로를 host로 쓰고 DB_HOST를 무시한다', () => {
    const options = buildDataSourceOptions({
      ...base,
      DB_HOST: 'ignored',
      DB_SOCKET_PATH: '/cloudsql/p:asia-northeast1:i',
    });
    expect(options).toMatchObject({ host: '/cloudsql/p:asia-northeast1:i', ssl: false });
    expect(options).not.toHaveProperty('port');
  });

  it('DB_SSL=true면 TLS를 켠다', () => {
    const options = buildDataSourceOptions({ ...base, DB_HOST: 'ext', DB_SSL: 'true' });
    expect(options.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('필수 환경변수가 빠지면 던진다', () => {
    expect(() => buildDataSourceOptions({ DB_HOST: 'localhost' })).toThrow('DB_USER');
  });

  it('synchronize는 항상 false다', () => {
    expect(buildDataSourceOptions({ ...base, DB_HOST: 'h' }).synchronize).toBe(false);
  });
});
