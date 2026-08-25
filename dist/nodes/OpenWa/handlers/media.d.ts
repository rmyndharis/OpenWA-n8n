import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Server-side media conversion.
 *
 * This exists to make the node's own "Send as Voice Note" toggle honest. Nothing
 * else in the pipeline transcodes: the gateway forwards the bytes it is given and
 * labels them as a voice note, so posting MP3 bytes with that toggle on produces a
 * microphone bubble that will not play. Convert first, then feed the returned
 * `base64` and `mimetype` into Message > Send Audio or Status > Send Voice.
 *
 * Conversion is opt-in on the server and needs ffmpeg, so it can be unavailable on
 * an otherwise current gateway. Check Availability reports whether it is.
 */
export declare function buildMediaRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
