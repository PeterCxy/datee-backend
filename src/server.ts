import express from "express";
import bodyParser from "body-parser";
import nano from "nano";

interface ServerConfig {
    couchdb: string
}

export interface ComponentRouter {
    mountpoint: string // The path prefix of the component
    router: express.Router
}

// A component in our application that is able to
// insert routes into the main controller
export interface Component {
    setupRoutes(): Promise<ComponentRouter>;
}

// Central manager of the entire backend server
class DateeServer {
    private app: express.Express;
    private dbServer: nano.ServerScope;
    private components: Component[] = [];
    constructor(config: ServerConfig) {
        this.app = express();
        this.dbServer = nano(config.couchdb);
    }

    public registerComponent(c: Component) {
        this.components.push(c);
    }

    public async setupRoutes(): Promise<void> {
        // Requests can use JSON encoding
        this.app.use(bodyParser.json());
        // Good old urlencoded POST also accepted
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.get("/hello", (_, res) => {
            res.send("hello!");
        });

        // Register all components to the Express app
        let routers = await Promise.all(
            this.components.map((c) => c.setupRoutes()));
        routers.forEach((r) => {
            this.app.use(r.mountpoint, r.router);
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