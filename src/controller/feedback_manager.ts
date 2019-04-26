import { default as Server, Component, ComponentRouter } from "../server";
import { Response, ExceptionToResponse } from "./shared";
import AuthManager from "./auth_manager";
import { default as Feedback, FeedbackInfo }from "../model/feedback"
import user_manager from "./user_manager";
import { default as User, UserInfo, State, UserTraits,
    SelfAssessment, MatchingPreference, Gender } from "../model/user";
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
        // Registration doesn't need to be authenticated
        AuthManager.excludePath("/feedback/newFeedback");
        AuthManager.excludePath("/feedback/get");
        router.post("/newFeedback", this.CreateNewFeedback.bind(this));
        router.get("/get",this.GetFeedbacks.bind(this));
        return {
            mountpoint: "/feedback",
            router: router
        };
    }

    //find a feedback by feedbackid
    
    
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

    public async findFeedbackByUser(from: string,to: string): Promise<Feedback & nano.Document | undefined> {
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

    public async CreateFeedback(info:FeedbackInfo):Promise<void> {
        if ((await this.findFeedbackByUser(info.from, info.to)) != null) {
            throw "Feedback already exists";
        }
        if(info.content==null){
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
    public async findFeedbacksByFrom(from: string): Promise<Feedback & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                from: from,
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return util.assertDocument(res.docs[0]);
        }
    }


    @ExceptionToResponse
    private async CreateNewFeedback (
        req: express.Request,
    ): Promise<Response<void>> {
        // Errors will be thrown directly from checkProperties()
        // here we use if just to trick TypeScript to make the
        // type assertion work.
        await this.CreateFeedback(req.body);
        return { ok: true };
    }

    @ExceptionToResponse
    private async GetFeedbacks(
        req: express.Request,
    ): Promise<Response<Feedback>> {
        const response = await this.findFeedbacksByFrom(req.body.from);
        console.log(response);
        return { ok: true, result: response};
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