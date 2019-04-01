import nano from "nano";

// Check if `obj` has everything in `props`
// Error is thrown if check failed
export function checkProperties(obj: any, props: string[]) {
    for (let p of props) {
        if (isEmpty(obj[p])) {
            throw `'${p}' is missing from the parameters`;
        }
    }
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