import mouseDownAudio from '@media/audio/mouse_down.mp3';
import mouseRolloverAudio from '@media/audio/mouse_rollover.mp3';
import { decodeBase64DataUrl } from './dataUrl';

let audioVolume = 0.5;
let audioCtx: AudioContext | null = null;
let audioGain: GainNode | null = null;
const audioBuffers = new Map<string, AudioBuffer | Promise<AudioBuffer>>();

function getAudioContext(): AudioContext {
	if (!audioCtx || !audioGain) {
		audioCtx = new AudioContext();
		audioGain = audioCtx.createGain();
		audioGain.gain.value = audioVolume;
		audioGain.connect(audioCtx.destination);
	}
	return audioCtx;
}

export function setAudioVolume(volume: number): void {
	const next = Number(volume);
	audioVolume = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 0;
	if (audioGain) audioGain.gain.value = audioVolume;
}

export function getAudioVolume(): number {
	return audioVolume;
}

export async function playAudio(src: string): Promise<void> {
	if (audioVolume <= 0) return;
	const context = getAudioContext();
	if (context.state === 'suspended') await context.resume();

	let buffer = audioBuffers.get(src);
	if (!buffer) {
		buffer = context.decodeAudioData(decodeBase64DataUrl(src).buffer);
		audioBuffers.set(src, buffer);
		try {
			buffer = await buffer;
			audioBuffers.set(src, buffer);
		} catch (error) {
			audioBuffers.delete(src);
			throw error;
		}
	} else if (buffer instanceof Promise) {
		buffer = await buffer;
	}

	const source = context.createBufferSource();
	source.buffer = buffer;
	source.connect(audioGain!);
	source.start();
}

export function playMouseHoverAudio(): void {
	void playAudio(mouseRolloverAudio).catch((): void => {});
}

export function playMouseDownAudio(): void {
	void playAudio(mouseDownAudio).catch((): void => {});
}
