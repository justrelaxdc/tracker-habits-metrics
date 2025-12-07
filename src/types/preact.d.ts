// Preact JSX type declarations
// Using Record<string, unknown> instead of any for dynamic element props
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>;
  }
}

