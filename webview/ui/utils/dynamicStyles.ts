let dynamicStyleCounter = 0;

export class DynamicStyle {
	readonly className: string;
	private styleElement: HTMLStyleElement | null = null;

	constructor(prefix: string) {
		const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, '');
		dynamicStyleCounter += 1;
		this.className = `${safePrefix}-${dynamicStyleCounter}`;
	}

	update(cssText: string) {
		if (typeof document === 'undefined') return;
		if (!this.styleElement) {
			const styleElement = document.createElement('style');
			styleElement.setAttribute('data-dynamic-style', this.className);
			document.head.appendChild(styleElement);
			this.styleElement = styleElement;
		}
		this.styleElement.textContent = `.${this.className} { ${cssText} }`;
	}

	dispose() {
		this.styleElement?.remove();
		this.styleElement = null;
	}
}
