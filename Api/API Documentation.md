# API Documentation

This document contains the API endpoints for the project. You can use this to manually test or integrate with Postman.

## Base URL

`http://localhost:3030`

---

## 🔑 Auth Module

### 1. Register User

- **URL:** `/auth/v1/register`
- **Method:** `POST`
- **Description:** Register a new user (DJ or Admin).
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "strongPassword123"
  }
  ```
- **Success Response:**
  - **Code:** 201
  - **Content:** User registered successfully. Please verify your email. (Returns user object without password)

### 2. Verify OTP

- **URL:** `/auth/v1/verify`
- **Method:** `POST`
- **Description:** Verify the user's email using the OTP sent to their email.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Email verified successfully. Returns JWT token and user info.

### 3. Resend Verification OTP

- **URL:** `/auth/v1/resend-otp`
- **Method:** `POST`
- **Description:** Request a new verification OTP for an unverified account.
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** If your account exists and is not verified, a new OTP has been sent.

### 4. Login

- **URL:** `/auth/v1/login`
- **Method:** `POST`
- **Description:** Authenticate user and get JWT.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "strongPassword123"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Login successful. Returns JWT token and user info.

### 5. Logout

- **URL:** `/auth/v1/logout`
- **Method:** `POST`
- **Description:** Logout user.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200
  - **Content:** Logout successful.

### 6. Forgot Password

- **URL:** `/auth/v1/forgot-password`
- **Method:** `POST`
- **Description:** Request a password reset OTP.
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** If an account exists with that email, a password reset OTP has been sent.

### 7. Reset Password

- **URL:** `/auth/v1/reset-password`
- **Method:** `POST`
- **Description:** Reset password using the OTP.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "123456",
    "newPassword": "newStrongPassword123"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Password has been reset successfully.

## 🏢 Tenant Module

### 1. Create Tenant Profile (Onboarding)
- **URL:** `/tenant/v1/onboard`
- **Method:** `POST`
- **Description:** Create the initial DJ profile (subdomain, stage name, location, genres).
- **Headers:** 
  - `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "subdomain": "dj-alex",
    "stageName": "Alex Vibes",
    "country": "USA",
    "city": "New York",
    "genres": ["House", "Techno"]
  }
  ```
- **Success Response:**
  - **Code:** 201
  - **Content:** Tenant profile created successfully. Returns created tenant object.

### 2. Get All Tenants (Admin Only)
- **URL:** `/tenant/v1/`
- **Method:** `GET`
- **Description:** Fetch a paginated list of all tenants across the platform. Includes the basic user info.
- **Headers:** 
  - `Authorization: Bearer <token>`
- **Query Parameters:**
  - `page` (optional): Page number, default 1
  - `limit` (optional): Items per page, default 10
- **Success Response:**
  - **Code:** 200
  - **Content:** Paginated list of tenants.

### 3. Get Public Profile
- **URL:** `/tenant/v1/:subdomain`
- **Method:** `GET`
- **Description:** Fetch the public portfolio data for rendering the DJ website.
- **Success Response:**
  - **Code:** 200
  - **Content:** Tenant profile retrieved successfully. Includes nested Theme, MixTapes, and Events.

### 3. Update Tenant Profile
- **URL:** `/tenant/v1/profile`
- **Method:** `PUT`
- **Description:** Update bio, social links, logo, and other details.
- **Headers:** 
  - `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "bio": "International DJ based in NY",
    "socialLinks": {
      "instagram": "https://instagram.com/alexvibes"
    }
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Tenant profile updated successfully.

### 4. Assign Theme
- **URL:** `/tenant/v1/theme`
- **Method:** `PUT`
- **Description:** Choose or change the portfolio theme.
- **Headers:** 
  - `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "themeId": 1
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Theme assigned successfully.

---

*More endpoints will be documented here as they are built.*
