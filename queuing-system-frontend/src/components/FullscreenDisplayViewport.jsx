import { useEffect, useRef, useState } from 'react'
import DisplayBoardViewport from './TVPreviewViewport'

export default function FullscreenDisplayViewport(props) {
  const container = useRef(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const frame = container.current
    if (!frame) return
    const resize = () => setScale(Math.min((frame.clientWidth || 1920) / 1920, (frame.clientHeight || 1080) / 1080))
    resize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(frame)
    return () => observer?.disconnect()
  }, [])

  return <div ref={container} className="fullscreen-tv-fit">
    <div className="fullscreen-tv-size" style={{ width: 1920 * scale, height: 1080 * scale }}>
      <div className="fullscreen-tv-canvas" style={{ transform: `scale(${scale})` }}>
        <DisplayBoardViewport {...props} viewportTitle="Live Display Board" />
      </div>
    </div>
  </div>
}
