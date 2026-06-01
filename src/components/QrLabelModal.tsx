import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { Modal, Button } from './ui';

// Etiqueta QR de una ubicación. El QR codifica el deep link /l/{code}
// que abre LocationScanView con la sesión iniciada.
const QrLabelModal: React.FC<{
    code: string;
    name: string;
    onClose: () => void;
}> = ({ code, name, onClose }) => {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    const deepLink = useMemo(() => `${window.location.origin}/l/${code}`, [code]);

    useEffect(() => {
        QRCode.toDataURL(deepLink, {
            errorCorrectionLevel: 'M',
            margin: 0,
            scale: 8,
            color: { dark: '#000000', light: '#ffffff' },
        }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }, [deepLink]);

    const handlePrint = () => {
        if (!qrDataUrl) return;
        const w = window.open('', '_blank', 'width=400,height=300');
        if (!w) return;
        const doc = w.document;
        doc.title = `Etiqueta ${code}`;

        const style = doc.createElement('style');
        style.textContent = `
@page { size: 2in 1in; margin: 0; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.label { width: 2in; height: 1in; box-sizing: border-box; padding: 0.04in; display: flex; align-items: center; gap: 0.06in; }
.qr { width: 0.92in; height: 0.92in; flex-shrink: 0; }
.qr img { width: 100%; height: 100%; display: block; }
.txt { flex: 1; min-width: 0; overflow: hidden; }
.name { font-size: 11pt; font-weight: 700; line-height: 1.1; margin: 0; word-wrap: break-word; overflow-wrap: break-word; max-height: 0.55in; overflow: hidden; }
.code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 8pt; font-weight: 600; margin: 0.04in 0 0 0; color: #333; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;
        doc.head.appendChild(style);

        const labelEl = doc.createElement('div');
        labelEl.className = 'label';

        const qrWrap = doc.createElement('div');
        qrWrap.className = 'qr';
        const img = doc.createElement('img');
        img.src = qrDataUrl;
        img.alt = 'QR';
        qrWrap.appendChild(img);

        const txt = doc.createElement('div');
        txt.className = 'txt';
        const nameEl = doc.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = name;
        const codeEl = doc.createElement('div');
        codeEl.className = 'code';
        codeEl.textContent = code;
        txt.appendChild(nameEl);
        txt.appendChild(codeEl);

        labelEl.appendChild(qrWrap);
        labelEl.appendChild(txt);
        doc.body.appendChild(labelEl);

        const triggerPrint = () => {
            w.focus();
            w.print();
            setTimeout(() => w.close(), 500);
        };
        if (img.complete) {
            triggerPrint();
        } else {
            img.onload = triggerPrint;
            img.onerror = triggerPrint;
        }
    };

    const handleDownload = () => {
        if (!qrDataUrl) return;
        const a = document.createElement('a');
        a.href = qrDataUrl;
        a.download = `qr-${code}.png`;
        a.click();
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={`Etiqueta: ${name}`}
            maxWidth="max-w-md"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose}>Cerrar</Button>
                    <Button variant="outline" icon="download" onClick={handleDownload} disabled={!qrDataUrl}>
                        QR PNG
                    </Button>
                    <Button variant="filled" icon="print" onClick={handlePrint} disabled={!qrDataUrl}>
                        Imprimir
                    </Button>
                </>
            }
        >
            <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-on-surface-variant">
                    Vista previa de la etiqueta (2in × 1in). El QR abre la ubicación con sesión iniciada.
                </p>

                <div className="flex justify-center bg-surface-container-low rounded-xl p-6">
                    <div
                        className="bg-white border border-outline-variant shadow-sm flex items-center gap-2 p-1"
                        style={{ width: '4in', height: '2in' }}
                    >
                        <div style={{ width: '1.84in', height: '1.84in', flexShrink: 0 }}>
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="QR" style={{ width: '100%', height: '100%', display: 'block' }} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-xs">
                                    Generando…
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-bold text-on-background leading-tight break-words" style={{ fontSize: '22pt', maxHeight: '1.1in', overflow: 'hidden' }}>
                                {name}
                            </div>
                            <div className="font-mono font-semibold text-on-surface-variant mt-1" style={{ fontSize: '16pt' }}>
                                {code}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-container-low rounded-xl px-4 py-3 text-xs text-on-surface-variant break-all">
                    <span className="font-semibold text-on-surface">URL del QR: </span>
                    {deepLink}
                </div>
            </div>
        </Modal>
    );
};

export default QrLabelModal;
