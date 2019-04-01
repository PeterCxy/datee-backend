export interface Response<T> {
    ok: boolean,
    reason?: string,
    result?: T,
}

// The decorator to process errors happened
// in an async function and return it as a
// Response. Success values are also wrapped
// in Response. This way, we do not need to
// write try...catch for each API endpoint.
// NOTE: Use this decorator for every typed
// API endpoint.
export function AutoResponse<T>(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    let orig = descriptor.value;
    descriptor.value = async function(): Promise<Response<T>> {
        let _this = this;
        let _args = arguments;
        try {
            let ret = await orig.apply(_this, _args);
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