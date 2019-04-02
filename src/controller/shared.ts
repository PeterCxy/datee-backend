import { TypedRequest } from "restyped-express-async";
import { RestypedRoute } from "restyped";
import express from "express";

export interface Response<T> {
    ok: boolean,
    reason?: string,
    result?: T,
}

// A wrapper to convert an async function to one that returns `Response`
// so that all errors are catched and wrapped as `ok = false` while all
// success values are `ok = true`. This way we don't have to write try..catch
// for every freaking API endpoint.
// Decorators won't work because they cannot change the signature of methods.
// it will break the type checker.
// NOTE: use this for every typed API endpoint.
export function autoResponse<T extends RestypedRoute, U>(
    fn: (req: TypedRequest<T>, res: express.Response) => Promise<U>
): (req: TypedRequest<T>, res: express.Response) => Promise<Response<U>> {
    return async function(req, res) {
        let _this = this;
        try {
            let ret = await fn.apply(_this, [req, res]);
            if (ret != null) {
                return { ok: true, result: ret };
            } else {
                return { ok: true };
            }
        } catch (err) {
            return { ok: false, reason: err };
        }
    }
}