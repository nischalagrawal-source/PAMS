"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  timestamp: number | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
    timestamp: null,
  });

  const watchIdRef = useRef<number | null>(null);

  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 0,
  } = options;

  const getCurrentPosition = useCallback((): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = "Geolocation is not supported by your browser";
        setState((prev) => ({ ...prev, error, loading: false }));
        reject(new Error(error));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setState({
            latitude,
            longitude,
            accuracy,
            loading: false,
            error: null,
            timestamp: position.timestamp,
          });
          resolve({ latitude, longitude, accuracy });
        },
        (err) => {
          let errorMsg = "Failed to get location";
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMsg = "Location permission denied. Please enable location access in your browser settings.";
              break;
            case err.POSITION_UNAVAILABLE:
              errorMsg = "Location unavailable. Please check your GPS settings.";
              break;
            case err.TIMEOUT:
              errorMsg = "Location request timed out. Please try again.";
              break;
          }
          setState((prev) => ({ ...prev, error: errorMsg, loading: false }));
          reject(new Error(errorMsg));
        },
        { enableHighAccuracy, timeout, maximumAge }
      );
    });
  }, [enableHighAccuracy, timeout, maximumAge]);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setState({
          latitude,
          longitude,
          accuracy,
          loading: false,
          error: null,
          timestamp: position.timestamp,
        });
      },
      (err) => {
        setState((prev) => ({ ...prev, error: err.message, loading: false }));
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  }, [enableHighAccuracy, timeout, maximumAge]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopWatching();
  }, [stopWatching]);

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching,
    isSupported: typeof navigator !== "undefined" && !!navigator.geolocation,
  };
}
