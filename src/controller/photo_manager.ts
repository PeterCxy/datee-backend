import { default as Server, Component, ComponentRouter } from "../server";
import { Response, ExceptionToResponse } from "./shared";
import UserManager from "./user_manager";
import { default as User, State } from "../model/user";
import * as util from "../misc/util";
import nano from "nano";
import express from "express";
import multer from "multer";
import uuid from "uuid/v4";

const MAX_PHOTOS_PER_USER = 10;
const MIN_PHOTOS_PER_USER = 3;

export interface Photo {
    id: string, // The ID of the photo
    uid: string, // The user the photo belongs to
}

/**
 * This `PhotoManager` is responsible for managing profile photos
 * uploaded by users. It is also responsible for updating the state
 * of the corresponding user to PhotoUploaded if the number of photos
 * meets the requirements.
 */
class PhotoManager implements Component {
    private db: nano.DocumentScope<Photo>;
    constructor() {
        Server.registerComponent(this);
    }

    private async initializeDb(): Promise<void> {
        this.db = await Server.getDatabase("photos");
        await this.db.createIndex({
            index: {
                fields: ["id", "uid"]
            },
            ddoc: "indexPhotos",
            name: "indexPhotos"
        });
    }

    public async setupRoutes(): Promise<ComponentRouter> {
        await this.initializeDb();
        let multerMiddleware = multer({ storage: multer.memoryStorage() });
        let router = express.Router();
        router.put("/upload", multerMiddleware.single('photo'), this.uploadPhoto.bind(this));
        router.get("/list/:uid", this.listPhotos.bind(this));
        router.get("/:id", this.streamPhoto.bind(this));
        return {
            mountpoint: "/photos",
            router: router
        };
    }

    public async getPhotosForUser(uid: string): Promise<(Photo & nano.Document)[]> {
        let res = await this.db.find({
            selector: {
                uid: uid
            }
        });
        if (res.docs == null) {
            return [];
        } else {
            let ret: (Photo & nano.Document)[] = [];
            for (var item of res.docs) {
                ret.push(util.assertDocument(item));
            }
            return ret;
        }
    }

    // Find a Photo object by its ID.
    // This function is only used internally.
    // Nothing outside this class would want to use this at all.
    private async findPhotoById(id: string): Promise<Photo & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                id: id
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return util.assertDocument(res.docs[0]);
        }
    }

    public async addPhoto(user: User & nano.Document, photo: Buffer, mime: string): Promise<Photo & nano.Document> {
        if ((await this.getPhotosForUser(user.uid)).length >= MAX_PHOTOS_PER_USER) {
            throw "User has too much photos";
        }

        // Generate UUID
        let id;
        do {
            id = uuid();
        } while ((await this.findPhotoById(id)) != null);

        let res = await this.db.insert({
            id: id,
            uid: user.uid
        });
        if (!res.ok) {
            throw "Cannot create new document in database";
        }

        let res2 =
            await this.db.attachment.insert(res.id, "photo", photo, mime, { rev: res.rev });
        if (!res2.ok) {
            throw "Cannot insert attachment into database";
        }

        // Check the minimum required photos
        // Update state if the user is `Registered` and just uploaded photo.
        if (user.state == State.Registered && 
            (await this.getPhotosForUser(user.uid)).length >= MIN_PHOTOS_PER_USER) {
            // The user state can now be changed to PhotoUploaded
            user.state = State.PhotoUploaded;
            user = await UserManager.updateUser(user);
        }

        return await this.findPhotoById(id);
    }

    // Users can only upload photos for themselves
    @ExceptionToResponse
    private async uploadPhoto(
        req: express.Request, res: express.Response
    ): Promise<Response<Photo>> {
        // If no file, or field name is wrong,
        // or the MIME type indicates a non-picture,
        // throw an error.
        if (!req.file || !req.file.mimetype.startsWith("image/")) {
            throw "Request must contain exactly one photo file";
        }
        let user = await UserManager.getCurrentUser(res);
        let photo = await this.addPhoto(user, req.file.buffer, req.file.mimetype);
        return { ok: true, result: util.sanitizeDocument(photo) };
    }

    @ExceptionToResponse
    private async listPhotos(req: express.Request): Promise<Response<string[]>> {
        let photos = await this.getPhotosForUser(req.params["uid"]);
        return { ok:true, result: photos.map((val) => val.id)};
    }

    // Not a trivial API, we stream the resulting photo to the client
    // Therefore we need to use the good ol' express APIs
    // Note: any authenticated user can request for any photo as long
    // as the ID is already known.
    private async streamPhoto(
        req: express.Request, res: express.Response
    ): Promise<void> {
        try {
            let photo = await this.findPhotoById(req.params["id"]);
            this.db.attachment.getAsStream(photo._id, "photo")
                .pipe(res);
        } catch (err) {
            res.sendStatus(404);
        }
    }
}

export default new PhotoManager();