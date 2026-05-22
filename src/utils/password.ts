import bcryptjs from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password.
 * @param password The raw password to hash.
 * @returns The hashed password.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcryptjs.genSalt(SALT_ROUNDS);
  return await bcryptjs.hash(password, salt);
};

/**
 * Compare a plain text password with a hash.
 * @param password The raw password.
 * @param hash The hashed password.
 * @returns True if they match, false otherwise.
 */
export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcryptjs.compare(password, hash);
};
