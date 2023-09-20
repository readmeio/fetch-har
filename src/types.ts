export interface RequestInitWithDuplex extends RequestInit {
  /**
   * `RequestInit#duplex` does not yet exist in the TS `lib.dom.d.ts` definition yet the native
   * fetch implementation in Node 18+, `undici`, requires it for certain POST payloads.
   *
   * @see {@link https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483}
   * @see {@link https://github.com/nodejs/node/issues/46221}
   * @see {@link https://fetch.spec.whatwg.org/#request-class}
   * @see {@link https://github.com/microsoft/TypeScript/blob/main/lib/lib.dom.d.ts}
   */
  duplex?: 'half';
}

export interface FetchHAROptions {
  files?: Record<string, Blob | Buffer>;
  init?: RequestInitWithDuplex;
  userAgent?: string;
}
