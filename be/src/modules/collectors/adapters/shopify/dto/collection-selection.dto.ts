/** 이번 실행에서 돌 컬렉션과, 상한에 걸려 뺀 개수 */
export interface Selection {
  readonly handles: string[];
  /** 상한에 걸려 이번 실행에서 뺀 것. 0이 아니면 호출부가 로그로 남긴다 */
  readonly dropped: number;
}
