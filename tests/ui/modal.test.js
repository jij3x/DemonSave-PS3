/**
 * @jest-environment jsdom
 *
 * Unit tests for the custom modal dialog module.
 */

const { showConfirm, showAlert } = await import('../../js/ui/widgets/modal.js');

describe('modal — showConfirm', () => {
  test('resolves true when confirm button is clicked', async () => {
    const promise = showConfirm('Discard changes?');
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();

    const confirmBtn = overlay.querySelector('.modal-btn-primary');
    confirmBtn.click();

    await expect(promise).resolves.toBe(true);

    // DOM should be cleaned up after close
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('resolves false when cancel button is clicked', async () => {
    const promise = showConfirm('Discard changes?');
    const overlay = document.querySelector('.modal-overlay');

    const cancelBtn = overlay.querySelector('.modal-btn-secondary');
    cancelBtn.click();

    await expect(promise).resolves.toBe(false);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('resolves true on Enter key', async () => {
    const promise = showConfirm('Confirm?');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    await expect(promise).resolves.toBe(true);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('resolves false on Escape key', async () => {
    const promise = showConfirm('Confirm?');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(promise).resolves.toBe(false);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('uses custom title and button text', async () => {
    const promise = showConfirm('Are you sure?', {
      title: 'Warning',
      confirmText: 'Delete',
      cancelText: 'Keep',
    });
    const overlay = document.querySelector('.modal-overlay');

    expect(overlay.querySelector('.modal-title').textContent).toBe('Warning');
    const buttons = overlay.querySelectorAll('button');
    expect(buttons[0].textContent).toBe('Keep');
    expect(buttons[1].textContent).toBe('Delete');

    // Clean up
    overlay.querySelector('.modal-btn-primary').click();
    await promise;
  });

  test('applies danger class when danger option is set', async () => {
    const promise = showConfirm('Delete?', { danger: true });
    const overlay = document.querySelector('.modal-overlay');

    expect(overlay.querySelector('.modal-btn-danger')).not.toBeNull();

    overlay.querySelector('.modal-btn-primary').click();
    await promise;
  });

  test('does not resolve twice (double-click safety)', async () => {
    const promise = showConfirm('Confirm?');
    const overlay = document.querySelector('.modal-overlay');
    const confirmBtn = overlay.querySelector('.modal-btn-primary');

    confirmBtn.click();
    confirmBtn.click(); // second click should be a no-op

    const result = await promise;
    expect(result).toBe(true);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});

describe('modal — showAlert', () => {
  test('resolves when OK button is clicked', async () => {
    const promise = showAlert('Deposit is full.');
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();

    const okBtn = overlay.querySelector('.modal-btn-primary');
    okBtn.click();

    await promise;
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('resolves on Enter key', async () => {
    const promise = showAlert('Notice.');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    await promise;
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('resolves on Escape key', async () => {
    const promise = showAlert('Notice.');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await promise;
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('uses custom title', async () => {
    const promise = showAlert('Error!', { title: 'Something went wrong' });
    const overlay = document.querySelector('.modal-overlay');

    expect(overlay.querySelector('.modal-title').textContent).toBe('Something went wrong');

    overlay.querySelector('.modal-btn-primary').click();
    await promise;
  });

  test('has only one button (OK)', async () => {
    const promise = showAlert('Message');
    const overlay = document.querySelector('.modal-overlay');

    const buttons = overlay.querySelectorAll('button');
    expect(buttons).toHaveLength(1);

    buttons[0].click();
    await promise;
  });
});

describe('modal — accessibility', () => {
  test('dialog has role and aria-modal attributes', async () => {
    const promise = showConfirm('Confirm?');
    const overlay = document.querySelector('.modal-overlay');
    const dialog = overlay.querySelector('.modal');

    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    dialog.querySelector('.modal-btn-primary').click();
    await promise;
  });

  test('dialog has aria-labelledby pointing to title', async () => {
    const promise = showAlert('Test message');
    const overlay = document.querySelector('.modal-overlay');
    const dialog = overlay.querySelector('.modal');
    const titleId = dialog.getAttribute('aria-labelledby');
    const titleEl = dialog.querySelector('.modal-title');

    expect(titleId).toBe(titleEl.id);

    titleEl.nextElementSibling.nextElementSibling.querySelector('button').click();
    await promise;
  });
});

describe('modal — focus trap', () => {
  test('Tab on last button focuses first button', async () => {
    const promise = showConfirm('Confirm?', {
      confirmText: 'OK',
      cancelText: 'Cancel',
    });
    const overlay = document.querySelector('.modal-overlay');
    const buttons = overlay.querySelectorAll('button');
    const lastBtn = buttons[buttons.length - 1];

    // Focus the last button, then press Tab → should wrap to first
    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false }));

    const firstBtn = buttons[0];
    expect(document.activeElement).toBe(firstBtn);

    firstBtn.click();
    await promise;
  });

  test('Shift+Tab on first button focuses last button', async () => {
    const promise = showConfirm('Confirm?');
    const overlay = document.querySelector('.modal-overlay');
    const buttons = overlay.querySelectorAll('button');
    const firstBtn = buttons[0];

    firstBtn.focus();
    expect(document.activeElement).toBe(firstBtn);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));

    const lastBtn = buttons[buttons.length - 1];
    expect(document.activeElement).toBe(lastBtn);

    lastBtn.click();
    await promise;
  });

  test('Tab in middle does not wrap', async () => {
    const promise = showConfirm('Confirm?');
    const overlay = document.querySelector('.modal-overlay');
    const buttons = overlay.querySelectorAll('button');

    // Focus first button (not last), press Tab without shift → no wrap
    buttons[0].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false }));

    // First button is NOT last, so no preventDefault → focus stays or moves
    // naturally.  We just verify it didn't wrap to last.
    expect(document.activeElement).not.toBe(buttons[buttons.length - 1]);

    buttons[0].click();
    await promise;
  });

  test('non-Tab key is ignored by focus trap', async () => {
    const promise = showConfirm('Confirm?');
    const overlay = document.querySelector('.modal-overlay');
    const buttons = overlay.querySelectorAll('button');

    buttons[0].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    // Enter resolves the confirm dialog
    await expect(promise).resolves.toBe(true);
  });
});

describe('modal — overlay click', () => {
  test('showAlert: clicking overlay dismisses the dialog', async () => {
    const promise = showAlert('Click outside.');
    const overlay = document.querySelector('.modal-overlay');

    // Click directly on the overlay (not on the dialog)
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await promise;
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('showAlert: clicking inside the dialog does NOT dismiss', async () => {
    const promise = showAlert('Click inside.');
    const overlay = document.querySelector('.modal-overlay');
    const dialog = overlay.querySelector('.modal');

    // Click on the dialog itself (not the overlay)
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Dialog should still be open
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    // Clean up
    overlay.querySelector('.modal-btn-primary').click();
    await promise;
  });

  test('showConfirm: clicking overlay does NOT dismiss (destructive guard)', async () => {
    const promise = showConfirm('No overlay dismiss.');
    const overlay = document.querySelector('.modal-overlay');

    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Dialog should still be open — showConfirm never registers overlay-click
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    overlay.querySelector('.modal-btn-primary').click();
    await promise;
  });
});

describe('modal — custom options', () => {
  test('showAlert uses custom okText', async () => {
    const promise = showAlert('Message', { okText: 'Got it' });
    const overlay = document.querySelector('.modal-overlay');

    const btn = overlay.querySelector('.modal-btn-primary');
    expect(btn.textContent).toBe('Got it');

    btn.click();
    await promise;
  });

  test('showAlert uses custom title', async () => {
    const promise = showAlert('Message', { title: 'Info' });
    const overlay = document.querySelector('.modal-overlay');

    expect(overlay.querySelector('.modal-title').textContent).toBe('Info');

    overlay.querySelector('.modal-btn-primary').click();
    await promise;
  });
});

describe('modal — focus restoration', () => {
  test('restores focus to previously focused element after close', async () => {
    // Create a focusable element and focus it before opening the modal
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const promise = showConfirm('Confirm?');
    const overlay = document.querySelector('.modal-overlay');

    // Close the dialog
    overlay.querySelector('.modal-btn-primary').click();
    await promise;

    // Focus should be restored to the trigger element
    expect(document.activeElement).toBe(trigger);
  });

  test('auto-focuses primary button via requestAnimationFrame', async () => {
    // jsdom does implement requestAnimationFrame, so the auto-focus callback
    // fires. We just verify the primary button gets focused.
    const promise = showConfirm('Auto-focus test?');
    const overlay = document.querySelector('.modal-overlay');
    const primaryBtn = overlay.querySelector('.modal-btn-primary');

    // Wait for rAF to fire (jsdom queues it as a microtask)
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(primaryBtn);

    primaryBtn.click();
    await promise;
  });

  test('dialog with no focusable elements does not crash on Tab', async () => {
    // Build a custom dialog with no buttons/inputs
    const promise = showAlert('No focusable.');
    const overlay = document.querySelector('.modal-overlay');
    const dialog = overlay.querySelector('.modal');

    // Remove all buttons to make focusable.length === 0
    dialog.querySelector('.modal-actions').innerHTML = '<span>No buttons</span>';

    // Tab should be a no-op (trapFocus returns early)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

    // Should not crash — dialog still open
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    // Clean up via Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await promise;
  });
});
