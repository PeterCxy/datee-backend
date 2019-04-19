import { default as Server, Component, ComponentRouter } from "../server";
import { Response, ExceptionToResponse } from "./shared";
import AuthManager from "./auth_manager";
import { default as User, UserInfo, State, UserTraits,
    SelfAssessment, MatchingPreference } from "../model/user";
import * as locality from "../model/locality";
import * as util from "../misc/util";
import express from "express";
import nano from "nano";
import uuid from "uuid/v4";
import bcrypt from "bcrypt";

class UserManager implements Component {
    private db: nano.DocumentScope<User>;
    constructor() {
        Server.registerComponent(this);
    }

    private async initializeDb(): Promise<void> {
        this.db = await Server.getDatabase("users");
        await this.db.createIndex({
            index: {
                fields: ["uid", "email"],
            },
            ddoc: "indexUser",
            name: "indexUser"
        });
    }

    public async setupRoutes(): Promise<ComponentRouter> {
        // Initialize the database here because it is async
        await this.initializeDb();
        // Build the router
        let router = express.Router();
        // Registration doesn't need to be authenticated
        AuthManager.excludePath("/user/register");
        router.put("/register", this.register.bind(this));
        router.get("/whoami", this.whoami.bind(this));
        router.put("/self_assessment", this.setSelfAssessment.bind(this));
        router.put("/matching_pref", this.setMatchingPreferences.bind(this));
        return {
            mountpoint: "/user",
            router: router
        };
    }

    // Find a user by email
    // returns `undefined` if not found
    public async findUserByEmail(email: string): Promise<User & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                email: email
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return util.assertDocument(res.docs[0]);
        }
    }

    // Find a user by email and verify the password
    // if the user is not found or the password is
    // incorrect, return null; otherwise return the
    // User object
    public async verifyUserLogin(email: string, password: string): Promise<User & nano.Document | undefined> {
        let user = await this.findUserByEmail(email);
        if (!user) {
            // User not found
            return null;
        }
        // MUST use this constant-time comparison for the password
        if (!(await bcrypt.compare(password, user.passwordHash))) {
            // Password incorrect
            return null;
        }
        return user;
    }

    // Find a user by UUID
    public async findUserById(uid: string): Promise<User & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                uid: uid
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return util.assertDocument(res.docs[0]);
        }
    }

    // Get current user in this authenticated request
    // this should ONLY be called from those endpoints
    // protected by `AuthManager`
    public async getCurrentUser(res: any): Promise<User & nano.Document> {
        let uid = await AuthManager.getCurrentUID(res);
        return await this.findUserById(uid);
    }

    // Update the information of a user (the user must be previously fetched from db)
    // Note: the `user` object should normally be the visiting user himself
    // DO NOT modify user infortion without authentication
    // The user object WILL BE MODIFIED, so please replace it with the 
    // return value of this function
    public async updateUser(user: User & nano.Document): Promise<User & nano.Document> {
        if ((await this.findUserById(user.uid)) == null) {
            throw "User " + user.uid + " not found in database.";
        }
        // If the original object is a `Document` (contains "_rev")
        // then this will be an update operation
        let res = await this.db.insert(user);
        if (!res.ok) {
            throw "Failed to update user in database";
        }

        return await this.findUserById(user.uid);
    }

    // Create a new user
    // Errors are thrown if occured
    public async createUser(info: UserInfo, passwd: string): Promise<void> {
        if ((await this.findUserByEmail(info.email)) != null) {
            throw "User already exists";
        }
        // Create a useable UUID
        let id;
        do {
            id = uuid();
        } while ((await this.findUserById(id) != null));

        let user: User = {
            uid: id,
            passwordHash: await bcrypt.hash(passwd, 10),
            email: info.email,
            firstName: info.firstName,
            lastName: info.lastName,
            age: info.age,
            gender: info.gender,
            country: info.country,
            city: info.city,
            state: State.Registered
        }
        let res = await this.db.insert(user);
        if (!res.ok) {
            throw "Database failure";
        }
    }

    private sanitizeUser(user: User): User {
        delete user.passwordHash;
        delete user.matchingPref;
        delete user.selfAssessment;
        return user;
    }

    @ExceptionToResponse
    private async register(
        req: express.Request,
    ): Promise<Response<void>> {
        // Errors will be thrown directly from checkProperties()
        // here we use if just to trick TypeScript to make the
        // type assertion work.
        if (!util.checkProperties(req.body, RegisterInfoChecker)) return;
        await this.createUser(req.body, req.body.password);
        return { ok: true };
    }

    @ExceptionToResponse
    private async whoami(
        req: express.Request,
        res: express.Response,
    ): Promise<Response<User>> {
        let user = util.sanitizeDocument(await this.getCurrentUser(res));
        user = this.sanitizeUser(user);
        // Since this response is authenticated, so we can
        // confidently send the entire User object back to
        // the user.
        return { ok: true, result: user };
    }

    @ExceptionToResponse
    private async setSelfAssessment(
        req: express.Request,
        res: express.Response
    ): Promise<Response<void>> {
        if (!util.checkProperties(req.body, SelfAssessmentChecker)) return;
        let user = await this.getCurrentUser(res);
        if (user.state < State.PhotoUploaded) {
            throw "Please upload photo first";
        }
        user.selfAssessment = req.body;
        if (user.state == State.PhotoUploaded) {
            // Update the state accordingly
            user.state = State.SelfAssessmentDone;
        }
        await this.updateUser(user);
        return { ok: true };
    }

    @ExceptionToResponse
    private async setMatchingPreferences(
        req: express.Request,
        res: express.Response
    ): Promise<Response<void>> {
        if (!util.checkProperties(req.body, MatchingPreferenceChecker)) return;
        let user = await this.getCurrentUser(res);
        if (user.state < State.SelfAssessmentDone) {
            throw "Please set self assessments first";
        }
        user.matchingPref = req.body;
        if (user.state == State.SelfAssessmentDone) {
            // Update the state accordingly
            user.state = State.MatchingPreferencesSet;
        }
        await this.updateUser(user);
        return { ok: true };
    }
}

