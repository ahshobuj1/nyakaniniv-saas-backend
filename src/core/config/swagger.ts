import swaggerJsdoc from "swagger-jsdoc";
import { config } from "../config";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "UpBeat Entertainment Africa API Documentation",
      version: "1.0.0",
      description: "API documentation for the backend application",
    },
    servers: [
      {
        url: "https://api.upbeat.africa",
        description: "Production Server",
      },
      {
        url: `http://localhost:${config.server.port}`,
        description: "Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  // Paths to files containing OpenAPI definitions
  apis: ["./src/Modules/**/*.ts", "./src/core/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
