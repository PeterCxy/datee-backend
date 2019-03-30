import { Countries, Cities } from "./locality";

// Model of a User
// This should NEVER be returned directly by any
// API endpoint. The data MUST be sanitized before
// returning
export default interface User {
    // ID of the user. Should be UUID and
    // should not be enumerable at all.
    uid: string
    // The email used for registration
    email: string
    // Hashed password. See UserManager
    // for how the password should be hashed
    passwordHash: string
    // Name of the user
    firstName: string
    lastName: string
    // Age of the user
    age: number
    // Biological gender of the user
    gender: Gender
    // Location info
    country: Countries
    city: Cities
    // Internal state of the user
    // used by the Datee state machine
    state: State
}

// The biological gender of a user
export enum Gender {
    Male = 0,
    Female,
}

// The state of a user
// TODO: Complete this
export enum State {
    // Default state after registration
    Registered = 0,
}