import Server from "./server";
import "./controller/index";

// Just load the server :)
Server.setupRoutes().then(() => {
    Server.listen(23456);
});