import { Countries, Cities } from "./locality";

// Basic information of a user
// usable as a parameter of a public API
export interface UserInfo {
    // The email used for registration
    email: string
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
}

// Model of a User
// This should NEVER be returned directly by any
// API endpoint. The data MUST be sanitized before
// returning
export default interface User extends UserInfo {
    // ID of the user. Should be UUID and
    // should not be enumerable at all.
    uid: string
    // Hashed password. See UserManager
    // for how the password should be hashed
    passwordHash: string
    // What the user consider themself to be
    selfAssessment?: SelfAssessment,
    // What the user expect their partner to be
    matchingPref?: MatchingPreference,
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
    // After uploading minimum photos
    PhotoUploaded,
    // After finishing self-assessment
    SelfAssessmentDone,
    // After finishing setting preferences
    MatchingPreferencesSet,
    // Waiting to be matched
    Idle,
    // TODO: Verified, Idle, Matched, Dated, etc...
}

export interface UserTraits {
    romance: number,
    openness: number,
    warmheartedness: number,
}

export interface SelfAssessment extends UserTraits {

}

export interface MatchingPreference extends UserTraits {
    gender: Gender,
    maxAge: number,
    minAge: number,
}