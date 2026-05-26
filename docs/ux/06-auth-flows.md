# Authentication Flows

## Overview

Chronolog uses Better Auth for authentication with email/password and optional TOTP-based 2FA. There are three auth-related pages: Login, Register, and Two-Factor Settings.

## Login Page (`/login`)

### Layout

```
+--------------------------------------+
|          Chronolog                    |
|    Sign in to your account           |
|                                       |
|  [Error message]  (conditional)       |
|                                       |
|  Email:                               |
|  [you@example.com       ]            |
|                                       |
|  Password:                            |
|  [Your password          ]            |
|                                       |
|  [Sign in]                            |
|                                       |
|  Don't have an account? Register      |
+--------------------------------------+
```

### Two-Factor Challenge

If the server returns a redirect response (indicating 2FA is required), the form switches to a TOTP code entry:

```
+--------------------------------------+
|          Chronolog                    |
|    Enter your 2FA code               |
|                                       |
|  Authentication Code:                 |
|  [Enter 6-digit code    ]            |
|                                       |
|  [Verify]                             |
+--------------------------------------+
```

### Flow

1. User submits email + password via `authClient.signIn.email()`
2. If error: display error message
3. If `data.redirect` is truthy: switch to 2FA verification view
4. If success: full page reload to `/` (triggers layout re-mount with authenticated context)
5. In 2FA view: submit code via `authClient.twoFactor.verifyTotp()`
6. On success: full page reload to `/`

### State Variables

- `email`, `password`, `totpCode`: form values
- `errorMessage`: error display
- `isLoading`: button loading state
- `requiresTwoFactor`: toggles between login form and 2FA form

## Register Page (`/register`)

### Layout

```
+--------------------------------------+
|          Chronolog                    |
|    Create your account               |
|                                       |
|  [Error message]  (conditional)       |
|                                       |
|  Name:                                |
|  [Your name             ]            |
|                                       |
|  Email:                               |
|  [you@example.com       ]            |
|                                       |
|  Password:                            |
|  [At least 8 characters ]            |
|                                       |
|  Confirm Password:                    |
|  [Repeat your password  ]            |
|  [Passwords do not match] (if !=)     |
|                                       |
|  [Create account]                     |
|                                       |
|  Already have an account? Sign in     |
+--------------------------------------+
```

### Validation

- Password minimum length: 8 characters (client-side check)
- Password match: derived state `passwordsMatch` shows inline error when mismatched
- Submit button disabled while loading or passwords don't match

### Flow

1. User fills name, email, password, confirm password
2. Client-side validation: length >= 8, passwords match
3. `authClient.signUp.email()` called with name, email, password
4. On success: redirect to `/login` via `goto('/login')`
5. On error: display error message

## Two-Factor Settings (`/settings/two-factor`)

### Layout (four views)

The page has four views controlled by `enrollmentStep` and `hasTwoFactorEnabled`:

#### 1. Enrollment Start (2FA not enabled)

```
+--------------------------------------+
|  <- Back to dashboard                |
|                                       |
|  Two-Factor Authentication           |
|  Add an extra layer of security...   |
|                                       |
|  Password:                            |
|  [Enter your password to begin]       |
|                                       |
|  [Enable 2FA]                         |
+--------------------------------------+
```

#### 2. QR Code Display

```
+--------------------------------------+
|  Scan the QR Code                    |
|  Scan with your authenticator app... |
|                                       |
|       [QR CODE IMAGE]                |
|       256x256 pixels                  |
|                                       |
|  > Cannot scan? Enter URI manually    |
|  (expandable details with TOTP URI)   |
|                                       |
|  Verification Code:                   |
|  [Enter 6-digit code    ]            |
|                                       |
|  [Verify & Enable]    [Cancel]        |
+--------------------------------------+
```

#### 3. Recovery Codes

```
+--------------------------------------+
|  Save Your Recovery Codes            |
|  These codes can be used to access   |
|  your account if you lose your       |
|  authenticator device.               |
|                                       |
|  abc123-def456                       |
|  ghi789-jkl012                       |
|  ...                                  |
|                                       |
|  [I have saved my codes]             |
+--------------------------------------+
```

#### 4. 2FA Enabled (2FA already active)

```
+--------------------------------------+
|  * Two-factor authentication is      |
|    enabled                            |
|                                       |
|  To disable 2FA, enter your          |
|  password below.                      |
|                                       |
|  Password:                            |
|  [Enter your password    ]            |
|                                       |
|  [Disable 2FA]  (red button)          |
+--------------------------------------+
```

### Enrollment Flow

1. User enters password, clicks "Enable 2FA"
2. `authClient.twoFactor.enable({ password })` -- stores TOTP secret, returns backup codes
3. `authClient.twoFactor.getTotpUri({ password })` -- returns TOTP URI
4. QR code generated via `QRCode.toDataURL()` (256x256, margin 2)
5. User scans QR, enters 6-digit code
6. `authClient.twoFactor.verifyTotp({ code })` -- verifies setup
7. On success: show recovery codes, mark `hasTwoFactorEnabled = true`
8. User clicks "I have saved my codes" to return to enabled view

### Disable Flow

1. User enters password on the enabled view
2. `authClient.twoFactor.disable({ password })` called
3. On success: reset to enrollment start view, show success message

### Session Detection

The component uses `authClient.useSession()` to check if the user's session data includes `twoFactorEnabled === true`.

## First-Time User Setup

When a new user authenticates for the first time, the `hooks.server.ts` middleware automatically:
1. Creates a record in the app `users` table
2. Creates an "Internal" client with short code "INTL"
3. Creates a "General" contract under that client

This ensures every new user has at least one contract to work with immediately.

## Files

| File | Purpose |
|------|---------|
| `src/routes/login/+page.svelte` | Login form with 2FA challenge |
| `src/routes/register/+page.svelte` | Registration form |
| `src/routes/settings/two-factor/+page.svelte` | 2FA enrollment/management |
| `src/lib/auth-client.ts` | Better Auth client instance |
| `src/hooks.server.ts` | Auth guard, user provisioning |
