import {default as Server, ComponentRouter} from "../server";
import {default as Match, Proposal} from "../model/match";
import nano = require("nano");
import { Gender, State } from "../model/user";
import User from "../model/user";
import user_manager from "./user_manager";
import * as util from "../misc/util";
import express = require("express");
import { Response, ExceptionToResponse } from "./shared";

class MatchManager {
    private db: nano.DocumentScope<Match>;

    constructor() {
        // anything needed?
    }

    private async initializeDb() {
        this.db = await Server.getDatabase("matches");
        await this.db.createIndex({
            index: {
                fields: ["userID1", "userID2", "active"],
            },
            ddoc: "indexMatch",
            name: "indexMatch"
        });
    }

    public async setupRoutes(): Promise<ComponentRouter> {
        await this.initializeDb();
        //let multerMiddleware = multer({ storage: multer.memoryStorage() });
        let router = express.Router();
        router.get("/list/:uid", this.getUserMatch.bind(this));
        router.get("/proposals/:uid", this.getProposals.bind(this));   // must provide user id to retrieve the match's proposals
        router.put("/proposals/:uid", this.putProposal.bind(this));
        router.put("/accept/:uid", this.acceptProposal.bind(this));
        return {
            mountpoint: "/match",
            router: router
        };
    }

    private async getProposalsOfMatch(uid: string): Promise<Array<Proposal> | undefined > {
        // quit if any parameter is invalid
        if (user_manager.findUserById(uid) == null) {
            throw "Unknown user";
        }

        let match = await this.getUserMatch(uid);
        return match.dates;
    }

    private async addProposal(uid: string, date: number, location: string): Promise<void> {
        // quit if any parameter is invalid
        if (user_manager.findUserById(uid) == null) {
            throw "Unknown user";
        }
        if (date < new Date().getTime()) {
            throw "Cannot date someone in the past";
        }
        if (date > new Date().getTime() + 1000*60*60*24*14) {
            throw "Cannot set a date more than 2 weeks from now";
        }
        if (location == null) {
            throw "Must pick a location"
        }

        // get the match from database to update
        let match = await this.getUserMatch(uid);
        let p: Proposal;
            p.agreed = false;
            p.madeBy = (match.userID1 == uid) ? 1 : 2;
            p.date = date;
            p.location = location;
        match.dates.push(p);

        // finally update the match object
        let res = await this.db.insert(match);
        if (!res.ok) {
            throw "Unknown database error";
        }
    }

    private async acceptProposalNumber(uid: string, n: number): Promise<boolean> {
        // quit if any parameter is invalid
        if (user_manager.findUserById(uid) == null) {
            throw "Unknown user";
        }
        // get the match from database to update
        let match = await this.getUserMatch(uid);

        // return false if there already is an agreed date
        match.dates.forEach((proposal) => {
            if (proposal.agreed == true) {
                return false;
            }
        })

        // finally update the match object
        match.dates[n].agreed = true;
        let res = await this.db.insert(match);

        if (!res.ok) {
            throw "Unknown database error";
        } else
            return true;
    }

    /**
     * Perform routine matching. This method will automatically break current
     * matches that have expired and match as many people as possible.
     * It works as follows:
     * 0. Unmatch all expired matches [To do later]
     * 1. Retrieve all currently unmatched users
     * 2. Divide them into 4 groups (MF, FM, MM, FF)
     * 3. Create 3 empty lists: listMM, listFF, listMF     * 
     * 4. For each member m in each gay group, do:
     *     a. For each other om member in the same group do:
     *         . calculate edge(m, om) and add it to listMM/FF
     *         . add m to the list of finished users
     * 
     * 5. For each member m in the MF group do:
     *     a. For each member f in the FM group do:
     *         . calculate edge(m, f) and add it to listMF
     * 
     * 6. Order the lists according to the distances
     * 
     * 7. For each list, do:
     *     a. pop first edge: new match!
     *     b. add match to the database
     *     c. update the users' status to 'matched'
     *     d. delete all other edges containing either user
     */
    public async doMatches() {
        await this.initializeDb();
        //await this.unmatchExpiredMatches(60*60*36);   // after 36 hours it is expired
        await this.unmatchExpiredMatches(60); // FOR TESTING: 60 secs and matches expire

        let edges: Edge[] = [];
        let maleUsers: User[] = [];
        let femaleUsers: User[] = [];

        ////////////////////////// GAY MALE ////////////////////
        // retrieve users that need to be matched
        maleUsers = await user_manager.listIdleUsersWithGenders(
            Gender.Male, Gender.Male);

        // generate the graph (stores as edges)
        await this.generateGraph(maleUsers, maleUsers, edges);
        // process the graph and update the database
        await this.processMatches(edges);

        // these are no more needed
        maleUsers = []; edges = [];


        ////////////////////////// GAY FEMALE //////////////////
        femaleUsers = await user_manager.listIdleUsersWithGenders(
            Gender.Female, Gender.Female);

        await this.generateGraph(femaleUsers, femaleUsers, edges);
        await this.processMatches(edges);

        femaleUsers = []; edges = [];


        ////////////////////////// STRAIGHT //////////////////
        femaleUsers = await user_manager.listIdleUsersWithGenders(
            Gender.Female, Gender.Male);
        maleUsers   = await user_manager.listIdleUsersWithGenders(
            Gender.Male, Gender.Female);

        await this.generateGraph(maleUsers, femaleUsers, edges);
        await this.processMatches(edges);
    }

    private async generateGraph(users1: User[], users2: User[], edges: Edge[]) {
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
        // TODO: make this function work with any number of values in the 
        // self assessment, so that it is not necessary to modify this function
        // every time the user model is updated

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
                active: true,
                dates: Array<Proposal>()
            };
            let res = await this.db.insert(match);

            // c. update users' status
            await user_manager.updateUserStatus(bestBet.user1, State.Matched);
            await user_manager.updateUserStatus(bestBet.user2, State.Matched);

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
            for (let match of expiredMatches) {
                await this.unMatch(match);
            }
        }
    }


    /////////////// GET //////////////////////////////////

    public async getUserMatch(uid: string): Promise<Match & nano.Document | undefined> {
        let res = await this.db.find({
            selector: {
                $or: {   // pick matches whose first or second user matches
                    userID1: uid, 
                    userID2: uid
                },
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
        await user_manager.updateUserStatus(match.userID1, State.Idle);
        await user_manager.updateUserStatus(match.userID2, State.Idle);
    }

    @ExceptionToResponse
    private async putProposal(
        req: express.Request, 
        res: express.Response
    ): Promise<Response<void>> {
        await this.addProposal(
            req.params["uid"],
            Number.parseInt(req.body["date"]),
            req.body["location"]
        );
        return { ok: true };
    }

    @ExceptionToResponse
    private async getProposals(
        req: express.Request, 
        res: express.Response
    ): Promise<Response<Array<Proposal>>> {
        await this.getProposalsOfMatch(
            req.params["uid"]
        );
        return { ok: true };
    }

    @ExceptionToResponse
    private async acceptProposal(
        req: express.Request, 
        res: express.Response
    ): Promise<Response<boolean>> {
        await this.acceptProposalNumber(
            req.params["uid"],
            req.body["proposalNumber"]
        );
        return { ok: true };
    }
}

interface Edge {
    user1: string;
    user2: string;
    weight: number;
}

export default new MatchManager();