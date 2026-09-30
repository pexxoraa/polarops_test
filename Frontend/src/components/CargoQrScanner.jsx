import { useEffect, useRef, useState } from "react";

export default function CargoQrScanner({ onValue }) {
  const videoRef = useRef(null);
  const onValueRef = useRef(onValue);
  const [status, setStatus] = useState("Starting camera…");

  useEffect(() => {
    onValueRef.current = onValue;
  }, [onValue]);

  useEffect(() => {
    let stream;
    let timer;
    let videoNode;
    let stopped = false;

    async function start() {
      if (!window.BarcodeDetector) {
        setStatus(
          "Camera QR scanning is not supported here. Use Cargo ID below.",
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("Camera access is unavailable. Use Cargo ID below.");
        return;
      }

      try {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video || stopped) return;
        videoNode = video;
        video.srcObject = stream;
        await video.play();
        setStatus("Point the camera at a PolarOps cargo QR code.");

        const detect = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes.find((item) => item.rawValue)?.rawValue;
            if (value) {
              stopped = true;
              setStatus("QR detected.");
              onValueRef.current?.(value);
              return;
            }
          } catch {
            // A transient detector frame failure should not stop scanning.
          }
          timer = window.setTimeout(detect, 220);
        };

        detect();
      } catch (error) {
        setStatus(
          error?.name === "NotAllowedError"
            ? "Camera permission was denied. Use Cargo ID below."
            : "Could not start the camera. Use Cargo ID below.",
        );
      }
    }

    start();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoNode) videoNode.srcObject = null;
    };
  }, []);

  return (
    <div className="cargo-scanner">
      <div className="cargo-scanner-frame">
        <video ref={videoRef} playsInline muted />
        <div className="cargo-scan-reticle" aria-hidden="true" />
      </div>
      <p>{status}</p>
    </div>
  );
}
