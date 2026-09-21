export function decodeBase64DataUrl(src: string): Uint8Array<ArrayBuffer> {
	const commaIndex = src.indexOf(',');
	const base64 = commaIndex === -1 ? src : src.slice(commaIndex + 1);
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
