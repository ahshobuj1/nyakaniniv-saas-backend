import { z } from "zod";
import { ValidationIssue } from "@/types/error.types";
import { ValidationError } from "./AppError";

/**
 * Extracts and normalizes issues from a ZodError into a structured ValidationIssue list
 */
export function extractValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    let message = issue.message;

    // Provide context if the schema message was just generic "Required"
    if (message.toLowerCase() === "required" && path) {
      message = `${path} is required`;
    }

    return {
      path,
      message,
      code: issue.code,
    };
  });
}

/**
 * Formats validation issues into a clean, human-readable error message.
 * Single issues show their exact message.
 * Multiple issues are deduplicated and joined with commas.
 */
export function formatValidationErrorMessage(issues: ValidationIssue[]): string {
  if (!issues || issues.length === 0) {
    return "Validation failed";
  }

  const uniqueMessages = Array.from(
    new Set(
      issues
        .map((issue) => issue.message?.trim())
        .filter((msg): msg is string => Boolean(msg))
    )
  );

  return uniqueMessages.join(", ") || "Validation failed";
}

/**
 * Transforms any ZodError directly into an AppError ValidationError
 * featuring the exact validation error message at the root level.
 */
export function formatZodError(error: z.ZodError): ValidationError {
  const issues = extractValidationIssues(error);
  const message = formatValidationErrorMessage(issues);

  return new ValidationError(message, {
    issues,
    invalidFields: issues.length,
  });
}
