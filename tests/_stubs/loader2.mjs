// Test-only loader for the C2 loop: stub both the Supabase and email layers
// so the real request handlers run end to end without a database or Resend.
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('_lib/supabase.js')) {
    return { url: new URL('./supabase.stateful.mjs', import.meta.url).href, shortCircuit: true };
  }
  if (specifier.endsWith('_lib/email.js')) {
    return { url: new URL('./email.stub.mjs', import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
