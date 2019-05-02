export default interface Match {
    userID1: string,
    userID2: string,
    // when the match was set
    date: number,
    // to reduce calulations with times. Flag is true if the match happened less than 24h ago
    active: boolean,    
    // list of potential dates proposed by the two
    dates: Date[]
}

export interface Date {
    // 1 or 2, the user who proposed it
    madeBy: number,
    // time of the meeting
    date: number,
    // location of the meeting
    location: string,
    // true if the other user agrees on it. Only 1 date can be agreed on
    agreed: boolean
}