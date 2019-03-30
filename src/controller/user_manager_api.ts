import { Response } from "./shared";
import { UserInfo } from "../model/user";

// Parameters for "/resgiter". Extended from basic UserInfo
export interface RegisterInfo extends UserInfo {
    // A password BEFORE hashing
    password: string
}

export default interface UserManagerAPI {
    '/register': {
        PUT: {
            params: {},
            query: {},
            body: RegisterInfo,
            response: Response<void>
        }
    }
}