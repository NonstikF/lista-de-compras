import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button } from './ui';

// BarcodeDetector es API nativa del navegador (Chrome/Edge/Android). No está en los tipos de TS.
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorInstance { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
interface BarcodeDetectorCtor {
    new (options?: { formats?: string[] }): BarcodeDetectorInstance;
    getSupportedFormats(): Promise<string[]>;
}
const getBarcodeDetector = (): BarcodeDetectorCtor | undefined =>
    (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

const BarcodeScannerModal: React.FC<{
    onDetected: (code: string) => void;
    onClose: () => void;
}> = ({ onDetected, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const Detector = getBarcodeDetector();
        if (!Detector) {
            setError('Tu navegador no soporta el escaneo con cámara. Usa Chrome o Edge, o escribe el código a mano.');
            return;
        }

        let stream: MediaStream | null = null;
        let raf = 0;
        let stopped = false;
        const detector = new Detector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'codabar', 'itf'],
        });

        const start = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });
                if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
                const video = videoRef.current;
                if (!video) return;
                video.srcObject = stream;
                await video.play();
                tick();
            } catch {
                setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
            }
        };

        const tick = async () => {
            const video = videoRef.current;
            if (!video || stopped) return;
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                try {
                    const codes = await detector.detect(video);
                    if (codes.length > 0 && codes[0].rawValue) {
                        onDetected(codes[0].rawValue);
                        return;
                    }
                } catch {
                    // detect puede fallar entre frames; reintentar en el siguiente
                }
            }
            raf = requestAnimationFrame(tick);
        };

        start();

        return () => {
            stopped = true;
            cancelAnimationFrame(raf);
            stream?.getTracks().forEach(t => t.stop());
        };
    }, [onDetected]);

    return (
        <Modal open onClose={onClose} title="Escanear código de barras" maxWidth="max-w-md"
            footer={<Button variant="neutral" onClick={onClose}>Cancelar</Button>}>
            {error ? (
                <p className="text-sm text-error py-4">{error}</p>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-error/80 shadow-[0_0_8px_2px_rgba(220,38,38,0.6)]" />
                    </div>
                    <p className="text-xs text-on-surface-variant text-center">
                        Apunta la cámara al código de barras del artículo.
                    </p>
                </div>
            )}
        </Modal>
    );
};

export default BarcodeScannerModal;
