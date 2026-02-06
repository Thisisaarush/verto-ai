"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ---- Web Speech API type declarations ----
interface SpeechRecognitionAlternative {
  readonly confidence: number
  readonly transcript: string
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null
  onerror:
    | ((
        this: SpeechRecognitionInstance,
        ev: SpeechRecognitionErrorEvent,
      ) => void)
    | null
  onresult:
    | ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void)
    | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

interface UseSpeechToTextOptions {
  /** Language for recognition (BCP 47 tag). Defaults to browser language. */
  lang?: string
  /** Whether to use continuous recognition. Defaults to true. */
  continuous?: boolean
  /** Whether to return interim (partial) results. Defaults to true. */
  interimResults?: boolean
  /** Called with transcript text on each result (accumulated). */
  onResult?: (transcript: string) => void
  /** Called when recognition ends. */
  onEnd?: () => void
  /** Called on error. */
  onError?: (error: string) => void
}

interface UseSpeechToTextReturn {
  /** Whether the browser supports speech recognition. */
  isSupported: boolean
  /** Whether recognition is currently active. */
  isListening: boolean
  /** The current accumulated transcript text. */
  transcript: string
  /** Start listening. */
  startListening: () => void
  /** Stop listening. */
  stopListening: () => void
  /** Toggle listening on/off. */
  toggleListening: () => void
  /** Clear the accumulated transcript. */
  clearTranscript: () => void
}

// Cache mic permission status to avoid repeated prompts
let micPermissionGranted = false

export const useSpeechToText = (
  options: UseSpeechToTextOptions = {},
): UseSpeechToTextReturn => {
  const {
    lang,
    continuous = true,
    interimResults = true,
    onResult,
    onEnd,
    onError,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const accumulatedTextRef = useRef("")
  const stoppedRef = useRef(false)
  const onResultRef = useRef(onResult)
  const onEndRef = useRef(onEnd)
  const onErrorRef = useRef(onError)

  // Keep callback refs up to date
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])
  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)

  const startListening = useCallback(async () => {
    if (!isSupported) {
      onErrorRef.current?.(
        "Speech recognition is not supported in this browser.",
      )
      return
    }

    // Request microphone permission if not already granted
    if (!micPermissionGranted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        micPermissionGranted = true
      } catch {
        onErrorRef.current?.(
          "Microphone permission denied. Please allow microphone access.",
        )
        return
      }
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    const Ctor = ((window as unknown as Record<string, SpeechRecognitionCtor>)[
      "SpeechRecognition"
    ] ??
      (window as unknown as Record<string, SpeechRecognitionCtor>)[
        "webkitSpeechRecognition"
      ])!

    const recognition = new Ctor()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    if (lang) recognition.lang = lang

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Skip if stopped (prevents late results from repopulating)
      if (stoppedRef.current) return

      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result?.[0]) {
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }
      }

      // Accumulate final transcripts, show interim as preview
      if (finalTranscript) {
        accumulatedTextRef.current += (accumulatedTextRef.current ? " " : "") + finalTranscript.trim()
      }
      
      const displayText = accumulatedTextRef.current + 
        (interimTranscript ? (accumulatedTextRef.current ? " " : "") + interimTranscript : "")
      
      setTranscript(displayText)
      if (displayText) {
        onResultRef.current?.(displayText)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        onErrorRef.current?.(event.error)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      onEndRef.current?.()
    }

    recognitionRef.current = recognition
    try {
      stoppedRef.current = false
      recognition.start()
      setIsListening(true)
    } catch (err) {
      onErrorRef.current?.(`Failed to start: ${err}`)
    }
  }, [isSupported, continuous, interimResults, lang])

  const stopListening = useCallback(() => {
    stoppedRef.current = true
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    // Clear accumulated text when stopping
    accumulatedTextRef.current = ""
    setTranscript("")
    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const clearTranscript = useCallback(() => {
    accumulatedTextRef.current = ""
    setTranscript("")
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  return {
    isSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  }
}
