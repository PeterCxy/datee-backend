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
export function ExceptionToResponse<U>(
    target: any, propertyKey: string, descriptor: PropertyDescriptor
) {
    let orig:
        (req: express.Request, res: express.Response)
            => Promise<Response<U>> = descriptor.value;
    descriptor.value = async function (
        req: express.Request, res: express.Response
    ): Promise<void> {
        try {
            res.send(JSON.stringify(await orig.apply(this, [req, res])));
        } catch (err) {
            res.status(400).send(JSON.stringify({ ok: false, reason: err }));
        }
    }

}