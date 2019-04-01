import { default as Server, Component, ComponentRouter, AuthHandler } from "../server";
import OAuthClients from "../model/oauth_client";
import UserManager from "./user_manager";
import * as util from "../misc/util";
import { Token, PasswordModel, RefreshTokenModel,
    RefreshToken, Client, User as OAuthUser } from "oauth2-server";
import OAuthServer from "express-oauth-server";
import nano from "nano";
import express from "express";

// Exhaustive list of API paths that are excluded from authentication
const AUTH_EXCLUDED_PATHS = [
    "/user/register",
    "/auth/token"
];

/**
 * OAuth implementation of Dat.ee. Users are authenticated by
 * email + password, where all the `username` in the OAuth2
 * authentication model are actually emails. Client id and
 * secrets are statically allocated and stored in `config.json`
 * which are not checked into this repository.
 * This component also registers itself as a `AuthHandler`
 * and installs the OAuth authentication middleware into
 * the express server before anything else is inserted.
 * This way the authentication can be enforced.
 * Note: All "OAuthUser" objects here are just UIDs instead
 *       of real `User` objects.
 */
class AuthManager implements Component, AuthHandler {
    private db: nano.DocumentScope<Token>;
    private authServer: OAuthServer;
    // OAuth2 model implementing the password grant
    private authModel = new class implements PasswordModel, RefreshTokenModel {
        private clients: OAuthClients;
        constructor(private outer: AuthManager) {
            this.clients = Server.getConfig().oauth_clients;
        }

        public async getUser(
            username: string, password: string,
        ): Promise<OAuthUser | null> {
            let user = await UserManager.verifyUserLogin(username, password);
            if (user) {
                return { id: user.uid };
            } else {
                return null;
            }
        }

        public async validateScope?(
            user: OAuthUser, client: Client, scope: string | string[],
        ): Promise<string | null> {
            if (typeof scope != "string") {
                scope = scope[0];
            }
            // Only "default" scope is used
            if (scope === "default") {
                return scope;
            } else {
                return null;
            }
        }

        public async getClient(
            clientId: string, clientSecret: string,
        ): Promise<Client | null> {
            if (!this.clients[clientId] || this.clients[clientId].secret !== clientSecret) {
                return null;
            } else {
                return this.clients[clientId].client;
            }
        }

        public async saveToken(
            token: Token, client: Client, user: OAuthUser,
        ): Promise<Token | null> {
            // I don't know why the library doesn't do this for us
            // just assign the user / client to the token object
            token.user = user;
            token.client = client;
            try {
                await this.outer.createToken(token);
            } catch (err) {
                return null;
            }
            return token;
        }

        public async getAccessToken(
            accessToken: string
        ): Promise<Token | null> {
            try {
                return await this.outer.findTokenById(accessToken);
            } catch (err) {
                return null;
            }
        }

        public async verifyScope(
            token: Token, scope: string | string[]
        ): Promise<boolean> {
            if (typeof scope != "string") {
                scope = scope[0];
            }
            // Only "default" scope is used
            return scope === "default";
        }

        public async getRefreshToken(
            refreshToken: string
        ): Promise<RefreshToken | null> {
            try {
                let token = await this.outer.findTokenByRefreshToken(refreshToken);
                if (!this.outer.isRefreshToken(token)) {
                    return null;
                }
                return token;
            } catch (err) {
                return null;
            }
        }

        public async revokeToken(
            token: RefreshToken | Token
        ): Promise<boolean> {
            try {
                // This actually DELETEs the original access token with the
                // revocation of refresh token, but this should be fine
                // since nobody would be using the original access token
                // any more.
                await this.outer.deleteTokenByRefreshToken(token.refreshToken);
                return true;
            } catch (err) {
                return false;
            }
        }
    }(this);

    constructor() {
        Server.registerComponent(this);
        Server.registerAuthHandler(this);
        this.authServer = new OAuthServer({
            model: this.authModel,
            accessTokenLifetime: 60 * 60 * 24, // 24 hrs
        });
    }

    public async setupRoutes(): Promise<ComponentRouter> {
        this.db = await Server.getDatabase("tokens");
        let expressRouter = express.Router();
        expressRouter.use("/token", this.authServer.token());
        return {
            mountpoint: "/auth",
            router: expressRouter
        };
    }

    public getAuthMiddleware(): express.RequestHandler {
        let authenticationMiddleware = this.authServer.authenticate();
        return (req, res, next) => {
            if (AUTH_EXCLUDED_PATHS.indexOf(req.path) >= 0) {
                // Some paths do not need authentication at all
                return next();
            } else {
                return authenticationMiddleware(req, res, next);
            }
        }
    }

    // Determine if a token contains refresh token
    public isRefreshToken(token: any): token is RefreshToken {
        return 'refreshToken' in token;
    }

    private deserializeToken(token: Token): Token {
        // The dates cannot be deserialized from JSON automatically. We do it manually.
        if (token.accessTokenExpiresAt) {
            token.accessTokenExpiresAt = new Date(token.accessTokenExpiresAt);
        }
        if (token.refreshTokenExpiresAt) {
            token.refreshTokenExpiresAt = new Date(token.refreshTokenExpiresAt);
        }
        return token;
    }

    // Retrieve a full `Token` from database by its id `accessToken`
    public async findTokenById(accessToken: string): Promise<Token & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                accessToken: accessToken
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return util.assertDocument(this.deserializeToken(res.docs[0]));
        }
    }

    // Retrieve a full `Token` from database by the `refreshToken`
    public async findTokenByRefreshToken(refreshToken: string): Promise<Token & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                refreshToken: refreshToken
            }
        });
        if (res.docs == null || res.docs.length == 0) {
            return null;
        } else {
            return util.assertDocument(this.deserializeToken(res.docs[0]));
        }
    }

    // Remove a token by its refresh token
    public async deleteTokenByRefreshToken(refreshToken: string): Promise<void> {
        let token = await this.findTokenByRefreshToken(refreshToken);
        if (token == null) {
            throw "Token not found";
        }
        let res = await this.db.destroy(token._id, token._rev);
        if (!res.ok) {
            throw "Failed to delete from database";
        }
    }

    // Insert a new token into database.
    // Errors are thrown if happened.
    public async createToken(token: Token): Promise<void> {
        if ((await this.findTokenById(token.accessToken)) != null) {
            throw "Token already exists";
        }

        let res = await this.db.insert(token);
        if (!res.ok) {
            throw "Failed to insert into database";
        }
    }
}

export default new AuthManager();