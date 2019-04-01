import { Client } from "oauth2-server";

// A model to be loaded from configuration file
// representing all allowed OAuth clients.
export default interface OAuthClients {
    [id: string]: {
        secret: string,
        client: Client
    }
}