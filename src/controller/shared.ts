export interface Response<T> {
    ok: boolean,
    reason?: string,
    result?: T,
}