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
  const [selectedLanguage, setSelectedLanguage] = useState("ta-IN");
  
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
  const [batchStatus, setBatchStatus] = useState("");

  // --- File Upload Logic ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError("");
    setTranscript("");
    if (acceptedFiles && acceptedFiles.length > 0) {
      const selected = acceptedFiles[0];
      // File size validation: Batch API can handle up to 2 hours. Let's set a soft limit of 100MB.
      if (selected.size > 100 * 1024 * 1024) {
        setError("File is too large. Please keep audio under 2 hours / 100MB.");
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
    setBatchStatus("");

    try {
      // Determine if we should use Batch API by checking audio duration
      const getAudioDuration = (audioFile: File): Promise<number> => {
        return new Promise((resolve) => {
          const objectUrl = URL.createObjectURL(audioFile);
          const audio = new Audio(objectUrl);
          audio.addEventListener("loadedmetadata", () => {
            URL.revokeObjectURL(objectUrl);
            resolve(audio.duration);
          });
          audio.addEventListener("error", () => {
            URL.revokeObjectURL(objectUrl);
            // Fallback to size-based check if duration can't be read (approx > 500KB usually > 30s)
            resolve(audioFile.size > 500 * 1024 ? 31 : 0);
          });
        });
      };

      const duration = await getAudioDuration(file);
      const isBatch = duration > 30 || file.size > 1 * 1024 * 1024; // >30s or >1MB

      if (isBatch) {
        await handleBatchTranscribe();
      } else {
        await handleRestTranscribe();
      }
    } /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during transcription.");
    } finally {
      setIsTranscribing(false);
      setBatchStatus("");
    }
  };

  const handleRestTranscribe = async () => {
    const formData = new FormData();
    formData.append("file", file!);
    formData.append("languageCode", selectedLanguage);

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
  };

  const handleBatchTranscribe = async () => {
    setBatchStatus("Initializing batch job...");
    
    // 1. Init
    const initRes = await fetch("/api/batch/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file!.name, languageCode: selectedLanguage })
    });
    const initData = await initRes.json();
    if (!initRes.ok) throw new Error(initData.error || "Init failed");
    const { jobId, uploadUrl } = initData;

    setBatchStatus("Uploading audio file...");

    // 2. Upload (proxy through backend to avoid CORS)
    const uploadRes = await fetch("/api/batch/upload", {
      method: "PUT",
      headers: {
        "Content-Type": file!.type || "application/octet-stream",
        "x-upload-url": uploadUrl
      },
      body: file,
    });
    if (!uploadRes.ok) throw new Error("Failed to upload audio to storage");

    setBatchStatus("Starting processing...");

    // 3. Start
    const startRes = await fetch("/api/batch/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId })
    });
    if (!startRes.ok) throw new Error("Failed to start job");

    // 4. Poll
    while (true) {
      setBatchStatus(`Processing (Polling status)...`);
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await fetch(`/api/batch/status?jobId=${jobId}`);
      if (!statusRes.ok) throw new Error("Failed to get status");
      
      const statusData = await statusRes.json();
      const currentStatus = statusData.job_state || statusData.status; // Fallback just in case
      setBatchStatus(`Status: ${currentStatus}`);
      
      if (currentStatus === "Completed" || currentStatus === "COMPLETED") {
        break;
      } else if (currentStatus === "Failed" || currentStatus === "FAILED") {
        throw new Error("Batch job failed on Sarvam AI");
      }
    }

    setBatchStatus("Downloading result...");

    // 5. Result
    const resultRes = await fetch(`/api/batch/result?jobId=${jobId}`);
    const resultData = await resultRes.json();
    if (!resultRes.ok) throw new Error(resultData.error || "Failed to fetch result");

    // Check result formats based on possible Sarvam outputs
    if (resultData.transcript) {
      setTranscript(resultData.transcript);
    } else if (resultData.text) {
      setTranscript(resultData.text);
    } else if (resultData.segments && Array.isArray(resultData.segments)) {
      // Sometimes it returns segments
      const text = resultData.segments.map((/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ s: any) => s.text || s.transcript).join(' ');
      setTranscript(text);
    } else {
      // Fallback
      setTranscript(JSON.stringify(resultData, null, 2));
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

        {/* Language Selection */}
        <div className="mb-8 flex flex-col items-center">
          <label htmlFor="language-select" className="text-sm font-medium text-slate-700 mb-2">
            Select Language
          </label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={isTranscribing || isRecording}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ngo-primary focus:border-ngo-primary"
          >
            <option value="ta-IN">Tamil</option>
            <option value="en-IN">English</option>
            <option value="hi-IN">Hindi</option>
            <option value="te-IN">Telugu</option>
            <option value="ml-IN">Malayalam</option>
            <option value="kn-IN">Kannada</option>
            <option value="mr-IN">Marathi</option>
            <option value="bn-IN">Bengali</option>
            <option value="gu-IN">Gujarati</option>
            <option value="pa-IN">Punjabi</option>
            <option value="od-IN">Odia</option>
          </select>
        </div>

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
              {batchStatus ? batchStatus : "Transcribing... this may take a moment"}
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
