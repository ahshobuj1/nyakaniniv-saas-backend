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

---

_More endpoints will be documented here as they are built._
