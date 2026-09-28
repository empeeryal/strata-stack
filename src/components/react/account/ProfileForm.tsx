import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { isHttpsUrl, NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '@/lib/profile';

import { Alert, Avatar, Button, Field, Input, Label, UNEXPECTED_ERROR } from '../primitives';

export interface ProfileFormProps {
  name: string;
  image: string | null;
}

/**
 * Edits the signed-in user's name and avatar through Better Auth's `updateUser`. The same
 * rules run again in the `user.update` hook on the server (src/lib/profile.ts). On success the
 * dashboard reloads with a notice, because the name and avatar also appear in the server
 * rendered header and greeting.
 */
export default function ProfileForm({ name, image }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(image ?? '');

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const nextName = String(data.get('name') ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    const nextImage = String(data.get('image') ?? '').trim();
    if (nextName.length < NAME_MIN_LENGTH || nextName.length > NAME_MAX_LENGTH) {
      setError(`Please enter a name between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`);
      return;
    }
    if (nextImage && !isHttpsUrl(nextImage)) {
      setError('The avatar must be an https:// link to an image.');
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.updateUser({ name: nextName, image: nextImage || null });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      window.location.assign('/dashboard?notice=profile-updated');
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Profile">
      {error && <Alert>{error}</Alert>}
      <div className="flex items-start gap-4">
        <Avatar name={name} image={isHttpsUrl(preview) ? preview : null} size="lg" />
        <div className="min-w-0 flex-1 space-y-4">
          <Field>
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              name="name"
              defaultValue={name}
              autoComplete="name"
              required
              minLength={NAME_MIN_LENGTH}
              maxLength={NAME_MAX_LENGTH}
            />
          </Field>
          <Field>
            <Label htmlFor="profile-image">Avatar image URL</Label>
            <Input
              id="profile-image"
              name="image"
              type="url"
              inputMode="url"
              defaultValue={image ?? ''}
              placeholder="https://github.com/you.png"
              pattern="https://.*"
              maxLength={2048}
              aria-describedby="profile-image-hint"
              onChange={(event) => setPreview(event.currentTarget.value.trim())}
            />
            <p id="profile-image-hint" className="text-xs text-pretty text-muted-foreground">
              A public https:// link to a square image. Leave it empty to show your initials.
            </p>
          </Field>
        </div>
      </div>
      <Button type="submit" variant="outline" loading={loading}>
        Save profile
      </Button>
    </form>
  );
}
