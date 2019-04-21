import { default as Server, Component, ComponentRouter } from "../server";
import Match from "../model/match";
import nano = require("nano");
import * as util from "../misc/util";
import { State } from "../model/user";
import { MatchingPreference } from "../model/user";
import { Gender } from "../model/user";
import User from "../model/user";

class MatchManager {
    private db_matches: nano.DocumentScope<Match>;
    private db_users: nano.DocumentScope<User>;

    constructor() {
        // anything needed?
    }

    private async initializeDbs() {
        this.db_matches = await Server.getDatabase("matches");
        await this.db_matches.createIndex({
            index: {
                // TODO: review this
                fields: ["userID1", "userID2", "date", "active"],
            },
            ddoc: "indexMatch",
            name: "indexMatch"
        });

        this.db_users = await Server.getDatabase("matches");
        await this.db_users.createIndex({
            index: {
                fields: ["uid", "email", "state"],
            },
            ddoc: "indexMatch",
            name: "indexMatch"
        });
    }

    public async doMatches() {
        this.initializeDbs();

        // 1. Retrieve all currently unmatched users
        //      AND
        // 2. Separate them into 4 groups
        let listMM = this.getUsers(Gender.Male, Gender.Male);
        let listFF = this.getUsers(Gender.Female, Gender.Female);
        let listMF = this.getUsers(Gender.Male, Gender.Female);
        let listFM = this.getUsers(Gender.Female, Gender.Male);

        // calculate distances

        // TODO: process one list at a time
    }

    private async getUsers(gender: Gender, genderPref: Gender) {
        let users = await this.db_users.find({
            selector: {
                gender: gender,
                state: State.Idle
            }
        });

        if (users.docs == null || users.docs.length == 0) {
            return null;
        } else {
            let pickedUsers: User[];

            users.docs.forEach(user => {
                if (user.matchingPref.gender == genderPref)
                    pickedUsers.push(user);
            });

            return pickedUsers;
        }
    }
    

/*  To do the match do the following:

    0. Unmatch all expired matches [To do later]
    1. Retrieve all currently unmatched users
    2. Divide them into 4 groups (MF, FM, MM, FF)
    3. Create 3 empty lists: listMM, listFF, listMF

    3.Note: edge are objects of type {
        user1: string,
        user2: string,
        distance: int,
    }

    3. For each member m in each gay group, do:
        a. For each other om member in the same group do:
            . calculate edge(m, om) and add it to listMM/FF
            . add m to the list of finished users

    4. For each member m in the MF group do:
        a. For each member f in the FM group do:
            . calculate edge(m, f) and add it to listMF
    
    5. Order the lists according to the distances

    6. For each list, do:
        a. pop first edge: new match!
        b. add match to the database
        c. update the users' status to 'matched'
        d. delete all other edges containing either user
*/
}