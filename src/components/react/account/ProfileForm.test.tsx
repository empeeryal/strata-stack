// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateUser = vi.fn();
vi.mock('@/lib/auth-client', () => ({
  authClient: { updateUser: (...a: unknown[]) => updateUser(...a) },
}));

import ProfileForm from './ProfileForm';

describe('<ProfileForm>', () => {
  beforeEach(() => {
    updateUser.mockReset();
    Object.defineProperty(window, 'location', {
      value: { assign: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  it('saves the trimmed name and the avatar, then reloads the dashboard with a notice', async () => {
    updateUser.mockResolvedValue({ data: { status: true }, error: null });
    const user = userEvent.setup();
    render(<ProfileForm name="Ada" image={null} />);

    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, '  Ada   Lovelace ');
    await user.type(screen.getByLabelText('Avatar image URL'), 'https://github.com/ada.png');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({
        name: 'Ada Lovelace',
        image: 'https://github.com/ada.png',
      }),
    );
    expect(window.location.assign).toHaveBeenCalledWith('/dashboard?notice=profile-updated');
  });

  it('sends null to clear the avatar', async () => {
    updateUser.mockResolvedValue({ data: { status: true }, error: null });
    const user = userEvent.setup();
    render(<ProfileForm name="Ada" image="https://github.com/ada.png" />);
    await user.clear(screen.getByLabelText('Avatar image URL'));
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Ada', image: null }));
  });

  it('rejects a non-https avatar before calling the API', async () => {
    const user = userEvent.setup();
    render(<ProfileForm name="Ada" image={null} />);
    const field = screen.getByLabelText('Avatar image URL');
    await user.type(field, 'http://example.com/a.png');
    // Bypass the browser's own url/pattern validation to reach the component's check.
    field.closest('form')?.setAttribute('novalidate', '');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('https://'));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('falls back to initials when the preview image cannot load', async () => {
    const { container } = render(
      <ProfileForm name="Ada Lovelace" image="https://example.com/gone.png" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    img?.dispatchEvent(new Event('error'));
    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    expect(container.textContent).toContain('AL');
  });

  it('shows the API error', async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { message: 'Please enter a name between 2 and 80 characters.' },
    });
    const user = userEvent.setup();
    render(<ProfileForm name="Ada" image={null} />);
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('between 2 and 80'));
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});
