import { default as Server, Component, ComponentRouter } from "../server";
import { Response } from "./shared";
import UserManagerAPI from "./user_manager_api";
import { default as User, UserInfo, State } from "../model/user";
import * as locality from "../model/locality";
import * as util from "../misc/util";
import { default as RestypedRouter, TypedRequest } from 'restyped-express-async'
import express from "express";
import nano from "nano";
import uuid from "uuid/v5";
import bcrypt from "bcrypt";

class UserManager implements Component {
    private db: nano.DocumentScope<User>;
    constructor() {
        Server.registerComponent(this);
    }

    public async setupRoutes(): Promise<ComponentRouter> {
        // Initialize the database here because it is async
        this.db = await Server.getDatabase("users");
        // Build the router
        let expressRouter = express.Router();
        let router = RestypedRouter<UserManagerAPI>(expressRouter);
        router.put("/register", this.register.bind(this));
        return {
            mountpoint: "/user",
            router: expressRouter
        };
    }

    // Find a user by email
    // returns `undefined` if not found
    public async findUserByEmail(email: string): Promise<User | undefined> {
        let res = await this.db.find({
            selector: {
                email: email
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return res.docs[0];
        }
    }

    // Find a user by email and verify the password
    // if the user is not found or the password is
    // incorrect, return null; otherwise return the
    // User object
    public async verifyUserLogin(email: string, password: string): Promise<User | undefined> {
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
    public async findUserById(uid: string): Promise<User | undefined> {
        let res = await this.db.find({
            selector: {
                uid: uid
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return res.docs[0];
        }
    }

    // Create a new user
    // Errors are thrown if occured
    public async createUser(info: UserInfo, passwd: string): Promise<void> {
        if (!util.validateEmail(info.email)) {
            throw "Invalid email";
        }
        if (info.age < 18) {
            throw "Too young and naïve";
        }
        if (info.age >= 60) {
            throw "Too old";
        }
        if (info.gender < 0 || info.gender > 1) {
            throw "Unrecognizable gender";
        }
        if (info.country < 0 || info.country >= locality.NUM_CONTRY) {
            throw "Unrecognizable country";
        }
        if (info.city < 0 || info.city >= locality.NUM_CITY) {
            throw "Unrecognizable city";
        }
        if ((await this.findUserByEmail(info.email)) != null) {
            throw "User already exists";
        }
        util.checkPassword(passwd);
        // Create a useable UUID
        let id;
        do {
            id = uuid("dat.ee", uuid.DNS);
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

    private async register(
        req: TypedRequest<UserManagerAPI['/register']['PUT']>,
    ): Promise<Response<void>> {
        try {
            util.checkProperties(req.body,
                ["email", "firstName", "lastName", "password", "age",
                 "gender", "country", "city"]);
            await this.createUser(req.body, req.body.password);
            return { ok: true };
        } catch (err) {
            return { ok: false, reason: err };
        }
    }
}

export default new UserManager();