import express from "express";
import bodyParser from "body-parser";
import nano from "nano";

interface ServerConfig {
    couchdb: string
}

// Central manager of the entire backend server
class DateeServer {
    private app : express.Express;
    private dbServer : nano.ServerScope;
    constructor(config: ServerConfig) {
        this.app = express();
        this.dbServer = nano(config.couchdb);
    }

    public setupRoutes() {
        // Requests can use JSON encoding
        this.app.use(bodyParser.json());
        // Good old urlencoded POST also accepted
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.get("/hello", (_, res) => {
            res.send("hello!");
        });
    }

    public listen(port: number) {
        this.app.listen(port, () => {
            console.log("Dat.ee backend server is up and running at " + port);
        });
    }

    // Get a database object from CouchDB
    // If it does not exist, this will create the corresponding db
    public async getDatabase<T>(name: string): Promise<nano.DocumentScope<T>> {
        let databases = await this.dbServer.db.list();
        if (databases.indexOf(name) < 0) {
            let resp = await this.dbServer.db.create(name);
            if (!resp.ok) {
                throw `Cannot create database ${name}`;
            }
        }
        return this.dbServer.db.use(name);
    }
}

// Export an singleton for use
export default new DateeServer(require('../config.json'));