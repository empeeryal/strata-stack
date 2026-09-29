/**
 * Validation for the fields a user may change about themselves (name and avatar URL). Runs
 * in the dashboard's profile form for immediate feedback and, authoritatively, in the
 * `user.update` database hook in src/lib/auth.ts, so the API enforces the same rules whatever
 * client calls it. Keep this file free of Astro imports: the auth config loads it.
 */

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const IMAGE_URL_MAX_LENGTH = 2048;

export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileValidationError';
  }
}

export interface ProfileInput {
  name?: unknown;
  image?: unknown;
}

export interface ProfileUpdate {
  name?: string;
  image?: string | null;
}

/**
 * Whether a string is an `https://` URL that can be used as an image source. Only the scheme
 * and shape are checked; the browser fetches the image under the page's CSP (`img-src https:`).
 */
export function isHttpsUrl(value: string): boolean {
  if (value.length > IMAGE_URL_MAX_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Trims, collapses inner whitespace and caps the length; what every stored name goes through. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX_LENGTH);
}

/**
 * Normalises and checks a profile update. Fields that are absent stay absent, so partial
 * updates from other code paths (roles, bans) pass through untouched. An empty avatar URL
 * clears the avatar.
 */
export function validateProfileUpdate(input: ProfileInput): ProfileUpdate {
  const update: ProfileUpdate = {};

  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      throw new ProfileValidationError(
        `Please enter a name between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`,
      );
    }
    update.name = name;
  }

  if (input.image !== undefined) {
    const image = typeof input.image === 'string' ? input.image.trim() : input.image;
    if (image === null || image === '') {
      update.image = null;
    } else if (typeof image !== 'string' || !isHttpsUrl(image)) {
      throw new ProfileValidationError('The avatar must be an https:// link to an image.');
    } else {
      update.image = image;
    }
  }

  return update;
}
