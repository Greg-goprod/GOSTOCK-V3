import type { User } from '../types';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Peut emprunter aujourd'hui : active et accès non échu (intérimaires, externes)
export const canBorrowNow = (u: Pick<User, 'active' | 'accessUntil'>) =>
  u.active !== false && (!u.accessUntil || u.accessUntil >= today());

// Date « accès jusqu'au » déjà passée (AAAA-MM-JJ)
export const accessExpired = (accessUntil?: string | null) => Boolean(accessUntil && accessUntil < today());
