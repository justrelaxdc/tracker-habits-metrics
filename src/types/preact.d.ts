// Preact JSX type declarations
declare namespace JSX {
  interface IntrinsicElements {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSX IntrinsicElements requires any for dynamic element props
    [elemName: string]: any;
  }
}

