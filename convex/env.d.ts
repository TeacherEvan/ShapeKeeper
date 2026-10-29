/**
 * Convex exposes environment variables through `process.env` at runtime, but
 * this version of the `convex` package does not ship the ambient type for it.
 * Declaring it here keeps the deployment type-check green without adding
 * `@types/node` to a runtime that is not Node.
 */
declare const process: {
    env: { [key: string]: string | undefined };
};
