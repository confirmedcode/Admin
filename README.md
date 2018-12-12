# Admin Server

This is a private Node.js Express server that hosts the Admin dashboard at `https://admin.[domain]`. It initializes the database, generates the source and client certificates, and other admin actions. Its Security Group restricts its access to one specific whitelisted IP. Most actions are logged and many actions, such as signin or signup, send email alerts to the administrator.

- [Prerequisites](#prerequisites)
- [Database Initialization](#database-initialization)
- [Sign In](#sign-in)
  * [Sign In - Web](#sign-in---web)
  * [Sign In](#sign-in-1)
  * [Log Out (Delete Session)](#log-out--delete-session-)
- [Create Admin User](#create-admin-user)
  * [Create Admin User With Email - Web](#create-admin-user-with-email---web)
  * [Create Admin User With Email](#create-admin-user-with-email)
  * [Confirm Admin Email to Complete Email Signup](#confirm-admin-email-to-complete-email-signup)
  * [Resend Confirmation Email - Web](#resend-confirmation-email---web)
  * [Resend Confirmation Email](#resend-confirmation-email)
- [Admin](#admin)
  * [Admin Dashboard Home - Web](#admin-dashboard-home---web)
  * [Admin Dashboard Clients - Web](#admin-dashboard-clients---web)
  * [Admin Dashboard Source Management - Web](#admin-dashboard-source-management---web)
  * [Admin Dashboard Suricata Management - Web](#admin-dashboard-suricata-management---web)
  * [Admin Dashboard Database Management - Web](#admin-dashboard-database-management---web)
  * [Change Admin User Password - Web](#change-admin-user-password---web)
  * [Change Admin User Password](#change-admin-user-password)
- [Source Management](#source-management)
  * [Allow/Disallow Access to Server Certificate](#allow-disallow-access-to-server-certificate)
  * [Retrieve Server Certificate (for VPN Bringup)](#retrieve-server-certificate--for-vpn-bringup-)
  * [New Source Certificiate](#new-source-certificiate)
  * [Set Current Source](#set-current-source)
  * [Get Unassigned Certificates](#get-unassigned-certificates)
  * [Generate Certificates](#generate-certificates)
- [User Tools](#user-tools)
  * [Delete User With Email](#delete-user-with-email)
  * [Delete User With ID](#delete-user-with-id)
- [Suricata](#suricata)
  * [Save Suricata Rule](#save-suricata-rule)
- [Client - Upload/Modify Clients](#client---upload-modify-clients)
  * [Upload Mac/PC Client or Update Files](#upload-mac-pc-client-or-update-files)
  * [Modify Client Distribution Percentages](#modify-client-distribution-percentages)
- [Database - Postgres Command](#database---postgres-command)
  * [Run Logged Postgres Command](#run-logged-postgres-command)
- [Redis - Redis Brute Force](#redis---redis-brute-force)
  * [Get Brute Force counts for an IP](#get-brute-force-counts-for-an-ip)
  * [Clear Brute Force counts for an IP](#clear-brute-force-counts-for-an-ip)
- [Other APIs](#other-apis)
  * [Test Error Logging](#test-error-logging)
  * [Health Check](#health-check)
- [Support](#support)

## Prerequisites

* Run the Admin [CloudFormation](https://github.com/confirmedcode/Server-CloudFormation) and all its prerequisites

## Database Initialization
Before running anything, you must initialize the database:
```
GET /?initialize=true
```

## Sign In

The `POST /signin` API returns a session cookie. Use the cookie on requests that require authentication. Usually, your HTTP request framework will automatically save this cookie. If the cookie expires or server returns 401, request a new cookie.

### Sign In - Web
__Request__

```
GET /signin
```

### Sign In
__Request__

```
POST /signin
```

Name | Type | Description
--- | --- | ---
`email` | `string` | __Required__ User email.
`password` | `string` | __Required__ User password.

__Response__

```
Set-Cookie: <Cookie with Expiration Time>
```

### Log Out (Delete Session)
__Request__
```
GET /logout
```

__Response__

```
Redirects to /signin
```

## Create Admin User

### Create Admin User With Email - Web
__Request__

```
GET /signup
```

### Create Admin User With Email
__Request__

```
POST /signup
```

Name | Type | Description
--- | --- | ---
`email` | `string` | __Required__ Email to use to create the user.
`password` | `string` | __Required__ User password.

__Response__

```
Redirect to /signup-success
```

### Confirm Admin Email to Complete Email Signup
__Request__

```
GET /confirm-email
```

Name | Type | Description
--- | --- | ---
`code` | `string` | __Required__ Code that confirms a user is the owner of an email address to complete email signup.

__Response__

```
Redirect to /signin
```

### Resend Confirmation Email - Web
__Request__

```
GET /resend-confirm-code
```

### Resend Confirmation Email
__Request__

```
POST /resend-confirm-code
```

Name | Type | Description
--- | --- | ---
`email` | `string` | __Required__ Email to resend confirmation code to.

__Response__

```
Redirect to /signin
```

## Admin

### Admin Dashboard Home - Web
__Request__

`Authentication Required`

```
GET /admin
```

### Admin Dashboard Clients - Web
__Request__

`Authentication Required`

```
GET /clients
```

### Admin Dashboard Source Management - Web
__Request__

`Authentication Required`

```
GET /sources
```

### Admin Dashboard Suricata Management - Web
__Request__

`Authentication Required`

```
GET /suricata
```

### Admin Dashboard Database Management - Web
__Request__

`Authentication Required`

```
GET /database
```

### Change Admin User Password - Web
__Request__

`Authentication Required`

```
GET /change-password
```

### Change Admin User Password
__Request__

`Authentication Required`

```
POST /change-password
```

Name | Type | Description
--- | --- | ---
`currentPassword` | `string` | __Required__ User's current password.
`newPassword` | `string` | __Required__ User's new password.

__Response__

```
Redirect to /admin
```
## Source Management

### Allow/Disallow Access to Server Certificate
__Request__

`Authentication Required`

```
POST /toggle-secret
```

__Response__

```
Certificate Secret API toggled.
```

### Retrieve Server Certificate (for VPN Bringup)
__Request__

`Authentication by CERT_ACCESS_SECRET Required`

`toggle-secret` must be used to ensure that secret access is allowed.

IP address must be internal network `172.16.0.0/12`.

```
POST /get-server-certificate
```

Name | Type | Description
--- | --- | ---
`secret` | `string` | __Required__ CERT_ACCESS_SECRET from CloudFormation bringup.
`id` | `string` | __Required__ The ID of the source you want to download the certificates for.

__Response__

```
{
	cacert: <utf-8>,
	servercert: <utf-8>,
	serverkey: <utf-8>
}
```

### New Source Certificiate
__Request__

`Authentication Required`

```
POST /new-source
```

Name | Type | Description
--- | --- | ---
`id` | `string` | __Required__ The ID of the source you want to create.

__Response__

```
Source created successfully
```

### Set Current Source
__Request__

`Authentication Required`

```
POST /set-current-source
```

Name | Type | Description
--- | --- | ---
`id` | `string` | __Required__ The ID of the source you want to set as current source.

__Response__

```
Current source set successfully.
```

### Get Unassigned Certificates
__Request__

`Authentication Required`

```
POST /get-unassigned-certificates
```

Name | Type | Description
--- | --- | ---
`id` | `string` | __Required__ The ID of the source you want to get the number of unassigned certificates for.

__Response__

```
{
	count: [number of unassigned certs for this source]
}
```

### Generate Certificates
__Request__

`Authentication Required`

```
POST /get-unassigned-certificates
```

Name | Type | Description
--- | --- | ---
`id` | `string` | __Required__ The ID of the source you want to generate certificates for.
`num` | `number` | __Required__ The number of certificates you want to generate.

__Response__

```
Certificate generation started.
```

## User Tools

### Delete User With Email
__Request__

`Authentication Required`

```
POST /delete-user-with-email
```

Name | Type | Description
--- | --- | ---
`email` | `string` | __Required__ User's email.
`reason` | `string` | __Required__ Reason for deletion.
`banned` | `boolean` | Mark user as banned (abusive behavior). Defaults to `false`.

__Response__

```
{
	message: "Deleted user successfully"
}
```
### Delete User With ID
__Request__

`Authentication Required`

```
POST /delete-user-with-email
```

Name | Type | Description
--- | --- | ---
`id` | `string` | __Required__ User's id.
`reason` | `string` | __Required__ Reason for deletion.
`banned` | `boolean` | Mark user as banned (abusive behavior). Defaults to `false`.

__Response__

```
{
	message: "Deleted user successfully"
}
```

## Suricata

### Save Suricata Rule
__Request__

`Authentication Required`

```
POST /save-rule
```


Name | Type | Description
--- | --- | ---
`ruleFile` | `string` | __Required__ Name of suricata rulefile (e.g, "disabled.conf")
`ruleContent` | `string` | __Required__ Contents of rulefile.

__Response__

```
Rule file saved successfully.
```


## Client - Upload/Modify Clients

### Upload Mac/PC Client or Update Files
__Request__

`Authentication Required`

```
POST /upload-client
```

Name | Type | Description
--- | --- | ---
`type` | `string` | __Required__ `mac-app`, `mac-update`, `windows-app`, or `windows-update`
`file` | `file` | __Required__ The file being uploaded.

__Response__

```
Redirect to /admin with message "Upload Successful".
```

### Modify Client Distribution Percentages
__Request__

`Authentication Required`

```
POST /modify-percent
```

Key-Value pairs where Key is the S3 Key (full path) and Value is the Percent. Percents must add up to 100.
For example:

```
{
	"mac-app/affeefff1/30/mac-app-1.zip" : 40,
	"mac-app/affeefff1/70/mac-app-2.zip" : 60
}
```

__Response__

```
Redirect to /admin with message "Percent change successful".
```

## Database - Postgres Command

### Run Logged Postgres Command
The query itself will be logged to a CloudWatch Log Group called PostgresQueries. The result is not logged.
 
__Request__

`Authentication Required`

```
POST /postgres-command
```

Name | Type | Description
--- | --- | ---
`command` | `string` | __Required__ Postgres query to run.

__Response__

```
Displays the query result onscreen.
```

## Redis - Redis Brute Force

### Get Brute Force counts for an IP
__Request__

`Authentication Required`

```
POST /get-brute
```

Name | Type | Description
--- | --- | ---
`ip` | `string` | __Required__ IP address to look up

__Response__

```
Brute force counts
```

### Clear Brute Force counts for an IP
__Request__

`Authentication Required`

```
POST /clear-brute
```

Name | Type | Description
--- | --- | ---
`ip` | `string` | __Required__ IP address to clear

__Response__

```
# Brute Entries Cleared
```

## Other APIs

### Test Error Logging
__Request__

```
GET /error-test
```

### Health Check
__Request__

```
GET /health
```

__Response__

```
Status 200
{
	message: "OK from admin." + DOMAIN
}
```

## Feedback
If you have any questions, concerns, or other feedback, please let us know any feedback in Github issues or by e-mail.

We also have a bug bounty program that can be found here: https://hackerone.com/confirmed_inc

## License

This project is licensed under the GPL License - see the [LICENSE.md](LICENSE.md) file for details

## Contact

<engineering@confirmedvpn.com>