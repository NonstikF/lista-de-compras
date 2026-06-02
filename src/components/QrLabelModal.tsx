import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Modal, Button, Field, Input } from './ui';

const LABEL_WIDTH_IN = 2.25;
const LABEL_HEIGHT_IN = 1.25;
const LABEL_PADDING_IN = 0.06;
const QR_SIZE_IN = 1.1;

// Location QR label. The QR encodes only the location code as plain text.
const QrLabelModal: React.FC<{
    code: string;
    name: string;
    onClose: () => void;
}> = ({ code, name, onClose }) => {
    const [labelName, setLabelName] = useState(name);
    const [labelCode, setLabelCode] = useState(code);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    const printCode = labelCode.trim() || code;
    const printName = labelName.trim() || printCode;

    useEffect(() => {
        setLabelName(name);
        setLabelCode(code);
    }, [code, name]);

    useEffect(() => {
        QRCode.toDataURL(printCode, {
            errorCorrectionLevel: 'M',
            margin: 0,
            scale: 8,
            color: { dark: '#000000', light: '#ffffff' },
        }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }, [printCode]);

    const resetLabel = () => {
        setLabelName(name);
        setLabelCode(code);
    };

    const handlePrint = () => {
        if (!qrDataUrl) return;
        const w = window.open('', '_blank', 'width=450,height=300');
        if (!w) return;
        const doc = w.document;
        doc.title = `Etiqueta ${printCode}`;

        const style = doc.createElement('style');
        style.textContent = `
@page { size: ${LABEL_WIDTH_IN}in ${LABEL_HEIGHT_IN}in; margin: 0; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.label { width: ${LABEL_WIDTH_IN}in; height: ${LABEL_HEIGHT_IN}in; box-sizing: border-box; padding: ${LABEL_PADDING_IN}in; display: flex; align-items: center; gap: 0.08in; overflow: hidden; }
.qr { width: ${QR_SIZE_IN}in; height: ${QR_SIZE_IN}in; flex-shrink: 0; }
.qr img { width: 100%; height: 100%; display: block; }
.txt { flex: 1; min-width: 0; overflow: hidden; }
.name { font-size: 13pt; font-weight: 800; line-height: 1.05; margin: 0; word-wrap: break-word; overflow-wrap: break-word; max-height: 0.76in; overflow: hidden; color: #111; }
.code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 9pt; font-weight: 700; margin: 0.06in 0 0 0; color: #333; word-break: break-all; }
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
        nameEl.textContent = printName;
        const codeEl = doc.createElement('div');
        codeEl.className = 'code';
        codeEl.textContent = printCode;
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
        a.download = `qr-${printCode}.png`;
        a.click();
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={`Etiqueta: ${printName}`}
            maxWidth="max-w-2xl"
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
            <div className="px-6 py-5 space-y-5">
                <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Nombre en etiqueta">
                            <Input
                                value={labelName}
                                onChange={e => setLabelName(e.target.value)}
                                placeholder={name || code}
                                maxLength={80}
                            />
                        </Field>
                        <Field label="Codigo QR / SKU">
                            <Input
                                value={labelCode}
                                onChange={e => setLabelCode(e.target.value.toUpperCase())}
                                placeholder={code}
                                maxLength={40}
                            />
                        </Field>
                    </div>
                    <Button variant="text" size="sm" icon="restart_alt" onClick={resetLabel} className="px-2">
                        Restaurar datos originales
                    </Button>
                </div>

                <div className="flex justify-center bg-surface-container-low rounded-xl p-4 overflow-auto">
                    <div
                        className="bg-white border border-outline-variant shadow-sm flex items-center"
                        style={{
                            width: `${LABEL_WIDTH_IN * 2}in`,
                            height: `${LABEL_HEIGHT_IN * 2}in`,
                            maxWidth: '100%',
                            padding: `${LABEL_PADDING_IN * 2}in`,
                            gap: '0.16in',
                            boxSizing: 'border-box',
                        }}
                    >
                        <div style={{ width: `${QR_SIZE_IN * 2}in`, height: `${QR_SIZE_IN * 2}in`, flexShrink: 0 }}>
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="QR" style={{ width: '100%', height: '100%', display: 'block' }} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-xs">
                                    Generando...
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-extrabold text-on-background leading-tight break-words" style={{ fontSize: '26pt', maxHeight: '1.52in', overflow: 'hidden' }}>
                                {printName}
                            </div>
                            <div className="font-mono font-bold text-on-surface-variant mt-2 break-all" style={{ fontSize: '18pt' }}>
                                {printCode}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-container-low rounded-xl px-4 py-3 text-xs text-on-surface-variant break-all">
                    <span className="font-semibold text-on-surface">Tamano: </span>
                    {LABEL_WIDTH_IN} x {LABEL_HEIGHT_IN}in
                    <span className="font-semibold text-on-surface ml-3">Contenido del QR: </span>
                    {printCode}
                </div>
            </div>
        </Modal>
    );
};

export default QrLabelModal;
