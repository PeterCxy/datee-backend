Dat.ee API Specification (Work in Progress)
===

All POST/PUT APIs accept either urlencoded form data or JSON objects. The response is always a JSON object.

### Hello World

Endpoint: `/hello`  
Method: `GET`  
Parameters: None  
Authentication: Required  
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

### Authentication (Log-in)

Endpoint: `/auth/token`  
Method: `POST`  
Description:

We use the well-established OAuth 2.0 authentication scheme here for security reasons. See [RFC6750](https://tools.ietf.org/html/rfc6750) for details. The parameter we use here (possibly) should be `client_id` `client_secret` `scope=default` `grant=password/refresh_token` `username` `password` `refresh_token`.

On log-in, the client should ask the user for `username` / `password` and then request the server using `grant=password` for an `accessToken` and `refreshToken`. Once received, the `accessToken` MUST be added to the `Authorization` HTTP header of all the subsequent requests to authorize for protected APIs that require log-in. The header should look like `Authorization: Bearer <accessToken>`.

Both the `accessToken` and the `refreshToken` has a limited lifetime, while `accessToken` lives much shorter (24 hours). The client is informed of the expiry time of `accessToken` but (important!) NOT `refreshToken`, so that the client can refresh the token on time. When the client starts and initializes, if the `accessToken` is no longer valid but it still has a `refreshToken`, the client can try to use `grant=refresh_token` and `refresh_token=<refreshToken>` to generate a new pair of `accessToken` and `refreshToken`. If both are no longer valid (server refuses to grant new `accessToken` using `refreshToken`), the client should ask the user to do log-in again.

Response:

```json
{
    "access_token":"<some_token>",
    "token_type":"Bearer",
    "expires_in":<seconds>,
    "refresh_token":"<some_token>",
    "scope":"default"
}
```

On failure:

```json
{
    "error":"blahblah",
    "error_description":"blahblahblah"
}
```

### Whoami

Endpoint: `/user/whoami`  
Method: `GET`  
Authentication: Required  

Response:

```json
{
    "ok":true,
    "result":{
        "uid":"some-user-id",
        "email":"some_email@example.com",
        "firstName":"San",
        "lastName":"Zhang",
        "age":18,
        "gender":0,
        "country":0,
        "city":0,
        "state":0
    }
}
```

The meaning of all the fields in `result` are already described above in the `Register` API.