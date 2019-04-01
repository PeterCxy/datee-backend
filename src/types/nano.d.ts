import nano from "nano";

declare module "nano" {
    export interface IndexParams {
        index: {
            fields: string[]
        },
        ddoc?: string,
        name?: string
    }

    export interface DocumentScope<D> {
        createIndex(indexDef: IndexParams): Promise<nano.MangoResponse<D>>;
    }
}