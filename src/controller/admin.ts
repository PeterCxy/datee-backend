import { default as Server, Component, ComponentRouter } from "../server";
import { Response, ExceptionToResponse } from "./shared";
import AuthManager from "./auth_manager";
import UserManager from "./user_manager";
import PhotoManager from "./photo_manager";
import { UserInfo, State, Gender } from "../model/user";
import { Countries, Cities } from "../model/locality";
import express from "express";
import request from "request-promise";

/**
 * This class implements some functionalities only accessable
 * to the site admins. All stuff here is protected by the admin
 * password.
 */
class Admin implements Component {
    constructor() {
        Server.registerComponent(this);
    }

    public async setupRoutes(): Promise<ComponentRouter> {
        let router = express.Router();
        // Everything here is excluded from the normal authentication
        // pipeline, we implement our own authentication middleware
        AuthManager.excludePath("/admin/activate");
        AuthManager.excludePath("/admin/do_match");
        AuthManager.excludePath("/admin/generateRandomUser");
        router.use((req, res, next) => {
            if (req.ip != '127.0.0.1' && req.ip != '::ffff:127.0.0.1') {
                res.sendStatus(401);
                return;
            }

            if (!Server.verifyAdminPassword(req.headers["authorization"])) {
                res.sendStatus(401);
                return;
            }

            next();
        });
        // The actual routes
        router.post("/activate", this.activateUser.bind(this));
        router.get("/do_match", this.doMatch.bind(this));
        router.post("/generateRandomUser", this.generateRandomUser.bind(this));
        return {
            mountpoint: "/admin",
            router: router
        };
    }

    // "Approve" a registration. Set the state of a user
    // to "Idle" if the user is currently "MatchingPreferencesSet"
    @ExceptionToResponse
    private async activateUser(
        req: express.Request, res: express.Response
    ): Promise<Response<void>> {
        if (!req.body["uid"]) {
            throw "Must provide uid";
        }
        let user = await UserManager.findUserById(req.body["uid"]);
        if (user.state != State.MatchingPreferencesSet) {
            throw "Invalid state for approval";
        }
        user.state = State.Idle;
        await UserManager.updateUser(user);
        return { ok: true };
    }

    // TODO: Implement the matching algorithm here!!!
    @ExceptionToResponse
    private async doMatch(): Promise<Response<void>> {
        // fill in here
        return { ok: true };
    }

    @ExceptionToResponse
    private async generateRandomUser(): Promise<Response<void>> {
        let rnd = Math.random().toString(36).substring(7);
        let info: UserInfo = {
            email: rnd + "@example.com",
            firstName: rnd,
            lastName: "Example",
            age: 18 + Math.floor(Math.random() * 42),
            gender: Math.random() >= 0.5 ? Gender.Male : Gender.Female,
            country: Countries.China,
            city: Cities.Suzhou
        }
        await UserManager.createUser(info, "1234567890");
        let user = await UserManager.findUserByEmail(rnd + "@example.com");
        for (let i = 0; i < 3 + Math.floor(Math.random() * 7); i++) {
            let buf = await request("https://thispersondoesnotexist.com/image", { encoding: null });
            if (!(buf instanceof Buffer)) {
                throw "WTF? Not a buffer?";
            }
            await PhotoManager.addPhoto(user, buf, "image/jpeg");
        }
        user = await UserManager.findUserByEmail(rnd + "@example.com");
        if (user.state != State.PhotoUploaded) {
            throw "WTF? Photo not uploaded???";
        }
        user.selfAssessment = {
            romance: 1 + Math.floor(Math.random() * 5),
            openness: 1 + Math.floor(Math.random() * 5),
            warmheartedness: 1 + Math.floor(Math.random() * 5)
        };
        let minAge = 18 + Math.floor(Math.random() * 42)
        user.matchingPref = {
            gender: Math.random() >= 0.5 ? Gender.Male : Gender.Female,
            minAge: minAge,
            maxAge: minAge + Math.floor(Math.random() * (60 - minAge)),
            romance: 1 + Math.floor(Math.random() * 5),
            openness: 1 + Math.floor(Math.random() * 5),
            warmheartedness: 1 + Math.floor(Math.random() * 5)
        }
        user.state = State.Idle;
        user = await UserManager.updateUser(user);
        return { ok: true };
    }
}

export default new Admin();