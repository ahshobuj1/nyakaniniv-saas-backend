# Technology Stack & Architecture

This document outlines the core technologies and services used to build the backend infrastructure of this SaaS platform.

## ⚡ Core Framework & Runtime

- **Runtime:** Bun / Node.js
- **Language:** TypeScript
- **Web Framework:** Express.js (Custom Class-Based Architecture using `IgnitorApp`)

## 🗄️ Database & ORM

- **Database Engine:** PostgreSQL
- **ORM:** Prisma
- **Schema Management:** Prisma Migrate

## 🔐 Authentication & Security

- **Authentication Method:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt
- **Security Middleware:** Helmet (HTTP headers), Express Rate Limit, CORS

## ☁️ Cloud & External Services

- **Storage / File Uploads:** AWS S3 Bucket
- **Payment Gateway:** Stripe

## 🛠️ Utilities & Developer Tools

- **Data Validation:** Zod
- **API Documentation:** Swagger UI & OpenAPI (`swagger-jsdoc`, `swagger-ui-express`)
- **Logging:** Winston (with file rotation)
- **Containerization:** Docker & Docker Compose

## 🏗️ Architectural Patterns

- **Modular Design:** The application is split into domain-specific modules (`AuthModule`, etc.) extending a `BaseModule` class.
- **Dependency Injection:** Centralized context injection for controllers and services.
- **Error Handling:** Global centralized error handlers mapping custom exceptions (`AppError`).
