import { useRef, useEffect } from 'react'
import SignaturePad from 'react-signature-canvas'
import { Button } from './ui/Button'

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void
  onClear: () => void
  language: 'no' | 'en'
}

const translations = {
  no: {
    clear: 'Tøm',
    signHere: 'Signer her',
  },
  en: {
    clear: 'Clear',
    signHere: 'Sign here',
  },
}

export function SignatureCanvas({ onSave, onClear, language }: SignatureCanvasProps) {
  const sigPadRef = useRef<SignaturePad>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const t = translations[language]

  useEffect(() => {
    const resizeCanvas = () => {
      if (sigPadRef.current && containerRef.current) {
        const canvas = sigPadRef.current.getCanvas()
        const ratio = Math.max(window.devicePixelRatio || 1, 1)
        const width = containerRef.current.offsetWidth
        const height = 300
        canvas.width = width * ratio
        canvas.height = height * ratio
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        canvas.getContext('2d')?.scale(ratio, ratio)
        sigPadRef.current.clear()
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  const handleClear = () => {
    sigPadRef.current?.clear()
    onClear()
  }

  const handleSave = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const dataUrl = sigPadRef.current.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]
      onSave(base64)
    }
  }

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="border-2 border-dashed border-gray-300 rounded-lg bg-white relative"
      >
        <SignaturePad
          ref={sigPadRef}
          canvasProps={{
            className: 'w-full touch-none',
            style: { height: '300px' },
          }}
          penColor="#000000"
          minWidth={1.5}
          maxWidth={3}
        />
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-gray-400 text-sm pointer-events-none">
          {t.signHere}
        </div>
      </div>
      <div className="flex gap-3 mt-3">
        <Button variant="secondary" onClick={handleClear} type="button">
          {t.clear}
        </Button>
        <Button variant="primary" onClick={handleSave} type="button" className="flex-1">
          {language === 'no' ? 'Lagre og signer' : 'Save and sign'}
        </Button>
      </div>
    </div>
  )
}
