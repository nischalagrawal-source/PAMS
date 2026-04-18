"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, RotateCcw, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1/model";

interface SelfieCaptureProps {
  onCapture: (base64: string, faceMatchScore: number | null) => void;
  onCancel: () => void;
  profilePhotoUrl?: string | null;
  className?: string;
}

/** Dynamically load face-api.js (only in browser, only once) */
let faceApiPromise: Promise<typeof import("@vladmandic/face-api")> | null = null;
function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = import("@vladmandic/face-api").then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    });
  }
  return faceApiPromise;
}

/** Load an image element from a URL or data URI */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Selfie capture component with client-side face matching.
 * Uses face-api.js (browser, WebGL) to compare the selfie against the profile photo.
 * Sends the match score to the server for auto-verify / admin-review decisions.
 */
export function SelfieCapture({ onCapture, onCancel, profilePhotoUrl, className }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);

  // Pre-load face-api models when component mounts
  useEffect(() => {
    loadFaceApi()
      .then(() => setModelsLoading(false))
      .catch(() => {
        // Models failed to load — face matching will be skipped, selfie still captured
        setModelsLoading(false);
      });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions for attendance verification.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the image (front camera is mirrored)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.7);
    setCaptured(base64);
    stopCamera();
  }, [stopCamera]);

  const handleRetake = useCallback(() => {
    setCaptured(null);
    setError(null);
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(async () => {
    if (!captured) return;
    setVerifying(true);

    let score: number | null = null;

    try {
      if (profilePhotoUrl) {
        const faceapi = await loadFaceApi();
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

        // Load both images and detect faces + compute 128-dim descriptors
        const [selfieImg, profileImg] = await Promise.all([loadImage(captured), loadImage(profilePhotoUrl)]);

        const [selfieResult, profileResult] = await Promise.all([
          faceapi.detectSingleFace(selfieImg, options).withFaceLandmarks(true).withFaceDescriptor(),
          faceapi.detectSingleFace(profileImg, options).withFaceLandmarks(true).withFaceDescriptor(),
        ]);

        if (selfieResult && profileResult) {
          // Euclidean distance between face descriptors (0 = same, ~0.6+ = different person)
          const distance = faceapi.euclideanDistance(selfieResult.descriptor, profileResult.descriptor);
          // Convert to 0-100 score (0 distance = 100 score)
          score = Math.max(0, Math.round((1 - distance / 1.0) * 100));
        } else {
          // Face not detected in one or both images — server will flag for manual review
          score = null;
        }
      }
    } catch {
      // Face matching failed — still send selfie, server will flag for manual review
      score = null;
    }

    setVerifying(false);
    onCapture(captured, score);
  }, [captured, profilePhotoUrl, onCapture]);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border-2 border-gray-200 bg-black dark:border-gray-700">
        {!captured ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full scale-x-[-1]"
            />
            {/* Oval face guide overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-36 rounded-full border-2 border-dashed border-white/50" />
            </div>
            {!cameraReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <p className="text-sm text-white">Starting camera...</p>
              </div>
            )}
          </>
        ) : (
          <img src={captured} alt="Captured selfie" className="w-full" />
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        {modelsLoading
          ? "Loading face verification models..."
          : "A selfie is required for check-in verification. Position your face within the oval guide."}
      </p>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex items-center gap-3">
        {!captured ? (
          <>
            <button
              onClick={onCancel}
              className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              onClick={handleCapture}
              disabled={!cameraReady}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera size={16} />
              Take Selfie
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleRetake}
              disabled={verifying}
              className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RotateCcw size={16} />
              Retake
            </button>
            <button
              onClick={handleConfirm}
              disabled={verifying}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-500/25 transition hover:from-green-500 hover:to-emerald-500 disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Verifying Face...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Confirm & Check In
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
