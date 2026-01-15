export function getIndentClass(rawIndent: unknown): string | undefined {
	const indent = typeof rawIndent === 'number' ? rawIndent : Number(rawIndent);
	if (!Number.isFinite(indent) || indent <= 0) {
		return undefined;
	}
	const clamped = Math.min(Math.max(Math.floor(indent), 1), 5);
	return `cgenh-config-field--indent-${clamped}`;
}
