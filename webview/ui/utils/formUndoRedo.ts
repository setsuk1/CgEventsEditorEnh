interface UndoRedoOptions {
	allowInMonaco?: boolean;
}

interface EnterCommitOptions {
	allowInMonaco?: boolean;
}

function isEventInContainer(event: Event, container: HTMLElement | null): boolean {
	if (!container) {
		return false;
	}
	const target = event.target;
	if (target instanceof Node && !container.contains(target)) {
		const modals = document.querySelectorAll('.modal.show');
		const topModal = modals.length > 0 ? modals[modals.length - 1] : null;
		if (!topModal || !topModal.contains(container)) {
			return false;
		}
	}
	return true;
}

export function handleUndoRedoShortcuts(
	event: KeyboardEvent,
	container: HTMLElement | null,
	onUndo: () => void,
	onRedo: () => void,
	options?: UndoRedoOptions
): boolean {
	if (!isEventInContainer(event, container)) {
		return false;
	}
	// if (event.defaultPrevented) {
	// 	return false;
	// }
	const hasCtrl = event.ctrlKey || event.metaKey;
	if (!hasCtrl) {
		return false;
	}
	const key = event.key.toLowerCase();
	if (key !== 'z' && key !== 'y') {
		return false;
	}
	const target = event.target;
	if (!options?.allowInMonaco && target instanceof HTMLElement && target.closest('.monaco-editor')) {
		return false;
	}
	event.preventDefault();
	if (key === 'z') {
		onUndo();
	} else {
		onRedo();
	}
	return true;
}

export function handleEnterCommitShortcut(
	event: KeyboardEvent,
	container: HTMLElement | null,
	onCommit: () => void,
	options?: EnterCommitOptions
): boolean {
	if (!isEventInContainer(event, container)) {
		return false;
	}
	if (event.key !== 'Enter') {
		return false;
	}
	if (event.isComposing) {
		return false;
	}
	if (event.ctrlKey || event.metaKey || event.altKey) {
		return false;
	}
	const target = event.target;
	if (container && target instanceof Node && !container.contains(target)) {
		return false;
	}
	if (!options?.allowInMonaco && target instanceof HTMLElement && target.closest('.monaco-editor')) {
		return false;
	}
	if (target instanceof HTMLTextAreaElement) {
		return false;
	}
	if (target instanceof HTMLSelectElement) {
		return false;
	}
	if (target instanceof HTMLButtonElement) {
		return false;
	}
	if (!(target instanceof HTMLInputElement)) {
		return false;
	}
	if (target instanceof HTMLElement && target.isContentEditable) {
		return false;
	}
	event.preventDefault();
	onCommit();
	return true;
}
