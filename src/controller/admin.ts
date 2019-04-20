import { default as Server, Component, ComponentRouter } from "../server";
import { Response, ExceptionToResponse } from "./shared";
import AuthManager from "./auth_manager";
import UserManager from "./user_manager";
import { State } from "../model/user";
import express from "express";

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
}

export default new Admin();