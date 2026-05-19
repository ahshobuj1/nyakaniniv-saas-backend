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
    "password": "strongPassword123",
    "name": "John Doe"
  }
  ```
- **Success Response:**
  - **Code:** 201
  - **Content:** User registered successfully.

### 2. Login (To be implemented)
- **URL:** `/auth/v1/login`
- **Method:** `POST`
- **Description:** Authenticate user and get JWT.

---

*More endpoints will be documented here as they are built.*
