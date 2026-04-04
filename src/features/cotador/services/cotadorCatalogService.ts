import { cotadorService } from './cotadorService';

export async function loadCotadorCatalog() {
  return cotadorService.loadCatalog();
}
