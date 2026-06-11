// Test-only loader: redirect the Supabase data layer to a deterministic stub
// so the real request handlers can be exercised without a live database.
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('_lib/supabase.js')) {
    return {
      url: new URL('./supabase.stub.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}
