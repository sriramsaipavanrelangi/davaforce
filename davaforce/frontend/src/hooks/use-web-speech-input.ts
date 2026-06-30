"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
};

type BrowserSpeechRecognitionResultList = {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

const getRecognitionConstructor = () => {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

const voiceErrorMessage = (error?: string) => {
  if (error === "not-allowed" || error === "service-not-allowed") return "Microphone access is blocked.";
  if (error === "no-speech") return "No speech was detected.";
  if (error === "audio-capture") return "No microphone was found.";
  return "Voice input is not available right now.";
};

export function useWebSpeechInput({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState("");
  const baseValueRef = useRef("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    setIsSupported(Boolean(getRecognitionConstructor()));

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (disabled) return;

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    recognitionRef.current?.abort();
    setError("");

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = window.navigator.language || "en-US";
    baseValueRef.current = valueRef.current.trimEnd();

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;

        if (result.isFinal) {
          finalTranscript += `${finalTranscript ? " " : ""}${transcript}`;
        } else {
          interimTranscript += `${interimTranscript ? " " : ""}${transcript}`;
        }
      }

      const spokenText = (finalTranscript || interimTranscript).trim();
      if (!spokenText) return;

      const prefix = baseValueRef.current;
      const nextValue = `${prefix}${prefix ? " " : ""}${spokenText}`.trimStart();
      onChange(nextValue);

      if (finalTranscript) {
        baseValueRef.current = nextValue.trimEnd();
      }
    };

    recognition.onerror = (event) => {
      setError(voiceErrorMessage(event.error));
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setError("Voice input could not start.");
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, [disabled, onChange]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }, [isListening, startListening, stopListening]);

  return {
    error,
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
