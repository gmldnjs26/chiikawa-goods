import { FetchError } from './fetch.error';

/**
 * `robots.txt`가 막은 경로. **차단과 다른 사건이다** —
 * 상대가 우리를 막은 게 아니라 우리가 가면 안 되는 곳을 가리킨 것이다.
 * 소스를 내리지 않는다. 고칠 곳은 `config`이지 상대가 아니다.
 */
export class RobotsDeniedError extends FetchError {
  constructor(message: string) {
    super('blocked', message);
    this.name = 'RobotsDeniedError';
  }
}
