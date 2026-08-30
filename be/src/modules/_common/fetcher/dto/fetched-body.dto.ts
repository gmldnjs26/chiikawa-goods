/** `fetchText` 출력. 리다이렉트를 다 따라간 **최종** 응답이다 */
export interface FetchedBody {
  readonly url: string;
  readonly status: number;
  readonly body: string;
  readonly contentType: string | null;
}
