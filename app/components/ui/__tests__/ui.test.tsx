import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog, FieldHelp, LiveMessage, Tooltip } from '../index'

describe('Dialog', () => {
  it('exposes dialog role and closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Test dialog">
        <button type="button">Inside</button>
      </Dialog>
    )

    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus within the panel', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Focus trap">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Dialog>
    )

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })
})

describe('Tooltip', () => {
  it('shows content on focus and exposes aria-describedby', async () => {
    render(<Tooltip label="About skill" content="Linear skill is 1–100." />)

    const trigger = screen.getByRole('button', { name: 'About skill' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.tab()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Linear skill is 1–100.')
  })
})

describe('FieldHelp and LiveMessage', () => {
  it('renders FieldHelp with id for aria-describedby', () => {
    render(<FieldHelp id="hint-1">Leave blank to keep unchanged.</FieldHelp>)
    const help = screen.getByText('Leave blank to keep unchanged.')
    expect(help).toHaveAttribute('id', 'hint-1')
  })

  it('announces alerts assertively', () => {
    render(
      <LiveMessage variant="alert" className="text-red-600">
        Something failed
      </LiveMessage>
    )
    const msg = screen.getByRole('alert')
    expect(msg).toHaveTextContent('Something failed')
    expect(msg).toHaveAttribute('aria-live', 'assertive')
  })
})
