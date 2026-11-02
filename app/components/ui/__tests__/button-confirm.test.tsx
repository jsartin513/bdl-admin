import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../ConfirmDialog'
import { Button } from '../Button'

describe('Button', () => {
  it('renders primary variant and forwards clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" onClick={onClick}>
        Save
      </Button>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('ConfirmDialog', () => {
  it('exposes dialog role and confirms', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete snapshot"
        danger
        confirmLabel="Delete"
      >
        Delete “Balanced A”?
      </ConfirmDialog>
    )

    expect(
      screen.getByRole('dialog', { name: 'Delete snapshot' })
    ).toBeInTheDocument()
    expect(screen.getByText('Delete “Balanced A”?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('closes on Cancel', async () => {
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={() => undefined}
        title="Promote snapshot"
      >
        Promote now?
      </ConfirmDialog>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
