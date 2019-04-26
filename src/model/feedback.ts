import { default as User } from "../model/user";

//form in this is the email of user who write the feedback.
//to in this is the email of user who this feedback write for.
export default interface Feedback extends FeedbackInfo {
    feedbackId:string, 
}

export interface FeedbackInfo {
    from: string,
    to: string,
    content: string,
}