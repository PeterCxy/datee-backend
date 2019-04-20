import cluster from "cluster";
import os from "os";
import Server from "./server";
import "./controller/index";

// Spawn several worker processes to distribute the load
// This is needed because some of our computation might block
// Note: Anything here inside our program SHOULD NOT
//       DEPEND ON any internal memory state. Everything
//       should be based on something in the database
//       and should be written back to the database
//       ASAP.
if (cluster.isMaster) {
    for (let i = 0; i < os.cpus().length; i++) {
        cluster.fork();
    }
} else {
    // Just load the server :)
    Server.setupRoutes().then(() => {
        Server.listen(23456);
    });
}