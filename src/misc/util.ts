import nano from "nano";
import crypto from "crypto";

export type PropertyChecker<T> = {
    [P in keyof T]: {
        optional: boolean,
        type?: string,
        checker?: (obj: any) => void // Errors should be thrown as exception
    }
}

// Check if `obj` has everything in `props`
// Error is thrown if check failed
export function checkProperties<T>(obj: any, props: PropertyChecker<T>): obj is T {
    for (let p in props) {
        let def = props[p];
        if (isEmpty(obj[p]) && !def.optional) {
            throw `'${p}' is missing from the parameters`;
        }

        if (def.type != null && typeof obj[p] != def.type) {
            if (def.type == "number") {
                obj[p] = Number.parseInt(obj[p]);
            } else if (def.type == "boolean") {
                if (typeof obj[p] == "string") {
                    obj[p] = obj[p] == "true";
                } else if (typeof obj[p] == "number") {
                    obj[p] = !!obj[p];
                } else {
                    throw `'${p}': '${def.type}' cannot be parsed as boolean`;
                }
            } else {
                throw `'${p}' expected to be '${def.type}' but actually '${typeof obj[p]}'`;
            }
        }

        if (def.checker != null) {
            def.checker(obj[p]);
        }
    }
    return true;
}

export function isEmpty(obj: any): boolean {
    return obj == null || (typeof obj == "string" && obj.trim() == "");
}

export function validateEmail(email: string): boolean {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Errors will be thrown if password is not strong
export function checkPassword(passwd: string) {
    if (passwd.length < 8 || checkPassword.length > 50) {
        throw "password length must be between 8 and 50";
    }
    // TODO: Extend the password complexity check to appropriate level
}

export function isDocument(obj: any): obj is nano.Document {
    return '_id' in obj && '_rev' in obj;
}

// Used to assert any database query return value as a Document
export function assertDocument<T>(obj: T): T & nano.Document {
    if (!isDocument(obj)) {
        throw "WTF, a database query returned something that's not a document";
    }
    return obj;
}

// All database query results should be sanitized by this function
// before sending over the internet.
// IMPORTANT!!!!!
export function sanitizeDocument<T>(doc: T & nano.Document): T {
    delete doc._id;
    delete doc._rev;
    if (doc.hasOwnProperty("_attachments")) {
        delete (doc as any)['_attachments'];
    }
    return doc;
}

export function sha256(str: string): string {
    return crypto.createHash("sha256")
        .update(str)
        .digest("hex");
}