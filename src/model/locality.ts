// All supported countries
export const NUM_CONTRY = 1;
export enum Countries {
    China = 0,
}

// All supported Cities
export const NUM_CITY = 1;
export enum Cities {
    Suzhou = 0,
}

// City information
export interface City {
    country: Countries
    name: string
    longitude: number
    latitude: number
}