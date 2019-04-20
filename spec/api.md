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

### Photo Upload

Endpoint: `/photos/upload`  
Method: `PUT`  
Authentication: Required  
Parameters:

This request should be of type `multipart/form-data` (the way we upload files by forms). The only parameter should be the content of the file, with name `photo`.

Notes:

The MIME type of the uploaded file must be `image/*`, otherwise it will be rejected.

If the user uploads more than `MAX_PHOTOS_PER_USER` photos, then any future uploads will be rejected.

If the user's state is `Registered` and uploaded more than `MIN_PHOTOS_PER_USER` photos, then the state will be updated to `PhotoUploaded`.

Response:

```json
{
    "ok": true,
    "result": {
        "id": "<photo id>",
        "uid": "<user id>"
    }
}
```

### Photo Listing

Endpoint: `/photos/list/<uid>`  
Method: `GET`  
Parameters: None  
Authentication: Required  
Note:

Replace `<uid>` with the target user ID.

Response:

```json
{
    "ok": true,
    "result": ["<photo id 1>", "<photo id 2>", ...]
}
```

### Photo Fetching

Endpoint: `/photos/<id>`  
Method: `GET`  
Parameters: None  
Authentication: Required  
Notes:

Replace `<id>` with the ID of the photo to fetch

Response: The binary file data of the photo. MIME type is set in the header, so we don't need to determine file type from extension.

### Photo Deleting

Endpoint: `/photos/<id>`  
Method: `DELETE`  
Parameters: None  
Authentication: Required  
Notes:

Replace `<id>` with the ID of the photo to delete.

Please note that a user cannot delete any more photos when the number of photos has reached the minimum. Use replace instead.

Response: ok or not.

### Photo Replacing

Endpoint: `/photos/<id>`  
Method: `PATCH`  
Authentication: Required  
Parameters:

This request should be of type `multipart/form-data` (the way we upload files by forms). The only parameter should be the content of the file, with name `photo`.

Notes:

Replace `<id>` with the ID of the photo to replace.

Replacing a photo = Deleting + Re-uploading, without the limitation that the user cannot delete any photo when the number of photos have reached the minimum.

Note that the photo ID WILL CHANGE after this method.

Response:

```json
{
    "ok": true,
    "result": {
        "id": "<photo id>",
        "uid": "<user id>"
    }
}
```

### Self Assessment / Matching Preferences

Endpoint: `/user/self_assessment` / `/user/matching_pref`  
Method: `PUT`  
Authentication: Required  
Parameters: See `src/model/user.ts` for details  
Return: ok or not

### Rate another user

Endpoint: `/rate/<uid>`  
Method: `PUT`  
Authentication: Required  
Parameters: `score=<score>` ([1, 5])  
Return: ok or not

### Get self rated score

Endpoint: `/rate/my`  
Method: `GET`  
Authentication: Required  
Return:

```json
{
    "ok": true,
    "result": <rating_score>
}
```

---
Admin APIs
---

Admin API endpoints are located in `/admin` and require authentication via the `admin_token` in `config.json`. The token should be provided in the `Authorization` header field.

### Account Approval

Endpoint: `/admin/activate`  
Method: `POST`  
Parameters: `uid=<user_id>`  
Return: ok or not

### Matching Trigger

Endpoint: `/admin/do_match`  
Method: `GET`  
Parameters: None  
Return: ok or not  
Note: This is the trigger for the matching algorithm. This should be triggered by some timer to ensure it runs and only runs once per day.