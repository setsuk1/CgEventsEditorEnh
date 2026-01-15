let dynamicStyleCounter = 0;

export class DynamicStyle {
	readonly className: string;
	private styleElement: HTMLStyleElement | null;

	constructor(prefix: string) {
		const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, '');
		dynamicStyleCounter += 1;
		this.className = `${safePrefix}-${dynamicStyleCounter}`;
		if (typeof document === 'undefined') {
			this.styleElement = null;
			return;
		}
		const styleEl = document.createElement('style');
		styleEl.setAttribute('data-dynamic-style', this.className);
		document.head.appendChild(styleEl);
		this.styleElement = styleEl;
	}

	update(cssText: string) {
		if (!this.styleElement) return;
		this.styleElement.textContent = `.${this.className} { ${cssText} }`;
	}

	dispose() {
		if (!this.styleElement) return;
		this.styleElement.remove();
		this.styleElement = null;
	}
}