export default new UserManager();

// Parameters for "/resgiter". Extended from basic UserInfo
interface RegisterInfo extends UserInfo {
    // A password BEFORE hashing
    password: string
}

function ageChecker(age: number) {
    if (age < 18) {
        throw "Too young and naïve";
    }
    if (age >= 60) {
        throw "Too old";
    }
}

function genderChecker(gender: number) {
    if (gender < 0 || gender > 1) {
        throw "Unrecognizable gender";
    }
}

const RegisterInfoChecker: util.PropertyChecker<RegisterInfo> = {
    email: {
        optional: false,
        type: "string",
        checker: (obj: string) => {
            if (!util.validateEmail(obj)) {
                throw "Invalid email";
            }
        }
    },
    firstName: {
        optional: false,
        type: "string"
    },
    lastName: {
        optional: false,
        type: "string"
    },
    password: {
        optional: false,
        type: "string",
        checker: util.checkPassword
    },
    age: {
        optional: false,
        type: "number",
        checker: ageChecker
    },
    gender: {
        optional: false,
        type: "number",
        checker: genderChecker
    },
    country: {
        optional: false,
        type: "number",
        checker: (obj: number) => {
            if (obj < 0 || obj >= locality.NUM_CONTRY) {
                throw "Unrecognizable country";
            }
        }
    },
    city: {
        optional: false,
        type: "number",
        checker: (obj: number) => {
            if (obj < 0 || obj >= locality.NUM_CITY) {
                throw "Unrecognizable city";
            }
        }
    }
}

function scoreChecker(num: number) {
    if (num <= 0 || num > 5) {
        throw "Illegal score " + num;
    }
}

const UserTraitsChecker: util.PropertyChecker<UserTraits> = {
    romance: {
        optional: false,
        type: "number",
        checker: scoreChecker
    },
    openness: {
        optional: false,
        type: "number",
        checker: scoreChecker
    },
    warmheartedness: {
        optional: false,
        type: "number",
        checker: scoreChecker
    }
};

const SelfAssessmentChecker: util.PropertyChecker<SelfAssessment> = Object.assign({...UserTraitsChecker}, {});

const MatchingPreferenceChecker: util.PropertyChecker<MatchingPreference> = Object.assign({...UserTraitsChecker}, {
    gender: {
        optional: false,
        type: "number",
        checker: genderChecker
    },
    maxAge: {
        optional: false,
        type: "number",
        checker: ageChecker
    },
    minAge: {
        optional: false,
        type: "number",
        checker: ageChecker
    }
});