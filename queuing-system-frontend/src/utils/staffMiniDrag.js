// Move the real popup window; browsers may restrict moveTo for non-scripted windows.
export function attachMiniWindowDrag(host, handle) {
  let drag = null
  const finish = () => {
    const id = drag?.id
    drag = null
    handle.classList.remove('is-dragging')
    if (id !== undefined && handle.hasPointerCapture?.(id)) handle.releasePointerCapture(id)
  }
  const down = event => {
    if (drag || event.button !== 0 || event.isPrimary === false) return
    event.preventDefault()
    drag = {
      id: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      windowX: host.screenX,
      windowY: host.screenY,
    }
    handle.setPointerCapture?.(event.pointerId)
    handle.classList.add('is-dragging')
  }
  const move = event => {
    if (drag && event.pointerId === drag.id) {
      host.moveTo(
        drag.windowX + event.screenX - drag.startX,
        drag.windowY + event.screenY - drag.startY,
      )
    }
  }
  const up = event => { if (drag?.id === event.pointerId) finish() }
  const listeners = {pointerdown:down, pointermove:move, pointerup:up, pointercancel:up, lostpointercapture:up}
  Object.entries(listeners).forEach(([type, fn]) => handle.addEventListener(type, fn))
  host.addEventListener('blur', finish)
  return () => {
    finish()
    Object.entries(listeners).forEach(([type, fn]) => handle.removeEventListener(type, fn))
    host.removeEventListener('blur', finish)
  }
}
