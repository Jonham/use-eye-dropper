import { jest } from '@jest/globals'
import React, { useState } from 'react'
import { act, render, fireEvent, waitFor, waitForElementToBeRemoved, screen } from '@testing-library/react'
import { EyeDropper } from './mocks'
import useEyeDropper from '../src'

beforeEach(() => {
  global.window.EyeDropper = EyeDropper
  global.window.EyeDropper.isOpen = false
})

afterEach(() => {
  delete global.window.EyeDropper
})

describe('EyeDropper Mock', () => {
  it('open() resolves color', async () => {
    const dropper = new EyeDropper()
    const color = await dropper.open()
    expect(color.sRGBHex).toEqual('rgba(255, 255, 255, 0)')
  })
})

describe('useEyeDropper', () => {
  describe('open()', () => {
    const Button = ({ onPick }) => {
      const [color, setColor] = useState('None')
      const { open } = useEyeDropper()
      const onClick = () => {
        const openPicker = async () => {
          const controller = new AbortController()
          const { signal } = controller
          try {
            const result = await onPick(open, controller)
            setColor(result.sRGBHex)
          }
          catch (e) {
            if (!e.canceled) setColor(e.message)
          }
        }
        openPicker()
      }
      return <button onClick={onClick}>{color}</button>
    }
    it('open() resolves color', async () => {
      const onPick = open => open()
      render(<Button onPick={onPick} />)
      const button = screen.getByText('None')
      expect(button).toBeInTheDocument()
      fireEvent.click(button)
      await waitFor(() => expect(screen.getByText('rgba(255, 255, 255, 0)')).toBeInTheDocument())
    })
    it('open() does not resolve when called with an aborted signal', async () => {
      const onPick = (open, controller) => {
        controller.abort()
        return open({ signal: controller.signal })
      }
      render(<Button onPick={onPick} />)
      fireEvent.click(screen.getByText('None'))
      await waitFor(() => expect(screen.getByText("Failed to execute 'open' on 'EyeDropper': Color selection aborted.")).toBeInTheDocument())
    })
    it('open() does not resolve when called with an aborted signal while open', async () => {
      const onPick = (open, controller) =>
        new Promise((resolve, reject) => {
          open({ signal: controller.signal })
            .then(result => resolve(result))
            .catch(err => reject(err))
          controller.abort()
        })
      render(<Button onPick={onPick} />)
      fireEvent.click(screen.getByText('None'))
      await waitFor(() => expect(screen.getByText('Color selection aborted.')).toBeInTheDocument())
    })
    it('open() is canceled on unmount', async () => {
      let promise
      const onPick = open => {
        promise = open()
        return promise
      }
      const { unmount } = render(<Button onPick={onPick} />)
      fireEvent.click(screen.getByText('None'))
      expect(window.EyeDropper.isOpen).toBe(true)
      unmount()
      await expect(promise).rejects.toThrow('Color selection aborted.')
      expect(window.EyeDropper.isOpen).toBe(false)
    })
    it('open() is rejected when EyeDropper API is not supported', async () => {
      delete window.EyeDropper
      const onPick = open => open()
      render(<Button onPick={onPick} />)
      fireEvent.click(screen.getByText('None'))
      await waitFor(() => expect(screen.getByText('Unsupported browser.')).toBeInTheDocument())
    })
    const UnmountButton = ({ onPick }) => {
      const [color, setColor] = React.useState('None')
      const { open } = useEyeDropper()
      const onClick = () => {
        const openPicker = async () => {
          try {
            const result = await open()
            setColor(result.sRGBHex)
          }
          catch (e) {
            if (!e.canceled) setColor(e.message)
          }
        }
        openPicker()
      }
      return <button onClick={onClick}>None</button>
    }
    it('open() prevents executing setState after unmount', async () => {
      const setStateMock = jest.fn()
      const useStateMock = value => [value, setStateMock]
      const spy = jest.spyOn(React, 'useState').mockImplementation(useStateMock)
      const { unmount } = render(<UnmountButton />)
      expect(screen.queryByText('None')).toBeInTheDocument()
      fireEvent.click(screen.getByText('None'))
      const removal = waitForElementToBeRemoved(() => screen.queryByText('None'))
      unmount()
      await removal
      expect(screen.queryByText('None')).not.toBeInTheDocument()
      expect(setStateMock).not.toBeCalled()
      spy.mockRestore()
    })
  })
  describe('close()', () => {
    const Button = ({ onPick }) => {
      const [status, setStatus] = useState('None')
      const { open, close } = useEyeDropper()
      const onClick = () => {
        const openPicker = async () => {
          try {
            const result = await onPick(open)
            setStatus(result.sRGBHex)
          }
          catch (e) {
            if (!e.canceled) setStatus(e.message)
          }
        }
        openPicker()
      }
      return (
        <>
          <span>{status}</span>
          <button onClick={close}>Close</button>
          <button onClick={onClick}>Open</button>
        </>
      )
    }
    it('close() rejects open()', async () => {
      render(<Button onPick={open => open()} />)
      fireEvent.click(screen.getByText('Open'))
      fireEvent.click(screen.getByText('Close'))
      await waitFor(() => expect(screen.getByText('Color selection aborted.')).toBeInTheDocument())
    })
    it('close() does not affect open() when called before', async () => {
      render(<Button onPick={open => open()}/>)
      fireEvent.click(screen.getByText('Open'))
      fireEvent.click(screen.getByText('Close'))
      fireEvent.click(screen.getByText('Open'))
      await waitFor(() => expect(screen.getByText('rgba(255, 255, 255, 0)')).toBeInTheDocument())
    })
    it('close() works with signal', async () => {
      const controller = new AbortController()
      render(<Button onPick={open => open({ signal: controller.signal })}/>)
      fireEvent.click(screen.getByText('Open'))
      fireEvent.click(screen.getByText('Close'))
      await waitFor(() => expect(screen.getByText('Color selection aborted.')).toBeInTheDocument())
      controller.abort()
      fireEvent.click(screen.getByText('Open'))
      await waitFor(() => expect(screen.getByText("Failed to execute 'open' on 'EyeDropper': Color selection aborted.")).toBeInTheDocument())
    })
    it('close() works when EyeDropper API is not supported', async () => {
      delete window.EyeDropper
      render(<Button onPick={open => open()} />)
      fireEvent.click(screen.getByText('Close'))
      await waitFor(() => expect(screen.getByText('None')).toBeInTheDocument())
    })
  })
  describe('isSupported()', () => {
    const Status = () => {
      const { isSupported } = useEyeDropper()
      return isSupported() ? 'EyeDropper API is supported' : 'EyeDropper API unavailable'
    }
    it('isSupported() is truthy when supported', async () => {
      render(<Status />)
      expect(screen.getByText('EyeDropper API is supported'))
    })
    it('isSupported() is falsy when unsupported', async () => {
      delete window.EyeDropper
      render(<Status />)
      expect(screen.getByText('EyeDropper API unavailable'))
    })
  })
})
