import { default as Server} from "../server";
import Match from "../model/match";
import nano = require("nano");
import { Gender, State } from "../model/user";
import User from "../model/user";
import user_manager from "./user_manager";
import * as util from "../misc/util";

class MatchManager {
    private db: nano.DocumentScope<Match>;

    constructor() {
        // anything needed?
    }

    private async initializeDb() {
        this.db = await Server.getDatabase("matches");
        await this.db.createIndex({
            index: {
                fields: ["userID1", "userID2"],
            },
            ddoc: "indexMatch",
            name: "indexMatch"
        });
    }

    public async doMatches() {
        this.initializeDb();

        // GAY MALE
        let listMM = await this.getUsers(Gender.Male, Gender.Male);

        // 3. Calculate distances
        // 4. TODO: same for female
        let edgesMM: Edge[];
        await this.calculateDistances(listMM, listMM, edgesMM);

        // 6. For each list, do:
        //      a. pop first edge: new match!
        //      b. add match to the database
        //      c. update the users' status to 'matched'
        //      d. delete all other edges containing either user
        await this.processMatches(edgesMM);
    }

    private async getUsers(gender: Gender, genderPref: Gender) {
        let users = await user_manager.listIdleUsers();

        let pickedUsers: User[];

        users.forEach(user => {
            // pick a user only if it has the right gender and gender preference
            if (user.gender == gender &&
                user.matchingPref.gender == genderPref)
                pickedUsers.push(user);
        });

        return pickedUsers;
    }

    private async calculateDistances(users1: User[], users2: User[], edges: Edge[]) {
        // compare each user from the first group
        users1.forEach(user => {

            // to all users in the second group
            users2.forEach(other => {

                if (this.areMatchable(user, other)) {
                    let edge: Edge = {
                        user1: user.uid,
                        user2: other.uid,
                        weight: this.distance(user, other)
                    }
                    edges.push(edge);
                }
            });
        })
        // 5. Order the list according to weight number
        edges.sort(function(a: Edge, b: Edge) {
            return (a.weight - b.weight);
        });
    }

    private areMatchable(user1: User, user2: User): boolean {
        if (user1.uid == user2.uid)
            return false;
        
        // if user2 is the right age for user1
        if (user1.matchingPref.minAge <= user2.age &&
            user1.matchingPref.maxAge >= user2.age)
            // and user1 is the right age for user2
            if (user2.matchingPref.minAge <= user1.age &&
                user2.matchingPref.maxAge >= user1.age)

                return true;
        // incompatible ages
        return false;
    }

    private distance(user1: User, user2: User): number {
        return Math.sqrt(
            // how good user1 is for user2
            Math.pow(user1.selfAssessment.openness - user2.matchingPref.openness, 2) +
            Math.pow(user1.selfAssessment.romance - user2.matchingPref.romance, 2) +
            Math.pow(user1.selfAssessment.warmheartedness - user2.matchingPref.warmheartedness, 2) +
            // how good user2 is for user1
            Math.pow(user1.matchingPref.openness - user2.selfAssessment.openness, 2) +
            Math.pow(user1.matchingPref.romance - user2.selfAssessment.romance, 2) +
            Math.pow(user1.matchingPref.warmheartedness - user2.selfAssessment.warmheartedness, 2)
        );
    }

    private async processMatches(edges: Edge[]) {
        while (edges.length > 0) {
            // a. pop first edge: new match!
            let bestBet = edges.pop();

            // b. add match to the database
            let match: Match = {
                userID1: bestBet.user1,
                userID2: bestBet.user2,
                date: new Date().getTime(),
                active: true
            };
            let res = await this.db.insert(match);

            // c. update users' status
            user_manager.updateUserStatus(bestBet.user1, State.Matched);
            user_manager.updateUserStatus(bestBet.user2, State.Matched);

            // d. delete all other edges containing either user
            let i = 0;
            while (i < edges.length) {
                if (this.edgeContainsUsers(edges[i], bestBet.user1, bestBet.user2))
                    edges.splice(i, 1)  // delete 1 edge at index i
                else
                    i++;
            }
        }
    }

    private edgeContainsUsers(edge: Edge, user1: string, user2: string) {
        return (edge.user1 == user1 || edge.user1 == user2 ||
                edge.user2 == user1 || edge.user2 == user2)
    }

    private async unmatchExpiredMatches(timeAllowed: number) {
        let res = await this.db.find({
            selector: {
                active: true,
            }
        });
        if (res.docs == null)
            return;
        else {
            // create a list of matches to destroy
            let expiredMatches: Match[] =[];
            let now = new Date().getTime();

            res.docs.forEach((match: Match) => {
                if (now - match.date > timeAllowed)
                    expiredMatches.push(util.assertDocument(match));
            });

            // unmatch those matches
            expiredMatches.forEach(match => this.unMatch(match));
        }
    }


    /////////////// GET ///////////////////////

    public async getUserMatch(uid: string): Promise<Match & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                "$or": [{userID1: uid}, {userID2: uid}],
                active: true,
            }
        });
        if (res.docs == null)
            return null;
        else
            return util.assertDocument(res.docs[0]);
    }

    /////////////// REMOVE / UPDATE ///////////////////////

    public async unMatch(match: Match) {
        let toDelete = await this.db.find({
            selector: {
                userID1: match.userID1,
                userID2: match.userID2,
                date: match.date,
                active: match.active
            }
        });
        
        // make the match inactive
        match.active = false;

        // and update it in the database
        let res = await this.db.insert(match);
        if (!res.ok) {
            throw "Failed to unmatch match in database";
        }

        // also update the state of the users
        user_manager.updateUserStatus(match.userID1, State.Idle);
        user_manager.updateUserStatus(match.userID2, State.Idle);
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

interface Edge {
    user1: string;
    user2: string;
    weight: number;
}