import { default as Server, Component, ComponentRouter } from "../server";
import { Response, ExceptionToResponse } from "./shared";
import AuthManager from "./auth_manager";
import UserManager from "./user_manager";
import { Rating } from "../model/user";
import * as util from "../misc/util";
import express from "express";
import nano from "nano";

class RatingManager implements Component {
    private db: nano.DocumentScope<Rating>;
    constructor() {
        Server.registerComponent(this);
    }

    public async initializeDb(): Promise<void> {
        this.db = await Server.getDatabase("ratings");
        await this.db.createIndex({
            index: {
                fields: ["rater_uid", "ratee_uid"]
            },
            ddoc: "indexRatings",
            name: "indexRatings",
        });
    }

    public async setupRoutes(): Promise<ComponentRouter> {
        await this.initializeDb();
        let router = express.Router();
        router.get("/my", this.getRating.bind(this));
        router.put("/:uid", this.putRating.bind(this));
        return {
            mountpoint: "/rate",
            router: router
        };
    }

    public async setRating(rater: string, ratee: string, score: number): Promise<void> {
        if (!Number.isInteger(score) || score < 1 || score > 5) {
            throw "Score must be an integer within [1, 5]";
        }
        
        if (rater == ratee) {
            throw "You can't rate yourself";
        }

        if (UserManager.findUserById(rater) == null
            || UserManager.findUserById(ratee) == null) {
            throw "Unknown rater or ratee";
        }

        let ratingObj: Rating & nano.MaybeDocument;
        let res1 = await this.db.find({
            selector: {
                rater_uid: rater,
                ratee_uid: ratee,
            }
        });
        if (res1.docs.length > 0) {
            // If there is already record in the database
            // update the score.
            ratingObj = res1.docs[0];
            ratingObj.score = score;
        } else {
            ratingObj = {
                // The create operation is not atomic
                // Parallel requests might pass the duplication check
                // simultaneously, causing repeated insertion.
                // We use a unique CouchDB `_id` to fix this problem.
                // Two simultaneous requests with the same `_id` will fail.
                _id: util.sha256(rater + ratee),
                rater_uid: rater,
                ratee_uid: ratee,
                score: score,
            };
        }
        
        // Insert the object
        // If it was an existing one that is being updated,
        // the ratingObj will also be a Document, so it will be fine
        let res2 = await this.db.insert(ratingObj);
        if (!res2.ok) {
            throw "Unknown database error";
        }
    }

    public async getRatingOfUser(ratee: string): Promise<number> {
        let res = await this.db.find({
            selector: {
                ratee_uid: ratee
            }
        });
        
        if (res.docs == null || res.docs.length == 0) {
            // 0 = no rating
            return 0;
        } else {
            let sum = res.docs.map((it) => it.score)
                .reduce((x, y) => x + y);
            return sum / res.docs.length;
        }
    }

    @ExceptionToResponse
    private async putRating(
        req: express.Request, res: express.Response
    ): Promise<Response<void>> {
        await this.setRating(
            await AuthManager.getCurrentUID(res), req.params["uid"],
            Number.parseInt(req.body["score"])
        );
        return { ok: true };
    }

    @ExceptionToResponse
    private async getRating(
        req: express.Request, res: express.Response
    ): Promise<Response<number>> {
        let rating = await this.getRatingOfUser(
            await AuthManager.getCurrentUID(res));
        return { ok: true, result: rating };
    }
}

export default new RatingManager();