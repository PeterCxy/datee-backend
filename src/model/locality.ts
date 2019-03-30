// All supported countries
export enum Countries {
    China = 0,
}

// All supported Cities
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

// All the information
export var CityInfo: {[id: number]: City;} = {};
CityInfo[Cities.Suzhou] = {
    country: Countries.China,
    name: "Suzhou",
    longitude: 120.5853,
    latitude: 31.2990,
}