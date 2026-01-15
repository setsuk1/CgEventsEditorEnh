let openModalsCount = 0;

function updateBodyClass() {
	if (openModalsCount > 0) {
		document.body.classList.add('cgenh-has-modal-open');
		return;
	}
	document.body.classList.remove('cgenh-has-modal-open');
}

export function acquireModalLock(): () => void {
	openModalsCount += 1;
	updateBodyClass();
	let released = false;
	return () => {
		if (released) return;
		released = true;
		openModalsCount = Math.max(0, openModalsCount - 1);
		updateBodyClass();
	};
}
