import mouseDownAudio from '@media/audio/mouse_down.mp3';
import mouseRolloverAudio from '@media/audio/mouse_rollover.mp3';

const audioCtx = new AudioContext();
const audioGain = audioCtx.createGain();
audioGain.connect(audioCtx.destination);

export function setAudioVolume(volume: number) {
    audioGain.gain.value = +volume || 0;
}

export function getAudioVolume() {
    return audioGain.gain.value;
}

setAudioVolume(0.5);

const audioBuffers = {} as Record<string, AudioBuffer | Promise<AudioBuffer>>;

function decodeBase64Mp3(src: string): Uint8Array<ArrayBuffer> {
    const base64 = src.replace("data:application/octet-stream;base64,", "");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export async function playAudio(src: string) {
    let buffer = audioBuffers[src];
    if (!buffer) {
        buffer = audioBuffers[src] = audioCtx.decodeAudioData(decodeBase64Mp3(src).buffer);
        buffer = await buffer;
        audioBuffers[src] = buffer;
    } else if (buffer instanceof Promise) {
        buffer = await buffer;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioGain);
    source.start();
    setTimeout(() => {
        source.stop();
    }, buffer.duration * 1000);
}

export function playMouseHoverAudio(): void {
    playAudio(mouseRolloverAudio);
}

export function playMouseDownAudio(): void {
    playAudio(mouseDownAudio);
}
