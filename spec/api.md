Dat.ee API Specification (Work in Progress)
===

All POST/PUT APIs accept either urlencoded form data or JSON objects. The response is always a JSON object.

### Hello World

Endpoint: `/hello`  
Method: `GET`  
Parameters: None  
Returns:  

> hello

### Register

Endpoint: `/user/register`
Method: `PUT`
Parameters:

```
email: string
password: string
firstName: string
lastName: string
age: number
gender: Gender (a number, 0 for male and 1 for female)
country: Countries (currently only 0 for China is available)
city: Cities (currently only 0 for Suzhou is available)
```

Returns:

```
ok: boolean
reason: string // If not OK
```