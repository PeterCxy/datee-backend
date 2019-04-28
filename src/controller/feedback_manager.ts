import { default as Server, Component, ComponentRouter } from "../server";
import { Response, ExceptionToResponse } from "./shared";
import { default as Feedback, FeedbackInfo }from "../model/feedback"
import UserManager from "./user_manager";
import nano from "nano";
import express from "express";
import * as util from "../misc/util";
import uuid from "uuid/v4";

class FeedbackManager implements Component {
    private db: nano.DocumentScope<Feedback>;
    
    constructor() {
        Server.registerComponent(this);
    }

    private async initializeDb(): Promise<void> {
        this.db = await Server.getDatabase("feedbacks");
        await this.db.createIndex({
            index: {
                fields: ["from", "to","feedbackId"],
            },
            ddoc: "indexfeedback",
            name: "indexfeedback"
        });
    }

    public async setupRoutes(): Promise<ComponentRouter> {
        // Initialize the database here because it is async
        await this.initializeDb();
        // Build the router
        let router = express.Router();
        router.put("/new", this.createNewFeedback.bind(this));
        router.get("/self",this.getFeedbacks.bind(this));
        return {
            mountpoint: "/feedback",
            router: router
        };
    }
    
    public async findFeedbackById(feedbackId: string): Promise<Feedback & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                feedbackId: feedbackId,
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return util.assertDocument(res.docs[0]);
        }
    }

    public async findFeedbackByUserPair(from: string, to: string): Promise<Feedback & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                from: from,
                to: to
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return util.assertDocument(res.docs[0]);
        }
    }  

    public async createFeedback(info: FeedbackInfo): Promise<void> {
        if ((await this.findFeedbackByUserPair(info.from, info.to)) != null) {
            throw "Feedback already exists";
        }
        if ((await UserManager.findUserById(info.from)) == null
            || (await UserManager.findUserById(info.to)) == null) {
            throw "Both from and to must exist";
        }
        if (info.content == null){
            throw "Your content is null";
        }
        let id;
        do {
            id = uuid();
        } while ((await this.findFeedbackById(id) != null));

        let newFeedback: Feedback & nano.MaybeDocument = {
            feedbackId: id,
            from: info.from,
            to: info.to,
            content: info.content,
        }
        let res = await this.db.insert(newFeedback);
        if (!res.ok) {
            throw "Database failure";
        }
    }

    //find a feedback by from user's email
    public async findFeedbacksByFrom(from: string): Promise<(Feedback & nano.Document)[]> {
        let res = await this.db.find({
            selector: {
                from: from,
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return res.docs.map((it) => util.assertDocument(it));
        }
    }


    @ExceptionToResponse
    private async createNewFeedback (
        req: express.Request, res: express.Response
    ): Promise<Response<void>> {
        let me = await UserManager.getCurrentUser(res);
        if (me.uid != req.body.from) {
            throw "You can only submit feedback as yourself";
        }
        await this.createFeedback(req.body);
        return { ok: true };
    }

    @ExceptionToResponse
    private async getFeedbacks(
        req: express.Request, res: express.Response
    ): Promise<Response<Feedback[]>> {
        let from = await UserManager.getCurrentUser(res);
        const response = await this.findFeedbacksByFrom(from.uid);
        return { ok: true, result: response.map((it) => util.sanitizeDocument(it))};
    }

    

    // public async findFeedbackByTo(to: string): Promise<Feedback & nano.Document | undefined> {
    //     let res = await this.db.find({
    //         selector: {
    //             to: to,
    //         }
    //     });
    //     if (res.docs == null || res.docs.length == 0) {
    //         return null;
    //     } else {
    //         return util.assertDocument(res.docs[0]);
    //     }
    // }

}

export default new FeedbackManager();