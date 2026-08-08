<div align="center">
  <img src="./public/upbeat.png" alt="UpBeat Africa Logo" width="150" />
  
  # 🌍 UpBeat Africa SaaS Backend
  **A scalable, modular, and multi-tenant backend platform powering the UpBeat Africa DJ ecosystem.**

  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
  [![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
  
</div>

---

## 📚 Documentation & Resources

Dive right into the core documentation to understand how the platform works:

- 📖 **[Local API Documentation](./Api/API%20Documentation.md)** - Comprehensive markdown file listing all endpoints.
- 🗄️ **[Database & Technology Specs](./Database%20Design%20and%20Testing/Technology.md)** - Details on the DB schema, tech stack, and design choices.
- 🚀 **Live API Base URL:** `https://api.upbeat.africa`
- 🎯 **Interactive Swagger UI (Live):** [https://api.upbeat.africa/api-docs](https://api.upbeat.africa/api-docs)

> **Note:** The interactive Swagger UI is built automatically from JSDoc comments in the controllers and allows you to test endpoints directly from your browser.

---

## 🏗 Architecture (The Ignitor Engine)

This backend runs on a highly structured, class-based modular engine located in `src/index.ts`. It ensures the codebase remains maintainable as the SaaS platform scales.

1. **Initialization:** The application begins by instantiating the `IgnitorApp` engine.
2. **Infrastructure Providers:** Core services (e.g., `PrismaProvider`, `EmailProvider`, `FileUploaderProvider`) are registered into the app context for global access.
3. **Module Registration:** Business logic is encapsulated in completely standalone modules (e.g., `AuthModule`, `BookingModule`, `TenantModule`). These modules seamlessly attach their specific routes, controllers, and services.
4. **Spark:** The server initializes and handles routing safely!

---

## 🚀 Getting Started Locally

### Prerequisites
Make sure you have the following installed on your machine:
- **Bun:** We use [Bun](https://bun.sh/) for blisteringly fast dependency management and execution.
- **Docker:** (Optional but highly recommended) For quickly spinning up the local PostgreSQL database via `docker-compose`.

### Installation & Setup

1. **Install Dependencies:**
   ```bash
   bun install
   ```

2. **Environment Configuration:**
   Copy the `.env.demo` file to create your own `.env` file. Ensure you update the database credentials and the Paystack/Stripe/AWS secrets.
   ```bash
   cp .env.demo .env
   ```

3. **Start the Local Database:**
   Use the built-in script to spin up your PostgreSQL database:
   ```bash
   bun run docker:up
   ```

4. **Initialize Database (Prisma):**
   Run the setup script which automatically generates the Prisma Client and applies all migrations:
   ```bash
   bun run setup
   ```
   > 💡 **Tip:** The `setup` script is a convenient wrapper that bundles `bun install`, `prisma generate`, and `prisma migrate dev` into a single command.

---

## 💻 Running the Application

**Development Mode (Hot Reloading):**
```bash
bun run dev
```
*This starts the server on `http://localhost:3030` and watches for file changes.*

**Production Build:**
```bash
bun run build
bun run start
```
> ⚠️ **Warning:** Always ensure you compile the TypeScript code using `bun run build` before deploying to production. The `start` script specifically executes the compiled output in the `dist` directory.

---

## 📜 Essential Developer Scripts

Here are some of the most useful commands included in this repository:

- `bun run dev` - Starts the development server with hot-reloading.
- `bun run db:studio` - Opens **Prisma Studio** in your browser to easily view, edit, and query your database tables visually.
- `bun run db:push` - Pushes schema changes directly to the database without creating a migration file (good for prototyping).
- `bun run lint:fix` - Automatically scans and fixes ESLint rule violations.
- `bun run format` - Formats your code using Prettier to maintain a consistent style across the team.

> 💡 **Tip:** If your local database gets into a weird state during development, you can use `bun run reset`. This command safely resets the Prisma migrations and seeds the database to give you a fresh slate.
