// Une seule définition du « stock bas » pour tous les écrans (Consommables, À commander, accueil, recherche).
// Avant, chaque écran comptait à sa façon : les articles retirés du service comptaient comme « épuisés »
// sur certains écrans et n'existaient pas sur d'autres.
import type { ConsumableStock, Equipment } from '../types';

// Un consommable « en service » : pas retiré
export const liveConsumables = (equipment: Equipment[]) =>
  equipment.filter(e => e.itemType === 'consumable' && e.status !== 'retired');

// Lignes de stock (un article dans un dépôt) sous leur seuil : exactement la règle de la feuille « À commander »
export const lowStockRows = (stock: ConsumableStock[], live: Equipment[]) => {
  const ids = new Set(live.map(e => e.id));
  return stock.filter(s => ids.has(s.equipmentId) && s.minQuantity > 0 && s.quantity < s.minQuantity);
};

// Articles en service sans aucun stock et sans seuil : « épuisés », mais la feuille « À commander » ne peut pas les proposer
export const exhaustedWithoutThreshold = (stock: ConsumableStock[], live: Equipment[]) =>
  live.filter(e => {
    const rows = stock.filter(s => s.equipmentId === e.id);
    return rows.reduce((sum, s) => sum + s.quantity, 0) === 0 && !rows.some(s => s.minQuantity > 0);
  });
