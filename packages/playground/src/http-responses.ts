/** Build a plain-text 404 response. */
export function notFound(message = 'Not Found'): Response {
  return new Response(message, { status: 404, headers: { 'Content-Type': 'text/plain' } });
}
