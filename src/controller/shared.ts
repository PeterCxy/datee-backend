import { TypedRequest } from "restyped-express-async";
import { RestypedRoute } from "restyped";
import express from "express";

export interface Response<T> {
    ok: boolean,
    reason?: string,
    result?: T,
}

// A decorator to convert an async function to one that returns `Response`
// so that all errors are catched and wrapped as `ok = false` while all
// success values are preserved. These functions are expected to return
// "ok = true" by default on any non-exception case, and all the exceptions
// should be thrown and handled by this decorator.
// This way we don't have to write try..catch
// for every freaking API endpoint.
// NOTE: use this for every typed API endpoint.
export function ExceptionToResponse<T extends RestypedRoute, U>(
    target: any, propertyKey: string, descriptor: PropertyDescriptor
) {
    let orig:
        (req: TypedRequest<T>, res: express.Response)
            => Promise<Response<U>> = descriptor.value;
    descriptor.value = async function (
        req: TypedRequest<T>, res: express.Response
    ): Promise<Response<U>> {
        try {
            return await orig.apply(this, [req, res]);
        } catch (err) {
            return { ok: false, reason: err };
        }
    }

}