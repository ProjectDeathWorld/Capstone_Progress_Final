import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DisplayBoard } from './DisplayBoard'

const previewDocument = '<!doctype html><html><head><style>html,body,#root{width:100%;height:100%;margin:0;padding:0;overflow:hidden;box-sizing:border-box;}</style></head><body><div id="root"></div></body></html>'

// A real 1920x1080 viewport keeps vw/vh units and media queries identical to
// fullscreen TV rendering. Admin ancestor selectors cannot reach this document.
export default function DisplayBoardViewport({ viewportTitle = 'Live TV preview', ...props }) {
  const [document, setDocument] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!document) return
    let disposed = false
    let revision = 0
    setReady(false)
    const hostDocument = window.document
    const base = document.createElement('base')
    base.href = hostDocument.baseURI
    document.head.append(base)
    const copiedStyles = new Map()
    const syncStyles = async () => {
      const currentRevision = ++revision
      const sources = [...hostDocument.head.querySelectorAll('style, link[rel="stylesheet"]')]
      for (const [source, entry] of copiedStyles) {
        if (!sources.includes(source)) { entry.clone.remove(); copiedStyles.delete(source) }
      }
      let previous = base
      for (const source of sources) {
        const signature = source.outerHTML
        let entry = copiedStyles.get(source)
        if (!entry || entry.signature !== signature) {
          const clone = source.cloneNode(true)
          const loaded = clone.tagName === 'LINK' ? new Promise(resolve => {
            clone.addEventListener('load', resolve, { once: true })
            clone.addEventListener('error', resolve, { once: true })
          }) : Promise.resolve()
          entry?.clone.remove()
          entry = { clone, signature, loaded }
          copiedStyles.set(source, entry)
        }
        if (previous.nextSibling !== entry.clone) previous.after(entry.clone)
        previous = entry.clone
      }
      await Promise.all([...copiedStyles.values()].map(entry => entry.loaded))
      if (disposed || currentRevision !== revision) return
      // Flush layout so the iframe requests the same font faces as the live TV.
      void document.body.offsetHeight
      await document.fonts.ready
      if (!disposed && currentRevision === revision) setReady(true)
    }
    syncStyles()
    const observer = new MutationObserver(syncStyles)
    observer.observe(hostDocument.head, { childList: true, subtree: true, characterData: true, attributes: true })
    return () => {
      disposed = true
      observer.disconnect()
      for (const { clone } of copiedStyles.values()) clone.remove()
      base.remove()
    }
  }, [document])

  return <>
    <iframe
      className="settings-tv-viewport"
      title={viewportTitle}
      width="1920"
      height="1080"
      style={{ width: 1920, height: 1080, minWidth: 1920, minHeight: 1080, maxWidth: 'none', maxHeight: 'none', border: 0, visibility: ready ? 'visible' : 'hidden' }}
      srcDoc={previewDocument}
      tabIndex={-1}
      draggable={false}
      onLoad={event => setDocument(event.currentTarget.contentDocument)}
    />
    {document && createPortal(<DisplayBoard {...props} mode="full" />, document.getElementById('root'))}
  </>
}
