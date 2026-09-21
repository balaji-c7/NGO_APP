"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { 
  UploadCloud, 
  Mic, 
  Square, 
  Loader2, 
  FileAudio, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Download 
} from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  
  // Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Transcription States
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // --- File Upload Logic ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError("");
    setTranscript("");
    if (acceptedFiles && acceptedFiles.length > 0) {
      const selected = acceptedFiles[0];
      // File size validation: REST API limit is ~30 seconds. We'll set a soft limit of 10MB.
      if (selected.size > 10 * 1024 * 1024) {
        setError("File is too large. Please keep audio under 30 seconds / 10MB.");
        return;
      }
      setFile(selected);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".wav", ".mp3", ".mp4", ".aac", ".flac"],
    },
    maxFiles: 1,
  });

  // --- Audio Recording Logic ---
  const startRecording = async () => {
    try {
      setError("");
      setTranscript("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/wav" });
        const audioFile = new File([audioBlob], "recorded_audio.wav", { type: "audio/wav" });
        setFile(audioFile);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Stop recording automatically after 30 seconds
      setRecordingTime(30);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- Transcription API Call ---
  const handleTranscribe = async () => {
    if (!file) {
      setError("Please select or record an audio file first.");
      return;
    }

    setIsTranscribing(true);
    setError("");
    setTranscript("");
    setDetectedLanguage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transcribe audio.");
      }

      setTranscript(data.transcript);
      setDetectedLanguage(data.language_code);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during transcription.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // --- Utility Actions ---
  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcription.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto flex flex-col items-center">
      
      {/* Header & Mission */}
      <header className="w-full text-center mb-10 mt-8">
        <h1 className="text-4xl font-bold text-ngo-primary mb-3">Speak India</h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto">
          Empowering communities by breaking language barriers. Our mission is to make voices heard across India by transcribing local languages to text instantly.
        </p>
      </header>

      {/* Main Interaction Area */}
      <section className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Drag & Drop Zone */}
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
              ${isDragActive ? "border-ngo-primary bg-blue-50" : "border-slate-300 hover:bg-slate-50"}
            `}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`w-10 h-10 mb-3 ${isDragActive ? "text-ngo-primary" : "text-slate-400"}`} />
            <p className="text-sm font-medium text-slate-700">Drag & drop audio</p>
            <p className="text-xs text-slate-500 mt-1">or click to browse files</p>
            <p className="text-[10px] text-slate-400 mt-2">MP3, WAV, AAC, FLAC</p>
          </div>

          {/* Record Audio Zone */}
          <div className="border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50">
            {!isRecording ? (
              <button 
                onClick={startRecording}
                className="w-16 h-16 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition-colors mb-3"
              >
                <Mic className="w-7 h-7" />
              </button>
            ) : (
              <button 
                onClick={stopRecording}
                className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors mb-3 animate-pulse"
              >
                <Square className="w-6 h-6" fill="currentColor" />
              </button>
            )}
            
            <p className="text-sm font-medium text-slate-700">
              {isRecording ? "Recording..." : "Record Audio"}
            </p>
            {isRecording && (
              <p className="text-xs text-red-600 font-medium mt-1">
                {recordingTime}s remaining
              </p>
            )}
            {!isRecording && (
              <p className="text-xs text-slate-500 mt-1">Max 30 seconds</p>
            )}
          </div>
        </div>

        {/* Selected File State */}
        {file && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg text-ngo-primary">
                <FileAudio className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button 
              onClick={() => setFile(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
            >
              Remove
            </button>
          </div>
        )}

        {/* Transcribe Button */}
        <button
          onClick={handleTranscribe}
          disabled={!file || isTranscribing || isRecording}
          className={`w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all
            ${(!file || isTranscribing || isRecording) 
              ? "bg-slate-300 cursor-not-allowed" 
              : "bg-ngo-primary hover:bg-blue-900 shadow-md hover:shadow-lg"}
          `}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Transcribing... this may take a moment
            </>
          ) : (
            "Transcribe Audio"
          )}
        </button>

      </section>

      {/* Result Section */}
      {transcript && (
        <section className="w-full mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Transcription Result</h2>
              {detectedLanguage && (
                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full uppercase">
                  {detectedLanguage}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleCopy}
                className="p-2 text-slate-500 hover:text-ngo-primary hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                title="Copy to clipboard"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
              </button>
              <button 
                onClick={handleDownload}
                className="p-2 text-slate-500 hover:text-ngo-primary hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                title="Download as .txt"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
              {transcript}
            </p>
          </div>
        </section>
      )}

    </main>
  );
}
