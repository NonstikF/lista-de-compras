import {
    BrowserMultiFormatReader,
    DecodeHintType,
    BarcodeFormat,
    NotFoundException,
} from '@zxing/library';

// Lee el código de barras de un ticket (imagen base64 / dataURL).
// Tickets de tienda usan típicamente Code128 o ITF (Interleaved 2 of 5).

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.ITF,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.UPC_A,
    BarcodeFormat.CODE_93,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

/**
 * Intenta decodificar el código de barras de una imagen dataURL.
 * Devuelve el texto del código, o null si no se detectó.
 */
export async function scanTicketBarcode(dataUrl: string): Promise<string | null> {
    const reader = new BrowserMultiFormatReader(hints);
    try {
        const result = await reader.decodeFromImageUrl(dataUrl);
        const text = result.getText().trim();
        return text || null;
    } catch (err) {
        if (err instanceof NotFoundException) return null;
        // Otros errores (imagen corrupta, formato no soportado) → tratar como no encontrado
        return null;
    } finally {
        reader.reset();
    }
}
