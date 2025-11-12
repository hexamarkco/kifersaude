export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error &&
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      typeof specifier === 'string' &&
      !specifier.startsWith('node:') &&
      !specifier.startsWith('data:') &&
      !specifier.endsWith('.js')
    ) {
      try {
        return await nextResolve(`${specifier}.js`, context);
      } catch (innerError) {
        // If adding the extension still fails, fall through to throw original error
      }
    }
    throw error;
  }
}
