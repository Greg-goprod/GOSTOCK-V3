import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';

interface SitePoint {
  id: string;
  name: string;
  address: string | null;
  status: 'open' | 'closed';
  latitude: number | null;
  longitude: number | null;
}

interface OpenItem {
  site_id: string;
  label: string;
  holder: string | null;
  due_at: string;
  late: boolean;
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
// Couleurs des pastilles (tons MX) : danger = retard, bandeau ambre = matériel sur place, texte tertiaire = rien
const COLORS = { late: '#d6273d', items: '#f0b429', empty: '#82858f' };

// Où est mon matériel : chaque chantier sur la carte, avec ce qui s'y trouve encore
const SiteMap: React.FC = () => {
  const [sites, setSites] = useState<SitePoint[]>([]);
  const [items, setItems] = useState<OpenItem[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('sites').select('id, name, address, status, latitude, longitude').order('name'),
      supabase.from('site_open_items').select('site_id, label, holder, due_at, late').order('due_at'),
    ]).then(([s, o]) => {
      if (s.error) toast.error(errorMessage(s.error));
      setSites((s.data || []) as SitePoint[]);
      setItems((o.data || []) as OpenItem[]);
    });
  }, []);

  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = L.map(container.current, { scrollWheelZoom: true }).setView([46.8, 8.2], 8);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; contributeurs OpenStreetMap',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const shown = useMemo(() => sites.filter(s => showClosed || s.status === 'open'), [sites, showClosed]);
  const placed = shown.filter(s => s.latitude !== null && s.longitude !== null);
  const unplaced = shown.filter(s => s.latitude === null || s.longitude === null);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    for (const site of placed) {
      const here = items.filter(i => i.site_id === site.id);
      const late = here.some(i => i.late);
      const color = late ? COLORS.late : here.length ? COLORS.items : COLORS.empty;
      const list = here.slice(0, 12).map(i =>
        `<li${i.late ? ' style="color:#b91c1c;font-weight:600"' : ''}>${escape(i.label)}${i.holder ? ` · ${escape(i.holder)}` : ''} · retour ${escape(new Date(i.due_at).toLocaleDateString('fr-CH'))}</li>`).join('');
      const popup = `<strong>${escape(site.name)}</strong>${site.address ? `<br>${escape(site.address)}` : ''}
        <p style="margin:6px 0 2px">${here.length ? `${here.length} élément(s) sur le chantier` : 'Rien sur le chantier'}</p>
        ${list ? `<ul style="margin:0;padding-left:16px;max-height:180px;overflow:auto">${list}</ul>` : ''}
        ${here.length > 12 ? `<p style="margin:2px 0 0">+ ${here.length - 12} autre(s)</p>` : ''}`;
      L.circleMarker([site.latitude!, site.longitude!], { radius: here.length ? 11 : 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95 })
        .bindTooltip(site.name)
        .bindPopup(popup, { maxWidth: 320, autoPanPadding: [24, 80] })
        .addTo(layer.current);
    }
    if (placed.length) {
      map.current.fitBounds(L.latLngBounds(placed.map(s => [s.latitude!, s.longitude!] as [number, number])), { padding: [40, 40], maxZoom: 14 });
    }
  }, [placed, items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="mx-page-title">Carte</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Où est mon matériel : chaque chantier avec ce qui s'y trouve encore. Touche une pastille pour le détail.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
          Chantiers clôturés aussi
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-700 dark:text-gray-300">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: COLORS.late }} />Retard</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: COLORS.items }} />Matériel sur place</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: COLORS.empty }} />Rien sur place</span>
      </div>

      <div ref={container} className="h-[60vh] min-h-[320px] w-full rounded-lg shadow z-0" role="region" aria-label="Carte des chantiers" />

      {unplaced.length > 0 && (
        <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{`Pas encore sur la carte (${unplaced.length})`}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Ajoute l'adresse dans la fiche du chantier, ou place-le avec « Ma position » quand tu es sur place.
          </p>
          <ul className="text-sm text-gray-800 dark:text-gray-200 divide-y divide-gray-200 dark:divide-gray-700">
            {unplaced.map(s => {
              const count = items.filter(i => i.site_id === s.id).length;
              return <li key={s.id} className="py-1.5 flex justify-between gap-2"><span>{s.name}</span><span className="text-gray-500">{count ? `${count} élément(s)` : ''}</span></li>;
            })}
          </ul>
          <Link to="/chantiers" className="mt-2 inline-block text-sm text-primary-600 dark:text-primary-400 hover:underline">Ouvrir les chantiers →</Link>
        </section>
      )}
    </div>
  );
};

export default SiteMap;
